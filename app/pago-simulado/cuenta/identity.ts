import { maskIban } from "@/lib/dac7";
import { formatLegalAddress, taxIdLabel, type LegalIdentity } from "@/lib/legal";

/** «•••••678Z»: el documento nunca se muestra completo, ni en el simulador. */
export function maskTaxId(v: string): string {
  const s = v.replace(/[\s-]/g, "").toUpperCase();
  if (s.length <= 4) return "••••";
  return `${"•".repeat(s.length - 4)}${s.slice(-4)}`;
}

export type SimulatedField = { label: string; value: string | null; placeholder: string };

/**
 * Campos del alta simulada de Stripe: los datos legales que la creadora ya dio en Cirella (con el
 * documento y el IBAN enmascarados) y, si aún no los ha dado, un texto neutro en vez de datos de
 * ejemplo que parezcan suyos.
 */
export function simulatedIdentityFields(c: Partial<LegalIdentity> & { iban?: string | null }): SimulatedField[] {
  const company = c.legalEntityType === "COMPANY";
  const name = c.legalName?.trim();
  const taxId = c.legalTaxId?.trim();
  const iban = c.iban?.trim();
  return [
    { label: company ? "Razón social" : "Nombre y apellidos", value: name || null, placeholder: company ? "Nombre de tu empresa" : "Tu nombre, como en tu documento" },
    { label: company ? taxIdLabel("COMPANY") : "DNI o NIE", value: taxId ? maskTaxId(taxId) : null, placeholder: "Tu número de documento" },
    { label: "Dirección", value: c.legalAddress?.trim() ? formatLegalAddress(c) : null, placeholder: "Tu dirección" },
    { label: "IBAN", value: iban ? maskIban(iban) : null, placeholder: "La cuenta donde quieres cobrar" },
  ];
}
