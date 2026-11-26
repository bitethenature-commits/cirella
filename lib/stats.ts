import { NO_CHARGE_PROVIDERS } from "./access-mode";
import { orderFigures } from "./refund-math";
import { tenantDb } from "./tenant";
import { addDaysToKey, dateKeyInTz, zonedTimeToUtc, formatInTz } from "./tz";

export const RANGES = {
  month: "Este mes",
  "30d": "Últimos 30 días",
  all: "Total",
} as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(v: string | undefined | null): RangeKey {
  return v === "30d" || v === "all" ? v : "month";
}

export function rangeStart(range: RangeKey, tz: string, now = new Date()): Date | null {
  if (range === "all") return null;
  if (range === "30d") return new Date(now.getTime() - 30 * 86400_000);
  const key = dateKeyInTz(now, tz).slice(0, 8) + "01";
  return zonedTimeToUtc(key, 0, tz);
}

type SeriesPoint = { key: string; label: string; revenue: number; visits: number; sales: number; signups: number };

/** Ventas = pedidos con cobro. Los de 0 € (gratis con email o acceso dado a mano) son inscripciones. */
const CHARGED = { paymentProvider: { notIn: [...NO_CHARGE_PROVIDERS] } };
const NO_CHARGE = { paymentProvider: { in: [...NO_CHARGE_PROVIDERS] } };

/**
 * Métricas del panel de la creadora. Todas las consultas pasan por tenantDb.
 * Las inscripciones (accesos sin cobro) se cuentan aparte de las ventas: `signups` (todas) y
 * `formSignups` (solo las del formulario de la ficha, que son las que convierten visitas).
 */
export async function getDashboardStats(creatorId: string, range: RangeKey, tz: string) {
  const db = tenantDb(creatorId);
  const now = new Date();
  const since = rangeStart(range, tz, now);
  const when = since ? { gte: since } : undefined;

  const [settledOrders, signupOrders, newCustomers, totalCustomers, pageViews, visitorGroups, productViews, clicks, checkouts, subs, upcoming, pendingSchedule, bookingsInRange, products] =
    await Promise.all([
      db.order.findMany({
        where: { status: { in: ["PAID", "REFUNDED"] }, ...CHARGED, ...(when ? { paidAt: when } : {}) },
        select: { status: true, amountCents: true, platformFeeCents: true, refundedCents: true, refundedFeeCents: true, productId: true, productTitle: true, paidAt: true },
      }),
      db.order.findMany({
        where: { status: "PAID", ...NO_CHARGE, ...(when ? { paidAt: when } : {}) },
        select: { paymentProvider: true, productId: true, paidAt: true },
      }),
      db.customer.count({ where: when ? { createdAt: when } : {} }),
      db.customer.count(),
      db.analyticsEvent.count({ where: { type: "PAGE_VIEW", ...(when ? { createdAt: when } : {}) } }),
      db.analyticsEvent.groupBy({ by: ["visitorId"], where: { type: "PAGE_VIEW", ...(when ? { createdAt: when } : {}) } }),
      db.analyticsEvent.count({ where: { type: "PRODUCT_VIEW", ...(when ? { createdAt: when } : {}) } }),
      db.analyticsEvent.count({ where: { type: "PRODUCT_CLICK", ...(when ? { createdAt: when } : {}) } }),
      db.analyticsEvent.count({ where: { type: "CHECKOUT_STARTED", ...(when ? { createdAt: when } : {}) } }),
      db.subscription.findMany({ where: { status: "ACTIVE" }, select: { priceCents: true, interval: true, cancelAtPeriodEnd: true } }),
      db.booking.findMany({
        where: { status: "CONFIRMED", startAt: { gte: now } },
        orderBy: { startAt: "asc" },
        take: 5,
        include: { product: { select: { title: true, emoji: true } }, customer: { select: { name: true, email: true } } },
      }),
      db.booking.count({ where: { status: "PENDING_SCHEDULE" } }),
      db.booking.count({ where: { status: { in: ["CONFIRMED", "COMPLETED", "PENDING_SCHEDULE"] }, ...(when ? { createdAt: when } : {}) } }),
      db.product.findMany({ select: { id: true, title: true, emoji: true, imageUrl: true, type: true } }),
    ]);

  // Ventas netas de reembolsos. Un reembolso se resta del periodo de la venta original (no del día en
  // que se devuelve): así cada mes refleja lo que de verdad se quedó, aunque una cifra pasada pueda
  // bajar después de un reembolso. Las devueltas del todo dejan de contar como venta.
  const orders = settledOrders
    .map((o) => ({ ...o, f: orderFigures(o) }))
    .filter((o) => o.f.counts)
    .map((o) => ({ ...o, amountCents: o.f.gross, netCents: o.f.net, platformFeeCents: o.f.fee }));

  // Las renovaciones de membresías también son ingresos (transacciones RENEWAL sin pedido).
  const renewals = await db.transaction.findMany({
    where: { type: "RENEWAL", ...(when ? { createdAt: when } : {}) },
    select: { amountCents: true, netCents: true, platformFeeCents: true, createdAt: true },
  });
  const revenue = orders.reduce((a, o) => a + o.amountCents, 0) + renewals.reduce((a, t) => a + t.amountCents, 0);
  const net = orders.reduce((a, o) => a + o.netCents, 0) + renewals.reduce((a, t) => a + t.netCents, 0);
  const fees = orders.reduce((a, o) => a + o.platformFeeCents, 0) + renewals.reduce((a, t) => a + t.platformFeeCents, 0);
  const uniqueVisitors = visitorGroups.length;
  const mrr = subs.filter((s) => !s.cancelAtPeriodEnd).reduce((a, s) => a + (s.interval === "year" ? Math.round(s.priceCents / 12) : s.priceCents), 0);

  const byProduct = new Map<string, { count: number; revenue: number }>();
  for (const o of orders) {
    const cur = byProduct.get(o.productId) ?? { count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += o.amountCents;
    byProduct.set(o.productId, cur);
  }
  const productMap = new Map(products.map((p) => [p.id, p]));
  const topProducts = [...byProduct.entries()]
    .map(([id, v]) => ({ id, ...v, product: productMap.get(id) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Serie temporal para el gráfico
  const series: SeriesPoint[] = [];
  const visitsEvents = await db.analyticsEvent.findMany({
    where: { type: "PAGE_VIEW", createdAt: { gte: since ?? new Date(now.getTime() - 365 * 86400_000) } },
    select: { createdAt: true },
  });
  if (range === "all") {
    const keys: string[] = [];
    const cur = dateKeyInTz(now, tz).slice(0, 7);
    let [y, m] = cur.split("-").map(Number);
    for (let i = 0; i < 6; i++) {
      keys.unshift(`${y}-${String(m).padStart(2, "0")}`);
      m--;
      if (m === 0) { m = 12; y--; }
    }
    for (const k of keys) {
      const ref = zonedTimeToUtc(`${k}-15`, 720, tz);
      series.push({ key: k, label: formatInTz(ref, tz, { month: "short" }).replace(".", ""), revenue: 0, visits: 0, sales: 0, signups: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.key, i]));
    for (const o of orders) { const i = idx.get(dateKeyInTz(o.paidAt!, tz).slice(0, 7)); if (i != null) { series[i].revenue += o.amountCents; series[i].sales++; } }
    for (const t of renewals) { const i = idx.get(dateKeyInTz(t.createdAt, tz).slice(0, 7)); if (i != null) series[i].revenue += t.amountCents; }
    for (const e of visitsEvents) { const i = idx.get(dateKeyInTz(e.createdAt, tz).slice(0, 7)); if (i != null) series[i].visits++; }
    for (const o of signupOrders) { const i = idx.get(dateKeyInTz(o.paidAt!, tz).slice(0, 7)); if (i != null) series[i].signups++; }
  } else {
    const startKey = dateKeyInTz(since!, tz);
    const endKey = dateKeyInTz(now, tz);
    for (let k = startKey, n = 0; k <= endKey && n < 32; k = addDaysToKey(k, 1), n++) {
      series.push({ key: k, label: String(Number(k.slice(8))), revenue: 0, visits: 0, sales: 0, signups: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.key, i]));
    for (const o of orders) { const i = idx.get(dateKeyInTz(o.paidAt!, tz)); if (i != null) { series[i].revenue += o.amountCents; series[i].sales++; } }
    for (const t of renewals) { const i = idx.get(dateKeyInTz(t.createdAt, tz)); if (i != null) series[i].revenue += t.amountCents; }
    for (const e of visitsEvents) { const i = idx.get(dateKeyInTz(e.createdAt, tz)); if (i != null) series[i].visits++; }
    for (const o of signupOrders) { const i = idx.get(dateKeyInTz(o.paidAt!, tz)); if (i != null) series[i].signups++; }
  }

  const formSignups = signupOrders.filter((o) => o.paymentProvider === "free").length;
  const signupsByProduct = new Map<string, number>();
  for (const o of signupOrders) signupsByProduct.set(o.productId, (signupsByProduct.get(o.productId) ?? 0) + 1);
  const topSignups = [...signupsByProduct.entries()]
    .map(([id, count]) => ({ id, count, product: productMap.get(id) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    sales: orders.length,
    signups: signupOrders.length,
    formSignups,
    signupConversion: uniqueVisitors ? formSignups / uniqueVisitors : 0,
    topSignups,
    revenue,
    net,
    fees,
    newCustomers,
    totalCustomers,
    pageViews,
    uniqueVisitors,
    productViews,
    clicks,
    checkouts,
    conversion: uniqueVisitors ? orders.length / uniqueVisitors : 0,
    mrr,
    activeSubscriptions: subs.length,
    upcoming,
    pendingSchedule,
    bookingsInRange,
    topProducts,
    series,
  };
}
