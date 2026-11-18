import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Borrar de verdad (no archivar) lo que tiene ventas: productos, ventas sueltas, solicitudes,
 * reservas y clientas. Se borra todo lo que cuelga (cobros, reservas, accesos, suscripciones) y se
 * rehacen los totales de las clientas que quedan. Quien tenía acceso lo pierde. No se puede deshacer.
 */

type Tx = Prisma.TransactionClient;

/** Las ventas y todo lo suyo: cobros, reservas y accesos (los reembolsos y enlaces van solos). */
async function wipeOrders(tx: Tx, creatorId: string, orderIds: string[]) {
  if (!orderIds.length) return;
  await tx.transaction.deleteMany({ where: { creatorId, OR: [{ orderId: { in: orderIds } }, { refund: { orderId: { in: orderIds } } }] } });
  await tx.booking.deleteMany({ where: { creatorId, orderId: { in: orderIds } } });
  await tx.access.deleteMany({ where: { creatorId, orderId: { in: orderIds } } });
  await tx.order.deleteMany({ where: { creatorId, id: { in: orderIds } } });
}

/** Suscripciones (membresías) con sus cobros y accesos. */
async function wipeSubscriptions(tx: Tx, creatorId: string, subIds: string[]) {
  if (!subIds.length) return;
  await tx.transaction.deleteMany({ where: { creatorId, subscriptionId: { in: subIds } } });
  await tx.access.deleteMany({ where: { creatorId, subscriptionId: { in: subIds } } });
  await tx.subscription.deleteMany({ where: { creatorId, id: { in: subIds } } });
}

/** Rehace «compras» y «gastado» de cada clienta con lo que le queda. */
async function recountCustomers(tx: Tx, customerIds: (string | null)[]) {
  const ids = [...new Set(customerIds.filter((x): x is string => !!x))];
  for (const id of ids) {
    const paid = await tx.order.findMany({ where: { customerId: id, status: "PAID" }, select: { amountCents: true, refundedCents: true, paidAt: true, createdAt: true } });
    const dates = paid.map((o) => (o.paidAt ?? o.createdAt).getTime()).sort((a, b) => a - b);
    await tx.customer.updateMany({
      where: { id },
      data: {
        ordersCount: paid.length,
        totalSpentCents: paid.reduce((a, o) => a + o.amountCents - o.refundedCents, 0),
        firstPurchaseAt: dates.length ? new Date(dates[0]) : null,
        lastPurchaseAt: dates.length ? new Date(dates[dates.length - 1]) : null,
      },
    });
  }
}

/** Cuántas ventas, reservas y suscripciones se irían con el producto (para el aviso). */
export async function productSalesCount(creatorId: string, productId: string) {
  const [orders, subs] = await Promise.all([
    prisma.order.count({ where: { creatorId, productId } }),
    prisma.subscription.count({ where: { creatorId, productId } }),
  ]);
  return orders + subs;
}

/** El producto con todas sus ventas, reservas, suscripciones y accesos. Los archivos, quien llama. */
export async function deleteProductHard(creatorId: string, productId: string) {
  await prisma.$transaction(
    async (tx) => {
      const orders = await tx.order.findMany({ where: { creatorId, productId }, select: { id: true, customerId: true } });
      const bookings = await tx.booking.findMany({ where: { creatorId, productId }, select: { orderId: true, customerId: true } });
      const subs = await tx.subscription.findMany({ where: { creatorId, productId }, select: { id: true, customerId: true } });
      const orderIds = [...new Set([...orders.map((o) => o.id), ...bookings.map((b) => b.orderId).filter((x): x is string => !!x)])];
      await wipeOrders(tx, creatorId, orderIds);
      await tx.booking.deleteMany({ where: { creatorId, productId } });
      await wipeSubscriptions(tx, creatorId, subs.map((s) => s.id));
      await tx.product.deleteMany({ where: { creatorId, id: productId } });
      await recountCustomers(tx, [...orders.map((o) => o.customerId), ...bookings.map((b) => b.customerId), ...subs.map((s) => s.customerId)]);
    },
    { timeout: 30_000 },
  );
}

/** Una venta, inscripción o solicitud suelta. */
export async function deleteOrderHard(creatorId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const o = await tx.order.findFirst({ where: { creatorId, id: orderId }, select: { id: true, customerId: true } });
    if (!o) return false;
    await wipeOrders(tx, creatorId, [o.id]);
    await recountCustomers(tx, [o.customerId]);
    return true;
  });
}

/** Una reserva: con su venta si la tiene (la venta era esa reserva). */
export async function deleteBookingHard(creatorId: string, bookingId: string) {
  return prisma.$transaction(async (tx) => {
    const b = await tx.booking.findFirst({ where: { creatorId, id: bookingId }, select: { id: true, orderId: true, customerId: true } });
    if (!b) return false;
    if (b.orderId) await wipeOrders(tx, creatorId, [b.orderId]);
    await tx.booking.deleteMany({ where: { creatorId, id: b.id } });
    await recountCustomers(tx, [b.customerId]);
    return true;
  });
}

/** Una clienta de esta web con todas sus ventas, reservas, suscripciones y accesos. Su cuenta queda. */
export async function deleteCustomerHard(creatorId: string, customerId: string) {
  return prisma.$transaction(
    async (tx) => {
      const c = await tx.customer.findFirst({ where: { creatorId, id: customerId }, select: { id: true, userId: true } });
      if (!c) return false;
      const orders = await tx.order.findMany({ where: { creatorId, customerId: c.id }, select: { id: true } });
      await wipeOrders(tx, creatorId, orders.map((o) => o.id));
      await tx.booking.deleteMany({ where: { creatorId, customerId: c.id } });
      const subs = await tx.subscription.findMany({ where: { creatorId, customerId: c.id }, select: { id: true } });
      await wipeSubscriptions(tx, creatorId, subs.map((s) => s.id));
      await tx.access.deleteMany({ where: { creatorId, userId: c.userId } });
      await tx.customer.deleteMany({ where: { id: c.id } });
      return true;
    },
    { timeout: 30_000 },
  );
}
