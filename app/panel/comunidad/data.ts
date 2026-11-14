import "server-only";
import { NO_CHARGE_LABEL, type NoChargeProvider } from "@/lib/access-mode";
import { lastDayText } from "@/lib/access-end";
import { loadFeed } from "@/lib/community";
import { datetimeLocalValue, memberPostState, scheduleLabel } from "@/lib/community-rules";
import { communityTiers, type CommunityTier } from "@/lib/community-tiers";
import { activeAccessWhere } from "@/lib/membership-access";
import { monthGrid, type YearMonth } from "@/lib/owner-calendar";
import { moonPhasesBetween } from "@/lib/astro-calendar";
import { tenantDb } from "@/lib/tenant";
import { addDaysToKey, dateKeyInTz, formatDate, minutesToLabel, zonedParts, zonedTimeToUtc } from "@/lib/tz";
import type { StudioComment } from "./comment-moderation";
import type { ComposerPost, ComposerTier } from "./composer";

/**
 * Datos del estudio Comunidad (/panel/comunidad). Todo con tenantDb(creator.id): nada de otra creadora.
 */

type Owner = { id: string; userId: string; timezone: string };

/** Los niveles con cuántas personas leen lo que se publica en cada uno (las suyas y las de arriba). */
export async function loadTiers(owner: Owner, now = new Date()): Promise<{ tiers: CommunityTier[]; composerTiers: ComposerTier[] }> {
  const tiers = await communityTiers(owner.id);
  const db = tenantDb(owner.id);
  const composerTiers = await Promise.all(
    tiers.map(async (t) => {
      const readers = await db.access.findMany({
        where: { productId: { in: [t.id, ...t.includedBy] }, ...activeAccessWhere(now), NOT: { userId: owner.userId } },
        select: { userId: true },
        distinct: ["userId"],
      });
      return { id: t.id, title: t.title, emoji: t.emoji, readers: readers.length, inheritedBy: t.includedBy.map((id) => tiers.find((x) => x.id === id)!.title) };
    }),
  );
  return { tiers, composerTiers };
}

/** Lo que necesita el compositor para editar una publicación (null: no existe o no es suya). */
export async function loadComposerPost(owner: Owner, postId: string): Promise<{ post: ComposerPost; notifiedNote: string | null } | null> {
  const post = await tenantDb(owner.id).membershipPost.findFirst({ where: { id: postId }, include: { files: { orderBy: { sortOrder: "asc" } } } });
  if (!post) return null;
  const tz = owner.timezone;
  const state = memberPostState(post);
  return {
    post: {
      id: post.id,
      productId: post.productId,
      title: post.title,
      body: post.body,
      bodyFormat: post.bodyFormat,
      kind: post.kind,
      mediaUrl: post.mediaUrl ?? "",
      imageUrl: post.imageUrl ?? "",
      state,
      at: state === "SCHEDULED" ? datetimeLocalValue(post.publishedAt, tz) : "",
      notify: post.notify,
      commentsOpen: post.commentsOpen,
      pinned: !!post.pinnedAt,
      files: post.files.map((f) => ({ id: f.id, name: f.name, kind: f.kind, sizeBytes: f.sizeBytes, durationSec: f.durationSec, videoCodec: f.videoCodec, width: f.width, height: f.height })),
      eventDate: post.eventAt ? dateKeyInTz(post.eventAt, tz) : "",
      eventTime: post.eventAt ? (() => { const z = zonedParts(post.eventAt!, tz); return minutesToLabel(z.hour * 60 + z.minute); })() : "",
    },
    notifiedNote:
      post.notifiedAt && post.notify
        ? `Avisamos a ${post.notifiedCount} ${post.notifiedCount === 1 ? "persona" : "personas"} el ${formatDate(post.notifiedAt, { day: "numeric", month: "short" }, tz)}.`
        : null,
  };
}

export function emptyComposerPost(productId: string): ComposerPost {
  return { id: null, productId, title: "", body: "", bodyFormat: "MD", kind: "TEXT", mediaUrl: "", imageUrl: "", state: "DRAFT", at: "", notify: true, commentsOpen: true, pinned: false, files: [], eventDate: "", eventTime: "", };
}

/**
 * El Muro: lo que ven las miembros del nivel elegido (él y los de abajo) o, con «Todos», todo lo
 * publicado; las fijadas arriba. Con los comentarios de cada publicación para moderarlos ahí mismo
 * y sus vistas.
 */
export async function loadWall(owner: Owner, tiers: CommunityTier[], tierId: string | null, before: Date | null) {
  const tier = tierId ? tiers.find((t) => t.id === tierId) ?? null : null;
  const ids = tier ? [tier.id, ...tier.includes] : tiers.map((t) => t.id);
  if (!ids.length) return { posts: [], nextBefore: null, comments: new Map<string, StudioComment[]>(), fresh: new Set<string>(), views: new Map<string, number>() };
  const feed = await loadFeed({ productId: ids[0], alsoProductIds: ids.slice(1), viewer: { userId: owner.userId, isOwner: true }, publishedOnly: true, before });
  const postIds = feed.posts.map((p) => p.id);
  const db = tenantDb(owner.id);
  const [rows, viewRows] = await Promise.all([
    db.membershipComment.findMany({ where: { postId: { in: postIds } }, orderBy: { createdAt: "asc" } }),
    db.membershipPostView.groupBy({ by: ["postId"], where: { postId: { in: postIds } }, _count: { _all: true } }),
  ]);
  const blocked = new Set(
    (await db.customer.findMany({ where: { userId: { in: [...new Set(rows.map((c) => c.userId))] }, commentsBlockedAt: { not: null } }, select: { userId: true } })).map((c) => c.userId),
  );
  const when = (d: Date) => formatDate(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, owner.timezone);
  const comments = new Map<string, StudioComment[]>();
  const fresh = new Set<string>();
  const since = Date.now() - 48 * 3600_000;
  for (const c of rows) {
    const view: StudioComment = { id: c.id, userId: c.userId, authorName: c.authorName, byOwner: c.byOwner, body: c.body, status: c.status, when: when(c.createdAt), blocked: blocked.has(c.userId), replies: [] };
    if (!c.byOwner && c.status === "VISIBLE" && c.createdAt.getTime() > since) fresh.add(c.postId);
    const list = comments.get(c.postId) ?? [];
    if (c.parentId) list.find((p) => p.id === c.parentId)?.replies.push(view);
    else list.push(view);
    comments.set(c.postId, list);
  }
  // Los hilos más recientes arriba; un borrado sin respuestas no hace falta enseñarlo.
  for (const [k, list] of comments) comments.set(k, list.filter((c) => c.status !== "REMOVED" || c.replies.length).reverse());
  return { ...feed, comments, fresh, views: new Map(viewRows.map((v) => [v.postId, v._count._all])) };
}

/** Programadas (de la más cercana a la más lejana) y borradores (los últimos tocados arriba). */
export async function loadQueue(owner: Owner, tierId: string | null, now = new Date()) {
  const db = tenantDb(owner.id);
  const tierWhere = tierId ? { productId: tierId } : {};
  const select = {
    id: true,
    productId: true,
    title: true,
    kind: true,
    status: true,
    publishedAt: true,
    updatedAt: true,
    notify: true,
    pinnedAt: true,
    eventAt: true,
    product: { select: { title: true } },
    _count: { select: { files: true } },
  } as const;
  const [scheduled, drafts] = await Promise.all([
    db.membershipPost.findMany({ where: { ...tierWhere, status: "PUBLISHED", publishedAt: { gt: now } }, orderBy: { publishedAt: "asc" }, take: 100, select }),
    db.membershipPost.findMany({ where: { ...tierWhere, status: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 100, select }),
  ]);
  return { scheduled: scheduled.map((p) => ({ ...p, label: scheduleLabel(p.publishedAt, owner.timezone) })), drafts };
}

export type CalendarEntry = { id: string; productId: string; title: string; tier: string; state: "SCHEDULED" | "PUBLISHED"; time: string; live: boolean };
export type CalendarDay = { key: string; inMonth: boolean; entries: CalendarEntry[]; moon: "new" | "full" | null; moonLabel: string | null };

/**
 * Calendario del mes: publicadas y programadas en su día (hora de la dueña) y los encuentros en
 * directo (ceremonias, círculos, directos) el día que son; con las lunas nueva y llena.
 */
export async function loadCalendar(owner: Owner, month: YearMonth, tierId: string | null, now = new Date()): Promise<CalendarDay[]> {
  const tz = owner.timezone;
  const keys = monthGrid(month);
  const from = zonedTimeToUtc(keys[0], 0, tz);
  const to = zonedTimeToUtc(addDaysToKey(keys[keys.length - 1], 1), 0, tz);
  const posts = await tenantDb(owner.id).membershipPost.findMany({
    where: { ...(tierId ? { productId: tierId } : {}), status: "PUBLISHED", OR: [{ publishedAt: { gte: from, lt: to } }, { eventAt: { gte: from, lt: to } }] },
    orderBy: { publishedAt: "asc" },
    select: { id: true, productId: true, title: true, publishedAt: true, eventAt: true, product: { select: { title: true } } },
  });
  const time = (d: Date) => { const z = zonedParts(d, tz); return minutesToLabel(z.hour * 60 + z.minute); };
  const byDay = new Map<string, CalendarEntry[]>();
  const push = (key: string, e: CalendarEntry) => byDay.set(key, [...(byDay.get(key) ?? []), e]);
  for (const p of posts) {
    const state = p.publishedAt > now ? "SCHEDULED" : "PUBLISHED";
    if (p.publishedAt >= from && p.publishedAt < to) push(dateKeyInTz(p.publishedAt, tz), { id: p.id, productId: p.productId, title: p.title, tier: p.product.title, state, time: time(p.publishedAt), live: false });
    if (p.eventAt && p.eventAt >= from && p.eventAt < to) push(dateKeyInTz(p.eventAt, tz), { id: p.id, productId: p.productId, title: p.title, tier: p.product.title, state, time: time(p.eventAt), live: true });
  }
  const moons = new Map<string, { phase: "new" | "full"; label: string }>();
  for (const e of moonPhasesBetween(from, to)) if (e.kind === "moon") moons.set(dateKeyInTz(e.at, tz), { phase: e.phase, label: `${e.phase === "new" ? "Luna nueva" : "Luna llena"} · ${time(e.at)}` });
  const prefix = `${month.year}-${String(month.month).padStart(2, "0")}`;
  return keys.map((key) => ({ key, inMonth: key.startsWith(prefix), entries: byDay.get(key) ?? [], moon: moons.get(key)?.phase ?? null, moonLabel: moons.get(key)?.label ?? null }));
}

export type MemberRow = {
  accessId: string;
  userId: string;
  customerId: string | null;
  name: string;
  email: string;
  status: "active" | "canceled" | "expired";
  since: string;
  /** «Se renueva el 2 dic» / «Termina el 2 dic» / «Hasta el 2 dic (incluido)» / «Sin fecha de fin». */
  until: string;
  /** Suscripción · Dado a mano · Formulario gratis · Pago único. */
  origin: string;
  manual: boolean;
  /** Días que le quedan (0 = vence hoy; negativo = vencida). null = sin fecha o suscripción. */
  daysLeft: number | null;
  /** La bloqueó la dueña (X). */
  blocked: boolean;
  /** Se paga con suscripción automática (no lleva tick ni X). */
  subscription: boolean;
};

/** Miembros de un nivel (acceso directo a esa membresía): activas primero, luego las demás. */
export async function loadMembers(owner: Owner, tierId: string, now = new Date()): Promise<MemberRow[]> {
  const db = tenantDb(owner.id);
  const tz = owner.timezone;
  const rows = await db.access.findMany({
    where: { productId: tierId, NOT: { userId: owner.userId } },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { name: true, email: true } } },
  });
  const userIds = rows.map((r) => r.userId);
  const [customers, subs, orders] = await Promise.all([
    db.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true, userId: true, name: true, email: true } }),
    db.subscription.findMany({ where: { productId: tierId, userId: { in: userIds } }, orderBy: { createdAt: "desc" } }),
    db.order.findMany({ where: { id: { in: rows.map((r) => r.orderId).filter((x): x is string => !!x) } }, select: { id: true, paymentProvider: true } }),
  ]);
  const cust = new Map(customers.map((c) => [c.userId, c]));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const short = (d: Date) => formatDate(d, { day: "numeric", month: "short", year: "numeric" }, tz);
  const out = rows.map((a): MemberRow => {
    const c = cust.get(a.userId);
    const sub = subs.find((s) => s.userId === a.userId && (!a.subscriptionId || s.id === a.subscriptionId));
    const live = a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > now);
    const canceledSub = !!sub && (sub.status === "CANCELED" || sub.cancelAtPeriodEnd);
    const status: MemberRow["status"] = !live ? "expired" : canceledSub ? "canceled" : "active";
    const provider = a.orderId ? orderById.get(a.orderId)?.paymentProvider : null;
    const manual = provider === "manual";
    const origin = sub ? "Suscripción" : provider && provider in NO_CHARGE_LABEL ? NO_CHARGE_LABEL[provider as NoChargeProvider] : provider ? "Pago" : "Dado a mano";
    let until: string;
    if (!live) until = a.expiresAt ? `Terminó el ${short(a.expiresAt)}` : "Acceso retirado";
    else if (sub && sub.status !== "CANCELED") until = sub.cancelAtPeriodEnd ? `Termina el ${short(sub.currentPeriodEnd)}` : `Se renueva el ${short(sub.currentPeriodEnd)}`;
    else until = a.expiresAt ? `Hasta el ${lastDayText(a.expiresAt, tz, now)}` : "Sin fecha de fin";
    const daysLeft = a.expiresAt && !sub ? Math.ceil((a.expiresAt.getTime() - now.getTime()) / 86_400_000) - 1 : null;
    return {
      accessId: a.id,
      daysLeft,
      blocked: a.status === "REVOKED",
      subscription: !!sub,
      userId: a.userId,
      customerId: c?.id ?? null,
      name: c?.name || a.user.name || "—",
      email: c?.email ?? a.user.email,
      status,
      since: short(a.createdAt),
      until,
      origin: manual ? "Dado por ti" : origin,
      manual: manual || (!provider && !sub),
    };
  });
  const rank = { active: 0, canceled: 1, expired: 2 };
  return out.sort((a, b) => rank[a.status] - rank[b.status]);
}

/** «Datos»: por publicación (ya visibles), vistas, «me gusta», comentarios y a quién se avisó. */
export async function loadStats(owner: Owner, tierId: string | null, now = new Date()) {
  const db = tenantDb(owner.id);
  const posts = await db.membershipPost.findMany({
    where: { ...(tierId ? { productId: tierId } : {}), status: "PUBLISHED", publishedAt: { lte: now } },
    orderBy: { publishedAt: "desc" },
    take: 100,
    select: {
      id: true,
      productId: true,
      title: true,
      kind: true,
      publishedAt: true,
      pinnedAt: true,
      notify: true,
      notifiedAt: true,
      notifiedCount: true,
      product: { select: { title: true } },
      _count: { select: { likes: true, views: true, comments: { where: { status: "VISIBLE" } } } },
    },
  });
  const totals = posts.reduce((t, p) => ({ views: t.views + p._count.views, likes: t.likes + p._count.likes, comments: t.comments + p._count.comments }), { views: 0, likes: 0, comments: 0 });
  return { posts, totals };
}
