import "server-only";
import { redirect } from "next/navigation";
import { hasAccountLook, readAccountLook } from "@/lib/account-look";
import { readCourseLook, readLookPatch, readPieceLook } from "@/lib/course-design";
import { readDrip } from "@/lib/course-drip";
import { uploadPolicy } from "@/lib/file-types";
import { emptyBlock, isBlockKind, parseBlock, readBlock } from "@/lib/lesson-blocks";
import { lessonPartViews } from "@/lib/lesson-parts";
import { loadLessonEditor } from "@/lib/lessons";
import { isPersonalMode } from "@/lib/site-mode";
import type { EditorPart } from "@/app/panel/productos/[id]/lecciones/part-card";
import { loadStudioCourse } from "../load";
import type { BoardModule } from "../structure-board";
import type { CanvaCourse } from "./course-canva";

type BoardRow = {
  id: string;
  title: string;
  lessons: {
    id: string;
    title: string;
    durationMin: number | null;
    published: boolean;
    dripDays: number | null;
    parts: { kind: string; data: unknown; file: { kind: string } | null }[];
  }[];
};

/** Los módulos y lecciones como los pinta la estructura en escalera (con los capítulos de cada lección larga). */
export function toBoardModules(rows: BoardRow[]): BoardModule[] {
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      durationMin: l.durationMin,
      views: lessonPartViews(l.parts),
      published: l.published,
      dripDays: l.dripDays,
      chapters: l.parts.flatMap((p) => {
        const c = p.kind === "CHAPTER" ? readBlock("CHAPTER", p.data) : null;
        return c ? [{ title: c.title }] : [];
      }),
    })),
  }));
}

/** Lo que el editor de lecciones necesita del curso: cómo lo ve la alumna (sus colores) y el índice de la izquierda. */
export async function courseCanvaData(productId: string) {
  const { user, creator, db, course } = await loadStudioCourse(productId);
  const rows = await db.courseModule.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      lessons: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          durationMin: true,
          published: true,
          dripDays: true,
          parts: { orderBy: { sortOrder: "asc" }, select: { kind: true, data: true, file: { select: { kind: true } } } },
        },
      },
    },
  });
  const personal = isPersonalMode();
  // Sus colores del área de alumna (como en «Ver como alumna»): la lección se ve igual que la verá ella.
  const look = readAccountLook(user.accountLook);
  const data: CanvaCourse = {
    id: course.id,
    title: course.title,
    imageUrl: course.imageUrl,
    look: hasAccountLook(look) ? look : null,
    design: readCourseLook(course.courseDesign),
    drip: readDrip(course),
    personal,
    uploadLabel: uploadPolicy(personal).label,
  };
  return { creator, course: data, board: toBoardModules(rows) };
}

/**
 * Todo lo que el editor de una lección necesita (lib/lessons.ts → loadLessonEditor) y en qué puesto la verá la
 * alumna: entre las publicadas (más esta, si es un borrador). Si la lección ya no existe (borrada desde otra
 * pantalla), vuelve a la primera del curso.
 */
export async function lessonCanvaProps(productId: string, lessonId: string) {
  const { creator, course, board } = await courseCanvaData(productId);
  const data = await loadLessonEditor(creator.id, productId, lessonId);
  if (!data?.lesson) redirect(`/panel/cursos/${productId}/lecciones`);
  const l = data.lesson;

  const ordered = board.flatMap((m) => m.lessons);
  const at = ordered.findIndex((x) => x.id === l.id);
  const before = ordered.slice(0, Math.max(0, at)).filter((x) => x.published).length;
  const total = ordered.filter((x) => x.published).length + (l.published ? 0 : 1);

  const parts = l.parts.flatMap((p, i): EditorPart[] => {
    const key = `p${i}`;
    const design = readPieceLook(p.design);
    if (p.kind === "TEXT") return [{ key, kind: "TEXT", body: p.body ?? "", format: p.bodyFormat === "MD" ? "MD" : null, design }];
    if (p.kind === "FILE" && p.fileId) return [{ key, kind: "FILE", fileId: p.fileId, design }];
    if (p.kind === "EMBED") return [{ key, kind: "EMBED", url: p.url ?? "", design }];
    if (isBlockKind(p.kind)) {
      const b = parseBlock(p.kind, p.data);
      return [{ key, ...(b.ok ? b.part : emptyBlock(p.kind)), design }];
    }
    return [];
  });

  return {
    course,
    board,
    files: data.files,
    lesson: {
      id: l.id,
      moduleId: l.moduleId,
      title: l.title,
      durationMin: l.durationMin,
      version: l.version,
      parts,
      published: l.published,
      dripDays: l.dripDays,
      design: readLookPatch(l.design),
    },
    place: { number: before + 1, total, dripIndex: before },
  };
}
