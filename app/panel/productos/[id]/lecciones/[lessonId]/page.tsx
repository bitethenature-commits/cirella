import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { uploadPolicy } from "@/lib/file-types";
import { LESSON_EMBED_WARNING, loadLessonEditor } from "@/lib/lessons";
import { isPersonalMode } from "@/lib/site-mode";
import { LessonEditor } from "../lesson-editor";
import type { EditorPart } from "../part-card";

export const metadata: Metadata = { title: "Editar lección" };

export default async function EditLessonPage({ params, searchParams }: { params: Promise<{ id: string; lessonId: string }>; searchParams: Promise<{ guardada?: string; aviso?: string }> }) {
  const { id, lessonId } = await params;
  const { guardada, aviso } = await searchParams;
  const { creator } = await requireCreator();
  const data = await loadLessonEditor(creator.id, id, lessonId);
  if (!data?.lesson) notFound();
  const l = data.lesson;
  const parts = l.parts.flatMap((p, i): EditorPart[] => {
    const key = `p${i}`;
    if (p.kind === "TEXT") return [{ key, kind: "TEXT", body: p.body ?? "", format: p.bodyFormat === "MD" ? "MD" : null }];
    if (p.kind === "FILE" && p.fileId) return [{ key, kind: "FILE", fileId: p.fileId }];
    if (p.kind === "EMBED") return [{ key, kind: "EMBED", url: p.url ?? "" }];
    return [];
  });
  return (
    <LessonEditor
      productId={data.product.id}
      productTitle={data.product.title}
      modules={data.modules}
      files={data.files}
      lesson={{ id: l.id, moduleId: l.moduleId, title: l.title, durationMin: l.durationMin, version: l.version, parts }}
      uploadLabel={uploadPolicy(isPersonalMode()).label}
      initialMessage={guardada ? "Lección guardada" : null}
      initialWarning={aviso === "enlace" ? LESSON_EMBED_WARNING : null}
    />
  );
}
