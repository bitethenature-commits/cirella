import { prisma } from "./db";
import { emit } from "./automations";

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
    const fee = Math.round((sub.priceCents * sub.creator.plan.commissionBps) / 10000);
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodStart: start, currentPeriodEnd: end } }),
      prisma.access.updateMany({ where: { subscriptionId: sub.id }, data: { expiresAt: end, status: "ACTIVE" } }),
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
