/**
 * Prueba de concurrencia de reservas (Postgres).
 *   npm run test:concurrency        (con la BD sembrada: npm run db:reset)
 *
 * Comprueba que un mismo hueco nunca acaba con dos reservas confirmadas:
 *   · dos compras simultáneas del mismo hueco → una CONFIRMED y otra pendiente de fecha
 *   · el cerrojo por creadora pone en fila las transacciones (ninguna llega a chocar en la BD)
 *   · la regla Booking_no_overlap de la BD rechaza solapes escritos sin pasar por el cerrojo,
 *     sin afectar a otras creadoras, a sesiones seguidas ni a reservas sin fecha.
 * Borra todo lo que crea.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { getAvailableSlots, hasBookingClash, isBookingOverlapError } from "../lib/booking";
import { createPendingOrder, fulfillOrder } from "../lib/orders";

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failures++;
}

const TAG = `concurrencia-${Date.now()}`;
const HOUR = 3600_000;
const bookingIds: string[] = [];
const orderIds: string[] = [];
const buyerEmails = [1, 2].map((n) => `${TAG}-${n}@example.com`);

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const session = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "SESSION", status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } });
  const mariaSession = await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id, type: "SESSION" } });
  const anaCustomer = await prisma.customer.findFirstOrThrow({ where: { creatorId: ana.id } });
  const mariaCustomer = await prisma.customer.findFirstOrThrow({ where: { creatorId: maria.id } });

  // ── 1. Dos compras simultáneas del mismo hueco (camino real: pedido pendiente + entrega) ──
  const { days } = await getAvailableSlots(session);
  const slot = days.at(-1)?.slots.at(-1)?.start;
  check("hay un hueco libre para la prueba", !!slot);
  if (slot) {
    const orders = await Promise.all(
      buyerEmails.map((email, i) =>
        createPendingOrder({ productId: session.id, buyerEmail: email, buyerName: `Prueba ${i + 1}`, slotStart: slot, visitorId: TAG, source: "direct" }),
      ),
    );
    orderIds.push(...orders.map((o) => o.id));
    const results = await Promise.allSettled(orders.map((o, i) => fulfillOrder(o.id, `sim_ch_${TAG}_${i}`)));
    check("las dos compras se completan sin error", results.every((r) => r.status === "fulfilled"));
    const paid = await prisma.order.count({ where: { id: { in: orderIds }, status: "PAID" } });
    check("los dos pedidos quedan pagados", paid === 2);
    const bookings = await prisma.booking.findMany({ where: { orderId: { in: orderIds } } });
    bookingIds.push(...bookings.map((b) => b.id));
    check("exactamente una reserva CONFIRMED para el hueco", bookings.filter((b) => b.status === "CONFIRMED").length === 1);
    check("la otra queda pendiente de elegir fecha", bookings.filter((b) => b.status === "PENDING_SCHEDULE" && !b.startAt).length === 1);
  }

  // ── 2. Cerrojo por creadora: comprobar y escribir en dos transacciones a la vez ──
  const start = new Date(Date.UTC(2099, 0, 5, 9, 0));
  const end = new Date(start.getTime() + HOUR);
  const base = { productId: session.id, customerId: anaCustomer.id, userId: anaCustomer.userId };
  const attempt = () =>
    prisma.$transaction(async (tx) => {
      if (await hasBookingClash(tx, ana.id, start, end, 15)) return "ocupado";
      // Simula una compra lenta entre la comprobación y la escritura.
      await tx.$executeRaw`SELECT pg_sleep(0.3)`;
      const b = await tx.booking.create({ data: { ...base, creatorId: ana.id, status: "CONFIRMED", startAt: start, endAt: end } });
      bookingIds.push(b.id);
      return "reservado";
    });
  const race = await Promise.allSettled([attempt(), attempt()]);
  const outcomes = race.map((r) => (r.status === "fulfilled" ? r.value : "error"));
  check("dos transacciones simultáneas: una reserva y la otra ve el hueco ocupado", outcomes.sort().join(",") === "ocupado,reservado");
  check("ninguna transacción ha tenido que chocar con la regla de la BD", !race.some((r) => r.status === "rejected"));

  // ── 3. La regla de la BD, sin pasar por el cerrojo ──
  const create = async (data: { creatorId: string; productId: string; customerId: string; userId: string; startAt: Date | null; endAt: Date | null }) => {
    const b = await prisma.booking.create({ data: { ...data, status: "CONFIRMED" } });
    bookingIds.push(b.id);
    return b;
  };
  let overlapError: unknown = null;
  try {
    await create({ ...base, creatorId: ana.id, startAt: new Date(start.getTime() + 30 * 60000), endAt: new Date(end.getTime() + 30 * 60000) });
  } catch (e) {
    overlapError = e;
  }
  check("un solape CONFIRMED escrito a mano se rechaza", overlapError !== null);
  check("isBookingOverlapError reconoce el error", isBookingOverlapError(overlapError));

  const mariaBase = { productId: mariaSession.id, customerId: mariaCustomer.id, userId: mariaCustomer.userId };
  check("otra creadora puede reservar a la misma hora", await succeeds(() => create({ ...mariaBase, creatorId: maria.id, startAt: start, endAt: end })));
  check("una sesión justo a continuación (fin = inicio) se permite", await succeeds(() => create({ ...base, creatorId: ana.id, startAt: end, endAt: new Date(end.getTime() + HOUR) })));
  check(
    "las reservas CONFIRMED sin fecha no bloquean el calendario",
    await succeeds(async () => {
      await create({ ...base, creatorId: ana.id, startAt: null, endAt: null });
      await create({ ...base, creatorId: ana.id, startAt: null, endAt: null });
    }),
  );
  check("una reserva cancelada no ocupa el hueco", await succeeds(async () => {
    const b = await create({ ...base, creatorId: ana.id, startAt: new Date(start.getTime() - 3 * HOUR), endAt: new Date(start.getTime() - 2 * HOUR) });
    await prisma.booking.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
    await create({ ...base, creatorId: ana.id, startAt: b.startAt, endAt: b.endAt });
  }));
}

async function succeeds(fn: () => Promise<unknown>) {
  try {
    await fn();
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: buyerEmails } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const customers = await prisma.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const keys = [...orderIds, ...bookingIds, ...customers.map((c) => c.id)];
  await prisma.$transaction([
    prisma.emailMessage.deleteMany({ where: { OR: [{ to: { in: buyerEmails } }, ...keys.map((k) => ({ dedupeKey: { contains: k } }))] } }),
    prisma.analyticsEvent.deleteMany({ where: { visitorId: TAG } }),
    prisma.access.deleteMany({ where: { userId: { in: userIds } } }),
    // Facturas de las compras de prueba (primero se sueltan las F3/rectificativas de su original).
    prisma.invoice.updateMany({ where: { recipientEmail: { startsWith: TAG } }, data: { relatedInvoiceId: null } }),
    prisma.invoice.deleteMany({ where: { recipientEmail: { startsWith: TAG } } }),
    prisma.transaction.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.booking.deleteMany({ where: { OR: [{ id: { in: bookingIds } }, { orderId: { in: orderIds } }] } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nReservas a prueba de compras simultáneas ✓");
    process.exit(failures ? 1 : 0);
  });
