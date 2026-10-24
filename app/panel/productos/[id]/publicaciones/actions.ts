"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCreator } from "@/lib/auth";
import { deleteMemberPost, removeComment, saveMemberPost, setCommenterBlocked } from "@/lib/community";
import { processPostNotifications } from "@/lib/community-notify";
import { parseMemberPostForm } from "@/lib/community-rules";
import { captureError } from "@/lib/monitoring";
import { tenantDb } from "@/lib/tenant";

export type PostEditorState = { ok?: string; error?: string; postId?: string } | undefined;

function refresh(productId: string, postId?: string) {
  revalidatePath(`/panel/productos/${productId}`);
  if (postId) revalidatePath(`/panel/productos/${productId}/publicaciones/${postId}`);
  revalidatePath(`/cuenta/membresias/${productId}`);
  // «Lo último en la comunidad» de la ficha pública (cacheada).
  revalidatePath("/[username]", "page");
}

/**
 * «Publicar ahora» / «Programar» / «Guardar borrador» / «Guardar cambios» del editor. Al publicar
 * ya, el aviso por email sale justo después de responder (after); el de las programadas, desde el
 * cron cuando llega su hora.
 */
export async function saveMemberPostAction(_: PostEditorState, form: FormData): Promise<PostEditorState> {
  const { creator } = await requireCreator();
  const parsed = parseMemberPostForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const r = await saveMemberPost(creator.id, creator.timezone, parsed.data);
  if (!r.ok) return { error: r.error };
  if (r.live)
    after(async () => {
      try {
        await processPostNotifications({ postId: r.postId });
      } catch (e) {
        captureError(e, { area: "comunidad", extra: { postId: r.postId } });
      }
    });
  refresh(r.productId, r.postId);
  if (!parsed.data.id) redirect(`/panel/productos/${r.productId}/publicaciones/${r.postId}?guardada=${encodeURIComponent(r.message)}`);
  return { ok: r.message, postId: r.postId };
}

export async function deleteMemberPostAction(form: FormData) {
  const { creator } = await requireCreator();
  const productId = await deleteMemberPost(creator.id, String(form.get("postId") ?? ""));
  if (!productId) redirect("/panel/productos");
  refresh(productId);
  redirect(`/panel/productos/${productId}?publicacion=borrada#publicaciones`);
}

/** «Borrar» un comentario desde el panel (moderación). */
export async function ownerDeleteComment(form: FormData) {
  const { user, creator } = await requireCreator();
  const commentId = String(form.get("commentId") ?? "");
  const c = await tenantDb(creator.id).membershipComment.findFirst({ where: { id: commentId }, select: { productId: true, postId: true } });
  if (!c) return;
  await removeComment(commentId, { userId: user.id, ownerOfCreatorId: creator.id });
  refresh(c.productId, c.postId);
  revalidatePath(`/cuenta/membresias/${c.productId}/${c.postId}`);
}

/** «No dejar comentar» / «Volver a dejar comentar» a una persona (sigue leyendo y dando «me gusta»). */
export async function setCommenterBlockedAction(form: FormData) {
  const { creator } = await requireCreator();
  const userId = String(form.get("userId") ?? "");
  const blocked = form.get("blocked") === "1";
  await setCommenterBlocked(creator.id, userId, blocked);
  const productId = String(form.get("productId") ?? "");
  const postId = String(form.get("postId") ?? "");
  if (productId) refresh(productId, postId || undefined);
}
