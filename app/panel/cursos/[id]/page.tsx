import type { Metadata } from "next";
import { Paperclip } from "lucide-react";
import { DeliveryAlert } from "@/components/ui/delivery-alert";
import { Flash } from "@/components/ui/flash";
import { readDrip } from "@/lib/course-drip";
import { uploadPolicy } from "@/lib/file-types";
import { readBlock } from "@/lib/lesson-blocks";
import { fileUsage, lessonPartViews } from "@/lib/lesson-parts";
import { isPersonalMode } from "@/lib/site-mode";
import { FilesManager } from "../../productos/[id]/files-manager";
import { CourseThemeCard } from "./course-theme-card";
import { DripCard } from "./drip-card";
import { loadStudioCourse } from "./load";
import { StructureBoard } from "./structure-board";
import { StudioHeader } from "./studio-header";

export const metadata: Metadata = { title: "Estudio del curso" };

/** Estudio del curso › Estructura: módulos y lecciones, apertura poco a poco y materiales. */
export default async function CourseStudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string; leccion?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { db, course } = await loadStudioCourse(id);
  const [modules, files] = await Promise.all([
    db.courseModule.findMany({
      where: { productId: id },
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
            parts: { orderBy: { sortOrder: "asc" }, select: { kind: true, fileId: true, data: true, file: { select: { kind: true } } } },
          },
        },
      },
    }),
    db.productFile.findMany({ where: { productId: id, postId: null }, orderBy: { sortOrder: "asc" } }),
  ]);
  const drip = readDrip(course);
  const published = modules.reduce((a, m) => a + m.lessons.filter((l) => l.published).length, 0);
  const noContent = course.status === "PUBLISHED" && course.accessMode !== "EXTERNAL" && published === 0;

  return (
    <div>
      <StudioHeader course={course} tab="estructura" />
      {sp.nuevo && <Flash ok="Curso creado en borrador. Elige su temática y añade sus lecciones; el precio y la publicación están en «Precio y venta»." />}
      {sp.leccion === "eliminada" && <Flash ok="Lección eliminada." />}
      {noContent && (
        <div className="mb-5">
          <DeliveryAlert title="Tus alumnas no ven ninguna lección" text="El curso está publicado pero todas sus lecciones están en borrador. Publica al menos una." cta="Ver lecciones" href="#estructura-titulo" tone="block" />
        </div>
      )}
      {/* Arriba, en una franja: la temática y cómo se abren las lecciones (antes, una columna a la derecha). */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <CourseThemeCard productId={course.id} initial={course.courseCategory} />
        <DripCard productId={course.id} drip={drip} />
      </div>
      <div>
        <StructureBoard
          productId={course.id}
          drip={drip}
          modules={modules.map((m) => ({
            id: m.id,
            title: m.title,
            lessons: m.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              durationMin: l.durationMin,
              views: lessonPartViews(l.parts),
              published: l.published,
              dripDays: l.dripDays,
              // Los capítulos de la lección (si es larga), en su orden: salen debajo de ella.
              chapters: l.parts.flatMap((p) => {
                const c = p.kind === "CHAPTER" ? readBlock("CHAPTER", p.data) : null;
                return c ? [{ title: c.title }] : [];
              }),
            })),
          }))}
        />
      </div>
      {/* Los materiales, plegados: se abren al tocarlos (también se suben desde cada lección). */}
      <details className="studio-fold card mt-8" id="materiales">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 [&::-webkit-details-marker]:hidden">
          <span className="panel-emblem h-9 w-9 shrink-0">
            <Paperclip className="h-4 w-4" />
          </span>
          <span className="font-semibold">Materiales del curso</span>
          <span className="ml-auto text-xs text-muted">{files.length} {files.length === 1 ? "archivo" : "archivos"}</span>
        </summary>
        <div className="border-t border-line p-4">
        <FilesManager
          productId={course.id}
          files={files}
          limitsLabel={uploadPolicy(isPersonalMode()).label}
          title="Materiales del curso"
          hint="Vídeos (MP4 o MOV), audios (M4A o MP3), PDF e imágenes. También puedes subirlos desde cada lección. Un material puede estar en varias lecciones."
          usage={fileUsage(modules.flatMap((m) => m.lessons.flatMap((l) => l.parts.map((p) => ({ fileId: p.fileId, lessonId: l.id })))))}
        />
        </div>
      </details>
    </div>
  );
}
