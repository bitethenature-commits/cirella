import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { appUrl } from "../env";
import { enqueueEmail } from "../email/outbox";
import { disputeOpenedEmail, paymentFailedEmail } from "../email/templates";
import { formatPrice } from "../money";
import { captureAlert, captureError } from "../monitoring";
import { fulfillOrder } from "../orders";
import { syncPayoutAccount } from "../payouts";
import { applyProviderRefund } from "../refunds";
import { truncateError } from "../reliability";
import { applyRenewal, recordRenewalFailure } from "../subscriptions";
import { paymentProvider } from "./index";
import { WebhookSignatureError, type PaymentState, type PaymentStatus, type PaymentUpdate } from "./provider";

/**
 * Lo que dice la pasarela → cambios en Cirella. Es la única puerta: el webhook de Stripe, la vuelta
 * de la compradora (/api/payments/return) y las páginas del simulador acaban en applyPaymentUpdate.
 * Todo es idempotente (los avisos se repiten y llegan desordenados) y nunca se entrega un pago
 * cuyo importe, moneda o cuenta de destino no coincide con el pedido.
 */

export const AMOUNT_MISMATCH = "IMPORTE_O_CUENTA_NO_COINCIDE";

/** Pedidos ya cobrados: un segundo cobro para ellos es un duplicado y se devuelve. */
const SETTLED = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"];

type Applied = { orderId?: string; creatorId?: string; ignored?: boolean };

export async function applyPaymentUpdate(u: PaymentUpdate, providerKey: string): Promise<Applied> {
  switch (u.kind) {
    case "payment":
      if (u.status.metadata.orderId) return applyOrderPayment(u.status, providerKey);
      if (u.status.metadata.subscriptionId) return applySubscriptionPayment(u.status);
      return { ignored: true };
    case "refund":
      if (u.status !== "succeeded") return { ignored: true };
      await applyProviderRefund({ paymentRef: u.paymentRef, refundRef: u.refundRef, amountCents: u.amountCents, reason: "PROVIDER" });
      return {};
    case "dispute":
      return applyDispute(u);
    case "account": {
      const status = await syncPayoutAccount(u.accountId);
      return status ? {} : { ignored: true };
    }
    case "ignored":
      return { ignored: true };
  }
}

async function applyOrderPayment(s: PaymentStatus, providerKey: string): Promise<Applied> {
  const order = await prisma.order.findUnique({
    where: { id: s.metadata.orderId },
    include: { creator: { select: { payoutAccountId: true, username: true, displayName: true } }, product: { select: { slug: true } } },
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
      if (order.paymentRef !== s.ref) await refundDuplicate(order.id, s.ref);
      return ids;
    }
    // Anotado antes de entregar: si la entrega falla, el vigilante del cron la reintenta.
    await prisma.order.updateMany({
      where: { id: order.id, status: { notIn: SETTLED }, chargedAt: null },
      data: { chargedAt: new Date(), paymentRef: s.ref },
    });
    const r = await fulfillOrder(order.id, s.ref, { customerRef: s.customerRef, paymentMethodRef: s.paymentMethodRef });
    // Otra llamada entregó el pedido a la vez con otro cobro: este segundo cobro se devuelve.
    if (r.alreadyPaid && r.order.paymentRef !== s.ref) await refundDuplicate(order.id, s.ref);
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
    // Si estaba «pago pendiente», la compradora ya se fue confiando en que saldría bien: se le avisa.
    if (c.count && order.status === "PROCESSING")
      await enqueueEmail({
        to: order.buyerEmail,
        creatorId: order.creatorId,
        template: "PAYMENT_FAILED",
        dedupeKey: `payfail:${order.id}`,
        ...paymentFailedEmail({
          creatorName: order.creator.displayName,
          productTitle: order.productTitle,
          retryUrl: `${appUrl()}/${order.creator.username}/${order.product.slug}/checkout?pedido=${order.id}`,
        }),
      });
    return ids;
  }
  return ids; // requires_action: la compradora sigue en la página de pago
}

/** Segundo cobro para un pedido ya pagado (dos pestañas, doble clic…): se devuelve entero. */
async function refundDuplicate(orderId: string, ref: string) {
  captureAlert("Cobro duplicado de un pedido ya pagado: se reembolsa", { area: "payments", level: "error", fingerprint: ["cobro-duplicado"], extra: { orderId, ref } });
  const r = await paymentProvider().refund({ paymentRef: ref, refundApplicationFee: true, idempotencyKey: `dup:${ref}`, metadata: { orderId, reason: "duplicado" } });
  if (!r.ok) throw new Error(`No se ha podido reembolsar el cobro duplicado ${ref}: ${r.error}`);
}

/** Renovación pagada con la clienta delante («Pagar ahora») o confirmada más tarde por el banco. */
async function applySubscriptionPayment(s: PaymentStatus): Promise<Applied> {
  const sub = await prisma.subscription.findUnique({
    where: { id: s.metadata.subscriptionId },
    include: { creator: { select: { payoutAccountId: true } } },
  });
  if (!sub) return { ignored: true };
  const ids = { creatorId: sub.creatorId };
  const matches =
    s.amountCents === sub.priceCents && (s.destinationAccount == null || s.destinationAccount === sub.creator.payoutAccountId);
  if (!matches) {
    captureAlert("Renovación que no coincide con su suscripción", { area: "payments", level: "error", fingerprint: ["pago-no-coincide"], extra: { subscriptionId: sub.id, ref: s.ref } });
    return ids;
  }
  const periodEnd = new Date(s.metadata.periodKey ?? "");
  if (Number.isNaN(periodEnd.getTime())) return { ...ids, ignored: true };
  if (s.state === "succeeded" && s.ref) {
    await applyRenewal(sub.id, periodEnd, s.ref, { customerRef: s.customerRef, paymentMethodRef: s.paymentMethodRef });
  } else if (s.state === "failed" && s.metadata.kind === "renewal") {
    // Solo los cobros automáticos cuentan como intento fallido; un «Pagar ahora» rechazado no.
    await recordRenewalFailure(sub.id, s.error ?? "Tu banco ha rechazado la renovación.", new Date(), {
      periodEnd,
      attempts: Number(s.metadata.attempt ?? sub.renewalAttempts),
    });
  }
  return ids;
}

async function applyDispute(u: Extract<PaymentUpdate, { kind: "dispute" }>): Promise<Applied> {
  const order = await prisma.order.findFirst({ where: { paymentRef: u.paymentRef }, include: { creator: { include: { user: true } } } });
  if (!order) return { ignored: true };
  const ids = { orderId: order.id, creatorId: order.creatorId };
  await prisma.order.update({ where: { id: order.id }, data: { disputeStatus: u.status, disputedAt: order.disputedAt ?? new Date() } });
  if (u.status === "OPEN") {
    const admins = await prisma.user.findMany({ where: { isAdmin: true, status: "ACTIVE" }, select: { id: true, email: true } });
    const mail = disputeOpenedEmail({
      productTitle: order.productTitle,
      amount: formatPrice(u.amountCents, order.currency),
      buyer: order.buyerName || order.buyerEmail,
      url: `${appUrl()}/panel/ventas?estado=todos`,
    });
    const recipients = [{ id: order.creator.userId, email: order.creator.user.email, creatorId: order.creatorId }, ...admins.map((a) => ({ ...a, creatorId: null }))];
    for (const r of recipients)
      await enqueueEmail({ to: r.email, userId: r.id, creatorId: r.creatorId, fromName: null, replyTo: null, template: "DISPUTE_OPENED", dedupeKey: `dispute:${u.disputeRef}:${r.id}`, ...mail });
  }
  if (u.status === "LOST") await applyProviderRefund({ paymentRef: u.paymentRef, refundRef: u.disputeRef, amountCents: u.amountCents, reason: "DISPUTE_LOST" });
  return ids;
}

/**
 * Vuelta de la compradora desde la pasarela (o el simulador): pregunta el estado real a la
 * pasarela (la URL no demuestra nada) y lo aplica como si fuera un aviso.
 */
export async function reconcileCheckout(ref: string): Promise<{ orderId?: string; subscriptionId?: string; state: PaymentState }> {
  const provider = paymentProvider();
  const status = await provider.getPaymentStatus(ref);
  await applyPaymentUpdate({ kind: "payment", status }, provider.key);
  return { orderId: status.metadata.orderId, subscriptionId: status.metadata.subscriptionId, state: status.state };
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

/** POST /api/webhooks/stripe. 400 si la firma no vale; 500 si algo falla, para que Stripe reintente. */
export async function processWebhook(providerKey: "stripe", rawBody: string, headers: Headers): Promise<{ status: 200 | 400 | 500; body: string }> {
  const provider = paymentProvider();
  if (provider.key !== providerKey) return { status: 400, body: "Pasarela no configurada" };
  let parsed;
  try {
    parsed = await provider.parseWebhook(rawBody, headers);
  } catch (e) {
    if (e instanceof WebhookSignatureError) return { status: 400, body: "Firma no válida" };
    captureError(e, { area: "payments", tags: { op: "webhook" } });
    return { status: 400, body: "Aviso no válido" };
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
