import "server-only";
import { attachmentSentence, MEMBER_POST_KIND_LABEL, NOTIFY_WINDOW_DAYS, type MemberPostKind } from "./community-rules";
import { postOptOutHeaders, postOptOutUrl } from "./community-optout";
import { automationSetting } from "./automations";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import * as T from "./email/templates";
import { activeMembersPage } from "./membership-access";
import { createOrderLink, emailAlreadyQueued, orderLinkNote } from "./order-links";
import { readPageConfig } from "./page-config";
import { richToPlain, truncateWords } from "./rich-text";

/**
 * Avisos por email de la comunidad.
 *
 * processPostNotifications: cuando una publicación se hace visible (al publicar, desde after(); o
 * al llegar su hora, desde el cron), un email a cada persona con acceso vigente a la membresía,
 * salvo a quien se dio de baja de los avisos y a la propia dueña. Se reparte por páginas (cursor por
 * userId en la publicación), cada email con su dedupeKey: si se corta a mitad, la siguiente
 * ejecución sigue donde iba, y si after() y el cron coinciden nadie recibe dos.
 * Los emails son masivos (MEMBER_POST): la bandeja de salida los envía detrás de los demás.
 */

const DAY = 86_400_000;
const PAGE = 100;

export const postPath = (productId: string, postId: string) => `/cuenta/membresias/${productId}/${postId}`;

const brandName = (c: { displayName: string; pagePublished: unknown; pageDraft: unknown }) =>
  readPageConfig((c.pagePublished ?? c.pageDraft) as never, c.displayName).displayName || c.displayName;

export async function processPostNotifications(o: { postId?: string; budget?: number; now?: Date } = {}): Promise<number> {
  const now = o.now ?? new Date();
  let budget = o.budget ?? 500;
  const windowStart = new Date(now.getTime() - NOTIFY_WINDOW_DAYS * DAY);
  // Las que se quedaron sin avisar más de 7 días (el cron estuvo parado): ya no se avisa.
  if (!o.postId)
    await prisma.membershipPost.updateMany({ where: { status: "PUBLISHED", notify: true, notifiedAt: null, publishedAt: { lte: windowStart } }, data: { notifiedAt: now } });
  const posts = await prisma.membershipPost.findMany({
    where: { ...(o.postId ? { id: o.postId } : {}), status: "PUBLISHED", notify: true, notifiedAt: null, publishedAt: { lte: now, gt: windowStart } },
    orderBy: { publishedAt: "asc" },
    take: 10,
    include: { product: { include: { creator: true } }, files: { orderBy: { sortOrder: "asc" }, select: { kind: true, durationSec: true } } },
  });
  let created = 0;
  for (const post of posts) {
    let cursor = post.notifyCursor;
    const creator = post.product.creator;
    const path = postPath(post.productId, post.id);
    const excerpt = truncateWords(richToPlain(post.body, post.bodyFormat), 320);
    const attachments = attachmentSentence(post.files);
    while (budget > 0) {
      const take = Math.min(PAGE, budget);
      const members = await activeMembersPage(post.creatorId, post.productId, { afterUserId: cursor, take, now });
      let made = 0;
      for (const m of members) {
        if (m.optedOut || !m.email || !m.customerId) continue;
        const dedupeKey = `post:${post.id}:${m.userId}`;
        if (await emailAlreadyQueued(dedupeKey)) continue;
        const link = m.orderId ? await createOrderLink({ orderId: m.orderId, path }) : null;
        await enqueueEmail({
          to: m.email,
          creatorId: post.creatorId,
          userId: m.userId,
          template: "MEMBER_POST",
          dedupeKey,
          sendNow: false,
          headers: postOptOutHeaders(m.customerId),
          ...T.memberPostEmail({
            creatorName: brandName(creator),
            membershipTitle: post.product.title,
            postTitle: post.title,
            kindLabel: post.kind === "TEXT" ? null : MEMBER_POST_KIND_LABEL[post.kind as MemberPostKind],
            excerpt,
            attachments,
            url: link?.url ?? `${appUrl()}${path}`,
            linkNote: link ? orderLinkNote(link.expiresAt) : null,
            optOutUrl: postOptOutUrl(m.customerId),
          }),
        });
        made++;
      }
      budget -= Math.max(members.length, 1);
      created += made;
      const last = members.length ? members[members.length - 1].userId : cursor;
      const done = members.length < take;
      // El cursor solo avanza desde donde lo dejamos: si otra ejecución ya avanzó, esta se retira.
      const moved = await prisma.membershipPost.updateMany({
        where: { id: post.id, notifyCursor: cursor, notifiedAt: null },
        data: { notifyCursor: last, notifiedCount: { increment: made }, ...(done ? { notifiedAt: now } : {}) },
      });
      if (!moved.count || done) break;
      cursor = last;
    }
    if (budget <= 0) break;
  }
  return created;
}

/** A la dueña: comentario nuevo de una miembro (automatización «Comentarios nuevos»). */
export async function notifyNewComment(commentId: string) {
  const c = await prisma.membershipComment.findUnique({ where: { id: commentId }, include: { post: { include: { product: true } } } });
  if (!c || c.byOwner) return;
  const s = await automationSetting(c.creatorId, "NEW_COMMENT");
  if (!s.enabled) return;
  await enqueueEmail({
    to: s.creator.contactEmail || s.creator.user.email,
    creatorId: c.creatorId,
    template: "COMMENT_NEW",
    dedupeKey: `comment:${c.id}`,
    ...T.newCommentCreatorEmail({
      membershipTitle: c.post.product.title,
      postTitle: c.post.title,
      author: c.authorName,
      excerpt: truncateWords(c.body, 400),
      url: `${appUrl()}${postPath(c.productId, c.postId)}#c-${c.id}`,
    }),
  });
}

/** A la autora de un comentario: le han respondido, la dueña u otra persona (si no se dio de baja de los avisos). */
export async function notifyReply(replyId: string) {
  const r = await prisma.membershipComment.findUnique({
    where: { id: replyId },
    include: { parent: { select: { userId: true } }, post: { include: { product: { include: { creator: true } } } } },
  });
  if (!r || !r.parent || r.parent.userId === r.userId) return;
  const customer = await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: r.creatorId, userId: r.parent.userId } } });
  if (!customer || customer.postEmailsOptOutAt) return;
  const creator = r.post.product.creator;
  await enqueueEmail({
    to: customer.email,
    creatorId: r.creatorId,
    userId: customer.userId,
    template: "COMMENT_REPLY",
    dedupeKey: `reply:${r.id}`,
    headers: postOptOutHeaders(customer.id),
    ...T.commentReplyEmail({
      creatorName: brandName(creator),
      replierName: r.byOwner ? undefined : r.authorName,
      membershipTitle: r.post.product.title,
      postTitle: r.post.title,
      excerpt: truncateWords(r.body, 400),
      url: `${appUrl()}${postPath(r.productId, r.postId)}#c-${r.id}`,
      optOutUrl: postOptOutUrl(customer.id),
    }),
  });
}
