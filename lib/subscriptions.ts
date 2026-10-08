import { prisma } from "./db";
import { emit } from "./automations";
import { effectiveCommissionBps } from "./plans";

/** La clienta cancela: mantiene acceso hasta el final del periodo pagado. */
export async function cancelSubscription(subscriptionId: string, userId: string) {
  const sub = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId, status: "ACTIVE" } });
  if (!sub || sub.cancelAtPeriodEnd) return null;
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
  });
  await emit({ type: "subscription.canceled", subscriptionId: sub.id });
  return updated;
}

export async function resumeSubscription(subscriptionId: string, userId: string) {
  const sub = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId, status: "ACTIVE" } });
  if (!sub) return null;
  return prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false, canceledAt: null } });
}

/**
 * Renovaciones simuladas (con Stripe esto lo harían los webhooks de facturación).
 * · Periodo vencido y cancelada → fin de la suscripción y del acceso.
 * · Periodo vencido y activa → nuevo cargo, nuevo periodo y acceso extendido.
 */
export async function processRenewals(now = new Date()) {
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lte: now } },
    include: { creator: { include: { plan: true } } },
  });
  for (const sub of due) {
    if (sub.cancelAtPeriodEnd) {
      await prisma.$transaction([
        prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELED" } }),
        prisma.access.updateMany({ where: { subscriptionId: sub.id }, data: { status: "REVOKED" } }),
      ]);
      continue;
    }
    const start = sub.currentPeriodEnd;
    const end = new Date(start);
    if (sub.interval === "year") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    const fee = Math.round((sub.priceCents * effectiveCommissionBps(sub.creator.plan, sub.creator, now)) / 10000);
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodStart: start, currentPeriodEnd: end } }),
      prisma.access.updateMany({ where: { subscriptionId: sub.id }, data: { expiresAt: end, status: "ACTIVE" } }),
      prisma.customer.update({ where: { id: sub.customerId }, data: { totalSpentCents: { increment: sub.priceCents }, lastPurchaseAt: start } }),
      prisma.transaction.create({
        data: {
          creatorId: sub.creatorId,
          subscriptionId: sub.id,
          type: "RENEWAL",
          description: "Renovación de membresía",
          amountCents: sub.priceCents,
          platformFeeCents: fee,
          netCents: sub.priceCents - fee,
          provider: sub.provider,
        },
      }),
    ]);
  }
  return due.length;
}

/**
 * Cuota mensual del plan de cada creadora (cobro simulado). Usa primero el crédito de
 * referidos; los planes gratuitos dejan de tener fecha de renovación.
 */
export async function processPlanRenewals(now = new Date()) {
  const due = await prisma.creator.findMany({ where: { planRenewsAt: { lte: now }, status: "ACTIVE" }, include: { plan: true } });
  for (const c of due) {
    const price = c.plan.priceMonthlyCents;
    if (!price) {
      await prisma.creator.update({ where: { id: c.id }, data: { planRenewsAt: null } });
      continue;
    }
    const credit = Math.min(c.creditCents, price);
    const charged = price - credit;
    const next = new Date(c.planRenewsAt!);
    while (next <= now) next.setMonth(next.getMonth() + 1);
    await prisma.$transaction([
      prisma.creator.update({ where: { id: c.id }, data: { planRenewsAt: next, creditCents: { decrement: credit } } }),
      prisma.transaction.create({
        data: {
          creatorId: c.id,
          type: "PLAN_FEE",
          description: `Plan ${c.plan.name} · renovación mensual${credit ? ` (crédito aplicado ${(credit / 100).toFixed(2)} €)` : ""}`,
          amountCents: charged,
          platformFeeCents: charged,
          netCents: 0,
          provider: "simulated",
        },
      }),
    ]);
  }
  return due.length;
}
