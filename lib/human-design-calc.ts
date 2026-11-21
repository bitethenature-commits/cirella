/**
 * Diseño Humano y Gene Keys calculados: del instante de nacimiento a las 26 activaciones, la carta
 * (canales, centros, tipo, autoridad, estrategia, perfil, definición, cruz) y el perfil hologenético.
 * Puro (sin React, sin red): lo usan el bodygraph y las Gene Keys (components/models/*) en el navegador
 * y las pruebas (scripts/unit/human-design-calc.test.ts).
 *
 *   · Personalidad (consciente, negro) = el instante de nacimiento. Diseño (inconsciente, rojo) = el
 *     instante, unos 88 días antes, en que el Sol estaba exactamente 88° de longitud eclíptica antes que
 *     al nacer (no 88 días: el arco solar). Se busca por bisección sobre la longitud del Sol, que es
 *     monótona; la precisión es de un segundo.
 *   · Posiciones (lib/natal-chart.ts): geocéntricas, aparentes, zodiaco tropical. Tierra = Sol + 180°.
 *     Nodos: el Nodo Norte VERDADERO (osculador), que es lo que usan Jovian Archive / MMI, Genetic
 *     Matrix y la mayoría de programas de Diseño Humano; Nodo Sur = Nodo Norte + 180°.
 *   · El mandala rave: las 64 puertas en el orden de la rueda del I Ching, empezando por la 41 en 2°00′
 *     de Acuario (302° tropical). Cada puerta abarca 5,625° (360/64) y cada línea 0,9375° (5,625/6).
 *     Comprobaciones conocidas: la 17 empieza en 3°52′30″ de Aries, la 27 en 2°00′ de Tauro, la 1 en
 *     13°15′ de Escorpio, y cada puerta queda enfrente de su opuesta (1–2, 41–31, 13–7…).
 *   · Tipo y autoridad: readChart (components/models/data/human-design.ts) con las reglas estándar
 *     (sacral → generador; motor conectado a la garganta → manifestador / generador manifestante; sin
 *     definición → reflector; si no, proyector; autoridad por jerarquía plexo › sacral › bazo › ego ›
 *     G (autoproyectada) › mental; lunar para el reflector).
 *   · Definición: componentes conexas de los centros definidos por los canales definidos.
 *   · Gene Keys (perfil hologenético, convención de Richard Rudd): Obra de vida = Sol consciente,
 *     Evolución = Tierra consciente, Irradiación = Sol inconsciente, Propósito = Tierra inconsciente;
 *     Atracción = Luna inconsciente, CI = Venus consciente, CE = Marte consciente, CS = Venus
 *     inconsciente, Núcleo (= Vocación) = Marte inconsciente; Cultura = Júpiter inconsciente, Perla =
 *     Júpiter consciente (Marca = Obra de vida).
 */
import { bodyLongitude, trueNode, type BodyId } from "./natal-chart";
import { lonDiff } from "./astro-calendar";
import { GATE_BY_N, readChart, type Channel, type CentreId, type ChartReading } from "../components/models/data/human-design";

import { CROSS_ANGLE_ES, HD_BODIES, type CrossAngle, type DefinitionKind, type HdBody } from "./human-design-names";

export * from "./human-design-names";

const DAY = 86_400_000;
const norm = (x: number) => ((x % 360) + 360) % 360;

/* -------------------------------------------------------------------------- *
 *  El mandala
 * -------------------------------------------------------------------------- */

/** Las 64 puertas en el orden de la rueda, desde la 41 (302°) en sentido zodiacal. */
export const MANDALA_ORDER = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
  28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
] as const;

/** Longitud tropical en la que empieza la puerta 41 (2°00′ de Acuario). */
export const MANDALA_START = 302;
export const GATE_ARC = 360 / 64;
export const LINE_ARC = GATE_ARC / 6;

export interface GateLine {
  gate: number;
  line: number;
}

/** Longitud tropical → puerta y línea (1–6). */
export function gateAt(lon: number): GateLine {
  const x = norm(lon - MANDALA_START);
  const i = Math.min(63, Math.floor(x / GATE_ARC));
  const line = Math.min(6, Math.floor((x - i * GATE_ARC) / LINE_ARC) + 1);
  return { gate: MANDALA_ORDER[i], line };
}

/** Dónde empieza una puerta (longitud tropical). */
export function gateStart(gate: number) {
  const i = MANDALA_ORDER.indexOf(gate as (typeof MANDALA_ORDER)[number]);
  if (i < 0) throw new Error(`Puerta inexistente: ${gate}`);
  return norm(MANDALA_START + i * GATE_ARC);
}

/* -------------------------------------------------------------------------- *
 *  Activaciones
 * -------------------------------------------------------------------------- */

export interface Activation extends GateLine {
  body: HdBody;
  lon: number;
}

export type Side = "personality" | "design";

function longitudeOf(body: HdBody, at: Date): number {
  switch (body) {
    case "earth":
      return norm(bodyLongitude("sun", at) + 180);
    case "northNode":
      return trueNode(at);
    case "southNode":
      return norm(trueNode(at) + 180);
    default:
      return bodyLongitude(body as BodyId, at);
  }
}

export function activationsAt(at: Date): Record<HdBody, Activation> {
  const out = {} as Record<HdBody, Activation>;
  for (const body of HD_BODIES) {
    const lon = longitudeOf(body, at);
    out[body] = { body, lon, ...gateAt(lon) };
  }
  return out;
}

/** El instante de diseño: cuando el Sol estaba 88° antes que al nacer (≈ 88 días antes). */
export function designInstant(birth: Date): Date {
  const target = norm(bodyLongitude("sun", birth) - 88);
  // f(t) = cuánto le falta al Sol para llegar al objetivo: positivo antes, negativo después.
  const f = (t: number) => lonDiff(target, bodyLongitude("sun", new Date(t)));
  // El Sol avanza entre 0,95° y 1,02° al día: el diseño cae entre 86 y 93 días antes.
  let lo = birth.getTime() - 96 * DAY;
  let hi = birth.getTime() - 80 * DAY;
  if (!(f(lo) > 0 && f(hi) < 0)) throw new Error("No se encontró el instante de diseño");
  while (hi - lo > 1000) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return new Date(Math.round((lo + hi) / 2));
}

/* -------------------------------------------------------------------------- *
 *  La carta
 * -------------------------------------------------------------------------- */

export interface HumanDesign {
  personalityAt: Date;
  designAt: Date;
  personality: Record<HdBody, Activation>;
  design: Record<HdBody, Activation>;
  /** Todas las puertas activadas (por cualquiera de los dos lados). */
  gates: Set<number>;
  /** Qué lado activa cada puerta. */
  gateSides: Map<number, Set<Side>>;
  reading: ChartReading;
  definedChannels: Channel[];
  definedCentres: Set<CentreId>;
  /** Grupos de centros conectados entre sí. */
  components: CentreId[][];
  definition: DefinitionKind;
  /** «5/1»: línea del Sol consciente / línea del Sol inconsciente. */
  profile: { personality: number; design: number; label: string };
  cross: { angle: CrossAngle; gates: [number, number, number, number]; label: string };
}

/** Componentes conexas de los centros definidos, uniendo por canales definidos. */
export function centreComponents(definedChannels: Channel[]): CentreId[][] {
  const parent = new Map<CentreId, CentreId>();
  const find = (c: CentreId): CentreId => {
    let r = c;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(c, r);
    return r;
  };
  for (const ch of definedChannels) {
    const a = GATE_BY_N.get(ch.a)!.centre;
    const b = GATE_BY_N.get(ch.b)!.centre;
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    parent.set(find(a), find(b));
  }
  const groups = new Map<CentreId, CentreId[]>();
  for (const c of parent.keys()) {
    const r = find(c);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  }
  return [...groups.values()];
}

const DEFINITIONS: DefinitionKind[] = ["none", "single", "split", "triple", "quadruple"];

/** Ángulo de la cruz según el perfil: 4/1 yuxtaposición; 5/1, 5/2, 6/2, 6/3 izquierdo; el resto derecho. */
export function crossAngle(pLine: number, dLine: number): CrossAngle {
  if (pLine === 4 && dLine === 1) return "juxtaposition";
  if (pLine >= 5) return "left";
  return "right";
}

export function humanDesignAt(birth: Date): HumanDesign {
  const designAt = designInstant(birth);
  const personality = activationsAt(birth);
  const design = activationsAt(designAt);
  const gateSides = new Map<number, Set<Side>>();
  for (const [side, acts] of [["personality", personality], ["design", design]] as const) {
    for (const a of Object.values(acts)) {
      const s = gateSides.get(a.gate) ?? new Set<Side>();
      s.add(side);
      gateSides.set(a.gate, s);
    }
  }
  const gates = new Set(gateSides.keys());
  const reading = readChart(gates);
  const components = centreComponents(reading.definedChannels);
  const pLine = personality.sun.line;
  const dLine = design.sun.line;
  const angle = crossAngle(pLine, dLine);
  const crossGates: [number, number, number, number] = [personality.sun.gate, personality.earth.gate, design.sun.gate, design.earth.gate];
  return {
    personalityAt: birth,
    designAt,
    personality,
    design,
    gates,
    gateSides,
    reading,
    definedChannels: reading.definedChannels,
    definedCentres: reading.definedCentres,
    components,
    definition: DEFINITIONS[Math.min(4, components.length)],
    profile: { personality: pLine, design: dLine, label: `${pLine}/${dLine}` },
    cross: { angle, gates: crossGates, label: `${CROSS_ANGLE_ES[angle]} (${crossGates[0]}/${crossGates[1]} | ${crossGates[2]}/${crossGates[3]})` },
  };
}

/* -------------------------------------------------------------------------- *
 *  Gene Keys — el perfil hologenético
 * -------------------------------------------------------------------------- */

/** Las once esferas (mismos ids que components/models/data/gene-keys.ts) y la activación que las alimenta. */
export const SPHERE_SOURCES: Record<string, { side: Side; body: HdBody }> = {
  lifework: { side: "personality", body: "sun" },
  evolution: { side: "personality", body: "earth" },
  radiance: { side: "design", body: "sun" },
  purpose: { side: "design", body: "earth" },
  attraction: { side: "design", body: "moon" },
  iq: { side: "personality", body: "venus" },
  eq: { side: "personality", body: "mars" },
  sq: { side: "design", body: "venus" },
  core: { side: "design", body: "mars" },
  culture: { side: "design", body: "jupiter" },
  pearl: { side: "personality", body: "jupiter" },
};

export interface GeneKeysProfile {
  /** Llave (= puerta) de cada esfera. */
  keys: Record<string, number>;
  /** Línea (1–6) de cada esfera. */
  lines: Record<string, number>;
}

export function geneKeysProfile(hd: Pick<HumanDesign, "personality" | "design">): GeneKeysProfile {
  const keys: Record<string, number> = {};
  const lines: Record<string, number> = {};
  for (const [id, src] of Object.entries(SPHERE_SOURCES)) {
    const a = hd[src.side][src.body];
    keys[id] = a.gate;
    lines[id] = a.line;
  }
  return { keys, lines };
}
