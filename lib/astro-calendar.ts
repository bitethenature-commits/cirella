/**
 * Cielo del mes para el calendario de la dueña: lunas nuevas y llenas, eclipses, conjunciones,
 * estaciones (cuando un cuerpo se pone retrógrado o directo) y los cambios de signo de la Luna.
 * Puro (astronomy-engine y tablas de JPL Horizons, sin red ni BD): lo usan la página de Reservas y
 * las pruebas unitarias.
 *
 *   · Posiciones geocéntricas, eclíptica verdadera de la fecha (zodiaco tropical), con aberración.
 *   · Cuerpos: el Sol, la Luna y los planetas (astronomy-engine); Quirón, Ceres, Palas, Juno, Vesta y
 *     Eris (tablas de JPL Horizons de 2000 a 2050 en lib/astro-tables.ts, interpoladas; fuera de esos
 *     años no salen); y dos puntos medios con las fórmulas de Meeus (Astronomical Algorithms, 2.ª ed.,
 *     cap. 47): el Nodo Norte medio y Lilith (Luna Negra media = apogeo medio = perigeo medio + 180°).
 *     El Nodo Sur (Nodo Norte + 180°) solo sale en las posiciones del día: sus conjunciones serían las
 *     oposiciones al Nodo Norte.
 *   · Conjunción = la diferencia de longitud de un par cruza 0°. Se muestrea cada 6 h, se afina por
 *     bisección hasta el minuto y, cerca de una estación (retrógrado), si la diferencia roza 0° sin
 *     cambiar de signo entre muestras se vuelve a mirar cada 15 min: así salen los dos cruces.
 *     Sol–Luna no cuenta como conjunción: es la luna nueva.
 *   · Estación = la velocidad en longitud cruza 0 (se muestrea cada 12 h y se afina al minuto).
 *   · Grupos (para «Qué mostrar» y las marcas del calendario): planetas, Luna, asteroides (con Eris)
 *     y puntos (Quirón, Lilith y los nodos).
 *   · Los eventos van en UTC; agruparlos por día en la zona de la dueña es cosa de quien los pinta.
 *   · Se calcula por mes UTC y se guarda en memoria (pocos meses: lo que se mira son el actual y los
 *     vecinos).
 */
import { Body as AEBody, Ecliptic, GeoVector, MakeTime, NextGlobalSolarEclipse, NextLunarEclipse, NextMoonQuarter, SearchGlobalSolarEclipse, SearchLunarEclipse, SearchMoonQuarter } from "astronomy-engine";
import { BODY_TABLE_ALPHABET, BODY_TABLES } from "./astro-tables";

export const SIGNS = ["Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo", "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis"] as const;
export const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"] as const;

export const PLANETS = ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"] as const;
export type Planet = (typeof PLANETS)[number];
export const ASTEROIDS = ["Ceres", "Pallas", "Juno", "Vesta", "Eris"] as const;
export type TableBody = keyof typeof BODY_TABLES;
/** Todo lo que entra en las conjunciones, en el orden en que se nombran los pares. */
export const BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron", ...ASTEROIDS, "Node", "Lilith"] as const;
export type Point = (typeof BODIES)[number];
/** Los que tienen estaciones (los puntos medios no: el nodo medio siempre va hacia atrás y Lilith hacia delante). */
export const STATION_BODIES = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron", ...ASTEROIDS] as const;
export type StationBody = (typeof STATION_BODIES)[number];
export const PLANET_ES: Record<Point | "SouthNode", string> = {
  Sun: "Sol",
  Moon: "Luna",
  Mercury: "Mercurio",
  Venus: "Venus",
  Mars: "Marte",
  Jupiter: "Júpiter",
  Saturn: "Saturno",
  Uranus: "Urano",
  Neptune: "Neptuno",
  Pluto: "Plutón",
  Chiron: "Quirón",
  Ceres: "Ceres",
  Pallas: "Palas",
  Juno: "Juno",
  Vesta: "Vesta",
  Eris: "Eris",
  Node: "Nodo Norte",
  SouthNode: "Nodo Sur",
  Lilith: "Lilith",
};
/** «Ceres se pone retrógrada». */
const FEMININE = new Set<string>([...ASTEROIDS, "Lilith"]);

export const ASTRO_GROUPS = ["planets", "moon", "asteroids", "points"] as const;
export type AstroGroup = (typeof ASTRO_GROUPS)[number];
export const ASTRO_GROUP_ES: Record<AstroGroup, string> = { planets: "Planetas", moon: "Luna", asteroids: "Asteroides", points: "Puntos" };
export function groupOf(body: Point | "SouthNode"): AstroGroup {
  if (body === "Moon") return "moon";
  if ((ASTEROIDS as readonly string[]).includes(body)) return "asteroids";
  if (body === "Chiron" || body === "Node" || body === "SouthNode" || body === "Lilith") return "points";
  return "planets";
}

export type EclipseType = "penumbral" | "partial" | "annular" | "total";

export type AstroEvent =
  | { kind: "moon"; phase: "new" | "full"; at: Date; lon: number }
  | { kind: "eclipse"; body: "solar" | "lunar"; type: EclipseType; at: Date; lon: number }
  /** aRetro / bRetro: si cada uno va retrógrado en ese momento. */
  | { kind: "conjunction"; a: Point; b: Point; at: Date; lon: number; aRetro: boolean; bRetro: boolean }
  | { kind: "station"; body: StationBody; direction: "retrograde" | "direct"; at: Date; lon: number }
  /** La Luna entra en `sign` (0 = Aries). */
  | { kind: "moon-ingress"; sign: number; at: Date };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const norm = (x: number) => ((x % 360) + 360) % 360;
const DAY = 86_400_000;

/** Siglos julianos (TT) desde J2000. */
const centuries = (at: Date) => MakeTime(at).tt / 36525;

/** Nodo Norte medio de la Luna (Meeus 47.7), equinoccio medio de la fecha. */
export function meanNode(at: Date) {
  const T = centuries(at);
  return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441 - (T * T * T * T) / 60616000);
}

/** Lilith media (Luna Negra) = apogeo medio de la Luna: perigeo medio (Meeus 47.7) + 180°. */
export function meanLilith(at: Date) {
  const T = centuries(at);
  return norm(83.3532465 + 4069.0137287 * T - 0.01032 * T * T - (T * T * T) / 80053 + (T * T * T * T) / 18999000 + 180);
}

/** Longitudes de cada tabla, en grados y sin dar la vuelta (para interpolar sin saltos). */
const decoded = new Map<TableBody, Float64Array>();
function tableLons(body: TableBody) {
  const hit = decoded.get(body);
  if (hit) return hit;
  const { deltas, startLon } = BODY_TABLES[body];
  const n = deltas.length / 2 + 1;
  const t = new Float64Array(n);
  let v = startLon;
  t[0] = v / 1000;
  for (let i = 1; i < n; i++) {
    v += BODY_TABLE_ALPHABET.indexOf(deltas[2 * i - 2]) * 64 + BODY_TABLE_ALPHABET.indexOf(deltas[2 * i - 1]) - 2048;
    t[i] = v / 1000;
  }
  decoded.set(body, t);
  return t;
}

/** Cuerpo de tabla interpolado (Lagrange de 4 puntos); NaN fuera de la tabla (2000–2050). */
export function tableLongitude(body: TableBody, at: Date) {
  const t = tableLons(body);
  const { start, stepDays } = BODY_TABLES[body];
  const x = (at.getTime() - start) / (stepDays * DAY);
  const i = Math.floor(x);
  if (i < 1 || i + 2 >= t.length) return NaN;
  const u = x - i;
  const [p0, p1, p2, p3] = [t[i - 1], t[i], t[i + 1], t[i + 2]];
  const v = p1 + (u * (p2 - p0)) / 2 + (u * u * (2 * p0 - 5 * p1 + 4 * p2 - p3)) / 2 + (u * u * u * (3 * (p1 - p2) + p3 - p0)) / 2;
  return norm(v);
}

export const chironLongitude = (at: Date) => tableLongitude("Chiron", at);

const isTable = (body: string): body is TableBody => body in BODY_TABLES;

/** Longitud eclíptica geocéntrica aparente (tropical, de la fecha) en [0, 360). */
export function longitude(body: Point, at: Date): number {
  if (isTable(body)) return tableLongitude(body, at);
  if (body === "Node") return meanNode(at);
  if (body === "Lilith") return meanLilith(at);
  return norm(Ecliptic(GeoVector(AEBody[body], at, true)).elon);
}

/** Velocidad en longitud (grados al día); negativa = retrógrado. */
export function speed(body: Point, at: Date): number {
  const h = HOUR;
  return lonDiff(longitude(body, new Date(at.getTime() + h)), longitude(body, new Date(at.getTime() - h))) / ((2 * h) / DAY);
}

export const isRetro = (body: Point, at: Date) => speed(body, at) < 0;

/** Diferencia a − b llevada a [−180, 180). */
export function lonDiff(a: number, b: number) {
  return ((((a - b + 540) % 360) + 360) % 360) - 180;
}

/** 222.2 → { sign: 7 (Escorpio), deg: 12, min: 12 }. Grados y minutos truncados, como en las efemérides. */
export function zodiac(lon: number) {
  const totalMin = Math.floor((((lon % 360) + 360) % 360) * 60 + 1e-6);
  const sign = Math.floor(totalMin / 1800) % 12;
  const inSign = totalMin % 1800;
  return { sign, deg: Math.floor(inSign / 60), min: inSign % 60 };
}

/** «Escorpio 4°12′». */
export function formatZodiac(lon: number) {
  const z = zodiac(lon);
  return `${SIGNS[z.sign]} ${z.deg}°${String(z.min).padStart(2, "0")}′`;
}

/** Bisección de un cambio de signo de `f` entre t0 y t1 (f(t0) y f(t1) de signo distinto), al minuto. */
function bisect(f: (t: number) => number, t0: number, t1: number) {
  let a = t0;
  let b = t1;
  const fa = f(a) < 0;
  while (b - a > 20_000) {
    const m = (a + b) / 2;
    if (f(m) < 0 === fa) a = m;
    else b = m;
  }
  return new Date(Math.round((a + b) / 2 / MINUTE) * MINUTE);
}

/** Conjunciones entre todos los cuerpos y puntos (menos Sol–Luna, que es la luna nueva) en [from, to). */
export function conjunctionsBetween(from: Date, to: Date, stepHours = 6): AstroEvent[] {
  const step = stepHours * HOUR;
  const times: number[] = [];
  for (let t = from.getTime() - step; t <= to.getTime() + step; t += step) times.push(t);
  // Longitudes de cada cuerpo en cada muestra: se calculan una vez y sirven para todos los pares.
  const lons = new Map<Point, number[]>(BODIES.map((p) => [p, times.map((t) => longitude(p, new Date(t)))]));
  const out: AstroEvent[] = [];
  const found = (a: Point, b: Point, at: Date) => {
    if (at < from || at >= to) return;
    if (out.some((e) => e.kind === "conjunction" && e.a === a && e.b === b && Math.abs(e.at.getTime() - at.getTime()) < 2 * HOUR)) return;
    out.push({ kind: "conjunction", a, b, at, lon: longitude(a, at), aRetro: isRetro(a, at), bRetro: isRetro(b, at) });
  };
  for (let i = 0; i < BODIES.length; i++) {
    for (let j = i + 1; j < BODIES.length; j++) {
      const a = BODIES[i];
      const b = BODIES[j];
      if (a === "Sun" && b === "Moon") continue;
      const la = lons.get(a)!;
      const lb = lons.get(b)!;
      // Un cuerpo de tabla fuera de sus años: sin datos, sin conjunciones.
      if (la.some(Number.isNaN) || lb.some(Number.isNaN)) continue;
      const d = times.map((_, k) => lonDiff(la[k], lb[k]));
      const f = (t: number) => lonDiff(longitude(a, new Date(t)), longitude(b, new Date(t)));
      for (let k = 0; k + 1 < times.length; k++) {
        // Cruce por 0° (no por ±180°, que es la oposición).
        if (d[k] < 0 !== d[k + 1] < 0 && Math.abs(d[k]) < 90 && Math.abs(d[k + 1]) < 90) found(a, b, bisect(f, times[k], times[k + 1]));
        // Roza 0° sin cambiar de signo (estación cerca de la conjunción): se mira más fino.
        else if (k > 0 && Math.abs(d[k]) < 1 && Math.abs(d[k]) <= Math.abs(d[k - 1]) && Math.abs(d[k]) <= Math.abs(d[k + 1])) {
          const fine = 15 * MINUTE;
          let prevT = times[k - 1];
          let prevD = d[k - 1];
          for (let t = prevT + fine; t <= times[k + 1]; t += fine) {
            const cur = f(t);
            if (prevD < 0 !== cur < 0 && Math.abs(cur) < 90) found(a, b, bisect(f, prevT, t));
            prevT = t;
            prevD = cur;
          }
        }
      }
    }
  }
  return out;
}

/** Estaciones (se pone retrógrado / directo) de Mercurio a Plutón, Quirón y los asteroides en [from, to). */
export function stationsBetween(from: Date, to: Date): AstroEvent[] {
  const step = 12 * HOUR;
  const out: AstroEvent[] = [];
  for (const body of STATION_BODIES) {
    const f = (t: number) => speed(body, new Date(t));
    let t0 = from.getTime() - step;
    let v0 = f(t0);
    for (let t1 = t0 + step; t0 < to.getTime(); t1 += step) {
      const v1 = f(t1);
      if (!Number.isNaN(v0) && !Number.isNaN(v1) && v0 < 0 !== v1 < 0) {
        const at = bisect(f, t0, t1);
        if (at >= from && at < to) out.push({ kind: "station", body, direction: v1 < 0 ? "retrograde" : "direct", at, lon: longitude(body, at) });
      }
      t0 = t1;
      v0 = v1;
    }
  }
  return out;
}

/** Posición de cada cuerpo en un instante, con ℞: lo que se enseña como «el cielo del día» (con el Nodo Sur). */
export function positionsAt(at: Date): { body: Point | "SouthNode"; lon: number; retro: boolean }[] {
  const out: { body: Point | "SouthNode"; lon: number; retro: boolean }[] = [];
  for (const body of BODIES) {
    const lon = longitude(body, at);
    if (Number.isNaN(lon)) continue;
    out.push({ body, lon, retro: body !== "Sun" && body !== "Moon" && isRetro(body, at) });
    if (body === "Node") out.push({ body: "SouthNode", lon: norm(lon + 180), retro: out[out.length - 1].retro });
  }
  return out;
}

/** Lunas nuevas y llenas en [from, to). */
export function moonPhasesBetween(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = [];
  for (let q = SearchMoonQuarter(from); q.time.date < to; q = NextMoonQuarter(q)) {
    if (q.quarter !== 0 && q.quarter !== 2) continue;
    const at = new Date(Math.round(q.time.date.getTime() / MINUTE) * MINUTE);
    out.push({ kind: "moon", phase: q.quarter === 0 ? "new" : "full", at, lon: longitude("Moon", q.time.date) });
  }
  return out;
}

/** Eclipses de Sol (globales: en algún lugar de la Tierra) y de Luna en [from, to), con la hora del máximo. */
export function eclipsesBetween(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = [];
  const round = (d: Date) => new Date(Math.round(d.getTime() / MINUTE) * MINUTE);
  for (let e = SearchLunarEclipse(from); e.peak.date < to; e = NextLunarEclipse(e.peak))
    out.push({ kind: "eclipse", body: "lunar", type: e.kind as EclipseType, at: round(e.peak.date), lon: longitude("Moon", e.peak.date) });
  for (let e = SearchGlobalSolarEclipse(from); e.peak.date < to; e = NextGlobalSolarEclipse(e.peak))
    out.push({ kind: "eclipse", body: "solar", type: e.kind as EclipseType, at: round(e.peak.date), lon: longitude("Sun", e.peak.date) });
  return out;
}

/** Cambios de signo de la Luna en [from, to) (unos 12 al mes). */
export function moonIngressesBetween(from: Date, to: Date): AstroEvent[] {
  const step = 2 * HOUR;
  const out: AstroEvent[] = [];
  const signAt = (t: number) => Math.floor(longitude("Moon", new Date(t)) / 30);
  let t0 = from.getTime();
  let s0 = signAt(t0);
  for (let t1 = t0 + step; t0 < to.getTime(); t1 += step) {
    const s1 = signAt(t1);
    if (s1 !== s0) {
      // Cambio de signo = la longitud cruza el borde del signo nuevo.
      const edge = s1 * 30;
      const at = bisect((t) => lonDiff(longitude("Moon", new Date(t)), edge), t0, t1);
      if (at >= from && at < to) out.push({ kind: "moon-ingress", sign: s1, at });
    }
    t0 = t1;
    s0 = s1;
  }
  return out;
}

/** Signo de la Luna en un instante (0 = Aries). */
export function moonSignAt(at: Date) {
  return Math.floor(longitude("Moon", at) / 30);
}

const byTime = (a: AstroEvent, b: AstroEvent) => a.at.getTime() - b.at.getTime();

/** Todo lo de un mes UTC (month 1–12), sin caché. */
export function computeMonth(year: number, month: number): AstroEvent[] {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return [...moonPhasesBetween(from, to), ...eclipsesBetween(from, to), ...conjunctionsBetween(from, to), ...stationsBetween(from, to), ...moonIngressesBetween(from, to)].sort(byTime);
}

const cache = new Map<string, AstroEvent[]>();
const CACHE_MAX = 36;

/** Lo de un mes UTC, guardado en memoria. */
export function astroMonth(year: number, month: number): AstroEvent[] {
  const key = `${year}-${month}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const events = computeMonth(year, month);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, events);
  return events;
}

/** Eventos en [from, to), juntando los meses UTC que toca (del caché). */
export function astroEventsBetween(from: Date, to: Date): AstroEvent[] {
  const out: AstroEvent[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth() + 1;
  while (Date.UTC(y, m - 1, 1) < to.getTime()) {
    for (const e of astroMonth(y, m)) if (e.at >= from && e.at < to) out.push(e);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

const ECLIPSE_ES: Record<EclipseType, string> = { penumbral: "penumbral", partial: "parcial", annular: "anular", total: "total" };

/** Qué es, en palabras: «Conjunción», «Luna nueva», «Estación retrógrada»… */
export function astroLabel(e: AstroEvent): string {
  switch (e.kind) {
    case "moon":
      return e.phase === "new" ? "Luna nueva" : "Luna llena";
    case "eclipse":
      return e.body === "solar" ? "Eclipse solar" : "Eclipse lunar";
    case "conjunction":
      return "Conjunción";
    case "station":
      return e.direction === "retrograde" ? "Estación retrógrada" : "Estación directa";
    case "moon-ingress":
      return "Cambio de signo de la Luna";
  }
}

const rx = (on: boolean) => (on ? " ℞" : "");

/** Grupos de los cuerpos de un evento (para «Qué mostrar»). */
export function astroGroups(e: AstroEvent): AstroGroup[] {
  if (e.kind === "conjunction") return [...new Set([groupOf(e.a), groupOf(e.b)])];
  if (e.kind === "station") return [groupOf(e.body)];
  return ["moon"];
}

/**
 * ¿Sale como marca en la rejilla del mes? Lunas, eclipses y conjunciones sí (menos las de la Luna,
 * que serían casi a diario); estaciones, solo las de los planetas y Quirón. El resto, solo en el día.
 */
export function astroMarks(e: AstroEvent): boolean {
  if (e.kind === "conjunction") return e.a !== "Moon" && e.b !== "Moon";
  if (e.kind === "station") return groupOf(e.body) === "planets" || e.body === "Chiron";
  return e.kind !== "moon-ingress";
}

/** Texto del evento (sin la hora): «Luna nueva en Escorpio 4°12′», «☌ Venus ℞ – Quirón en Aries 22°40′». */
export function describeAstro(e: AstroEvent): string {
  switch (e.kind) {
    case "moon":
      return `${e.phase === "new" ? "Luna nueva" : "Luna llena"} en ${formatZodiac(e.lon)}`;
    case "eclipse":
      return `Eclipse ${e.body === "solar" ? "solar" : "lunar"} ${ECLIPSE_ES[e.type]} en ${formatZodiac(e.lon)}`;
    case "conjunction":
      return `☌ ${PLANET_ES[e.a]}${rx(e.aRetro)} – ${PLANET_ES[e.b]}${rx(e.bRetro)} en ${formatZodiac(e.lon)}`;
    case "station":
      return `${PLANET_ES[e.body]} se pone ${e.direction === "retrograde" ? "retrógrad" : "direct"}${FEMININE.has(e.body) ? "a" : "o"} en ${formatZodiac(e.lon)}`;
    case "moon-ingress":
      return `La Luna entra en ${SIGNS[e.sign]}`;
  }
}
