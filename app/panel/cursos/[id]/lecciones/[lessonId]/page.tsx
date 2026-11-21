import type { Metadata } from "next";
import { lessonCanvaProps } from "../editor-data";
import { LessonCanva } from "../lesson-canva";

export const metadata: Metadata = { title: "Editar lección" };

/** Editor de una lección sobre la vista de alumna (como el Canva de la web), con el índice del curso a la izquierda. */
export default async function StudioLessonPage({ params, searchParams }: { params: Promise<{ id: string; lessonId: string }>; searchParams: Promise<{ capitulo?: string; nueva?: string }> }) {
  const { id, lessonId } = await params;
  const sp = await searchParams;
  const props = await lessonCanvaProps(id, lessonId);
  const chapter = Number(sp.capitulo);
  return <LessonCanva key={lessonId} {...props} initialChapter={Number.isInteger(chapter) && chapter >= 0 ? chapter : 0} fresh={sp.nueva === "1"} />;
}
