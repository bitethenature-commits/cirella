/**
 * Utilidades de zona horaria sin dependencias (Intl).
 * La disponibilidad de la creadora se define en SU zona horaria;
 * las reservas se guardan en UTC.
 */

import { sameOffset, tzCity } from "./timezones";

/**
 * Idioma de las fechas: español, salvo cuando alguien da otro. Los emails lo dan (el de quien los recibe,
 * lib/i18n/email.ts); así «martes, 12 de noviembre» sale «Dienstag, 12. November» a quien lee en alemán.
 */
let dateLocaleSource: () => string | undefined = () => undefined;
export function setDateLocaleSource(fn: () => string | undefined) {
  dateLocaleSource = fn;
}
const intlLocale = () => dateLocaleSource() ?? "es-ES";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Un formateador por zona: crearlos es lo caro y el calendario calcula miles de horas. */
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

export function zonedParts(date: Date, timeZone: string) {
  let fmt = partsFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsFormatters.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

function offsetMinutes(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const t = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - t) / 60000);
}

/** "2026-10-12" + 1020 min (17:00) en Europe/Madrid → Date UTC. */
export function zonedTimeToUtc(dateKey: string, minutes: number, timeZone: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const off1 = offsetMinutes(new Date(guess), timeZone);
  let result = guess - off1 * 60000;
  const off2 = offsetMinutes(new Date(result), timeZone);
  if (off2 !== off1) result = guess - off2 * 60000;
  return new Date(result);
}

export function dateKeyInTz(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDaysToKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOfKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function minutesToLabel(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function labelToMinutes(label: string) {
  const [h, m] = label.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatInTz(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(intlLocale(), { timeZone, ...opts }).format(date);
}

/** "lunes, 12 de octubre · 17:00" */
export function formatSessionDate(date: Date, timeZone: string, withWeekday = true) {
  const day = formatInTz(date, timeZone, {
    ...(withWeekday ? { weekday: "long" as const } : {}),
    day: "numeric",
    month: "long",
  });
  const time = formatInTz(date, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${day} · ${time}`;
}

/**
 * La hora de una sesión para la clienta, en su zona: «martes, 12 de noviembre · 11:00 (hora de Bogotá)».
 * Sin «(hora de …)» cuando su zona tiene la misma hora que la de la dueña en ese momento.
 */
export function sessionWhen(start: Date, tz: string | null | undefined, ownerTz: string) {
  const zone = tz || ownerTz;
  const base = formatSessionDate(start, zone);
  if (sameOffset(zone, ownerTz, start)) return base;
  const loc = intlLocale();
  const city = tzCity(zone);
  return `${base} (${loc.startsWith("de") ? `Ortszeit ${city}` : loc.startsWith("en") ? `${city} time` : `hora de ${city}`})`;
}

/** Solo la hora en una zona: «11:00». */
export function timeInTz(start: Date, tz: string) {
  return formatInTz(start, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/**
 * La hora de una sesión para la dueña, en la suya, y la de la clienta si es distinta:
 * «jueves, 13 de noviembre · 17:00 · para ella, 11:00 en Bogotá».
 */
export function ownerWhen(start: Date, ownerTz: string, clientTz: string | null | undefined) {
  const base = formatSessionDate(start, ownerTz);
  if (!clientTz || sameOffset(clientTz, ownerTz, start)) return base;
  return `${base} · ${clientTimeNote(start, ownerTz, clientTz)}`;
}

/** «para ella, 11:00 en Bogotá» (con el día si cambia: «para ella, mié 12, 23:00 en Bogotá»). Vacío si es la misma hora. */
export function clientTimeNote(start: Date, ownerTz: string, clientTz: string | null | undefined) {
  if (!clientTz || sameOffset(clientTz, ownerTz, start)) return "";
  const sameDay = dateKeyInTz(start, clientTz) === dateKeyInTz(start, ownerTz);
  const day = sameDay ? "" : `${formatInTz(start, clientTz, { weekday: "short", day: "numeric" }).replace(".", "")}, `;
  return `para ella, ${day}${timeInTz(start, clientTz)} en ${tzCity(clientTz)}`;
}

/** Fecha en la zona horaria de la creadora (por defecto, la de la plataforma), nunca en la del servidor. */
export function formatDate(
  date: Date,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
  timeZone = "Europe/Madrid",
) {
  return new Intl.DateTimeFormat(intlLocale(), { timeZone, ...opts }).format(date);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat(intlLocale(), {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
