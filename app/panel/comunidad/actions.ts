"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCreator } from "@/lib/auth";
import { addComment, deleteMemberPost, removeComment, saveMemberPost, setCommenterBlocked, setCommentHidden } from "@/lib/community";
import { processPostNotifications } from "@/lib/community-notify";
import { memberPostState, parseMemberPostForm } from "@/lib/community-rules";
import { captureError } from "@/lib/monitoring";
import { tenantDb } from "@/lib/tenant";

/**
 * Acciones del estudio Comunidad (/panel/comunidad). Todo va por tenantDb(creator.id) o por las
 * funciones de lib/community.ts que lo usan: un id de otra creadora no encuentra nada.
 */

export type ComposerState = { error?: string } | undefined;
export type ReplyState = { ok?: boolean; error?: string; at?: number } | undefined;

/** Lo que cambia al tocar una publicación: el estudio, el área de miembros y la ficha pública. */
function refresh(productIds: (string | null | undefined)[], postId?: string) {
  revalidatePath("/panel/comunidad");
  for (const id of new Set(productIds.filter((x): x is string => !!x))) {
    revalidatePath(`/panel/productos/${id}`);
    revalidatePath(`/cuenta/membresias/${id}`);
    if (postId) revalidatePath(`/cuenta/membresias/${id}/${postId}`);
  }
  // «Lo último en la comunidad» de la ficha pública (cacheada).
  revalidatePath("/[username]", "page");
}

/** Avisa por email justo después de responder (si ya se ve); las programadas, el cron cuando llega su hora. */
function notifySoon(postId: string) {
  after(async () => {
    try {
      await processPostNotifications({ postId });
    } catch (e) {
      captureError(e, { area: "comunidad", extra: { postId } });
    }
  });
}

const back = (tab: string, ok: string, extra = "") => redirect(`/panel/comunidad?tab=${tab}&ok=${encodeURIComponent(ok)}&t=${Date.now()}${extra}`);

/**
 * «Publicar» / «Programar» / «Guardar borrador» / «Guardar cambios» del compositor. El nivel es la
 * membresía de la publicación (los niveles de arriba la heredan). Al terminar vuelve al Muro (si ya
 * se ve) o a Programadas.
 */
export async function saveStudioPost(_: ComposerState, form: FormData): Promise<ComposerState> {
  const { creator } = await requireCreator();
  const parsed = parseMemberPostForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const before = parsed.data.id ? await tenantDb(creator.id).membershipPost.findFirst({ where: { id: parsed.data.id }, select: { productId: true } }) : null;
  const r = await saveMemberPost(creator.id, creator.timezone, parsed.data);
  if (!r.ok) return { error: r.error };
  if (r.live) notifySoon(r.postId);
  refresh([r.productId, before?.productId], r.postId);
  back(r.live ? "muro" : "programadas", r.message);
}

/** «Publicar ahora» de una programada o un borrador (desde Programadas). */
export async function publishNow(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const post = await db.membershipPost.findFirst({ where: { id: String(form.get("postId") ?? "") } });
  if (!post) return;
  if (memberPostState(post) !== "PUBLISHED") {
    await db.membershipPost.updateMany({ where: { id: post.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    notifySoon(post.id);
  }
  refresh([post.productId], post.id);
  back("muro", post.notify && !post.notifiedAt ? "Publicado. Avisaremos a tus miembros por email en unos minutos." : "Publicado.");
}

/** «Fijar arriba» / «Quitar de arriba». */
export async function togglePin(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const post = await db.membershipPost.findFirst({ where: { id: String(form.get("postId") ?? "") }, select: { id: true, productId: true, pinnedAt: true } });
  if (!post) return;
  await db.membershipPost.updateMany({ where: { id: post.id }, data: { pinnedAt: post.pinnedAt ? null : new Date() } });
  refresh([post.productId], post.id);
}

export async function deleteStudioPost(form: FormData) {
  const { creator } = await requireCreator();
  const productId = await deleteMemberPost(creator.id, String(form.get("postId") ?? ""));
  refresh([productId]);
  const tab = String(form.get("tab") ?? "muro");
  back(["muro", "programadas"].includes(tab) ? tab : "muro", "Publicación eliminada.");
}

// ── Moderación desde el propio feed ──

/** Responder a un comentario (o comentar) como autora. A la miembro le llega el aviso de respuesta. */
export async function ownerReply(_: ReplyState, form: FormData): Promise<ReplyState> {
  const { user, creator } = await requireCreator();
  const post = await tenantDb(creator.id).membershipPost.findFirst({ where: { id: String(form.get("postId") ?? "") }, select: { id: true, productId: true } });
  if (!post) return { error: "Esta publicación ya no está." };
  const r = await addComment({ postId: post.id, userId: user.id, isOwner: true, body: String(form.get("body") ?? ""), parentId: String(form.get("parentId") ?? "") || null });
  if (!r.ok) return { error: r.error };
  refresh([post.productId], post.id);
  return { ok: true, at: Date.now() };
}

/** «Ocultar» / «Volver a mostrar» un comentario. */
export async function hideComment(form: FormData) {
  const { creator } = await requireCreator();
  const r = await setCommentHidden(creator.id, String(form.get("commentId") ?? ""), form.get("hidden") === "1");
  if (r) refresh([r.productId], r.postId);
}

/** «Borrar» un comentario (queda «Comentario eliminado» si tiene respuestas). */
export async function deleteCommentAsOwner(form: FormData) {
  const { user, creator } = await requireCreator();
  const c = await tenantDb(creator.id).membershipComment.findFirst({ where: { id: String(form.get("commentId") ?? "") }, select: { id: true, productId: true, postId: true } });
  if (!c) return;
  await removeComment(c.id, { userId: user.id, ownerOfCreatorId: creator.id });
  refresh([c.productId], c.postId);
}

/** «No dejar comentar» / «Volver a dejar comentar» a una persona (sigue leyendo y dando «me gusta»). */
export async function blockCommenter(form: FormData) {
  const { creator } = await requireCreator();
  await setCommenterBlocked(creator.id, String(form.get("userId") ?? ""), form.get("blocked") === "1");
  revalidatePath("/panel/comunidad");
}
