import { redirect } from "next/navigation";

/** Enlace de antes («Nueva publicación» de la ficha de la membresía): ahora se escribe en Comunidad. */
export default async function NewMemberPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/panel/comunidad?nivel=${encodeURIComponent(id)}&nueva=1#publicar`);
}
