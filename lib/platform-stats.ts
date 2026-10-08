import "server-only";
import { prisma } from "./db";
import { dateKeyInTz } from "./tz";

const TZ = "Europe/Madrid";

export function lastMonths(n: number) {
  const now = new Date();
  const keys: string[] = [];
  let [y, m] = dateKeyInTz(now, TZ).slice(0, 7).split("-").map(Number);
  for (let i = 0; i < n; i++) {
    keys.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return keys;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(".", "");
}

/** Métricas globales de la plataforma (solo superadmin: sin aislamiento por tenant). */
export async function getPlatformOverview() {
  const [orders, txs, creators, plans, customers, activeSubs, blockedUsers] = await Promise.all([
    prisma.order.findMany({ where: { status: "PAID" }, select: { amountCents: true, platformFeeCents: true, paidAt: true, creatorId: true } }),
    prisma.transaction.findMany({ where: { type: { in: ["PLAN_FEE", "RENEWAL"] } }, select: { type: true, amountCents: true, platformFeeCents: true, createdAt: true, creatorId: true } }),
    prisma.creator.findMany({ select: { id: true, planId: true, status: true, published: true, createdAt: true, displayName: true, username: true } }),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.customer.groupBy({ by: ["userId"], _min: { createdAt: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "BLOCKED" } }),
  ]);
  // El volumen vendido incluye las renovaciones de membresías (no generan pedido, solo transacción).
  const renewals = txs.filter((t) => t.type === "RENEWAL");
  const gmv = orders.reduce((a, o) => a + o.amountCents, 0) + renewals.reduce((a, t) => a + t.amountCents, 0);
  const commissions = orders.reduce((a, o) => a + o.platformFeeCents, 0) + txs.filter((t) => t.type === "RENEWAL").reduce((a, t) => a + t.platformFeeCents, 0);
  const planRevenue = txs.filter((t) => t.type === "PLAN_FEE").reduce((a, t) => a + t.amountCents, 0);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const activeCreators = creators.filter((c) => c.status === "ACTIVE");
  const platformMrr = activeCreators.reduce((a, c) => a + (planById.get(c.planId)?.priceMonthlyCents ?? 0), 0);
  const byPlan = plans.map((p) => ({ plan: p, count: activeCreators.filter((c) => c.planId === p.id).length }));

  const months = lastMonths(6);
  const series = months.map((k) => ({ key: k, label: monthLabel(k), gmv: 0, commissions: 0, planFees: 0, orders: 0, newCreators: 0, newCustomers: 0 }));
  const idx = new Map(months.map((k, i) => [k, i]));
  const mk = (d: Date) => idx.get(dateKeyInTz(d, TZ).slice(0, 7));
  for (const o of orders) { const i = mk(o.paidAt!); if (i != null) { series[i].gmv += o.amountCents; series[i].commissions += o.platformFeeCents; series[i].orders++; } }
  for (const t of txs) { const i = mk(t.createdAt); if (i != null) { if (t.type === "PLAN_FEE") series[i].planFees += t.amountCents; else { series[i].commissions += t.platformFeeCents; series[i].gmv += t.amountCents; } } }
  for (const c of creators) { const i = mk(c.createdAt); if (i != null) series[i].newCreators++; }
  for (const c of customers) { const i = c._min.createdAt ? mk(c._min.createdAt) : undefined; if (i != null) series[i].newCustomers++; }

  const gmvByCreator = new Map<string, number>();
  for (const o of orders) gmvByCreator.set(o.creatorId, (gmvByCreator.get(o.creatorId) ?? 0) + o.amountCents);
  for (const t of renewals) gmvByCreator.set(t.creatorId, (gmvByCreator.get(t.creatorId) ?? 0) + t.amountCents);
  const topCreators = creators
    .map((c) => ({ ...c, gmv: gmvByCreator.get(c.id) ?? 0 }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 5);

  return {
    gmv,
    commissions,
    planRevenue,
    platformRevenue: commissions + planRevenue,
    orders: orders.length,
    creators: creators.length,
    publishedCreators: creators.filter((c) => c.published).length,
    blockedCreators: creators.filter((c) => c.status === "BLOCKED").length,
    blockedUsers,
    customers: customers.length,
    activeSubs,
    platformMrr,
    byPlan,
    series,
    topCreators,
  };
}
