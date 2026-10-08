import { prisma } from "./db";
import { emit } from "./automations";

/** Pedidos pendientes durante más de `minutes` → abandonados (+ email de recuperación si está activo). */
export async function emitAbandoned(minutes = 60) {
  const cutoff = new Date(Date.now() - minutes * 60000);
  const stale = await prisma.order.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, createdAt: { lte: cutoff }, recoveryEmailedAt: null },
    take: 200,
  });
  for (const o of stale) {
    // Si después compró ese mismo producto, no molestamos.
    const bought = await prisma.order.findFirst({
      where: { buyerEmail: o.buyerEmail, productId: o.productId, status: "PAID", createdAt: { gte: o.createdAt } },
    });
    await prisma.order.update({ where: { id: o.id }, data: { status: "ABANDONED", recoveryEmailedAt: bought ? new Date() : null } });
    if (!bought) await emit({ type: "checkout.abandoned", orderId: o.id });
  }
  return stale.length;
}
