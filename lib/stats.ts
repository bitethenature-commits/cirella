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

type SeriesPoint = { key: string; label: string; revenue: number; visits: number; sales: number };

/** Métricas del panel de la creadora. Todas las consultas pasan por tenantDb. */
export async function getDashboardStats(creatorId: string, range: RangeKey, tz: string) {
  const db = tenantDb(creatorId);
  const now = new Date();
  const since = rangeStart(range, tz, now);
  const when = since ? { gte: since } : undefined;

  const [orders, newCustomers, totalCustomers, pageViews, visitorGroups, productViews, clicks, checkouts, subs, upcoming, pendingSchedule, bookingsInRange, products] =
    await Promise.all([
      db.order.findMany({
        where: { status: "PAID", ...(when ? { paidAt: when } : {}) },
        select: { amountCents: true, netCents: true, platformFeeCents: true, productId: true, productTitle: true, paidAt: true },
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
      series.push({ key: k, label: formatInTz(ref, tz, { month: "short" }).replace(".", ""), revenue: 0, visits: 0, sales: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.key, i]));
    for (const o of orders) { const i = idx.get(dateKeyInTz(o.paidAt!, tz).slice(0, 7)); if (i != null) { series[i].revenue += o.amountCents; series[i].sales++; } }
    for (const t of renewals) { const i = idx.get(dateKeyInTz(t.createdAt, tz).slice(0, 7)); if (i != null) series[i].revenue += t.amountCents; }
    for (const e of visitsEvents) { const i = idx.get(dateKeyInTz(e.createdAt, tz).slice(0, 7)); if (i != null) series[i].visits++; }
  } else {
    const startKey = dateKeyInTz(since!, tz);
    const endKey = dateKeyInTz(now, tz);
    for (let k = startKey, n = 0; k <= endKey && n < 32; k = addDaysToKey(k, 1), n++) {
      series.push({ key: k, label: String(Number(k.slice(8))), revenue: 0, visits: 0, sales: 0 });
    }
    const idx = new Map(series.map((s, i) => [s.key, i]));
    for (const o of orders) { const i = idx.get(dateKeyInTz(o.paidAt!, tz)); if (i != null) { series[i].revenue += o.amountCents; series[i].sales++; } }
    for (const t of renewals) { const i = idx.get(dateKeyInTz(t.createdAt, tz)); if (i != null) series[i].revenue += t.amountCents; }
    for (const e of visitsEvents) { const i = idx.get(dateKeyInTz(e.createdAt, tz)); if (i != null) series[i].visits++; }
  }

  return {
    sales: orders.length,
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

/** Embudo y fuentes de tráfico (estadísticas avanzadas). */
export async function getAdvancedStats(creatorId: string, range: RangeKey, tz: string) {
  const db = tenantDb(creatorId);
  const since = rangeStart(range, tz);
  const when = since ? { createdAt: { gte: since } } : {};
  const [byType, bySource, byProduct, products] = await Promise.all([
    db.analyticsEvent.groupBy({ by: ["type"], where: when, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["source"], where: { type: "PAGE_VIEW", ...when }, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["productId", "type"], where: { productId: { not: null }, ...when }, _count: { _all: true }, _sum: { amountCents: true } }),
    db.product.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true, emoji: true, type: true, priceCents: true } }),
  ]);
  const count = (t: string) => byType.find((x) => x.type === t)?._count._all ?? 0;
  const funnel = [
    { key: "PAGE_VIEW", label: "Visitas", value: count("PAGE_VIEW") },
    { key: "PRODUCT_VIEW", label: "Vistas de producto", value: count("PRODUCT_VIEW") },
    { key: "PRODUCT_CLICK", label: "Clics en comprar", value: count("PRODUCT_CLICK") },
    { key: "CHECKOUT_STARTED", label: "Checkout iniciado", value: count("CHECKOUT_STARTED") },
    { key: "PURCHASE", label: "Compras", value: count("PURCHASE") },
  ];
  const sources = bySource
    .map((s) => ({ source: s.source ?? "direct", value: s._count._all }))
    .sort((a, b) => b.value - a.value);
  const perProduct = products.map((p) => {
    const rows = byProduct.filter((r) => r.productId === p.id);
    const get = (t: string) => rows.find((r) => r.type === t)?._count._all ?? 0;
    const revenue = rows.find((r) => r.type === "PURCHASE")?._sum.amountCents ?? 0;
    const views = get("PRODUCT_VIEW");
    const purchases = get("PURCHASE");
    return { ...p, views, clicks: get("PRODUCT_CLICK"), checkouts: get("CHECKOUT_STARTED"), purchases, revenue, conversion: views ? purchases / views : 0 };
  });
  return { funnel, sources, perProduct };
}
