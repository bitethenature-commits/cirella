/**
 * Abstracción de pasarela de pago.
 *
 * El MVP usa `simulated` (cobro instantáneo, sin dinero real). El resto del
 * sistema solo conoce esta interfaz y la función `fulfillOrder` (lib/orders.ts),
 * que es lo que también llamaría un webhook real.
 *
 * Integración prevista con Stripe Connect:
 *   1. Onboarding de la creadora → cuenta Express (payoutAccountId = acct_...).
 *   2. Checkout → PaymentIntent con `application_fee_amount = platformFeeCents`
 *      y `transfer_data.destination = payoutAccountId`.
 *   3. Webhook `payment_intent.succeeded` → fulfillOrder(orderId, intent.id).
 *   4. Membresías → Stripe Billing; `invoice.paid` renueva, `customer.subscription.deleted` cancela.
 */

export type PaymentMethodInput = {
  method: "card" | "wallet";
  cardNumber?: string;
};

export type ChargeInput = {
  orderId: string;
  amountCents: number;
  currency: string;
  description: string;
  customerEmail: string;
  platformFeeCents: number;
  destinationAccount: string | null;
  payment: PaymentMethodInput;
};

export type ChargeResult = { ok: true; ref: string } | { ok: false; error: string };

export interface PaymentProvider {
  key: string;
  label: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
  connectAccount(creatorId: string): Promise<{ accountId: string }>;
}
