/**
 * Utilidades de zona horaria sin dependencias (Intl).
 * La disponibilidad de la creadora se define en SU zona horaria;
 * las reservas se guardan en UTC.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
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
  return new Intl.DateTimeFormat("es-ES", { timeZone, ...opts }).format(date);
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

export function formatDate(date: Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", ...opts }).format(date);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
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
