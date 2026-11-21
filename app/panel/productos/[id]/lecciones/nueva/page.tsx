import { redirect } from "next/navigation";

/** Enlace de antes: las lecciones se crean ahora desde el editor del curso («Añadir lección» en su índice). */
export default async function OldNewLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/panel/cursos/${encodeURIComponent(id)}/lecciones`);
}
