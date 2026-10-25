import "server-only";
import { asAccessMode, isNoChargeOrder } from "./access-mode";
import { prisma } from "./db";
import { dispatchEvents, recordEvents, type DomainEvent } from "./events";
import { accessUntil } from "./free-access-rules";
import { hasBookingClash, isBookingOverlapError, isGroupSession, isSlotAvailable, lockCreatorBookings, lockProductSeats, seatsTaken } from "./booking";
import { dac7SalesPaused } from "./dac7-data";
import { appUrl, isDemoMode } from "./env";
import { canInvoiceSale, issueSaleInvoiceTx } from "./invoices/issue";
import { getPlatformIssuer } from "./invoices/issuer";
import { legalIdentityComplete, WAIVER_TEXT, waiverKindFor } from "./legal";
import { WAIVER_REQUIRED_ERROR } from "./checkout-consents";
import { NO_ONLINE_PAYMENTS, chooseCheckoutProvider, isPaymentProviderEnabled, paidCheckoutOpen, paymentProviderByKey, type PaymentMethodInput } from "./payments";
import { canAcceptPayments, chargeDestination } from "./payouts";
import { syncConsent } from "./newsletter";
import { isPersonalMode } from "./site-mode";
import { canSellType, effectiveCommissionBps } from "./plans";
import { pushBookingEvent } from "./calendar";
import { captureAlert, captureError } from "./monitoring";
import { chargeKey } from "./reliability";
import { computeSaleAmounts, decideTax, platformRetainedCents } from "./tax";
import { getTaxMode } from "./tax/server";
import type { ProductType } from "./types";
import type { IntakeAnswers } from "./intake";
import { canonicalTimezone } from "./timezones";
import { Prisma } from "@prisma/client";

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
  // Un taller ya empezado (o sin fecha) no se vende.
  if (isGroupSession(product) && (!product.eventStartAt || product.eventStartAt <= new Date())) return null;
  return product;
}

/** Lo que guarda Order.metadata de una sesión. ownerPlaced y manual solo cuentan en pedidos «manual». */
export type SessionOrderMeta = { slotStart?: string; buyerTz?: string; ownerPlaced?: boolean; manual?: string; message?: string };

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
  /** Pasarela elegida en el checkout (tarjeta o PayPal). Sin elegir, la principal. */
  paymentMethod?: string | null;
  /** Zona horaria del navegador de la compradora (sesiones): sus emails y su área le enseñan su hora. */
  buyerTimezone?: string | null;
  /** Datos para la lectura, ya validados con la configuración del producto (lib/intake.ts). */
  intake?: IntakeAnswers | null;
}) {
  // Sin pasarela (PAYMENT_PROVIDER=none): no hay compras en la web, se cierra aquí.
  if (!paidCheckoutOpen()) throw new CheckoutError(NO_ONLINE_PAYMENTS);
  const providerKey = chooseCheckoutProvider(input.paymentMethod);
  if (!providerKey) throw new CheckoutError("Ese método de pago no está disponible. Elige otro.");
  const product = await getPurchasableProduct(input.productId);
  if (!product) throw new CheckoutError("Este producto no está disponible ahora mismo.");
  if (!canAcceptPayments(product.creator, providerKey)) throw new CheckoutError("La creadora todavía no ha activado los pagos.");
  // Sin la identidad legal de quien vende no se vende (LSSI art. 10; lib/legal.ts).
  if (!legalIdentityComplete(product.creator)) throw new CheckoutError("La creadora todavía no ha activado los pagos.");
  if (await dac7SalesPaused(product.creator, product.type))
    throw new CheckoutError("Este servicio no está disponible temporalmente. Vuelve a intentarlo en unos días.");
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
  // La web personal cobra con las cuentas de la dueña: sin comisión, sea cual sea su plan.
  const commissionBps = isPersonalMode() ? 0 : effectiveCommissionBps(product.creator.plan, product.creator);
  const amounts = computeSaleAmounts(product.priceCents, commissionBps, tax);
  // Sin factura posible (vende una creadora que no repercute IVA) no se guardan datos de facturación.
  const billing = input.billing && canInvoiceSale(tax.seller, product.creator) ? input.billing : null;
  const group = isGroupSession(product);
  const slotStart = product.type === "SESSION" && !group ? input.slotStart || null : null;
  const buyerTz = product.type === "SESSION" ? canonicalTimezone(input.buyerTimezone) : null;
  const metadata: SessionOrderMeta = { ...(slotStart ? { slotStart } : {}), ...(buyerTz ? { buyerTz } : {}) };
  // La comprobación del hueco (o de las plazas) y el pedido van juntos bajo el cerrojo: en la web
  // personal el pedido guarda la hora mientras se paga, así que dos personas no pagan la misma.
  return prisma.$transaction(async (tx) => {
    if (group) {
      await lockProductSeats(tx, product.id);
      if (product.capacity != null && (await seatsTaken(tx, product.id)) >= product.capacity) throw new CheckoutError("No quedan plazas en este taller.");
    } else if (slotStart) {
      await lockCreatorBookings(tx, product.creatorId);
      if (!(await isSlotAvailable(product, slotStart, { client: tx }))) throw new CheckoutError("Ese horario acaba de ocuparse. Elige otro, por favor.");
    }
    return tx.order.create({
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
      paymentProvider: providerKey,
      metadata: Object.keys(metadata).length ? metadata : undefined,
      intake: input.intake ? (input.intake as unknown as Prisma.InputJsonObject) : undefined,
      intakeUpdatedAt: input.intake ? new Date() : null,
      visitorId: input.visitorId ?? null,
      ipHash: input.ipHash ?? null,
      source: input.source ?? null,
    },
  });
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
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { creator: true, product: { select: { slug: true, deliveryMode: true, groupSession: true, eventStartAt: true } } },
  });
  if (isNoChargeOrder(order)) throw new CheckoutError("Este pedido no se paga.");
  if (order.status === "PAID") {
    const r = await fulfillOrder(order.id, order.paymentRef ?? "");
    return { kind: "paid", userId: r.userId, isNewUser: r.isNewUser };
  }
  if (order.status === "PROCESSING") throw new CheckoutError("Tu pago se está confirmando. Te avisaremos por email.");
  if (!PAYABLE.includes(order.status)) throw new CheckoutError("Este pedido ya no se puede pagar.");
  // Los consentimientos se guardan en el pedido antes de cobrar (acción del checkout).
  if (!order.termsAcceptedAt) throw new CheckoutError("Acepta las condiciones de venta para continuar");
  // La renuncia al desistimiento obligatoria (todo lo de pago que no es una sesión en directo y los
  // talleres a menos de 15 días) tiene que estar guardada con el texto vigente, sea cual sea la
  // pasarela (tarjeta, PayPal, simulador) y también en las membresías.
  const waiver = waiverKindFor(order.productType, order.product.deliveryMode, {
    groupSession: order.product.groupSession,
    eventStartAt: order.product.eventStartAt,
    now: new Date(),
    timezone: order.creator.timezone,
  });
  if (waiver && (!order.waiverAcceptedAt || order.waiverKind !== waiver || order.waiverText !== WAIVER_TEXT[waiver]))
    throw new CheckoutError(WAIVER_REQUIRED_ERROR[waiver]);
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
  // Cada pedido se cobra con la pasarela que eligió la compradora (si se desactivó, pedido nuevo).
  if (!isPaymentProviderEnabled(order.paymentProvider)) throw new CheckoutError("Ese método de pago ya no está disponible. Elige otro.");
  const provider = paymentProviderByKey(order.paymentProvider);
  const target = chargeDestination(order.creator, provider.key);
  if (!target) throw new CheckoutError("La creadora todavía no ha activado los pagos.");
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
    destinationAccount: target.destination,
    statementSuffix: order.creator.username.toUpperCase(),
    saveForFutureUse: order.productType === "MEMBERSHIP",
    payment,
    returnUrl: `${appUrl()}/api/payments/return?via=${provider.key}&ref={REF}`,
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
    // El nombre del formulario gratis lo escribe cualquiera con cualquier email: no se pone en una
    // cuenta que ya existía (sí en la ficha de clienta de esta creadora).
    if (existingUser && !existingUser.name && order.buyerName && order.paymentProvider !== "free")
      await tx.user.update({ where: { id: user.id }, data: { name: order.buyerName } });
    // Novedades: solo con la casilla marcada en el checkout (RGPD art. 7). En el formulario gratis
    // no hay pago que demuestre quién escribe el email: se confirman desde el email
    // (lib/free-access.ts, confirmNewsletter), nunca aquí.
    const optIn = order.marketingOptIn && order.paymentProvider !== "free";

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
        marketingOptIn: optIn,
        marketingOptInAt: optIn ? now : null,
      },
      update: {
        totalSpentCents: { increment: order.amountCents },
        ordersCount: { increment: 1 },
        lastPurchaseAt: now,
        name: prevCustomer?.name ?? order.buyerName ?? user.name,
        // Una compra sin la casilla no retira un consentimiento anterior: solo se retira desde /cuenta/perfil.
        ...(optIn && !prevCustomer?.marketingOptIn ? { marketingOptIn: true, marketingOptInAt: now } : {}),
      },
    });
    if (!prevCustomer) events.push({ type: "customer.created", customerId: customer.id });
    if (optIn)
      await syncConsent(tx, {
        creatorId: order.creatorId,
        email: user.email,
        name: customer.name,
        on: true,
        source: "CHECKOUT",
        sourceRef: order.id,
        consentText: "Casilla «Quiero recibir novedades» marcada al pagar",
        form: "checkout",
      });

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
    // Acceso dado a mano con fecha de fin (lib/free-access.ts): termina solo ese día.
    let expiresAt: Date | null = noCharge ? accessUntil(order.metadata) : null;
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
      const meta = (order.metadata ?? {}) as SessionOrderMeta;
      // Lo que la dueña decide al dar una sesión a mano solo vale en pedidos «manual»: el checkout
      // nunca escribe esas claves, pero tampoco se leen en un pedido de pago.
      const manual = order.paymentProvider === "manual";
      const ownerPlaced = manual && !!meta.ownerPlaced;
      const customerTimezone = canonicalTimezone(meta.buyerTz);
      let status = "PENDING_SCHEDULE";
      let start: Date | null = null;
      let groupSeat = false;
      if (isGroupSession(p)) {
        // Plaza de un taller: siempre se confirma (nunca se rechaza una plaza pagada). Si una carrera
        // supera el aforo, la dueña lo ve en su aviso y en la lista de asistentes.
        groupSeat = true;
        if (p.eventStartAt) {
          status = "CONFIRMED";
          start = p.eventStartAt;
        } else captureAlert("Plaza de un taller sin fecha: queda pendiente", { area: "payments", level: "warning", fingerprint: ["taller-sin-fecha"], extra: { orderId } });
      } else {
        const slotStart = meta.slotStart;
        const wanted = slotStart ? new Date(slotStart) : null;
        // Bajo el cerrojo de reservas de la creadora (lo toma hasBookingClash): el hueco no
        // choca con otra reserva ni con un taller y sigue dentro de su horario (salvo una hora que
        // la dueña puso a mano). Si otra compra lo ha ocupado mientras tanto, esta reserva queda
        // pendiente de elegir fecha. La antelación mínima cuenta desde que se hizo el pedido.
        const stillFree =
          opts.confirmSlot &&
          !!slotStart &&
          !!wanted &&
          !Number.isNaN(wanted.getTime()) &&
          !(await hasBookingClash(tx, order.creatorId, wanted, new Date(wanted.getTime() + (p.durationMin ?? 60) * 60000), p.bufferMin ?? 15)) &&
          (ownerPlaced ? wanted > now : await isSlotAvailable(p, slotStart, { client: tx, ignoreOrderId: order.id, noticeFrom: order.createdAt }));
        if (wanted && stillFree) {
          status = "CONFIRMED";
          start = wanted;
        }
      }
      const booking = await tx.booking.create({
        data: {
          creatorId: order.creatorId,
          productId: p.id,
          customerId: customer.id,
          userId: user.id,
          orderId: order.id,
          status,
          startAt: start,
          endAt: start ? new Date(start.getTime() + (p.durationMin ?? 60) * 60000) : null,
          meetingUrl: p.meetingUrl,
          customerTimezone,
          groupSeat,
        },
      });
      events.push({ type: "booking.confirmed", bookingId: booking.id, change: manual ? "manual" : "new" });
    }
    // El acceso de una membresía duplicada sigue siendo el de la suscripción que ya tenía. Sin cobro,
    // la suscripción viva solo cuenta si su acceso sigue vigente: en la web sin pasarela (modo
    // personal) no se renueva y su acceso caduca aunque siga ACTIVE; entonces vale el acceso gratis.
    const keepCurrentAccess =
      liveMembership &&
      (!noCharge ||
        !!(await tx.access.findFirst({
          where: { userId: user.id, productId: p.id, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: { id: true },
        })));
    if (!keepCurrentAccess)
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

/**
 * Los datos para la lectura de un pedido que nunca se pagó no se guardan más de 30 días (RGPD:
 * minimización). Devuelve cuántos pedidos se han limpiado.
 */
export async function purgeAbandonedIntake(now: Date = new Date()) {
  const r = await prisma.order.updateMany({
    where: { status: { in: ["PENDING", "FAILED", "ABANDONED"] }, createdAt: { lt: new Date(now.getTime() - 30 * 86400_000) }, NOT: { intake: { equals: Prisma.DbNull } } },
    data: { intake: Prisma.DbNull, intakeUpdatedAt: null },
  });
  return r.count;
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
