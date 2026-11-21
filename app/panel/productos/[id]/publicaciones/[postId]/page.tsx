import { redirect } from "next/navigation";

/** Enlace de antes (editor de una publicación en la ficha de la membresía): ahora se edita en Comunidad. */
export default async function EditMemberPostPage({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { postId } = await params;
  redirect(`/panel/comunidad?editar=${encodeURIComponent(postId)}#publicar`);
}
