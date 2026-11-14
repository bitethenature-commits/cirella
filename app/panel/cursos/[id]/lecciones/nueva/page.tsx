import type { Metadata } from "next";
import { LessonEditor } from "@/app/panel/productos/[id]/lecciones/lesson-editor";
import { lessonEditorProps } from "../editor-data";

export const metadata: Metadata = { title: "Nueva lección" };

/** Lección nueva (en borrador) al final del módulo elegido. */
export default async function StudioNewLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modulo?: string }> }) {
  const { id } = await params;
  const { modulo } = await searchParams;
  const props = await lessonEditorProps(id, null, modulo);
  return <LessonEditor key={`nueva-${props.lesson.moduleId}`} {...props} />;
}
