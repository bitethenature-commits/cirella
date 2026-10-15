import "server-only";
import { asAccessMode, isNoChargeOrder } from "./access-mode";
import { prisma } from "./db";
import { dispatchEvents, recordEvents, type DomainEvent } from "./events";
import { hasBookingClash, isBookingOverlapError, isSlotAvailable } from "./booking";
import { dac7SalesPaused } from "./dac7-data";
import { appUrl, isDemoMode } from "./env";
import { canInvoiceSale, issueSaleInvoiceTx } from "./invoices/issue";
import { getPlatformIssuer } from "./invoices/issuer";
import { legalIdentityComplete } from "./legal";
import { NO_ONLINE_PAYMENTS, paidCheckoutOpen, paymentProvider, type PaymentMethodInput } from "./payments";
import { canAcceptPayments } from "./payouts";
import { canSellType, effectiveCommissionBps } from "./plans";
import { pushBookingEvent } from "./calendar";
import { captureAlert, captureError } from "./monitoring";
import { chargeKey } from "./reliability";
import { computeSaleAmounts, decideTax, platformRetainedCents } from "./tax";
import { getTaxMode } from "./tax/server";
import type { ProductType } from "./types";

export class CheckoutError extends Error {}

/**
 * Producto visible para comprar: de pago en la web (accessMode PAID), publicado, creadora activa y
 * publicada, y su plan lo permite. Lo gratuito con email y lo que se paga fuera no tienen checkout
 * (lib/free-access.ts). Que se pueda pagar ya (cobros activados, datos de DAC7) lo comprueba createPendingOrder.
 */
export async function getPurchasableProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { creator: { include: { plan: true } } },
  });
  if (!product || product.status !== "PUBLISHED" || asAccessMode(product.accessMode) !== "PAID") return null;
  const c = product.creator;
  if (c.status !== "ACTIVE" || !c.published) return null;
  if (!canSellType(c.plan, product.type as ProductType)) return null;
  return product;
}

/**
 * Paso 1: crea el pedido pendiente (permite medir abandonos y recuperarlos). Guarda la instantánea
 * fiscal de la venta (lib/tax): quién vende a efectos de IVA, país, tipo e IVA incluido en el precio.
 */
export async function createPendingOrder(input: {
  productId: string;
  buyerEmail: string;
  buyerName: string;
  slotStart?: string | null;
  visitorId?: string | null;
  /** HMAC de la IP de quien paga (límites y antiabuso del email de recuperación); nunca la IP. */
  ipHash?: string | null;
  source?: string | null;
  /** País de residencia declarado en el checkout (decide el IVA cuando vende Cirella). */
  buyerCountry?: string | null;
  /** País según la IP (segunda prueba de localización). */
  ipCountry?: string | null;
  /** «Necesito factura con mi NIF» (NIF ya normalizado y validado). */
  billing?: { name: string; taxId: string; address: string } | null;
}) {
  // Modo personal o sin pasarela (PAYMENT_PROVIDER=none): no hay compras en la web, se cierra aquí.
  if (!paidCheckoutOpen()) throw new CheckoutError(NO_ONLINE_PAYMENTS);
  const product = await getPurchasableProduct(input.productId);
  if (!product) throw new CheckoutError("Este producto no está disponible ahora mismo.");
  if (!canAcceptPayments(product.creator)) throw new CheckoutError("La creadora todavía no ha activado los pagos.");
  // Sin la identidad legal de quien vende no se vende (LSSI art. 10; lib/legal.ts).
  if (!legalIdentityComplete(product.creator)) throw new CheckoutError("La creadora todavía no ha activado los pagos.");
  if (await dac7SalesPaused(product.creator, product.type))
    throw new CheckoutError("Este servicio no está disponible temporalmente. Vuelve a intentarlo en unos días.");
  if (product.type === "SESSION" && input.slotStart) {
    if (!(await isSlotAvailable(product, input.slotStart)))
      throw new CheckoutError("Ese horario acaba de ocuparse. Elige otro, por favor.");
  }
  const tax = decideTax({
    mode: await getTaxMode(),
    productType: product.type,
    deliveryMode: product.deliveryMode,
    buyerCountry: input.buyerCountry ?? null,
    creator: { country: product.creator.legalCountry, vatStatus: product.creator.vatStatus, vatExemptionNote: product.creator.vatExemptionNote },
  });
  // Si vende Cirella tiene que poder facturar: sin sus datos fiscales no se vende (fuera de la demo).
  if (tax.seller === "PLATFORM" && !isDemoMode() && !(await getPlatformIssuer()).complete)
    throw new CheckoutError("Las compras no están disponibles en este momento.");
  const commissionBps = effectiveCommissionBps(product.creator.plan, product.creator);
  const amounts = computeSaleAmounts(product.priceCents, commissionBps, tax);
  // Sin factura posible (vende una creadora que no repercute IVA) no se guardan datos de facturación.
  const billing = input.billing && canInvoiceSale(tax.seller, product.creator) ? input.billing : null;
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
      platformFeeCents: amounts.platformFeeCents,
      netCents: amounts.netCents,
      taxSeller: tax.seller,
      taxCountry: tax.country,
      taxRateBps: amounts.taxRateBps,
      taxCents: amounts.taxCents,
      buyerCountry: input.buyerCountry ?? null,
      ipCountry: input.ipCountry ?? null,
      billingName: billing?.name ?? null,
      billingTaxId: billing?.taxId ?? null,
      billingAddress: billing?.address ?? null,
      paymentProvider: paymentProvider().key,
      metadata: input.slotStart ? { slotStart: input.slotStart } : undefined,
      visitorId: input.visitorId ?? null,
      ipHash: input.ipHash ?? null,
      source: input.source ?? null,
    },
  });
}

export type StartOrderPaymentResult =
  | { kind: "paid"; userId: string; isNewUser: boolean }
  | { kind: "redirect"; url: string }
  | { kind: "processing" }
  | { kind: "failed"; error: string };

/** Estados desde los que un pedido se puede (volver a) pagar. */
const PAYABLE = ["PENDING", "FAILED", "ABANDONED"];

/**
 * Paso 2: inicia el pago con la pasarela.
 *   · paid: cobrado al momento (simulador) y ya entregado.
 *   · redirect: la compradora sigue en la página de pago de Stripe o en la de su banco; la entrega
 *     llega por el aviso de la pasarela o al volver (lib/payments/events.ts).
 *   · processing: el banco aún no ha confirmado («pago pendiente»).
 *   · failed: rechazado; el pedido queda FAILED y se puede reintentar.
 */
export async function startOrderPayment(orderId: string, payment: PaymentMethodInput): Promise<StartOrderPaymentResult> {
  if (!paidCheckoutOpen()) throw new CheckoutError(NO_ONLINE_PAYMENTS);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { creator: true, product: { select: { slug: true } } } });
  if (isNoChargeOrder(order)) throw new CheckoutError("Este pedido no se paga.");
  if (order.status === "PAID") {
    const r = await fulfillOrder(order.id, order.paymentRef ?? "");
    return { kind: "paid", userId: r.userId, isNewUser: r.isNewUser };
  }
  if (order.status === "PROCESSING") throw new CheckoutError("Tu pago se está confirmando. Te avisaremos por email.");
  if (!PAYABLE.includes(order.status)) throw new CheckoutError("Este pedido ya no se puede pagar.");
  // Los consentimientos se guardan en el pedido antes de cobrar (acción del checkout).
  if (!order.termsAcceptedAt) throw new CheckoutError("Acepta las condiciones de venta para continuar");
  if (order.productType === "MEMBERSHIP") {
    // Una suscripción viva por persona y membresía (también con una renovación pendiente de pago).
    const existingSub = await prisma.subscription.findFirst({
      where: { productId: order.productId, status: { in: ["ACTIVE", "PAST_DUE"] }, customer: { email: order.buyerEmail } },
    });
    if (existingSub)
      throw new CheckoutError(
        existingSub.cancelAtPeriodEnd
          ? "Ya eres miembro. Puedes reactivar tu suscripción desde tu cuenta."
          : "Ya eres miembro de esta comunidad. Entra desde tu cuenta.",
      );
  }
  const provider = paymentProvider();
  if (!order.creator.payoutAccountId || !canAcceptPayments(order.creator, provider.key))
    throw new CheckoutError("La creadora todavía no ha activado los pagos.");
  // Un checkout anterior de este pedido que siga abierto se cancela: así no se puede pagar dos veces.
  if (order.checkoutRef) await provider.cancelCheckout(order.checkoutRef).catch((e) => captureError(e, { area: "checkout", extra: { orderId } }));

  const result = await provider.startPayment({
    orderId: order.id,
    amountCents: order.amountCents,
    currency: order.currency,
    description: order.productTitle,
    customerEmail: order.buyerEmail,
    // Comisión y, si vende Cirella, también el IVA: ese dinero no es de la creadora.
    platformFeeCents: platformRetainedCents(order),
    destinationAccount: order.creator.payoutAccountId,
    statementSuffix: order.creator.username.toUpperCase(),
    saveForFutureUse: order.productType === "MEMBERSHIP",
    payment,
    returnUrl: `${appUrl()}/api/payments/return?ref={REF}`,
    cancelUrl: `${appUrl()}/${order.creator.username}/${order.product.slug}/checkout?pedido=${order.id}&cancelado=1`,
    metadata: { orderId: order.id, creatorId: order.creatorId },
  });

  switch (result.state) {
    case "failed":
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED", paymentError: result.error } });
      return { kind: "failed", error: result.error };
    case "requires_action":
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "PENDING", checkoutRef: result.checkoutRef, checkoutExpiresAt: result.expiresAt, paymentError: null },
      });
      return { kind: "redirect", url: result.redirectUrl };
    case "processing":
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "PROCESSING", paymentRef: result.ref, checkoutRef: result.checkoutRef ?? order.checkoutRef, paymentError: null },
      });
      return { kind: "processing" };
    case "succeeded": {
      // El cobro queda anotado antes de entregar: si la entrega falla tras cobrar, el vigilante
      // del cron (lib/watchdog.ts) la reintenta a partir de Order.chargedAt.
      await prisma.order.update({ where: { id: order.id }, data: { chargedAt: new Date(), paymentRef: result.ref } });
      try {
        const r = await fulfillOrder(order.id, result.ref, { customerRef: result.customerRef, paymentMethodRef: result.paymentMethodRef });
        return { kind: "paid", userId: r.userId, isNewUser: r.isNewUser };
      } catch (e) {
        captureError(e, { area: "checkout", extra: { orderId: order.id } });
        throw e;
      }
    }
  }
}

function addInterval(date: Date, interval: string) {
  const d = new Date(date);
  if (interval === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** Referencias de la tarjeta guardada (membresías) que devuelve la pasarela al cobrar. */
type SavedPayment = { customerRef?: string; paymentMethodRef?: string };

/** Pedidos que se pueden entregar. PAID, REFUNDED (y los estados de reembolso) nunca se entregan otra vez. */
const FULFILLABLE = ["PENDING", "PROCESSING", "FAILED", "ABANDONED"];

/**
 * Entrega automática. Idempotente también cuando dos llamadas coinciden (el aviso de la pasarela y
 * la vuelta de la compradora): solo una entrega y la otra recibe `alreadyPaid: true`.
 * Marca el pedido como pagado, registra la transacción y concede el acceso
 * según el tipo de producto (descarga, curso, reserva o suscripción).
 *
 * Los pedidos sin cobro (gratis con email o acceso dado a mano, lib/free-access.ts) pasan por aquí
 * igual, pero sin transacción de cobro, factura ni suscripción: el acceso no caduca y no se renueva.
 */
export async function fulfillOrder(orderId: string, paymentRef: string, opts: SavedPayment = {}) {
  const events: DomainEvent[] = [];
  let result: Awaited<ReturnType<typeof fulfillInTransaction>>;
  try {
    result = await fulfillInTransaction(orderId, paymentRef, opts, events, { confirmSlot: true });
  } catch (e) {
    // La regla Booking_no_overlap de la BD ha rechazado la reserva (otra compra confirmó el
    // mismo hueco por un camino sin cerrojo): la venta sigue adelante y la reserva queda
    // pendiente de elegir fecha, igual que cuando el hueco ya estaba ocupado.
    if (!isBookingOverlapError(e)) throw e;
    result = await fulfillInTransaction(orderId, paymentRef, opts, events, { confirmSlot: false });
  }

  // Los avisos (recibo, acceso, reserva, calendario) se guardan en la misma transacción que el
  // pedido y se envían ya, tras el commit. Si el proceso cae justo después, /api/cron los envía.
  const { eventIds, duplicateMembership, ...fulfilled } = result;
  await dispatchEvents(eventIds);
  if (duplicateMembership) await refundDuplicateMembership(orderId);
  return fulfilled;
}

/**
 * Segunda membresía pagada para alguien que ya tiene una viva: se devuelve entera por el flujo
 * normal de reembolsos (libro, rectificativa y email a la compradora). Si la pasarela falla, aviso
 * a administración: el pedido ya está pagado y no se vuelve a intentar solo.
 */
async function refundDuplicateMembership(orderId: string) {
  captureAlert("Membresía pagada dos veces por la misma persona: se reembolsa el segundo pedido", {
    area: "payments",
    level: "warning",
    fingerprint: ["membresia-duplicada"],
    extra: { orderId },
  });
  try {
    const { refundOrder } = await import("./refunds");
    const r = await refundOrder({
      orderId,
      actor: { kind: "provider" },
      reason: "DUPLICATE",
      note: "Ya eras miembro: te devolvemos este segundo pago.",
      revokeAccess: false,
      cancelBooking: false,
    });
    if (!r.ok) throw new Error(r.error);
  } catch (e) {
    captureAlert("No se ha podido reembolsar una membresía duplicada", { area: "payments", level: "error", fingerprint: ["membresia-duplicada-sin-reembolso"], extra: { orderId, error: String(e) } });
  }
}

async function fulfillInTransaction(orderId: string, paymentRef: string, saved: SavedPayment, events: DomainEvent[], opts: { confirmSlot: boolean }) {
  // Tiempo máximo amplio (15 s): con dos compras a la vez de la misma creadora, la segunda
  // espera el cerrojo de reservas (hasBookingClash) hasta que la primera termina.
  return prisma.$transaction(async (tx) => {
    events.length = 0;
    // Bloquea la fila del pedido: dos entregas simultáneas (aviso de la pasarela + vuelta de la
    // compradora, o el vigilante) se ponen en fila y la segunda, al leerlo ya PAID, no hace nada.
    // En Postgres (READ COMMITTED) la segunda espera aquí a que la primera haga commit.
    // La clave única charge:{orderId} es la última red.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { product: true } });
    const existingUser = await tx.user.findUnique({ where: { email: order.buyerEmail } });
    if (!FULFILLABLE.includes(order.status)) {
      return { order, userId: existingUser?.id ?? "", isNewUser: false, alreadyPaid: true, duplicateMembership: false, eventIds: [] as string[] };
    }
    const now = new Date();
    // 0 €, sin cobro (lib/access-mode.ts): ni transacción, ni factura, ni suscripción que renovar.
    const noCharge = isNoChargeOrder(order);
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
        // Novedades por email: solo con la casilla marcada en el checkout (RGPD art. 7).
        marketingOptIn: order.marketingOptIn,
        marketingOptInAt: order.marketingOptIn ? now : null,
      },
      update: {
        totalSpentCents: { increment: order.amountCents },
        ordersCount: { increment: 1 },
        lastPurchaseAt: now,
        name: prevCustomer?.name ?? order.buyerName ?? user.name,
        // Una compra sin la casilla no retira un consentimiento anterior: solo se retira desde /cuenta/perfil.
        ...(order.marketingOptIn && !prevCustomer?.marketingOptIn ? { marketingOptIn: true, marketingOptInAt: now } : {}),
      },
    });
    if (!prevCustomer) events.push({ type: "customer.created", customerId: customer.id });

    const paid = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: now,
        paymentRef: noCharge ? null : paymentRef,
        paymentError: null,
        chargedAt: order.chargedAt ?? now,
        customerId: customer.id,
        createdBuyerAccount: !existingUser,
      },
      include: { product: true },
    });
    const charge = noCharge
      ? null
      : await tx.transaction.create({
        data: {
          creatorId: order.creatorId,
          orderId: order.id,
          type: "CHARGE",
          description: order.productTitle,
          amountCents: order.amountCents,
          platformFeeCents: order.platformFeeCents,
          netCents: order.netCents,
          currency: order.currency,
          taxSeller: order.taxSeller,
          taxCountry: order.taxCountry,
          taxRateBps: order.taxRateBps,
          taxCents: order.taxCents,
          provider: order.paymentProvider,
          providerRef: paymentRef,
          idempotencyKey: chargeKey(order.id),
        },
      });
    // Factura (o nada: justificante) en la misma transacción que el cobro: numeración sin huecos.
    if (charge) await issueSaleInvoiceTx(tx, { transactionId: charge.id });

    const p = order.product;
    let subscriptionId: string | null = null;
    let expiresAt: Date | null = null;
    // Una suscripción viva por persona y membresía. startOrderPayment ya lo comprueba antes de
    // cobrar, pero dos páginas de pago abiertas (dos pestañas, o un pedido sustituido) pueden
    // cobrarse las dos: la segunda no crea otra suscripción (se renovarían las dos cada mes); el
    // pedido queda pagado y fulfillOrder lo reembolsa entero.
    // Sin cobro no hay nada que reembolsar: si ya tenía una suscripción viva, se queda con su acceso.
    const liveMembership =
      p.type === "MEMBERSHIP" &&
      !!(await tx.subscription.findFirst({ where: { productId: p.id, customerId: customer.id, status: { in: ["ACTIVE", "PAST_DUE"] } }, select: { id: true } }));
    const duplicateMembership = liveMembership && !noCharge;
    if (p.type === "MEMBERSHIP" && !duplicateMembership && !noCharge) {
      const end = addInterval(now, p.billingInterval ?? "month");
      const sub = await tx.subscription.create({
        data: {
          creatorId: order.creatorId,
          productId: p.id,
          customerId: customer.id,
          userId: user.id,
          orderId: order.id,
          buyerCountry: order.buyerCountry,
          priceCents: order.amountCents,
          interval: p.billingInterval ?? "month",
          currentPeriodStart: now,
          currentPeriodEnd: end,
          provider: order.paymentProvider,
          providerRef: paymentRef,
          providerCustomerRef: saved.customerRef ?? null,
          providerPaymentMethodRef: saved.paymentMethodRef ?? null,
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
    // El acceso de una membresía duplicada sigue siendo el de la suscripción que ya tenía.
    if (!liveMembership)
      await tx.access.upsert({
        where: { userId_productId: { userId: user.id, productId: p.id } },
        create: { creatorId: order.creatorId, userId: user.id, productId: p.id, orderId: order.id, subscriptionId, expiresAt },
        update: { status: "ACTIVE", orderId: order.id, subscriptionId, expiresAt },
      });
    // Métricas: una compra es PURCHASE; quien se apunta gratis con el formulario, SIGNUP (se cuenta
    // aparte, lib/stats.ts). El acceso que da la dueña a mano no es una conversión de la página.
    if (order.paymentProvider !== "manual")
      await tx.analyticsEvent.create({
        data: {
          creatorId: order.creatorId,
          type: noCharge ? "SIGNUP" : "PURCHASE",
          productId: p.id,
          visitorId: order.visitorId ?? `user:${user.id}`,
          source: order.source,
          amountCents: order.amountCents,
        },
      });
    events.unshift({ type: "order.paid", orderId: order.id });
    const eventIds = await recordEvents(tx, events);
    return { order: paid, userId: user.id, isNewUser: !existingUser, alreadyPaid: false, duplicateMembership, eventIds };
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
