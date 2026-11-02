import type { Metadata } from "next";
import { LESSON_EMBED_WARNING } from "@/lib/lessons";
import { LessonEditor } from "@/app/panel/productos/[id]/lecciones/lesson-editor";
import { lessonEditorProps } from "../editor-data";

export const metadata: Metadata = { title: "Editar lección" };

/** Editor de una lección a página completa, con la vista previa de la alumna al lado. */
export default async function StudioLessonPage({ params, searchParams }: { params: Promise<{ id: string; lessonId: string }>; searchParams: Promise<{ guardada?: string; aviso?: string }> }) {
  const { id, lessonId } = await params;
  const { guardada, aviso } = await searchParams;
  const props = await lessonEditorProps(id, lessonId);
  return <LessonEditor key={lessonId} {...props} initialMessage={guardada ? "Lección guardada" : null} initialWarning={aviso === "enlace" ? LESSON_EMBED_WARNING : null} />;
}
