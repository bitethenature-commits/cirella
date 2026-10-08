import type { PaymentProvider } from "./provider";
import { simulatedProvider } from "./simulated";
import { stripeProvider } from "./stripe";

const providers: Record<string, PaymentProvider> = {
  simulated: simulatedProvider,
  stripe: stripeProvider,
};

export function paymentProvider(): PaymentProvider {
  return providers[process.env.PAYMENT_PROVIDER ?? "simulated"] ?? simulatedProvider;
}

export type { PaymentProvider, PaymentMethodInput } from "./provider";
