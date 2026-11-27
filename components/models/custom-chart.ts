import { computeHouses, houseOf, type Angles, type Chart, type ChartBody } from "@/lib/natal-chart";
import type { CustomChartData, CustomPoint } from "@/lib/lesson-blocks";

/**
 * «Carta a mano» (lib/lesson-blocks.ts → customChartSchema): la carta de partida con los puntos que la
 * dueña ha colocado a mano. Cada punto movido va a su grado, retrógrado o no; los escondidos no salen; con
 * el Ascendente o el MC movidos, las casas se rehacen con el sistema elegido. El Nodo Sur sigue al Norte.
 */

const DEG = Math.PI / 180;
const norm = (x: number) => ((x % 360) + 360) % 360;
/** Oblicuidad media (para unos ángulos puestos a mano en una carta sin hora). */
const EPS = 23.44;

/** La ascensión recta del MC (para Plácidus con un MC puesto a mano). */
const ramcOf = (mc: number, eps: number) => norm(Math.atan2(Math.sin(mc * DEG) * Math.cos(eps * DEG), Math.cos(mc * DEG)) / DEG);

export function applyCustom(chart: Chart, c: CustomChartData): Chart {
  const pos = c.positions as Partial<Record<CustomPoint, number>>;
  const retro = new Set<string>(c.retro);
  const hidden = new Set<string>(c.hidden);

  let angles: Angles | undefined = chart.angles;
  if (pos.asc != null || pos.mc != null) {
    const eps = angles?.eps ?? EPS;
    const asc = pos.asc ?? angles?.asc ?? 0;
    const mc = pos.mc ?? angles?.mc ?? norm(asc + 270);
    angles = { asc, mc, dsc: norm(asc + 180), ic: norm(mc + 180), ramc: ramcOf(mc, eps), eps };
  }
  if (!c.showHouses) angles = undefined;
  const houses = angles ? computeHouses(chart.input.houseSystem, angles, chart.input.lat) : undefined;

  const bodies: ChartBody[] = chart.bodies.flatMap((b) => {
    const id = b.id === "southNode" ? "node" : b.id;
    if (hidden.has(id) && id !== "sun" && id !== "moon") return [];
    const manual = pos[id as CustomPoint];
    if (manual == null) return [{ ...b, house: houses ? houseOf(b.lon, houses.cusps) : undefined }];
    const lon = b.id === "southNode" ? norm(manual + 180) : manual;
    // A mano, el movimiento lo decide ella: retrógrado o directo (los nodos van siempre hacia atrás).
    const back = id === "node" ? true : retro.has(id);
    const speed = Math.abs(b.speed) * (back ? -1 : 1);
    return [{ ...b, lon, speed, retro: id !== "node" && back, house: houses ? houseOf(lon, houses.cusps) : undefined }];
  });

  return { ...chart, bodies, angles, houses };
}

/** ¿Hay algo colocado a mano? */
export const isHandmade = (c: CustomChartData) => Object.keys(c.positions).length > 0 || c.hidden.length > 0;
