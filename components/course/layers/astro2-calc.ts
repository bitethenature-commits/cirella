/**
 * Los cálculos de las capas de astrología a fondo (components/course/layers/astro2.tsx): dignidades, decanatos,
 * Parte de la Fortuna, figuras de aspectos, el cielo de hoy, progresiones, revolución solar, ciclos y balance.
 * Con la carta ya calculada (lib/birth-profile.ts → computeAll) y las efemérides de lib/natal-chart.ts.
 */
import { ASPECTS, BODY_INFO, SIGNS, type AspectType } from "@/components/models/data/astrology";
import type { ComputedProfile } from "@/lib/birth-profile";
import { TEN_PLANETS } from "@/lib/lesson-blocks";
import { bodyLongitude, bodySpeed, houseOf } from "@/lib/natal-chart";
import { norm, signIndex } from "./common";
import { DIGNITIES, type Dignity } from "./astro2-texts";

export type Planet = (typeof TEN_PLANETS)[number];
export type Pos = { id: string; lon: number; house?: number; retro?: boolean };
type Chart = ComputedProfile["chart"];

const DAY = 86_400_000;
const YEAR = 365.2422 * DAY;

export const sep = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Los diez planetas de la carta, con su casa y si están retrógrados. */
export function planetsOf(chart: Chart | null | undefined): Pos[] {
  if (!chart) return [];
  return TEN_PLANETS.map((id) => chart.bodies.find((b) => b.id === id)).filter((b): b is NonNullable<typeof b> => !!b).map((b) => ({ id: b.id, lon: b.lon, house: b.house, retro: b.retro }));
}

/** El aspecto entre dos longitudes (con orbes algo estrechos, para que se lean claros). */
const ORB: Record<string, number> = { conjunction: 7, opposition: 7, square: 6, trine: 6, sextile: 4, quincunx: 2.5 };
export function aspectOf(a: number, b: number, scale = 1): { type: AspectType; orb: number } | null {
  const s = sep(a, b);
  let best: { type: AspectType; orb: number } | null = null;
  for (const t of ASPECTS) {
    const orb = Math.abs(s - t.angle);
    if (orb <= ORB[t.id] * scale && (!best || orb < best.orb)) best = { type: t, orb };
  }
  return best;
}

export function dignityOf(planet: string, sign: number): Dignity | "peregrine" {
  const d = DIGNITIES[planet];
  if (!d) return "peregrine";
  for (const k of ["domicile", "exaltation", "exile", "fall"] as Dignity[]) if (d[k].includes(sign)) return k;
  return "peregrine";
}

/** Decanato (0-35) y su regente: el del signo del mismo elemento que toca (método de triplicidades). */
export function decanOf(lon: number) {
  const i = Math.floor(norm(lon) / 10);
  return i;
}
export function decanRuler(i: number) {
  const s = Math.floor(i / 3);
  const d = i % 3;
  const rulerSign = SIGNS[(s + 4 * d) % 12];
  return { sign: SIGNS[s], part: d + 1, from: d * 10, to: d * 10 + 10, rulerSign, ruler: BODY_INFO[rulerSign.rulerId] };
}

/** La Parte de la Fortuna: Asc + Luna − Sol de día (Sol sobre el horizonte), Asc + Sol − Luna de noche. */
export function fortuneOf(chart: Chart | null | undefined): number | null {
  if (!chart?.angles) return null;
  const sun = chart.bodies.find((b) => b.id === "sun");
  const moon = chart.bodies.find((b) => b.id === "moon");
  if (!sun || !moon) return null;
  const day = sun.house ? sun.house >= 7 : true;
  return norm(day ? chart.angles.asc + moon.lon - sun.lon : chart.angles.asc + sun.lon - moon.lon);
}

/** La casa de una longitud en la carta (si hay hora). */
export const houseIn = (chart: Chart | null | undefined, lon: number) => (chart?.houses ? houseOf(lon, chart.houses.cusps) : undefined);

export type Found = { key: string; planets: string[] };

/** Las figuras de aspectos de la carta: gran trígono, T-cuadrada, gran cruz, yod, cometa y stellium. */
export function findPatterns(ps: Pos[]): Found[] {
  const out: Found[] = [];
  const is = (a: Pos, b: Pos, id: string) => aspectOf(a.lon, b.lon)?.type.id === id;
  const name = (xs: Pos[]) => xs.map((p) => BODY_INFO[p.id as Planet].name);
  const n = ps.length;
  const trines: Pos[][] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const [a, b, c] = [ps[i], ps[j], ps[k]];
        if (is(a, b, "trine") && is(b, c, "trine") && is(a, c, "trine")) trines.push([a, b, c]);
        for (const [x, y, z] of [
          [a, b, c],
          [a, c, b],
          [b, c, a],
        ]) {
          if (is(x, y, "opposition") && is(x, z, "square") && is(y, z, "square")) out.push({ key: "t-square", planets: name([x, y, z]) });
          if (is(x, y, "sextile") && is(x, z, "quincunx") && is(y, z, "quincunx")) out.push({ key: "yod", planets: name([x, y, z]) });
        }
      }
  for (const t of trines) {
    out.push({ key: "grand-trine", planets: name(t) });
    for (const d of ps) if (!t.includes(d) && t.some((x) => is(x, d, "opposition"))) out.push({ key: "kite", planets: name([...t, d]) });
  }
  // Gran cruz: dos oposiciones que se cruzan en cuadratura.
  const opp: [Pos, Pos][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (is(ps[i], ps[j], "opposition")) opp.push([ps[i], ps[j]]);
  for (let x = 0; x < opp.length; x++)
    for (let y = x + 1; y < opp.length; y++) {
      const [a, b] = opp[x];
      const [c, d] = opp[y];
      if (new Set([a, b, c, d]).size === 4 && is(a, c, "square") && is(a, d, "square")) out.push({ key: "grand-cross", planets: name([a, b, c, d]) });
    }
  for (let s = 0; s < 12; s++) {
    const here = ps.filter((p) => signIndex(p.lon) === s);
    if (here.length >= 3) out.push({ key: "stellium", planets: [`en ${SIGNS[s].name}: ${listNames(name(here))}`] });
  }
  // Sin repetidos (la misma figura vista desde otro planeta).
  const seen = new Set<string>();
  return out.filter((f) => {
    const id = `${f.key}:${[...f.planets].sort().join(",")}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const listNames = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/** Dónde están hoy los diez planetas (y si van retrógrados). */
export function skyAt(at: Date): Pos[] {
  return TEN_PLANETS.map((id) => ({ id, lon: bodyLongitude(id, at), retro: id !== "sun" && id !== "moon" && bodySpeed(id, at) < 0 }));
}

/** Edad en años (con decimales) en una fecha. */
export const ageAt = (birth: Date, at: Date) => (at.getTime() - birth.getTime()) / YEAR;

/** Progresiones secundarias: un día después de nacer por cada año de vida. */
export function progressed(birth: Date, at: Date) {
  const when = new Date(birth.getTime() + ageAt(birth, at) * DAY);
  return { sun: bodyLongitude("sun", when), moon: bodyLongitude("moon", when) };
}

/** La revolución solar más cercana a partir de `from`: cuando el Sol vuelve al grado natal. */
export function solarReturn(natalSun: number, birth: Date, from: Date) {
  const find = (year: number) => {
    let t = Date.UTC(year, birth.getUTCMonth(), birth.getUTCDate(), birth.getUTCHours(), birth.getUTCMinutes());
    for (let i = 0; i < 6; i++) {
      const d = ((natalSun - bodyLongitude("sun", new Date(t)) + 540) % 360) - 180;
      t += (d / 0.9856) * DAY;
    }
    return new Date(t);
  };
  let r = find(from.getUTCFullYear());
  if (r.getTime() < from.getTime() - 2 * DAY) r = find(from.getUTCFullYear() + 1);
  return { at: r, moon: bodyLongitude("moon", r) };
}

/** Cuántos planetas hay de cada elemento y cualidad. */
export function balanceOf(ps: Pos[]) {
  const count: Record<string, string[]> = { Fuego: [], Tierra: [], Aire: [], Agua: [], cardinal: [], fijo: [], mutable: [] };
  for (const p of ps) {
    const s = SIGNS[signIndex(p.lon)];
    const n = BODY_INFO[p.id as Planet].name;
    count[s.element].push(n);
    count[s.modality].push(n);
  }
  return count;
}
