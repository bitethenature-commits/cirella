/**
 * Consentimientos del checkout (TRLGDCU arts. 98.7 y 103.a/m; RGPD art. 7). Puro: lo usan la
 * acción del checkout y las pruebas unitarias.
 *   · condiciones de venta: obligatorias;
 *   · renuncia al desistimiento: obligatoria según el tipo de producto (lib/legal.ts → waiverKindFor);
 *   · novedades por email: opcional.
 */
import { WAIVER_TEXT, waiverKindFor, type WaiverKind } from "./legal";

export type CheckoutConsents = { waiverKind: WaiverKind | null; waiverText: string | null; marketingOptIn: boolean };

export const TERMS_REQUIRED_ERROR = "Acepta las condiciones de venta para continuar";

const WAIVER_REQUIRED_ERROR: Record<WaiverKind, string> = {
  DIGITAL_IMMEDIATE: "Para acceder ahora necesitamos tu consentimiento de acceso inmediato",
  SERVICE_IN_PERIOD: "Marca la casilla sobre el plazo de desistimiento para reservar la sesión",
};

export function parseCheckoutConsents(
  input: Record<string, unknown>,
  productType: string,
  /** Entrega del producto digital: «Lo preparo yo» (PERSONAL) no pide la renuncia de acceso inmediato. */
  deliveryMode?: string | null,
): { ok: true; consents: CheckoutConsents } | { ok: false; error: string } {
  if (input.acceptTerms !== "on") return { ok: false, error: TERMS_REQUIRED_ERROR };
  const kind = waiverKindFor(productType, deliveryMode);
  if (kind && input.waiver !== "on") return { ok: false, error: WAIVER_REQUIRED_ERROR[kind] };
  return {
    ok: true,
    consents: { waiverKind: kind, waiverText: kind ? WAIVER_TEXT[kind] : null, marketingOptIn: input.newsletter === "on" },
  };
}
