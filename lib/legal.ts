/**
 * Reglas legales de la venta online (LSSI art. 10, TRLGDCU arts. 97-108, RGPD art. 7).
 *
 * Funciones puras: sin BD ni servidor, para poder usarlas en componentes cliente y en las pruebas
 * unitarias. Los textos de las casillas son borradores: deben revisarse con una asesoría antes de
 * lanzar (ver README, «Cumplimiento legal»).
 */

import { normalizeDeliveryMode } from "./delivery";

/** Versión de las plantillas de textos legales de las creadoras (lib/legal-templates.ts). */
export const LEGAL_TEMPLATE_VERSION = "2026-10b";
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

export type WaiverKind = "DIGITAL_IMMEDIATE" | "SERVICE_IN_PERIOD";

/**
 * Renuncia que pide cada tipo de producto: acceso inmediato (art. 103.m) o servicio en plazo (art. 103.a).
 * Un producto digital que la creadora prepara a mano («Lo preparo yo») no se entrega al momento: no
 * hay acceso inmediato al que renunciar, así que no se pide ninguna renuncia y se puede desistir.
 */
export function waiverKindFor(productType: string, deliveryMode?: string | null): WaiverKind | null {
  if (productType === "DIGITAL" && normalizeDeliveryMode(productType, deliveryMode) === "PERSONAL") return null;
  if (productType === "DIGITAL" || productType === "COURSE" || productType === "MEMBERSHIP") return "DIGITAL_IMMEDIATE";
  if (productType === "SESSION") return "SERVICE_IN_PERIOD";
  return null;
}

export const WAIVER_TEXT: Record<WaiverKind, string> = {
  DIGITAL_IMMEDIATE:
    "Quiero acceder ya al contenido y acepto que, al empezar el acceso o la descarga, pierdo mi derecho de desistimiento de 14 días.",
  SERVICE_IN_PERIOD:
    "Solicito que la sesión pueda realizarse dentro del plazo de desistimiento de 14 días. Sé que, una vez realizada, ya no podré desistir.",
};

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
