/**
 * Abstracción de pasarela de pago. Dos implementaciones: `stripe` (producción) y `simulated`
 * (demo y desarrollo, mismo ciclo de vida sin dinero real).
 *
 * Flujo de una venta:
 *   1. startOrderPayment (lib/orders.ts) → startPayment: con Stripe se crea un Checkout alojado
 *      (tarjeta, Apple Pay y Google Pay; 3DS lo gestiona Stripe y ningún dato de tarjeta pasa por
 *      nuestro servidor) y la compradora sale a la página de Stripe.
 *   2. Stripe avisa (webhook /api/webhooks/stripe) y la compradora vuelve por
 *      /api/payments/return. Las dos vías traducen lo ocurrido a un PaymentUpdate neutro y llaman
 *      a applyPaymentUpdate (lib/payments/events.ts), que comprueba importe y cuenta de destino
 *      y entrega con fulfillOrder. Llegue primero lo que llegue, la venta se entrega una vez.
 *   3. Cargos de destino (Connect): el cobro es de la cuenta de Cirella, `application_fee_amount`
 *      es su comisión y el resto se transfiere a la cuenta Express de la creadora.
 *
 * Membresías: la tarjeta se guarda en el primer pago (setup_future_usage) y cada renovación es un
 * cargo sin la clienta delante (chargeSaved). Cuentas de cobro: alta Express con formulario de
 * Stripe, y su estado se sincroniza con lib/payouts.ts.
 */

export type PaymentState = "succeeded" | "processing" | "requires_action" | "failed" | "canceled";

/** Lo que el checkout del simulador envía. La pasarela real nunca recibe datos de tarjeta. */
export type PaymentMethodInput = { method?: "card" | "wallet"; cardNumber?: string };

export type StartPaymentInput = {
  orderId?: string;
  subscriptionId?: string;
  periodKey?: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerRef?: string | null;
  platformFeeCents: number;
  destinationAccount: string;
  statementSuffix?: string;
  saveForFutureUse: boolean;
  payment: PaymentMethodInput;
  /** Contiene {REF}: la pasarela lo sustituye por la referencia del checkout. */
  returnUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

export type StartPaymentResult =
  | { state: "succeeded"; ref: string; checkoutRef?: string; customerRef?: string; paymentMethodRef?: string }
  | { state: "processing"; ref: string; checkoutRef?: string }
  | { state: "requires_action"; checkoutRef: string; redirectUrl: string; expiresAt: Date }
  | { state: "failed"; error: string; ref?: string };

export type PaymentStatus = {
  state: PaymentState;
  /** Referencia final del cobro (pi_… / sim_ch_…). */
  ref?: string;
  checkoutRef?: string;
  amountCents: number;
  currency: string;
  destinationAccount: string | null;
  customerRef?: string;
  paymentMethodRef?: string;
  metadata: Record<string, string>;
  error?: string;
};

export type PayoutAccountSnapshot = {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  currentlyDue: string[];
  pastDue: string[];
  eventuallyDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
  /** ISO 8601 */
  currentDeadline: string | null;
};

export type RefundUpdateStatus = "pending" | "succeeded" | "failed" | "canceled";

/** Un aviso de la pasarela traducido a algo que no depende de Stripe. */
export type PaymentUpdate =
  | { kind: "payment"; status: PaymentStatus }
  | { kind: "refund"; paymentRef: string; refundRef: string; amountCents: number; status: RefundUpdateStatus }
  | { kind: "dispute"; paymentRef: string; disputeRef: string; status: "OPEN" | "WON" | "LOST"; amountCents: number; reason?: string }
  | { kind: "account"; accountId: string }
  | { kind: "ignored" };

export type RefundInput = {
  paymentRef: string;
  /** Sin importe = reembolso total. */
  amountCents?: number;
  /** ¿Devuelve Cirella también su comisión? (decisión pendiente, ver docs/pagos-stripe.md) */
  refundApplicationFee: boolean;
  idempotencyKey: string;
  metadata?: Record<string, string>;
};

export type ChargeSavedInput = Omit<StartPaymentInput, "payment" | "returnUrl" | "cancelUrl" | "saveForFutureUse"> & {
  customerRef: string | null;
  paymentMethodRef: string | null;
  idempotencyKey: string;
};

export type ParsedWebhook = { eventId: string; type: string; accountId: string | null; updates: PaymentUpdate[] };

export interface PaymentProvider {
  key: "simulated" | "stripe";
  label: string;
  /** true = el checkout pide la tarjeta en nuestra página (solo el simulador). */
  collectsCardOnSite: boolean;
  startPayment(i: StartPaymentInput): Promise<StartPaymentResult>;
  getPaymentStatus(checkoutOrPaymentRef: string): Promise<PaymentStatus>;
  cancelCheckout(checkoutRef: string): Promise<void>;
  chargeSaved(i: ChargeSavedInput): Promise<StartPaymentResult>;
  refund(i: RefundInput): Promise<{ ok: true; refundRef: string; status: "pending" | "succeeded" } | { ok: false; error: string }>;
  createPayoutAccount(i: { creatorId: string; email: string; country: string; pageUrl: string }): Promise<{ accountId: string }>;
  payoutOnboardingUrl(i: { accountId: string; returnUrl: string; refreshUrl: string }): Promise<string>;
  getPayoutAccount(accountId: string): Promise<PayoutAccountSnapshot>;
  payoutDashboardUrl(accountId: string): Promise<string | null>;
  parseWebhook(rawBody: string, headers: Headers): Promise<ParsedWebhook>;
}

/** La firma del aviso no es válida (o no viene de Stripe): se responde 400. */
export class WebhookSignatureError extends Error {}
