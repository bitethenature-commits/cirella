import { redirect } from "next/navigation";

/**
 * Enlace de antes: las lecciones se editan ahora en el estudio de cursos (/panel/cursos/<id>/lecciones/…),
 * que comprueba que el curso y la lección son de esta creadora.
 */
export default async function OldEditLessonPage({ params, searchParams }: { params: Promise<{ id: string; lessonId: string }>; searchParams: Promise<{ guardada?: string; aviso?: string }> }) {
  const { id, lessonId } = await params;
  const sp = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  redirect(`/panel/cursos/${encodeURIComponent(id)}/lecciones/${encodeURIComponent(lessonId)}${sp.size ? `?${sp}` : ""}`);
}
