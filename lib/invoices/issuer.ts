import type { Creator } from "@prisma/client";
import { formatLegalAddress } from "../legal";
import { getSettings } from "../settings";

/** Datos fiscales de quien emite una factura (se copian en cada factura: son una instantánea). */
export type Issuer = { name: string; taxId: string | null; address: string | null; country: string };

/**
 * Cirella como emisora. Su identidad fiscal es la de /admin/ajustes (la misma del aviso legal):
 * sin razón social, NIF y domicilio no se puede facturar ni, por tanto, vender en modo real.
 * La empresa está en España.
 */
export async function getPlatformIssuer(): Promise<Issuer & { complete: boolean }> {
  const s = await getSettings();
  const name = s.legalCompanyName.trim();
  const taxId = s.legalTaxId.trim();
  const address = s.legalAddress.trim();
  return { name: name || s.platformName, taxId: taxId || null, address: address || null, country: "ES", complete: !!(name && taxId && address) };
}

type CreatorFiscal = Pick<Creator, "vatStatus" | "legalName" | "legalTaxId" | "legalAddress" | "legalPostalCode" | "legalCity" | "legalCountry">;

/**
 * La creadora como emisora (Cirella factura en su nombre, art. 5 del RD 1619/2012). null si no
 * repercute IVA (sin factura: la compradora recibe un justificante) o si faltan sus datos fiscales.
 */
export function creatorIssuer(c: CreatorFiscal): Issuer | null {
  if (c.vatStatus === "NONE" || !c.legalName?.trim() || !c.legalTaxId?.trim() || !c.legalAddress?.trim()) return null;
  return { name: c.legalName.trim(), taxId: c.legalTaxId.trim(), address: formatLegalAddress(c), country: c.legalCountry };
}
