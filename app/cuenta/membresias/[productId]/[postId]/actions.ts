"use server";

import { revalidatePath } from "next/cache";
import { getBuyerSession } from "@/lib/buyer-access";
import { addComment, removeComment, toggleLike, toggleSave } from "@/lib/community";
import { toggleCommentLike } from "@/lib/comment-social";
import { isMemberPostVisible } from "@/lib/community-rules";
import { prisma } from "@/lib/db";
import { limitLike } from "@/lib/limits";
import { accessSource, scopeCoversProduct } from "@/lib/membership-access";

export type CommentState = { ok?: boolean; error?: string; at?: number } | undefined;

/**
 * Quién actúa sobre una publicación: la dueña, o alguien con acceso vigente a su membresía.
 * `account`: sesión de cuenta (no el enlace personal de un email, que solo deja leer y dar «me gusta»).
 */
async function actor(postId: string) {
  const s = await getBuyerSession();
  if (!s) return null;
  const post = await prisma.membershipPost.findUnique({ where: { id: postId }, select: { id: true, productId: true, creatorId: true, status: true, publishedAt: true } });
  if (!post) return null;
  const isOwner = !s.scope && s.user.creator?.id === post.creatorId;
  if (!isOwner) {
    if (s.scope ? !(await scopeCoversProduct(s.scope, post.productId)) : !s.verified) return null;
    if (!isMemberPostVisible(post) || !(await accessSource(s.user.id, post.productId))) return null;
  }
  return { user: s.user, isOwner, account: !s.scope, post };
}

const refresh = (p: { productId: string; id: string }) => {
  revalidatePath(`/cuenta/membresias/${p.productId}/${p.id}`);
  revalidatePath(`/cuenta/membresias/${p.productId}`);
  revalidatePath("/panel/comunidad");
};

/** ♥: también desde el enlace personal del email. */
export async function likePost(postId: string): Promise<{ liked: boolean; count: number } | { error: string }> {
  const a = await actor(postId);
  if (!a) return { error: "No tienes acceso a esta publicación." };
  const limit = await limitLike(a.user.id);
  if (!limit.ok) return { error: limit.message };
  const r = await toggleLike(a.post.id, a.user.id, a.post.creatorId);
  refresh(a.post);
  revalidatePath("/cuenta/archivos");
  return r;
}

/** «Guardar»: solo con una sesión de cuenta (lo guardado vive en «Mis archivos»). */
export async function savePost(postId: string): Promise<{ saved: boolean } | { error: string }> {
  const a = await actor(postId);
  if (!a) return { error: "No tienes acceso a esta publicación." };
  if (!a.account) return { error: "Para guardar, entra con tu email." };
  const r = await toggleSave(a.post.id, a.user.id, a.post.creatorId);
  revalidatePath("/cuenta/archivos");
  return r;
}

/** «Publicar comentario» (o responder): solo con una sesión de cuenta, nunca desde un enlace reenviado. */
export async function commentOnPost(_: CommentState, form: FormData): Promise<CommentState> {
  const postId = String(form.get("postId") ?? "");
  const a = await actor(postId);
  if (!a) return { error: "No tienes acceso a esta publicación." };
  if (!a.account) return { error: "Para comentar, entra con tu email." };
  const parentId = String(form.get("parentId") ?? "") || null;
  const r = await addComment({ postId: a.post.id, userId: a.user.id, isOwner: a.isOwner, body: String(form.get("body") ?? ""), parentId });
  if (!r.ok) return { error: r.error };
  refresh(a.post);
  return { ok: true, at: Date.now() };
}

/** «Borrar» un comentario: quien lo escribió o la dueña. */
export async function deleteComment(form: FormData) {
  const s = await getBuyerSession();
  if (!s || s.scope) return;
  const c = await prisma.membershipComment.findUnique({ where: { id: String(form.get("commentId") ?? "") }, select: { id: true, postId: true, productId: true } });
  if (!c) return;
  await removeComment(c.id, { userId: s.user.id, ownerOfCreatorId: s.user.creator?.id ?? null });
  refresh({ productId: c.productId, id: c.postId });
}

/** ♡ en un comentario: solo con una sesión de cuenta (avisa a quien lo escribió). */
export async function likeComment(commentId: string): Promise<{ liked: boolean; count: number } | { error: string }> {
  const c = await prisma.membershipComment.findUnique({ where: { id: String(commentId) }, select: { postId: true } });
  if (!c) return { error: "Ese comentario ya no está." };
  const a = await actor(c.postId);
  if (!a) return { error: "No tienes acceso a esta publicación." };
  if (!a.account) return { error: "Para dar «me gusta», entra con tu email." };
  const limit = await limitLike(a.user.id);
  if (!limit.ok) return { error: limit.message };
  const r = await toggleCommentLike("post", String(commentId), a.user.id);
  if (!r) return { error: "Ese comentario ya no está." };
  refresh(a.post);
  revalidatePath("/cuenta/archivos");
  return r;
}
