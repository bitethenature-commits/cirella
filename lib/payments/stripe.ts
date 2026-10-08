import type { PaymentProvider } from "./provider";

/**
 * Esqueleto de Stripe Connect. Ver lib/payments/provider.ts para el flujo.
 * Se activa con PAYMENT_PROVIDER=stripe una vez implementado.
 */
export const stripeProvider: PaymentProvider = {
  key: "stripe",
  label: "Stripe",
  async charge() {
    throw new Error("Stripe aún no está configurado. Usa PAYMENT_PROVIDER=simulated.");
  },
  async connectAccount() {
    throw new Error("Stripe Connect aún no está configurado.");
  },
};
