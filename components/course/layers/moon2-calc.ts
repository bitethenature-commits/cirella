/**
 * Los cálculos de la Luna a fondo (components/course/layers/moon2.tsx): las lunas llenas del año, los
 * eclipses, la Luna fuera de curso, la Luna de hoy por las casas, los retornos lunares, perigeos y
 * superlunas, las 28 mansiones y el ciclo de los nodos. Todo se guarda por día (no cambia en un rato).
 */
import { eclipsesBetween, lonDiff, longitude, meanNode, moonIngressesBetween, type EclipseType } from "@/lib/astro-calendar";
import { apsidesBetween, lunarReturnsBetween, lunationsBetween, nearestApsides, SPAIN_TZ, type Lunation } from "@/lib/lunar-sky";
import { houseOf } from "@/lib/natal-chart";
import { zonedTimeToUtc } from "@/lib/tz";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const YEAR = 365.2422 * DAY;
const norm = (x: number) => ((x % 360) + 360) % 360;

/* ------------------------------------------------------------------ caché */

const cache = new Map<string, unknown>();
const dayKey = () => new Date().toISOString().slice(0, 10);
function memo<T>(key: string, fn: () => T): T {
  const k = `${dayKey()}|${key}`;
  if (!cache.has(k)) cache.set(k, fn());
  return cache.get(k) as T;
}

/* --------------------------------------------------------------- fechas */

export const thisYear = () => Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: SPAIN_TZ }).format(new Date()));
const monthOf = (d: Date) => Number(new Intl.DateTimeFormat("en", { month: "numeric", timeZone: SPAIN_TZ }).format(d)) - 1;

export const fmtDay = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: SPAIN_TZ });
export const fmtDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: SPAIN_TZ });
export const fmtShort = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: SPAIN_TZ }).replace(".", "");
export const fmtTime = (d: Date) => d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: SPAIN_TZ });
export const fmtWhen = (d: Date) => `${fmtDay(d)} a las ${fmtTime(d)}`;
export function fmtSpan(ms: number) {
  const h = Math.floor(ms / HOUR);
  const m = Math.round((ms % HOUR) / 60000);
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

/* ------------------------------------------------- 1 · las lunas llenas */

export const FULL_NAMES = ["Luna del Lobo", "Luna de Nieve", "Luna del Gusano", "Luna Rosa", "Luna de las Flores", "Luna de Fresa", "Luna del Ciervo", "Luna del Esturión", "Luna de la Cosecha", "Luna del Cazador", "Luna del Castor", "Luna Fría"];
export const FULL_MEANING = [
  "Enero: el frío y el hambre de los lobos. Una luna para cuidar a tu manada y saber qué te sostiene.",
  "Febrero: la nieve más honda. Una luna para la paciencia: lo que crece aún está bajo tierra.",
  "Marzo: la tierra se ablanda y salen los gusanos. Una luna de despertar y de primeros brotes.",
  "Abril: las primeras flores rosas. Una luna de ternura y de abrirse poco a poco.",
  "Mayo: todo florece. Una luna de abundancia, belleza y fertilidad.",
  "Junio: la cosecha de las fresas. Una luna dulce, para disfrutar de lo que ya ha madurado.",
  "Julio: al ciervo le crecen las astas. Una luna de fuerza y de crecer hacia fuera.",
  "Agosto: la pesca del esturión. Una luna de recoger lo que da el verano.",
  "Septiembre: la luna más cercana al equinoccio, que alumbra la cosecha. Una luna de gratitud.",
  "Octubre: la luna de los cazadores. Una luna para preparar el invierno y elegir lo esencial.",
  "Noviembre: los castores preparan sus presas. Una luna para proteger lo tuyo.",
  "Diciembre: las noches más largas. Una luna para el recogimiento y el fuego del hogar.",
];

export type FullMoon = Lunation & { month: number; blue: boolean; micro: boolean };

/** Las lunas llenas del año (12 o 13), con su nombre por el mes, la luna azul, la superluna y la microluna. */
export function fullMoonsOfYear(year = thisYear()): FullMoon[] {
  return memo(`full${year}`, () => {
    const all = lunationsBetween(zonedTimeToUtc(`${year}-01-01`, 0, SPAIN_TZ), zonedTimeToUtc(`${year + 1}-01-01`, 0, SPAIN_TZ), "syzygy").filter((l) => l.k === 4);
    return all.map((l, i) => {
      const month = monthOf(l.at);
      const { perigee, apogee } = nearestApsides(l.at);
      return { ...l, month, blue: i > 0 && monthOf(all[i - 1].at) === month, micro: l.distKm >= apogee.km - 0.1 * (apogee.km - perigee.km) };
    });
  });
}

/* ------------------------------------------------------- 2 · eclipses */

export type Eclipse = { body: "solar" | "lunar"; type: EclipseType; at: Date; lon: number };

/** Los eclipses de este año y del que viene. */
/** Los eclipses de un año (este, con shift = 0). */
export function eclipsesSoon(shift = 0): Eclipse[] {
  return memo(`eclipses${shift}`, () => {
    const y = thisYear() + shift;
    return eclipsesBetween(zonedTimeToUtc(`${y}-01-01`, 0, SPAIN_TZ), zonedTimeToUtc(`${y + 1}-01-01`, 0, SPAIN_TZ))
      .flatMap((e) => (e.kind === "eclipse" ? [{ body: e.body, type: e.type, at: e.at, lon: e.lon }] : []))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  });
}

/* ------------------------------------------------ 3 · fuera de curso */

const VOC_PLANETS = ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"] as const;
export const VOC_ES: Record<string, string> = { Sun: "el Sol", Mercury: "Mercurio", Venus: "Venus", Mars: "Marte", Jupiter: "Júpiter", Saturn: "Saturno", Uranus: "Urano", Neptune: "Neptuno", Pluto: "Plutón" };
const ASPECT_ES: Record<number, string> = { 0: "conjunción", 60: "sextil", 90: "cuadratura", 120: "trígono", 180: "oposición" };

export type Void = { start: Date; end: Date; sign: number; nextSign: number; last: { planet: string; aspect: string } | null };

/** Los próximos periodos de Luna fuera de curso: del último aspecto mayor de la Luna en un signo hasta que entra en el siguiente. */
/** El primer día del mes elegido (este, con shift = 0) y el del siguiente, en hora de España. */
export function monthBounds(shift = 0) {
  const parts = new Intl.DateTimeFormat("en", { year: "numeric", month: "numeric", timeZone: SPAIN_TZ }).formatToParts(new Date());
  const y0 = Number(parts.find((p) => p.type === "year")!.value);
  const m0 = Number(parts.find((p) => p.type === "month")!.value) - 1 + shift;
  const y = y0 + Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12;
  const key = (yy: number, mm: number) => `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
  const start = zonedTimeToUtc(key(y, m), 0, SPAIN_TZ);
  const end = zonedTimeToUtc(m === 11 ? key(y + 1, 0) : key(y, m + 1), 0, SPAIN_TZ);
  return { start, end, year: y, month: m };
}

/** Los periodos de Luna fuera de curso de un mes (este, con shift = 0). */
export function voidsSoon(shift = 0): Void[] {
  return memo(`void${shift}`, () => {
    const { start, end } = monthBounds(shift);
    const ins = moonIngressesBetween(new Date(start.getTime() - 3 * DAY), new Date(end.getTime() + 3 * DAY)).flatMap((e) => (e.kind === "moon-ingress" ? [e] : []));
    const out: Void[] = [];
    for (let i = 1; i < ins.length; i++) {
      const from = ins[i - 1].at.getTime();
      const to = ins[i].at.getTime();
      if (to < start.getTime() || from >= end.getTime()) continue;
      let last: { t: number; planet: string; aspect: string } | null = null;
      // Las posiciones, una vez por hora (la Luna y los nueve planetas); solo se afina donde hay un aspecto.
      const ts: number[] = [];
      for (let t = from; t < to; t += HOUR) ts.push(t);
      ts.push(to);
      const moon = ts.map((t) => longitude("Moon", new Date(t)));
      for (const pl of VOC_PLANETS) {
        const pls = ts.map((t) => longitude(pl, new Date(t)));
        for (const a of [0, 60, -60, 90, -90, 120, -120, 180]) {
          const f = (t: number) => lonDiff(longitude("Moon", new Date(t)), longitude(pl, new Date(t)) + a);
          for (let j = 1; j < ts.length; j++) {
            const v0 = lonDiff(moon[j - 1], pls[j - 1] + a);
            const v1 = lonDiff(moon[j], pls[j] + a);
            if (!(v0 < 0 && v1 >= 0 && v1 - v0 < 90)) continue;
            let lo = ts[j - 1];
            let hi = ts[j];
            while (hi - lo > 60_000) {
              const m = (lo + hi) / 2;
              if (f(m) < 0) lo = m;
              else hi = m;
            }
            if (!last || hi > last.t) last = { t: hi, planet: pl, aspect: ASPECT_ES[Math.abs(a)] };
          }
        }
      }
      out.push({ start: new Date(last?.t ?? from), end: new Date(to), sign: ins[i - 1].sign, nextSign: ins[i].sign, last: last ? { planet: last.planet, aspect: last.aspect } : null });
    }
    return out;
  });
}

/* ------------------------------------------- 4 · la Luna por tus casas */

export type HouseStay = { house: number; from: Date; to: Date };

/** Por qué casas tuyas pasa la Luna en las próximas cuatro semanas (empieza por la de ahora). */
export function moonHouseStays(cusps: number[]): HouseStay[] {
  return memo(`houses${cusps.map((c) => c.toFixed(2)).join(",")}`, () => {
    const now = Date.now();
    const h = (t: number) => houseOf(longitude("Moon", new Date(t)), cusps);
    const out: HouseStay[] = [];
    let start = now;
    const cur = h(now);
    while (start > now - 4 * DAY && h(start - HOUR) === cur) start -= HOUR;
    let house = cur;
    let from = start;
    for (let t = now + HOUR; t < now + 29 * DAY; t += HOUR) {
      const x = h(t);
      if (x !== house) {
        out.push({ house, from: new Date(from), to: new Date(t) });
        house = x;
        from = t;
      }
    }
    return out;
  });
}

/* ------------------------------------------------ 5 · retorno lunar */

/** Los próximos 13 retornos lunares (la Luna vuelve a su sitio natal), con el signo del Sol y la fase de ese momento. */
/** Los retornos lunares de un año (este, con shift = 0). */
export function lunarReturns(natalLon: number, shift = 0) {
  return memo(`ret${natalLon.toFixed(3)}|${shift}`, () => {
    const y = thisYear() + shift;
    return lunarReturnsBetween(natalLon, zonedTimeToUtc(`${y}-01-01`, 0, SPAIN_TZ), zonedTimeToUtc(`${y + 1}-01-01`, 0, SPAIN_TZ))
      .map((at) => ({ at, sunLon: longitude("Sun", at), elong: norm(longitude("Moon", at) - longitude("Sun", at)) }));
  });
}

/* --------------------------------------- 6 · perigeo, apogeo, superlunas */

/** Perigeo, apogeo y superlunas de un año (este, con shift = 0: desde hoy; otro año, desde el 1 de enero). */
export function apsisInfo(shift = 0) {
  return memo(`apsis${shift}`, () => {
    const now = shift === 0 ? new Date() : zonedTimeToUtc(`${thisYear() + shift}-01-01`, 0, SPAIN_TZ);
    const list = apsidesBetween(new Date(now.getTime() - 30 * DAY), new Date(now.getTime() + 60 * DAY));
    const next = (k: "perigee" | "apogee") => list.find((a) => a.kind === k && a.at > now)!;
    const prevPerigee = [...list].reverse().find((a) => a.kind === "perigee" && a.at <= now)!;
    const y = thisYear() + shift;
    const full = fullMoonsOfYear(y);
    const news = lunationsBetween(zonedTimeToUtc(`${y}-01-01`, 0, SPAIN_TZ), zonedTimeToUtc(`${y + 1}-01-01`, 0, SPAIN_TZ), "syzygy").filter((l) => l.k === 0);
    return {
      perigee: next("perigee"),
      apogee: next("apogee"),
      /** Dónde va la Luna en su órbita: 0 en el perigeo, 0,5 en el apogeo (el mes anomalístico, 27,55 días). */
      orbit: ((now.getTime() - prevPerigee.at.getTime()) / (27.5546 * DAY)) % 1,
      superFull: full.filter((l) => l.supermoon),
      superNew: news.filter((l) => l.supermoon),
      micro: full.filter((l) => l.micro),
    };
  });
}

/* ------------------------------------------------ 7 · las 28 mansiones */

export const MANSION_ARC = 360 / 28;
export const mansionOf = (lon: number) => Math.floor(norm(lon) / MANSION_ARC);

/** Cuándo deja la Luna la mansión en la que está ahora. */
export function moonMansionNow() {
  return memo("mansion", () => {
    const now = Date.now();
    const m = mansionOf(longitude("Moon", new Date(now)));
    let t = now;
    while (mansionOf(longitude("Moon", new Date(t))) === m && t < now + 2 * DAY) t += 15 * 60_000;
    return { mansion: m, until: new Date(t), lon: longitude("Moon", new Date(now)) };
  });
}

/* --------------------------------------------- 8 · el ciclo de los nodos */

export const NODE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** Cuándo vuelve el Nodo Norte medio a su sitio natal (pasos pares) o al opuesto (impares): cada ~9,3 años. */
export function nodeCycle(birth: Date, natalNode: number) {
  return memo(`node${birth.getTime()}`, () =>
    NODE_STEPS.map((k) => {
      const target = natalNode + (k % 2 ? 180 : 0);
      let t = birth.getTime() + k * 9.3 * YEAR;
      // El nodo medio retrocede ~19,35° al año: unas pocas vueltas de Newton bastan.
      for (let i = 0; i < 5; i++) t += (lonDiff(meanNode(new Date(t)), target) / (19.3549 / 365.2422)) * DAY;
      return { k, at: new Date(t), age: (t - birth.getTime()) / YEAR };
    }),
  );
}
export const nodeNow = () => meanNode(new Date());
/** El Nodo Norte (medio) en una fecha. */
export const nodeAt = (d: Date) => meanNode(d);
export const ageNow = (birth: Date) => (Date.now() - birth.getTime()) / YEAR;
