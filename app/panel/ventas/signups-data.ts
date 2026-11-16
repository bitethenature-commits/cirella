import "server-only";
import { NO_CHARGE_LABEL, NO_CHARGE_PROVIDERS, type NoChargeProvider } from "@/lib/access-mode";
import { lastDayKey } from "@/lib/access-end";
import { communityTiers } from "@/lib/community-tiers";
import { newsletterPending } from "@/lib/free-access-rules";
import { nextMoonCircles } from "@/lib/moon-circles";
import { dateKeyInTz } from "@/lib/tz";
import { tenantDb } from "@/lib/tenant";

/** Inscripciones que se listan como mucho (la descarga CSV no tiene tope). */
export const SIGNUPS_PAGE = 300;

export type SignupRow = {
  orderId: string;
  customerId: string | null;
  name: string | null;
  email: string;
  productId: string;
  productTitle: string;
  productEmoji: string | null;
  paidAt: Date | null;
  origin: string;
  newsletter: boolean;
  /** Marcó la casilla de novedades en el formulario y todavía no lo ha confirmado desde su email. */
  newsletterPending: boolean;
  active: boolean;
  productType: string;
  /** Su acceso (para renovar o denegar una membresía). */
  accessId: string | null;
  /** Días que le quedan (0 = vence hoy); null si no caduca o no tiene acceso. */
  daysLeft: number | null;
  /** Hasta cuándo tiene (o tuvo) el acceso; null = sin fecha de fin. */
  expiresAt: Date | null;
  /** ACTIVE | REVOKED | EXPIRED; null = nunca tuvo acceso (o no tiene cuenta). */
  accessStatus: string | null;
  /** Un taller marcado como círculo de la luna. */
  moonCircle: boolean;
};

/** Cuántos días antes de vencer una membresía se puede denegar el acceso (y sale arriba del todo). */
export const RENEW_SOON_DAYS = 5;

/**
 * Quién se ha apuntado a qué: los pedidos de 0 € (gratis con email o acceso dado a mano) de la
 * creadora, con si acepta novedades por email y si mantiene el acceso. Siempre con tenantDb.
 */
export async function listSignups(creatorId: string, opts: { since: Date | null; productId?: string | null; productIds?: string[] | null; take?: number; timeZone?: string }) {
  const db = tenantDb(creatorId);
  const where = {
    status: "PAID",
    paymentProvider: { in: [...NO_CHARGE_PROVIDERS] },
    ...(opts.since ? { paidAt: { gte: opts.since } } : {}),
    ...(opts.productId ? { productId: opts.productId } : opts.productIds ? { productId: { in: opts.productIds } } : {}),
  };
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { paidAt: "desc" },
      ...(opts.take ? { take: opts.take } : {}),
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        productId: true,
        productTitle: true,
        paidAt: true,
        paymentProvider: true,
        metadata: true,
        customerId: true,
        product: { select: { emoji: true, type: true, moonCircle: true } },
        customer: { select: { userId: true, marketingOptIn: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  const userIds = [...new Set(orders.flatMap((o) => (o.customer ? [o.customer.userId] : [])))];
  const productIds = [...new Set(orders.map((o) => o.productId))];
  const accesses = userIds.length
    ? await db.access.findMany({
        where: { userId: { in: userIds }, productId: { in: productIds } },
        select: { id: true, userId: true, productId: true, status: true, expiresAt: true },
      })
    : [];
  const now = new Date();
  const live = new Set(accesses.filter((a) => a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > now)).map((a) => `${a.userId}:${a.productId}`));
  const byKey = new Map(accesses.map((a) => [`${a.userId}:${a.productId}`, a]));
  const tz = opts.timeZone ?? "Europe/Madrid";
  const today = Date.parse(dateKeyInTz(now, tz));
  const rows: SignupRow[] = orders.map((o) => {
    const key = o.customer ? `${o.customer.userId}:${o.productId}` : "";
    const access = byKey.get(key) ?? null;
    const isLive = live.has(key);
    return {
    orderId: o.id,
    customerId: o.customerId,
    name: o.buyerName,
    email: o.buyerEmail,
    productId: o.productId,
    productTitle: o.productTitle,
    productEmoji: o.product.emoji,
    paidAt: o.paidAt,
    origin: NO_CHARGE_LABEL[o.paymentProvider as NoChargeProvider] ?? o.paymentProvider,
    newsletter: !!o.customer?.marketingOptIn,
    newsletterPending: newsletterPending(o.metadata, !!o.customer?.marketingOptIn),
    active: isLive,
    productType: o.product.type,
    accessId: access?.id ?? null,
    daysLeft: isLive && access?.expiresAt ? Math.round((Date.parse(lastDayKey(access.expiresAt, tz)) - today) / 86_400_000) : null,
    expiresAt: access?.expiresAt ?? null,
    accessStatus: access?.status ?? null,
    moonCircle: o.product.moonCircle,
    };
  });
  // Las membresías a punto de renovar, siempre arriba (la que vence antes, primero).
  const soon = (r: SignupRow) => r.productType === "MEMBERSHIP" && r.daysLeft != null && r.daysLeft <= RENEW_SOON_DAYS;
  rows.sort((a, b) => (soon(a) === soon(b) ? (soon(a) ? a.daysLeft! - b.daysLeft! : 0) : soon(a) ? -1 : 1));
  return { rows, total };
}

export type SignupChip = { key: string; label: string; emoji: string | null; count: number; level?: number };
export type SignupGroup = { title: string; chips: SignupChip[] };

/**
 * Los filtros de Inscripciones, en orden: las 3 membresías, los 2 círculos de la luna que salen en la web
 * (los únicos que pueden tener gente apuntada), los cursos y lo online (sesiones y lecturas). Cada filtro
 * dice qué productos abarca.
 */
export async function signupFilters(creatorId: string, now = new Date()) {
  const db = tenantDb(creatorId);
  const [groups, tiers, circles, others] = await Promise.all([
    db.order.groupBy({ by: ["productId"], where: { status: "PAID", paymentProvider: { in: [...NO_CHARGE_PROVIDERS] } }, _count: { _all: true } }),
    communityTiers(creatorId),
    db.product.findMany({
      where: { moonCircle: true, status: "PUBLISHED", eventStartAt: { gt: now } },
      select: { id: true, title: true, emoji: true, slug: true, moonCircle: true, eventStartAt: true },
    }),
    db.product.findMany({ where: { type: { in: ["COURSE", "SESSION", "DIGITAL"] }, moonCircle: false }, select: { id: true, type: true } }),
  ]);
  const count = (ids: string[]) => groups.filter((g) => ids.includes(g.productId)).reduce((n, g) => n + g._count._all, 0);
  const shown = nextMoonCircles(circles.map((c) => ({ ...c, eventStartAt: c.eventStartAt?.toISOString() ?? null })), now);
  const courses = others.filter((p) => p.type === "COURSE").map((p) => p.id);
  const online = others.filter((p) => p.type !== "COURSE").map((p) => p.id);
  const products = new Map<string, string[]>([["cursos", courses], ["online", online]]);
  for (const t of tiers) products.set(t.id, [t.id]);
  for (const c of shown) products.set(c.id, [c.id]);
  const list: SignupGroup[] = [
    { title: "Membresías", chips: tiers.map((t) => ({ key: t.id, label: t.title, emoji: t.emoji, count: count([t.id]), level: t.level })) },
    { title: "Círculos de la luna", chips: shown.map((c) => ({ key: c.id, label: c.title, emoji: c.emoji ?? null, count: count([c.id]) })) },
    {
      title: "Cursos y online",
      chips: [
        { key: "cursos", label: "Cursos", emoji: null, count: count(courses) },
        { key: "online", label: "Online · sesiones y lecturas", emoji: null, count: count(online) },
      ],
    },
  ].filter((g) => g.chips.length);
  return { groups: list, products };
}
