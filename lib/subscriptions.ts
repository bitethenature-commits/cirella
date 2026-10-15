import type { Creator, Plan, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import { renewalFailedEmail } from "./email/templates";
import { dispatchEvents, recordEvents } from "./events";
import { captureAlert, captureError } from "./monitoring";
import { paymentProvider } from "./payments";
import { nextRenewalAttempt, renewalPeriodKey } from "./payments/renewal";
import { canAcceptPayments } from "./payouts";
import { issueSaleInvoiceTx } from "./invoices/issue";
import { effectiveCommissionBps } from "./plans";
import { planFeeKey, renewalKey } from "./reliability";
import { computeSaleAmounts, decideTax, type TaxMode } from "./tax";
import { getTaxMode } from "./tax/server";

/** Suscripciones vivas: al día o con una renovación pendiente de cobro (con acceso mientras se reintenta). */
const LIVE = ["ACTIVE", "PAST_DUE"];

/**
 * Renovación pendiente de pago de una usuaria («Pagar ahora»). Se busca siempre por la usuaria de
 * la sesión: con el id de otra persona no devuelve nada.
 */
export function findPastDueSubscription(userId: string, productId: string) {
  return prisma.subscription.findFirst({
    where: { userId, productId, status: "PAST_DUE" },
    include: { product: true, customer: true, creator: { include: { plan: true } } },
  });
}

/** La clienta cancela: mantiene acceso hasta el final del periodo pagado. */
export async function cancelSubscription(subscriptionId: string, userId: string) {
  const eventIds = await prisma.$transaction(async (tx) => {
    const c = await tx.subscription.updateMany({
      where: { id: subscriptionId, userId, status: { in: LIVE }, cancelAtPeriodEnd: false },
      data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
    });
    return c.count ? recordEvents(tx, [{ type: "subscription.canceled", subscriptionId }]) : null;
  });
  if (!eventIds) return null;
  await dispatchEvents(eventIds);
  return prisma.subscription.findUnique({ where: { id: subscriptionId } });
}

export async function resumeSubscription(subscriptionId: string, userId: string) {
  const sub = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId, status: { in: LIVE } } });
  if (!sub) return null;
  return prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false, canceledAt: null } });
}

function addInterval(date: Date, interval: string) {
  const d = new Date(date);
  if (interval === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Importes de una renovación con la política de IVA vigente y el país que declaró la compradora:
 * IVA incluido, comisión (sobre la base sin IVA) y lo que retiene Cirella.
 */
export async function renewalAmounts(
  sub: { priceCents: number; buyerCountry: string | null; creator: Creator & { plan: Plan } },
  now: Date,
  mode?: TaxMode,
) {
  const tax = decideTax({
    mode: mode ?? (await getTaxMode()),
    productType: "MEMBERSHIP",
    buyerCountry: sub.buyerCountry,
    creator: { country: sub.creator.legalCountry, vatStatus: sub.creator.vatStatus, vatExemptionNote: sub.creator.vatExemptionNote },
  });
  return { tax, ...computeSaleAmounts(sub.priceCents, effectiveCommissionBps(sub.creator.plan, sub.creator, now), tax) };
}

type DueSubscription = Prisma.SubscriptionGetPayload<{ include: { creator: { include: { plan: true } }; product: true; customer: true } }>;

/**
 * Renovaciones de membresía (en cada ejecución del cron):
 *   · periodo vencido y cancelada → fin de la suscripción y del acceso;
 *   · periodo vencido (o reintento que toca) → cargo a la tarjeta guardada sin la clienta delante.
 *     Si sale bien, nuevo periodo y acceso extendido (applyRenewal). Si no, PAST_DUE con
 *     reintentos a 1 y 3 días y acceso mientras tanto; al tercer fallo se cancela
 *     (recordRenewalFailure).
 *
 * Idempotente: cada cambio es un UPDATE condicional sobre el periodo que vence (y el número de
 * intentos), así que si dos ejecuciones coinciden la segunda no encuentra la fila y no cobra dos
 * veces; la pasarela recibe la misma idempotencyKey y Transaction.idempotencyKey es única.
 * Si una suscripción falla, las demás siguen. Devuelve cuántas se han procesado de verdad.
 */
export async function processRenewals(now = new Date()) {
  const due = await prisma.subscription.findMany({
    where: {
      OR: [
        { status: "ACTIVE", currentPeriodEnd: { lte: now }, OR: [{ nextRenewalAttemptAt: null }, { nextRenewalAttemptAt: { lte: now } }] },
        { status: "PAST_DUE", nextRenewalAttemptAt: { lte: now } },
      ],
    },
    include: { creator: { include: { plan: true } }, product: true, customer: true },
    take: 200,
  });
  let done = 0;
  const mode = due.length ? await getTaxMode() : "PLATFORM_DIGITAL";
  for (const sub of due) {
    try {
      if (await renewOne(sub, now, mode)) done++;
    } catch (e) {
      captureError(e, { area: "renovaciones", extra: { subscriptionId: sub.id } });
    }
  }
  return done;
}

async function renewOne(sub: DueSubscription, now: Date, mode: TaxMode) {
  if (sub.cancelAtPeriodEnd) {
    // La condición sobre currentPeriodEnd hace de cerrojo: en Postgres (READ COMMITTED) la segunda
    // ejecución espera a la primera, vuelve a evaluar el WHERE y no actualiza nada.
    return prisma.$transaction(async (tx) => {
      const c = await tx.subscription.updateMany({
        where: { id: sub.id, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd },
        data: { status: "CANCELED", nextRenewalAttemptAt: null },
      });
      if (!c.count) return false;
      await tx.access.updateMany({ where: { subscriptionId: sub.id }, data: { status: "REVOKED" } });
      return true;
    });
  }
  const guard = { periodEnd: sub.currentPeriodEnd, attempts: sub.renewalAttempts };
  const provider = paymentProvider();
  if (!sub.creator.payoutAccountId || !canAcceptPayments(sub.creator, provider.key)) {
    return recordRenewalFailure(sub.id, "La creadora tiene los cobros pausados.", now, guard);
  }
  const periodKey = renewalPeriodKey(sub.currentPeriodEnd);
  const amounts = await renewalAmounts(sub, now, mode);
  const r = await provider.chargeSaved({
    subscriptionId: sub.id,
    periodKey,
    amountCents: sub.priceCents,
    currency: sub.product.currency,
    description: `Renovación · ${sub.product.title}`,
    customerEmail: sub.customer.email,
    // Comisión y, si vende Cirella, también el IVA (no es dinero de la creadora).
    platformFeeCents: amounts.platformRetainedCents,
    destinationAccount: sub.creator.payoutAccountId,
    statementSuffix: sub.creator.username.toUpperCase(),
    customerRef: sub.providerCustomerRef,
    paymentMethodRef: sub.providerPaymentMethodRef,
    metadata: { subscriptionId: sub.id, periodKey, attempt: String(sub.renewalAttempts), kind: "renewal" },
    idempotencyKey: `renewal:${sub.id}:${periodKey}:${sub.renewalAttempts}`,
  });
  // settleRenewalCharge y no applyRenewal: si mientras se cobraba la clienta pagó el mismo periodo
  // con «Pagar ahora», este segundo cobro se devuelve en vez de quedárnoslo.
  if (r.state === "succeeded") return (await settleRenewalCharge(sub.id, sub.currentPeriodEnd, r.ref)) === "applied";
  if (r.state === "processing") {
    // El banco confirmará más tarde: lo resuelve el aviso de la pasarela. Por si no llega,
    // se vuelve a mirar mañana (con la misma clave de idempotencia, no se cobra dos veces).
    const c = await prisma.subscription.updateMany({
      where: { id: sub.id, currentPeriodEnd: sub.currentPeriodEnd, renewalAttempts: sub.renewalAttempts },
      data: { nextRenewalAttemptAt: new Date(now.getTime() + 86_400_000) },
    });
    return c.count > 0;
  }
  return recordRenewalFailure(sub.id, (r.state === "failed" && r.error) || "Tu banco pide confirmar el pago.", now, guard);
}

/**
 * Renovación cobrada: nuevo periodo, acceso extendido y movimiento RENEWAL. El cobro puede llegar
 * por el cron, por el aviso de la pasarela o por «Pagar ahora»: el UPDATE condicional sobre el
 * periodo que vence hace que solo uno lo aplique. Devuelve false si ya estaba aplicado.
 */
export async function applyRenewal(
  subscriptionId: string,
  periodEnd: Date,
  paymentRef: string,
  saved: { customerRef?: string | null; paymentMethodRef?: string | null } = {},
): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { creator: { include: { plan: true } } } });
  if (!sub) return false;
  const now = new Date();
  const next = addInterval(periodEnd, sub.interval);
  const amounts = await renewalAmounts(sub, now);
  return prisma.$transaction(async (tx) => {
    const c = await tx.subscription.updateMany({
      where: { id: subscriptionId, currentPeriodEnd: periodEnd, status: { in: LIVE } },
      data: {
        currentPeriodStart: periodEnd,
        currentPeriodEnd: next,
        status: "ACTIVE",
        renewalAttempts: 0,
        nextRenewalAttemptAt: null,
        lastRenewalError: null,
        ...(saved.customerRef ? { providerCustomerRef: saved.customerRef } : {}),
        ...(saved.paymentMethodRef ? { providerPaymentMethodRef: saved.paymentMethodRef } : {}),
      },
    });
    if (!c.count) return false;
    await tx.access.updateMany({ where: { subscriptionId }, data: { expiresAt: next, status: "ACTIVE" } });
    await tx.customer.update({ where: { id: sub.customerId }, data: { totalSpentCents: { increment: sub.priceCents }, lastPurchaseAt: periodEnd } });
    const renewal = await tx.transaction.create({
      data: {
        creatorId: sub.creatorId,
        subscriptionId,
        type: "RENEWAL",
        description: "Renovación de membresía",
        amountCents: sub.priceCents,
        platformFeeCents: amounts.platformFeeCents,
        netCents: amounts.netCents,
        taxSeller: amounts.tax.seller,
        taxCountry: amounts.tax.country,
        taxRateBps: amounts.taxRateBps,
        taxCents: amounts.taxCents,
        provider: sub.provider,
        providerRef: paymentRef || null,
        idempotencyKey: renewalKey(subscriptionId, periodEnd),
      },
    });
    await issueSaleInvoiceTx(tx, { transactionId: renewal.id });
    return true;
  });
}

/**
 * Cobro de una renovación confirmado (cron, aviso de la pasarela, vuelta de «Pagar ahora»). Si no
 * se puede aplicar (el periodo ya está cobrado por otra vía o la suscripción se canceló mientras
 * pagaba) y no es un aviso repetido del mismo cobro, es un segundo cobro del mismo periodo: se
 * devuelve entero. Si lanza, el aviso queda FAILED y se reintenta (la clave dup: lo hace idempotente).
 */
export async function settleRenewalCharge(
  subscriptionId: string,
  periodEnd: Date,
  ref: string,
  saved: { customerRef?: string | null; paymentMethodRef?: string | null } = {},
): Promise<"applied" | "already" | "refunded"> {
  if (await applyRenewal(subscriptionId, periodEnd, ref, saved)) return "applied";
  // Una renovación ya aplicada con este mismo cobro (aviso repetido, o el cron y el aviso a la vez).
  const already = await prisma.transaction.findFirst({
    where: { subscriptionId, type: "RENEWAL", providerRef: ref },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (already) {
    // Aviso repetido de una renovación ya aplicada (el de la sesión llegó primero sin la tarjeta):
    // si es la última renovación, se guarda la tarjeta con la que se pagó (puede ser una nueva).
    const latest = await prisma.transaction.findFirst({ where: { subscriptionId, type: "RENEWAL" }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (saved.paymentMethodRef && latest?.id === already.id)
      await prisma.subscription.updateMany({
        where: { id: subscriptionId, status: { in: LIVE } },
        data: { providerPaymentMethodRef: saved.paymentMethodRef, ...(saved.customerRef ? { providerCustomerRef: saved.customerRef } : {}) },
      });
    return "already";
  }
  captureAlert("Cobro de renovación para un periodo ya cobrado o una suscripción cancelada: se reembolsa", {
    area: "payments",
    level: "error",
    fingerprint: ["renovacion-duplicada"],
    extra: { subscriptionId, ref },
  });
  const r = await paymentProvider().refund({ paymentRef: ref, refundApplicationFee: true, idempotencyKey: `dup:${ref}`, reason: "duplicate", metadata: { subscriptionId, reason: "duplicado" } });
  if (!r.ok) throw new Error(`No se ha podido reembolsar el cobro duplicado ${ref}: ${r.error}`);
  return "refunded";
}

/**
 * Renovación no cobrada. Primer y segundo fallo → PAST_DUE con reintento (+1 y +3 días), acceso
 * hasta entonces y email con «Pagar ahora». Tercer fallo → cancelada y sin acceso.
 * `guard` (periodo e intentos con los que se intentó cobrar) evita contar dos veces el mismo
 * fallo cuando llega por el cron y por el aviso de la pasarela.
 */
export async function recordRenewalFailure(
  subscriptionId: string,
  error: string,
  now = new Date(),
  guard?: { periodEnd: Date; attempts: number },
): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { product: true, creator: true, customer: true } });
  if (!sub || !LIVE.includes(sub.status)) return false;
  if (guard && (sub.currentPeriodEnd.getTime() !== guard.periodEnd.getTime() || sub.renewalAttempts !== guard.attempts)) return false;
  const current = { id: sub.id, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, renewalAttempts: sub.renewalAttempts };
  const attempts = sub.renewalAttempts + 1;
  const next = nextRenewalAttempt(sub.renewalAttempts, now);

  if (!next) {
    const eventIds = await prisma.$transaction(async (tx) => {
      const c = await tx.subscription.updateMany({
        where: current,
        data: { status: "CANCELED", canceledAt: now, renewalAttempts: attempts, nextRenewalAttemptAt: null, lastRenewalError: error },
      });
      if (!c.count) return null;
      await tx.access.updateMany({ where: { subscriptionId }, data: { status: "REVOKED" } });
      return recordEvents(tx, [{ type: "subscription.canceled", subscriptionId }]);
    });
    if (!eventIds) return false;
    await dispatchEvents(eventIds);
    return true;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.subscription.updateMany({
      where: current,
      data: { status: "PAST_DUE", renewalAttempts: attempts, nextRenewalAttemptAt: next, lastRenewalError: error },
    });
    if (!c.count) return false;
    // Periodo de gracia: mantiene el acceso hasta el siguiente intento.
    await tx.access.updateMany({ where: { subscriptionId }, data: { expiresAt: next, status: "ACTIVE" } });
    return true;
  });
  if (!updated) return false;
  await enqueueEmail({
    to: sub.customer.email,
    creatorId: sub.creatorId,
    userId: sub.userId,
    template: "RENEWAL_FAILED",
    dedupeKey: `renewfail:${sub.id}:${renewalPeriodKey(sub.currentPeriodEnd)}:${attempts}`,
    ...renewalFailedEmail({
      creatorName: sub.creator.displayName,
      productTitle: sub.product.title,
      payUrl: `${appUrl()}/cuenta/membresias/${sub.productId}`,
      nextAttempt: next.toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: sub.creator.timezone }),
    }),
  });
  return true;
}

/**
 * Cuota mensual del plan de cada creadora (cobro simulado). Usa primero el crédito de
 * referidos; los planes gratuitos dejan de tener fecha de renovación.
 * Idempotente igual que processRenewals: UPDATE condicional sobre planRenewsAt.
 */
export async function processPlanRenewals(now = new Date()) {
  const due = await prisma.creator.findMany({ where: { planRenewsAt: { lte: now }, status: "ACTIVE" }, include: { plan: true }, take: 200 });
  let done = 0;
  for (const c of due) {
    try {
      const renewsAt = c.planRenewsAt!;
      const price = c.plan.priceMonthlyCents;
      if (!price) {
        await prisma.creator.updateMany({ where: { id: c.id, planRenewsAt: renewsAt }, data: { planRenewsAt: null } });
        continue;
      }
      const credit = Math.min(c.creditCents, price);
      const charged = price - credit;
      const next = new Date(renewsAt);
      while (next <= now) next.setMonth(next.getMonth() + 1);
      const renewed = await prisma.$transaction(async (tx) => {
        const r = await tx.creator.updateMany({
          where: { id: c.id, planRenewsAt: renewsAt },
          data: { planRenewsAt: next, creditCents: { decrement: credit } },
        });
        if (!r.count) return false;
        await tx.transaction.create({
          data: {
            creatorId: c.id,
            type: "PLAN_FEE",
            description: `Plan ${c.plan.name} · renovación mensual${credit ? ` (crédito aplicado ${(credit / 100).toFixed(2)} €)` : ""}`,
            amountCents: charged,
            platformFeeCents: charged,
            netCents: 0,
            provider: "simulated",
            idempotencyKey: planFeeKey(c.id, renewsAt),
          },
        });
        return true;
      });
      if (renewed) done++;
    } catch (e) {
      captureError(e, { area: "renovaciones", extra: { creatorId: c.id } });
    }
  }
  return done;
}
