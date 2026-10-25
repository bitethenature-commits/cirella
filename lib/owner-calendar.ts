/**
 * Calendario del mes de la dueña (Reservas › Calendario): la rejilla de días en SU zona horaria y
 * el texto de lo que pasa en el cielo cada día. Puro (sin BD): lo usan la página y las pruebas.
 *
 *   · Las semanas empiezan en lunes; la rejilla tiene 5 o 6 semanas con días del mes anterior y
 *     del siguiente para completar.
 *   · Un día es de 00:00 a 24:00 en la zona de la dueña (con cambio de hora, 23 o 25 horas).
 */
import { astroEventsBetween, astroLabel, describeAstro, moonSignAt, SIGNS, type AstroEvent } from "./astro-calendar";
import { addDaysToKey, dateKeyInTz, timeInTz, weekdayOfKey, zonedTimeToUtc } from "./tz";

export type YearMonth = { year: number; month: number };

/** «2026-11» → { 2026, 11 }; lo que no sea un mes válido (o muy lejano) → el mes de `todayKey`. */
export function parseMonthParam(param: string | null | undefined, todayKey: string): YearMonth {
  const m = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (year >= 1900 && year <= 2200 && month >= 1 && month <= 12) return { year, month };
  }
  return { year: Number(todayKey.slice(0, 4)), month: Number(todayKey.slice(5, 7)) };
}

export function monthParam({ year, month }: YearMonth) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/** «Octubre de 2026». */
export function monthTitle({ year, month }: YearMonth) {
  const s = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Días de la rejilla (YYYY-MM-DD), de lunes a domingo, de semana en semana. */
export function monthGrid({ year, month }: YearMonth): string[] {
  const first = `${monthParam({ year, month })}-01`;
  const last = addDaysToKey(monthParam(shiftMonth({ year, month }, 1)) + "-01", -1);
  const start = addDaysToKey(first, -((weekdayOfKey(first) + 6) % 7));
  const end = addDaysToKey(last, (7 - weekdayOfKey(last)) % 7);
  const out: string[] = [];
  for (let k = start; k <= end; k = addDaysToKey(k, 1)) out.push(k);
  return out;
}

/** Instantes UTC [from, to) que cubren los días `firstKey`…`lastKey` en la zona `tz`. */
export function dayRangeUtc(firstKey: string, lastKey: string, tz: string) {
  return { from: zonedTimeToUtc(firstKey, 0, tz), to: zonedTimeToUtc(addDaysToKey(lastKey, 1), 0, tz) };
}

export type AstroLine = {
  kind: AstroEvent["kind"];
  /** Qué es: «Conjunción», «Luna llena», «Estación retrógrada»… */
  label: string;
  /** «Luna nueva en Escorpio 4°12′» */
  text: string;
  /** «22:47» en la zona de la dueña */
  time: string;
  /** "new" | "full" para las lunas; "solar" | "lunar" para los eclipses. */
  detail?: string;
};

export type AstroDay = {
  lines: AstroLine[];
  /** Signo de la Luna a las 00:00 y, si cambia ese día, a cuál y a qué hora. */
  moon: { sign: string; enters?: { sign: string; time: string } };
  newMoon: boolean;
  fullMoon: boolean;
  eclipse: boolean;
  conjunctions: number;
  stations: number;
};

/** Lo del cielo de cada día de `keys` (consecutivos) en la zona `tz`. */
export function astroByDay(keys: string[], tz: string): Map<string, AstroDay> {
  const out = new Map<string, AstroDay>();
  if (!keys.length) return out;
  for (const k of keys) {
    const sign = SIGNS[moonSignAt(zonedTimeToUtc(k, 0, tz))];
    out.set(k, { lines: [], moon: { sign }, newMoon: false, fullMoon: false, eclipse: false, conjunctions: 0, stations: 0 });
  }
  const { from, to } = dayRangeUtc(keys[0], keys[keys.length - 1], tz);
  for (const e of astroEventsBetween(from, to)) {
    const day = out.get(dateKeyInTz(e.at, tz));
    if (!day) continue;
    const time = timeInTz(e.at, tz);
    if (e.kind === "moon-ingress") {
      // Si entra dos veces el mismo día (no pasa: tarda ~2,5 días), vale la última.
      day.moon.enters = { sign: SIGNS[e.sign], time };
      continue;
    }
    if (e.kind === "moon") e.phase === "new" ? (day.newMoon = true) : (day.fullMoon = true);
    if (e.kind === "eclipse") day.eclipse = true;
    if (e.kind === "conjunction") day.conjunctions++;
    if (e.kind === "station") day.stations++;
    const detail = e.kind === "moon" ? e.phase : e.kind === "eclipse" ? e.body : e.kind === "station" ? e.direction : undefined;
    day.lines.push({ kind: e.kind, label: astroLabel(e), text: describeAstro(e), time, ...(detail ? { detail } : {}) });
  }
  return out;
}
