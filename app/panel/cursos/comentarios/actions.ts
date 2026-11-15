"use server";

import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { addLessonComment, removeLessonComment, setLessonCommentHidden } from "@/lib/comment-social";
import { tenantDb } from "@/lib/tenant";

type ReplyState = { ok?: boolean; error?: string; at?: number } | undefined;

const refresh = (productId: string) => {
  revalidatePath("/panel/cursos/comentarios");
  revalidatePath(`/cuenta/cursos/${productId}`);
  revalidatePath("/cuenta/archivos");
};

/** Responder (o comentar) en una lección como autora. */
export async function ownerLessonReply(_: ReplyState, form: FormData): Promise<ReplyState> {
  const { user, creator } = await requireCreator();
  const lesson = await tenantDb(creator.id).lesson.findFirst({ where: { id: String(form.get("lessonId") ?? "") }, select: { id: true, productId: true } });
  if (!lesson) return { error: "Esta lección ya no está." };
  const r = await addLessonComment({ lessonId: lesson.id, userId: user.id, isOwner: true, body: String(form.get("body") ?? ""), parentId: String(form.get("parentId") ?? "") || null });
  if (!r.ok) return { error: r.error };
  refresh(lesson.productId);
  return { ok: true, at: Date.now() };
}

/** «Ocultar» / «Volver a mostrar» un comentario de una lección. */
export async function hideLessonComment(form: FormData) {
  const { creator } = await requireCreator();
  const r = await setLessonCommentHidden(creator.id, String(form.get("commentId") ?? ""), form.get("hidden") === "1");
  if (r) refresh(r.productId);
}

/** «Borrar» un comentario de una lección (queda «Comentario eliminado» si tiene respuestas). */
export async function deleteLessonCommentAsOwner(form: FormData) {
  const { user, creator } = await requireCreator();
  const c = await tenantDb(creator.id).lessonComment.findFirst({ where: { id: String(form.get("commentId") ?? "") }, select: { id: true } });
  if (!c) return;
  const r = await removeLessonComment(c.id, { userId: user.id, ownerOfCreatorId: creator.id });
  if (r) refresh(r.productId);
}
