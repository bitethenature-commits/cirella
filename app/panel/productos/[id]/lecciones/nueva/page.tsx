import { redirect } from "next/navigation";

/** Enlace de antes: una lección nueva se prepara ahora en el estudio de cursos. */
export default async function OldNewLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modulo?: string }> }) {
  const { id } = await params;
  const { modulo } = await searchParams;
  redirect(`/panel/cursos/${encodeURIComponent(id)}/lecciones/nueva${typeof modulo === "string" ? `?modulo=${encodeURIComponent(modulo)}` : ""}`);
}
