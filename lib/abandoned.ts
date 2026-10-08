import { prisma } from "./db";
import { AUTOMATIONS, emit } from "./automations";

/**
 * Pedidos sin pagar cuyo plazo de recuperación ha vencido → abandonados (+ email de
 * recuperación si la automatización está activa). El plazo es el «Esperar N minutos»
 * que cada creadora configura en Automatizaciones (60 por defecto).
 */
export async function emitAbandoned(floorMinutes = 5) {
  const now = Date.now();
  const stale = await prisma.order.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, createdAt: { lte: new Date(now - floorMinutes * 60000) }, recoveryEmailedAt: null },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const delays = new Map<string, number>();
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
    await prisma.order.update({ where: { id: o.id }, data: { status: "ABANDONED", recoveryEmailedAt: bought ? new Date() : null } });
    if (!bought) await emit({ type: "checkout.abandoned", orderId: o.id });
    processed++;
  }
  return processed;
}
