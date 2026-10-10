/**
 * Tipos generales de IVA de la UE y países del checkout. Puro: se usa también en el cliente.
 *
 * Tipos generales vigentes a 2026-10; revisar cada enero (en 2024-2025 cambiaron EE, FI, RO y SK).
 * Los tipos reducidos (libros electrónicos, formación) no se aplican: ver README, «IVA y facturas».
 */
export const EU_VAT_STANDARD_BPS: Record<string, number> = {
  AT: 2000, BE: 2100, BG: 2000, HR: 2500, CY: 1900, CZ: 2100, DK: 2500, EE: 2400, FI: 2550,
  FR: 2000, DE: 1900, GR: 2400, HU: 2700, IE: 2300, IT: 2200, LV: 2100, LT: 2100, LU: 1700,
  MT: 1800, NL: 2100, PL: 2300, PT: 2300, RO: 2100, SK: 2300, SI: 2200, ES: 2100, SE: 2500,
};

/** Canarias, Ceuta y Melilla: España, pero fuera del ámbito del IVA (IGIC / IPSI). */
export const ES_SPECIAL_TERRITORIES = ["ES-CN", "ES-CE", "ES-ML"];

export function isEuVatCountry(code: string): boolean {
  return code in EU_VAT_STANDARD_BPS;
}

export function isSpanishSpecialTerritory(code: string): boolean {
  return ES_SPECIAL_TERRITORIES.includes(code);
}

const EU_NAMES: [string, string][] = [
  ["DE", "Alemania"], ["AT", "Austria"], ["BE", "Bélgica"], ["BG", "Bulgaria"], ["CY", "Chipre"], ["HR", "Croacia"],
  ["DK", "Dinamarca"], ["SK", "Eslovaquia"], ["SI", "Eslovenia"], ["EE", "Estonia"], ["FI", "Finlandia"], ["FR", "Francia"],
  ["GR", "Grecia"], ["HU", "Hungría"], ["IE", "Irlanda"], ["IT", "Italia"], ["LV", "Letonia"], ["LT", "Lituania"],
  ["LU", "Luxemburgo"], ["MT", "Malta"], ["NL", "Países Bajos"], ["PL", "Polonia"], ["PT", "Portugal"], ["CZ", "República Checa"],
  ["RO", "Rumanía"], ["SE", "Suecia"],
];

/** Desplegable «País de residencia»: España y sus territorios, la UE y los países más habituales. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "ES", name: "España" },
  { code: "ES-CN", name: "España – Canarias" },
  { code: "ES-CE", name: "España – Ceuta" },
  { code: "ES-ML", name: "España – Melilla" },
  ...EU_NAMES.map(([code, name]) => ({ code, name })),
  ...([
    ["GB", "Reino Unido"], ["US", "Estados Unidos"], ["CH", "Suiza"], ["NO", "Noruega"], ["AD", "Andorra"], ["MX", "México"],
    ["AR", "Argentina"], ["CO", "Colombia"], ["CL", "Chile"], ["PE", "Perú"], ["UY", "Uruguay"], ["VE", "Venezuela"],
    ["EC", "Ecuador"], ["DO", "República Dominicana"], ["CR", "Costa Rica"], ["XX", "Otro país"],
  ] as const).map(([code, name]) => ({ code, name })),
];

const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

export function isKnownCountry(code: string): boolean {
  return COUNTRY_CODES.has(code);
}

export function countryName(code: string | null): string {
  if (!code) return "—";
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
