/**
 * ¿Se vende en esta web? Une el modo del sitio (lib/site-mode.ts) y las pasarelas (lib/payments):
 *   · plataforma: se vende siempre (Stripe Connect o el simulador);
 *   · web personal con pasarela (PAYMENT_PROVIDER=stripe,paypal…): la dueña vende con sus cuentas;
 *   · web personal sin pasarela (PAYMENT_PROVIDER=none): solo inscripciones gratis, accesos dados a
 *     mano y botones a otras webs donde se paga. Es lo que antes era «modo personal» a secas.
 * Las pantallas preguntan aquí lo que depende de vender (Ventas o Inscripciones, condiciones de
 * venta, productos de pago visibles…) y a isPersonalMode() lo que depende de la marca (sin Cirella,
 * sin planes ni registro).
 */
import { legalKind, type LegalKind } from "./legal-templates";
import { hasPaymentProvider, paymentProviderKeys } from "./payments";
import { isPersonalMode } from "./site-mode";

/** Web personal que no cobra: solo inscripciones gratis, accesos a mano y pagos en otras webs. */
export function signupsOnly(): boolean {
  return isPersonalMode() && !hasPaymentProvider();
}

/** Web personal que cobra con las cuentas de Stripe y/o PayPal de la dueña. */
export function personalSales(): boolean {
  return isPersonalMode() && hasPaymentProvider();
}

/** Qué textos legales lleva la página ahora (lib/legal-templates.ts). */
export function currentLegalKind(): LegalKind {
  return legalKind(isPersonalMode(), paymentProviderKeys());
}
