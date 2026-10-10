import { normalizeTaxId as normalizeLegalTaxId, validateTaxId } from "../legal";

/**
 * NIF de quien pide factura. Puro: se usa en el checkout (cliente y servidor) y en las pruebas.
 * Las reglas de los NIF españoles viven en lib/legal.ts (identidad de las creadoras); aquí solo
 * se aceptan además el prefijo «ES» del NIF-IVA y los NIF de otros países.
 */

/** Mayúsculas, sin espacios, puntos ni guiones y sin el prefijo «ES» del NIF-IVA: «es 12.345.678-z» → «12345678Z». */
export function normalizeTaxId(s: string): string {
  return normalizeLegalTaxId(s).replace(/^ES(?=[0-9A-Z]{9}$)/, "");
}

/** DNI/NIF, NIE o CIF con su dígito de control. */
export function isValidSpanishTaxId(s: string): boolean {
  const v = normalizeTaxId(s);
  return validateTaxId("ES", "INDIVIDUAL", v) === null || validateTaxId("ES", "COMPANY", v) === null;
}

/** Fuera de España solo se comprueba el formato (VIES no se consulta: ver README). */
export function isPlausibleTaxId(s: string, country: string): boolean {
  const v = normalizeTaxId(s);
  if (country === "ES" || country.startsWith("ES-")) return isValidSpanishTaxId(v);
  return /^[A-Z0-9]{4,15}$/.test(v);
}
