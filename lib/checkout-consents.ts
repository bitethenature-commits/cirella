/**
 * Consentimientos del checkout (TRLGDCU arts. 98.7 y 103.a/m; RGPD art. 7). Puro: lo usan la
 * acción del checkout, el inicio del pago (lib/orders.ts) y las pruebas unitarias.
 *   · condiciones de venta: obligatorias;
 *   · casilla del desistimiento: obligatoria según el producto (lib/legal.ts → waiverKindFor):
 *     renuncia en descargas, cursos y «Lo preparo yo»; reconocimiento de que un taller no admite
 *     desistimiento; petición de empezar ya una membresía (con reembolso proporcional si desiste);
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
  WORKSHOP_FIXED_DATE: "Para reservar tu plaza, marca la casilla que confirma que el taller tiene fecha fija y no admite desistimiento",
  MEMBERSHIP_START: "Para empezar tu membresía, marca la casilla para acceder en cuanto pagues (con reembolso proporcional si desistes)",
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
  /** Taller (sesión en grupo con fecha fija): pide siempre su casilla. */
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
  product: { type: string; deliveryMode?: string | null; groupSession?: boolean | null },
  at: Date,
) {
  const r = parseCheckoutConsents({ acceptTerms: "on", waiver: "on" }, product.type, product.deliveryMode, { groupSession: product.groupSession });
  if (!r.ok) throw new Error(r.error);
  const c = r.consents;
  return { termsAcceptedAt: at, waiverKind: c.waiverKind, waiverText: c.waiverText, waiverVersion: c.waiverVersion, waiverAcceptedAt: c.waiverKind ? at : null };
}
