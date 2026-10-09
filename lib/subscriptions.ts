import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { dispatchEvents, recordEvents } from "./events";
import { captureError } from "./monitoring";
import { effectiveCommissionBps } from "./plans";
import { planFeeKey, renewalKey } from "./reliability";

/** La clienta cancela: mantiene acceso hasta el final del periodo pagado. */
export async function cancelSubscription(subscriptionId: string, userId: string) {
  const eventIds = await prisma.$transaction(async (tx) => {
    const c = await tx.subscription.updateMany({
      where: { id: subscriptionId, userId, status: "ACTIVE", cancelAtPeriodEnd: false },
      data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
    });
    return c.count ? recordEvents(tx, [{ type: "subscription.canceled", subscriptionId }]) : null;
  });
  if (!eventIds) return null;
  await dispatchEvents(eventIds);
  return prisma.subscription.findUnique({ where: { id: subscriptionId } });
}

export async function resumeSubscription(subscriptionId: string, userId: string) {
  const sub = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId, status: "ACTIVE" } });
  if (!sub) return null;
  return prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false, canceledAt: null } });
}

type DueSubscription = Prisma.SubscriptionGetPayload<{ include: { creator: { include: { plan: true } } } }>;

/**
 * Renovaciones simuladas (con Stripe esto lo harían los webhooks de facturación).
 * · Periodo vencido y cancelada → fin de la suscripción y del acceso.
 * · Periodo vencido y activa → nuevo cargo, nuevo periodo y acceso extendido.
 *
 * Idempotente: cada renovación es un UPDATE condicional sobre el periodo que vence, así que si
 * dos ejecuciones coinciden, la segunda no encuentra la fila y no cobra dos veces (además,
 * Transaction.idempotencyKey es única). Si una suscripción falla, las demás siguen.
 * Devuelve cuántas se han procesado de verdad.
 */
export async function processRenewals(now = new Date()) {
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lte: now } },
    include: { creator: { include: { plan: true } } },
    take: 200,
  });
  let done = 0;
  for (const sub of due) {
    try {
      if (await renewOne(sub, now)) done++;
    } catch (e) {
      captureError(e, { area: "renovaciones", extra: { subscriptionId: sub.id } });
    }
  }
  return done;
}

async function renewOne(sub: DueSubscription, now: Date) {
  // La condición sobre currentPeriodEnd hace de cerrojo: en Postgres (READ COMMITTED) la segunda
  // ejecución espera a la primera, vuelve a evaluar el WHERE y no actualiza nada.
  const current = { id: sub.id, status: "ACTIVE", currentPeriodEnd: sub.currentPeriodEnd };
  if (sub.cancelAtPeriodEnd) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.subscription.updateMany({ where: current, data: { status: "CANCELED" } });
      if (!c.count) return false;
      await tx.access.updateMany({ where: { subscriptionId: sub.id }, data: { status: "REVOKED" } });
      return true;
    });
  }
  const start = sub.currentPeriodEnd;
  const end = new Date(start);
  if (sub.interval === "year") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  const fee = Math.round((sub.priceCents * effectiveCommissionBps(sub.creator.plan, sub.creator, now)) / 10000);
  return prisma.$transaction(async (tx) => {
    const c = await tx.subscription.updateMany({ where: current, data: { currentPeriodStart: start, currentPeriodEnd: end } });
    if (!c.count) return false;
    await tx.access.updateMany({ where: { subscriptionId: sub.id }, data: { expiresAt: end, status: "ACTIVE" } });
    await tx.customer.update({ where: { id: sub.customerId }, data: { totalSpentCents: { increment: sub.priceCents }, lastPurchaseAt: start } });
    await tx.transaction.create({
      data: {
        creatorId: sub.creatorId,
        subscriptionId: sub.id,
        type: "RENEWAL",
        description: "Renovación de membresía",
        amountCents: sub.priceCents,
        platformFeeCents: fee,
        netCents: sub.priceCents - fee,
        provider: sub.provider,
        idempotencyKey: renewalKey(sub.id, sub.currentPeriodEnd),
      },
    });
    return true;
  });
}

/**
 * Cuota mensual del plan de cada creadora (cobro simulado). Usa primero el crédito de
 * referidos; los planes gratuitos dejan de tener fecha de renovación.
 * Idempotente igual que processRenewals: UPDATE condicional sobre planRenewsAt.
 */
export async function processPlanRenewals(now = new Date()) {
  const due = await prisma.creator.findMany({ where: { planRenewsAt: { lte: now }, status: "ACTIVE" }, include: { plan: true }, take: 200 });
  let done = 0;
  for (const c of due) {
    try {
      const renewsAt = c.planRenewsAt!;
      const price = c.plan.priceMonthlyCents;
      if (!price) {
        await prisma.creator.updateMany({ where: { id: c.id, planRenewsAt: renewsAt }, data: { planRenewsAt: null } });
        continue;
      }
      const credit = Math.min(c.creditCents, price);
      const charged = price - credit;
      const next = new Date(renewsAt);
      while (next <= now) next.setMonth(next.getMonth() + 1);
      const renewed = await prisma.$transaction(async (tx) => {
        const r = await tx.creator.updateMany({
          where: { id: c.id, planRenewsAt: renewsAt },
          data: { planRenewsAt: next, creditCents: { decrement: credit } },
        });
        if (!r.count) return false;
        await tx.transaction.create({
          data: {
            creatorId: c.id,
            type: "PLAN_FEE",
            description: `Plan ${c.plan.name} · renovación mensual${credit ? ` (crédito aplicado ${(credit / 100).toFixed(2)} €)` : ""}`,
            amountCents: charged,
            platformFeeCents: charged,
            netCents: 0,
            provider: "simulated",
            idempotencyKey: planFeeKey(c.id, renewsAt),
          },
        });
        return true;
      });
      if (renewed) done++;
    } catch (e) {
      captureError(e, { area: "renovaciones", extra: { creatorId: c.id } });
    }
  }
  return done;
}
