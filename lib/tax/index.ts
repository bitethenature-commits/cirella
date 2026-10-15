import { normalizeDeliveryMode } from "../delivery";
import type { ProductType } from "../types";
import { EU_VAT_STANDARD_BPS, countryName, isEuVatCountry, isSpanishSpecialTerritory } from "./rates";

/**
 * Núcleo fiscal: quién vende a efectos de IVA, a qué tipo y cuánto IVA lleva cada precio.
 * Puro (sin BD ni servidor): lo usan el checkout en el cliente, los pedidos, las renovaciones,
 * las facturas y las pruebas unitarias (scripts/unit/iva.test.ts).
 *
 * Reglas económicas (pendientes de confirmar con la asesoría, ver README «IVA y facturas»):
 *   · Todos los precios (productos, planes) son finales, con el IVA incluido. El precio no cambia
 *     con el país: cambia el IVA que contiene y, con él, lo que recibe la creadora.
 *   · La comisión de Cirella se calcula sobre la base sin IVA.
 *   · PLATFORM_DIGITAL (opción A, por defecto): Cirella es la vendedora de los productos digitales,
 *     cursos y membresías (art. 9 bis del Reglamento de Ejecución 282/2011): repercute el IVA del
 *     país de la compradora y lo declara (OSS). Las sesiones en directo las vende la creadora.
 *     Un producto digital que la creadora prepara a mano («Lo preparo yo», p. ej. una lectura
 *     personal) no es un servicio electrónico (art. 7 del mismo Reglamento: casi automático y con
 *     una intervención humana mínima): lo vende ella, como las sesiones.
 *   · CREATOR: la creadora vende todo; su IVA depende de su situación (vatStatus).
 */

export type TaxMode = "PLATFORM_DIGITAL" | "CREATOR";
export type VatStatus = "NONE" | "STANDARD" | "EXEMPT";
export type TaxSeller = "PLATFORM" | "CREATOR";
export type TaxDecision = { seller: TaxSeller; country: string | null; rateBps: number; note: string | null };

export const TAX_MODES: TaxMode[] = ["PLATFORM_DIGITAL", "CREATOR"];
export const VAT_STATUSES: VatStatus[] = ["NONE", "STANDARD", "EXEMPT"];

/** Productos que vende Cirella con la opción A (servicios prestados por vía electrónica). */
export const PLATFORM_DIGITAL_TYPES: ProductType[] = ["DIGITAL", "COURSE", "MEMBERSHIP"];

export function asTaxMode(v: unknown): TaxMode {
  return v === "CREATOR" ? "CREATOR" : "PLATFORM_DIGITAL";
}

export function asVatStatus(v: unknown): VatStatus {
  return v === "STANDARD" || v === "EXEMPT" ? v : "NONE";
}

export const NOTE_SPECIAL_TERRITORY = "Operación no sujeta al IVA español (Canarias, Ceuta o Melilla).";
export const NOTE_OUTSIDE_EU = "Operación no sujeta al IVA de la Unión Europea.";
export const NOTE_EXEMPT = "Operación exenta de IVA.";
export const NOTE_REVERSE_CHARGE = "Inversión del sujeto pasivo (art. 196 de la Directiva 2006/112/CE).";
export const NOTE_SERVICE_OUTSIDE_EU = "Operación no sujeta al IVA español (art. 69 de la Ley 37/1992).";

export function ossNote(country: string) {
  return `Operación sujeta a IVA en ${countryName(country)} (régimen de ventanilla única, OSS).`;
}

/** IVA de un consumidor final en `country` cuando vende Cirella (venta a distancia de servicios digitales). */
function consumerTax(country: string): Omit<TaxDecision, "seller"> {
  if (isSpanishSpecialTerritory(country)) return { country, rateBps: 0, note: NOTE_SPECIAL_TERRITORY };
  if (!isEuVatCountry(country)) return { country, rateBps: 0, note: NOTE_OUTSIDE_EU };
  return { country, rateBps: EU_VAT_STANDARD_BPS[country], note: country === "ES" ? null : ossNote(country) };
}

/** Quién vende una venta a efectos de IVA y a qué tipo. */
export function decideTax(i: {
  mode: TaxMode;
  productType: ProductType | string;
  /** Entrega de un producto digital: PERSONAL (lo prepara la creadora) no lo vende Cirella. */
  deliveryMode?: string | null;
  buyerCountry: string | null;
  creator: { country: string | null; vatStatus: VatStatus | string; vatExemptionNote?: string | null };
}): TaxDecision {
  if (
    i.mode === "PLATFORM_DIGITAL" &&
    PLATFORM_DIGITAL_TYPES.includes(i.productType as ProductType) &&
    normalizeDeliveryMode(i.productType, i.deliveryMode) !== "PERSONAL"
  ) {
    return { seller: "PLATFORM", ...consumerTax(i.buyerCountry ?? "ES") };
  }
  const country = i.creator.country ?? "ES";
  const status = asVatStatus(i.creator.vatStatus);
  if (status === "NONE") return { seller: "CREATOR", country, rateBps: 0, note: null };
  if (status === "EXEMPT") return { seller: "CREATOR", country, rateBps: 0, note: i.creator.vatExemptionNote?.trim() || NOTE_EXEMPT };
  // Repercute IVA: el de su país (por debajo del umbral de 10.000 € de ventas a otros países de la UE).
  return { seller: "CREATOR", country, rateBps: isEuVatCountry(country) ? EU_VAT_STANDARD_BPS[country] : 0, note: null };
}

/** Desglose de un precio con el IVA incluido. Siempre base + IVA = total. */
export function splitInclusive(totalCents: number, rateBps: number): { baseCents: number; taxCents: number } {
  if (!rateBps) return { baseCents: totalCents, taxCents: 0 };
  const baseCents = Math.round((totalCents * 10000) / (10000 + rateBps));
  return { baseCents, taxCents: totalCents - baseCents };
}

/**
 * Importes de una venta: IVA incluido, comisión sobre la base sin IVA, lo que recibe la creadora y
 * lo que se queda la cuenta de Cirella (comisión + IVA cuando vende ella).
 */
export function computeSaleAmounts(amountCents: number, commissionBps: number, tax: Pick<TaxDecision, "seller" | "rateBps">) {
  const { baseCents, taxCents } = splitInclusive(amountCents, tax.rateBps);
  const platformFeeCents = Math.round((baseCents * commissionBps) / 10000);
  const platformTax = tax.seller === "PLATFORM" ? taxCents : 0;
  return {
    taxCents,
    taxRateBps: tax.rateBps,
    platformFeeCents,
    netCents: amountCents - platformFeeCents - platformTax,
    platformRetainedCents: platformFeeCents + platformTax,
  };
}

/** Lo que retiene la cuenta de Cirella de un cobro (application_fee_amount de Stripe). */
export function platformRetainedCents(o: { platformFeeCents: number; taxCents: number; taxSeller: string | null }): number {
  return o.platformFeeCents + (o.taxSeller === "PLATFORM" ? o.taxCents : 0);
}

/** Campos fiscales de una fila REFUND: el IVA devuelto en proporción, en negativo. */
export function refundTaxFields(
  original: { amountCents: number; taxCents: number; taxRateBps: number; taxCountry: string | null; taxSeller: string | null },
  refundAmountCents: number,
) {
  const tax = original.amountCents ? Math.round((original.taxCents * refundAmountCents) / original.amountCents) : 0;
  return { taxCents: -tax, taxRateBps: original.taxRateBps, taxCountry: original.taxCountry, taxSeller: original.taxSeller };
}

/** IVA de lo que Cirella (España) factura a una creadora: la cuota del plan y las comisiones. */
export function decidePlatformServiceTax(c: { country: string | null; vatStatus: VatStatus | string; taxId: string | null }): TaxDecision {
  const country = c.country ?? "ES";
  if (country === "ES") return { seller: "PLATFORM", country, rateBps: EU_VAT_STANDARD_BPS.ES, note: null };
  if (isSpanishSpecialTerritory(country)) return { seller: "PLATFORM", country, rateBps: 0, note: "Operación no sujeta al IVA español." };
  if (isEuVatCountry(country)) {
    if (asVatStatus(c.vatStatus) !== "NONE" && c.taxId) return { seller: "PLATFORM", country, rateBps: 0, note: NOTE_REVERSE_CHARGE };
    return { seller: "PLATFORM", country, rateBps: EU_VAT_STANDARD_BPS[country], note: ossNote(country) };
  }
  return { seller: "PLATFORM", country, rateBps: 0, note: NOTE_SERVICE_OUTSIDE_EU };
}

/** «Recibirás X»: lo que queda de una venta a una compradora de España. */
export function estimateNet(i: {
  priceCents: number;
  commissionBps: number;
  productType: ProductType | string;
  deliveryMode?: string | null;
  mode: TaxMode;
  creator: { country: string | null; vatStatus: VatStatus | string };
}) {
  const d = decideTax({ mode: i.mode, productType: i.productType, deliveryMode: i.deliveryMode, buyerCountry: "ES", creator: i.creator });
  const a = computeSaleAmounts(i.priceCents, i.commissionBps, d);
  return { taxCents: a.taxCents, feeCents: a.platformFeeCents, netCents: a.netCents, rateBps: d.rateBps, seller: d.seller };
}

export function vatIncluded(d: Pick<TaxDecision, "rateBps">): boolean {
  return d.rateBps > 0;
}
