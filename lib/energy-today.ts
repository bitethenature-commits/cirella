/**
 * «Tu energía de hoy» («Mi energía», /cuenta/mi-energia): el cielo de hoy leído sobre un perfil ya
 * calculado (lib/birth-profile.ts → computeAll), en los cuatro sistemas, y una síntesis de los cuatro.
 * Puro (sin React, sin red): se calcula en el navegador.
 *
 *   · Astrología: tránsitos de hoy (Sol, Luna, Mercurio a Saturno; Urano, Neptuno y Plutón solo si
 *     están a menos de 1°) a los planetas natales y a los ángulos, con aspectos mayores y orbes
 *     estrechos; y la Luna de hoy: su signo y la casa natal que recorre (si se sabe la hora).
 *   · Diseño Humano: las puertas de hoy (Sol y Tierra con su línea, Luna) y lo que completan en la carta:
 *     canales que se definen hoy con una puerta suya, centros que se definen y puertas suyas que suenan.
 *   · Gene Keys: la llave del día (la puerta del Sol), con sombra, don y siddhi, y si coincide con una
 *     esfera de su perfil.
 *   · Luna: fase y signo de hoy, la relación con su Luna natal (signo y casa), días hasta su retorno
 *     lunar y hasta la próxima luna nueva y llena.
 *
 * Los textos salen de los significados de los datos de los modelos (components/models/data): describen
 * el clima del día y proponen un gesto, sin predicciones.
 */
import { ASPECT_BY_ID, BODY_INFO, HOUSES, SIGNS, signOf } from "../components/models/data/astrology";
import { KEY_BY_N, SPHERE_BY_ID } from "../components/models/data/gene-keys";
import { CENTRE_BY_ID, CHANNELS, GATE_BY_N, channelKey, type Channel, type CentreId } from "../components/models/data/human-design";
import { EIGHT_PHASES, MOON_IN_SIGN, PHASE_GUIDANCE, type MoonPhaseName } from "../components/models/data/moon";
import { lonDiff } from "./astro-calendar";
import type { ComputedProfile } from "./birth-profile";
import { activationsAt, gateStart } from "./human-design-calc";
import { lunarReturnsBetween, lunationsBetween, moonState } from "./lunar-sky";
import { bodyLongitude, bodySpeed, houseOf, type AspectId, type BodyId } from "./natal-chart";

const DAY = 86_400_000;
const norm = (x: number) => ((x % 360) + 360) % 360;
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/* -------------------------------------------------------------------------- *
 *  Astrología
 * -------------------------------------------------------------------------- */

type TransitBody = Extract<BodyId, "sun" | "moon" | "mercury" | "venus" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune" | "pluto">;
type NatalPoint = TransitBody | "asc" | "mc";

/** Orbe máximo de cada cuerpo en tránsito (estrechos: la Luna avanza 13° al día, los lentos casi nada). */
const TRANSIT_ORB: Record<TransitBody, number> = {
  moon: 4,
  sun: 2,
  mercury: 2,
  venus: 2,
  mars: 2,
  jupiter: 1.5,
  saturn: 1.5,
  uranus: 1,
  neptune: 1,
  pluto: 1,
};
const TRANSITING: TransitBody[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const NATAL_BODIES: TransitBody[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const SLOW_NATAL = new Set<NatalPoint>(["jupiter", "saturn", "uranus", "neptune", "pluto"]);
const MAJOR: AspectId[] = ["conjunction", "sextile", "square", "trine", "opposition"];

const ASPECT_PHRASE: Record<AspectId, string> = {
  conjunction: "sobre",
  sextile: "en sextil con",
  square: "en cuadratura con",
  trine: "en trígono con",
  quincunx: "en quincuncio con",
  opposition: "en oposición a",
};

const ANGLE_TEXT: Record<"asc" | "mc", { name: string; theme: string }> = {
  asc: {
    name: "Ascendente",
    theme: "cómo empiezas las cosas y cómo te ven al llegar",
  },
  mc: { name: "Medio Cielo", theme: "tu vocación y lo que se ve de ti" },
};

const pointName = (p: NatalPoint) => (p === "asc" || p === "mc" ? ANGLE_TEXT[p].name : BODY_INFO[p].name);
const pointTheme = (p: NatalPoint) => (p === "asc" || p === "mc" ? ANGLE_TEXT[p].theme : BODY_INFO[p].theme);

export interface Transit {
  transit: TransitBody;
  natal: NatalPoint;
  aspect: AspectId;
  /** Grados que le faltan o le sobran para ser exacto. */
  orb: number;
  /** Se está formando (true) o deshaciendo. */
  applying: boolean;
  nature: "armónico" | "tenso" | "neutro";
  title: string;
  text: string;
  tip: string;
}

const TIP = {
  armónico: "Aprovéchalo con un gesto pequeño: lo que fluye también hay que usarlo.",
  tenso: "No hace falta resolverlo hoy: nota dónde aprieta y elige una respuesta en lugar de una reacción.",
  neutro: "Lo que toca se intensifica: dale un rato consciente.",
};

function transitText(t: TransitBody, n: NatalPoint, aspect: AspectId) {
  const a = ASPECT_BY_ID[aspect];
  const nature = a.nature === "armónico" ? "armónico" : a.nature === "tenso" ? "tenso" : "neutro";
  const verb = nature === "armónico" ? "apoya hoy" : nature === "tenso" ? "roza hoy con" : "se mezcla hoy con";
  return {
    nature: nature as Transit["nature"],
    title: `${BODY_INFO[t].name} ${ASPECT_PHRASE[aspect]} tu ${pointName(n)} natal`,
    text: `${upperFirst(BODY_INFO[t].theme)} ${verb} ${pointTheme(n)}. ${a.meaning}`,
    tip: TIP[nature],
  };
}

export interface AstroToday {
  transits: Transit[];
  moon: {
    lon: number;
    sign: string;
    signText: string;
    house: number | null;
    houseText: string | null;
  };
}

export function astroToday(c: ComputedProfile, now: Date): AstroToday {
  const natal = new Map<NatalPoint, number>();
  for (const b of c.chart.bodies) if ((NATAL_BODIES as BodyId[]).includes(b.id)) natal.set(b.id as TransitBody, b.lon);
  if (c.chart.angles) {
    natal.set("asc", c.chart.angles.asc);
    natal.set("mc", c.chart.angles.mc);
  }
  const later = new Date(now.getTime() + 6 * 3_600_000);
  const transits: Transit[] = [];
  for (const t of TRANSITING) {
    const lon = bodyLongitude(t, now);
    const lonLater = bodyLongitude(t, later);
    for (const [n, nLon] of natal) {
      const sep = Math.abs(lonDiff(lon, nLon));
      const sepLater = Math.abs(lonDiff(lonLater, nLon));
      for (const aspect of MAJOR) {
        const angle = ASPECT_BY_ID[aspect].angle;
        const orb = Math.abs(sep - angle);
        if (orb > TRANSIT_ORB[t]) continue;
        transits.push({
          transit: t,
          natal: n,
          aspect,
          orb,
          applying: Math.abs(sepLater - angle) < orb,
          ...transitText(t, n, aspect),
        });
      }
    }
  }
  // Primero lo más exacto (relativo a su orbe) y lo más personal: la Luna, que pasa en horas, y los
  // planetas natales lentos (generacionales) cuentan un poco menos.
  const weight = (x: Transit) => x.orb / TRANSIT_ORB[x.transit] + (x.transit === "moon" ? 0.15 : 0) + (SLOW_NATAL.has(x.natal) ? 0.35 : 0);
  transits.sort((x, y) => weight(x) - weight(y));

  const moonLon = bodyLongitude("moon", now);
  const sign = signOf(moonLon);
  const house = c.chart.houses ? houseOf(moonLon, c.chart.houses.cusps) : null;
  const h = house ? HOUSES[house - 1] : null;
  return {
    transits,
    moon: {
      lon: moonLon,
      sign: sign.name,
      signText: MOON_IN_SIGN[sign.n],
      house,
      houseText: h ? `Hoy la Luna recorre tu ${h.name} (${h.keyword.toLowerCase()}): ${lowerFirst(h.meaning)} Ahí pide atención lo que sientes.` : null,
    },
  };
}

/* -------------------------------------------------------------------------- *
 *  Diseño Humano
 * -------------------------------------------------------------------------- */

type DayBody = "sun" | "earth" | "moon";
const DAY_BODIES: DayBody[] = ["sun", "earth", "moon"];
const DAY_BODY_ES: Record<DayBody, string> = {
  sun: "el Sol",
  earth: "la Tierra",
  moon: "la Luna",
};

export interface HdChannelToday {
  channel: Channel;
  /** Puertas de la persona en este canal y las que pone el cielo de hoy (con quién). */
  natalGates: number[];
  transitGates: { gate: number; body: DayBody }[];
  centres: [CentreId, CentreId];
  text: string;
}

export interface HdToday {
  sun: { gate: number; line: number };
  earth: { gate: number; line: number };
  moon: { gate: number; line: number };
  /** Canales que se definen hoy con al menos una puerta de la persona. */
  channels: HdChannelToday[];
  /** Centros abiertos en su carta que hoy se definen por esos canales. */
  newCentres: { id: CentreId; name: string; text: string }[];
  /** Sol, Tierra o Luna de hoy en una puerta que ya tiene activada. */
  resonant: { gate: number; body: DayBody; name: string }[];
  gateText: (gate: number) => string;
  strategy: string;
  authority: string;
}

const gateLabel = (g: number) => {
  const gate = GATE_BY_N.get(g);
  return gate ? `${g} (${gate.name})` : String(g);
};

export function hdToday(c: ComputedProfile, now: Date): HdToday {
  const hd = c.humanDesign;
  const transit = activationsAt(now);
  // Lo de hoy: el Sol y la Tierra (unos 6 días por puerta) y la Luna (medio día). Los planetas lentos
  // pasan meses en la misma puerta: son el fondo, no el día.
  const byGate = new Map<number, DayBody[]>();
  for (const b of DAY_BODIES) byGate.set(transit[b].gate, [...(byGate.get(transit[b].gate) ?? []), b]);
  const natalKeys = new Set(hd.definedChannels.map((ch) => channelKey(ch.a, ch.b)));

  const channels: HdChannelToday[] = [];
  for (const ch of CHANNELS) {
    if (natalKeys.has(channelKey(ch.a, ch.b))) continue;
    const has = (g: number) => hd.gates.has(g) || byGate.has(g);
    if (!has(ch.a) || !has(ch.b)) continue;
    const natalGates = [ch.a, ch.b].filter((g) => hd.gates.has(g));
    // Un canal hecho solo con el cielo lo tiene hoy todo el mundo: aquí solo los que tocan su carta.
    if (!natalGates.length) continue;
    const transitGates = [ch.a, ch.b].filter((g) => !hd.gates.has(g)).map((g) => ({ gate: g, body: byGate.get(g)![0] }));
    const centres: [CentreId, CentreId] = [GATE_BY_N.get(ch.a)!.centre, GATE_BY_N.get(ch.b)!.centre];
    const by = transitGates.map((t) => `${DAY_BODY_ES[t.body]} en la puerta ${gateLabel(t.gate)}`).join(" y ");
    channels.push({
      channel: ch,
      natalGates,
      transitGates,
      centres,
      text: `Hoy se define temporalmente el canal ${ch.a}-${ch.b} (${ch.name}), entre ${CENTRE_BY_ID[centres[0]].name} y ${CENTRE_BY_ID[centres[1]].name}: ${by} completa tu puerta ${natalGates.map(gateLabel).join(" y ")}. ${ch.gift}`,
    });
  }

  const reached = new Set<CentreId>(hd.definedCentres);
  for (const ch of channels) for (const ce of ch.centres) reached.add(ce);
  const newCentres = [...reached]
    .filter((id) => !hd.definedCentres.has(id))
    .map((id) => {
      const ce = CENTRE_BY_ID[id];
      return {
        id,
        name: ce.name,
        text: ce.role,
      };
    });

  const resonant: HdToday["resonant"] = [];
  for (const body of DAY_BODIES) {
    const g = transit[body].gate;
    if (hd.gates.has(g)) resonant.push({ gate: g, body, name: GATE_BY_N.get(g)?.name ?? "" });
  }

  return {
    sun: { gate: transit.sun.gate, line: transit.sun.line },
    earth: { gate: transit.earth.gate, line: transit.earth.line },
    moon: { gate: transit.moon.gate, line: transit.moon.line },
    channels,
    newCentres,
    resonant,
    gateText: (g) => GATE_BY_N.get(g)?.theme ?? "",
    strategy: hd.reading.strategy,
    authority: hd.reading.authority,
  };
}

/* -------------------------------------------------------------------------- *
 *  Gene Keys
 * -------------------------------------------------------------------------- */

export interface GkToday {
  key: number;
  line: number;
  shadow: string;
  gift: string;
  siddhi: string;
  earthKey: number;
  /** Días que le quedan al Sol en esta llave (aprox.). */
  daysLeft: number;
  /** Esferas de su perfil con esta misma llave. */
  spheres: { id: string; name: string; contemplation: string }[];
  text: string;
}

export function gkToday(c: ComputedProfile, now: Date): GkToday {
  const t = activationsAt(now);
  const k = KEY_BY_N.get(t.sun.gate)!;
  const spheres = Object.entries(c.geneKeys.keys)
    .filter(([, n]) => n === k.n)
    .map(([id]) => ({
      id,
      name: SPHERE_BY_ID[id]?.name ?? id,
      contemplation: SPHERE_BY_ID[id]?.contemplation ?? "",
    }));
  // Hasta el principio de la puerta siguiente en el mandala.
  const sunLon = bodyLongitude("sun", now);
  const start = gateStart(t.sun.gate);
  const left = 360 / 64 - norm(sunLon - start);
  const speed = Math.max(0.9, bodySpeed("sun", now));
  return {
    key: k.n,
    line: t.sun.line,
    shadow: k.shadow,
    gift: k.gift,
    siddhi: k.siddhi,
    earthKey: t.earth.gate,
    daysLeft: Math.max(0, Math.round(left / speed)),
    spheres,
    text: `Hoy el Sol pasa por la Llave ${k.n} (línea ${t.sun.line}). Su sombra es ${lowerFirst(k.shadow)}; su don, ${lowerFirst(k.gift)}; su siddhi, ${lowerFirst(k.siddhi)}. Es un clima compartido: fíjate en cuándo aparece la sombra y qué gesto la convierte en don.`,
  };
}

/* -------------------------------------------------------------------------- *
 *  Luna
 * -------------------------------------------------------------------------- */

export interface MoonToday {
  phase: MoonPhaseName;
  phaseIndex: number;
  illum: number;
  intent: string;
  practice: string;
  sign: string;
  signText: string;
  natalSign: string;
  /** Sin hora: el signo de la Luna natal puede no ser seguro. */
  natalSignUnsure: boolean;
  relation: string;
  house: number | null;
  houseText: string | null;
  returnAt: Date | null;
  daysToReturn: number | null;
  nextNew: Date | null;
  nextFull: Date | null;
  daysToNew: number | null;
  daysToFull: number | null;
}

const daysUntil = (d: Date | null, now: Date) => (d ? Math.max(0, Math.round((d.getTime() - now.getTime()) / DAY)) : null);

function signRelation(today: number, natal: number): string {
  const d = (today - natal + 12) % 12;
  const s = SIGNS[natal].name;
  if (d === 0) return `La Luna está hoy en tu signo lunar, ${s}: días de sentirte más en casa contigo. Buen momento para darte lo que de verdad te nutre.`;
  if (d === 6) return `La Luna está hoy enfrente de tu Luna natal en ${s}: lo que necesitas puede chocar con lo que piden los demás. Date espacio antes de responder.`;
  if (d === 3 || d === 9) return `La Luna forma hoy una cuadratura con tu Luna natal en ${s}: algo de roce emocional, que también empuja a moverte. Cuídate con suavidad.`;
  if (d === 4 || d === 8) return `La Luna está hoy en armonía (trígono) con tu Luna natal en ${s}: las emociones fluyen con más facilidad. Aprovecha para lo que te cuesta.`;
  if (d === 2 || d === 10) return `La Luna hace hoy un sextil con tu Luna natal en ${s}: una pequeña oportunidad de sentirte bien si la buscas.`;
  return `Hoy la Luna va por un signo neutro respecto a tu Luna natal en ${s}: un clima emocional sin grandes empujones.`;
}

export function moonToday(c: ComputedProfile, now: Date): MoonToday {
  const s = moonState(now);
  const k = Math.floor(s.elong / 45) % 8;
  const phase = EIGHT_PHASES[k];
  const g = PHASE_GUIDANCE[phase];
  const sign = signOf(s.moonLon);
  const natalSign = signOf(c.natalMoon.moonLon);
  const range = c.natalMoon.range;
  const house = c.chart.houses ? houseOf(s.moonLon, c.chart.houses.cusps) : null;
  const h = house ? HOUSES[house - 1] : null;
  const ret = lunarReturnsBetween(c.natalMoon.moonLon, now, new Date(now.getTime() + 29 * DAY))[0] ?? null;
  const syz = lunationsBetween(now, new Date(now.getTime() + 31 * DAY), "syzygy", false);
  const nextNew = syz.find((l) => l.k === 0)?.at ?? null;
  const nextFull = syz.find((l) => l.k === 4)?.at ?? null;
  return {
    phase,
    phaseIndex: k,
    illum: s.illum,
    intent: g.intent,
    practice: g.practice,
    sign: sign.name,
    signText: MOON_IN_SIGN[sign.n],
    natalSign: natalSign.name,
    natalSignUnsure: !!range && Math.floor(range.from / 30) !== Math.floor(range.to / 30),
    relation: signRelation(sign.n, natalSign.n),
    house,
    houseText: h ? `En tu carta, la Luna de hoy pasa por la ${h.name} (${h.keyword.toLowerCase()}): ${lowerFirst(h.meaning)}` : null,
    returnAt: ret,
    daysToReturn: daysUntil(ret, now),
    nextNew,
    nextFull,
    daysToNew: daysUntil(nextNew, now),
    daysToFull: daysUntil(nextFull, now),
  };
}

/* -------------------------------------------------------------------------- *
 *  Todo junto y la síntesis
 * -------------------------------------------------------------------------- */

export interface EnergyToday {
  at: Date;
  astro: AstroToday;
  hd: HdToday;
  gk: GkToday;
  moon: MoonToday;
}

export function energyToday(c: ComputedProfile, now = new Date()): EnergyToday {
  return {
    at: now,
    astro: astroToday(c, now),
    hd: hdToday(c, now),
    gk: gkToday(c, now),
    moon: moonToday(c, now),
  };
}

export type EnergySystem = "astrologia" | "diseno-humano" | "gene-keys" | "luna";

export interface EnergySynthesis {
  lines: { system: EnergySystem; label: string; text: string }[];
  overall: string;
}

/** Una o dos líneas por sistema y una frase amable para el día. */
export function energySynthesis(e: EnergyToday): EnergySynthesis {
  const top = e.astro.transits[0];
  const astro = top
    ? `${top.title}${top.orb < 1 ? " (casi exacto)" : ""}: ${lowerFirst(top.text.split(". ")[0])}.`
    : `Sin aspectos exactos a tu carta: un día tranquilo de fondo, con la Luna en ${e.astro.moon.sign}.`;
  const ch = e.hd.channels[0];
  const hd = ch
    ? `Hoy se define temporalmente el canal ${ch.channel.a}-${ch.channel.b} (${ch.channel.name}). Vívelo como un préstamo: tu estrategia sigue siendo «${e.hd.strategy.replace(/\.$/, "")}».`
    : e.hd.resonant[0]
      ? `${upperFirst(DAY_BODY_ES[e.hd.resonant[0].body])} en tu puerta ${e.hd.resonant[0].gate} (${e.hd.resonant[0].name}): hoy suena más fuerte algo que ya es tuyo.`
      : `El Sol en la puerta ${e.hd.sun.gate}.${e.hd.sun.line}: ${lowerFirst(e.hd.gateText(e.hd.sun.gate))}`;
  const gk = `Llave ${e.gk.key}: de ${lowerFirst(e.gk.shadow)} a ${lowerFirst(e.gk.gift)}${e.gk.spheres.length ? `, en tu ${e.gk.spheres.map((s) => s.name).join(" y tu ")}` : ""}.`;
  const moon = `${e.moon.phase} en ${e.moon.sign}: ${e.moon.intent.toLowerCase()}. ${e.moon.practice}`;

  const tense = e.astro.transits.filter((t) => t.nature === "tenso").length;
  const soft = e.astro.transits.filter((t) => t.nature === "armónico").length;
  const waxing = e.moon.phaseIndex < 4;
  const base =
    tense > soft
      ? "Un día para ir a tu ritmo: no todo lo que se mueve pide respuesta hoy."
      : soft > tense
        ? "Un día amable para dar un paso pequeño en lo que te importa."
        : "Un día para escucharte y elegir con calma.";
  const overall = `${base} ${waxing ? "La Luna crece: suma, empieza, riega lo sembrado." : "La Luna mengua: suelta, ordena, descansa."}`;
  return {
    lines: [
      { system: "astrologia", label: "Astrología", text: astro },
      { system: "diseno-humano", label: "Human Design", text: hd },
      { system: "gene-keys", label: "Gene Keys", text: gk },
      { system: "luna", label: "Luna", text: moon },
    ],
    overall,
  };
}
