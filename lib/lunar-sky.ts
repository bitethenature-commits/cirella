/**
 * El cielo de la Luna para el modelo del ciclo lunar (components/models/lunar-model.tsx): fase, signo,
 * distancia, lunaciones exactas, perigeos y apogeos, superlunas, eclipses, salida y puesta, la Luna
 * natal y sus retornos, y el .ics del año lunar. Puro (astronomy-engine y lib/astro-calendar.ts, sin
 * red ni React): el modelo lo carga aparte (es pesado) y lo prueba scripts/unit/ciclo-lunar.test.ts.
 *
 *   · Posiciones geocéntricas aparentes, eclíptica de la fecha (zodiaco tropical), como el calendario
 *     y la carta natal. Fase = elongación Luna − Sol (0° nueva, 90° cuarto creciente, 180° llena,
 *     270° cuarto menguante); las ocho estaciones son los múltiplos de 45°.
 *   · Iluminación: fracción iluminada del disco (astronomy-engine, con el ángulo de fase verdadero).
 *   · Distancia: centro de la Tierra – centro de la Luna, en km.
 *   · Superluna (definición de Richard Nolle, la que siguen las listas habituales): luna nueva o llena
 *     a una distancia de como mucho el perigeo más un 10 % del recorrido perigeo–apogeo de esa vuelta,
 *     d ≤ P + 0,1·(A − P), con P y A el perigeo y el apogeo más cercanos en el tiempo a la lunación.
 *     Así salen las superlunas llenas publicadas: 7-10, 5-11 y 4-12 de 2025; 3-1, 24-11 y 24-12 de 2026.
 *   · Eclipses: los de lib/astro-calendar.ts (globales), unidos a su luna nueva (solar) o llena (lunar).
 *   · Las horas van en UTC; los días se cortan en la zona que se pida (por defecto, Europe/Madrid).
 */
import { Body, GeoMoon, Illumination, KM_PER_AU, NextLunarApsis, Observer, SearchLunarApsis, SearchMoonPhase, SearchRiseSet } from "astronomy-engine";
import { eclipsesBetween, lonDiff, longitude, moonIngressesBetween, type EclipseType } from "./astro-calendar";
import { localToUtc } from "./natal-chart";
import { addDaysToKey, dateKeyInTz, zonedParts, zonedTimeToUtc } from "./tz";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;
const norm = (x: number) => ((x % 360) + 360) % 360;
const roundMin = (d: Date) => new Date(Math.round(d.getTime() / MINUTE) * MINUTE);

export const SPAIN_TZ = "Europe/Madrid";

/* -------------------------------------------------------------------------- *
 *  Un instante
 * -------------------------------------------------------------------------- */

export interface MoonState {
  /** Elongación Luna − Sol, 0…360 (0 nueva, 180 llena). */
  elong: number;
  /** Fracción iluminada, 0…1. */
  illum: number;
  moonLon: number;
  sunLon: number;
  distKm: number;
}

export const moonDistanceKm = (at: Date) => {
  const v = GeoMoon(at);
  return Math.hypot(v.x, v.y, v.z) * KM_PER_AU;
};

export function moonState(at: Date): MoonState {
  const moonLon = longitude("Moon", at);
  const sunLon = longitude("Sun", at);
  return { elong: norm(moonLon - sunLon), illum: Illumination(Body.Moon, at).phase_fraction, moonLon, sunLon, distKm: moonDistanceKm(at) };
}

/** La luna nueva anterior (o igual) a `at`: el principio de la lunación en curso. */
export function lunationStart(at: Date): Date {
  // Un minuto después: si `at` es justo la luna nueva, la lunación es la que empieza ahí.
  return SearchMoonPhase(0, new Date(at.getTime() + MINUTE), -32)!.date;
}

/** El instante de la lunación que empieza en `start` en que la elongación vale `elong`. */
export function timeAtElongation(elong: number, start: Date): Date {
  const e = norm(elong);
  if (e < 1e-6) return start;
  return SearchMoonPhase(e, start, 32)?.date ?? new Date(start.getTime() + (e / 360) * 29.530588853 * DAY);
}

/* -------------------------------------------------------------------------- *
 *  Perigeos, apogeos y superlunas
 * -------------------------------------------------------------------------- */

export interface Apsis {
  at: Date;
  kind: "perigee" | "apogee";
  km: number;
}

/** Perigeos y apogeos en [from, to). */
export function apsidesBetween(from: Date, to: Date): Apsis[] {
  const out: Apsis[] = [];
  for (let a = SearchLunarApsis(from); a.time.date < to; a = NextLunarApsis(a)) out.push({ at: roundMin(a.time.date), kind: a.kind === 0 ? "perigee" : "apogee", km: a.dist_km });
  return out;
}

/** El perigeo y el apogeo más cercanos en el tiempo a `at`. */
export function nearestApsides(at: Date) {
  const list = apsidesBetween(new Date(at.getTime() - 31 * DAY), new Date(at.getTime() + 31 * DAY));
  const near = (kind: Apsis["kind"]) => list.filter((a) => a.kind === kind).sort((x, y) => Math.abs(x.at.getTime() - at.getTime()) - Math.abs(y.at.getTime() - at.getTime()))[0];
  return { perigee: near("perigee"), apogee: near("apogee") };
}

/** Umbral de superluna para una lunación en `at`: P + 10 % de (A − P) (Nolle). */
export function supermoonThresholdKm(at: Date) {
  const { perigee, apogee } = nearestApsides(at);
  return perigee.km + 0.1 * (apogee.km - perigee.km);
}

/* -------------------------------------------------------------------------- *
 *  Lunaciones
 * -------------------------------------------------------------------------- */

/** 0 nueva · 1 creciente · 2 cuarto creciente · 3 gibosa creciente · 4 llena · 5 gibosa menguante · 6 cuarto menguante · 7 menguante (balsámica). */
export type PhaseIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Lunation {
  at: Date;
  /** Múltiplo de 45° (0 nueva, 4 llena). */
  k: PhaseIndex;
  moonLon: number;
  sunLon: number;
  distKm: number;
  /** Solo en las nuevas y llenas. */
  supermoon?: boolean;
  eclipse?: { body: "solar" | "lunar"; type: EclipseType; at: Date };
}

/** Las lunaciones exactas en [from, to): las ocho estaciones, o solo las cuatro principales (`main`), o solo nuevas y llenas (`syzygy`). */
export function lunationsBetween(from: Date, to: Date, which: "all" | "main" | "syzygy" = "all", extras = true): Lunation[] {
  const ks: PhaseIndex[] = which === "all" ? [0, 1, 2, 3, 4, 5, 6, 7] : which === "main" ? [0, 2, 4, 6] : [0, 4];
  const span = (to.getTime() - from.getTime()) / DAY;
  const out: Lunation[] = [];
  for (const k of ks) {
    let t = from;
    for (;;) {
      const left = span - (t.getTime() - from.getTime()) / DAY;
      if (left <= 0) break;
      const hit = SearchMoonPhase(k * 45, t, left);
      if (!hit || hit.date >= to) break;
      const at = hit.date;
      out.push({ at: roundMin(at), k, moonLon: longitude("Moon", at), sunLon: longitude("Sun", at), distKm: moonDistanceKm(at) });
      t = new Date(at.getTime() + 20 * DAY);
    }
  }
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  const syz = out.filter((l) => l.k === 0 || l.k === 4);
  if (syz.length && extras) {
    const eclipses = eclipsesBetween(new Date(from.getTime() - 2 * DAY), new Date(to.getTime() + 2 * DAY));
    for (const l of syz) {
      l.supermoon = l.distKm <= supermoonThresholdKm(l.at);
      const e = eclipses.find((e) => e.kind === "eclipse" && (e.body === "solar") === (l.k === 0) && Math.abs(e.at.getTime() - l.at.getTime()) < 36 * HOUR);
      if (e && e.kind === "eclipse") l.eclipse = { body: e.body, type: e.type, at: e.at };
    }
  }
  return out;
}

/** La próxima lunación principal (nueva, cuartos, llena) estrictamente después de `at` (sin superluna ni eclipse: es barata). */
export function nextMainLunation(at: Date): Lunation {
  return lunationsBetween(new Date(at.getTime() + MINUTE), new Date(at.getTime() + 9 * DAY), "main", false)[0];
}

/** El próximo eclipse (de Sol o de Luna) a partir de `at`. */
export function nextEclipse(at: Date) {
  const e = eclipsesBetween(at, new Date(at.getTime() + 200 * DAY))
    .filter((e) => e.kind === "eclipse")
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  return e && e.kind === "eclipse" ? { body: e.body, type: e.type, at: e.at, lon: e.lon } : null;
}

/** Nuevas y llenas del año natural `year` en la zona `tz`. */
export function lunarYear(year: number, tz = SPAIN_TZ): Lunation[] {
  return lunationsBetween(zonedTimeToUtc(`${year}-01-01`, 0, tz), zonedTimeToUtc(`${year + 1}-01-01`, 0, tz), "syzygy");
}

/* -------------------------------------------------------------------------- *
 *  El mes, día a día
 * -------------------------------------------------------------------------- */

export interface LunarDay {
  /** AAAA-MM-DD en la zona. */
  key: string;
  start: Date;
  end: Date;
  /** Elongación a mediodía (para el disco). */
  elong: number;
  /** Signo de la Luna a mediodía (0 = Aries). */
  sign: number;
  ingresses: Array<{ sign: number; at: Date }>;
  lunations: Lunation[];
  apsides: Apsis[];
}

/** Los días del mes (month 1–12) en la zona, con su luna, signo, cambios de signo, lunaciones y ápsides. */
export function lunarMonth(year: number, month: number, tz = SPAIN_TZ): LunarDay[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const keys = Array.from({ length: total }, (_, i) => addDaysToKey(first, i));
  const starts = [...keys, addDaysToKey(first, total)].map((k) => zonedTimeToUtc(k, 0, tz));
  const from = starts[0];
  const to = starts[total];
  const ingresses = moonIngressesBetween(from, to);
  const lunations = lunationsBetween(from, to);
  const apsides = apsidesBetween(from, to);
  const inDay = (d: Date, i: number) => d >= starts[i] && d < starts[i + 1];
  return keys.map((key, i) => {
    const noon = zonedTimeToUtc(key, 12 * 60, tz);
    return {
      key,
      start: starts[i],
      end: starts[i + 1],
      elong: norm(longitude("Moon", noon) - longitude("Sun", noon)),
      sign: Math.floor(longitude("Moon", noon) / 30),
      ingresses: ingresses.flatMap((e) => (e.kind === "moon-ingress" && inDay(e.at, i) ? [{ sign: e.sign, at: e.at }] : [])),
      lunations: lunations.filter((l) => inDay(l.at, i)),
      apsides: apsides.filter((a) => inDay(a.at, i)),
    };
  });
}

/** Signos por los que pasa la Luna entre dos instantes (para «¿está en mi signo natal este día?»). */
export function moonSignsBetween(from: Date, to: Date): number[] {
  const out = new Set<number>([Math.floor(longitude("Moon", from) / 30)]);
  for (const e of moonIngressesBetween(from, to)) if (e.kind === "moon-ingress") out.add(e.sign);
  return [...out];
}

/** Retornos lunares: la Luna pasa por la longitud `natalLon` en [from, to) (uno cada ~27,3 días). */
export function lunarReturnsBetween(natalLon: number, from: Date, to: Date): Date[] {
  const f = (t: number) => lonDiff(longitude("Moon", new Date(t)), natalLon);
  const step = 6 * HOUR;
  const out: Date[] = [];
  let t0 = from.getTime();
  let v0 = f(t0);
  for (let t1 = t0 + step; t0 < to.getTime(); t1 += step) {
    const v1 = f(t1);
    if (v0 < 0 && v1 >= 0) {
      let a = t0;
      let b = t1;
      while (b - a > 20_000) {
        const m = (a + b) / 2;
        if (f(m) < 0) a = m;
        else b = m;
      }
      const at = roundMin(new Date((a + b) / 2));
      if (at >= from && at < to) out.push(at);
    }
    t0 = t1;
    v0 = v1;
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 *  Salida y puesta
 * -------------------------------------------------------------------------- */

/** Salida y puesta de la Luna (borde superior, con refracción) dentro del día [start, end); null si ese día no sale o no se pone. */
export function moonRiseSet(start: Date, end: Date, lat: number, lon: number) {
  const obs = new Observer(lat, lon, 0);
  const days = (end.getTime() - start.getTime()) / DAY;
  const find = (dir: 1 | -1) => {
    const t = SearchRiseSet(Body.Moon, obs, dir, start, days)?.date;
    return t && t < end ? roundMin(t) : null;
  };
  return { rise: find(1), set: find(-1) };
}

/** Principio y fin del día de `at` en la zona. */
export function dayBounds(at: Date, tz: string) {
  const key = dateKeyInTz(at, tz);
  return { key, start: zonedTimeToUtc(key, 0, tz), end: zonedTimeToUtc(addDaysToKey(key, 1), 0, tz) };
}

/* -------------------------------------------------------------------------- *
 *  La Luna natal
 * -------------------------------------------------------------------------- */

export interface NatalMoon {
  utc: Date;
  moonLon: number;
  sunLon: number;
  elong: number;
  /** La estación (0…7) dentro de la que se nació: [45k, 45k + 45). */
  phase: PhaseIndex;
  /** Sin hora: la Luna del día entero (de 00:00 a 24:00 locales). */
  range?: { from: number; to: number };
}

/** De la fecha y hora local de nacimiento (zona IANA o desfase fijo) a la Luna natal. Sin hora, se usa el mediodía. */
export function natalMoon(b: { date: string; time: string; timeKnown: boolean; tz: string }): NatalMoon {
  const [year, month, day] = b.date.split("-").map(Number);
  const [hour, minute] = (b.timeKnown ? b.time : "12:00").split(":").map(Number);
  const utc = localToUtc({ year, month, day, hour, minute }, b.tz).utc;
  const s = moonState(utc);
  const out: NatalMoon = { utc, moonLon: s.moonLon, sunLon: s.sunLon, elong: s.elong, phase: Math.floor(s.elong / 45) as PhaseIndex };
  if (!b.timeKnown) {
    const start = localToUtc({ year, month, day, hour: 0, minute: 0 }, b.tz).utc;
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    const end = localToUtc({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: 0, minute: 0 }, b.tz).utc;
    out.range = { from: longitude("Moon", start), to: longitude("Moon", new Date(end.getTime() - MINUTE)) };
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 *  .ics del año lunar (se genera en el navegador; nada se envía)
 * -------------------------------------------------------------------------- */

export interface IcsEvent {
  uid: string;
  at: Date;
  summary: string;
  description?: string;
}

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Corta las líneas a 75 octetos (RFC 5545 §3.1), sin partir caracteres UTF-8. */
export function foldIcsLine(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length ? 74 : 75;
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** Europe/Madrid desde 1996 (reglas de la UE): para que el calendario entienda TZID sin adivinar. */
const VTIMEZONE_MADRID = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Madrid",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/**
 * Calendario .ics: con hora (a la hora exacta en Europe/Madrid, 1 h de duración, con su VTIMEZONE) o de
 * día completo (el día en España). `now` fija DTSTAMP (para las pruebas).
 */
export function buildLunarIcs(events: IcsEvent[], opts: { mode: "timed" | "allday"; name: string; now?: Date }): string {
  const tz = SPAIN_TZ;
  const stamp = utcStamp(opts.now ?? new Date());
  const local = (d: Date) => {
    const p = zonedParts(d, tz);
    return `${p.year}${pad2(p.month)}${pad2(p.day)}T${pad2(p.hour)}${pad2(p.minute)}00`;
  };
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cirella//Ciclo lunar//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(opts.name)}`, `X-WR-TIMEZONE:${tz}`];
  if (opts.mode === "timed") lines.push(...VTIMEZONE_MADRID);
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (opts.mode === "timed") {
      lines.push(`DTSTART;TZID=${tz}:${local(e.at)}`, `DTEND;TZID=${tz}:${local(new Date(e.at.getTime() + HOUR))}`);
    } else {
      const key = dateKeyInTz(e.at, tz);
      lines.push(`DTSTART;VALUE=DATE:${key.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDaysToKey(key, 1).replace(/-/g, "")}`, "TRANSP:TRANSPARENT");
    }
    lines.push(`SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
