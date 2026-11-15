"use server";

import { revalidatePath } from "next/cache";
import { getBuyerSession } from "@/lib/buyer-access";
import { addLessonComment, removeLessonComment, toggleCommentLike, toggleLessonSave } from "@/lib/comment-social";
import { prisma } from "@/lib/db";
import { limitLike } from "@/lib/limits";
import { accessSource } from "@/lib/membership-access";

type CommentState = { ok?: boolean; error?: string; at?: number } | undefined;

/**
 * Quién actúa sobre una lección: la dueña del curso o una alumna con acceso vigente, siempre con una
 * sesión de cuenta (no el enlace personal de un email).
 */
async function actor(lessonId: string) {
  const s = await getBuyerSession();
  if (!s || s.scope || !s.verified) return null;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true, productId: true, creatorId: true, published: true } });
  if (!lesson) return null;
  const isOwner = s.user.creator?.id === lesson.creatorId;
  if (!isOwner && (!lesson.published || !(await accessSource(s.user.id, lesson.productId)))) return null;
  return { user: s.user, isOwner, lesson };
}

const refresh = (productId: string) => {
  revalidatePath(`/cuenta/cursos/${productId}`);
  revalidatePath("/cuenta/archivos");
  revalidatePath("/panel/cursos/comentarios");
};

/** «Publicar comentario» (o responder) en una lección. */
export async function commentOnLesson(_: CommentState, form: FormData): Promise<CommentState> {
  const a = await actor(String(form.get("lessonId") ?? ""));
  if (!a) return { error: "Para comentar, entra con tu cuenta." };
  const parentId = String(form.get("parentId") ?? "") || null;
  const r = await addLessonComment({ lessonId: a.lesson.id, userId: a.user.id, isOwner: a.isOwner, body: String(form.get("body") ?? ""), parentId });
  if (!r.ok) return { error: r.error };
  refresh(a.lesson.productId);
  return { ok: true, at: Date.now() };
}

/** «Borrar» un comentario de una lección: quien lo escribió o la dueña. */
export async function deleteLessonComment(form: FormData) {
  const s = await getBuyerSession();
  if (!s || s.scope) return;
  const r = await removeLessonComment(String(form.get("commentId") ?? ""), { userId: s.user.id, ownerOfCreatorId: s.user.creator?.id ?? null });
  if (r) refresh(r.productId);
}

/** ♡ en un comentario de una lección (avisa a quien lo escribió). */
export async function likeLessonComment(commentId: string): Promise<{ liked: boolean; count: number } | { error: string }> {
  const c = await prisma.lessonComment.findUnique({ where: { id: String(commentId) }, select: { lessonId: true } });
  if (!c) return { error: "Ese comentario ya no está." };
  const a = await actor(c.lessonId);
  if (!a) return { error: "No tienes acceso a esta lección." };
  const limit = await limitLike(a.user.id);
  if (!limit.ok) return { error: limit.message };
  const r = await toggleCommentLike("lesson", String(commentId), a.user.id);
  if (!r) return { error: "Ese comentario ya no está." };
  refresh(a.lesson.productId);
  return r;
}

/** La estrella de una lección: guardarla en favoritos (o quitarla). */
export async function saveLesson(lessonId: string): Promise<{ saved: boolean } | { error: string }> {
  const a = await actor(String(lessonId));
  if (!a) return { error: "Para guardar, entra con tu cuenta." };
  const r = await toggleLessonSave(a.lesson.id, a.user.id);
  if (!r) return { error: "Esta lección ya no está." };
  revalidatePath("/cuenta/archivos");
  return r;
}
