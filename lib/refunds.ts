import "server-only";
import { Prisma, type Order, type Refund } from "@prisma/client";
import { isNoChargeOrder } from "./access-mode";
import { cancelBooking, type BookingCanceller } from "./booking-changes";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import * as RT from "./email/refund-templates";
import { dispatchEvents, recordEvents } from "./events";
import { issueCorrectiveInvoiceTx } from "./invoices/issue";
import { formatMoney } from "./money";
import { revokeOrderAccess } from "./order-links";
import { captureAlert, captureError } from "./monitoring";
import { paymentProviderByKey, type PaymentProvider } from "./payments";
import type { RefundUpdateStatus } from "./payments/provider";
import {
  REFUND_REASONS,
  WITHDRAWAL_DAYS,
  computeRefundSplit,
  refundableCents,
  stripeReason,
  toWithdrawalInput,
  withdrawalEligibility,
  type RefundReason,
  type WithdrawalBlock,
} from "./refund-math";
import { truncateError } from "./reliability";
import { refundTaxFields } from "./tax";
import { formatDate, formatSessionDate } from "./tz";

/**
 * Reembolsos (totales o parciales) y desistimientos.
 *
 * Ciclo de vida de un Refund:
 *   1. Se reserva (PENDING) con el pedido bloqueado (SELECT … FOR UPDATE): dos peticiones a la vez
 *      nunca devuelven más de lo pagado, porque la segunda ve lo que la primera ya reservó.
 *   2. Se pide a la pasarela que cobró el pedido (Order.paymentProvider), con el id del Refund como
 *      clave de idempotencia. Si la pasarela lo rechaza → FAILED y no cambia nada más.
 *   3. Si lo acepta (pendiente o hecho), se aplican los efectos: retirar el acceso, cancelar la
 *      membresía, cancelar la sesión. La clienta recibe su email.
 *   4. El dinero se contabiliza al confirmarse (markRefundSucceeded): fila REFUND en negativo en el
 *      libro, Order.refundedCents, contadores de la clienta y evento de analítica. Idempotente.
 *
 * Los avisos de la pasarela (reembolsos hechos desde el panel de Stripe, cambios de estado,
 * contracargos perdidos) llegan por syncProviderRefund (lib/payments/events.ts).
 */

export type RefundActor = { kind: "creator"; creatorId: string; userId: string } | { kind: "customer"; userId: string } | { kind: "provider" };

export type RefundRequest = {
  orderId: string;
  actor: RefundActor;
  /** Sin importe = todo lo que queda por devolver. */
  amountCents?: number;
  reason: RefundReason;
  note?: string | null;
  revokeAccess: boolean;
  cancelBooking: boolean;
};

export type RefundResult =
  | { ok: true; refundId: string; status: "SUCCEEDED" | "PENDING"; amountCents: number }
  | { ok: false; code: "NOT_FOUND" | "NOT_REFUNDABLE" | "AMOUNT" | "PROVIDER"; error: string };

type RefundError = Extract<RefundResult, { ok: false }>;

const NOT_FOUND: RefundError = { ok: false, code: "NOT_FOUND", error: "Pedido no encontrado" };
const NOT_REFUNDABLE: RefundError = { ok: false, code: "NOT_REFUNDABLE", error: "Este pedido no se puede reembolsar." };
/** Pedido de 0 € (acceso gratis o dado a mano, lib/access-mode.ts): no hubo pago que devolver. */
const NO_CHARGE: RefundError = { ok: false, code: "NOT_REFUNDABLE", error: "Este acceso es gratuito: no hay ningún pago que devolver. Si quieres, quítale el acceso desde el producto." };

const money = (cents: number, currency: string) => formatMoney(cents, currency, { decimals: true });

const INITIATED_BY: Record<RefundActor["kind"], string> = { creator: "CREATOR", customer: "CUSTOMER", provider: "PROVIDER" };
const CANCELLED_BY: Record<string, BookingCanceller> = { CREATOR: "CREATOR", CUSTOMER: "CUSTOMER", PROVIDER: "SYSTEM", ADMIN: "SYSTEM" };

function canAct(order: Order & { customer: { userId: string } | null }, actor: RefundActor) {
  if (actor.kind === "creator") return order.creatorId === actor.creatorId;
  if (actor.kind === "customer") return order.customer?.userId === actor.userId;
  return true;
}

type Reservation = {
  amountCents?: number;
  /** true = recorta al máximo reembolsable en vez de rechazar (avisos de la pasarela). */
  clamp?: boolean;
  reason: RefundReason;
  note: string | null;
  initiatedBy: string;
  initiatedByUserId: string | null;
  revokeAccess: boolean | "if-full";
  cancelBooking: boolean | "if-full";
  providerRef?: string;
};

/** Paso 1: reserva el importe con el pedido bloqueado. */
async function reserveRefund(orderId: string, r: Reservation): Promise<{ ok: true; refund: Refund; partial: boolean } | RefundError> {
  return prisma.$transaction(async (tx): Promise<{ ok: true; refund: Refund; partial: boolean } | RefundError> => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== "PAID" || !order.paymentRef) return NOT_REFUNDABLE;
    const sums = await tx.refund.aggregate({
      where: { orderId, status: { in: ["PENDING", "SUCCEEDED"] } },
      _sum: { amountCents: true, platformFeeCents: true },
    });
    const reservedCents = sums._sum.amountCents ?? 0;
    const reservedFeeCents = sums._sum.platformFeeCents ?? 0;
    const refundable = refundableCents({ amountCents: order.amountCents, reservedCents });
    if (refundable <= 0) return { ok: false, code: "AMOUNT", error: "Este pedido ya está reembolsado" };
    const amount = r.clamp ? Math.min(r.amountCents ?? refundable, refundable) : (r.amountCents ?? refundable);
    if (!Number.isInteger(amount) || amount < 1 || amount > refundable)
      return { ok: false, code: "AMOUNT", error: `Escribe un importe entre 0,01 € y ${money(refundable, order.currency)}` };
    const full = amount === refundable;
    const split = computeRefundSplit({ amountCents: order.amountCents, platformFeeCents: order.platformFeeCents, reservedCents, reservedFeeCents }, amount);
    const refund = await tx.refund.create({
      data: {
        creatorId: order.creatorId,
        orderId,
        amountCents: amount,
        platformFeeCents: split.feeCents,
        currency: order.currency,
        reason: r.reason,
        note: r.note?.trim().slice(0, 500) || null,
        initiatedBy: r.initiatedBy,
        initiatedByUserId: r.initiatedByUserId,
        revokeAccess: r.revokeAccess === "if-full" ? full : r.revokeAccess,
        cancelBooking: r.cancelBooking === "if-full" ? full : r.cancelBooking,
        provider: order.paymentProvider,
        providerRef: r.providerRef ?? null,
      },
    });
    return { ok: true, refund, partial: !full };
  });
}

/** Devuelve dinero de un pedido pagado. Ver el ciclo de vida arriba. */
export async function refundOrder(req: RefundRequest, deps: { provider?: PaymentProvider } = {}): Promise<RefundResult> {
  const order = await prisma.order.findUnique({ where: { id: req.orderId }, include: { customer: { select: { userId: true } } } });
  if (!order || !canAct(order, req.actor)) return NOT_FOUND;
  if (isNoChargeOrder(order)) return NO_CHARGE;
  if (order.status !== "PAID" || !order.paymentRef) return NOT_REFUNDABLE;

  const reserved = await reserveRefund(order.id, {
    amountCents: req.amountCents,
    reason: req.reason,
    note: req.note ?? null,
    initiatedBy: INITIATED_BY[req.actor.kind],
    initiatedByUserId: req.actor.kind === "provider" ? null : req.actor.userId,
    revokeAccess: req.revokeAccess,
    cancelBooking: req.cancelBooking,
  });
  if (!reserved.ok) return reserved;
  const { refund } = reserved;

  let result: Awaited<ReturnType<PaymentProvider["refund"]>>;
  try {
    const provider = deps.provider ?? paymentProviderByKey(order.paymentProvider);
    result = await provider.refund({
      paymentRef: order.paymentRef,
      amountCents: refund.amountCents,
      currency: order.currency,
      refundApplicationFee: true,
      idempotencyKey: `refund_${refund.id}`,
      reason: stripeReason(req.reason),
      metadata: { orderId: order.id, refundId: refund.id },
    });
  } catch (e) {
    captureError(e, { area: "payments", tags: { op: "reembolso" }, extra: { orderId: order.id, refundId: refund.id } });
    result = { ok: false, error: "La pasarela no responde" };
  }
  if (!result.ok) {
    await prisma.refund.updateMany({ where: { id: refund.id, status: "PENDING" }, data: { status: "FAILED", error: truncateError(result.error), completedAt: new Date() } });
    return { ok: false, code: "PROVIDER", error: `La pasarela no ha podido hacer el reembolso: ${result.error}. No se ha cambiado nada.` };
  }

  // El aviso de la pasarela puede haber llegado ya y guardado la misma referencia.
  await prisma.refund.updateMany({ where: { id: refund.id, providerRef: null }, data: { providerRef: result.refundRef } });
  const done = await settleAccepted(refund, reserved.partial, result.status === "succeeded");
  return { ok: true, refundId: refund.id, status: done ? "SUCCEEDED" : "PENDING", amountCents: refund.amountCents };
}

/** Pasos 3 y 4: la pasarela ha aceptado el reembolso (hecho o pendiente). */
async function settleAccepted(refund: Refund, partial: boolean, succeeded: boolean) {
  const cancelled = await applyEffects(refund);
  if (succeeded) await markRefundSucceeded(refund.id);
  await sendRefundEmails(refund, partial, cancelled).catch((e) => captureError(e, { area: "payments", tags: { op: "reembolso-email" }, extra: { refundId: refund.id } }));
  const fresh = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id }, select: { status: true } });
  return fresh.status === "SUCCEEDED";
}

/** Retira el acceso, cancela la membresía y cancela la sesión, según lo pedido. Idempotente. */
async function applyEffects(refund: Refund) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: refund.orderId } });
  const now = new Date();
  const cancelled: { startAt: Date | null }[] = [];
  const eventIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    if (refund.revokeAccess) {
      await tx.access.updateMany({ where: { creatorId: order.creatorId, orderId: order.id }, data: { status: "REVOKED" } });
      if (order.productType === "MEMBERSHIP" && order.customerId) {
        // Fin inmediato (no al final del periodo): ya no se renueva ni da acceso.
        const subs = await tx.subscription.findMany({
          where: { creatorId: order.creatorId, customerId: order.customerId, productId: order.productId, status: { in: ["ACTIVE", "PAST_DUE"] } },
          select: { id: true },
        });
        const subIds = subs.map((s) => s.id);
        if (subIds.length) {
          await tx.subscription.updateMany({ where: { id: { in: subIds } }, data: { status: "CANCELED", canceledAt: now, cancelAtPeriodEnd: false, nextRenewalAttemptAt: null } });
          await tx.access.updateMany({ where: { creatorId: order.creatorId, subscriptionId: { in: subIds } }, data: { status: "REVOKED" } });
        }
      }
    }
    if (refund.cancelBooking && order.productType === "SESSION") {
      const bookings = await tx.booking.findMany({ where: { creatorId: order.creatorId, orderId: order.id, status: { in: ["CONFIRMED", "PENDING_SCHEDULE"] } } });
      for (const b of bookings) {
        const r = await cancelBooking(
          { creatorId: order.creatorId, bookingId: b.id, by: CANCELLED_BY[refund.initiatedBy] ?? "SYSTEM", reason: refund.note ?? REFUND_REASONS[refund.reason as RefundReason] ?? null, notify: false },
          tx,
        );
        if (r.ok) {
          ids.push(...r.eventIds);
          cancelled.push({ startAt: b.startAt });
        }
      }
    }
    return ids;
  });
  // Sin acceso al contenido, tampoco valen los enlaces personales ni las sesiones limitadas al pedido.
  if (refund.revokeAccess) await revokeOrderAccess(order.id);
  await dispatchEvents(eventIds);
  return cancelled;
}

async function sendRefundEmails(refund: Refund, partial: boolean, cancelled: { startAt: Date | null }[]) {
  if (refund.reason === "DISPUTE_LOST") return; // el banco ya se lo ha devuelto: no hay nada que contarle
  const order = await prisma.order.findUniqueOrThrow({ where: { id: refund.orderId }, include: { creator: { include: { user: true } } } });
  const creatorName = order.creator.displayName;
  const amount = money(refund.amountCents, refund.currency);
  const buyerUrl = `${appUrl()}/cuenta/compras`;
  const toBuyer = { to: order.buyerEmail, creatorId: order.creatorId, dedupeKey: `refund:${refund.id}` };

  if (refund.reason === "WITHDRAWAL") {
    await enqueueEmail({ ...toBuyer, template: "WITHDRAWAL_RECEIPT", ...RT.withdrawalReceiptEmail({ creatorName, productTitle: order.productTitle, amount, url: buyerUrl }) });
    await enqueueEmail({
      to: order.creator.contactEmail || order.creator.user.email,
      userId: order.creator.userId,
      creatorId: order.creatorId,
      template: "WITHDRAWAL_CREATOR",
      dedupeKey: `withdrawal:${order.id}`,
      ...RT.withdrawalCreatorEmail({ buyer: order.buyerName || order.buyerEmail, productTitle: order.productTitle, amount, url: `${appUrl()}/panel/ventas/${order.id}` }),
    });
  } else if (cancelled.length) {
    const startAt = cancelled[0].startAt;
    await enqueueEmail({
      ...toBuyer,
      template: "BOOKING_CANCELLED",
      ...RT.bookingCancelledEmail({
        creatorName,
        productTitle: order.productTitle,
        when: startAt ? formatSessionDate(startAt, order.creator.timezone) : null,
        reason: refund.note,
        refundAmount: amount,
        url: buyerUrl,
      }),
    });
  } else {
    await enqueueEmail({
      ...toBuyer,
      template: "REFUND_ISSUED",
      ...RT.refundIssuedEmail({ creatorName, productTitle: order.productTitle, amount, partial, accessRevoked: refund.revokeAccess, note: refund.note, url: buyerUrl }),
    });
  }
}

/**
 * La pasarela confirma el reembolso: se contabiliza. Idempotente (solo pasa de PENDING a
 * SUCCEEDED una vez y Transaction.refundId es único). Devuelve si ha hecho algo.
 */
export async function markRefundSucceeded(refundId: string): Promise<boolean> {
  const pre = await prisma.refund.findUnique({ where: { id: refundId }, select: { orderId: true } });
  if (!pre) return false;
  const eventIds = await prisma.$transaction(async (tx) => {
    // Mismo orden de bloqueo que reserveRefund (primero el pedido): sin interbloqueos.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${pre.orderId} FOR UPDATE`;
    const c = await tx.refund.updateMany({ where: { id: refundId, status: "PENDING" }, data: { status: "SUCCEEDED", completedAt: new Date(), error: null } });
    if (!c.count) return null;
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    const order = await tx.order.findUniqueOrThrow({ where: { id: refund.orderId }, include: { customer: { select: { userId: true } } } });
    const full = order.refundedCents + refund.amountCents >= order.amountCents;
    // IVA devuelto en proporción. Si vende Cirella, ese IVA sale de su cuenta y no de la creadora.
    const tax = refundTaxFields(order, refund.amountCents);
    const platformTax = order.taxSeller === "PLATFORM" ? tax.taxCents : 0;
    // Libro: importes en negativo, así las sumas son netas (lib/dac7-data.ts cuenta con ello).
    const refundTx = await tx.transaction.create({
      data: {
        creatorId: order.creatorId,
        orderId: order.id,
        refundId: refund.id,
        type: "REFUND",
        description: `Reembolso · ${order.productTitle}`,
        amountCents: -refund.amountCents,
        platformFeeCents: -refund.platformFeeCents,
        netCents: -(refund.amountCents - refund.platformFeeCents) - platformTax,
        currency: refund.currency,
        ...tax,
        provider: refund.provider,
        providerRef: refund.providerRef,
      },
    });
    // Rectificativa de la factura de la venta (si la tenía), en la misma transacción.
    const charge = await tx.transaction.findFirst({ where: { orderId: order.id, type: "CHARGE" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (charge) await issueCorrectiveInvoiceTx(tx, { refundTransactionId: refundTx.id, originalTransactionId: charge.id });
    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedCents: { increment: refund.amountCents },
        refundedFeeCents: { increment: refund.platformFeeCents },
        refundedAt: new Date(),
        ...(full ? { status: "REFUNDED" } : {}),
      },
    });
    if (order.customerId)
      await tx.customer.update({
        where: { id: order.customerId },
        data: { totalSpentCents: { decrement: refund.amountCents }, ...(full ? { ordersCount: { decrement: 1 } } : {}) },
      });
    await tx.analyticsEvent.create({
      data: {
        creatorId: order.creatorId,
        type: "REFUND",
        productId: order.productId,
        visitorId: order.customer ? `user:${order.customer.userId}` : (order.visitorId ?? `order:${order.id}`),
        amountCents: refund.amountCents,
      },
    });
    return recordEvents(tx, [{ type: "order.refunded", orderId: order.id, refundId: refund.id }]);
  });
  if (!eventIds) return false;
  await dispatchEvents(eventIds);
  return true;
}

/**
 * La pasarela rechaza un reembolso que estaba en curso. El acceso retirado sigue retirado; la
 * creadora recibe un aviso y puede reintentarlo (lo FAILED no cuenta como reservado).
 */
export async function markRefundFailed(refundId: string, error: string): Promise<boolean> {
  const c = await prisma.refund.updateMany({ where: { id: refundId, status: "PENDING" }, data: { status: "FAILED", error: truncateError(error), completedAt: new Date() } });
  if (!c.count) return false;
  const r = await prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { order: { include: { creator: { include: { user: true } } } } } });
  const o = r.order;
  await enqueueEmail({
    to: o.creator.contactEmail || o.creator.user.email,
    userId: o.creator.userId,
    creatorId: o.creatorId,
    template: "REFUND_FAILED",
    dedupeKey: `refund-failed:${r.id}`,
    ...RT.refundFailedCreatorEmail({ buyer: o.buyerName || o.buyerEmail, productTitle: o.productTitle, amount: money(r.amountCents, r.currency), error, url: `${appUrl()}/panel/ventas/${o.id}` }),
  });
  return true;
}

export type ProviderRefundUpdate = {
  provider: string;
  paymentRef: string;
  /** re_… / sim_re_… o, para un contracargo perdido, el id del contracargo. */
  providerRef: string;
  /** Nuestro Refund.id, si la pasarela lo devuelve en los metadatos. */
  refundId?: string;
  amountCents: number;
  status: RefundUpdateStatus;
  error?: string;
  reason?: "OTHER" | "DISPUTE_LOST";
};

/**
 * Aviso de la pasarela sobre un reembolso (lib/payments/events.ts):
 *   · si es uno de los nuestros, actualiza su estado (hecho → se contabiliza; fallido → aviso);
 *   · si no lo conocemos (hecho desde el panel de Stripe, o un contracargo perdido), lo registra
 *     como reembolso de la pasarela y aplica los mismos efectos que uno pedido desde Cirella.
 * Devuelve el pedido afectado, o null si el aviso no es de ningún pedido (p. ej. el reembolso
 * automático de un cobro duplicado).
 */
export async function syncProviderRefund(i: ProviderRefundUpdate): Promise<{ orderId?: string; creatorId: string } | null> {
  const known = await findKnownRefund(i);
  if (known) {
    if (i.status === "succeeded") {
      if (known.status === "FAILED") await reviveFailedRefund(known);
      await markRefundSucceeded(known.id);
    } else if (i.status === "failed" || i.status === "canceled") {
      await markRefundFailed(known.id, i.error ?? "La pasarela ha rechazado el reembolso.");
    }
    return { orderId: known.orderId, creatorId: known.creatorId };
  }
  if (i.status === "failed" || i.status === "canceled") return null;

  const order = await prisma.order.findFirst({ where: { paymentRef: i.paymentRef, paymentProvider: i.provider } });
  // Sin pedido: puede ser una renovación de membresía (su cobro no tiene pedido propio).
  if (!order) return i.status === "succeeded" ? syncRenewalRefund(i) : null;
  const ids = { orderId: order.id, creatorId: order.creatorId };
  let reserved;
  try {
    reserved = await reserveRefund(order.id, {
      amountCents: i.amountCents,
      clamp: true,
      reason: i.reason ?? "OTHER",
      note: null,
      initiatedBy: "PROVIDER",
      initiatedByUserId: null,
      revokeAccess: "if-full",
      cancelBooking: "if-full",
      providerRef: i.providerRef,
    });
  } catch (e) {
    // Dos avisos del mismo reembolso a la vez: el otro ya lo ha registrado.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return syncProviderRefund(i);
    throw e;
  }
  if (!reserved.ok) return ids; // ya estaba devuelto entero: nada que registrar
  await settleAccepted(reserved.refund, reserved.partial, i.status === "succeeded");
  return ids;
}

/** Cobro de una renovación de membresía (movimiento RENEWAL) por su referencia en la pasarela. */
export function findRenewalCharge(provider: string, paymentRef: string) {
  return prisma.transaction.findFirst({
    where: { type: "RENEWAL", providerRef: paymentRef, provider },
    include: { creator: { include: { user: true } } },
  });
}

/**
 * Reembolso (desde el panel de Stripe) o contracargo perdido de una RENOVACIÓN. Las renovaciones no
 * tienen pedido ni fila Refund (Refund.orderId es obligatorio), así que se contabiliza directamente:
 * fila REFUND en negativo, rectificativa de la factura de la renovación, gasto de la clienta y, si
 * se devuelve entera la del periodo en curso, fin de la membresía y del acceso. Idempotente por la
 * clave única refund:{renovación}:{referencia}. null si el cobro no es de ninguna renovación.
 */
async function syncRenewalRefund(i: ProviderRefundUpdate): Promise<{ creatorId: string } | null> {
  const renewal = await findRenewalCharge(i.provider, i.paymentRef);
  if (!renewal) return null;
  const ids = { creatorId: renewal.creatorId };
  const key = `refund:${renewal.id}:${i.providerRef}`;
  try {
    const booked = await prisma.$transaction(async (tx) => {
      // Bloquea la renovación: dos avisos a la vez nunca devuelven más de lo cobrado.
      await tx.$queryRaw`SELECT "id" FROM "Transaction" WHERE "id" = ${renewal.id} FOR UPDATE`;
      if (await tx.transaction.findUnique({ where: { idempotencyKey: key }, select: { id: true } })) return false;
      const prev = await tx.transaction.aggregate({
        where: { type: "REFUND", idempotencyKey: { startsWith: `refund:${renewal.id}:` } },
        _sum: { amountCents: true, platformFeeCents: true },
      });
      const reservedCents = -(prev._sum.amountCents ?? 0);
      const reservedFeeCents = -(prev._sum.platformFeeCents ?? 0);
      const amount = Math.min(i.amountCents, refundableCents({ amountCents: renewal.amountCents, reservedCents }));
      if (amount <= 0) return false;
      const split = computeRefundSplit({ amountCents: renewal.amountCents, platformFeeCents: renewal.platformFeeCents, reservedCents, reservedFeeCents }, amount);
      const tax = refundTaxFields(renewal, amount);
      const platformTax = renewal.taxSeller === "PLATFORM" ? -tax.taxCents : 0;
      const sub = renewal.subscriptionId ? await tx.subscription.findUnique({ where: { id: renewal.subscriptionId } }) : null;
      const refundTx = await tx.transaction.create({
        data: {
          creatorId: renewal.creatorId,
          subscriptionId: renewal.subscriptionId,
          type: "REFUND",
          description: i.reason === "DISPUTE_LOST" ? "Contracargo perdido · renovación de membresía" : "Reembolso · renovación de membresía",
          amountCents: -amount,
          platformFeeCents: -split.feeCents,
          netCents: -(amount - split.feeCents) - platformTax,
          currency: renewal.currency,
          ...tax,
          provider: renewal.provider,
          providerRef: i.providerRef,
          idempotencyKey: key,
        },
      });
      await issueCorrectiveInvoiceTx(tx, { refundTransactionId: refundTx.id, originalTransactionId: renewal.id });
      if (sub) {
        await tx.customer.update({ where: { id: sub.customerId }, data: { totalSpentCents: { decrement: amount } } });
        await tx.analyticsEvent.create({
          data: { creatorId: renewal.creatorId, type: "REFUND", productId: sub.productId, visitorId: `user:${sub.userId}`, amountCents: amount },
        });
        // Devuelta entera la renovación del periodo en curso: la membresía termina ya (como un
        // reembolso total de un pedido). Una renovación antigua no toca el periodo actual.
        const latest = await tx.transaction.findFirst({ where: { subscriptionId: sub.id, type: "RENEWAL" }, orderBy: { createdAt: "desc" }, select: { id: true } });
        const full = reservedCents + amount >= renewal.amountCents;
        if (full && latest?.id === renewal.id && LIVE_SUBSCRIPTION.includes(sub.status)) {
          await tx.subscription.update({ where: { id: sub.id }, data: { status: "CANCELED", canceledAt: new Date(), cancelAtPeriodEnd: false, nextRenewalAttemptAt: null } });
          await tx.access.updateMany({ where: { creatorId: sub.creatorId, subscriptionId: sub.id }, data: { status: "REVOKED" } });
        }
      }
      return true;
    });
    if (!booked) return ids;
  } catch (e) {
    // Dos avisos del mismo reembolso a la vez: el otro ya lo ha contabilizado.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return ids;
    throw e;
  }
  captureAlert(i.reason === "DISPUTE_LOST" ? "Contracargo perdido de una renovación de membresía" : "Reembolso de una renovación hecho fuera de Cirella", {
    area: "payments",
    level: "warning",
    fingerprint: ["reembolso-renovacion"],
    extra: { transactionId: renewal.id, ref: i.paymentRef, providerRef: i.providerRef, amountCents: i.amountCents },
  });
  return ids;
}

const LIVE_SUBSCRIPTION = ["ACTIVE", "PAST_DUE"];

async function findKnownRefund(i: ProviderRefundUpdate) {
  const byRef = await prisma.refund.findUnique({ where: { providerRef: i.providerRef } });
  if (byRef) return byRef;
  if (!i.refundId) return null;
  // El aviso llegó antes de que guardáramos la referencia: se reconoce por los metadatos, solo
  // si son de este mismo cobro.
  const byId = await prisma.refund.findUnique({ where: { id: i.refundId }, include: { order: { select: { paymentRef: true } } } });
  if (!byId || byId.provider !== i.provider || byId.order.paymentRef !== i.paymentRef) return null;
  if (byId.providerRef && byId.providerRef !== i.providerRef) return null;
  await prisma.refund.updateMany({ where: { id: byId.id, providerRef: null }, data: { providerRef: i.providerRef } });
  return byId;
}

/**
 * Un reembolso que dimos por fallido (la pasarela no respondió) y que la pasarela confirma: vuelve a
 * PENDING para contabilizarse, siempre que no se haya devuelto ya ese dinero por otro lado.
 */
async function reviveFailedRefund(r: Refund) {
  const revived = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${r.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: r.orderId } });
    const sums = await tx.refund.aggregate({ where: { orderId: r.orderId, status: { in: ["PENDING", "SUCCEEDED"] } }, _sum: { amountCents: true } });
    if ((sums._sum.amountCents ?? 0) + r.amountCents > order.amountCents) return false;
    const c = await tx.refund.updateMany({ where: { id: r.id, status: "FAILED" }, data: { status: "PENDING", error: null } });
    return c.count > 0;
  });
  if (!revived)
    captureAlert("La pasarela confirma un reembolso que ya no cabe en el pedido", {
      area: "payments",
      level: "error",
      fingerprint: ["reembolso-sobrante"],
      extra: { refundId: r.id, orderId: r.orderId },
    });
}

/** Texto para la compradora cuando no puede desistir. */
export function withdrawalBlockMessage(reason: WithdrawalBlock, paidAt: Date | null) {
  switch (reason) {
    case "EXPIRED":
      return `El plazo de ${WITHDRAWAL_DAYS} días para desistir terminó el ${formatDate(new Date((paidAt ?? new Date()).getTime() + WITHDRAWAL_DAYS * 86_400_000), { day: "numeric", month: "long" })}.`;
    case "WAIVED":
      return "Renunciaste al desistimiento para tener acceso inmediato y ya has empezado a usar el contenido.";
    case "SESSION_HELD":
      return "La sesión ya se ha realizado.";
    case "PENDING":
      return "Ya hay un reembolso en curso.";
    case "ALREADY_REFUNDED":
      return "Esta compra ya está reembolsada.";
    case "NOT_PAID":
      return "Esta compra no se puede desistir.";
  }
}

/**
 * La compradora desiste (14 días). Solo sobre sus propios pedidos: el id, su email y su usuaria
 * tienen que coincidir. Se devuelve todo lo que queda, se retira el acceso y se cancela la sesión.
 */
export async function withdrawOrder(i: { orderId: string; userId: string; email: string; now?: Date }, deps: { provider?: PaymentProvider } = {}): Promise<RefundResult> {
  const order = await prisma.order.findFirst({
    where: { id: i.orderId, buyerEmail: i.email.toLowerCase(), customer: { userId: i.userId } },
    include: { bookings: { select: { status: true, startAt: true } }, refunds: { select: { status: true } } },
  });
  if (!order) return NOT_FOUND;
  if (isNoChargeOrder(order)) return NO_CHARGE;
  const e = withdrawalEligibility(toWithdrawalInput(order), i.now ?? new Date());
  if (!e.eligible) return { ok: false, code: "NOT_REFUNDABLE", error: withdrawalBlockMessage(e.reason, order.paidAt) };
  return refundOrder(
    { orderId: order.id, actor: { kind: "customer", userId: i.userId }, amountCents: e.amountCents, reason: "WITHDRAWAL", revokeAccess: true, cancelBooking: true },
    deps,
  );
}
