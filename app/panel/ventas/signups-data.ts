import "server-only";
import { NO_CHARGE_LABEL, NO_CHARGE_PROVIDERS, type NoChargeProvider } from "@/lib/access-mode";
import { newsletterPending } from "@/lib/free-access-rules";
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
};

/**
 * Quién se ha apuntado a qué: los pedidos de 0 € (gratis con email o acceso dado a mano) de la
 * creadora, con si acepta novedades por email y si mantiene el acceso. Siempre con tenantDb.
 */
export async function listSignups(creatorId: string, opts: { since: Date | null; productId?: string | null; take?: number }) {
  const db = tenantDb(creatorId);
  const where = {
    status: "PAID",
    paymentProvider: { in: [...NO_CHARGE_PROVIDERS] },
    ...(opts.since ? { paidAt: { gte: opts.since } } : {}),
    ...(opts.productId ? { productId: opts.productId } : {}),
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
        product: { select: { emoji: true } },
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
        select: { userId: true, productId: true, status: true, expiresAt: true },
      })
    : [];
  const now = new Date();
  const live = new Set(accesses.filter((a) => a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > now)).map((a) => `${a.userId}:${a.productId}`));
  const rows: SignupRow[] = orders.map((o) => ({
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
    active: !!o.customer && live.has(`${o.customer.userId}:${o.productId}`),
  }));
  return { rows, total };
}

/** Productos con inscripciones (para el filtro). */
export async function signupProducts(creatorId: string) {
  const db = tenantDb(creatorId);
  const groups = await db.order.groupBy({
    by: ["productId"],
    where: { status: "PAID", paymentProvider: { in: [...NO_CHARGE_PROVIDERS] } },
    _count: { _all: true },
  });
  if (!groups.length) return [];
  const products = await db.product.findMany({ where: { id: { in: groups.map((g) => g.productId) } }, select: { id: true, title: true, emoji: true } });
  return products
    .map((p) => ({ ...p, count: groups.find((g) => g.productId === p.id)?._count._all ?? 0 }))
    .sort((a, b) => b.count - a.count);
}
