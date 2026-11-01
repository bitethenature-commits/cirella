/**
 * La carta natal calculada: de la hora local de nacimiento y el lugar a las posiciones, los ángulos,
 * las casas y los aspectos. Puro (sin React, sin red): lo usan la carta interactiva
 * (components/models/chart-model.tsx), en el navegador, y las pruebas (scripts/unit/carta-natal.test.ts).
 *
 *   · Hora: la hora local se pasa a UTC con el desfase histórico de la zona IANA (Intl.DateTimeFormat
 *     con timeZone lleva el horario de verano y los cambios de huso desde 1900). En el cambio de otoño
 *     una hora se repite (dos instantes posibles: se toma el primero y se ofrece el otro) y en el de
 *     primavera una hora no existe (se lee con el desfase de antes del cambio, como hace un reloj que
 *     aún no se ha adelantado). También admite un desfase fijo («UTC+01:00»).
 *   · Posiciones (lib/astro-calendar.ts): geocéntricas, aparentes, eclíptica verdadera de la fecha
 *     (zodiaco tropical). Sol, Luna y planetas con astronomy-engine; Quirón con las tablas de JPL
 *     Horizons (1900–2050); Nodo Norte medio y Lilith media con Meeus. El nodo verdadero es el nodo
 *     osculador: la intersección del plano de la órbita instantánea de la Luna (r × v) con la eclíptica.
 *   · Ángulos: RAMC = tiempo sidéreo aparente de Greenwich + longitud este; oblicuidad verdadera
 *     (con nutación). MC = atan2(sen RAMC, cos RAMC · cos ε); Asc = atan2(cos RAMC, −(sen RAMC · cos ε +
 *     tan φ · sen ε)).
 *   · Casas: Plácidus (por defecto; iterando la división en tercios del semiarco diurno y nocturno de
 *     cada cúspide), signos enteros e iguales. Plácidus no existe por encima del círculo polar (|φ| ≥
 *     90° − ε ≈ 66,5°: hay grados de la eclíptica que nunca salen o nunca se ponen): ahí se usan casas
 *     iguales y se dice.
 *   · Aspectos: los cinco mayores y el quincuncio, con orbes clásicos (más amplios para el Sol y la
 *     Luna, más estrechos para los puntos y los ángulos), con si se están formando o deshaciendo.
 *
 * Comprobado contra Swiss Ephemeris 2.10 (Moshier) y JPL Horizons: ver scripts/unit/carta-natal.test.ts.
 */
import { Body as AEBody, Ecliptic, GeoVector, SiderealTime, MakeTime, e_tilt } from "astronomy-engine";
import { chironLongitude, lonDiff, longitude as calendarLongitude, meanLilith, meanNode, type Point } from "./astro-calendar";

const DEG = Math.PI / 180;
const DAY = 86_400_000;
const norm = (x: number) => ((x % 360) + 360) % 360;
const sin = (d: number) => Math.sin(d * DEG);
const cos = (d: number) => Math.cos(d * DEG);
const tan = (d: number) => Math.tan(d * DEG);
const atan2 = (y: number, x: number) => Math.atan2(y, x) / DEG;

/* -------------------------------------------------------------------------- *
 *  Hora local → UTC
 * -------------------------------------------------------------------------- */

export interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", era: "short" });
    formatters.set(tz, f);
  }
  return f;
}

/** «UTC+01:00», «UTC-3», «+05:30» → minutos; null si no es un desfase fijo. */
export function parseFixedOffset(tz: string): number | null {
  const m = /^(?:UTC|GMT)?\s*([+-−])\s*(\d{1,2})(?::?(\d{2}))?$/i.exec(tz.trim());
  if (!m) return /^(?:UTC|GMT)$/i.test(tz.trim()) ? 0 : null;
  const sign = m[1] === "+" ? 1 : -1;
  const h = Number(m[2]);
  const min = Number(m[3] ?? 0);
  if (h > 14 || min > 59) return null;
  return sign * (h * 60 + min);
}

/** ¿Es una zona que entiende el navegador (o un desfase fijo)? */
export function isValidZone(tz: string) {
  if (parseFixedOffset(tz) !== null) return true;
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** Desfase de la zona en ese instante (hora local − UTC), en minutos (con fracción: la hora local media de antes de 1900–1940 lleva segundos). */
export function zoneOffsetMinutes(tz: string, utcMs: number): number {
  const fixed = parseFixedOffset(tz);
  if (fixed !== null) return fixed;
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  let year = Number(parts.year);
  if (parts.era && /^B/i.test(parts.era)) year = 1 - year;
  const wall = new Date(Date.UTC(2000, Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)));
  wall.setUTCFullYear(year);
  return (wall.getTime() - Math.floor(utcMs / 1000) * 1000) / 60_000;
}

export interface UtcResolution {
  utc: Date;
  /** Desfase usado (hora local − UTC), en minutos. */
  offsetMinutes: number;
  /** ok · ambiguous: esa hora se repitió (cambio de otoño) · gap: esa hora no existió (cambio de primavera). */
  status: "ok" | "ambiguous" | "gap";
  /** Si es ambigua, la otra lectura (la segunda vez que el reloj marcó esa hora). */
  alternative?: { utc: Date; offsetMinutes: number };
}

/** Hora local de la zona → instante UTC, con el desfase histórico de esa fecha. */
export function localToUtc(local: LocalDateTime, tz: string): UtcResolution {
  const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const before = zoneOffsetMinutes(tz, wall - DAY);
  const after = zoneOffsetMinutes(tz, wall + DAY);
  const valid: Array<{ utc: number; offset: number }> = [];
  for (const offset of new Set([before, after, zoneOffsetMinutes(tz, wall)])) {
    const utc = wall - offset * 60_000;
    if (Math.abs(zoneOffsetMinutes(tz, utc) - offset) < 1e-6 && !valid.some((v) => v.utc === utc)) valid.push({ utc, offset });
  }
  valid.sort((a, b) => a.utc - b.utc);
  if (valid.length === 1) return { utc: new Date(valid[0].utc), offsetMinutes: valid[0].offset, status: "ok" };
  if (valid.length > 1) {
    const [first, second] = valid;
    return { utc: new Date(first.utc), offsetMinutes: first.offset, status: "ambiguous", alternative: { utc: new Date(second.utc), offsetMinutes: second.offset } };
  }
  // La hora cae en el salto: se lee con el desfase de antes del cambio.
  const utc = wall - before * 60_000;
  return { utc: new Date(utc), offsetMinutes: zoneOffsetMinutes(tz, utc), status: "gap" };
}

/** −90 → «UTC−01:30», 60 → «UTC+01:00», −14.73 → «UTC−00:14:44». */
export function formatOffset(minutes: number) {
  const sign = minutes < 0 ? "−" : "+";
  const totalSec = Math.round(Math.abs(minutes) * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `UTC${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}${s ? `:${String(s).padStart(2, "0")}` : ""}`;
}

/* -------------------------------------------------------------------------- *
 *  Cuerpos
 * -------------------------------------------------------------------------- */

export const BODY_IDS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "node", "southNode", "lilith"] as const;
export type BodyId = (typeof BODY_IDS)[number];
export type AngleId = "asc" | "mc" | "dsc" | "ic";
export type ChartPointId = BodyId | "asc" | "mc";

const AE_NAME: Partial<Record<BodyId, Point>> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
};

/** Los que pueden ir retrógrados (los nodos y Lilith son puntos: no se marcan). */
export const CAN_RETRO = new Set<BodyId>(["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron"]);

export type NodeKind = "mean" | "true";

/** Vector de la Luna en la eclíptica verdadera de la fecha (geométrico, sin aberración), en UA. */
function moonEcliptic(t: number) {
  return Ecliptic(GeoVector(AEBody.Moon, new Date(t), false)).vec;
}

/** Nodo Norte verdadero (osculador): longitud del nodo ascendente del plano de r × v de la Luna. */
export function trueNode(at: Date) {
  const t = at.getTime();
  const dt = 30 * 60_000;
  const r = moonEcliptic(t);
  const a = moonEcliptic(t - dt);
  const b = moonEcliptic(t + dt);
  const v = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const h = { x: r.y * v.z - r.z * v.y, y: r.z * v.x - r.x * v.z };
  return norm(atan2(h.x, -h.y));
}

/** Longitud de un cuerpo de la carta (NaN si no hay datos: Quirón fuera de 1900–2050). */
export function bodyLongitude(id: BodyId, at: Date, node: NodeKind = "mean"): number {
  const ae = AE_NAME[id];
  if (ae) return calendarLongitude(ae, at);
  switch (id) {
    case "chiron":
      return chironLongitude(at);
    case "node":
      return node === "true" ? trueNode(at) : meanNode(at);
    case "southNode":
      return norm((node === "true" ? trueNode(at) : meanNode(at)) + 180);
    case "lilith":
      return meanLilith(at);
    default:
      return NaN;
  }
}

/** Grados al día (negativo = retrógrado). */
export function bodySpeed(id: BodyId, at: Date, node: NodeKind = "mean") {
  const h = 3_600_000;
  const a = bodyLongitude(id, new Date(at.getTime() - h), node);
  const b = bodyLongitude(id, new Date(at.getTime() + h), node);
  return lonDiff(b, a) / ((2 * h) / DAY);
}

/* -------------------------------------------------------------------------- *
 *  Ángulos y casas
 * -------------------------------------------------------------------------- */

/** Oblicuidad verdadera de la eclíptica (con nutación), en grados. */
export const trueObliquity = (at: Date) => e_tilt(MakeTime(at)).tobl;

/** Ascensión recta del medio cielo: tiempo sidéreo aparente local, en grados. */
export const ramcOf = (at: Date, lonEast: number) => norm(SiderealTime(at) * 15 + lonEast);

export const mcFrom = (ramc: number, eps: number) => norm(atan2(sin(ramc), cos(ramc) * cos(eps)));
export const ascFrom = (ramc: number, eps: number, lat: number) => norm(atan2(cos(ramc), -(sin(ramc) * cos(eps) + tan(lat) * sin(eps))));

export interface Angles {
  asc: number;
  mc: number;
  dsc: number;
  ic: number;
  ramc: number;
  eps: number;
}

export function anglesAt(at: Date, lat: number, lonEast: number): Angles {
  const eps = trueObliquity(at);
  const ramc = ramcOf(at, lonEast);
  const asc = ascFrom(ramc, eps, lat);
  const mc = mcFrom(ramc, eps);
  return { asc, mc, dsc: norm(asc + 180), ic: norm(mc + 180), ramc, eps };
}

export type HouseSystem = "placidus" | "whole" | "equal";
export const HOUSE_SYSTEM_NAME: Record<HouseSystem, string> = { placidus: "Plácidus", whole: "Signos enteros", equal: "Casas iguales" };

/** Longitud eclíptica con esa ascensión recta (punto de la eclíptica). */
const lonFromRa = (ra: number, eps: number) => norm(atan2(sin(ra), cos(ra) * cos(eps)));

/**
 * Cúspide de Plácidus: el punto de la eclíptica cuya ascensión recta está a `k` del semiarco diurno D
 * (más `base` grados) del RAMC: casa XI = RAMC + D/3, XII = RAMC + 2D/3, II = RAMC + 60° + 2D/3,
 * III = RAMC + 120° + D/3. D depende de la declinación del propio punto: se itera.
 */
function placidusCusp(ramc: number, eps: number, lat: number, base: number, k: number, guess: number): number | null {
  let lon = guess;
  for (let i = 0; i < 100; i++) {
    const dec = Math.asin(sin(eps) * sin(lon)) / DEG;
    const x = -tan(lat) * tan(dec);
    if (Math.abs(x) > 1) return null;
    const D = Math.acos(x) / DEG;
    const next = lonFromRa(ramc + base + k * D, eps);
    if (Math.abs(lonDiff(next, lon)) < 1e-9) return next;
    lon = next;
  }
  return null;
}

export interface Houses {
  system: HouseSystem;
  /** Lo que se pidió (si Plácidus no se puede, system = "equal"). */
  requested: HouseSystem;
  /** Cúspides de la I a la XII. */
  cusps: number[];
  fallback?: string;
}

export function computeHouses(system: HouseSystem, angles: Angles, lat: number): Houses {
  const { asc, mc, ramc, eps } = angles;
  const equal = (start: number) => Array.from({ length: 12 }, (_, i) => norm(start + i * 30));
  if (system === "whole") return { system, requested: system, cusps: equal(Math.floor(asc / 30) * 30) };
  if (system === "equal") return { system, requested: system, cusps: equal(asc) };

  const polar = Math.abs(lat) >= 90 - eps;
  const c11 = polar ? null : placidusCusp(ramc, eps, lat, 0, 1 / 3, norm(mc + 30));
  const c12 = polar ? null : placidusCusp(ramc, eps, lat, 0, 2 / 3, norm(mc + 60));
  const c2 = polar ? null : placidusCusp(ramc, eps, lat, 60, 2 / 3, norm(asc + 30));
  const c3 = polar ? null : placidusCusp(ramc, eps, lat, 120, 1 / 3, norm(asc + 60));
  if (c11 === null || c12 === null || c2 === null || c3 === null) {
    return {
      system: "equal",
      requested: system,
      cusps: equal(asc),
      fallback: `A ${Math.abs(lat).toFixed(1).replace(".", ",")}° de latitud (más allá del círculo polar) las casas de Plácidus no existen: hay grados del zodiaco que ese día no salen o no se ponen. Se usan casas iguales desde el Ascendente.`,
    };
  }
  const cusps = [asc, c2, c3, norm(mc + 180), norm(c11 + 180), norm(c12 + 180), norm(asc + 180), norm(c2 + 180), norm(c3 + 180), mc, c11, c12];
  return { system, requested: system, cusps };
}

/** Casa (1–12) en la que cae una longitud. */
export function houseOf(lon: number, cusps: number[]) {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const span = norm(cusps[(i + 1) % 12] - start);
    if (norm(lon - start) < span) return i + 1;
  }
  return 1;
}

/* -------------------------------------------------------------------------- *
 *  La carta
 * -------------------------------------------------------------------------- */

export interface ChartBody {
  id: BodyId;
  lon: number;
  /** Grados al día. */
  speed: number;
  retro: boolean;
  /** 1–12; undefined sin hora. */
  house?: number;
}

export interface ChartInput {
  /** Instante de nacimiento (UTC). Sin hora: el mediodía local. */
  utc: Date;
  timeKnown: boolean;
  lat: number;
  /** Longitud este positiva (oeste negativa). */
  lon: number;
  houseSystem: HouseSystem;
  node: NodeKind;
}

export interface Chart {
  input: ChartInput;
  bodies: ChartBody[];
  angles?: Angles;
  houses?: Houses;
}

export function computeChart(input: ChartInput): Chart {
  const { utc, timeKnown, lat, lon, houseSystem, node } = input;
  const angles = timeKnown ? anglesAt(utc, lat, lon) : undefined;
  const houses = angles ? computeHouses(houseSystem, angles, lat) : undefined;
  const bodies: ChartBody[] = [];
  for (const id of BODY_IDS) {
    const l = bodyLongitude(id, utc, node);
    if (Number.isNaN(l)) continue;
    const speed = bodySpeed(id, utc, node);
    bodies.push({ id, lon: l, speed, retro: CAN_RETRO.has(id) && speed < 0, house: houses ? houseOf(l, houses.cusps) : undefined });
  }
  return { input, bodies, angles, houses };
}

/* -------------------------------------------------------------------------- *
 *  Aspectos
 * -------------------------------------------------------------------------- */

export type AspectId = "conjunction" | "sextile" | "square" | "trine" | "quincunx" | "opposition";
export const ASPECT_ANGLE: Record<AspectId, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, quincunx: 150, opposition: 180 };

type OrbClass = "luminary" | "planet" | "point";
const orbClass = (id: ChartPointId): OrbClass => (id === "sun" || id === "moon" ? "luminary" : id === "node" || id === "southNode" || id === "lilith" || id === "asc" || id === "mc" ? "point" : "planet");

/** Orbes en grados: el Sol y la Luna, más amplios; los nodos, Lilith y los ángulos, más estrechos. */
export const ORBS: Record<OrbClass, Record<AspectId, number>> = {
  luminary: { conjunction: 10, opposition: 10, square: 8, trine: 8, sextile: 6, quincunx: 3 },
  planet: { conjunction: 8, opposition: 8, square: 7, trine: 7, sextile: 5, quincunx: 3 },
  point: { conjunction: 5, opposition: 5, square: 4, trine: 4, sextile: 3, quincunx: 2 },
};

/** El orbe de un par: el de un punto si hay alguno; si no, el más amplio de los dos. */
export function orbFor(type: AspectId, a: ChartPointId, b: ChartPointId) {
  const ca = orbClass(a);
  const cb = orbClass(b);
  if (ca === "point" || cb === "point") return ORBS.point[type];
  return Math.max(ORBS[ca][type], ORBS[cb][type]);
}

export interface AspectPoint {
  id: ChartPointId;
  lon: number;
  /** Grados al día (para saber si el aspecto se forma); los ángulos no llevan. */
  speed?: number;
}

export interface Aspect {
  a: ChartPointId;
  b: ChartPointId;
  type: AspectId;
  /** Distancia al aspecto exacto, en grados. */
  orb: number;
  maxOrb: number;
  /** 1 exacto … 0 en el límite del orbe. */
  strength: number;
  /** true = se está formando; false = se deshace; undefined = con un ángulo. */
  applying?: boolean;
}

const separation = (a: number, b: number) => Math.abs(lonDiff(a, b));

/** Pares que no cuentan: los dos nodos (siempre opuestos) y Asc–MC. */
const SKIP_PAIRS = new Set(["node|southNode", "asc|mc"]);

export function findAspects(points: AspectPoint[], enabled: ReadonlySet<AspectId>): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p = points[i];
      const q = points[j];
      if (SKIP_PAIRS.has(`${p.id}|${q.id}`) || SKIP_PAIRS.has(`${q.id}|${p.id}`)) continue;
      const sep = separation(p.lon, q.lon);
      let best: Aspect | null = null;
      for (const type of Object.keys(ASPECT_ANGLE) as AspectId[]) {
        if (!enabled.has(type)) continue;
        const maxOrb = orbFor(type, p.id, q.id);
        const orb = Math.abs(sep - ASPECT_ANGLE[type]);
        if (orb > maxOrb || (best && orb >= best.orb)) continue;
        let applying: boolean | undefined;
        if (p.speed !== undefined && q.speed !== undefined) {
          const dt = 1 / 24;
          const later = Math.abs(separation(p.lon + p.speed * dt, q.lon + q.speed * dt) - ASPECT_ANGLE[type]);
          applying = later < orb;
        }
        best = { a: p.id, b: q.id, type, orb, maxOrb, strength: 1 - orb / maxOrb, applying };
      }
      if (best) out.push(best);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 *  Dibujo: separar los glifos que caen juntos
 * -------------------------------------------------------------------------- */

/**
 * Posición de dibujo de cada punto en la rueda: los que están a menos de `minSep` grados se abren en
 * abanico alrededor del centro de su grupo, a `minSep` entre sí (los grupos que al abrirse se tocan se
 * juntan). Devuelve los ángulos de dibujo en el mismo orden que `lons`.
 */
export function spreadLongitudes(lons: number[], minSep: number): number[] {
  const n = lons.length;
  if (n < 2) return lons.map(norm);
  const sep = Math.min(minSep, 360 / n);
  const order = lons.map((l, i) => ({ l: norm(l), i })).sort((a, b) => a.l - b.l);
  // Empezar justo después del hueco más grande: así no hay grupos que crucen el 0°.
  let gapAt = 0;
  let gap = -1;
  for (let k = 0; k < n; k++) {
    const g = norm(order[(k + 1) % n].l - order[k].l) || (n === 1 ? 360 : 0);
    if (g > gap) {
      gap = g;
      gapAt = (k + 1) % n;
    }
  }
  const seq = Array.from({ length: n }, (_, k) => order[(gapAt + k) % n]);
  const xs: number[] = [];
  for (const s of seq) xs.push(xs.length && s.l < xs[xs.length - 1] ? s.l + 360 : s.l);
  type Group = { members: number[]; center: number };
  let groups: Group[] = xs.map((x, k) => ({ members: [k], center: x }));
  const start = (g: Group) => g.center - ((g.members.length - 1) * sep) / 2;
  const end = (g: Group) => g.center + ((g.members.length - 1) * sep) / 2;
  for (let changed = true; changed; ) {
    changed = false;
    const next: Group[] = [];
    for (const g of groups) {
      const prev = next[next.length - 1];
      if (prev && start(g) - end(prev) < sep - 1e-9) {
        const members = [...prev.members, ...g.members];
        next[next.length - 1] = { members, center: members.reduce((s, k) => s + xs[k], 0) / members.length };
        changed = true;
      } else next.push(g);
    }
    groups = next;
  }
  const out = new Array<number>(n);
  for (const g of groups) g.members.forEach((k, m) => (out[seq[k].i] = norm(start(g) + m * sep)));
  return out;
}

/* -------------------------------------------------------------------------- *
 *  Utilidades
 * -------------------------------------------------------------------------- */

/** 222.2 → { sign: 7, deg: 12, min: 12 } (truncado, como en las efemérides). */
export function zodiacPos(lon: number) {
  const totalMin = Math.floor(norm(lon) * 60 + 1e-6);
  return { sign: Math.floor(totalMin / 1800) % 12, deg: Math.floor((totalMin % 1800) / 60), min: totalMin % 60 };
}

/** 40.4168 → «40°25′N»; −3.70 → «3°42′O». */
export function formatCoord(value: number, kind: "lat" | "lon") {
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  const [dd, mm] = m === 60 ? [d + 1, 0] : [d, m];
  const hemi = kind === "lat" ? (value < 0 ? "S" : "N") : value < 0 ? "O" : "E";
  return `${dd}°${String(mm).padStart(2, "0")}′${hemi}`;
}
