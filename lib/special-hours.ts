/**
 * Horas de una fecha especial para la dueña: en la zona en que las puso («9:00–13:00 en Bali») y, si
 * su zona de siempre tiene otra hora, también en esa: «9:00–13:00 en Bali (3:00–7:00 en España)».
 * Si al pasarlas a su zona caen otro día: «(23:00–3:00 del día siguiente en España)». Puro (Intl):
 * lo usan el servidor, el formulario de Tu horario y las pruebas. Lo que ven las clientas no cambia.
 */
import { sameOffset, tzCity } from "./timezones";
import { dateKeyInTz, timeInTz, zonedTimeToUtc } from "./tz";

/** Nombre del sitio para la dueña: país cuando la zona es la de todo el país, si no la ciudad. */
const PLACE_ES: Record<string, string> = {
  "Europe/Madrid": "España",
  "Atlantic/Canary": "Canarias",
  "Europe/Lisbon": "Portugal",
  "Europe/Paris": "Francia",
  "Europe/Rome": "Italia",
  "Europe/Berlin": "Alemania",
  "Europe/London": "Reino Unido",
  "Europe/Amsterdam": "Países Bajos",
  "Europe/Brussels": "Bélgica",
  "Europe/Zurich": "Suiza",
  "Europe/Dublin": "Irlanda",
  "Asia/Makassar": "Bali",
  "Asia/Bangkok": "Tailandia",
  "Asia/Kolkata": "India",
  "Asia/Tokyo": "Japón",
  "America/Bogota": "Colombia",
  "America/Lima": "Perú",
  "America/Caracas": "Venezuela",
  "America/Santiago": "Chile",
  "America/Montevideo": "Uruguay",
  "America/Asuncion": "Paraguay",
  "America/La_Paz": "Bolivia",
  "America/Guayaquil": "Ecuador",
  "America/Costa_Rica": "Costa Rica",
  "America/Panama": "Panamá",
  "America/Guatemala": "Guatemala",
  "America/El_Salvador": "El Salvador",
  "America/Tegucigalpa": "Honduras",
  "America/Managua": "Nicaragua",
  "America/Santo_Domingo": "República Dominicana",
  "America/Havana": "Cuba",
  "America/Puerto_Rico": "Puerto Rico",
  "America/Argentina/Buenos_Aires": "Argentina",
};

export function placeName(tz: string) {
  return PLACE_ES[tz] ?? tzCity(tz).replace(/\s*\(.*\)$/, "");
}

/** 540 → «9:00»; 1440 → «24:00». */
const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
/** «09:00» → «9:00». */
const short = (t: string) => t.replace(/^0(\d)/, "$1");

export type MinuteRange = { startMinute: number; endMinute: number };

/**
 * «9:00–13:00 en Bali (3:00–7:00 en España)»; varias franjas: «9:00–13:00 y 16:00–19:00 en Bali
 * (3:00–7:00 y 10:00–13:00 en España)». Sin paréntesis si las dos zonas tienen la misma hora ese día;
 * sin «en …» si es su misma zona.
 */
export function specialHoursLabel(date: string, ranges: MinuteRange[], zone: string, baseTz: string): string {
  const join = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}` : parts[0] ?? "");
  const own = join(ranges.map((r) => `${hm(r.startMinute)}–${hm(r.endMinute)}`));
  if (zone === baseTz) return own;
  const first = zonedTimeToUtc(date, ranges[0]?.startMinute ?? 0, zone);
  if (sameOffset(zone, baseTz, first)) return `${own} en ${placeName(zone)}`;
  const shift = (key: string) => (key < date ? " del día anterior" : key > date ? " del día siguiente" : "");
  const base = ranges.map((r) => {
    const s = zonedTimeToUtc(date, r.startMinute, zone);
    // El final es exclusivo: «hasta las 24:00» es el último minuto del día.
    const e = zonedTimeToUtc(date, r.endMinute, zone);
    const eLast = new Date(e.getTime() - 60_000);
    const sDay = shift(dateKeyInTz(s, baseTz));
    const eDay = shift(dateKeyInTz(eLast, baseTz));
    const sT = short(timeInTz(s, baseTz));
    // Si acaba a las 0:00 en su zona, es «24:00» del día de su último minuto.
    const eTime = short(timeInTz(e, baseTz)).replace(/^0:00$/, "24:00");
    return sDay === eDay ? { text: `${sT}–${eTime}`, day: sDay } : { text: `${sT}${sDay}–${eTime}${eDay}`, day: "" };
  });
  const days = new Set(base.map((b) => b.day));
  const shared = days.size === 1 ? [...days][0] : "";
  const parts = base.map((b) => (shared ? b.text : `${b.text}${b.day}`));
  return `${own} en ${placeName(zone)} (${join(parts)}${shared} en ${placeName(baseTz)})`;
}
