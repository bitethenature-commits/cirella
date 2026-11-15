import "server-only";
import { Prisma } from "@prisma/client";
import { automationSetting } from "./automations";
import { cleanCommentBody, canDeleteComment, publicMemberName, visibleMemberPostWhere } from "./community-rules";
import { postOptOutHeaders, postOptOutUrl } from "./community-optout";
import { postPath } from "./community-notify";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import * as T from "./email/templates";
import { limitComment } from "./limits";
import { captureError } from "./monitoring";
import { readPageConfig } from "./page-config";
import { truncateWords } from "./rich-text";
import { tenantDb } from "./tenant";

/**
 * Lo social de los comentarios, en las membresías y en las lecciones de los cursos:
 *
 *   · «Me gusta» en un comentario (los dos sitios).
 *   · Comentarios y respuestas (un nivel) en las lecciones, como en las publicaciones.
 *   · Avisos a quien escribió un comentario: le gusta a alguien o le han respondido. En la web
 *     (lo posterior a User.commentsSeenAt es nuevo: el punto del chat en «Mi cuenta») y por email.
 *   · La bandeja de «Comentarios» del área de alumna: lo que ha escrito, con sus me gusta y respuestas.
 *
 * Quien llama comprueba antes que la persona tiene acceso al curso o a la membresía (o es la dueña).
 */

export type CommentKind = "post" | "lesson";

const brandName = (c: { displayName: string; pagePublished: unknown; pageDraft: unknown }) =>
  readPageConfig((c.pagePublished ?? c.pageDraft) as never, c.displayName).displayName || c.displayName;

export const lessonPath = (productId: string, lessonId: string) => `/cuenta/cursos/${productId}?leccion=${lessonId}`;

// ── «Me gusta» en un comentario ──

/** «Me gusta» (o quitarlo) en un comentario visible. Idempotente (índice único). Avisa a su autora. */
export async function toggleCommentLike(kind: CommentKind, commentId: string, userId: string): Promise<{ liked: boolean; count: number } | null> {
  const c =
    kind === "post"
      ? await prisma.membershipComment.findFirst({ where: { id: commentId, status: "VISIBLE" }, select: { id: true, creatorId: true } })
      : await prisma.lessonComment.findFirst({ where: { id: commentId, status: "VISIBLE" }, select: { id: true, creatorId: true } });
  if (!c) return null;
  const table = kind === "post" ? prisma.membershipCommentLike : prisma.lessonCommentLike;
  const existing = await (table as typeof prisma.lessonCommentLike).findUnique({ where: { commentId_userId: { commentId, userId } }, select: { id: true } });
  let liked: boolean;
  if (existing) {
    await (table as typeof prisma.lessonCommentLike).deleteMany({ where: { id: existing.id } });
    liked = false;
  } else {
    try {
      const like = await (table as typeof prisma.lessonCommentLike).create({ data: { commentId, userId, creatorId: c.creatorId }, select: { id: true } });
      await notifyCommentLike(kind, like.id).catch((e) => captureError(e, { area: "comunidad", extra: { likeId: like.id } }));
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
    liked = true;
  }
  const count = await (table as typeof prisma.lessonCommentLike).count({ where: { commentId } });
  return { liked, count };
}

/** Quién da el «me gusta», como lo ven las demás: la dueña con el nombre de su web; si no, «Laura M.». */
async function likerName(creatorId: string, userId: string): Promise<string> {
  const creator = await prisma.creator.findUnique({ where: { id: creatorId }, select: { userId: true, displayName: true, pagePublished: true, pageDraft: true } });
  if (creator && creator.userId === userId) return brandName(creator);
  const customer = await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId, userId } }, select: { name: true, user: { select: { name: true } } } });
  const user = customer ? null : await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return publicMemberName(customer?.name || customer?.user.name || user?.name);
}

/** Email a la autora de un comentario: le ha gustado a alguien (salvo si se dio de baja de los avisos). */
async function notifyCommentLike(kind: CommentKind, likeId: string) {
  const like =
    kind === "post"
      ? await prisma.membershipCommentLike.findUnique({
          where: { id: likeId },
          include: { comment: { include: { post: { include: { product: { include: { creator: true } } } } } } },
        })
      : null;
  const lessonLike =
    kind === "lesson"
      ? await prisma.lessonCommentLike.findUnique({ where: { id: likeId }, include: { comment: { include: { lesson: { include: { product: { include: { creator: true } } } } } } } })
      : null;
  const row = like ?? lessonLike;
  if (!row || row.comment.userId === row.userId) return;
  const comment = row.comment;
  const customer = await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: comment.creatorId, userId: comment.userId } } });
  if (!customer || customer.postEmailsOptOutAt) return;
  const product = like ? like.comment.post.product : lessonLike!.comment.lesson.product;
  const placeTitle = like ? like.comment.post.title : lessonLike!.comment.lesson.title;
  const url = like ? `${appUrl()}${postPath(comment.productId, like.comment.postId)}#c-${comment.id}` : `${appUrl()}${lessonPath(comment.productId, lessonLike!.comment.lessonId)}#c-${comment.id}`;
  await enqueueEmail({
    to: customer.email,
    creatorId: comment.creatorId,
    userId: customer.userId,
    template: "COMMENT_LIKE",
    dedupeKey: `clike:${kind}:${comment.id}:${row.userId}`,
    headers: postOptOutHeaders(customer.id),
    ...T.commentLikedEmail({
      creatorName: brandName(product.creator),
      likerName: await likerName(comment.creatorId, row.userId),
      placeTitle,
      groupTitle: product.title,
      excerpt: truncateWords(comment.body, 300),
      url,
      optOutUrl: postOptOutUrl(customer.id),
    }),
  });
}

// ── Comentarios en las lecciones ──

/** Comentarios de una lección (lo borrado solo si tiene respuestas visibles), con sus «me gusta». */
export async function lessonComments(lessonId: string, viewerId: string) {
  const rows = await prisma.lessonComment.findMany({
    where: { lessonId, status: { in: ["VISIBLE", "REMOVED", "HIDDEN"] } },
    orderBy: { createdAt: "asc" },
    include: {
      likes: { where: { userId: viewerId }, select: { id: true } },
      _count: { select: { likes: true, replies: { where: { status: "VISIBLE" } } } },
    },
  });
  return rows.filter((c) => c.status === "VISIBLE" || c._count.replies > 0);
}

/** Comentario (o respuesta) en una lección. Quien llama ya ha comprobado el acceso y que es una sesión de cuenta. */
export async function addLessonComment(i: { lessonId: string; userId: string; isOwner: boolean; body: string; parentId?: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const lesson = await prisma.lesson.findUnique({ where: { id: i.lessonId }, include: { product: { include: { creator: true } } } });
  if (!lesson || (!i.isOwner && !lesson.published)) return { ok: false, error: "Esta lección ya no está disponible." };
  const customer = i.isOwner ? null : await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: lesson.creatorId, userId: i.userId } }, include: { user: { select: { name: true } } } });
  if (customer?.commentsBlockedAt) return { ok: false, error: "No puedes comentar aquí." };
  const text = cleanCommentBody(i.body);
  if (!text) return { ok: false, error: "Escribe un comentario." };
  let parent: { id: string; parentId: string | null; userId: string } | null = null;
  if (i.parentId) {
    parent = await prisma.lessonComment.findFirst({ where: { id: i.parentId, lessonId: lesson.id, status: "VISIBLE" }, select: { id: true, parentId: true, userId: true } });
    if (!parent) return { ok: false, error: "Ese comentario ya no está." };
    if (parent.parentId) return { ok: false, error: "Solo se puede responder a un comentario, no a una respuesta." };
  }
  if (!i.isOwner) {
    const limit = await limitComment(i.userId);
    if (!limit.ok) return { ok: false, error: limit.message };
  }
  const authorName = i.isOwner
    ? brandName(lesson.product.creator)
    : publicMemberName(customer?.name || customer?.user.name || (await prisma.user.findUnique({ where: { id: i.userId }, select: { name: true } }))?.name);
  const c = await prisma.lessonComment.create({
    data: { creatorId: lesson.creatorId, productId: lesson.productId, lessonId: lesson.id, userId: i.userId, parentId: parent?.id ?? null, body: text, authorName, byOwner: i.isOwner },
  });
  try {
    if (!i.isOwner) await notifyNewLessonComment(c.id);
    if (parent && parent.userId !== i.userId) await notifyLessonReply(c.id);
  } catch (e) {
    captureError(e, { area: "cursos", extra: { commentId: c.id } });
  }
  return { ok: true, id: c.id };
}

/** Borra un comentario de una lección (quien lo escribió o la dueña): queda REMOVED y sin texto. */
export async function removeLessonComment(commentId: string, actor: { userId: string; ownerOfCreatorId?: string | null }) {
  const c = await prisma.lessonComment.findUnique({ where: { id: commentId }, select: { id: true, userId: true, creatorId: true, status: true, productId: true, lessonId: true } });
  if (!c || c.status === "REMOVED") return null;
  const who = canDeleteComment(c, actor);
  if (!who || (c.status === "HIDDEN" && who !== "owner")) return null;
  const r = await prisma.lessonComment.updateMany({ where: { id: c.id, status: c.status }, data: { status: "REMOVED", body: "", removedBy: who === "owner" ? "OWNER" : "AUTHOR" } });
  return r.count ? { productId: c.productId, lessonId: c.lessonId } : null;
}

/** «Ocultar» / «Volver a mostrar» un comentario de una lección (la dueña). */
export async function setLessonCommentHidden(creatorId: string, commentId: string, hidden: boolean) {
  const db = tenantDb(creatorId);
  const c = await db.lessonComment.findFirst({ where: { id: commentId, status: hidden ? "VISIBLE" : "HIDDEN" }, select: { id: true, productId: true, lessonId: true } });
  if (!c) return null;
  await db.lessonComment.updateMany({ where: { id: c.id }, data: { status: hidden ? "HIDDEN" : "VISIBLE" } });
  return c;
}

/** A la dueña: comentario nuevo en una lección (la misma automatización que los de la comunidad). */
async function notifyNewLessonComment(commentId: string) {
  const c = await prisma.lessonComment.findUnique({ where: { id: commentId }, include: { lesson: { include: { product: true } } } });
  if (!c || c.byOwner) return;
  const s = await automationSetting(c.creatorId, "NEW_COMMENT");
  if (!s.enabled) return;
  await enqueueEmail({
    to: s.creator.contactEmail || s.creator.user.email,
    creatorId: c.creatorId,
    template: "COMMENT_NEW",
    dedupeKey: `lcomment:${c.id}`,
    ...T.newCommentCreatorEmail({
      membershipTitle: c.lesson.product.title,
      postTitle: c.lesson.title,
      author: c.authorName,
      excerpt: truncateWords(c.body, 400),
      url: `${appUrl()}/panel/cursos/comentarios#c-${c.id}`,
    }),
  });
}

/** A la autora de un comentario de una lección: le han respondido (salvo si se dio de baja de los avisos). */
async function notifyLessonReply(replyId: string) {
  const r = await prisma.lessonComment.findUnique({
    where: { id: replyId },
    include: { parent: { select: { userId: true } }, lesson: { include: { product: { include: { creator: true } } } } },
  });
  if (!r || !r.parent || r.parent.userId === r.userId) return;
  const customer = await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: r.creatorId, userId: r.parent.userId } } });
  if (!customer || customer.postEmailsOptOutAt) return;
  const creator = r.lesson.product.creator;
  await enqueueEmail({
    to: customer.email,
    creatorId: r.creatorId,
    userId: customer.userId,
    template: "COMMENT_REPLY",
    dedupeKey: `lreply:${r.id}`,
    headers: postOptOutHeaders(customer.id),
    ...T.commentReplyEmail({
      creatorName: brandName(creator),
      replierName: r.authorName,
      membershipTitle: r.lesson.product.title,
      postTitle: r.lesson.title,
      excerpt: truncateWords(r.body, 400),
      url: `${appUrl()}${lessonPath(r.productId, r.lessonId)}#c-${r.id}`,
      optOutUrl: postOptOutUrl(customer.id),
    }),
  });
}

// ── La bandeja «Comentarios» del área de alumna ──

export type InboxReply = { id: string; authorName: string; byOwner: boolean; body: string; when: Date; isNew: boolean };
export type InboxComment = {
  id: string;
  kind: CommentKind;
  /** Dónde está: la publicación o la lección, y la membresía o el curso. */
  placeTitle: string;
  groupTitle: string;
  href: string;
  body: string;
  when: Date;
  likes: number;
  newLikes: number;
  replies: InboxReply[];
  isNew: boolean;
};

const INBOX_TAKE = 60;

/** Lo que ha escrito (comentarios y respuestas suyas), lo más reciente primero, con lo nuevo marcado. */
export async function commentInbox(userId: string): Promise<{ items: InboxComment[]; unseen: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { commentsSeenAt: true } });
  const seen = user?.commentsSeenAt ?? new Date(0);
  const replySelect = { where: { status: "VISIBLE", NOT: { userId } }, orderBy: { createdAt: "asc" as const }, select: { id: true, authorName: true, byOwner: true, body: true, createdAt: true } };
  const [posts, lessons] = await Promise.all([
    prisma.membershipComment.findMany({
      where: { userId, status: "VISIBLE" },
      orderBy: { createdAt: "desc" },
      take: INBOX_TAKE,
      select: {
        id: true,
        body: true,
        createdAt: true,
        productId: true,
        postId: true,
        post: { select: { title: true, product: { select: { title: true } } } },
        likes: { where: { NOT: { userId } }, select: { createdAt: true } },
        replies: replySelect,
      },
    }),
    prisma.lessonComment.findMany({
      where: { userId, status: "VISIBLE" },
      orderBy: { createdAt: "desc" },
      take: INBOX_TAKE,
      select: {
        id: true,
        body: true,
        createdAt: true,
        productId: true,
        lessonId: true,
        lesson: { select: { title: true, product: { select: { title: true } } } },
        likes: { where: { NOT: { userId } }, select: { createdAt: true } },
        replies: replySelect,
      },
    }),
  ]);
  const shape = (
    c: (typeof posts)[number] | (typeof lessons)[number],
    kind: CommentKind,
    placeTitle: string,
    groupTitle: string,
    href: string,
  ): InboxComment => {
    const replies = c.replies.map((r) => ({ id: r.id, authorName: r.authorName, byOwner: r.byOwner, body: r.body, when: r.createdAt, isNew: r.createdAt > seen }));
    const newLikes = c.likes.filter((l) => l.createdAt > seen).length;
    return { id: c.id, kind, placeTitle, groupTitle, href, body: c.body, when: c.createdAt, likes: c.likes.length, newLikes, replies, isNew: newLikes > 0 || replies.some((r) => r.isNew) };
  };
  const items = [
    ...posts.map((c) => shape(c, "post", c.post.title, c.post.product.title, `${postPath(c.productId, c.postId)}#c-${c.id}`)),
    ...lessons.map((c) => shape(c, "lesson", c.lesson.title, c.lesson.product.title, `${lessonPath(c.productId, c.lessonId)}#c-${c.id}`)),
  ];
  // Lo que tiene novedades, arriba; luego por la última actividad.
  const last = (i: InboxComment) => Math.max(i.when.getTime(), ...i.replies.map((r) => r.when.getTime()));
  items.sort((a, b) => Number(b.isNew) - Number(a.isNew) || last(b) - last(a));
  const unseen = items.reduce((n, i) => n + i.newLikes + i.replies.filter((r) => r.isNew).length, 0);
  return { items, unseen };
}

/** Cuántos avisos nuevos tiene (me gusta y respuestas a sus comentarios): el punto del chat del menú. */
export async function unseenCommentCount(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { commentsSeenAt: true } });
  const after = user?.commentsSeenAt ?? new Date(0);
  const notMe = { NOT: { userId } };
  const [a, b, c, d] = await Promise.all([
    prisma.membershipCommentLike.count({ where: { ...notMe, createdAt: { gt: after }, comment: { userId, status: "VISIBLE" } } }),
    prisma.lessonCommentLike.count({ where: { ...notMe, createdAt: { gt: after }, comment: { userId, status: "VISIBLE" } } }),
    prisma.membershipComment.count({ where: { ...notMe, status: "VISIBLE", createdAt: { gt: after }, parent: { userId, status: "VISIBLE" } } }),
    prisma.lessonComment.count({ where: { ...notMe, status: "VISIBLE", createdAt: { gt: after }, parent: { userId, status: "VISIBLE" } } }),
  ]);
  return a + b + c + d;
}

/** Al abrir la ventana «Comentarios»: lo de hasta ahora deja de ser nuevo. */
export async function markCommentsSeen(userId: string, now = new Date()) {
  await prisma.user.update({ where: { id: userId }, data: { commentsSeenAt: now } });
}

// ── Favoritos de las lecciones y «Me gusta» de las publicaciones (carpetas del escritorio) ──

/** La estrella de una lección: guardarla en favoritos (o quitarla). Idempotente (índice único). */
export async function toggleLessonSave(lessonId: string, userId: string): Promise<{ saved: boolean } | null> {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true, creatorId: true, productId: true } });
  if (!lesson) return null;
  const existing = await prisma.lessonSave.findUnique({ where: { lessonId_userId: { lessonId, userId } }, select: { id: true } });
  if (existing) {
    await prisma.lessonSave.deleteMany({ where: { id: existing.id } });
    return { saved: false };
  }
  try {
    await prisma.lessonSave.create({ data: { lessonId, userId, creatorId: lesson.creatorId, productId: lesson.productId } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  return { saved: true };
}

/** Las lecciones que ha guardado (solo publicadas), lo más reciente primero. */
export async function savedLessonsOf(userId: string) {
  return prisma.lessonSave.findMany({
    where: { userId, lesson: { published: true } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, lesson: { select: { id: true, title: true, productId: true, product: { select: { title: true } } } } },
  });
}

/** Las publicaciones a las que ha dado «me gusta» (aún visibles), lo más reciente primero. */
export async function likedPostsOf(userId: string) {
  return prisma.membershipPostLike.findMany({
    where: { userId, post: visibleMemberPostWhere(new Date()) },
    orderBy: { createdAt: "desc" },
    select: { post: { select: { id: true, title: true, publishedAt: true, productId: true, product: { select: { title: true, creator: { select: { timezone: true } } } } } } },
  });
}
