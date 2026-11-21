import type { PaymentState, PaymentStatus, PaymentUpdate, RefundUpdateStatus } from "./provider";

/**
 * Traducción pura de objetos de la API de PayPal (Orders v2, Payments v2, Disputes v1) a los tipos
 * neutros de lib/payments/provider.ts. Sin llamadas a la API: se prueba con objetos de ejemplo
 * (scripts/unit/paypal.test.ts). Solo se tipan los campos que usamos.
 */

export type PaypalMoney = { currency_code: string; value: string };

export type PaypalCapture = {
  id: string;
  status: string; // COMPLETED | PENDING | DECLINED | FAILED | REFUNDED | PARTIALLY_REFUNDED
  amount?: PaypalMoney;
  custom_id?: string;
  status_details?: { reason?: string };
  supplementary_data?: { related_ids?: { order_id?: string } };
};

export type PaypalOrder = {
  id: string;
  status: string; // CREATED | SAVED | APPROVED | VOIDED | COMPLETED | PAYER_ACTION_REQUIRED
  links?: { href: string; rel: string }[];
  payment_source?: {
    paypal?: {
      email_address?: string;
      attributes?: { vault?: { id?: string; status?: string; customer?: { id?: string } } };
    };
  };
  purchase_units?: {
    custom_id?: string;
    amount?: PaypalMoney;
    payments?: { captures?: PaypalCapture[] };
  }[];
};

export type PaypalRefund = {
  id: string;
  status: string; // COMPLETED | PENDING | CANCELLED | FAILED
  amount?: PaypalMoney;
  custom_id?: string;
  links?: { href: string; rel: string }[];
};

export type PaypalDispute = {
  dispute_id: string;
  status?: string;
  reason?: string;
  dispute_amount?: PaypalMoney;
  disputed_transactions?: { seller_transaction_id?: string }[];
  dispute_outcome?: { outcome_code?: string };
};

export type PaypalEvent = { id: string; event_type: string; resource: unknown };

/** Monedas sin decimales en PayPal: el importe va en unidades enteras. */
const ZERO_DECIMAL = new Set(["JPY", "HUF", "TWD"]);

/** 5000 céntimos de EUR → «50.00» (el formato que pide PayPal). */
export function toPaypalValue(cents: number, currency: string): string {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? String(Math.round(cents / 100)) : (cents / 100).toFixed(2);
}

/** «50.00» → 5000. NaN si PayPal manda algo que no es un importe (el guardián lo rechaza). */
export function fromPaypalValue(value: string | undefined, currency: string | undefined): number {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  const [units, decimals = ""] = value.split(".");
  if (ZERO_DECIMAL.has((currency ?? "").toUpperCase())) return Number(units) * 100;
  return Number(units) * 100 + Number((decimals + "00").slice(0, 2));
}

/**
 * Metadatos del cobro en `custom_id` (PayPal no tiene metadatos; máximo 127 caracteres):
 *   · pedido:      «o|<orderId>»
 *   · renovación:  «s|<subscriptionId>|<periodKey>|<intento>|<r = cobro automático, n = «Pagar ahora»>»
 */
export function encodeCustomId(m: Record<string, string>): string {
  if (m.orderId) return `o|${m.orderId}`;
  if (m.subscriptionId) return ["s", m.subscriptionId, m.periodKey ?? "", m.attempt ?? "", m.kind === "renewal" ? "r" : "n"].join("|");
  return "";
}

export function decodeCustomId(v: string | null | undefined): Record<string, string> {
  const parts = (v ?? "").split("|");
  if (parts[0] === "o" && parts[1]) return { orderId: parts[1] };
  if (parts[0] === "s" && parts[1]) {
    const m: Record<string, string> = { subscriptionId: parts[1] };
    if (parts[2]) m.periodKey = parts[2];
    if (parts[3]) m.attempt = parts[3];
    if (parts[4] === "r") m.kind = "renewal";
    return m;
  }
  return {};
}

export function mapCaptureState(status: string | undefined): PaymentState {
  switch (status) {
    case "COMPLETED":
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "succeeded";
    case "PENDING":
      return "processing";
    case "DECLINED":
    case "FAILED":
      return "failed";
    default:
      return "requires_action";
  }
}

const DECLINED = "PayPal no ha podido cobrar el pago. Prueba con otra tarjeta o cuenta de PayPal.";

/** Un cobro de PayPal (capture) → estado neutro. orderId: el pedido de PayPal (checkoutRef). */
export function mapCapture(c: PaypalCapture, extra: { orderId?: string; customId?: string } = {}): PaymentStatus {
  const currency = (c.amount?.currency_code ?? "").toUpperCase();
  const state = mapCaptureState(c.status);
  return {
    state,
    ref: c.id,
    checkoutRef: extra.orderId ?? c.supplementary_data?.related_ids?.order_id,
    amountCents: fromPaypalValue(c.amount?.value, currency),
    currency,
    destinationAccount: null,
    metadata: decodeCustomId(c.custom_id ?? extra.customId),
    error: state === "failed" ? DECLINED : undefined,
  };
}

/** Un pedido de PayPal → estado neutro (el de su cobro, si ya lo tiene). */
export function mapOrder(o: PaypalOrder): PaymentStatus {
  const unit = o.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const vault = o.payment_source?.paypal?.attributes?.vault;
  const saved = vault?.id ? { paymentMethodRef: vault.id, customerRef: vault.customer?.id } : {};
  if (capture) return { ...mapCapture(capture, { orderId: o.id, customId: unit?.custom_id }), ...saved };
  const currency = (unit?.amount?.currency_code ?? "").toUpperCase();
  return {
    // Sin cobro todavía: la compradora no ha aprobado (o lo hará), lo aprobó y falta cobrarlo
    // (approved) o lo canceló.
    state: o.status === "VOIDED" ? "canceled" : "requires_action",
    checkoutRef: o.id,
    amountCents: fromPaypalValue(unit?.amount?.value, currency),
    currency,
    destinationAccount: null,
    metadata: decodeCustomId(unit?.custom_id),
    ...(o.status === "APPROVED" ? { approved: true } : {}),
  };
}

/** Enlace para que la compradora apruebe el pago en PayPal. */
export function approvalLink(o: PaypalOrder): string | null {
  return o.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href ?? null;
}

function mapRefundStatus(status: string | undefined): RefundUpdateStatus {
  if (status === "COMPLETED") return "succeeded";
  if (status === "FAILED") return "failed";
  if (status === "CANCELLED") return "canceled";
  return "pending";
}

/** Cobro al que pertenece un reembolso: su enlace «up» acaba en /captures/<id>. */
export function refundCaptureId(r: PaypalRefund): string | null {
  const up = r.links?.find((l) => l.rel === "up")?.href ?? "";
  return /\/captures\/([^/?#]+)/.exec(up)?.[1] ?? null;
}

export function mapRefund(r: PaypalRefund): PaymentUpdate {
  const paymentRef = refundCaptureId(r);
  if (!paymentRef) return { kind: "ignored" };
  const refundId = r.custom_id?.startsWith("re|") ? r.custom_id.slice(3) : undefined;
  return {
    kind: "refund",
    paymentRef,
    refundRef: r.id,
    ...(refundId ? { refundId } : {}),
    amountCents: fromPaypalValue(r.amount?.value, r.amount?.currency_code),
    status: mapRefundStatus(r.status),
  };
}

/**
 * Disputa → contracargo. Perdida si se resolvió a favor de la compradora o la dueña la aceptó;
 * ganada en cualquier otro final (a su favor, cancelada por la compradora, pagada por PayPal…).
 */
export function mapDispute(d: PaypalDispute, eventType: string): PaymentUpdate {
  const paymentRef = d.disputed_transactions?.find((t) => t.seller_transaction_id)?.seller_transaction_id;
  if (!paymentRef) return { kind: "ignored" };
  const outcome = d.dispute_outcome?.outcome_code;
  const resolved = eventType === "CUSTOMER.DISPUTE.RESOLVED" || d.status === "RESOLVED";
  const status = !resolved ? "OPEN" : outcome === "RESOLVED_BUYER_FAVOUR" || outcome === "ACCEPTED" ? "LOST" : "WON";
  return {
    kind: "dispute",
    paymentRef,
    disputeRef: d.dispute_id,
    status,
    amountCents: fromPaypalValue(d.dispute_amount?.value, d.dispute_amount?.currency_code),
    reason: d.reason,
  };
}

/**
 * Avisos → cambios. CHECKOUT.ORDER.APPROVED llega como pago aprobado sin cobrar (approved): lo cobra
 * lib/payments/events.ts si el pedido sigue esperándolo. PAYMENT.CAPTURE.REVERSED se ignora: el dinero vuelve a
 * la compradora por una disputa, y la disputa ya lo registra (CUSTOMER.DISPUTE.RESOLVED); contarlo
 * dos veces descuadraría las cuentas.
 */
export function mapEvent(evt: PaypalEvent): PaymentUpdate[] {
  switch (evt.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED":
    case "PAYMENT.CAPTURE.PENDING":
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED": {
      const c = evt.resource as PaypalCapture;
      const status = mapCapture(c);
      const state: PaymentState =
        evt.event_type === "PAYMENT.CAPTURE.COMPLETED" ? "succeeded" : evt.event_type === "PAYMENT.CAPTURE.PENDING" ? "processing" : "failed";
      return [{ kind: "payment", status: { ...status, state, error: state === "failed" ? DECLINED : undefined } }];
    }
    case "CHECKOUT.ORDER.APPROVED":
      return [{ kind: "payment", status: mapOrder(evt.resource as PaypalOrder) }];
    case "PAYMENT.CAPTURE.REFUNDED":
      return [mapRefund(evt.resource as PaypalRefund)];
    case "CUSTOMER.DISPUTE.CREATED":
    case "CUSTOMER.DISPUTE.UPDATED":
    case "CUSTOMER.DISPUTE.RESOLVED":
      return [mapDispute(evt.resource as PaypalDispute, evt.event_type)];
    default:
      return [{ kind: "ignored" }];
  }
}
