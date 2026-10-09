/**
 * Pruebas de reembolsos, desistimiento y cambios de reserva contra Postgres.
 *   npm run test:refunds        (con la BD sembrada: npm run db:reset)
 *
 *   · reembolso total de una sesión: pedido REFUNDED, libro en negativo, acceso retirado, sesión
 *     cancelada con su recordatorio, contadores de la clienta, analítica y email;
 *   · dos reembolsos a la vez del mismo pedido: solo uno (cerrojo del pedido);
 *   · pasarela pendiente / fallida / reintento; confirmación repetida → una sola fila REFUND;
 *   · avisos de la pasarela: reembolso desconocido (panel de Stripe), aviso que llega antes que la
 *     respuesta, reembolso fallido más tarde;
 *   · un pago repetido de un pedido reembolsado no lo vuelve a entregar;
 *   · desistimiento (solo la compradora, dentro de plazo), membresía cancelada al reembolsar;
 *   · proponer otra fecha, cancelar sin reembolso y aviso a la creadora de la nueva fecha.
 * Usa la pasarela simulada con un `refund()` de prueba. Crea sus propios pedidos y los borra.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { getAvailableSlots } from "../lib/booking";
import { cancelBooking, notifyRescheduled, requestReschedule } from "../lib/booking-changes";
import { createPendingOrder, fulfillOrder } from "../lib/orders";
import { applyPaymentUpdate } from "../lib/payments/events";
import type { PaymentProvider, RefundInput } from "../lib/payments/provider";
import { simulatedProvider } from "../lib/payments/simulated";
import { orderStatusLabel } from "../lib/refund-math";
import { markRefundSucceeded, refundOrder, syncProviderRefund, withdrawOrder } from "../lib/refunds";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `reembolsos-${Date.now()}`;
const STARTED = new Date();
const email = (label: string) => `${TAG}-${label}@example.com`;
const created = { orders: [] as string[] };

type Outcome = Awaited<ReturnType<PaymentProvider["refund"]>>;
/** Pasarela simulada con un refund() controlado por la prueba. */
function stub(outcome: (i: RefundInput) => Outcome | Promise<Outcome>) {
  const calls: RefundInput[] = [];
  const provider: PaymentProvider = {
    ...simulatedProvider,
    async refund(i) {
      calls.push(i);
      return outcome(i);
    },
  };
  return { provider, calls };
}
let seq = 0;
const ok = (status: "succeeded" | "pending" = "succeeded"): Outcome => ({ ok: true, refundRef: `sim_re_${TAG}_${++seq}`, status });

async function buy(productId: string, label: string, slotStart?: string) {
  const o = await createPendingOrder({ productId, buyerEmail: email(label), buyerName: `Prueba ${label}`, slotStart });
  created.orders.push(o.id);
  const ref = `sim_ch_${TAG}_${label}`;
  await applyPaymentUpdate(
    { kind: "payment", status: { state: "succeeded", ref, amountCents: o.amountCents, currency: o.currency, destinationAccount: null, metadata: { orderId: o.id } } },
    "simulated",
  );
  return prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { customer: true, bookings: true } });
}

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" }, include: { user: true } });
  const anaActor = { kind: "creator" as const, creatorId: ana.id, userId: ana.userId };
  const session = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, slug: "sesion-1-1" } });
  const digital = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED" } });
  const membership = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "MEMBERSHIP", status: "PUBLISHED" } });
  // Huecos del final de la agenda: lejos de los que usan las pruebas e2e.
  const slots = (await getAvailableSlots(session)).days.flatMap((d) => d.slots).reverse();
  const slot = (n: number) => slots[n * 3].start; // separados para que no choquen con el margen

  // ── 1. Reembolso total de una sesión desde «Cambiar o cancelar» ──
  {
    const o = await buy(session.id, "sesion", slot(0));
    const booking = o.bookings[0];
    check("sesión comprada y confirmada", booking?.status === "CONFIRMED" && !!booking.startAt, booking);
    await prisma.emailMessage.create({
      data: { to: o.buyerEmail, creatorId: ana.id, subject: "Recordatorio", html: "x", template: "SESSION_REMINDER", sendAt: new Date(Date.now() + 86_400_000), dedupeKey: `reminder:${booking.id}:prueba` },
    });
    const s = stub(() => ok());
    const r = await refundOrder(
      { orderId: o.id, actor: anaActor, reason: "SESSION_CANCELLED", note: "Me he puesto enferma", revokeAccess: true, cancelBooking: true },
      { provider: s.provider },
    );
    check("refundOrder → SUCCEEDED por el importe completo", r.ok && r.status === "SUCCEEDED" && r.amountCents === o.amountCents, r);
    check("la pasarela recibe importe, clave de idempotencia y devolución de la comisión", s.calls.length === 1 && s.calls[0].amountCents === o.amountCents && s.calls[0].idempotencyKey === `refund_${r.ok ? r.refundId : ""}` && s.calls[0].refundApplicationFee, s.calls);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    check("pedido REFUNDED con refundedCents = importe", after.status === "REFUNDED" && after.refundedCents === o.amountCents && after.refundedFeeCents === o.platformFeeCents, after);
    const txs = await prisma.transaction.findMany({ where: { orderId: o.id } });
    const charge = txs.find((t) => t.type === "CHARGE")!;
    const refund = txs.filter((t) => t.type === "REFUND");
    check(
      "una fila REFUND en negativo que anula la CHARGE",
      refund.length === 1 && refund[0].amountCents + charge.amountCents === 0 && refund[0].platformFeeCents + charge.platformFeeCents === 0 && refund[0].netCents + charge.netCents === 0,
      txs,
    );
    check("acceso retirado", (await prisma.access.findFirst({ where: { orderId: o.id } }))?.status === "REVOKED");
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    check("sesión cancelada por la creadora con el motivo", b.status === "CANCELLED" && b.cancelledBy === "CREATOR" && b.cancelReason === "Me he puesto enferma", b);
    const reminder = await prisma.emailMessage.findFirst({ where: { to: o.buyerEmail, template: "SESSION_REMINDER" } });
    check("su recordatorio queda cancelado", reminder?.status === "CANCELED" && reminder.dedupeKey === null, reminder);
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: o.customerId! } });
    check("contadores de la clienta: gasto y compras descontados", customer.totalSpentCents === 0 && customer.ordersCount === 0, customer);
    check("un evento REFUND en la analítica", (await prisma.analyticsEvent.count({ where: { type: "REFUND", productId: session.id, visitorId: `user:${o.customer!.userId}` } })) === 1);
    const mail = await prisma.emailMessage.findFirst({ where: { to: o.buyerEmail, template: "BOOKING_CANCELLED" } });
    check("email «sesión cancelada» con el importe devuelto", !!mail && mail.subject.includes(session.title) && mail.html.includes("Te hemos devuelto"), mail?.subject);
    check("evento order.refunded", (await prisma.outboxEvent.count({ where: { type: "order.refunded", payload: { path: ["orderId"], equals: o.id } } })) === 1);

    // Un aviso de pago repetido no vuelve a entregar un pedido reembolsado.
    const again = await fulfillOrder(o.id, o.paymentRef!);
    check("fulfillOrder sobre un pedido REFUNDED no hace nada", again.alreadyPaid && (await prisma.transaction.count({ where: { orderId: o.id, type: "CHARGE" } })) === 1);
    check("…y el acceso sigue retirado", (await prisma.access.findFirst({ where: { orderId: o.id } }))?.status === "REVOKED");
    const twice = await refundOrder({ orderId: o.id, actor: anaActor, reason: "OTHER", revokeAccess: false, cancelBooking: false }, { provider: s.provider });
    check("no se puede volver a reembolsar", !twice.ok && twice.code === "NOT_REFUNDABLE" && s.calls.length === 1, twice);
  }

  // ── 2. Dos reembolsos a la vez: solo uno ──
  {
    const o = await buy(digital.id, "carrera");
    const s = stub(async () => {
      await new Promise((r) => setTimeout(r, 150));
      return ok();
    });
    const req = { orderId: o.id, actor: anaActor, reason: "CUSTOMER_REQUEST" as const, revokeAccess: true, cancelBooking: false };
    const [a, b] = await Promise.all([refundOrder(req, { provider: s.provider }), refundOrder(req, { provider: s.provider })]);
    const oks = [a, b].filter((x) => x.ok);
    const other = [a, b].find((x) => !x.ok);
    check("a la vez: exactamente uno sale bien", oks.length === 1, [a, b]);
    check("…el otro se rechaza por importe", !!other && !other.ok && (other.code === "AMOUNT" || other.code === "NOT_REFUNDABLE"), other);
    check("…y la pasarela solo recibe una petición", s.calls.length === 1, s.calls.length);
    check("…un solo Refund", (await prisma.refund.count({ where: { orderId: o.id } })) === 1);
  }

  // ── 3. Pasarela pendiente y confirmación repetida ──
  {
    const o = await buy(digital.id, "pendiente");
    const s = stub(() => ok("pending"));
    const r = await refundOrder({ orderId: o.id, actor: anaActor, reason: "CUSTOMER_REQUEST", revokeAccess: true, cancelBooking: false }, { provider: s.provider });
    check("pendiente: Refund PENDING", r.ok && r.status === "PENDING", r);
    const pending = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    check("pendiente: el acceso ya se retira, pero el dinero aún no cuenta", (await prisma.access.findFirst({ where: { orderId: o.id } }))?.status === "REVOKED" && pending.refundedCents === 0 && pending.status === "PAID");
    if (r.ok) {
      const results = await Promise.all([markRefundSucceeded(r.refundId), markRefundSucceeded(r.refundId)]);
      await markRefundSucceeded(r.refundId);
      check("confirmación repetida: se aplica una vez", results.filter(Boolean).length === 1, results);
      check("…una sola fila REFUND", (await prisma.transaction.count({ where: { orderId: o.id, type: "REFUND" } })) === 1);
      check("…y el pedido queda REFUNDED", (await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status === "REFUNDED");
      const ref = (await prisma.refund.findUniqueOrThrow({ where: { id: r.refundId } })).providerRef!;
      await syncProviderRefund({ provider: "simulated", paymentRef: o.paymentRef!, providerRef: ref, amountCents: o.amountCents, status: "succeeded" });
      check("…y el aviso de la pasarela después tampoco duplica", (await prisma.transaction.count({ where: { orderId: o.id, type: "REFUND" } })) === 1);
    }
  }

  // ── 4. Pasarela que rechaza, reintento y fallo posterior ──
  {
    const o = await buy(digital.id, "fallo");
    const failing = stub(() => ({ ok: false, error: "Saldo insuficiente en la cuenta conectada" }));
    const r = await refundOrder({ orderId: o.id, actor: anaActor, reason: "CUSTOMER_REQUEST", revokeAccess: true, cancelBooking: false }, { provider: failing.provider });
    check("rechazo: error de la pasarela", !r.ok && r.code === "PROVIDER" && r.error.includes("Saldo insuficiente"), r);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    const failedRow = await prisma.refund.findFirst({ where: { orderId: o.id } });
    check("rechazo: Refund FAILED y nada más cambia", failedRow?.status === "FAILED" && after.status === "PAID" && after.refundedCents === 0 && (await prisma.access.findFirst({ where: { orderId: o.id } }))?.status === "ACTIVE", failedRow);
    const retry = await refundOrder({ orderId: o.id, actor: anaActor, amountCents: 500, reason: "CUSTOMER_REQUEST", revokeAccess: false, cancelBooking: false }, { provider: stub(() => ok()).provider });
    const partial = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    check("reintento parcial tras el fallo: sale bien", retry.ok && retry.status === "SUCCEEDED" && partial.refundedCents === 500 && partial.status === "PAID", retry);
    check("…y el pedido se ve «Reembolsado parcialmente»", orderStatusLabel(partial) === "Reembolsado parcialmente");
    check("…sin retirar el acceso", (await prisma.access.findFirst({ where: { orderId: o.id } }))?.status === "ACTIVE");
    const tooMuch = await refundOrder({ orderId: o.id, actor: anaActor, amountCents: o.amountCents, reason: "OTHER", revokeAccess: false, cancelBooking: false }, { provider: stub(() => ok()).provider });
    check("no se puede devolver más de lo que queda", !tooMuch.ok && tooMuch.code === "AMOUNT", tooMuch);

    // Un reembolso que la pasarela deja pendiente y luego rechaza: aviso a la creadora.
    const later = await refundOrder({ orderId: o.id, actor: anaActor, amountCents: 300, reason: "OTHER", revokeAccess: false, cancelBooking: false }, { provider: stub(() => ok("pending")).provider });
    const pendingRow = later.ok ? await prisma.refund.findUniqueOrThrow({ where: { id: later.refundId } }) : null;
    await syncProviderRefund({ provider: "simulated", paymentRef: o.paymentRef!, providerRef: pendingRow!.providerRef!, amountCents: 300, status: "failed", error: "La tarjeta ya no existe" });
    const failedLater = await prisma.refund.findUniqueOrThrow({ where: { id: pendingRow!.id } });
    check("fallo posterior: Refund FAILED con el motivo", failedLater.status === "FAILED" && failedLater.error === "La tarjeta ya no existe", failedLater);
    check("…y la creadora recibe el aviso", (await prisma.emailMessage.count({ where: { template: "REFUND_FAILED", dedupeKey: `refund-failed:${pendingRow!.id}` } })) === 1);
    check("…sin tocar lo ya devuelto", (await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).refundedCents === 500);
  }

  // ── 5. Avisos de la pasarela ──
  {
    const o = await buy(digital.id, "stripe");
    const res = await syncProviderRefund({ provider: "simulated", paymentRef: o.paymentRef!, providerRef: `re_${TAG}_panel`, amountCents: o.amountCents, status: "succeeded" });
    const row = await prisma.refund.findUnique({ where: { providerRef: `re_${TAG}_panel` } });
    check("reembolso hecho en el panel de la pasarela: se registra", res?.orderId === o.id && row?.initiatedBy === "PROVIDER" && row.status === "SUCCEEDED" && row.revokeAccess, row);
    check("…con su fila REFUND y el pedido REFUNDED", (await prisma.transaction.count({ where: { refundId: row?.id } })) === 1 && (await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status === "REFUNDED");
    await syncProviderRefund({ provider: "simulated", paymentRef: o.paymentRef!, providerRef: `re_${TAG}_panel`, amountCents: o.amountCents, status: "succeeded" });
    check("…el mismo aviso otra vez no crea nada", (await prisma.refund.count({ where: { orderId: o.id } })) === 1);
    check("aviso de un cobro desconocido: se ignora", (await syncProviderRefund({ provider: "simulated", paymentRef: `sim_ch_${TAG}_nadie`, providerRef: `re_${TAG}_x`, amountCents: 100, status: "succeeded" })) === null);

    // El aviso llega antes de que guardemos la referencia: se reconoce por los metadatos.
    const o2 = await buy(digital.id, "carrera-aviso");
    const ref = `sim_re_${TAG}_temprano`;
    const early = stub(async (i) => {
      await syncProviderRefund({ provider: "simulated", paymentRef: i.paymentRef, providerRef: ref, refundId: i.metadata?.refundId, amountCents: i.amountCents!, status: "succeeded" });
      return { ok: true, refundRef: ref, status: "pending" };
    });
    const r2 = await refundOrder({ orderId: o2.id, actor: anaActor, reason: "CUSTOMER_REQUEST", revokeAccess: true, cancelBooking: false }, { provider: early.provider });
    check("aviso antes que la respuesta: un solo Refund, ya SUCCEEDED", r2.ok && r2.status === "SUCCEEDED" && (await prisma.refund.count({ where: { orderId: o2.id } })) === 1, r2);
    check("…con una sola fila REFUND", (await prisma.transaction.count({ where: { orderId: o2.id, type: "REFUND" } })) === 1);
  }

  // ── 6. Desistimiento ──
  {
    const o = await buy(digital.id, "desiste");
    const userId = o.customer!.userId;
    const stranger = await withdrawOrder({ orderId: o.id, userId: ana.userId, email: ana.user.email }, { provider: stub(() => ok()).provider });
    check("desistir un pedido ajeno → NOT_FOUND", !stranger.ok && stranger.code === "NOT_FOUND", stranger);
    const r = await withdrawOrder({ orderId: o.id, userId, email: o.buyerEmail }, { provider: stub(() => ok()).provider });
    check("desistimiento dentro de plazo → reembolso total", r.ok && r.amountCents === o.amountCents, r);
    const refund = await prisma.refund.findFirst({ where: { orderId: o.id } });
    check("…iniciado por la clienta con motivo WITHDRAWAL", refund?.initiatedBy === "CUSTOMER" && refund.reason === "WITHDRAWAL" && refund.initiatedByUserId === userId, refund);
    check("…acuse de recibo a la compradora", (await prisma.emailMessage.count({ where: { to: o.buyerEmail, template: "WITHDRAWAL_RECEIPT" } })) === 1);
    check("…y aviso a la creadora", (await prisma.emailMessage.count({ where: { template: "WITHDRAWAL_CREATOR", dedupeKey: `withdrawal:${o.id}` } })) === 1);

    const late = await buy(digital.id, "tarde");
    await prisma.order.update({ where: { id: late.id }, data: { paidAt: new Date(Date.now() - 15 * 86_400_000) } });
    const expired = await withdrawOrder({ orderId: late.id, userId: late.customer!.userId, email: late.buyerEmail }, { provider: stub(() => ok()).provider });
    check("fuera de plazo → NOT_REFUNDABLE con la fecha", !expired.ok && expired.code === "NOT_REFUNDABLE" && expired.error.includes("plazo"), expired);
  }

  // ── 7. Membresía: reembolsar con «retirar el acceso» la cancela ya ──
  {
    const o = await buy(membership.id, "miembro");
    const r = await refundOrder({ orderId: o.id, actor: anaActor, reason: "CUSTOMER_REQUEST", revokeAccess: true, cancelBooking: false }, { provider: stub(() => ok()).provider });
    const sub = await prisma.subscription.findFirst({ where: { customerId: o.customerId!, productId: membership.id } });
    check("membresía reembolsada: suscripción CANCELED al momento", r.ok && sub?.status === "CANCELED" && !sub.cancelAtPeriodEnd, sub);
    check("…y sin acceso", (await prisma.access.findFirst({ where: { subscriptionId: sub?.id } }))?.status === "REVOKED");
  }

  // ── 8. Otra fecha y cancelar sin reembolso ──
  {
    const o = await buy(session.id, "otra-fecha", slot(1));
    const b = o.bookings[0];
    const r = await requestReschedule({ creatorId: ana.id, bookingId: b.id, note: "¿Te viene bien otro día?" });
    const moved = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    check("proponer otra fecha: vuelve a pendiente y guarda la anterior", r.ok && moved.status === "PENDING_SCHEDULE" && !moved.startAt && moved.previousStartAt?.getTime() === b.startAt!.getTime() && !!moved.rescheduleRequestedAt, moved);
    const proposal = await prisma.emailMessage.findFirst({ where: { to: o.buyerEmail, template: "BOOKING_RESCHEDULE" } });
    check("…la clienta recibe el enlace con el mensaje", !!proposal && proposal.subject.includes("te propone cambiar la fecha") && proposal.html.includes("otro día"), proposal?.subject);
    check("…y no se puede pedir dos veces", !(await requestReschedule({ creatorId: ana.id, bookingId: b.id, note: null })).ok);
    // La clienta elige nueva fecha (lo que hace scheduleBooking) → aviso a la creadora.
    const newStart = new Date(slot(2));
    await prisma.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED", startAt: newStart, endAt: new Date(newStart.getTime() + 3_600_000) } });
    await notifyRescheduled(b.id);
    await notifyRescheduled(b.id);
    check("nueva fecha elegida: un aviso a la creadora", (await prisma.emailMessage.count({ where: { template: "BOOKING_RESCHEDULED", dedupeKey: { startsWith: `rescheduled:${b.id}:` } } })) === 1);
    check("…y la propuesta queda resuelta", (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).rescheduleRequestedAt === null);

    const c = await cancelBooking({ creatorId: ana.id, bookingId: b.id, by: "CREATOR", reason: "No me presenté a tiempo", notify: true });
    const cancelled = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    check("cancelar sin reembolso: CANCELLED con el motivo", c.ok && cancelled.status === "CANCELLED" && cancelled.cancelReason === "No me presenté a tiempo", cancelled);
    const mail = await prisma.emailMessage.findFirst({ where: { to: o.buyerEmail, template: "BOOKING_CANCELLED" } });
    check("…la clienta recibe el motivo y ningún importe", !!mail && mail.html.includes("No me presenté a tiempo") && !mail.html.includes("Te hemos devuelto"));
    check("…el pago sigue en pie", (await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status === "PAID");
    check("…y un segundo toque no hace nada", !(await cancelBooking({ creatorId: ana.id, bookingId: b.id, by: "CREATOR", reason: "x", notify: true })).ok);
  }
}

async function cleanup() {
  const buyers = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = buyers.map((u) => u.id);
  const orderIds = created.orders;
  const bookingIds = (await prisma.booking.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map((b) => b.id);
  const subs = (await prisma.subscription.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((s) => s.id);
  const customerIds = (await prisma.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((c) => c.id);
  const byPayload = [
    ...orderIds.map((id) => ({ payload: { path: ["orderId"], equals: id } })),
    ...bookingIds.map((id) => ({ payload: { path: ["bookingId"], equals: id } })),
    ...subs.map((id) => ({ payload: { path: ["subscriptionId"], equals: id } })),
    ...customerIds.map((id) => ({ payload: { path: ["customerId"], equals: id } })),
  ];
  await prisma.$transaction([
    prisma.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.outboxEvent.deleteMany({ where: { OR: byPayload.length ? byPayload : [{ id: "" }] } }),
    prisma.emailMessage.deleteMany({
      where: {
        OR: [
          { to: { startsWith: TAG } },
          ...[...orderIds, ...bookingIds].map((id) => ({ dedupeKey: { contains: id } })),
          { template: { in: ["REFUND_FAILED", "WITHDRAWAL_CREATOR", "BOOKING_RESCHEDULED"] }, createdAt: { gte: STARTED } },
        ],
      },
    }),
    prisma.access.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.transaction.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { subscriptionId: { in: subs } }] } }),
    prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }),
    prisma.subscription.deleteMany({ where: { id: { in: subs } } }),
    prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: userIds.map((id) => `user:${id}`) } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await cleanup().catch((e) => {
      console.error("No se ha podido limpiar:", e);
      failures++;
    });
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nReembolsos correctos ✓");
    process.exit(failures ? 1 : 0);
  });
