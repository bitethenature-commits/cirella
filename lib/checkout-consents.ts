/**
 * Consentimientos del checkout (TRLGDCU arts. 98.7 y 103.a/m; RGPD art. 7). Puro: lo usan la
 * acción del checkout, el inicio del pago (lib/orders.ts) y las pruebas unitarias.
 *   · condiciones de venta: obligatorias;
 *   · renuncia al desistimiento: obligatoria según el producto (lib/legal.ts → waiverKindFor):
 *     todo lo de pago que no es una sesión en directo y los talleres a menos de 15 días;
 *   · novedades por email: opcional.
 *
 * Como prueba se guarda en el pedido el momento, el texto literal de la casilla y su versión
 * (WAIVER_TEXT_VERSION + la huella SHA-256 del texto): Order.waiverAcceptedAt, waiverText y waiverVersion.
 */
import { createHash } from "node:crypto";
import { WAIVER_TEXT, WAIVER_TEXT_VERSION, waiverKindFor, type WaiverKind, type WorkshopWaiverContext } from "./legal";

export type CheckoutConsents = { waiverKind: WaiverKind | null; waiverText: string | null; waiverVersion: string | null; marketingOptIn: boolean };

export const TERMS_REQUIRED_ERROR = "Acepta las condiciones de venta para continuar";

export const WAIVER_REQUIRED_ERROR: Record<WaiverKind, string> = {
  DIGITAL_IMMEDIATE: "Para pagar, marca la casilla de acceso inmediato y renuncia al desistimiento",
  DIGITAL_PREPARED: "Para pagar, marca la casilla para que se prepare ya y renuncia al desistimiento",
  SERVICE_IN_PERIOD: "El taller es dentro de menos de 15 días: marca la casilla sobre el plazo de desistimiento para reservar tu plaza",
};

/** «2026-10-25#1a2b3c4d5e6f7a8b»: versión de los textos y huella del texto exacto aceptado. */
export function waiverVersionOf(text: string): string {
  return `${WAIVER_TEXT_VERSION}#${createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16)}`;
}

export function parseCheckoutConsents(
  input: Record<string, unknown>,
  productType: string,
  /** Entrega del producto digital: «Lo preparo yo» (PERSONAL) pide su propia casilla. */
  deliveryMode?: string | null,
  /** Taller: su fecha y «ahora» (a menos de 15 días pide la casilla de servicio en plazo). */
  workshop?: WorkshopWaiverContext | null,
): { ok: true; consents: CheckoutConsents } | { ok: false; error: string } {
  if (input.acceptTerms !== "on") return { ok: false, error: TERMS_REQUIRED_ERROR };
  const kind = waiverKindFor(productType, deliveryMode, workshop);
  if (kind && input.waiver !== "on") return { ok: false, error: WAIVER_REQUIRED_ERROR[kind] };
  const text = kind ? WAIVER_TEXT[kind] : null;
  return {
    ok: true,
    consents: { waiverKind: kind, waiverText: text, waiverVersion: text ? waiverVersionOf(text) : null, marketingOptIn: input.newsletter === "on" },
  };
}

/**
 * Campos del pedido de quien marca todas las casillas obligatorias en `at` (lo que guarda la acción
 * del checkout). Lo usan la demo y las pruebas que pagan sin pasar por el formulario.
 */
export function acceptedConsentFields(
  product: { type: string; deliveryMode?: string | null; groupSession?: boolean | null; eventStartAt?: Date | null },
  at: Date,
  timezone?: string | null,
) {
  const r = parseCheckoutConsents({ acceptTerms: "on", waiver: "on" }, product.type, product.deliveryMode, {
    groupSession: product.groupSession,
    eventStartAt: product.eventStartAt,
    now: at,
    timezone,
  });
  if (!r.ok) throw new Error(r.error);
  const c = r.consents;
  return { termsAcceptedAt: at, waiverKind: c.waiverKind, waiverText: c.waiverText, waiverVersion: c.waiverVersion, waiverAcceptedAt: c.waiverKind ? at : null };
}
