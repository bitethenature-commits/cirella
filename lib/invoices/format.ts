import { zonedParts } from "../tz";

/**
 * Formato de las facturas. Puro: lo usan la emisión, el documento imprimible y las pruebas.
 *
 * Series: V (ventas de Cirella) · S (cuotas y comisiones de Cirella a las creadoras) · R
 * (rectificativas de Cirella) · CIR / CIRR (ventas y rectificativas en nombre de una creadora,
 * numeradas por creadora). Tipos según VERI*FACTU: F1 completa, F2 simplificada, F3 completa que
 * sustituye a una simplificada, R1 rectificativa, R5 rectificativa de una simplificada.
 */

export type InvoiceLine = { description: string; baseCents: number; taxCents: number; totalCents: number };

export const INVOICE_TIMEZONE = "Europe/Madrid";

/** «V2026-000007» */
export function formatInvoiceNumber(code: string, year: number, n: number): string {
  return `${code}${year}-${String(n).padStart(6, "0")}`;
}

/** Año fiscal de una fecha (en España). */
export function invoiceYear(d: Date): number {
  return zonedParts(d, INVOICE_TIMEZONE).year;
}

export const INVOICE_TYPE_LABEL: Record<string, string> = {
  F1: "Factura",
  F2: "Factura simplificada",
  F3: "Factura",
  R1: "Factura rectificativa",
  R5: "Factura rectificativa",
};

export function invoiceLines(v: unknown): InvoiceLine[] {
  return Array.isArray(v) ? (v as InvoiceLine[]) : [];
}

/** «2026-09» → «septiembre de 2026». */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
}
