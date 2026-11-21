import { appEnv, env, parsePaymentProviders, type AppEnv, type ChargeProviderKey } from "../env";
import { siteMode, type SiteMode } from "../site-mode";
import { paypalProvider } from "./paypal";
import type { PaymentProvider } from "./provider";
import { simulatedProvider } from "./simulated";
import { stripeProvider } from "./stripe";

const providers: Record<ChargeProviderKey, PaymentProvider> = {
  simulated: simulatedProvider,
  stripe: stripeProvider,
  paypal: paypalProvider,
};

export type { ChargeProviderKey };
/** «none»: esta web no cobra (modo personal; lo de pago se cobra fuera, en la web de cada producto). */
export type PaymentProviderKey = ChargeProviderKey | "none";

/** Lo que ve quien intenta pagar en una web sin pasarela. */
export const NO_ONLINE_PAYMENTS = "Esta web no cobra pagos online";

/** paymentProvider() en una web sin pasarela: nunca se cae a otra en silencio. */
export class NoPaymentProviderError extends Error {
  constructor() {
    super(NO_ONLINE_PAYMENTS);
    this.name = "NoPaymentProviderError";
  }
}

/**
 * Pasarelas configuradas en PAYMENT_PROVIDER (una, varias separadas por comas o «none» = ninguna).
 * Sin valor por defecto a propósito: si falta la pasarela, la compra falla en vez de entregar gratis.
 * El pago simulado nunca vale en producción; «none» (sin cobros) y PayPal solo en modo personal.
 */
export function selectPaymentProviders(value: string | undefined, envName: AppEnv, mode: SiteMode = "platform"): ChargeProviderKey[] {
  if (!value?.trim()) throw new Error("Falta PAYMENT_PROVIDER: no se puede cobrar sin pasarela de pago.");
  const r = parsePaymentProviders(value);
  if (!r.ok) throw new Error(r.error);
  const prod = envName === "production" || envName === "staging";
  if (r.keys.includes("simulated") && prod) throw new Error("El pago simulado está prohibido en producción.");
  if (!r.keys.length && prod && mode !== "personal") throw new Error("PAYMENT_PROVIDER=none solo se admite en producción en modo personal.");
  if (r.keys.includes("paypal") && mode !== "personal") throw new Error("PayPal solo se admite en modo personal.");
  return r.keys;
}

/** La pasarela principal (la primera; la de tarjeta si hay varias) o «none». */
export function selectPaymentProviderKey(value: string | undefined, envName: AppEnv, mode: SiteMode = "platform"): PaymentProviderKey {
  return selectPaymentProviders(value, envName, mode)[0] ?? "none";
}

/** Pasarelas con las que se cobra ahora (vacía con PAYMENT_PROVIDER=none). */
export function paymentProviderKeys(): ChargeProviderKey[] {
  return selectPaymentProviders(env().PAYMENT_PROVIDER, appEnv(), siteMode());
}

/** Clave de la pasarela principal, «none» incluida. Para comparar sin pedir la pasarela. */
export function paymentProviderKey(): PaymentProviderKey {
  return paymentProviderKeys()[0] ?? "none";
}

/** ¿Cobra esta web? false con PAYMENT_PROVIDER=none: todo checkout de pago se cierra. */
export function hasPaymentProvider() {
  return paymentProviderKeys().length > 0;
}

/** ¿Esta pasarela está activa ahora? (un pedido viejo puede ser de otra). */
export function isPaymentProviderEnabled(key: string): key is ChargeProviderKey {
  return (paymentProviderKeys() as string[]).includes(key);
}

/**
 * ¿Hay checkout de pago en esta web? Siempre que haya pasarela: en la plataforma, Stripe Connect;
 * en la web personal, la cuenta de Stripe y/o de PayPal de la dueña. Sin pasarela, nunca.
 */
export function paidCheckoutOpen() {
  return hasPaymentProvider();
}

/** La pasarela principal. Con PAYMENT_PROVIDER=none lanza NoPaymentProviderError. */
export function paymentProvider(): PaymentProvider {
  const key = paymentProviderKey();
  if (key === "none") throw new NoPaymentProviderError();
  return providers[key];
}

/**
 * La pasarela con la que se cobró algo (Order.paymentProvider, Subscription.provider): un reembolso
 * o una renovación siempre van por ella, aunque PAYMENT_PROVIDER haya cambiado después. Sin
 * alternativa silenciosa: una clave desconocida lanza.
 */
export function paymentProviderByKey(key: string): PaymentProvider {
  if (!(key in providers)) throw new Error(`Pasarela de pago desconocida: «${key}».`);
  return providers[key as ChargeProviderKey];
}

/** Métodos que elige la compradora en el checkout (uno por pasarela activa), en orden. */
export type CheckoutMethod = { key: ChargeProviderKey; collectsCardOnSite: boolean };

export function checkoutMethods(): CheckoutMethod[] {
  return paymentProviderKeys().map((key) => ({ key, collectsCardOnSite: providers[key].collectsCardOnSite }));
}

/**
 * Pasarela elegida en el checkout: la pedida si está activa; sin elección, la principal. null si
 * pide una que no está activa (un formulario viejo o manipulado).
 */
export function chooseCheckoutProvider(requested: string | null | undefined): ChargeProviderKey | null {
  const keys = paymentProviderKeys();
  if (!requested) return keys[0] ?? null;
  return (keys as string[]).includes(requested) ? (requested as ChargeProviderKey) : null;
}

export type {
  PaymentMethodInput,
  PaymentProvider,
  PaymentState,
  PaymentStatus,
  PaymentUpdate,
  PayoutAccountSnapshot,
  RefundInput,
  StartPaymentInput,
  StartPaymentResult,
} from "./provider";
export { WebhookSignatureError } from "./provider";
