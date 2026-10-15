"use server";

import { redirect } from "next/navigation";
import { requireBuyerFor } from "@/lib/buyer-access";
import { appUrl } from "@/lib/env";
import { captureError } from "@/lib/monitoring";
import { paymentProvider } from "@/lib/payments";
import { renewalPeriodKey } from "@/lib/payments/renewal";
import { canAcceptPayments } from "@/lib/payouts";
import { findPastDueSubscription, renewalAmounts, settleRenewalCharge } from "@/lib/subscriptions";

/**
 * «Pagar ahora»: la renovación no se pudo cobrar con la tarjeta guardada y la clienta la paga con
 * ella delante (en la página de Stripe, donde también puede cambiar de tarjeta y confirmar 3DS).
 * La suscripción se busca por la usuaria de la sesión: nadie puede pagar (ni ver) la de otra.
 */
export async function payRenewalNow(form: FormData) {
  const productId = String(form.get("productId") ?? "");
  // También desde el enlace personal del email (sesión limitada al pedido de esta membresía).
  const { user } = await requireBuyerFor({ productId }, `/cuenta/membresias/${productId}`);
  const back = (k: "ok" | "error", msg: string) => redirect(`/cuenta/membresias/${productId}?${k === "ok" ? "pago=ok" : `error=${encodeURIComponent(msg)}`}`);
  const sub = await findPastDueSubscription(user.id, productId);
  if (!sub) redirect(`/cuenta/membresias/${productId}`);

  const provider = paymentProvider();
  if (!sub.creator.payoutAccountId || !canAcceptPayments(sub.creator, provider.key))
    back("error", "Ahora mismo no se pueden hacer pagos a esta creadora. Inténtalo más tarde.");

  const periodKey = renewalPeriodKey(sub.currentPeriodEnd);
  const amounts = await renewalAmounts(sub, new Date());
  // Sin kind=renewal: si este pago falla no cuenta como intento automático fallido.
  const metadata = { subscriptionId: sub.id, periodKey };
  const r = await provider.startPayment({
    subscriptionId: sub.id,
    periodKey,
    amountCents: sub.priceCents,
    currency: sub.product.currency,
    description: `Renovación · ${sub.product.title}`,
    customerEmail: sub.customer.email,
    customerRef: sub.providerCustomerRef,
    platformFeeCents: amounts.platformRetainedCents,
    destinationAccount: sub.creator.payoutAccountId!,
    statementSuffix: sub.creator.username.toUpperCase(),
    saveForFutureUse: true,
    // Solo lo lee el simulador: una tarjeta de prueba que se aprueba (y sustituye a la que falló).
    payment: { method: "card", cardNumber: "4242424242424242" },
    returnUrl: `${appUrl()}/api/payments/return?ref={REF}`,
    cancelUrl: `${appUrl()}/cuenta/membresias/${productId}`,
    metadata,
  });

  if (r.state === "requires_action") redirect(r.redirectUrl);
  if (r.state === "failed") back("error", r.error);
  if (r.state === "processing") back("error", "Tu banco está confirmando el pago. Te avisaremos por email.");
  if (r.state === "succeeded") {
    let settled;
    try {
      // Si el cron cobró este periodo mientras tanto, este segundo cobro se devuelve.
      settled = await settleRenewalCharge(sub.id, sub.currentPeriodEnd, r.ref, { customerRef: r.customerRef, paymentMethodRef: r.paymentMethodRef });
    } catch (e) {
      captureError(e, { area: "renovaciones", extra: { subscriptionId: sub.id } });
      throw e;
    }
    if (settled === "refunded") back("error", "Esta renovación ya estaba pagada: te hemos devuelto este cobro.");
  }
  back("ok", "");
}
