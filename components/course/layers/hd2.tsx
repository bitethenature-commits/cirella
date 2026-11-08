"use client";

import { useMemo } from "react";
import { CENTRE_BY_ID, CHANNELS, CHANNEL_BY_KEY, CIRCUIT_LABEL, GATE_BY_N, channelKey, type CentreId, type Circuit } from "@/components/models/data/human-design";
import { KEY_BY_N } from "@/components/models/data/gene-keys";
import { ELEMENT_HUE, SIGNS } from "@/components/models/data/astrology";
import { CROSS_ANGLE_ES, DEFINITION_ES, HD_BODY_ES, HD_BODY_GLYPH, type HdBody } from "@/lib/human-design-names";
import { activationsAt, gateStart, type HumanDesign } from "@/lib/human-design-calc";
import { HD_SIDE_BODIES, LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, VS, listEs, norm, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { LINES, MiniBodygraph, PERS, sideColorOf } from "./hd";
import { DEFINITION_EXAMPLES, ExampleBodygraph } from "./hd-examples";
import { NIGHT, NIGHT_GOLD, NIGHT_RED, NightChips, NightDefs, NightPanel, STAR, Stars, usePrefix } from "./night";

/**
 * Human Design a fondo, en 9 capas: los circuitos, la definición, la cruz de encarnación, las 4 variables, las
 * 6 líneas de una puerta, el mandala de las 64 puertas, los centros abiertos (condicionamiento), los tránsitos de
 * hoy sobre el bodygraph y la pareja (dos bodygraphs y sus conexiones). Sobre el cielo de noche, como las demás.
 */

export type Hd2Layer = Extract<AstroLayer, "hd-circuits" | "hd-definition" | "hd-cross" | "hd-variables" | "hd-gate-lines" | "hd-mandala" | "hd-conditioning" | "hd-defined" | "hd-pairs" | "hd-kinds" | "hd-transits" | "hd-partner">;
export const HD2_LAYERS = new Set<string>(["hd-circuits", "hd-definition", "hd-cross", "hd-variables", "hd-gate-lines", "hd-mandala", "hd-conditioning", "hd-defined", "hd-pairs", "hd-kinds", "hd-transits", "hd-partner"]);

/** Las parejas de chakras: centros que se miran y se equilibran. */
const PAIRS: Record<string, { centres: CentreId[]; name: string; kicker: string; text: string }> = {
  "head-root": {
    centres: ["head", "root"],
    name: "La Cabeza y la Raíz",
    kicker: "Los dos centros de presión",
    text: "Arriba, la presión mental: la inspiración, las preguntas que no te dejan en paz. Abajo, la presión física: la adrenalina, el empuje para hacer y acabar. Una presiona para entender y la otra para actuar. En equilibrio, la idea encuentra el impulso para hacerse real, sin prisas ni ansiedad.",
  },
  "ajna-sacral": {
    centres: ["ajna", "sacral"],
    name: "El Ajna y el Sacro",
    kicker: "Pensar y responder",
    text: "El Ajna procesa, compara y ordena las ideas; el Sacro es la fuerza de vida que responde con el cuerpo («ajá» o «ah-ah»). La mente sirve para comprender y compartir, pero no para decidir: la respuesta llega desde la tripa. En equilibrio, piensas con libertad y eliges lo que te da energía.",
  },
  "throat-spleen-solar": {
    centres: ["throat", "spleen", "solar"],
    name: "La Garganta, el Bazo y el Plexo solar",
    kicker: "Expresar desde el instinto o desde la emoción",
    text: "La Garganta es donde todo se hace palabra y acción. El Bazo le aporta la intuición del momento (una sola vez, en el instante) y el Plexo solar, la claridad emocional que llega con el tiempo. En equilibrio, sabes cuándo hablar desde la intuición del ahora y cuándo esperar a que pase la ola para decir lo que sientes de verdad.",
  },
};

/** Los centros por su función. El Plexo solar es motor y consciencia; la Raíz, motor y presión. */
const KINDS: Record<string, { centres: CentreId[]; name: string; kicker: string; text: string }> = {
  motor: { centres: ["heart", "sacral", "solar", "root"], name: "Centros motores", kicker: "La energía que mueve", text: "El Corazón (la voluntad), el Sacro (la fuerza de vida), el Plexo solar (la emoción) y la Raíz (la presión para hacer). Dan el combustible. Cuando un motor se conecta con la Garganta, la persona puede manifestar: hacer y decir por sí misma." },
  awareness: { centres: ["ajna", "spleen", "solar"], name: "Centros de consciencia", kicker: "Las tres formas de saber", text: "El Ajna (la mente, que da vueltas al pasado y al futuro), el Bazo (la intuición del cuerpo, en el instante) y el Plexo solar (la emoción, que se aclara con el tiempo). Son las tres inteligencias con las que comprendemos la vida." },
  manifestation: { centres: ["throat"], name: "Centro de manifestación", kicker: "Donde todo se expresa", text: "La Garganta: el centro de la palabra y la acción. Todos los demás buscan llegar aquí para hacerse visibles. Su tema es cuándo y cómo expresar lo que vive dentro." },
  compass: { centres: ["g"], name: "El compás de vida", kicker: "Identidad, amor y dirección", text: "El Centro G, en el medio del bodygraph: quién eres, hacia dónde vas y qué te hace sentir amada. Es la aguja que orienta el camino; definido, da una dirección fija; abierto, la encuentra en los lugares y las personas." },
  pressure: { centres: ["head", "root"], name: "Centros de presión", kicker: "Lo que empuja", text: "La Cabeza (presión de inspiración, de entender) y la Raíz (presión de adrenalina, de hacer). Empujan a la acción o a la búsqueda. La clave es no confundir su presión con urgencia." },
};

/** Los centros definidos: lo que das de forma constante y cómo se nota cuando lo vives bien. */
const DEFINED: Record<CentreId, { gift: string; watch: string }> = {
  head: { gift: "Inspiras a otros con tus preguntas: tu mente siempre tiene un tema que perseguir.", watch: "Cuidado con la presión de tener que resolverlo todo ya." },
  ajna: { gift: "Tienes una manera fija de pensar y ordenar las ideas: otros se apoyan en tu forma de ver.", watch: "Tu certeza no es la de los demás: escucha antes de convencer." },
  throat: { gift: "Tu voz tiene una forma reconocible: te expresas o actúas de una manera constante.", watch: "Habla cuando sea tu momento, sin forzar." },
  g: { gift: "Sabes quién eres y hacia dónde vas, aunque cambie todo alrededor. Das dirección.", watch: "No todo el mundo va hacia donde tú vas, y está bien." },
  heart: { gift: "Tienes fuerza de voluntad: puedes comprometerte y cumplir.", watch: "Necesitas descansar después de cada esfuerzo; no lo prometas todo." },
  spleen: { gift: "Tu intuición habla en el momento, una sola vez: te cuida y da seguridad a otros.", watch: "Si no la escuchas al instante, se va." },
  sacral: { gift: "Tienes energía de vida y de trabajo constante: cuando algo te enciende, no te cansas.", watch: "Úsala en lo que te responde; si no, te frustras." },
  solar: { gift: "Vives olas de emoción: tu claridad llega con el tiempo, no en caliente.", watch: "No decidas en lo alto ni en lo bajo de la ola." },
  root: { gift: "Tienes un motor de presión fijo que te pone en marcha y empuja las cosas a acabar.", watch: "Tu ritmo no es el de todos: no contagies prisa." },
};

/* ----------------------------------------------------------------- textos */

const CIRCUIT_TEXT: Record<Circuit, { color: string; meaning: string }> = {
  individual: { color: "#E07AA0", meaning: "El circuito del saber propio y del cambio. Su energía llega a pulsos, entre la melancolía y la inspiración: trae lo nuevo al mundo siendo distinta. Empodera a otros con su ejemplo." },
  tribal: { color: "#E9A65B", meaning: "El circuito del apoyo: la familia, los recursos, el contacto y los acuerdos. Su lema es «yo te sostengo si tú me sostienes». Cuida, protege y negocia." },
  collective: { color: "#7FA3D6", meaning: "El circuito de compartir: la lógica (los patrones, el futuro) y la abstracción (la experiencia, el pasado). Lo que vive, lo vive para el bien de todos." },
  integration: { color: "#9FD08A", meaning: "Los canales de la supervivencia propia: la energía para vivir tu vida a tu manera, en el ahora. Rápida, instintiva y muy personal." },
};

const DEFINITION_TEXT: Record<string, string> = {
  none: "Sin definición: todos los centros abiertos. Es la carta del Reflector: vives a través del entorno, como un espejo de la comunidad.",
  single: "Simple: todos tus centros definidos están conectados entre sí. Procesas sola, con una continuidad interior; no necesitas a nadie que te complete.",
  split: "Partida: dos islas de definición. Sin saberlo, buscas a quien une tus dos partes (los puentes). Tus decisiones maduran mejor hablando con gente variada.",
  triple: "Triple partida: tres islas. Necesitas mucha gente distinta y espacios abiertos para sentirte entera; tu claridad llega con tiempo.",
  quadruple: "Cuádruple: cuatro islas, muy poco frecuente. Procesas despacio; tu claridad llega con mucho tiempo y con muchas personas alrededor.",
};

const CROSS_POS: Record<string, { label: string; side: "personality" | "design"; body: "sun" | "earth"; meaning: string }> = {
  "p-sun": { label: "Sol de personalidad", side: "personality", body: "sun", meaning: "El corazón de tu cruz: casi el 70 % de tu energía y el tema que reconoces como tuyo." },
  "p-earth": { label: "Tierra de personalidad", side: "personality", body: "earth", meaning: "Lo que te arraiga y equilibra de forma consciente: tu suelo." },
  "d-sun": { label: "Sol de diseño", side: "design", body: "sun", meaning: "El tema de tu cuerpo, inconsciente: lo que otros ven en ti antes que tú." },
  "d-earth": { label: "Tierra de diseño", side: "design", body: "earth", meaning: "Tu raíz inconsciente: lo que te sostiene sin que lo pienses." },
};

const ANGLE_TEXT: Record<string, string> = {
  right: "Cruz de ángulo derecho: un destino personal. Tu vida se centra en tu propio proceso; los encuentros llegan para tu crecimiento.",
  juxtaposition: "Cruz de yuxtaposición: un destino fijo. Un camino muy propio, firme, que no se desvía.",
  left: "Cruz de ángulo izquierdo: un destino transpersonal. Tu vida se entrelaza con la de otras personas: lo que vives, lo vives con y para otros.",
};

type ArrowKey = "digestion" | "environment" | "motivation" | "perspective";
const ARROWS: Record<ArrowKey, { name: string; source: string; side: "personality" | "design"; body: HdBody; left: string; right: string }> = {
  digestion: { name: "Digestión", source: "Sol de diseño", side: "design", body: "sun", left: "Activa (flecha a la izquierda): te sienta bien un ritmo ordenado y constante al comer y al descansar.", right: "Pasiva (flecha a la derecha): necesitas variedad y seguir lo que pide el cuerpo en cada momento." },
  environment: { name: "Entorno", source: "Nodo Norte de diseño", side: "design", body: "northNode", left: "Concreto (izquierda): te nutren lugares conocidos, estables, con un propósito claro.", right: "Receptivo (derecha): te nutren entornos variados; observar desde fuera te sienta bien." },
  motivation: { name: "Motivación", source: "Sol de personalidad", side: "personality", body: "sun", left: "Estratégica (izquierda): te mueve un objetivo claro, ir paso a paso.", right: "Receptiva (derecha): te mueve lo que te llega; tu motivación es fluida, sin plan fijo." },
  perspective: { name: "Perspectiva", source: "Nodo Norte de personalidad", side: "personality", body: "northNode", left: "Enfocada (izquierda): ves los detalles concretos, lo que está delante.", right: "Periférica (derecha): ves el conjunto, lo que pasa alrededor." },
};

const CONDITIONING: Record<CentreId, { question: string; wisdom: string }> = {
  head: { question: "¿Estoy pensando en cosas que no me importan de verdad?", wisdom: "Sabiduría: saber qué preguntas merecen tu atención." },
  ajna: { question: "¿Intento convencer a otros de que estoy segura?", wisdom: "Sabiduría: ver todos los puntos de vista sin casarte con ninguno." },
  throat: { question: "¿Intento llamar la atención para que me vean?", wisdom: "Sabiduría: saber quién dice algo verdadero y cuándo hablar." },
  g: { question: "¿Sigo buscando amor y dirección fuera?", wisdom: "Sabiduría: reconocer los lugares y personas que te hacen bien." },
  heart: { question: "¿Intento demostrar mi valía?", wisdom: "Sabiduría: saber que no tienes nada que demostrar." },
  spleen: { question: "¿Me aferro a lo que no es bueno para mí?", wisdom: "Sabiduría: reconocer qué está sano y qué no, en ti y en otros." },
  sacral: { question: "¿Sé cuándo es suficiente?", wisdom: "Sabiduría: saber cuándo parar y descansar antes de agotarte." },
  solar: { question: "¿Evito la confrontación y la verdad por no molestar?", wisdom: "Sabiduría: sentir las emociones ajenas sin quedártelas." },
  root: { question: "¿Tengo prisa por quitarme la presión de encima?", wisdom: "Sabiduría: saber qué presión es real y cuál puedes dejar pasar." },
};

type PartnerKey = "electromagnetic" | "companionship" | "dominance" | "compromise";
const PARTNER: Record<PartnerKey, { name: string; color: string; meaning: string }> = {
  electromagnetic: { name: "Electromagnético", color: "#E07AA0", meaning: "Atracción: tú tienes una puerta y la otra persona la otra. Juntos completáis el canal: chispa, magnetismo… y también fricción." },
  companionship: { name: "Amistad", color: NIGHT_GOLD, meaning: "Compañía: las dos tenéis el mismo canal. En esa energía os entendéis sin palabras." },
  dominance: { name: "Dominio", color: "#9C8BE8", meaning: "Una tiene el canal entero y la otra ninguna de sus puertas: una «enseña» esa energía y la otra la recibe." },
  compromise: { name: "Compromiso", color: "#7FA3D6", meaning: "Una tiene el canal entero y la otra solo una puerta: la de una puerta tiende a ceder en ese tema." },
};

/* --------------------------------------------------------------- cálculos */

const fmt = (a: { gate: number; line: number }) => `${a.gate}.${a.line}`;
const chName = (k: string) => `${k} (${CHANNEL_BY_KEY.get(k)?.name})`;

/** Color y tono de una activación (cada línea en 6 colores; cada color en 6 tonos). */
function colorTone(lon: number) {
  const x = norm(lon - 302);
  const inLine = (x % 5.625) % 0.9375;
  const color = Math.floor(inLine / 0.15625) + 1;
  const tone = Math.floor((inLine % 0.15625) / (0.15625 / 6)) + 1;
  return { color: Math.min(6, color), tone: Math.min(6, tone) };
}
const arrowOf = (hd: HumanDesign, k: ArrowKey) => {
  const a = hd[ARROWS[k].side][ARROWS[k].body];
  const ct = colorTone(a.lon);
  return { ...ct, left: ct.tone <= 3 };
};

/** Las conexiones entre dos bodygraphs, por tipo. */
function partnerChannels(a: HumanDesign, b: HumanDesign): Record<PartnerKey, string[]> {
  const out: Record<PartnerKey, string[]> = { electromagnetic: [], companionship: [], dominance: [], compromise: [] };
  for (const ch of CHANNELS) {
    const k = channelKey(ch.a, ch.b);
    const ha = [a.gates.has(ch.a), a.gates.has(ch.b)];
    const hb = [b.gates.has(ch.a), b.gates.has(ch.b)];
    const fullA = ha[0] && ha[1];
    const fullB = hb[0] && hb[1];
    const nA = ha.filter(Boolean).length;
    const nB = hb.filter(Boolean).length;
    if (fullA && fullB) out.companionship.push(k);
    else if ((fullA && nB === 0) || (fullB && nA === 0)) out.dominance.push(k);
    else if ((fullA && nB === 1) || (fullB && nA === 1)) out.compromise.push(k);
    else if (nA === 1 && nB === 1 && ((ha[0] && hb[1] && !ha[1] && !hb[0]) || (ha[1] && hb[0] && !ha[0] && !hb[1]))) out.electromagnetic.push(k);
  }
  return out;
}

/** El cielo de hoy en el bodygraph: las puertas de cada planeta. */
const todayActs = () => activationsAt(new Date());

/** Canales que hoy se completan: una puerta suya y la otra del cielo (o las dos del cielo). */
function transitChannels(hd: HumanDesign | null, today: Set<number>) {
  const mine = hd?.gates ?? new Set<number>();
  return CHANNELS.filter((ch) => (mine.has(ch.a) || today.has(ch.a)) && (mine.has(ch.b) || today.has(ch.b)) && !(mine.has(ch.a) && mine.has(ch.b))).map((ch) => channelKey(ch.a, ch.b));
}

const gateOfOption = (option: string | null, hd: HumanDesign | null) => (option && option !== "sun" ? Number(option) : (hd?.personality.sun.gate ?? 1));

/** Dónde empieza y acaba una puerta en el zodiaco. */
function gateSpan(n: number) {
  const a = gateStart(n);
  const b = norm(a + 5.625);
  const deg = (l: number) => `${Math.floor(l % 30)}°${String(Math.round(((l % 30) % 1) * 60)).padStart(2, "0")}′ de ${SIGNS[signIndex(l)].name}`;
  return `de ${deg(a)} a ${deg(b)}`;
}

/* ------------------------------------------------------------ piezas */

/** Las 6 líneas de una puerta: las 64 puertas con sus 6 líneas («21.4»), empezando por la de la configuración (o la de su Sol). */
const gateLineKeys = (start: number) => Array.from({ length: 64 }, (_, i) => ((start - 1 + i) % 64) + 1).flatMap((g) => [1, 2, 3, 4, 5, 6].map((n) => `${g}.${n}`));
const parseGateLine = (key: string, fallbackGate: number) => (key.includes(".") ? { g: Number(key.split(".")[0]), n: Number(key.split(".")[1]) } : { g: fallbackGate, n: Number(key) });

export function hd2Keys(layer: Hd2Layer, ctx?: LayerCtx): string[] {
  if (layer === "hd-gate-lines") return gateLineKeys(gateOfOption(ctx?.option ?? null, ctx?.c?.humanDesign ?? null));
  return LAYER_KEYS[layer];
}

export function hd2Mine(layer: Hd2Layer, ctx: LayerCtx): string[] {
  const hd = ctx.c?.humanDesign ?? null;
  if (!hd) return [];
  switch (layer) {
    case "hd-circuits":
      return [...new Set(hd.definedChannels.map((ch) => ch.circuit))];
    case "hd-definition":
      return [hd.definition];
    case "hd-gate-lines": {
      // Todas sus puertas con su línea; primero las de la puerta de la configuración (o la de su Sol).
      const g = gateOfOption(ctx.option, hd);
      const all = [...new Set([...Object.values(hd.personality), ...Object.values(hd.design)].map((a) => `${a.gate}.${a.line}`))];
      return [...all.filter((k) => k.startsWith(`${g}.`)), ...all.filter((k) => !k.startsWith(`${g}.`))];
    }
    case "hd-mandala":
      return [...hd.gates].map(String);
    case "hd-conditioning":
      return (Object.keys(CONDITIONING) as CentreId[]).filter((c) => !hd.definedCentres.has(c));
    case "hd-defined":
      return (Object.keys(DEFINED) as CentreId[]).filter((c) => hd.definedCentres.has(c));
    case "hd-pairs":
      return Object.keys(PAIRS).filter((k) => PAIRS[k].centres.some((c) => hd.definedCentres.has(c)));
    case "hd-kinds":
      return Object.keys(KINDS).filter((k) => KINDS[k].centres.some((c) => hd.definedCentres.has(c)));
    case "hd-transits": {
      const t = todayActs();
      const today = new Set(Object.values(t).map((a) => a.gate));
      const lit = transitChannels(hd, today);
      return HD_SIDE_BODIES.filter((b) => lit.some((k) => k.split("-").map(Number).includes(t[b].gate)));
    }
    case "hd-partner": {
      const o = ctx.other?.humanDesign;
      if (!o) return [];
      const p = partnerChannels(hd, o);
      return (Object.keys(p) as PartnerKey[]).filter((k) => p[k].length);
    }
    default:
      return [];
  }
}

export function hd2Piece(layer: Hd2Layer, key: string, ctx: LayerCtx): SystemPiece {
  const hd = ctx.c?.humanDesign ?? null;
  switch (layer) {
    case "hd-circuits": {
      const ci = key as Circuit;
      const chs = CHANNELS.filter((ch) => ch.circuit === ci);
      const mine = hd ? chs.filter((ch) => hd.definedChannels.includes(ch)) : [];
      return {
        glyph: "",
        name: CIRCUIT_LABEL[ci],
        kicker: `${chs.length} canales`,
        meaning: `${CIRCUIT_TEXT[ci].meaning}\n\nSus canales: ${listEs(chs.map((ch) => `${ch.a}-${ch.b} ${ch.name}`))}.`,
        personal: hd ? (mine.length ? `Tienes definidos: ${listEs(mine.map((ch) => `${ch.a}-${ch.b} (${ch.name})`))}.` : "No tienes canales definidos en este circuito: es energía que recibes de otras personas.") : null,
      };
    }
    case "hd-definition": {
      const islands = hd?.components.map((g) => listEs(g.map((c) => CENTRE_BY_ID[c].name))) ?? [];
      return {
        glyph: "",
        name: DEFINITION_ES[key as keyof typeof DEFINITION_ES],
        kicker: key === "none" ? "Ninguna isla" : `${["", "Una isla", "Dos islas", "Tres islas", "Cuatro islas"][["none", "single", "split", "triple", "quadruple"].indexOf(key)]}`,
        meaning: DEFINITION_TEXT[key],
        personal: hd ? (hd.definition === key ? `Es tu definición.${islands.length ? ` Tus islas: ${islands.map((i, n) => `${n + 1}) ${i}`).join("; ")}.` : ""}` : `Tu definición es ${DEFINITION_ES[hd.definition].toLowerCase()}.`) : null,
      };
    }
    case "hd-cross": {
      const pos = CROSS_POS[key];
      const a = hd?.[pos.side][pos.body];
      const g = a ? GATE_BY_N.get(a.gate) : null;
      return {
        glyph: HD_BODY_GLYPH[pos.body] + VS,
        name: pos.label,
        kicker: hd ? hd.cross.label : "Una de las 4 puertas de tu cruz",
        meaning: `${pos.meaning}\n\nTu cruz de encarnación son las cuatro puertas del Sol y la Tierra de los dos lados: tu propósito en esta vida. ${hd ? ANGLE_TEXT[hd.cross.angle] : "Según el perfil, la cruz es de ángulo derecho, de yuxtaposición o de ángulo izquierdo."}`,
        personal: a && g ? `Aquí está tu puerta ${fmt(a)}, ${g.name}: ${g.theme.toLowerCase()}` : null,
      };
    }
    case "hd-variables": {
      const ar = ARROWS[key as ArrowKey];
      const mine = hd ? arrowOf(hd, key as ArrowKey) : null;
      return {
        glyph: "",
        name: ar.name,
        kicker: `Sale del tono de tu ${ar.source}`,
        meaning: `Las variables son cuatro flechas junto a la cabeza del bodygraph. Cada una apunta a la izquierda (activa, estratégica) o a la derecha (pasiva, receptiva), según el tono de una activación.\n\n${ar.left}\n\n${ar.right}`,
        personal: mine ? `Tu flecha apunta a la ${mine.left ? "izquierda" : "derecha"} (color ${mine.color}, tono ${mine.tone}). ${mine.left ? ar.left : ar.right}` : null,
      };
    }
    case "hd-gate-lines": {
      const { g, n } = parseGateLine(key, gateOfOption(ctx.option, hd));
      const gate = GATE_BY_N.get(g)!;
      const note = ctx.notes?.[String(n)]?.trim();
      const l = LINES[n - 1];
      const here = hd ? [...HD_SIDE_BODIES.flatMap((b) => [{ b, side: "personalidad", a: hd.personality[b] }, { b, side: "diseño", a: hd.design[b] }])].filter((x) => x.a.gate === g && x.a.line === n) : [];
      const gk = KEY_BY_N.get(g);
      return {
        glyph: `${g}.${n}`,
        name: `Puerta ${g}.${n} · ${gate.name}`,
        kicker: `Línea ${n}: ${l.name} · ${l.theme}`,
        meaning: `${gate.theme}\n\nVivida desde la línea ${n}, ${l.name.toLowerCase()}: ${l.meaning}${gk ? `\n\nEn las Gene Keys, la llave ${g}.${n}: de ${gk.shadow} a ${gk.gift}.` : ""}${note ? `\n\n${note}` : ""}`,
        personal: hd ? (here.length ? `La tienes: ${listEs(here.map((x) => `tu ${HD_BODY_ES[x.b]} de ${x.side}`))}.` : `No tienes la puerta ${g} en la línea ${n}.`) : null,
      };
    }
    case "hd-mandala": {
      const n = Number(key);
      const gate = GATE_BY_N.get(n)!;
      const gk = KEY_BY_N.get(n);
      const here = hd ? HD_SIDE_BODIES.flatMap((b) => [{ b, side: "personalidad", a: hd.personality[b] }, { b, side: "diseño", a: hd.design[b] }]).filter((x) => x.a.gate === n) : [];
      return {
        glyph: String(n),
        name: `Puerta ${n} · ${gate.name}`,
        kicker: `${CENTRE_BY_ID[gate.centre].name} · ${gateSpan(n)}`,
        meaning: `${gate.theme}\n\nEn el mandala, las 64 puertas rodean el zodiaco: cada una ocupa 5°37′ y su puerta opuesta está justo enfrente.${gk ? ` Es también la Gene Key ${n} (${gk.shadow} → ${gk.gift} → ${gk.siddhi}).` : ""}`,
        personal: hd ? (here.length ? `La activa ${listEs(here.map((x) => `tu ${HD_BODY_ES[x.b]} de ${x.side} (${fmt(x.a)})`))}.` : "No está activada en tu carta.") : null,
      };
    }
    case "hd-pairs":
    case "hd-kinds": {
      const p = (layer === "hd-pairs" ? PAIRS : KINDS)[key];
      const names = p.centres.map((c) => CENTRE_BY_ID[c].name);
      const def = hd ? p.centres.filter((c) => hd.definedCentres.has(c)) : [];
      return {
        glyph: "",
        name: p.name,
        kicker: p.kicker,
        meaning: `${p.text}\n\n${p.centres.map((c) => `${CENTRE_BY_ID[c].name}: ${CENTRE_BY_ID[c].role}`).join("\n")}`,
        personal: !hd ? null : def.length === p.centres.length ? `En tu carta ${p.centres.length > 1 ? "están todos definidos" : "está definido"}: ${listEs(names)}.` : def.length ? `Tienes definido ${listEs(def.map((c) => CENTRE_BY_ID[c].name))}; abierto, ${listEs(p.centres.filter((c) => !def.includes(c)).map((c) => CENTRE_BY_ID[c].name))}.` : `En tu carta ${p.centres.length > 1 ? "están abiertos" : "está abierto"}: aquí recibes la energía de otras personas.`,
      };
    }
    case "hd-defined": {
      const ce = CENTRE_BY_ID[key as CentreId];
      const d = DEFINED[key as CentreId];
      const defined = hd ? hd.definedCentres.has(key as CentreId) : null;
      return {
        glyph: "",
        name: `Centro definido: ${ce.name}`,
        kicker: `${ce.alias} · lo constante en ti`,
        meaning: `${ce.defined}\n\n${d.gift}\n\nA tener en cuenta: ${d.watch}\n\nUn centro definido (con color en el bodygraph) es una energía fiable y siempre igual: con ella influyes en los demás, que la reciben en sus centros abiertos.`,
        personal: defined == null ? null : defined ? "En tu carta está definido: esta energía es tuya y constante." : "En tu carta está abierto: mira el modelo de los centros abiertos.",
      };
    }
    case "hd-conditioning": {
      const ce = CENTRE_BY_ID[key as CentreId];
      const c = CONDITIONING[key as CentreId];
      const open = hd ? !hd.definedCentres.has(key as CentreId) : null;
      return {
        glyph: "",
        name: `Centro abierto: ${ce.name}`,
        kicker: "La pregunta del no-ser",
        meaning: `${ce.open}\n\nUn centro abierto no es un fallo: es donde recibes y amplificas la energía de los demás. La trampa es creer que esa energía es tuya. Pregúntate: ${c.question}\n\n${c.wisdom}`,
        personal: open == null ? null : open ? "En tu carta está abierto: esta pregunta es para ti." : "En tu carta está definido: aquí eres constante y condicionas tú a los demás.",
      };
    }
    case "hd-transits": {
      const t = todayActs();
      const a = t[key as HdBody];
      const gate = GATE_BY_N.get(a.gate)!;
      const today = new Set(Object.values(t).map((x) => x.gate));
      const lit = transitChannels(hd, today).filter((k) => k.split("-").map(Number).includes(a.gate));
      return {
        glyph: HD_BODY_GLYPH[key as HdBody] + VS,
        name: `${HD_BODY_ES[key as HdBody]} hoy: puerta ${fmt(a)}`,
        kicker: `${gate.name} · ${CENTRE_BY_ID[gate.centre].name}`,
        meaning: `${gate.theme}\n\nEl cielo de hoy activa puertas en todos. Cuando una puerta de hoy completa un canal con una de las tuyas, sientes esa energía de forma fija mientras dura el tránsito.`,
        personal: hd ? (lit.length ? `Hoy completa contigo: ${listEs(lit.map(chName))}.` : hd.gates.has(a.gate) ? "Hoy refuerza una puerta que ya tienes." : "Hoy no completa ningún canal contigo.") : null,
      };
    }
    case "hd-partner": {
      const p = PARTNER[key as PartnerKey];
      const o = ctx.other?.humanDesign;
      const list = hd && o ? partnerChannels(hd, o)[key as PartnerKey] : [];
      const who = ctx.others?.[ctx.otherIndex ?? 0]?.name ?? "la otra persona";
      return {
        glyph: "",
        name: p.name,
        kicker: `Tú y ${who}`,
        meaning: p.meaning,
        personal: !hd ? null : !ctx.others?.length ? "Guarda en «Mi energía» los datos de otra persona para ver vuestras conexiones." : !o ? "Calculando su bodygraph…" : list.length ? `Entre tú y ${who}: ${listEs(list.map(chName))}.` : "No tenéis conexiones de este tipo.",
      };
    }
  }
  return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
}

/* ------------------------------------------------------------ dibujos */

export function Hd2Diagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: Hd2Layer }) {
  const hd = ctx.c?.humanDesign ?? null;
  const own = new Set(mine);
  const today = useMemo(() => (layer === "hd-transits" ? todayActs() : null), [layer]);
  switch (layer) {
    case "hd-circuits": {
      const ci = selected as Circuit;
      const inCi = new Set(CHANNELS.filter((ch) => ch.circuit === ci).map((ch) => channelKey(ch.a, ch.b)));
      const defined = new Set(hd?.definedChannels.map((ch) => channelKey(ch.a, ch.b)) ?? []);
      return (
        <NightPanel>
          <MiniBodygraph hd={hd} channelColor={(k) => (inCi.has(k) ? (defined.has(k) ? NIGHT_GOLD : CIRCUIT_TEXT[ci].color) : null)} dimGate={(n) => !CHANNELS.some((ch) => ch.circuit === ci && (ch.a === n || ch.b === n))} />
          <NightChips items={keys.map((k) => ({ key: k, label: CIRCUIT_LABEL[k as Circuit].split(" — ")[0] }))} selected={selected} mine={own} tap={tap} />
          <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}>En color, los canales del circuito · en oro, los que tienes definidos</p>
        </NightPanel>
      );
    }
    case "hd-definition": {
      // Ejemplos de cartas reales de cada definición (no la propia: así se ven todas). Cada isla, en un color.
      const COMP = ["#E9CC8E", "#E07AA0", "#7FA3D6", "#9FD08A"];
      const colours = (ex: HumanDesign) => {
        const compOf = new Map<string, string>();
        ex.components.forEach((g, i) => {
          for (const ch of ex.definedChannels) if (g.includes(GATE_BY_N.get(ch.a)!.centre)) compOf.set(channelKey(ch.a, ch.b), COMP[i % 4]);
        });
        return { gates: false, centreNames: true, channelColor: (k: string) => compOf.get(k) ?? null };
      };
      return (
        <NightPanel>
          <ExampleBodygraph
            examples={DEFINITION_EXAMPLES}
            items={keys.map((k) => ({ key: k, label: ({ none: "Ninguna", single: "Simple", split: "Partida", triple: "Triple", quadruple: "Cuádruple" } as Record<string, string>)[k] }))}
            selected={selected}
            own={own}
            tap={tap}
            extra={colours}
          />
        </NightPanel>
      );
    }
    case "hd-cross":
      return (
        <NightPanel>
          <CrossDiagram hd={hd} selected={selected} tap={tap} />
        </NightPanel>
      );
    case "hd-variables":
      return (
        <NightPanel>
          <ArrowsDiagram hd={hd} selected={selected} tap={tap} />
        </NightPanel>
      );
    case "hd-gate-lines": {
      // A la izquierda, las 64 puertas; a la derecha, las 6 líneas de la elegida.
      const { g, n } = parseGateLine(selected, gateOfOption(ctx.option, hd));
      const mineHere = new Set(mine.filter((k) => k.startsWith(`${g}.`)).map((k) => k.split(".")[1]));
      const myGates = new Set(mine.map((k) => Number(k.split(".")[0])));
      const lineOf = (gate: number) => mine.find((k) => k.startsWith(`${gate}.`)) ?? `${gate}.${n}`;
      return (
        <NightPanel>
          <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <div className="grid grid-cols-8 gap-1 p-1" role="group" aria-label="Las 64 puertas">
              {Array.from({ length: 64 }, (_, i) => i + 1).map((gate) => {
                const on = gate === g;
                const m = myGates.has(gate);
                return (
                  <button
                    key={gate}
                    type="button"
                    {...tap(lineOf(gate), `Puerta ${gate}`)}
                    className="grid aspect-square place-items-center rounded-lg border text-[0.72rem] font-semibold tabular-nums transition"
                    style={{
                      background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : m ? "rgb(233 204 142 / .14)" : "rgb(255 255 255 / .05)",
                      borderColor: on ? "#F0D9A4" : m ? "rgb(233 204 142 / .6)" : "rgb(255 255 255 / .12)",
                      color: on ? NIGHT : STAR,
                      cursor: "pointer",
                    }}
                  >
                    {gate}
                  </button>
                );
              })}
              <p className="col-span-8 mt-1 text-center text-[0.65rem]" style={{ color: "rgb(251 246 236 / .6)" }}>
                En dorado, tus puertas
              </p>
            </div>
            <GateLines gate={g} selected={String(n)} own={mineHere} tap={(k, label) => tap(`${g}.${k}`, label)} />
          </div>
        </NightPanel>
      );
    }
    case "hd-mandala":
      return (
        <NightPanel>
          <Mandala hd={hd} selected={Number(selected)} tap={tap} />
        </NightPanel>
      );
    case "hd-conditioning":
      return (
        <NightPanel>
          <MiniBodygraph hd={hd} centreNames gates={false} focusCentres={new Set([selected as CentreId])} tapCentre={(id) => tap(id, CENTRE_BY_ID[id].name)} />
          <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}>
            {hd ? `Tus centros abiertos: ${listEs(mine.map((c) => CENTRE_BY_ID[c as CentreId].name)) || "ninguno"}` : "Toca un centro"}
          </p>
        </NightPanel>
      );
    case "hd-pairs":
    case "hd-kinds": {
      const src = layer === "hd-pairs" ? PAIRS : KINDS;
      const short: Record<string, string> = { "head-root": "Cabeza y Raíz", "ajna-sacral": "Ajna y Sacro", "throat-spleen-solar": "Garganta, Bazo y Plexo", motor: "Motor", awareness: "Consciencia", manifestation: "Manifestación", compass: "Compás de vida", pressure: "Presión" };
      return (
        <NightPanel>
          {/* Sobre un bodygraph vacío: solo se definen (se colorean) los centros de la pieza elegida. */}
          <MiniBodygraph hd={null} centreNames gates={false} centreOn={(id) => src[selected].centres.includes(id)} focusCentres={new Set(src[selected].centres)} />
          <NightChips items={keys.map((k) => ({ key: k, label: short[k] ?? k }))} selected={selected} mine={own} tap={tap} />
        </NightPanel>
      );
    }
    case "hd-defined":
      return (
        <NightPanel>
          <MiniBodygraph hd={hd} centreNames gates={false} focusCentres={new Set([selected as CentreId])} tapCentre={(id) => tap(id, CENTRE_BY_ID[id].name)} />
          <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}>
            {hd ? `Tus centros definidos: ${listEs(mine.map((c) => CENTRE_BY_ID[c as CentreId].name)) || "ninguno (Reflector)"}` : "Toca un centro"}
          </p>
        </NightPanel>
      );
    case "hd-transits": {
      const t = today!;
      const todayGates = new Set(Object.values(t).map((a) => a.gate));
      const lit = new Set(transitChannels(hd, todayGates));
      const defined = new Set(hd?.definedChannels.map((ch) => channelKey(ch.a, ch.b)) ?? []);
      const sel = t[selected as HdBody];
      return (
        <NightPanel>
          <MiniBodygraph
            hd={hd}
            selectedGate={sel.gate}
            gateColor={(n) => (hd?.gates.has(n) ? sideColorOf(hd, n) : todayGates.has(n) ? "#9C8BE8" : null)}
            channelColor={(k) => (defined.has(k) ? "gold" : lit.has(k) ? "#9C8BE8" : null)}
            centreOn={(id) => !!hd?.definedCentres.has(id) || [...lit].some((k) => k.split("-").map(Number).some((g) => GATE_BY_N.get(g)!.centre === id))}
          />
          <div className="flex flex-wrap justify-center gap-1 pb-1">
            {HD_SIDE_BODIES.map((b) => {
              const on = b === selected;
              return (
                <span key={b} {...tap(b, `${HD_BODY_ES[b]} hoy`)} className="rounded-full border px-2 py-0.5 text-[0.68rem] tabular-nums" style={{ background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "rgb(255 255 255 / .06)", color: on ? NIGHT : STAR, borderColor: own.has(b) ? "rgb(156 139 232 / .8)" : "rgb(255 255 255 / .16)", cursor: "pointer" }}>
                  {HD_BODY_GLYPH[b] + VS} {fmt(t[b])}
                </span>
              );
            })}
          </div>
          <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}>En lavanda, el cielo de hoy y los canales que completa contigo</p>
        </NightPanel>
      );
    }
    case "hd-partner": {
      const o = ctx.other?.humanDesign ?? null;
      const p = hd && o ? partnerChannels(hd, o) : null;
      const selSet = new Set(p?.[selected as PartnerKey] ?? []);
      const THEIRS = "#7FB8E0";
      return (
        <NightPanel>
          {ctx.others && ctx.others.length > 0 ? (
            <div className="mb-1 flex justify-center pt-1">
              <select className="input h-9 w-auto text-sm" value={ctx.otherIndex ?? 0} onChange={(e) => ctx.pickOther?.(Number(e.target.value))} aria-label="Con quién comparar">
                {ctx.others.map((x, i) => (
                  <option key={i} value={i}>
                    Con {x.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="pt-1 text-center text-xs" style={{ color: "rgb(251 246 236 / .7)" }}>
              Guarda en «Mi energía» los datos de otra persona para comparar.
            </p>
          )}
          <MiniBodygraph
            hd={hd}
            gateColor={(n) => {
              const a = !!hd?.gates.has(n);
              const b = !!o?.gates.has(n);
              return a && b ? "both" : a ? PERS : b ? THEIRS : null;
            }}
            channelColor={(k) => (selSet.has(k) ? PARTNER[selected as PartnerKey].color : null)}
            centreOn={(id) => !!hd?.definedCentres.has(id) || !!o?.definedCentres.has(id)}
          />
          <NightChips items={keys.map((k) => ({ key: k, label: PARTNER[k as PartnerKey].name }))} selected={selected} mine={own} tap={tap} />
          <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}>
            Tus puertas en crema · las de {ctx.others?.[ctx.otherIndex ?? 0]?.name ?? "la otra persona"} en azul
          </p>
        </NightPanel>
      );
    }
  }
  return null;
}

/** La cruz: las cuatro puertas en sus brazos (Soles arriba y abajo de cada lado) y el ángulo en el centro. */
function CrossDiagram({ hd, selected, tap }: { hd: HumanDesign | null; selected: string; tap: Tap }) {
  const p = usePrefix();
  const POS: Record<string, { x: number; y: number }> = { "p-sun": { x: 170, y: 58 }, "p-earth": { x: 170, y: 282 }, "d-sun": { x: 58, y: 170 }, "d-earth": { x: 282, y: 170 } };
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label="La cruz de encarnación">
      <NightDefs p={p} />
      <Stars w={340} h={340} n={36} />
      <circle cx="170" cy="170" r="112" fill="none" stroke="rgb(233 204 142 / .3)" strokeDasharray="2 5" />
      <line x1="170" y1="58" x2="170" y2="282" stroke={NIGHT_GOLD} strokeWidth="3" />
      <line x1="58" y1="170" x2="282" y2="170" stroke={NIGHT_RED} strokeWidth="3" strokeOpacity="0.8" />
      {Object.entries(POS).map(([k, { x, y }]) => {
        const pos = CROSS_POS[k];
        const a = hd?.[pos.side][pos.body];
        const on = selected === k;
        return (
          <g key={k} {...tap(k, pos.label)}>
            {on && <circle cx={x} cy={y} r="40" fill={`url(#${p}goldglow)`} />}
            <circle cx={x} cy={y} r="30" fill={on ? `url(#${p}gold)` : "#1E1B45"} stroke={pos.side === "design" ? NIGHT_RED : PERS} strokeWidth="2" />
            <text x={x} y={a ? y - 6 : y} textAnchor="middle" dominantBaseline="central" fontSize="13" fill={on ? NIGHT : STAR}>
              {HD_BODY_GLYPH[pos.body] + VS}
            </text>
            {a && (
              <text x={x} y={y + 10} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="700" fill={on ? NIGHT : pos.side === "design" ? "#F4A79F" : STAR}>
                {fmt(a)}
              </text>
            )}
          </g>
        );
      })}
      <circle cx="170" cy="170" r="34" fill={NIGHT} stroke="rgb(233 204 142 / .6)" />
      <text x="170" y="164" textAnchor="middle" fontSize="8" letterSpacing="1.2" fill={NIGHT_GOLD}>
        CRUZ
      </text>
      <text x="170" y="178" textAnchor="middle" fontSize="8.5" fill={STAR}>
        {hd ? CROSS_ANGLE_ES[hd.cross.angle].replace("Cruz de ", "").replace("Ángulo ", "") : "4 puertas"}
      </text>
    </svg>
  );
}

/** Las cuatro flechas junto a la cabeza: arriba las de diseño (izquierda) y personalidad (derecha)… */
function ArrowsDiagram({ hd, selected, tap }: { hd: HumanDesign | null; selected: string; tap: Tap }) {
  const p = usePrefix();
  const POS: Record<ArrowKey, { x: number; y: number }> = { digestion: { x: 95, y: 110 }, environment: { x: 95, y: 200 }, motivation: { x: 245, y: 110 }, perspective: { x: 245, y: 200 } };
  return (
    <svg viewBox="0 0 340 300" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label="Las 4 variables">
      <NightDefs p={p} />
      <Stars w={340} h={300} n={30} />
      {/* La cabeza y el ajna, como en el bodygraph. */}
      <polygon points="170,60 214,130 126,130" fill="#1E1B45" stroke="rgb(255 255 255 / .35)" strokeWidth="1.4" />
      <polygon points="126,150 214,150 170,220" fill="#1E1B45" stroke="rgb(255 255 255 / .35)" strokeWidth="1.4" />
      <text x="170" y="250" textAnchor="middle" fontSize="8.5" letterSpacing="1.4" fill="rgb(251 246 236 / .6)">
        DISEÑO ← · → PERSONALIDAD
      </text>
      {(Object.keys(POS) as ArrowKey[]).map((k) => {
        const { x, y } = POS[k];
        const on = selected === k;
        const dir = hd ? arrowOf(hd, k) : null;
        const left = dir ? dir.left : k === "digestion" || k === "environment";
        const col = ARROWS[k].side === "design" ? NIGHT_RED : PERS;
        const d = left ? `M${x + 26} ${y}H${x - 22}m10 -9l-10 9l10 9` : `M${x - 26} ${y}H${x + 22}m-10 -9l10 9l-10 9`;
        return (
          <g key={k} {...tap(k, ARROWS[k].name)}>
            <rect x={x - 48} y={y - 30} width="96" height="60" rx="14" fill={on ? "rgb(233 204 142 / .14)" : "transparent"} stroke={on ? "#F0D9A4" : "transparent"} />
            <path d={d} fill="none" stroke={on ? NIGHT_GOLD : col} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x={x} y={y + 22} textAnchor="middle" fontSize="9.5" fontWeight={on ? 700 : 500} fill={on ? NIGHT_GOLD : STAR}>
              {ARROWS[k].name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Las seis líneas de una puerta, como un hexagrama (la 1 abajo), con el número de la puerta arriba. */
function GateLines({ gate, selected, own, tap }: { gate: number; selected: string; own: Set<string>; tap: Tap }) {
  const p = usePrefix();
  const g = GATE_BY_N.get(gate)!;
  return (
    <svg viewBox="0 0 320 380" className="mx-auto block h-auto w-full max-w-[24rem] select-none" role="group" aria-label={`Las 6 líneas de la puerta ${gate}`}>
      <NightDefs p={p} />
      <Stars w={320} h={380} n={30} />
      <circle cx="160" cy="36" r="24" fill={`url(#${p}gold)`} stroke="#FFF3D4" strokeWidth="1.5" />
      <text x="160" y="37" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill={NIGHT}>
        {gate}
      </text>
      <text x="160" y="72" textAnchor="middle" fontSize="10" letterSpacing="1.2" fill={NIGHT_GOLD}>
        {g.name.toUpperCase()}
      </text>
      {[6, 5, 4, 3, 2, 1].map((n, i) => {
        const k = String(n);
        const on = selected === k;
        const m = own.has(k);
        const y = 92 + i * 46;
        return (
          <g key={n} {...tap(k, `Línea ${n}`)}>
            <rect x="20" y={y - 4} width="280" height="40" rx="12" fill={on ? "rgb(233 204 142 / .12)" : "transparent"} />
            <text x="40" y={y + 16} textAnchor="middle" dominantBaseline="central" fontSize="20" fontFamily="Georgia, serif" fill={on || m ? NIGHT_GOLD : STAR} fillOpacity={on || m ? 1 : 0.7}>
              {n}
            </text>
            <rect x="62" y={y + 8} width="200" height="16" rx="4" fill={on ? `url(#${p}gold)` : m ? "rgb(233 204 142 / .55)" : "rgb(255 255 255 / .14)"} />
            <text x="162" y={y + 16.5} textAnchor="middle" dominantBaseline="central" fontSize="10" letterSpacing="1" fontWeight="600" fill={on ? NIGHT : STAR} fillOpacity={on ? 1 : 0.85}>
              {LINES[n - 1].name.toUpperCase()}
            </text>
            {m && (
              <text x="282" y={y + 16.5} textAnchor="middle" dominantBaseline="central" fontSize="13" fill={NIGHT_GOLD}>
                ★
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** El mandala: el zodiaco y, dentro, las 64 puertas en su sitio (la 41 empieza en 2° de Acuario). */
function Mandala({ hd, selected, tap }: { hd: HumanDesign | null; selected: number; tap: Tap }) {
  const p = usePrefix();
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[28rem] select-none" role="group" aria-label="El mandala de las 64 puertas">
      <NightDefs p={p} />
      <Stars w={340} h={340} n={40} />
      {SIGNS.map((s, i) => {
        const g = pt(i * 30 + 15, 151);
        return (
          <g key={s.n} pointerEvents="none">
            <path d={sector(i * 30, i * 30 + 30, 142, 160)} fill={`${ELEMENT_HUE[s.element]}${i % 2 ? "30" : "48"}`} stroke="rgb(255 255 255 / .15)" strokeWidth="0.6" />
            <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize="10" fill={STAR}>
              {s.glyph + VS}
            </text>
          </g>
        );
      })}
      {LAYER_KEYS["hd-mandala"].map((k) => {
        const n = Number(k);
        const start = gateStart(n);
        const on = n === selected;
        const col = sideColorOf(hd, n);
        const q = pt(start + 2.8, 126);
        return (
          <g key={n} {...tap(k, `Puerta ${n}`)}>
            <path d={sector(start, start + 5.625, 110, on ? 144 : 140)} fill={on ? `url(#${p}gold)` : col === "both" ? NIGHT_RED : col ?? (n % 2 ? "rgb(255 255 255 / .05)" : "rgb(255 255 255 / .09)")} fillOpacity={col && !on ? 0.85 : 1} stroke="rgb(255 255 255 / .16)" strokeWidth="0.5" />
            <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize="6.2" fontWeight={on || col ? 700 : 500} fill={on || col === PERS ? NIGHT : STAR}>
              {n}
            </text>
          </g>
        );
      })}
      {/* La puerta elegida y su opuesta, unidas por el centro. */}
      {(() => {
        const a = pt(gateStart(selected) + 2.8, 108);
        const b = pt(gateStart(selected) + 182.8, 108);
        return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={NIGHT_GOLD} strokeWidth="1" strokeDasharray="3 3" pointerEvents="none" />;
      })()}
      <circle cx={C} cy={C} r="62" fill={NIGHT} stroke="rgb(233 204 142 / .5)" pointerEvents="none" />
      <text x={C} y={C - 10} textAnchor="middle" dominantBaseline="central" fontSize="30" fontFamily="Georgia, serif" fill={NIGHT_GOLD} pointerEvents="none">
        {selected}
      </text>
      <text x={C} y={C + 18} textAnchor="middle" fontSize="8" letterSpacing="1" fill={STAR} pointerEvents="none">
        {GATE_BY_N.get(selected)?.name.toUpperCase()}
      </text>
    </svg>
  );
}
