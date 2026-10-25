/**
 * Carta natal de la dueña para ver por qué casa pasa cada tránsito. Puro (sin BD): lo usan el
 * calendario de Reservas, la tarjeta «Mi carta natal» y las pruebas.
 *
 *   · Nacimiento: fecha y hora LOCALES del lugar + su zona IANA → instante UTC con el desfase que
 *     tenía esa zona entonces (Intl, lib/tz.ts → zonedTimeToUtc: horarios de verano antiguos incluidos).
 *   · RAMC = tiempo sidéreo aparente de Greenwich (astronomy-engine) + longitud; oblicuidad media
 *     (Meeus 22.2; la nutación cambia las cúspides menos de 0,01°).
 *   · Casas: Plácidus (por defecto; cúspides 11, 12, 2 y 3 por iteración sobre el semiarco), signos
 *     enteros o casas iguales desde el Ascendente. Plácidus no existe por encima del círculo polar
 *     (|latitud| ≥ 90° − ε): ahí se usa Porfirio y se dice en la tarjeta.
 */
import { SiderealTime } from "astronomy-engine";
import { z } from "zod";
import { HOUSE_SYSTEMS, type HouseSystem } from "./house-systems";
import { zonedTimeToUtc } from "./tz";

export { HOUSE_SYSTEMS, HOUSE_SYSTEM_LABEL, type HouseSystem } from "./house-systems";

/** Lo que se guarda en NatalChart (una por dueña). */
export const natalChartSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  place: z.string().trim().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().min(1).max(64),
  houseSystem: z.enum(HOUSE_SYSTEMS).default("placidus"),
});
export type NatalChart = z.infer<typeof natalChartSchema>;

/** La carta guardada, o null si no hay (o no es válida). */
export function readNatalChart(json: unknown): NatalChart | null {
  const r = natalChartSchema.safeParse(json);
  return r.success ? r.data : null;
}

/** Instante UTC del nacimiento. */
export function birthUtc(chart: Pick<NatalChart, "date" | "time" | "timezone">) {
  const [h, m] = chart.time.split(":").map(Number);
  return zonedTimeToUtc(chart.date, h * 60 + m, chart.timezone);
}

const RAD = Math.PI / 180;
const norm = (x: number) => ((x % 360) + 360) % 360;
const sin = (d: number) => Math.sin(d * RAD);
const cos = (d: number) => Math.cos(d * RAD);
const tan = (d: number) => Math.tan(d * RAD);

/** Oblicuidad media de la eclíptica (Meeus 22.2), en grados. */
export function meanObliquity(at: Date) {
  const T = (at.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000 / 36525;
  return 23.4392911 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
}

/** Punto de la eclíptica con esa ascensión recta. */
const lonFromRa = (ra: number, eps: number) => norm(Math.atan2(sin(ra), cos(ra) * cos(eps)) / RAD);
const declOf = (lon: number, eps: number) => Math.asin(sin(eps) * sin(lon)) / RAD;

export type Houses = {
  asc: number;
  mc: number;
  /** cusps[0] = casa 1 … cusps[11] = casa 12 */
  cusps: number[];
  /** El sistema con el que se ha calculado (Porfirio si Plácidus no es posible en esa latitud). */
  system: HouseSystem | "porphyry";
  polar: boolean;
};

/** Ascendente, Medio Cielo y cúspides para un instante y un lugar. */
export function computeHouses(at: Date, lat: number, lon: number, system: HouseSystem = "placidus"): Houses {
  const eps = meanObliquity(at);
  const ramc = norm(SiderealTime(at) * 15 + lon);
  const mc = lonFromRa(ramc, eps);
  let asc = norm(Math.atan2(cos(ramc), -(sin(ramc) * cos(eps) + tan(lat) * sin(eps))) / RAD);
  const polar = Math.abs(lat) >= 90 - eps;
  // Por encima del círculo polar la fórmula puede dar el descendente: el ASC está siempre a menos de 180° tras el MC.
  if (norm(asc - mc) > 180) asc = norm(asc + 180);
  const cusps = new Array<number>(12);
  let used: Houses["system"] = system;
  if (system === "whole") {
    for (let i = 0; i < 12; i++) cusps[i] = norm(Math.floor(asc / 30) * 30 + 30 * i);
  } else if (system === "equal") {
    for (let i = 0; i < 12; i++) cusps[i] = norm(asc + 30 * i);
  } else {
    cusps[0] = asc;
    cusps[9] = mc;
    const placidus = polar ? null : placidusCusps(ramc, eps, lat);
    if (placidus) [cusps[10], cusps[11], cusps[1], cusps[2]] = placidus;
    else {
      used = "porphyry";
      const q1 = norm(asc - mc);
      const q2 = norm(mc + 180 - asc);
      [cusps[10], cusps[11], cusps[1], cusps[2]] = [norm(mc + q1 / 3), norm(mc + (2 * q1) / 3), norm(asc + q2 / 3), norm(asc + (2 * q2) / 3)];
    }
    for (const i of [0, 1, 2, 9, 10, 11]) cusps[(i + 6) % 12] = norm(cusps[i] + 180);
  }
  return { asc, mc, cusps, system: used, polar };
}

/** Cúspides 11, 12, 2 y 3 de Plácidus: el punto de la eclíptica que ha recorrido 1/3 o 2/3 de su semiarco. */
function placidusCusps(ramc: number, eps: number, lat: number): [number, number, number, number] | null {
  const cusp = (offset: number, fraction: number, nocturnal: boolean) => {
    let ra = norm(ramc + offset);
    for (let k = 0; k < 50; k++) {
      const x = tan(lat) * tan(declOf(lonFromRa(ra, eps), eps));
      if (Math.abs(x) > 1) return null;
      const ad = Math.asin(x) / RAD; // diferencia ascensional
      const next = nocturnal ? norm(ramc + 180 - fraction * (90 - ad)) : norm(ramc + fraction * (90 + ad));
      if (Math.abs(((next - ra + 540) % 360) - 180) < 1e-7) return lonFromRa(next, eps);
      ra = next;
    }
    return lonFromRa(ra, eps);
  };
  const c11 = cusp(30, 1 / 3, false);
  const c12 = cusp(60, 2 / 3, false);
  const c2 = cusp(150, 2 / 3, true);
  const c3 = cusp(120, 1 / 3, true);
  return c11 == null || c12 == null || c2 == null || c3 == null ? null : [c11, c12, c2, c3];
}

/** Casa (1–12) en la que cae una longitud. La casa i va de su cúspide (incluida) a la siguiente. */
export function houseOf(lon: number, cusps: number[]) {
  const l = norm(lon);
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const span = norm(cusps[(i + 1) % 12] - start);
    if (norm(l - start) < span) return i + 1;
  }
  return 1;
}

/** Las casas de la carta natal guardada. */
export function natalHouses(chart: NatalChart): Houses {
  return computeHouses(birthUtc(chart), chart.lat, chart.lon, chart.houseSystem);
}
