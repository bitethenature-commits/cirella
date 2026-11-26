import { productPath } from "@/lib/public-paths";
import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { appUrl } from "../env";
import { enqueueEmail } from "../email/outbox";
import { disputeOpenedEmail, paymentFailedEmail } from "../email/templates";
import { noteCheckoutFailure } from "../limits";
import { formatPrice } from "../money";
import { captureAlert, captureError } from "../monitoring";
import { fulfillOrder } from "../orders";
import { syncPayoutAccount } from "../payouts";
import { findRenewalCharge, syncProviderRefund } from "../refunds";
import { truncateError } from "../reliability";
import { recordRenewalFailure, settleRenewalCharge } from "../subscriptions";
import { isPaymentProviderEnabled, paymentProvider, paymentProviderByKey } from "./index";
import { renewalPeriodKey } from "./renewal";
import { WebhookSignatureError, type PaymentState, type PaymentStatus, type PaymentUpdate } from "./provider";
import { inMail } from "@/lib/i18n/email";

/**
 * Lo que dice la pasarela → cambios en Cirella. Es la única puerta: los webhooks de Stripe y PayPal,
 * la vuelta de la compradora (/api/payments/return) y las páginas del simulador acaban en applyPaymentUpdate.
 * Todo es idempotente (los avisos se repiten y llegan desordenados) y nunca se entrega un pago
 * cuyo importe, moneda o cuenta de destino no coincide con el pedido.
 */

export const AMOUNT_MISMATCH = "IMPORTE_O_CUENTA_NO_COINCIDE";

/** Pedidos ya cobrados: un segundo cobro para ellos es un duplicado y se devuelve. */
const SETTLED = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"];

/** state: el estado del pago ya aplicado (tras cobrarlo, si estaba aprobado sin cobrar). */
type Applied = { orderId?: string; creatorId?: string; ignored?: boolean; state?: PaymentState };

export async function applyPaymentUpdate(u: PaymentUpdate, providerKey: string): Promise<Applied> {
  switch (u.kind) {
    case "payment": {
      let status = u.status;
      // Aprobado y sin cobrar (PayPal): se cobra solo si el pedido sigue esperando este pago.
      if (status.approved) {
        const completed = await completeApprovedCheckout(status, providerKey);
        if (!completed) return { ignored: true };
        status = completed;
      }
      if (status.metadata.orderId) return { ...(await applyOrderPayment(status, providerKey)), state: status.state };
      if (status.metadata.subscriptionId) return { ...(await applySubscriptionPayment(status, providerKey)), state: status.state };
      return { ignored: true };
    }
    case "refund": {
      // Reembolsos pedidos desde Cirella (cambian de estado) o hechos desde el panel de Stripe.
      const r = await syncProviderRefund({
        provider: providerKey,
        paymentRef: u.paymentRef,
        providerRef: u.refundRef,
        refundId: u.refundId,
        amountCents: u.amountCents,
        status: u.status,
      });
      return r ?? { ignored: true };
    }
    case "dispute":
      return applyDispute(u, providerKey);
    case "account": {
      const status = await syncPayoutAccount(u.accountId);
      return status ? {} : { ignored: true };
    }
    case "ignored":
      return { ignored: true };
  }
}

/**
 * Cobra un pago que la compradora ya aprobó en la pasarela (PayPal) si su pedido de la web sigue
 * esperándolo: mismo checkout, misma pasarela y sin pagar, ni sustituido por otro pedido (cambió de
 * método o de datos), ni una renovación ya cobrada por otra vía. Así no se cobra dos veces a quien
 * abandonó un pago y luego pagó de otra forma. null = no se cobra.
 */
async function completeApprovedCheckout(s: PaymentStatus, providerKey: string): Promise<PaymentStatus | null> {
  const provider = paymentProviderByKey(providerKey);
  if (!provider.completeCheckout || !s.checkoutRef) return null;
  if (s.metadata.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: s.metadata.orderId },
      select: { status: true, paymentProvider: true, checkoutRef: true, recoverySkipped: true },
    });
    if (!order || order.paymentProvider !== providerKey || order.checkoutRef !== s.checkoutRef) return null;
    const waiting = order.status === "PENDING" || (order.status === "ABANDONED" && order.recoverySkipped !== "sustituido");
    if (!waiting) return null;
  } else if (s.metadata.subscriptionId) {
    // «Pagar ahora» de una renovación: solo si ese periodo sigue pendiente.
    const sub = await prisma.subscription.findUnique({ where: { id: s.metadata.subscriptionId }, select: { status: true, provider: true, currentPeriodEnd: true } });
    if (!sub || sub.provider !== providerKey || sub.status !== "PAST_DUE" || renewalPeriodKey(sub.currentPeriodEnd) !== s.metadata.periodKey) return null;
  } else return null;
  return provider.completeCheckout(s.checkoutRef);
}

async function applyOrderPayment(s: PaymentStatus, providerKey: string): Promise<Applied> {
  const order = await prisma.order.findUnique({
    where: { id: s.metadata.orderId },
    include: { creator: { select: { payoutAccountId: true, username: true, displayName: true } }, product: { select: { slug: true, type: true } } },
  });
  if (!order) return { ignored: true };
  const ids = { orderId: order.id, creatorId: order.creatorId };

  // Guardián: el pago tiene que ser exactamente el de este pedido, con esta pasarela y hacia la
  // cuenta de esta creadora. Protege de metadatos manipulados y de cruzar pagos entre creadoras.
  const matches =
    order.paymentProvider === providerKey &&
    s.amountCents === order.amountCents &&
    s.currency.toUpperCase() === order.currency.toUpperCase() &&
    (s.destinationAccount == null || s.destinationAccount === order.creator.payoutAccountId);
  if (!matches) {
    captureAlert("Pago que no coincide con su pedido: no se entrega", {
      area: "payments",
      level: "error",
      fingerprint: ["pago-no-coincide"],
      extra: { orderId: order.id, ref: s.ref, amountCents: s.amountCents, currency: s.currency, destination: s.destinationAccount },
    });
    if (!SETTLED.includes(order.status)) await prisma.order.update({ where: { id: order.id }, data: { paymentError: AMOUNT_MISMATCH } });
    return ids;
  }

  if (s.state === "succeeded") {
    if (!s.ref) return ids;
    if (SETTLED.includes(order.status)) {
      if (order.paymentRef !== s.ref) await refundDuplicate(order.id, s.ref, providerKey);
      // Mismo cobro avisado otra vez (p. ej. payment_intent.succeeded tras checkout.session.completed):
      // si trae la tarjeta guardada y la membresía aún no la tenía, se completa. Sin ella las
      // renovaciones fallarían y la membresía acabaría cancelada.
      else if (s.paymentMethodRef)
        await prisma.subscription.updateMany({
          where: { orderId: order.id, providerPaymentMethodRef: null },
          data: { providerPaymentMethodRef: s.paymentMethodRef, ...(s.customerRef ? { providerCustomerRef: s.customerRef } : {}) },
        });
      return ids;
    }
    // Anotado antes de entregar: si la entrega falla, el vigilante del cron la reintenta.
    await prisma.order.updateMany({
      where: { id: order.id, status: { notIn: SETTLED }, chargedAt: null },
      data: { chargedAt: new Date(), paymentRef: s.ref },
    });
    const r = await fulfillOrder(order.id, s.ref, { customerRef: s.customerRef, paymentMethodRef: s.paymentMethodRef });
    // Otra llamada entregó el pedido a la vez con otro cobro: este segundo cobro se devuelve.
    if (r.alreadyPaid && r.order.paymentRef !== s.ref) await refundDuplicate(order.id, s.ref, providerKey);
    return ids;
  }

  // Aviso de un checkout anterior del mismo pedido (la compradora reintentó): no cambia nada.
  if (s.checkoutRef && order.checkoutRef && s.checkoutRef !== order.checkoutRef) return { ...ids, ignored: true };

  if (s.state === "processing") {
    await prisma.order.updateMany({
      where: { id: order.id, status: { in: ["PENDING", "FAILED", "ABANDONED"] } },
      data: { status: "PROCESSING", paymentRef: s.ref ?? order.paymentRef },
    });
    return ids;
  }

  if (s.state === "failed" || s.state === "canceled") {
    const error =
      s.error ?? (s.state === "canceled" ? "La página de pago ha caducado." : "Tu banco no ha confirmado el pago. No se te ha cobrado nada.");
    const c = await prisma.order.updateMany({ where: { id: order.id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "FAILED", paymentError: error } });
    // Un rechazo que llega por el aviso cuenta para los límites del checkout, con la IP de quien pagó.
    if (c.count && s.state === "failed") await noteCheckoutFailure({ email: order.buyerEmail, ipHash: order.ipHash });
    // Si estaba «pago pendiente», la compradora ya se fue confiando en que saldría bien: se le avisa.
    if (c.count && order.status === "PROCESSING")
      await enqueueEmail({
        to: order.buyerEmail,
        creatorId: order.creatorId,
        template: "PAYMENT_FAILED",
        dedupeKey: `payfail:${order.id}`,
        ...(await inMail(order.buyerEmail, () => paymentFailedEmail({
          creatorName: order.creator.displayName,
          productTitle: order.productTitle,
          retryUrl: `${appUrl()}${productPath(order.creator.username, order.product, "checkout")}?pedido=${order.id}`,
        }))),
      });
    return ids;
  }
  return ids; // requires_action: la compradora sigue en la página de pago
}

/** Segundo cobro para un pedido ya pagado (dos pestañas, doble clic…): se devuelve entero, por la pasarela que lo cobró. */
async function refundDuplicate(orderId: string, ref: string, providerKey: string) {
  captureAlert("Cobro duplicado de un pedido ya pagado: se reembolsa", { area: "payments", level: "error", fingerprint: ["cobro-duplicado"], extra: { orderId, ref } });
  const r = await paymentProviderByKey(providerKey).refund({ paymentRef: ref, refundApplicationFee: true, idempotencyKey: `dup:${ref}`, metadata: { orderId, reason: "duplicado" } });
  if (!r.ok) throw new Error(`No se ha podido reembolsar el cobro duplicado ${ref}: ${r.error}`);
}

/** Renovación pagada con la clienta delante («Pagar ahora») o confirmada más tarde por el banco. */
async function applySubscriptionPayment(s: PaymentStatus, providerKey: string): Promise<Applied> {
  const sub = await prisma.subscription.findUnique({
    where: { id: s.metadata.subscriptionId },
    include: { creator: { select: { payoutAccountId: true } } },
  });
  if (!sub) return { ignored: true };
  const ids = { creatorId: sub.creatorId };
  // La suscripción se cobra siempre por su pasarela: un pago de otra no es suyo.
  const matches =
    sub.provider === providerKey &&
    s.amountCents === sub.priceCents &&
    (s.destinationAccount == null || s.destinationAccount === sub.creator.payoutAccountId);
  if (!matches) {
    captureAlert("Renovación que no coincide con su suscripción", { area: "payments", level: "error", fingerprint: ["pago-no-coincide"], extra: { subscriptionId: sub.id, ref: s.ref } });
    return ids;
  }
  const periodEnd = new Date(s.metadata.periodKey ?? "");
  if (Number.isNaN(periodEnd.getTime())) return { ...ids, ignored: true };
  if (s.state === "succeeded" && s.ref) {
    await settleRenewalCharge(sub.id, periodEnd, s.ref, { customerRef: s.customerRef, paymentMethodRef: s.paymentMethodRef });
  } else if (s.state === "failed" && s.metadata.kind === "renewal") {
    // Solo los cobros automáticos cuentan como intento fallido; un «Pagar ahora» rechazado no.
    await recordRenewalFailure(sub.id, s.error ?? "Tu banco ha rechazado la renovación.", new Date(), {
      periodEnd,
      attempts: Number(s.metadata.attempt ?? sub.renewalAttempts),
    });
  }
  return ids;
}

async function applyDispute(u: Extract<PaymentUpdate, { kind: "dispute" }>, providerKey: string): Promise<Applied> {
  const order = await prisma.order.findFirst({ where: { paymentRef: u.paymentRef, paymentProvider: providerKey }, include: { creator: { include: { user: true } } } });
  if (!order) return applyRenewalDispute(u, providerKey);
  const ids = { orderId: order.id, creatorId: order.creatorId };
  await prisma.order.update({ where: { id: order.id }, data: { disputeStatus: u.status, disputedAt: order.disputedAt ?? new Date() } });
  if (u.status === "OPEN")
    await notifyDispute(u, {
      productTitle: order.productTitle,
      currency: order.currency,
      buyer: order.buyerName || order.buyerEmail,
      creator: { id: order.creatorId, userId: order.creator.userId, email: order.creator.user.email },
    });
  // Contracargo perdido: el banco ya le ha devuelto el dinero; se registra como reembolso.
  if (u.status === "LOST") {
    await syncProviderRefund({
      provider: order.paymentProvider,
      paymentRef: u.paymentRef,
      providerRef: u.disputeRef,
      amountCents: u.amountCents,
      status: "succeeded",
      reason: "DISPUTE_LOST",
    });
    await recoverLostDispute(u, order.paymentProvider, { orderId: order.id });
  }
  return ids;
}

/** Contracargo de una renovación de membresía: su cobro no tiene pedido, se busca en el libro. */
async function applyRenewalDispute(u: Extract<PaymentUpdate, { kind: "dispute" }>, provider: string): Promise<Applied> {
  const renewal = await findRenewalCharge(provider, u.paymentRef);
  if (!renewal) {
    captureAlert("Contracargo de un cobro que no es de ningún pedido ni renovación", {
      area: "payments",
      level: "error",
      fingerprint: ["contracargo-desconocido"],
      extra: { paymentRef: u.paymentRef, disputeRef: u.disputeRef, status: u.status },
    });
    return { ignored: true };
  }
  const ids = { creatorId: renewal.creatorId };
  if (u.status === "OPEN") {
    const sub = renewal.subscriptionId
      ? await prisma.subscription.findUnique({ where: { id: renewal.subscriptionId }, include: { product: { select: { title: true } }, customer: true } })
      : null;
    await notifyDispute(u, {
      productTitle: `Renovación · ${sub?.product.title ?? "membresía"}`,
      currency: renewal.currency,
      buyer: sub ? sub.customer.name || sub.customer.email : "—",
      creator: { id: renewal.creatorId, userId: renewal.creator.userId, email: renewal.creator.user.email },
    });
  }
  if (u.status === "LOST") {
    await syncProviderRefund({ provider, paymentRef: u.paymentRef, providerRef: u.disputeRef, amountCents: u.amountCents, status: "succeeded", reason: "DISPUTE_LOST" });
    await recoverLostDispute(u, provider, { transactionId: renewal.id });
  }
  return ids;
}

/** Aviso de contracargo abierto a la creadora y a administración (tienen días para responder). */
async function notifyDispute(
  u: Extract<PaymentUpdate, { kind: "dispute" }>,
  d: { productTitle: string; currency: string; buyer: string; creator: { id: string; userId: string; email: string } },
) {
  const admins = await prisma.user.findMany({ where: { isAdmin: true, status: "ACTIVE" }, select: { id: true, email: true } });
  const mail = () =>
    disputeOpenedEmail({
      productTitle: d.productTitle,
      amount: formatPrice(u.amountCents, d.currency),
      buyer: d.buyer,
      url: `${appUrl()}/panel/ventas?estado=todos`,
    });
  const recipients = [{ id: d.creator.userId, email: d.creator.email, creatorId: d.creator.id as string | null }, ...admins.map((a) => ({ ...a, creatorId: null }))];
  for (const r of recipients)
    await enqueueEmail({ to: r.email, userId: r.id, creatorId: r.creatorId, fromName: null, replyTo: null, template: "DISPUTE_OPENED", dedupeKey: `dispute:${u.disputeRef}:${r.id}`, ...(await inMail(r.email, mail)) });
}

/**
 * Contracargo perdido: el libro lo carga a la creadora (fila REFUND con su parte en netCents), pero
 * con cargos de destino el banco se lo cobra a Cirella y la transferencia a la creadora no se
 * revierte sola. Se recupera su parte; si no se puede, aviso para hacerlo a mano.
 */
async function recoverLostDispute(u: Extract<PaymentUpdate, { kind: "dispute" }>, providerKey: string, ctx: Record<string, string>) {
  const booked = await prisma.transaction.findFirst({ where: { type: "REFUND", providerRef: u.disputeRef, provider: providerKey }, select: { netCents: true } });
  const creatorShare = booked ? -booked.netCents : 0;
  if (creatorShare <= 0) return;
  const provider = paymentProviderByKey(providerKey);
  if (!provider.recoverDispute) return; // el simulador no mueve dinero real
  const r = await provider.recoverDispute({ paymentRef: u.paymentRef, disputeRef: u.disputeRef, amountCents: creatorShare });
  if (!r.ok)
    captureAlert("Contracargo perdido sin recuperar de la creadora", {
      area: "payments",
      level: "error",
      fingerprint: ["contracargo-sin-recuperar"],
      extra: { ...ctx, disputeRef: u.disputeRef, amountCents: creatorShare, error: r.error },
    });
}

/**
 * Vuelta de la compradora desde la pasarela (o el simulador): pregunta el estado real a la
 * pasarela (la URL no demuestra nada) y lo aplica como si fuera un aviso. La pasarela es la del
 * pedido con ese checkout; si no hay pedido («Pagar ahora» de una renovación), la que dice la
 * vuelta (`via`) si está activa; si no, la principal.
 */
export async function reconcileCheckout(ref: string, via?: string | null): Promise<{ orderId?: string; subscriptionId?: string; state: PaymentState }> {
  const order = await prisma.order.findUnique({ where: { checkoutRef: ref }, select: { paymentProvider: true } });
  const key = order?.paymentProvider ?? (via && isPaymentProviderEnabled(via) ? via : paymentProvider().key);
  const provider = paymentProviderByKey(key);
  const status = await provider.getPaymentStatus(ref);
  const applied = await applyPaymentUpdate({ kind: "payment", status }, provider.key);
  // Si se ha cobrado ahora (PayPal), el estado es el de después de cobrar.
  return { orderId: status.metadata.orderId, subscriptionId: status.metadata.subscriptionId, state: applied.state ?? status.state };
}

/**
 * Registra un aviso (PaymentEvent), lo aplica y anota el resultado. Un aviso ya PROCESSED o
 * IGNORED no se vuelve a aplicar; uno FAILED o a medias sí (los cambios son idempotentes).
 */
export async function processPaymentEvent(provider: string, eventId: string, type: string, accountId: string | null, updates: PaymentUpdate[]) {
  let row = await prisma.paymentEvent.findUnique({ where: { provider_eventId: { provider, eventId } } });
  if (row && (row.status === "PROCESSED" || row.status === "IGNORED")) return { status: row.status, duplicate: true };
  if (row) row = await prisma.paymentEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, status: "RECEIVED" } });
  else {
    // ON CONFLICT DO NOTHING: si el mismo aviso llega dos veces a la vez, lo procesa el primero.
    const inserted = await prisma.paymentEvent.createMany({ data: [{ provider, eventId, type, accountId }], skipDuplicates: true });
    if (!inserted.count) return { status: "RECEIVED", duplicate: true };
    row = await prisma.paymentEvent.findUniqueOrThrow({ where: { provider_eventId: { provider, eventId } } });
  }
  try {
    let orderId: string | undefined;
    let creatorId: string | undefined;
    let anyApplied = false;
    for (const u of updates) {
      const r = await applyPaymentUpdate(u, provider);
      orderId ??= r.orderId;
      creatorId ??= r.creatorId;
      if (!r.ignored) anyApplied = true;
    }
    const status = anyApplied ? "PROCESSED" : "IGNORED";
    await prisma.paymentEvent.update({
      where: { id: row.id },
      data: { status, orderId: orderId ?? null, creatorId: creatorId ?? null, error: null, processedAt: new Date() },
    });
    return { status, duplicate: false };
  } catch (e) {
    await prisma.paymentEvent.update({ where: { id: row.id }, data: { status: "FAILED", error: truncateError(e) } });
    throw e;
  }
}

/** POST /api/webhooks/stripe y /api/webhooks/paypal. 400 si la firma no vale; 500 si algo falla, para que la pasarela reintente. */
export async function processWebhook(providerKey: "stripe" | "paypal", rawBody: string, headers: Headers): Promise<{ status: 200 | 400 | 500; body: string }> {
  if (!isPaymentProviderEnabled(providerKey)) return { status: 400, body: "Pasarela no configurada" };
  const provider = paymentProviderByKey(providerKey);
  let parsed;
  try {
    parsed = await provider.parseWebhook(rawBody, headers);
  } catch (e) {
    if (e instanceof WebhookSignatureError) return { status: 400, body: "Firma no válida" };
    // Firma buena pero no se pudo completar (p. ej. Stripe no respondió al pedir la sesión con su
    // PaymentIntent): 500 para que la pasarela lo reintente.
    captureError(e, { area: "payments", tags: { op: "webhook" } });
    return { status: 500, body: "No se ha podido leer el aviso" };
  }
  try {
    const r = await processPaymentEvent(providerKey, parsed.eventId, parsed.type, parsed.accountId, parsed.updates);
    return { status: 200, body: r.duplicate ? "Ya recibido" : r.status };
  } catch (e) {
    captureError(e, { area: "payments", tags: { op: "webhook", type: parsed.type }, extra: { eventId: parsed.eventId } });
    return { status: 500, body: "Error al procesar el aviso" };
  }
}

/** Las páginas del simulador dejan el mismo rastro que un webhook real. */
export async function recordSimulatedEvent(type: string, update: PaymentUpdate) {
  return processPaymentEvent("simulated", `sim_evt_${randomBytes(8).toString("hex")}`, type, null, [update]);
}
