import "server-only";
import { getSettings } from "../settings";
import { asTaxMode, type TaxMode } from ".";

/** Política de IVA vigente (/admin/impuestos). */
export async function getTaxMode(): Promise<TaxMode> {
  return asTaxMode((await getSettings()).taxMode);
}

const validCountry = (v: string | null | undefined) => {
  const c = (v ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
};

/**
 * País de la IP según la CDN (Cloudflare o Vercel). Es la segunda prueba de localización que pide
 * el régimen OSS junto al país declarado: se guarda en Order.ipCountry. Ignora «XX» (desconocido)
 * y «T1» (Tor). Sin CDN delante (desarrollo) es null.
 */
export function ipCountry(h: Headers): string | null {
  return validCountry(h.get("cf-ipcountry")) ?? validCountry(h.get("x-vercel-ip-country"));
}

/**
 * País por defecto del desplegable del checkout: el de la IP o, si no hay, la región del idioma
 * del navegador («es-MX» → MX). Solo es una sugerencia: no se guarda como prueba.
 */
export function headerCountry(h: Headers): string | null {
  const lang = (h.get("accept-language") ?? "").split(",")[0]?.split(";")[0]?.trim() ?? "";
  return ipCountry(h) ?? validCountry(lang.split("-")[1]);
}
