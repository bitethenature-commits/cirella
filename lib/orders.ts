import "server-only";
import { prisma } from "./db";
import { dispatchEvents, recordEvents, type DomainEvent } from "./events";
import { hasBookingClash, isBookingOverlapError, isSlotAvailable } from "./booking";
import { paymentProvider, type PaymentMethodInput } from "./payments";
import { canSellType, effectiveCommissionBps } from "./plans";
import { pushBookingEvent } from "./calendar";
import { captureError } from "./monitoring";
import { chargeKey } from "./reliability";
import type { ProductType } from "./types";

export class CheckoutError extends Error {}

/** Producto comprable: publicado, creadora activa y publicada, plan lo permite, cobros conectados. */
export async function getPurchasableProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { creator: { include: { plan: true } } },
  });
  if (!product || product.status !== "PUBLISHED") return null;
  const c = product.creator;
  if (c.status !== "ACTIVE" || !c.published) return null;
  if (!canSellType(c.plan, product.type as ProductType)) return null;
  return product;
}

export function computeFees(amountCents: number, commissionBps: number) {
  const platformFeeCents = Math.round((amountCents * commissionBps) / 10000);
  return { platformFeeCents, netCents: amountCents - platformFeeCents };
}

/** Paso 1: crea el pedido pendiente (permite medir abandonos y recuperarlos). */
export async function createPendingOrder(input: {
  productId: string;
  buyerEmail: string;
  buyerName: string;
  slotStart?: string | null;
  visitorId?: string | null;
  source?: string | null;
}) {
  const product = await getPurchasableProduct(input.productId);
  if (!product) throw new CheckoutError("Este producto no está disponible ahora mismo.");
  if (!product.creator.payoutConnectedAt) throw new CheckoutError("La creadora todavía no ha activado los pagos.");
  if (product.type === "SESSION" && input.slotStart) {
    if (!(await isSlotAvailable(product, input.slotStart)))
      throw new CheckoutError("Ese horario acaba de ocuparse. Elige otro, por favor.");
  }
  const commissionBps = effectiveCommissionBps(product.creator.plan, product.creator);
  const { platformFeeCents, netCents } = computeFees(product.priceCents, commissionBps);
  return prisma.order.create({
    data: {
      creatorId: product.creatorId,
      productId: product.id,
      productTitle: product.title,
      productType: product.type,
      buyerEmail: input.buyerEmail.toLowerCase(),
      buyerName: input.buyerName || null,
      amountCents: product.priceCents,
      currency: product.currency,
      commissionBps,
      platformFeeCents,
      netCents,
      paymentProvider: paymentProvider().key,
      metadata: input.slotStart ? { slotStart: input.slotStart } : undefined,
      visitorId: input.visitorId ?? null,
      source: input.source ?? null,
    },
  });
}

/** Paso 2: cobra el pedido con la pasarela y, si va bien, lo entrega. */
export async function payOrder(orderId: string, payment: PaymentMethodInput) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { creator: true } });
  if (order.status === "PAID") return { ok: true as const, ...(await fulfillOrder(order.id, order.paymentRef ?? "")) };
  if (order.status !== "PENDING" && order.status !== "FAILED" && order.status !== "ABANDONED")
    throw new CheckoutError("Este pedido ya no se puede pagar.");
  if (order.productType === "MEMBERSHIP") {
    // Una suscripción activa por persona y membresía: nunca cobrar una segunda.
    const existingSub = await prisma.subscription.findFirst({
      where: { productId: order.productId, status: "ACTIVE", customer: { email: order.buyerEmail } },
    });
    if (existingSub)
      throw new CheckoutError(
        existingSub.cancelAtPeriodEnd
          ? "Ya eres miembro. Puedes reactivar tu suscripción desde tu cuenta."
          : "Ya eres miembro de esta comunidad. Entra desde tu cuenta.",
      );
  }
  const result = await paymentProvider().charge({
    orderId: order.id,
    amountCents: order.amountCents,
    currency: order.currency,
    description: order.productTitle,
    customerEmail: order.buyerEmail,
    platformFeeCents: order.platformFeeCents,
    destinationAccount: order.creator.payoutAccountId,
    payment,
  });
  if (!result.ok) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
    return { ok: false as const, error: result.error };
  }
  // El cobro queda anotado antes de entregar: si la entrega falla tras cobrar, el vigilante
  // del cron (lib/watchdog.ts) la reintenta a partir de Order.chargedAt.
  await prisma.order.update({ where: { id: order.id }, data: { chargedAt: new Date(), paymentRef: result.ref } });
  try {
    return { ok: true as const, ...(await fulfillOrder(order.id, result.ref)) };
  } catch (e) {
    captureError(e, { area: "checkout", extra: { orderId: order.id } });
    throw e;
  }
}

function addInterval(date: Date, interval: string) {
  const d = new Date(date);
  if (interval === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Entrega automática. Idempotente: un webhook repetido no duplica nada.
 * Marca el pedido como pagado, registra la transacción y concede el acceso
 * según el tipo de producto (descarga, curso, reserva o suscripción).
 */
export async function fulfillOrder(orderId: string, paymentRef: string) {
  const events: DomainEvent[] = [];
  let result: Awaited<ReturnType<typeof fulfillInTransaction>>;
  try {
    result = await fulfillInTransaction(orderId, paymentRef, events, { confirmSlot: true });
  } catch (e) {
    // La regla Booking_no_overlap de la BD ha rechazado la reserva (otra compra confirmó el
    // mismo hueco por un camino sin cerrojo): la venta sigue adelante y la reserva queda
    // pendiente de elegir fecha, igual que cuando el hueco ya estaba ocupado.
    if (!isBookingOverlapError(e)) throw e;
    result = await fulfillInTransaction(orderId, paymentRef, events, { confirmSlot: false });
  }

  // Los avisos (recibo, acceso, reserva, calendario) se guardan en la misma transacción que el
  // pedido y se envían ya, tras el commit. Si el proceso cae justo después, /api/cron los envía.
  const { eventIds, ...fulfilled } = result;
  await dispatchEvents(eventIds);
  return fulfilled;
}

async function fulfillInTransaction(orderId: string, paymentRef: string, events: DomainEvent[], opts: { confirmSlot: boolean }) {
  // Tiempo máximo amplio (15 s): con dos compras a la vez de la misma creadora, la segunda
  // espera el cerrojo de reservas (hasBookingClash) hasta que la primera termina.
  return prisma.$transaction(async (tx) => {
    events.length = 0;
    // Bloquea la fila del pedido: dos entregas simultáneas (redirección + webhook, o el vigilante)
    // se ponen en fila y la segunda ya lo ve PAID. La clave única charge:{orderId} es la última red.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { product: true } });
    const existingUser = await tx.user.findUnique({ where: { email: order.buyerEmail } });
    if (order.status === "PAID") {
      return { order, userId: existingUser!.id, isNewUser: false, eventIds: [] as string[] };
    }
    const now = new Date();
    const user =
      existingUser ??
      (await tx.user.create({ data: { email: order.buyerEmail, name: order.buyerName } }));
    if (existingUser && !existingUser.name && order.buyerName)
      await tx.user.update({ where: { id: user.id }, data: { name: order.buyerName } });

    const prevCustomer = await tx.customer.findUnique({
      where: { creatorId_userId: { creatorId: order.creatorId, userId: user.id } },
    });
    const customer = await tx.customer.upsert({
      where: { creatorId_userId: { creatorId: order.creatorId, userId: user.id } },
      create: {
        creatorId: order.creatorId,
        userId: user.id,
        email: user.email,
        name: order.buyerName ?? user.name,
        totalSpentCents: order.amountCents,
        ordersCount: 1,
        firstPurchaseAt: now,
        lastPurchaseAt: now,
      },
      update: {
        totalSpentCents: { increment: order.amountCents },
        ordersCount: { increment: 1 },
        lastPurchaseAt: now,
        name: prevCustomer?.name ?? order.buyerName ?? user.name,
      },
    });
    if (!prevCustomer) events.push({ type: "customer.created", customerId: customer.id });

    const paid = await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: now, paymentRef, customerId: customer.id },
      include: { product: true },
    });
    await tx.transaction.create({
      data: {
        creatorId: order.creatorId,
        orderId: order.id,
        type: "CHARGE",
        description: order.productTitle,
        amountCents: order.amountCents,
        platformFeeCents: order.platformFeeCents,
        netCents: order.netCents,
        currency: order.currency,
        provider: order.paymentProvider,
        providerRef: paymentRef,
        idempotencyKey: chargeKey(order.id),
      },
    });

    const p = order.product;
    let subscriptionId: string | null = null;
    let expiresAt: Date | null = null;
    if (p.type === "MEMBERSHIP") {
      const end = addInterval(now, p.billingInterval ?? "month");
      const sub = await tx.subscription.create({
        data: {
          creatorId: order.creatorId,
          productId: p.id,
          customerId: customer.id,
          userId: user.id,
          priceCents: order.amountCents,
          interval: p.billingInterval ?? "month",
          currentPeriodStart: now,
          currentPeriodEnd: end,
          provider: order.paymentProvider,
          providerRef: paymentRef,
        },
      });
      subscriptionId = sub.id;
      expiresAt = end;
      events.push({ type: "subscription.created", subscriptionId: sub.id });
    }
    if (p.type === "SESSION") {
      const slotStart = (order.metadata as { slotStart?: string } | null)?.slotStart;
      const start = slotStart ? new Date(slotStart) : null;
      // Bajo el cerrojo de reservas de la creadora (lo toma hasBookingClash): el hueco no
      // choca con otra reserva y sigue dentro de su horario. Si otra compra lo ha ocupado
      // mientras tanto, esta reserva queda pendiente de elegir fecha.
      const stillFree =
        opts.confirmSlot &&
        !!slotStart &&
        !!start &&
        !(await hasBookingClash(tx, order.creatorId, start, new Date(start.getTime() + (p.durationMin ?? 60) * 60000), p.bufferMin ?? 15)) &&
        (await isSlotAvailable(p, slotStart, { client: tx }));
      const booking = await tx.booking.create({
        data: {
          creatorId: order.creatorId,
          productId: p.id,
          customerId: customer.id,
          userId: user.id,
          orderId: order.id,
          status: start && stillFree ? "CONFIRMED" : "PENDING_SCHEDULE",
          startAt: start && stillFree ? start : null,
          endAt: start && stillFree ? new Date(start.getTime() + (p.durationMin ?? 60) * 60000) : null,
          meetingUrl: p.meetingUrl,
        },
      });
      events.push({ type: "booking.confirmed", bookingId: booking.id });
    }
    await tx.access.upsert({
      where: { userId_productId: { userId: user.id, productId: p.id } },
      create: { creatorId: order.creatorId, userId: user.id, productId: p.id, orderId: order.id, subscriptionId, expiresAt },
      update: { status: "ACTIVE", orderId: order.id, subscriptionId, expiresAt },
    });
    await tx.analyticsEvent.create({
      data: {
        creatorId: order.creatorId,
        type: "PURCHASE",
        productId: p.id,
        visitorId: order.visitorId ?? `user:${user.id}`,
        source: order.source,
        amountCents: order.amountCents,
      },
    });
    events.unshift({ type: "order.paid", orderId: order.id });
    const eventIds = await recordEvents(tx, events);
    return { order: paid, userId: user.id, isNewUser: !existingUser, eventIds };
  }, { timeout: 15_000 });
}

export async function syncBookingToCalendar(bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { creator: true, product: true, customer: true } });
  if (!b?.startAt || !b.endAt || b.externalEventId) return;
  const externalId = await pushBookingEvent(b.creator, {
    title: `${b.product.title} · ${b.customer.name ?? b.customer.email}`,
    start: b.startAt,
    end: b.endAt,
    attendeeEmail: b.customer.email,
  });
  if (externalId) await prisma.booking.update({ where: { id: b.id }, data: { externalEventId: externalId } });
}
