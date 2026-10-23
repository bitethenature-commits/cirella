/**
 * Zonas horarias (IANA) para personas: nombres de ciudad en español, desfase «GMT+1» y la lista
 * completa para elegir. Puro y sin dependencias (Intl): se usa en el servidor y en el navegador.
 *
 * La disponibilidad se define en la zona de la dueña (Creator.timezone) o en la de cada fecha especial;
 * cada clienta ve las horas en la suya (Booking.customerTimezone).
 */

/** Zona IANA canónica o null. Los alias se resuelven (US/Eastern → America/New_York). */
export function canonicalTimezone(v: unknown): string | null {
  if (typeof v !== "string" || !v || v.length > 64 || !/^[A-Za-z0-9_+/-]+$/.test(v) || v.includes("..")) return null;
  try {
    const tz = new Intl.DateTimeFormat("en-US", { timeZone: v }).resolvedOptions().timeZone;
    // Intl acepta «UTC» y alias de una sola palabra; los guardamos tal y como los resuelve.
    return tz || null;
  } catch {
    return null;
  }
}

/** Zonas que más usa una astróloga hispanohablante, en este orden (van primero en la lista). */
export const FREQUENT_TIMEZONES = [
  "Europe/Madrid",
  "Atlantic/Canary",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Makassar",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

/** Nombres en español de las ciudades más habituales. El resto: el último tramo, sin guiones bajos. */
const CITY_ES: Record<string, string> = {
  "Europe/Madrid": "Madrid",
  "Atlantic/Canary": "Canarias",
  "Europe/Lisbon": "Lisboa",
  "Europe/London": "Londres",
  "Europe/Paris": "París",
  "Europe/Berlin": "Berlín",
  "Europe/Rome": "Roma",
  "Europe/Brussels": "Bruselas",
  "Europe/Amsterdam": "Ámsterdam",
  "Europe/Zurich": "Zúrich",
  "Europe/Vienna": "Viena",
  "Europe/Athens": "Atenas",
  "Europe/Moscow": "Moscú",
  "Europe/Dublin": "Dublín",
  "Europe/Warsaw": "Varsovia",
  "Europe/Stockholm": "Estocolmo",
  "Europe/Copenhagen": "Copenhague",
  "Europe/Istanbul": "Estambul",
  "Africa/Ceuta": "Ceuta",
  "Africa/Casablanca": "Casablanca",
  "Africa/Cairo": "El Cairo",
  "America/Mexico_City": "Ciudad de México",
  "America/Cancun": "Cancún",
  "America/Bogota": "Bogotá",
  "America/Lima": "Lima",
  "America/Santiago": "Santiago de Chile",
  "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Montevideo": "Montevideo",
  "America/Asuncion": "Asunción",
  "America/La_Paz": "La Paz",
  "America/Caracas": "Caracas",
  "America/Guayaquil": "Guayaquil",
  "America/Panama": "Panamá",
  "America/Costa_Rica": "Costa Rica",
  "America/Guatemala": "Guatemala",
  "America/El_Salvador": "El Salvador",
  "America/Tegucigalpa": "Tegucigalpa",
  "America/Managua": "Managua",
  "America/Havana": "La Habana",
  "America/Santo_Domingo": "Santo Domingo",
  "America/Puerto_Rico": "Puerto Rico",
  "America/Sao_Paulo": "São Paulo",
  "America/New_York": "Nueva York",
  "America/Chicago": "Chicago",
  "America/Denver": "Denver",
  "America/Los_Angeles": "Los Ángeles",
  "America/Toronto": "Toronto",
  "America/Vancouver": "Vancouver",
  "Asia/Makassar": "Bali (Makassar)",
  "Asia/Bangkok": "Bangkok",
  "Asia/Tokyo": "Tokio",
  "Asia/Dubai": "Dubái",
  "Asia/Kolkata": "India",
  "Asia/Singapore": "Singapur",
  "Asia/Shanghai": "Shanghái",
  "Asia/Jerusalem": "Jerusalén",
  "Australia/Sydney": "Sídney",
  "Pacific/Auckland": "Auckland",
  UTC: "UTC",
};

const REGION_ES: Record<string, string> = {
  Europe: "Europa",
  America: "América",
  Asia: "Asia",
  Africa: "África",
  Australia: "Oceanía",
  Pacific: "Pacífico",
  Atlantic: "Atlántico",
  Indian: "Índico",
  Antarctica: "Antártida",
  Arctic: "Ártico",
};

/** «Bogotá», «Bali (Makassar)», «Port of Spain». */
export function tzCity(tz: string): string {
  return CITY_ES[tz] ?? (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Minutos que la zona va por delante de UTC en ese instante (Madrid en invierno: 60). */
export function tzOffsetMinutes(tz: string, at: Date): number {
  let f = offsetFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    offsetFormatters.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** «GMT+1», «GMT-5», «GMT+5:30», «GMT». */
export function tzOffsetLabel(tz: string, at: Date = new Date()): string {
  const m = tzOffsetMinutes(tz, at);
  if (m === 0) return "GMT";
  const sign = m > 0 ? "+" : "-";
  const a = Math.abs(m);
  return `GMT${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, "0")}` : ""}`;
}

/** ¿Tienen las dos zonas la misma hora en ese instante? (París y Madrid, sí). */
export function sameOffset(a: string, b: string, at: Date): boolean {
  return a === b || tzOffsetMinutes(a, at) === tzOffsetMinutes(b, at);
}

/** Lista corta para navegadores sin Intl.supportedValuesOf (iOS < 15.4). */
const FALLBACK_ZONES = [...FREQUENT_TIMEZONES, ...Object.keys(CITY_ES)];

export type TimezoneOption = { id: string; label: string; region: string; offsetMin: number };

/**
 * Todas las zonas con su etiqueta «Bogotá · GMT-5», agrupadas por región: primero «Frecuentes» (en el
 * orden de FREQUENT_TIMEZONES) y después cada continente, por desfase y nombre.
 */
export function listTimezones(now: Date = new Date()): TimezoneOption[] {
  let ids: string[];
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    ids = supported?.length ? supported : FALLBACK_ZONES;
  } catch {
    ids = FALLBACK_ZONES;
  }
  const frequent = new Set<string>(FREQUENT_TIMEZONES);
  const make = (id: string, region: string): TimezoneOption => {
    const offsetMin = tzOffsetMinutes(id, now);
    return { id, label: `${tzCity(id)} · ${tzOffsetLabel(id, now)}`, region, offsetMin };
  };
  const head = FREQUENT_TIMEZONES.filter((z) => canonicalTimezone(z)).map((z) => make(z, "Frecuentes"));
  const rest = [...new Set(ids)]
    .filter((id) => !frequent.has(id) && id.includes("/") && REGION_ES[id.split("/")[0]])
    .map((id) => make(id, REGION_ES[id.split("/")[0]]))
    .sort((a, b) => a.region.localeCompare(b.region, "es") || a.offsetMin - b.offsetMin || a.label.localeCompare(b.label, "es"));
  return [...head, ...rest];
}
