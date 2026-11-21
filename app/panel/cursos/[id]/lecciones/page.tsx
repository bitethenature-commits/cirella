import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CourseCanvaEmpty } from "./course-canva";
import { courseCanvaData } from "./editor-data";

export const metadata: Metadata = { title: "Editar curso" };

/** La entrada al editor del curso (desde Cursos): abre su primera lección; sin lecciones, lo que falta para empezar. */
export default async function CourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { course, board } = await courseCanvaData(id);
  const first = board.flatMap((m) => m.lessons)[0];
  if (first) redirect(`/panel/cursos/${id}/lecciones/${first.id}`);
  return <CourseCanvaEmpty course={course} board={board} />;
}
