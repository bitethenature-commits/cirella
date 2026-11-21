import Stripe from "stripe";
import { env } from "../env";
import { isPersonalMode } from "../site-mode";

let client: Stripe | undefined;

/**
 * Cliente de la cuenta de plataforma de Cirella o, en la web personal, de la cuenta de la dueña
 * (se crea al primer uso). Sin apiVersion: se usa la
 * versión fijada por el SDK (stripe@22.6.2), que es la que hay que elegir al crear los webhooks.
 * instrumentation.ts (lib/env.ts) ya exige STRIPE_SECRET_KEY cuando PAYMENT_PROVIDER=stripe.
 */
export function stripeClient(): Stripe {
  if (!client) {
    const key = env().STRIPE_SECRET_KEY;
    if (!key) throw new Error("Falta STRIPE_SECRET_KEY.");
    client = new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: "Cirella" } });
  }
  return client;
}

export type StripeConfig = {
  /** Secretos de firma de los dos endpoints: plataforma y cuentas conectadas (Connect). */
  webhookSecrets: string[];
  /** STRIPE_ON_BEHALF_OF=true: la creadora es la comerciante de liquidación (su nombre en el extracto). */
  onBehalfOf: boolean;
  /**
   * true en la plataforma (Connect, cargos de destino). false en la web personal: la cuenta es de la
   * dueña y cobra directamente, sin comisión, transferencias ni cuentas conectadas.
   */
  connect: boolean;
};

export function stripeConfig(): StripeConfig {
  const e = env();
  const connect = !isPersonalMode();
  return {
    webhookSecrets: [e.STRIPE_WEBHOOK_SECRET, connect ? e.STRIPE_CONNECT_WEBHOOK_SECRET : undefined].filter((s): s is string => !!s),
    onBehalfOf: connect && e.STRIPE_ON_BEHALF_OF === "true",
    connect,
  };
}
