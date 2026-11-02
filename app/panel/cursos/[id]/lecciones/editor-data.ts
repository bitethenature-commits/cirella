import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { readDrip } from "@/lib/course-drip";
import { uploadPolicy } from "@/lib/file-types";
import { loadLessonEditor } from "@/lib/lessons";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import type { EditorPart } from "@/app/panel/productos/[id]/lecciones/part-card";

/**
 * Todo lo que el editor de lecciones del estudio necesita (lib/lessons.ts → loadLessonEditor) y,
 * para la vista previa y la apertura poco a poco, en qué puesto la verá la alumna: entre las
 * publicadas (más esta, si es un borrador o nueva). `lessonId` null = lección nueva al final de `moduleId`.
 */
export async function lessonEditorProps(productId: string, lessonId: string | null, moduleId?: string) {
  const { creator } = await requireCreator();
  const data = await loadLessonEditor(creator.id, productId, lessonId);
  if (!data || (lessonId && !data.lesson)) notFound();
  if (!data.modules.length) redirect(`/panel/cursos/${productId}`);
  const mod = data.modules.some((m) => m.id === moduleId) ? moduleId! : (data.lesson?.moduleId ?? data.modules[0].id);

  const ordered = await tenantDb(creator.id).lesson.findMany({
    where: { productId },
    orderBy: [{ module: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, published: true, moduleId: true },
  });
  const published = ordered.filter((l) => l.published);
  let before: number;
  if (lessonId) {
    const at = ordered.findIndex((l) => l.id === lessonId);
    before = ordered.slice(0, at).filter((l) => l.published).length;
  } else {
    // Al final de su módulo: delante quedan las publicadas de los módulos anteriores y las del suyo.
    const order = data.modules.map((m) => m.id);
    const upTo = order.indexOf(mod);
    before = published.filter((l) => order.indexOf(l.moduleId) <= upTo).length;
  }
  const isPublished = !!data.lesson?.published;
  const total = published.length + (isPublished ? 0 : 1);

  const l = data.lesson;
  const parts = (l?.parts ?? []).flatMap((p, i): EditorPart[] => {
    const key = `p${i}`;
    if (p.kind === "TEXT") return [{ key, kind: "TEXT", body: p.body ?? "", format: p.bodyFormat === "MD" ? "MD" : null }];
    if (p.kind === "FILE" && p.fileId) return [{ key, kind: "FILE", fileId: p.fileId }];
    if (p.kind === "EMBED") return [{ key, kind: "EMBED", url: p.url ?? "" }];
    return [];
  });
  const personal = isPersonalMode();
  return {
    productId: data.product.id,
    productTitle: data.product.title,
    modules: data.modules,
    files: data.files,
    lesson: l
      ? { id: l.id, moduleId: l.moduleId, title: l.title, durationMin: l.durationMin, version: l.version, parts, published: l.published, dripDays: l.dripDays }
      : // Una lección nueva nace en borrador: se publica cuando está lista.
        { id: null, moduleId: mod, title: "", durationMin: null, version: null, parts: [], published: false, dripDays: null },
    uploadLabel: uploadPolicy(personal).label,
    drip: readDrip(data.product),
    dripIndex: before,
    preview: { courseTitle: data.product.title, imageUrl: data.product.imageUrl, personal, number: before + 1, total },
  };
}
