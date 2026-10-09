import type Stripe from "stripe";
import type { PaymentState, PaymentStatus, PaymentUpdate, PayoutAccountSnapshot, RefundUpdateStatus } from "./provider";

/**
 * Traducción pura de objetos de Stripe a los tipos neutros de lib/payments/provider.ts.
 * Sin llamadas a la API: se prueba con objetos de ejemplo (scripts/unit/payments.test.ts).
 * Los nombres de campo son los de stripe@22.6.2 (API 2026-08-26.dahlia).
 */

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? undefined));

function metadataOf(m: Stripe.Metadata | null | undefined): Record<string, string> {
  return { ...(m ?? {}) };
}

export function mapIntentState(status: Stripe.PaymentIntent.Status): PaymentState {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "processing":
    case "requires_capture":
      return "processing";
    case "canceled":
      return "canceled";
    default:
      // requires_action | requires_payment_method | requires_confirmation: la compradora aún puede pagar.
      return "requires_action";
  }
}

export function mapIntent(pi: Stripe.PaymentIntent): PaymentStatus {
  return {
    state: mapIntentState(pi.status),
    ref: pi.id,
    amountCents: pi.amount,
    currency: pi.currency.toUpperCase(),
    destinationAccount: idOf(pi.transfer_data?.destination) ?? null,
    customerRef: idOf(pi.customer),
    paymentMethodRef: idOf(pi.payment_method),
    metadata: metadataOf(pi.metadata),
    error: pi.last_payment_error?.message ?? undefined,
  };
}

export function mapSession(session: Stripe.Checkout.Session): PaymentStatus {
  const pi = typeof session.payment_intent === "object" && session.payment_intent ? session.payment_intent : null;
  let state: PaymentState;
  if (session.status === "complete") state = session.payment_status === "unpaid" ? "processing" : "succeeded";
  else if (session.status === "expired") state = "canceled";
  else state = "requires_action";
  return {
    state,
    ref: idOf(session.payment_intent),
    checkoutRef: session.id,
    amountCents: session.amount_total ?? 0,
    currency: (session.currency ?? "eur").toUpperCase(),
    // Solo se conoce si el PaymentIntent viene expandido; si no, el guardián no lo compara.
    destinationAccount: idOf(pi?.transfer_data?.destination) ?? null,
    customerRef: idOf(session.customer),
    paymentMethodRef: pi ? idOf(pi.payment_method) : undefined,
    metadata: metadataOf(session.metadata),
    error: pi?.last_payment_error?.message ?? undefined,
  };
}

export function mapAccount(acct: Stripe.Account): PayoutAccountSnapshot {
  const r = acct.requirements;
  return {
    accountId: acct.id,
    chargesEnabled: !!acct.charges_enabled,
    payoutsEnabled: !!acct.payouts_enabled,
    detailsSubmitted: !!acct.details_submitted,
    currentlyDue: r?.currently_due ?? [],
    pastDue: r?.past_due ?? [],
    eventuallyDue: r?.eventually_due ?? [],
    pendingVerification: r?.pending_verification ?? [],
    disabledReason: r?.disabled_reason ?? null,
    currentDeadline: r?.current_deadline ? new Date(r.current_deadline * 1000).toISOString() : null,
  };
}

function mapRefundStatus(status: string | null): RefundUpdateStatus {
  if (status === "succeeded" || status === "failed" || status === "canceled") return status;
  return "pending";
}

/** Un evento de Stripe → los cambios que hay que aplicar (casi siempre uno). */
export function mapEvent(evt: Stripe.Event): PaymentUpdate[] {
  const obj = evt.data.object as unknown;
  switch (evt.type) {
    case "payment_intent.succeeded":
    case "payment_intent.processing":
      return [{ kind: "payment", status: mapIntent(obj as Stripe.PaymentIntent) }];
    case "payment_intent.payment_failed": {
      const pi = obj as Stripe.PaymentIntent;
      // En un Checkout la compradora puede reintentar con otra tarjeta (el PaymentIntent vuelve a
      // requires_payment_method): eso no es un fallo definitivo. Las renovaciones sí lo son.
      if (pi.metadata?.kind !== "renewal" && pi.status === "requires_payment_method") return [{ kind: "ignored" }];
      return [{ kind: "payment", status: { ...mapIntent(pi), state: "failed" } }];
    }
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return [{ kind: "payment", status: mapSession(obj as Stripe.Checkout.Session) }];
    case "checkout.session.async_payment_failed":
      return [{ kind: "payment", status: { ...mapSession(obj as Stripe.Checkout.Session), state: "failed" } }];
    case "checkout.session.expired":
      return [{ kind: "payment", status: { ...mapSession(obj as Stripe.Checkout.Session), state: "canceled" } }];
    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const re = obj as Stripe.Refund;
      const paymentRef = idOf(re.payment_intent);
      if (!paymentRef) return [{ kind: "ignored" }];
      return [{ kind: "refund", paymentRef, refundRef: re.id, amountCents: re.amount, status: evt.type === "refund.failed" ? "failed" : mapRefundStatus(re.status) }];
    }
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed": {
      const d = obj as Stripe.Dispute;
      const paymentRef = idOf(d.payment_intent);
      if (!paymentRef) return [{ kind: "ignored" }];
      const status = evt.type !== "charge.dispute.closed" ? "OPEN" : d.status === "lost" ? "LOST" : "WON";
      return [{ kind: "dispute", paymentRef, disputeRef: d.id, status, amountCents: d.amount, reason: d.reason }];
    }
    case "account.updated":
    case "account.application.deauthorized": {
      const accountId = evt.account ?? (evt.type === "account.updated" ? (obj as Stripe.Account).id : undefined);
      return accountId ? [{ kind: "account", accountId }] : [{ kind: "ignored" }];
    }
    default:
      return [{ kind: "ignored" }];
  }
}
