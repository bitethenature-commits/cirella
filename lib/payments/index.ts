import { appEnv, env, type AppEnv } from "../env";
import type { PaymentProvider } from "./provider";
import { simulatedProvider } from "./simulated";
import { stripeProvider } from "./stripe";

const providers: Record<"simulated" | "stripe", PaymentProvider> = {
  simulated: simulatedProvider,
  stripe: stripeProvider,
};

/**
 * Pasarela configurada en PAYMENT_PROVIDER. Sin valor por defecto a propósito: si falta la
 * pasarela, la compra falla en vez de entregar gratis. El pago simulado nunca vale en producción.
 */
export function selectPaymentProviderKey(key: string | undefined, envName: AppEnv): "simulated" | "stripe" {
  if (!key) throw new Error("Falta PAYMENT_PROVIDER: no se puede cobrar sin pasarela de pago.");
  if (key !== "simulated" && key !== "stripe") throw new Error(`PAYMENT_PROVIDER="${key}" no existe (usa simulated o stripe).`);
  if (key === "simulated" && (envName === "production" || envName === "staging")) throw new Error("El pago simulado está prohibido en producción.");
  return key;
}

export function paymentProvider(): PaymentProvider {
  return providers[selectPaymentProviderKey(env().PAYMENT_PROVIDER, appEnv())];
}

export type { PaymentProvider, PaymentMethodInput } from "./provider";
