/**
 * Reglas legales de la venta online (LSSI art. 10, TRLGDCU arts. 97-108, RGPD art. 7).
 *
 * Funciones puras: sin BD ni servidor, para poder usarlas en componentes cliente y en las pruebas
 * unitarias. Los textos de las casillas son borradores: deben revisarse con una asesoría antes de
 * lanzar (ver README, «Cumplimiento legal»).
 */

import { normalizeDeliveryMode } from "./delivery";
import { isWorkshopProduct } from "./withdrawal";

/** Versión de las plantillas de textos legales de las creadoras (lib/legal-templates.ts). */
export const LEGAL_TEMPLATE_VERSION = "2026-10e";
/** Versión de los Términos del servicio de la plataforma que aceptan las creadoras. */
export const PLATFORM_TERMS_VERSION = "2026-10-15";
/** La clienta puede cambiar la fecha de una sesión gratis hasta estas horas antes. */
export const SESSION_CHANGE_NOTICE_HOURS = 24;

export type LegalEntityType = "INDIVIDUAL" | "COMPANY";

export type LegalIdentity = {
  legalEntityType: string;
  legalName: string | null;
  legalTaxId: string | null;
  legalAddress: string | null;
  legalPostalCode: string | null;
  legalCity: string | null;
  legalCountry: string;
  legalEmail: string | null;
  legalRegistry: string | null;
};

/** Datos sin los que no se puede vender (el registro o colegio profesional es opcional). */
export const LEGAL_REQUIRED_FIELDS: (keyof LegalIdentity)[] = [
  "legalName",
  "legalTaxId",
  "legalAddress",
  "legalPostalCode",
  "legalCity",
  "legalCountry",
  "legalEmail",
];

export const LEGAL_FIELD_LABEL: Record<keyof LegalIdentity, string> = {
  legalEntityType: "tipo",
  legalName: "nombre fiscal",
  legalTaxId: "NIF",
  legalAddress: "dirección",
  legalPostalCode: "código postal",
  legalCity: "ciudad",
  legalCountry: "país",
  legalEmail: "email de contacto",
  legalRegistry: "datos registrales",
};

/** Países del desplegable de los datos legales (el resto, «Otro» con su código). */
export const LEGAL_COUNTRIES: [code: string, name: string][] = [
  ["ES", "España"], ["PT", "Portugal"], ["FR", "Francia"], ["IT", "Italia"], ["DE", "Alemania"], ["IE", "Irlanda"],
  ["NL", "Países Bajos"], ["BE", "Bélgica"], ["AT", "Austria"], ["AD", "Andorra"], ["MX", "México"], ["AR", "Argentina"],
  ["CO", "Colombia"], ["CL", "Chile"], ["US", "Estados Unidos"], ["GB", "Reino Unido"],
];

export function countryName(code: string) {
  return LEGAL_COUNTRIES.find(([c]) => c === code)?.[1] ?? code;
}

export function legalIdentityMissing(c: Partial<LegalIdentity>): (keyof LegalIdentity)[] {
  return LEGAL_REQUIRED_FIELDS.filter((k) => !String(c[k] ?? "").trim());
}

/** ¿Puede vender? Sin identidad completa no se cobra (checkout, alta de la cuenta de cobro). */
export function legalIdentityComplete(c: Partial<LegalIdentity>): boolean {
  return legalIdentityMissing(c).length === 0;
}

/** Mayúsculas, sin espacios, puntos ni guiones: « 12.345.678-z » → «12345678Z». */
export function normalizeTaxId(v: string): string {
  return v.toUpperCase().replace(/[\s.-]/g, "");
}

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const NIF_RE = /^\d{8}[A-Z]$/;
const NIE_RE = /^[XYZ]\d{7}[A-Z]$/;
const CIF_RE = /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/;

function dniLetterOk(digits: string, letter: string) {
  return DNI_LETTERS[Number(digits) % 23] === letter;
}

function cifOk(cif: string) {
  const type = cif[0];
  const digits = cif.slice(1, 8);
  const control = cif[8];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(digits[i]);
    // Posiciones impares (1.ª, 3.ª…): se doblan y se suman sus cifras; las pares, tal cual.
    if (i % 2 === 0) sum += Math.floor((n * 2) / 10) + ((n * 2) % 10);
    else sum += n;
  }
  const digit = (10 - (sum % 10)) % 10;
  const letter = "JABCDEFGHI"[digit];
  if ("PQRSNW".includes(type)) return control === letter;
  if ("ABEH".includes(type)) return control === String(digit);
  return control === letter || control === String(digit);
}

/**
 * NIF/NIE (persona física) o CIF/NIF (empresa) con su dígito de control. Fuera de España solo se
 * comprueba el formato. Devuelve el error en español o null.
 */
export function validateTaxId(country: string, entityType: string, value: string): string | null {
  const v = normalizeTaxId(value);
  if (!v) return "Escribe tu NIF, NIE o CIF";
  if (country !== "ES") return /^[A-Z0-9]{4,20}$/.test(v) ? null : "Identificación fiscal no válida";
  if (NIF_RE.test(v)) return dniLetterOk(v.slice(0, 8), v[8]) ? null : "Revisa el NIF: la letra no coincide";
  if (entityType === "COMPANY") {
    if (CIF_RE.test(v)) return cifOk(v) ? null : "Revisa el CIF";
    return "Identificación fiscal no válida";
  }
  if (NIE_RE.test(v)) return dniLetterOk(String("XYZ".indexOf(v[0])) + v.slice(1, 8), v[8]) ? null : "Revisa el NIE";
  return "Identificación fiscal no válida";
}

export function validatePostalCode(country: string, v: string): string | null {
  const s = v.trim();
  if (country === "ES") return /^\d{5}$/.test(s) ? null : "Código postal no válido";
  return s.length >= 2 && s.length <= 10 ? null : "Código postal no válido";
}

/** «Calle X 1, 28001 Madrid (España)» — aviso legal, recibos y facturas. */
export function formatLegalAddress(c: Partial<LegalIdentity>): string {
  const city = [c.legalPostalCode, c.legalCity].map((s) => s?.trim()).filter(Boolean).join(" ");
  const line = [c.legalAddress?.trim(), city].filter(Boolean).join(", ");
  const country = c.legalCountry ? countryName(c.legalCountry) : "";
  return country ? `${line}${line ? " " : ""}(${country})` : line;
}

export function taxIdLabel(entityType: string | undefined) {
  return entityType === "COMPANY" ? "CIF" : "NIF";
}

/** «Ana Luna Pérez · NIF 12345678Z» */
export function sellerLine(c: Partial<LegalIdentity>): string {
  return `${c.legalName ?? ""} · ${taxIdLabel(c.legalEntityType)} ${c.legalTaxId ?? ""}`.trim();
}

/** Datos de la plataforma como vendedora (lib/invoices/issuer.ts → getPlatformIssuer). */
export type PlatformSeller = { name: string; taxId: string | null };

/**
 * Quién vende, dicho igual en la ficha del producto, el checkout, el pie de las páginas de compra
 * y «Tu compra» (y en los mismos términos que la factura).
 *
 * Con la política de IVA PLATFORM_DIGITAL, los productos digitales que se entregan solos, los cursos
 * y las membresías los vende la plataforma (art. 9 bis del Reglamento de Ejecución (UE) 282/2011:
 * actúa en nombre propio y por cuenta de la creadora, cobra, factura y declara el IVA). Las sesiones
 * y lo que la creadora prepara a mano los vende ella. `taxSeller` es la decisión de lib/tax
 * (decideTax) o la instantánea del pedido (Order.taxSeller).
 *
 *   · name: corto, para el pie («Cirella Demo S.L., por cuenta de Ana Luna Pérez»).
 *   · line: con los NIF, para la ficha, el checkout y el recibo.
 */
export function sellerStatement(
  taxSeller: string | null | undefined,
  creator: Partial<LegalIdentity> & { displayName: string },
  platform: PlatformSeller | null,
): { name: string; line: string; platformSells: boolean } {
  const creatorName = creator.legalName?.trim() || creator.displayName;
  if (taxSeller === "PLATFORM" && platform) {
    const name = platform.name.trim();
    return {
      name: `${name}, por cuenta de ${creatorName}`,
      line: `${name}${platform.taxId ? ` · NIF ${platform.taxId}` : ""}, por cuenta de ${creatorName}`,
      platformSells: true,
    };
  }
  return { name: creatorName, line: creator.legalName?.trim() ? sellerLine(creator) : creatorName, platformSells: false };
}

export type WaiverKind = "DIGITAL_IMMEDIATE" | "DIGITAL_PREPARED" | "WORKSHOP_FIXED_DATE" | "MEMBERSHIP_START";

/**
 * Casillas de antes que pueden estar en pedidos antiguos (Order.waiverKind) pero ya no se piden:
 * «SERVICE_IN_PERIOD» (talleres a menos de 15 días, hasta 2026-10-27; las membresías llevaban
 * DIGITAL_IMMEDIATE). Esos pedidos siguen con las reglas que se les informaron.
 */
export const LEGACY_WAIVER_KINDS = ["SERVICE_IN_PERIOD"] as const;

/** Datos del producto que deciden la casilla de un taller (sesión en grupo con fecha fija). */
export type WorkshopWaiverContext = { groupSession?: boolean | null };

/**
 * Casilla obligatoria que pide cada compra de pago en la web (TRLGDCU arts. 103 y 108):
 *   · DIGITAL_IMMEDIATE: descargas y cursos. Acceso en cuanto se paga y renuncia (art. 103.m).
 *   · DIGITAL_PREPARED: lo que la dueña prepara a mano («Lo preparo yo»). Se empieza a preparar en
 *     cuanto se paga y se entrega dentro del plazo; renuncia (art. 103.m).
 *   · WORKSHOP_FIXED_DATE: un taller (sesión en grupo con fecha fija), queden los días que queden.
 *     Actividad de esparcimiento con fecha de ejecución específica: no hay derecho de desistimiento
 *     (art. 103.l); la casilla deja constancia de que se le informó antes de pagar.
 *   · MEMBERSHIP_START: una membresía. Pide empezar ya, dentro del plazo (art. 98.8); NO es una
 *     renuncia: si desiste en los 14 días se le devuelve la parte de los días no disfrutados
 *     (art. 108.3, lib/withdrawal.ts → membershipWithdrawalRefund). Las renovaciones no pasan por el
 *     checkout ni dan un nuevo plazo.
 *   · null: las sesiones individuales (se reservan a partir del día 15, fuera del plazo): 14 días
 *     para desistir con el reembolso completo.
 * Lo gratuito y lo que da la dueña a mano no pasan por el checkout.
 */
export function waiverKindFor(productType: string, deliveryMode?: string | null, workshop?: WorkshopWaiverContext | null): WaiverKind | null {
  if (productType === "DIGITAL" && normalizeDeliveryMode(productType, deliveryMode) === "PERSONAL") return "DIGITAL_PREPARED";
  if (productType === "DIGITAL" || productType === "COURSE") return "DIGITAL_IMMEDIATE";
  if (productType === "MEMBERSHIP") return "MEMBERSHIP_START";
  if (isWorkshopProduct({ type: productType, groupSession: workshop?.groupSession })) return "WORKSHOP_FIXED_DATE";
  return null;
}

/** ¿La casilla es una renuncia al desistimiento (lo digital), y no un reconocimiento o una petición? */
export function isWaiverOfRight(kind: string | null | undefined): boolean {
  return kind === "DIGITAL_IMMEDIATE" || kind === "DIGITAL_PREPARED";
}

/**
 * Textos literales de las casillas. Se guardan tal cual en el pedido con su versión
 * (WAIVER_TEXT_VERSION) y se citan en el recibo. Si cambias alguno, sube WAIVER_TEXT_VERSION.
 */
export const WAIVER_TEXT: Record<WaiverKind, string> = {
  DIGITAL_IMMEDIATE:
    "Quiero acceder ya al contenido: doy mi consentimiento expreso para recibirlo en cuanto pague, dentro del plazo de desistimiento de 14 días, y acepto que con ello pierdo mi derecho de desistimiento.",
  DIGITAL_PREPARED:
    "Quiero que se prepare ya: doy mi consentimiento expreso para que se empiece a preparar en cuanto pague y se me entregue dentro del plazo de desistimiento de 14 días, y acepto que con ello pierdo mi derecho de desistimiento.",
  WORKSHOP_FIXED_DATE:
    "Entiendo que este taller se celebra en una fecha fija y que, por ser una actividad de esparcimiento con fecha de realización determinada, no tengo derecho de desistimiento (art. 103 l) de la Ley General para la Defensa de los Consumidores y Usuarios).",
  MEMBERSHIP_START:
    "Quiero empezar ya: solicito expresamente acceder a la membresía en cuanto pague, dentro del plazo de desistimiento de 14 días. Sé que si desisto en ese plazo solo se me devolverá la parte proporcional de los días que no haya disfrutado.",
};

/**
 * Lo que se dice antes de pagar (ficha del producto y checkout), además de la casilla: la
 * información precontractual sobre el desistimiento (art. 97.1.l y m) según la casilla que pide
 * (waiverKindFor). null = nada más que decir aquí.
 */
export function withdrawalInfoLine(kind: WaiverKind | null): string | null {
  if (kind === "WORKSHOP_FIXED_DATE")
    return "Taller con fecha fija: no tiene derecho de desistimiento (art. 103 l) de la Ley General para la Defensa de los Consumidores y Usuarios).";
  if (kind === "MEMBERSHIP_START")
    return "Empiezas en cuanto pagas. Si desistes en los 14 días siguientes al primer pago, te devolvemos la parte proporcional de los días que no hayas disfrutado y la membresía termina en ese momento. Las renovaciones no dan un nuevo plazo; puedes cancelar cuando quieras y mantienes el acceso hasta el final del periodo pagado.";
  return null;
}

/** Versión de los textos de las casillas de renuncia (se guarda en Order.waiverVersion junto a su huella). */
export const WAIVER_TEXT_VERSION = "2026-10-27";

/** Texto de la casilla de condiciones; en suscripciones, con la renovación automática (mes o año). */
export function termsCheckboxText(o: { sellerName: string; billingInterval: string | null; price: string }): string {
  const base = `He leído y acepto las condiciones de venta y la política de cambios y reembolsos de ${o.sellerName}.`;
  if (!o.billingInterval) return base;
  const period = o.billingInterval === "year" ? "año" : "mes";
  const amount = o.price.replace(/\s*\/\s*(mes|año)$/, "");
  return `${base} Entiendo que la suscripción se renueva automáticamente cada ${period} por ${amount} hasta que la cancele.`;
}

/** «Cambios gratis hasta 24 h antes de la sesión» */
export function sessionChangePolicyText(hours: number = SESSION_CHANGE_NOTICE_HOURS): string {
  return `Cambios gratis hasta ${hours} h antes de la sesión`;
}

export type LegalSection = "aviso" | "condiciones" | "reembolsos" | "privacidad" | "cookies";

export function creatorLegalHref(username: string, section?: LegalSection): string {
  return `/${username}/legal${section ? `#${section}` : ""}`;
}
