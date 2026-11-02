import "server-only";
import { Prisma } from "@prisma/client";
import {
  canDeleteComment,
  cleanCommentBody,
  FEED_PAGE,
  isLivePostKind,
  isMemberPostVisible,
  memberPostState,
  notifyEditable,
  publicMemberName,
  resolveMemberPostTiming,
  scheduleSentence,
  visibleMemberPostWhere,
  type MemberPostForm,
} from "./community-rules";
import { notifyNewComment, notifyReply } from "./community-notify";
import { prisma } from "./db";
import { limitComment } from "./limits";
import { captureError } from "./monitoring";
import { readPageConfig } from "./page-config";
import { cleanRichInput, formatToStore, normalizeNewlines } from "./rich-text";
import { privateKey, storage } from "./storage";
import { tenantDb } from "./tenant";
import { labelToMinutes, zonedTimeToUtc } from "./tz";

/**
 * La comunidad de una membresía: publicaciones (con adjuntos, borradores y programadas),
 * comentarios y «me gusta».
 *
 *   · Lo de la dueña (guardar, borrar, moderar) va siempre por tenantDb(creatorId): un id de otra
 *     creadora no encuentra nada.
 *   · Lo de las miembros va con el cliente global, pero la creadora sale siempre de la fila de la
 *     publicación y el acceso lo comprueba quien llama (accessSource o dueña).
 */

/** Borra del almacenamiento los archivos ya eliminados de la BD (si falla, quedan huérfanos: no rompe nada). */
async function deleteStored(keys: (string | null)[]) {
  const list = keys.filter((k): k is string => !!k).map(privateKey);
  if (list.length) await storage().delete(list).catch((e) => captureError(e, { area: "comunidad", extra: { keys: list.length } }));
}

export type SavePostResult = { ok: true; postId: string; productId: string; live: boolean; message: string } | { ok: false; error: string };

/** Crea o edita una publicación desde el editor del panel. */
export async function saveMemberPost(creatorId: string, timeZone: string, input: MemberPostForm, now = new Date()): Promise<SavePostResult> {
  const db = tenantDb(creatorId);
  const product = await db.product.findFirst({ where: { id: input.productId, type: "MEMBERSHIP" }, select: { id: true } });
  if (!product) return { ok: false, error: "Membresía no encontrada" };
  // Una publicación existente se puede pasar a otro nivel (otra membresía de la misma creadora).
  const current = input.id ? await db.membershipPost.findFirst({ where: { id: input.id, product: { type: "MEMBERSHIP" } } }) : null;
  if (input.id && !current) return { ok: false, error: "Esta publicación ya no existe." };

  const timing = resolveMemberPostTiming({ when: input.when, at: input.at, current, timeZone, now });
  if (!timing.ok) return timing;
  const raw = normalizeNewlines(input.body).trim();
  const bodyFormat = formatToStore(raw, input.bodyFormat, current?.bodyFormat ?? null);
  const body = bodyFormat ? cleanRichInput(raw, { creatorId, images: true }) : raw;
  const data = {
    title: input.title,
    body,
    bodyFormat,
    kind: input.kind,
    mediaUrl: input.mediaUrl || null,
    // Directo, ceremonia o círculo: su fecha (en los demás tipos no se guarda).
    eventAt: isLivePostKind(input.kind) && input.eventDate && input.eventTime ? zonedTimeToUtc(input.eventDate, labelToMinutes(input.eventTime), timeZone) : null,
    status: timing.status,
    publishedAt: timing.publishedAt,
    // Una vez visible, el aviso ya salió (o no se pidió): no se cambia al editar.
    notify: notifyEditable(current, now) ? input.notify : current!.notify,
    commentsOpen: input.commentsOpen,
    // «Fijar arriba»: conserva la fecha en que se fijó (orden entre fijadas); sin el campo, no cambia.
    ...(input.pinned === undefined ? {} : { pinnedAt: input.pinned ? (current?.pinnedAt ?? now) : null }),
    ...(current && current.productId !== product.id ? { productId: product.id } : {}),
  };
  const post = current
    ? await db.membershipPost.update({ where: { id: current.id }, data })
    : await db.membershipPost.create({ data: { ...data, creatorId, productId: product.id } });

  // Pasó a otro nivel: sus comentarios también (cada uno lleva la membresía de su publicación).
  if (current && current.productId !== product.id) await db.membershipComment.updateMany({ where: { postId: post.id }, data: { productId: product.id } });

  // Adjuntos: solo archivos de las membresías de esta creadora (tenantDb), sueltos o ya de esta
  // publicación (un id de otra creadora, de un curso o de otra publicación no se puede reclamar). Pasan
  // a la membresía de la publicación: el acceso a cada archivo se comprueba con la suya.
  const ids = [...new Set(input.attachmentIds)];
  if (ids.length)
    await db.productFile.updateMany({
      where: { id: { in: ids }, product: { type: "MEMBERSHIP" }, OR: [{ postId: null }, { postId: post.id }] },
      data: { postId: post.id, productId: product.id },
    });
  for (const [i, id] of ids.entries()) await db.productFile.updateMany({ where: { id, postId: post.id }, data: { sortOrder: i } });
  // Los que quitó del editor se borran (fila y archivo).
  const removed = await db.productFile.findMany({ where: { postId: post.id, id: { notIn: ids } }, select: { id: true, storageKey: true } });
  if (removed.length) {
    await db.productFile.deleteMany({ where: { id: { in: removed.map((f) => f.id) } } });
    await deleteStored(removed.map((f) => f.storageKey));
  }

  const state = memberPostState(post, now);
  const message =
    state === "DRAFT"
      ? "Borrador guardado. Solo lo ves tú."
      : state === "SCHEDULED"
        ? `Programada para el ${scheduleSentence(post.publishedAt, timeZone)}.`
        : current && memberPostState(current, now) === "PUBLISHED"
          ? "Cambios guardados."
          : post.notify && !post.notifiedAt
            ? "Publicado. Avisaremos a tus miembros por email en unos minutos."
            : "Publicado.";
  return { ok: true, postId: post.id, productId: product.id, live: state === "PUBLISHED", message };
}

/** Borra una publicación con sus adjuntos (también del almacenamiento), comentarios y «me gusta». */
export async function deleteMemberPost(creatorId: string, postId: string): Promise<string | null> {
  const db = tenantDb(creatorId);
  const post = await db.membershipPost.findFirst({ where: { id: postId }, select: { id: true, productId: true } });
  if (!post) return null;
  const files = await db.productFile.findMany({ where: { postId: post.id }, select: { storageKey: true } });
  await db.productFile.deleteMany({ where: { postId: post.id } });
  await db.membershipPost.deleteMany({ where: { id: post.id } });
  await deleteStored(files.map((f) => f.storageKey));
  return post.productId;
}

/**
 * Archivos subidos para una publicación que nunca se guardó (se cerró el editor): sin publicación,
 * de una membresía y con más de 24 h. Lo hace el cron.
 */
export async function purgeOrphanPostFiles(now = new Date()): Promise<number> {
  const old = await prisma.productFile.findMany({
    where: { postId: null, product: { type: "MEMBERSHIP" }, createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) }, lessonParts: { none: {} } },
    select: { id: true, storageKey: true },
    take: 50,
  });
  if (!old.length) return 0;
  await prisma.productFile.deleteMany({ where: { id: { in: old.map((f) => f.id) }, postId: null } });
  await deleteStored(old.map((f) => f.storageKey));
  return old.length;
}

// ── Lo que ven las miembros ──

export type Viewer = { userId: string; isOwner: boolean };

const FEED_FILE_SELECT = { id: true, name: true, kind: true, durationSec: true } as const;

/**
 * Publicaciones de una comunidad, de 15 en 15 (`before`: las anteriores a esa fecha). La dueña ve también
 * borradores y programadas. `alsoProductIds`: los niveles de abajo que incluye esta membresía
 * (lib/membership-access.ts → includedMembershipIds): un nivel superior lee también sus publicaciones.
 */
export async function loadFeed(i: {
  productId: string;
  alsoProductIds?: string[];
  viewer: Viewer;
  before?: Date | null;
  now?: Date;
  /** Solo las que ya ven los miembros, aunque mire la dueña (el «Muro» del estudio). */
  publishedOnly?: boolean;
}) {
  const now = i.now ?? new Date();
  const base: Prisma.MembershipPostWhereInput[] = [{ productId: { in: [i.productId, ...(i.alsoProductIds ?? [])] } }];
  if (!i.viewer.isOwner || i.publishedOnly) base.push(visibleMemberPostWhere(now));
  const include = {
    product: { select: { title: true } },
    files: { orderBy: { sortOrder: "asc" }, select: FEED_FILE_SELECT },
    likes: { where: { userId: i.viewer.userId }, select: { id: true } },
    _count: { select: { likes: true, comments: { where: { status: "VISIBLE" } } } },
  } satisfies Prisma.MembershipPostInclude;
  // Las fijadas van arriba, solo en la primera página (y no se repiten en las siguientes).
  const pinned = i.before
    ? []
    : await prisma.membershipPost.findMany({
        where: { AND: [...base, { pinnedAt: { not: null } }] },
        orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
        take: FEED_PAGE,
        include,
      });
  const and = [...base, { pinnedAt: null }];
  if (i.before) and.push({ publishedAt: { lt: i.before } });
  const rows = await prisma.membershipPost.findMany({
    where: { AND: and },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: FEED_PAGE + 1,
    include,
  });
  const shape = ({ likes, ...p }: (typeof rows)[number]) => ({ ...p, likedByMe: likes.length > 0, state: memberPostState(p, now), pinned: !!p.pinnedAt });
  const regular = rows.slice(0, FEED_PAGE).map(shape);
  const more = rows.length > FEED_PAGE;
  return { posts: [...pinned.map(shape), ...regular], nextBefore: more ? regular[regular.length - 1].publishedAt.toISOString() : null };
}

/**
 * Anota que una miembro ha abierto una publicación (una vez por persona: las «vistas» del estudio).
 * Nunca la dueña. Si falla no pasa nada (no impide leer).
 */
export async function recordPostView(post: { id: string; creatorId: string }, userId: string) {
  try {
    await prisma.membershipPostView.createMany({ data: [{ postId: post.id, creatorId: post.creatorId, userId }], skipDuplicates: true });
  } catch (e) {
    captureError(e, { area: "comunidad", extra: { postId: post.id } });
  }
}

export type FeedPost = Awaited<ReturnType<typeof loadFeed>>["posts"][number];

/** Una publicación para su página: archivos para los visores, comentarios y «me gusta». */
export async function getMemberPost(postId: string, viewer: Viewer, now = new Date()) {
  const post = await prisma.membershipPost.findUnique({
    where: { id: postId },
    include: {
      product: { include: { creator: true } },
      files: { orderBy: { sortOrder: "asc" } },
      likes: { where: { userId: viewer.userId }, select: { id: true } },
      _count: { select: { likes: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { _count: { select: { replies: { where: { status: "VISIBLE" } } } } } },
    },
  });
  if (!post) return null;
  if (!viewer.isOwner && !isMemberPostVisible(post, now)) return null;
  // Un comentario borrado solo se enseña (como «Comentario eliminado») si tiene respuestas visibles.
  const comments = post.comments.filter((c) => c.status === "VISIBLE" || c._count.replies > 0);
  const { likes, ...rest } = post;
  return { ...rest, comments, likedByMe: likes.length > 0, state: memberPostState(post, now) };
}

export type MemberPostDetail = NonNullable<Awaited<ReturnType<typeof getMemberPost>>>;

/** «Me gusta» (o quitarlo). Idempotente con dos toques a la vez (índice único). */
export async function toggleLike(postId: string, userId: string, creatorId: string): Promise<{ liked: boolean; count: number }> {
  const existing = await prisma.membershipPostLike.findUnique({ where: { postId_userId: { postId, userId } }, select: { id: true } });
  let liked: boolean;
  if (existing) {
    await prisma.membershipPostLike.deleteMany({ where: { id: existing.id } });
    liked = false;
  } else {
    try {
      await prisma.membershipPostLike.create({ data: { postId, userId, creatorId } });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
    liked = true;
  }
  return { liked, count: await prisma.membershipPostLike.count({ where: { postId } }) };
}

/** Nombre de la dueña en su comunidad: el de su página. */
function ownerName(c: { displayName: string; pagePublished: Prisma.JsonValue; pageDraft: Prisma.JsonValue }) {
  return readPageConfig(c.pagePublished ?? c.pageDraft, c.displayName).displayName || c.displayName;
}

/**
 * Comentario (o respuesta, un solo nivel) en una publicación. Quien llama ya ha comprobado que
 * tiene acceso (o que es la dueña) y que su sesión es de cuenta, no un enlace de email.
 */
export async function addComment(i: { postId: string; userId: string; isOwner: boolean; body: string; parentId?: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const post = await prisma.membershipPost.findUnique({ where: { id: i.postId }, include: { product: { include: { creator: true } } } });
  if (!post || (!i.isOwner && !isMemberPostVisible(post))) return { ok: false, error: "Esta publicación ya no está disponible." };
  if (!post.commentsOpen && !i.isOwner) return { ok: false, error: "Los comentarios están cerrados." };
  const customer = i.isOwner ? null : await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: post.creatorId, userId: i.userId } }, include: { user: { select: { name: true } } } });
  if (customer?.commentsBlockedAt) return { ok: false, error: "No puedes comentar en esta comunidad." };
  const text = cleanCommentBody(i.body);
  if (!text) return { ok: false, error: "Escribe un comentario." };
  let parent: { id: string; parentId: string | null; userId: string } | null = null;
  if (i.parentId) {
    parent = await prisma.membershipComment.findFirst({ where: { id: i.parentId, postId: post.id, status: "VISIBLE" }, select: { id: true, parentId: true, userId: true } });
    if (!parent) return { ok: false, error: "Ese comentario ya no está." };
    if (parent.parentId) return { ok: false, error: "Solo se puede responder a un comentario, no a una respuesta." };
  }
  if (!i.isOwner) {
    const limit = await limitComment(i.userId);
    if (!limit.ok) return { ok: false, error: limit.message };
  }
  const authorName = i.isOwner
    ? ownerName(post.product.creator)
    : publicMemberName(customer?.name || customer?.user.name || (await prisma.user.findUnique({ where: { id: i.userId }, select: { name: true } }))?.name);
  const c = await prisma.membershipComment.create({
    data: { creatorId: post.creatorId, productId: post.productId, postId: post.id, userId: i.userId, parentId: parent?.id ?? null, body: text, authorName, byOwner: i.isOwner },
  });
  try {
    if (!i.isOwner) await notifyNewComment(c.id);
    else if (parent && parent.userId !== i.userId) await notifyReply(c.id);
  } catch (e) {
    captureError(e, { area: "comunidad", extra: { commentId: c.id } });
  }
  return { ok: true, id: c.id };
}

/** Borra un comentario (quien lo escribió o la dueña): queda REMOVED y sin texto. */
export async function removeComment(commentId: string, actor: { userId: string; ownerOfCreatorId?: string | null }): Promise<boolean> {
  const c = await prisma.membershipComment.findUnique({ where: { id: commentId }, select: { id: true, userId: true, creatorId: true, status: true } });
  if (!c || c.status === "REMOVED") return false;
  const who = canDeleteComment(c, actor);
  // Uno oculto solo lo puede borrar la dueña (para su autora ya no está).
  if (!who || (c.status === "HIDDEN" && who !== "owner")) return false;
  const r = await prisma.membershipComment.updateMany({ where: { id: c.id, status: c.status }, data: { status: "REMOVED", body: "", removedBy: who === "owner" ? "OWNER" : "AUTHOR" } });
  return r.count > 0;
}

/** «Ocultar» / «Volver a mostrar» un comentario (la dueña): oculto no lo ve nadie más, pero no se pierde. */
export async function setCommentHidden(creatorId: string, commentId: string, hidden: boolean): Promise<{ productId: string; postId: string } | null> {
  const db = tenantDb(creatorId);
  const c = await db.membershipComment.findFirst({ where: { id: commentId, status: hidden ? "VISIBLE" : "HIDDEN" }, select: { id: true, productId: true, postId: true } });
  if (!c) return null;
  await db.membershipComment.updateMany({ where: { id: c.id }, data: { status: hidden ? "HIDDEN" : "VISIBLE" } });
  return { productId: c.productId, postId: c.postId };
}

/** «No dejar comentar» / «Volver a dejar comentar» a una persona de su comunidad. */
export async function setCommenterBlocked(creatorId: string, userId: string, blocked: boolean): Promise<boolean> {
  const r = await tenantDb(creatorId).customer.updateMany({ where: { userId }, data: { commentsBlockedAt: blocked ? new Date() : null } });
  return r.count > 0;
}
