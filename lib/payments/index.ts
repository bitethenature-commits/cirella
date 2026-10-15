import { appEnv, env, type AppEnv } from "../env";
import { isPersonalMode, siteMode, type SiteMode } from "../site-mode";
import type { PaymentProvider } from "./provider";
import { simulatedProvider } from "./simulated";
import { stripeProvider } from "./stripe";

const providers: Record<"simulated" | "stripe", PaymentProvider> = {
  simulated: simulatedProvider,
  stripe: stripeProvider,
};

/** «none»: esta web no cobra (modo personal; lo de pago se cobra fuera, en la web de cada producto). */
export type PaymentProviderKey = "simulated" | "stripe" | "none";

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
 * Pasarela configurada en PAYMENT_PROVIDER. Sin valor por defecto a propósito: si falta la
 * pasarela, la compra falla en vez de entregar gratis. El pago simulado nunca vale en producción
 * y «none» (sin cobros) solo vale en producción en modo personal.
 */
export function selectPaymentProviderKey(key: string | undefined, envName: AppEnv, mode: SiteMode = "platform"): PaymentProviderKey {
  if (!key) throw new Error("Falta PAYMENT_PROVIDER: no se puede cobrar sin pasarela de pago.");
  if (key !== "simulated" && key !== "stripe" && key !== "none") throw new Error(`PAYMENT_PROVIDER="${key}" no existe (usa simulated, stripe o none).`);
  const prod = envName === "production" || envName === "staging";
  if (key === "simulated" && prod) throw new Error("El pago simulado está prohibido en producción.");
  if (key === "none" && prod && mode !== "personal") throw new Error("PAYMENT_PROVIDER=none solo se admite en producción en modo personal.");
  return key;
}

/** Clave de la pasarela actual, «none» incluida. Para comparar sin pedir la pasarela. */
export function paymentProviderKey(): PaymentProviderKey {
  return selectPaymentProviderKey(env().PAYMENT_PROVIDER, appEnv(), siteMode());
}

/** ¿Cobra esta web? false con PAYMENT_PROVIDER=none: todo checkout de pago se cierra. */
export function hasPaymentProvider() {
  return paymentProviderKey() !== "none";
}

/**
 * ¿Hay checkout de pago en esta web? Nunca en modo personal (aunque haya pasarela configurada, p. ej.
 * pagos simulados en local: lo de pago se cobra fuera) ni sin pasarela.
 */
export function paidCheckoutOpen() {
  return !isPersonalMode() && hasPaymentProvider();
}

/** La pasarela con la que se cobra. Con PAYMENT_PROVIDER=none lanza NoPaymentProviderError. */
export function paymentProvider(): PaymentProvider {
  const key = paymentProviderKey();
  if (key === "none") throw new NoPaymentProviderError();
  return providers[key];
}

/**
 * La pasarela con la que se cobró algo (Order.paymentProvider): un reembolso siempre va por ella,
 * aunque PAYMENT_PROVIDER haya cambiado después. Sin alternativa silenciosa: una clave desconocida lanza.
 */
export function paymentProviderByKey(key: string): PaymentProvider {
  if (key !== "simulated" && key !== "stripe") throw new Error(`Pasarela de pago desconocida: «${key}».`);
  return providers[key];
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
