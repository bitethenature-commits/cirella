import { prisma } from "./db";
import { AUTOMATIONS } from "./automations";
import { dispatchEvents, recordEvents } from "./events";

/**
 * Pedidos sin pagar cuyo plazo de recuperación ha vencido → abandonados (+ email de
 * recuperación si la automatización está activa). El plazo es el «Esperar N minutos»
 * que cada creadora configura en Automatizaciones (60 por defecto).
 *
 * El cambio de estado y el evento van en la misma transacción, con un UPDATE condicional: si dos
 * ejecuciones del cron coinciden, solo una marca el pedido y envía el email. Un pedido ya cobrado
 * (chargedAt) nunca se da por abandonado: lo entrega el vigilante. Tampoco uno cuya página de pago
 * sigue abierta (checkoutExpiresAt futuro: puede estar confirmando en la app de su banco) ni uno con
 * el pago pendiente (PROCESSING), que resuelve el aviso de la pasarela.
 */
export async function emitAbandoned(floorMinutes = 5) {
  const now = Date.now();
  const stale = await prisma.order.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      createdAt: { lte: new Date(now - floorMinutes * 60000) },
      recoveryEmailedAt: null,
      chargedAt: null,
      OR: [{ checkoutExpiresAt: null }, { checkoutExpiresAt: { lt: new Date(now) } }],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const delays = new Map<string, number>();
  const eventIds: string[] = [];
  let processed = 0;
  for (const o of stale) {
    if (!delays.has(o.creatorId)) {
      const row = await prisma.automation.findUnique({ where: { creatorId_trigger: { creatorId: o.creatorId, trigger: "ABANDONED_CHECKOUT" } } });
      delays.set(o.creatorId, row?.delayMinutes ?? AUTOMATIONS.ABANDONED_CHECKOUT.defaultDelay);
    }
    if (o.createdAt.getTime() + delays.get(o.creatorId)! * 60000 > now) continue;
    // Si después compró ese mismo producto, no molestamos.
    const bought = await prisma.order.findFirst({
      where: { buyerEmail: o.buyerEmail, productId: o.productId, status: "PAID", createdAt: { gte: o.createdAt } },
    });
    const marked = await prisma.$transaction(async (tx) => {
      const c = await tx.order.updateMany({
        where: { id: o.id, status: { in: ["PENDING", "FAILED"] }, recoveryEmailedAt: null, chargedAt: null },
        data: { status: "ABANDONED", recoveryEmailedAt: bought ? new Date() : null },
      });
      if (!c.count) return false;
      if (!bought) eventIds.push(...(await recordEvents(tx, [{ type: "checkout.abandoned", orderId: o.id }])));
      return true;
    });
    if (marked) processed++;
  }
  await dispatchEvents(eventIds);
  return processed;
}
