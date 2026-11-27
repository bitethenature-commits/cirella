"use client";

import { useMemo } from "react";
import { KEY_BY_N, SEQUENCE_BY_ID, SPHERE_BY_ID, SPHERES, type SequenceId } from "@/components/models/data/gene-keys";
import { ELEMENT_HUE, SIGNS } from "@/components/models/data/astrology";
import { HD_BODY_ES, HD_BODY_GLYPH } from "@/lib/human-design-names";
import { activationsAt, gateStart } from "@/lib/human-design-calc";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, VS, listEs, norm, pt, sector, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { GoldenPath, NightPanel as GkNightPanel, SequenceLegend, TONE, WHEEL, nameIn, partnerOf } from "./gk";
import { KeyGrid } from "./key-grid";
import { DegreeTicks } from "./wheel-kit";
import { NIGHT, NIGHT_GOLD, NightChips, NightDefs, NightPanel, STAR, Stars, usePrefix } from "./night";
import { GK_LINES } from "./texts";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Gene Keys a fondo, en 6 capas: los 21 anillos de codones, las 32 compañeras de programación, la rueda de
 * las 64 llaves con las esferas de la alumna, las dos caras de la sombra (reprimida y reactiva), la llave de
 * hoy (la que activa el Sol) y la Secuencia de Venus paso a paso. Sobre el cielo de noche, como las demás.
 */

export type Gk2Layer = Extract<AstroLayer, "gk-codons" | "gk-partners" | "gk-wheel" | "gk-shadows" | "gk-today" | "gk-venus">;
export const GK2_LAYERS = new Set<string>(["gk-codons", "gk-partners", "gk-wheel", "gk-shadows", "gk-today", "gk-venus"]);

/* ----------------------------------------------------------------- textos */

/** Los 21 anillos de codones: las llaves que comparten aminoácido, como una familia química. */
export const CODON_RINGS: { id: string; name: string; keys: number[]; theme: string }[] = [
  { id: "origin", name: "Anillo del Origen", keys: [41], theme: "El punto de partida: el sueño, la chispa que abre cada ciclo. Es la llave con la que empieza la rueda." },
  { id: "fire", name: "Anillo de Fuego", keys: [1, 14], theme: "El fuego creativo que empuja la evolución: lo nuevo que se enciende y la energía para sostenerlo." },
  { id: "water", name: "Anillo de Agua", keys: [2, 8], theme: "El flujo: dejarte orientar y ser fiel a tu propio estilo, como el agua que encuentra su camino." },
  { id: "life-death", name: "Anillo de la Vida y la Muerte", keys: [3, 20, 23, 24, 27, 42], theme: "Los ciclos: nacer, cuidar, simplificar, soltar y volver a empezar. Lo que muere deja sitio a lo que nace." },
  { id: "union", name: "Anillo de la Unión", keys: [4, 7, 29, 59], theme: "Lo que nos une: comprender, guiar, entregarse e intimar." },
  { id: "light", name: "Anillo de la Luz", keys: [5, 9, 11, 26], theme: "La paciencia, la determinación, los ideales y el ingenio: las llaves que traen luz poco a poco." },
  { id: "alchemy", name: "Anillo de la Alquimia", keys: [6, 40, 47, 64], theme: "Transformar el conflicto, el agotamiento y la confusión en paz, voluntad y claridad." },
  { id: "humanity", name: "Anillo de la Humanidad", keys: [10, 17, 21, 25, 38, 51], theme: "El gran drama humano: ser tú misma, la autoridad, la lucha, el amor y el despertar." },
  { id: "trials", name: "Anillo de las Pruebas", keys: [12, 33, 56], theme: "Las llaves de «parar» del código genético: las pruebas que nos purifican antes de seguir." },
  { id: "purification", name: "Anillo de la Purificación", keys: [13, 30], theme: "Escuchar y arder: el deseo y el pasado, purificados hasta quedar ligeros." },
  { id: "seeking", name: "Anillo de la Búsqueda", keys: [15, 39, 52, 53, 54, 58], theme: "El impulso de crecer: la búsqueda, la ambición y la alegría de ir siempre un poco más allá." },
  { id: "prosperity", name: "Anillo de la Prosperidad", keys: [16, 45], theme: "La maestría y la sinergia: la abundancia que nace al compartir." },
  { id: "divinity", name: "Anillo de la Divinidad", keys: [22, 36, 37, 63], theme: "La gracia, la compasión, la ternura y la duda sagrada: lo divino en lo humano." },
  { id: "destiny", name: "Anillo del Destino", keys: [34, 43], theme: "La fuerza y la perspicacia: cuando el destino se cumple sin forzarlo." },
  { id: "illusion", name: "Anillo de la Ilusión", keys: [28, 32], theme: "El miedo a fracasar y a no tener sentido: ver más allá de la ilusión." },
  { id: "gaia", name: "Anillo de Gaia", keys: [19, 60, 61], theme: "La sensibilidad, los límites y la inspiración: nuestro vínculo con la Tierra." },
  { id: "miracles", name: "Anillo de los Milagros", keys: [35], theme: "La aventura y lo ilimitado: el milagro de lo que no se puede planear." },
  { id: "matter", name: "Anillo de la Materia", keys: [18, 46, 48, 57], theme: "El cuerpo, la salud y la intuición: el espíritu viviendo en la materia." },
  { id: "no-return", name: "Anillo del No Retorno", keys: [31, 62], theme: "El liderazgo y la palabra precisa: lo que, una vez dicho, no tiene vuelta atrás." },
  { id: "illuminati", name: "Anillo de los Illuminati", keys: [44, 50], theme: "El trabajo en equipo y los valores: las redes que sostienen a la humanidad." },
  { id: "whirlwind", name: "Anillo del Torbellino", keys: [49, 55], theme: "La revolución y la libertad: la gran transformación emocional de nuestro tiempo." },
];
const RING_BY_ID = new Map(CODON_RINGS.map((r) => [r.id, r]));
const ringOf = (n: number) => CODON_RINGS.find((r) => r.keys.includes(n))!;
const RING_HUE = ["#E9CC8E", "#E07AA0", "#7FA3D6", "#9FD08A", "#C49BE8", "#E9A65B", "#7FD0C8"];
const ringHue = (id: string) => RING_HUE[CODON_RINGS.findIndex((r) => r.id === id) % RING_HUE.length];

const SHADOW_FACES = {
  repressive: { name: "La cara reprimida", kicker: "La sombra vuelta hacia dentro", color: "#7FA3D6", meaning: "Cuando el miedo se vuelve hacia dentro: te callas, te encoges, te culpas o te desconectas. Es la sombra que no se ve, la que «no molesta» pero apaga." },
  reactive: { name: "La cara reactiva", kicker: "La sombra vuelta hacia fuera", color: "#E36B5F", meaning: "Cuando el miedo sale hacia fuera: reaccionas, culpas, controlas o explotas. Es la sombra que se ve, la que proyecta en los demás lo que no quiere sentir." },
  gift: { name: "El camino del medio", kicker: "Ni reprimir ni reaccionar", color: NIGHT_GOLD, meaning: "El don aparece cuando ves las dos caras en ti sin elegir ninguna: sin taparla y sin echarla fuera. Contemplar la sombra, con paciencia, la va transformando." },
} as const;
type Face = keyof typeof SHADOW_FACES;
const FACES: Face[] = ["repressive", "gift", "reactive"];
const SHADOW_KEYS = Array.from({ length: 64 }, (_, i) => i + 1).flatMap((n) => FACES.map((fc) => `${n}:${fc}`));
const parseFace = (key: string, fallback: number) => (key.includes(":") ? { n: Number(key.split(":")[0]), face: key.split(":")[1] as Face } : { n: fallback, face: key as Face });
/** Sus llaves, en el orden de las esferas (la Obra de vida primero). */
const myKeys = (c: LayerCtx["c"]) => (c ? [...new Set(SPHERES.map((x) => c.geneKeys.keys[x.id]))] : []);

const TODAY_BODIES = ["sun", "earth", "moon", "venus", "mars"] as const;
type TodayBody = (typeof TODAY_BODIES)[number];
const TODAY_TEXT: Record<TodayBody, string> = {
  sun: "La llave del Sol es la del día: unos 5 o 6 días en cada una. Es el tema que respira todo el mundo esta semana.",
  earth: "La Tierra está siempre enfrente del Sol: es la compañera de programación de la llave del Sol. Le da suelo y equilibrio.",
  moon: "La Luna cambia de llave cada medio día: el tono emocional de las próximas horas.",
  venus: "Venus pasa unos cinco días en cada llave: el tono de los vínculos, del amor y de lo que valoras estos días.",
  mars: "Marte pasa unas dos semanas en cada llave: dónde va la energía, el impulso y el deseo de actuar.",
};
const TODAY_SPEED: Record<TodayBody, number> = { sun: 0.9856, earth: 0.9856, moon: 13.18, venus: 1.2, mars: 0.52 };

const VENUS_PATH = ["purpose", "attraction", "iq", "eq", "sq", "core"] as const;
const SEQ_PATHS: Record<SequenceId, string[]> = {
  activation: ["lifework", "evolution", "radiance", "purpose"],
  venus: [...VENUS_PATH],
  pearl: ["core", "culture", "lifework", "pearl"],
};
const SEQ_KEYS = (Object.keys(SEQ_PATHS) as SequenceId[]).flatMap((q) => SEQ_PATHS[q].map((id) => `${q}:${id}`));
const ACTIVATION_DEPTH: Record<string, { when: string; deep: string; practice: string }> = {
  lifework: { when: "Tu forma de brillar", deep: "La Obra de vida es por lo que te haces visible: tu manera natural de expresarte. No hay que buscarla fuera: aparece cuando haces lo que te sale solo.", practice: "Anota tres cosas que haces sin esfuerzo y que otros te agradecen." },
  evolution: { when: "Tu reto que vuelve", deep: "La Evolución es el desafío que se repite hasta que lo atraviesas. Cada vez que vuelve trae la misma lección con otra cara: es el camino de tu madurez.", practice: "Escribe la situación difícil que más se repite en tu vida y qué te pide aprender." },
  radiance: { when: "Tu salud y tu vitalidad", deep: "La Irradiación no se practica: ocurre cuando las otras tres esferas maduran. Es la energía que tienes cuando vives en coherencia.", practice: "Observa una semana cuándo tienes energía sin forzarla. ¿Qué estabas haciendo?" },
  purpose: { when: "Tu suelo firme", deep: "El Propósito es aquello sobre lo que te apoyas: lo que sigue siendo verdad aunque cambie todo. Cierra la Activación y abre la Secuencia de Venus.", practice: "Escribe una frase que sea verdad sobre ti pase lo que pase." },
};
const PEARL_DEPTH: Record<string, { when: string; deep: string; practice: string }> = {
  core: { when: "Tu vocación", deep: "En la Perla, el Núcleo es tu Vocación: el terreno en el que tu trabajo se vuelve ligero porque encaja contigo. La herida y la vocación son la misma llave.", practice: "Recuerda un momento en que el tiempo se te olvidó trabajando. ¿Qué hacías?" },
  culture: { when: "Las personas que te sostienen", deep: "La Cultura son los vínculos que hacen prosperar tu obra: la gente con la que tu trabajo tiene sentido. La prosperidad llega por relaciones, no por esfuerzo.", practice: "Haz una lista de las personas que se benefician de verdad de lo que haces." },
  lifework: { when: "Tu marca", deep: "En la Perla, la Obra de vida es tu Marca: cómo aparece tu don hacia fuera sin que tengas que explicarlo. Lo que la gente reconoce en ti.", practice: "Pregunta a tres personas por qué vienen a ti. Escucha qué se repite." },
  pearl: { when: "La simplicidad", deep: "La Perla es el punto en que la prosperidad deja de ser un objetivo y pasa a ser una consecuencia. Su clave es simplificar: quitar hasta que quede lo esencial.", practice: "Elige una cosa que podrías dejar de hacer sin perder nada. Déjala esta semana." },
};
const SEQ_DEPTH: Record<SequenceId, Record<string, { when: string; deep: string; practice: string }>> = { activation: ACTIVATION_DEPTH, venus: {}, pearl: PEARL_DEPTH };
const VENUS_DEPTH: Record<string, { when: string; deep: string; practice: string }> = {
  purpose: { when: "La puerta de entrada", deep: "El Propósito cierra la Activación y abre Venus. Antes de mirar tus relaciones, tienes que sentir el suelo que te sostiene.", practice: "Escribe una frase que sea verdad sobre ti pase lo que pase." },
  attraction: { when: "Tus relaciones de hoy", deep: "La Atracción es la llave de las personas que llegan a tu vida. Lo que atraes repite tu impronta más temprana, hasta que la ves.", practice: "Piensa en tres relaciones importantes. ¿Qué se repite en las tres?" },
  iq: { when: "Se forma en la adolescencia", deep: "El CI es tu manera de pensar los vínculos: cómo te explicas lo que sientes. Su sombra es usar la mente para no sentir.", practice: "La próxima vez que analices una relación, pregúntate qué sientes debajo." },
  eq: { when: "Se forma en la infancia", deep: "El CE es cuánta emoción aguantas sin huir. Aquí se abre la intimidad: estar con la emoción del otro sin arreglarla.", practice: "Quédate un minuto con una emoción incómoda, sin hacer nada con ella." },
  sq: { when: "Se forma en los primeros años", deep: "El CS es tu inteligencia espiritual: la confianza básica en la vida. Une el pensar y el sentir en algo más hondo.", practice: "Recuerda un momento de tu infancia en que te sentiste a salvo. Quédate ahí." },
  core: { when: "La raíz de todo", deep: "El Núcleo es la herida más honda, de cuando aprendiste si el mundo te sostenía. Es también tu mayor don: la misma llave, vivida al revés.", practice: "Escribe una carta corta a la niña que fuiste. Sin consejos: solo compañía." },
};

/* --------------------------------------------------------------- cálculos */

/** La esfera de la alumna donde está cada llave (la primera), para pintarla del color de su secuencia. */
function sphereColors(c: LayerCtx["c"]) {
  const out = new Map<number, string>();
  if (!c) return out;
  for (const s of SPHERES) {
    const n = c.geneKeys.keys[s.id];
    if (n && !out.has(n)) out.set(n, TONE[s.sequence].base);
  }
  return out;
}
const spheresWith = (c: LayerCtx["c"], n: number) => (c ? SPHERES.filter((s) => c.geneKeys.keys[s.id] === n) : []);
const sphereOf = (option: string | null) => (option && SPHERE_BY_ID[option] ? option : "lifework");

/** El cielo de hoy: la llave del Sol, de la Tierra y de la Luna, y cuánto les queda en ella. */
function todayKeys() {
  const t = activationsAt(new Date());
  const left = (b: TodayBody, speed: number) => {
    const a = t[b];
    const end = norm(gateStart(a.gate) + 5.625 - a.lon);
    return end / speed;
  };
  return Object.fromEntries(TODAY_BODIES.map((b) => [b, { ...t[b], left: left(b, TODAY_SPEED[b]) }])) as Record<TodayBody, (typeof t)[TodayBody] & { left: number }>;
}
const untilLabel = (days: number, body: TodayBody) => {
  if (body === "moon") return `unas ${Math.max(1, Math.round(days * 24))} horas más`;
  const d = new Date(Date.now() + days * 86400000);
  return `hasta el ${d.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`;
};

/* ------------------------------------------------------------ piezas */

export function gk2Keys(layer: Gk2Layer): string[] {
  if (layer === "gk-shadows") return SHADOW_KEYS;
  if (layer === "gk-venus") return SEQ_KEYS;
  return LAYER_KEYS[layer];
}

export function gk2Mine(layer: Gk2Layer, { c }: LayerCtx): string[] {
  if (!c) return [];
  const keys = new Set(Object.values(c.geneKeys.keys));
  switch (layer) {
    case "gk-codons":
      return CODON_RINGS.filter((r) => r.keys.some((k) => keys.has(k))).map((r) => r.id);
    case "gk-partners":
      return LAYER_KEYS["gk-partners"].filter((k) => keys.has(Number(k)) || keys.has(partnerOf(Number(k))));
    case "gk-wheel":
      return [...keys].map(String);
    case "gk-venus":
      return [];
    case "gk-shadows":
      return myKeys(c).map((n) => `${n}:repressive`);
    case "gk-today": {
      const t = todayKeys();
      return TODAY_BODIES.filter((b) => keys.has(t[b].gate) || keys.has(partnerOf(t[b].gate)));
    }
    default:
      return [];
  }
}

export function gk2Piece(layer: Gk2Layer, key: string, { c, notes }: LayerCtx): SystemPiece {
  switch (layer) {
    case "gk-codons": {
      const r = RING_BY_ID.get(key)!;
      const mine = c ? r.keys.filter((n) => spheresWith(c, n).length) : [];
      return {
        glyph: "",
        name: r.name,
        kicker: `${r.keys.length === 1 ? "Una llave" : `${r.keys.length} llaves`}: ${r.keys.join(", ")}`,
        meaning: `${r.theme}\n\nLos anillos de codones agrupan las llaves que dan el mismo aminoácido: son familias químicas. Lo que una llave del anillo vive, resuena en las demás.\n\n${r.keys.map((n) => `${n}: ${KEY_BY_N.get(n)!.shadow} → ${KEY_BY_N.get(n)!.gift} → ${KEY_BY_N.get(n)!.siddhi}`).join("\n")}`,
        personal: c ? (mine.length ? `Tienes de este anillo: ${listEs(mine.map((n) => `la llave ${n} en tu ${listEs(spheresWith(c, n).map((s) => s.name))}`))}.` : "No tienes llaves de este anillo en tu perfil.") : null,
      };
    }
    case "gk-partners": {
      const a = Number(key);
      const b = partnerOf(a);
      const ka = KEY_BY_N.get(a)!;
      const kb = KEY_BY_N.get(b)!;
      const sa = spheresWith(c, a);
      const sb = spheresWith(c, b);
      return {
        glyph: `${a}·${b}`,
        name: `Llaves ${a} y ${b}`,
        kicker: `${ka.gift} y ${kb.gift}`,
        meaning: `Las compañeras de programación están una enfrente de la otra en la rueda. Son como las dos caras de una misma lección: cuando una se abre, la otra la acompaña.\n\n${a}: ${ka.shadow} → ${ka.gift} → ${ka.siddhi}.\n${b}: ${kb.shadow} → ${kb.gift} → ${kb.siddhi}.\n\nSi tienes una de las dos, contempla también la otra: es su llave de equilibrio.`,
        personal: !c ? null : sa.length || sb.length ? [sa.length ? `La ${a} está en tu ${listEs(sa.map((s) => s.name))}.` : "", sb.length ? `La ${b} está en tu ${listEs(sb.map((s) => s.name))}.` : ""].filter(Boolean).join(" ") + (sa.length && sb.length ? " Tienes las dos: se equilibran solas." : ` Su compañera es tu llave de equilibrio.`) : "No tienes ninguna de las dos en tu perfil.",
      };
    }
    case "gk-wheel": {
      const n = Number(key);
      const k = KEY_BY_N.get(n)!;
      const where = spheresWith(c, n);
      const idx = WHEEL.indexOf(n);
      const sign = SIGNS[Math.floor(norm(gateStart(n)) / 30)];
      return {
        glyph: String(n),
        name: `Llave ${n} · ${k.gift}`,
        kicker: `${k.shadow} → ${k.gift} → ${k.siddhi}`,
        meaning: `En la rueda, las 64 llaves siguen el zodiaco: la ${n} empieza en ${sign.name} y es la ${idx + 1}.ª desde la llave 41, la del comienzo. Enfrente está su compañera, la ${partnerOf(n)}. Pertenece al ${ringOf(n).name.toLowerCase()}.`,
        personal: c ? (where.length ? `Es tu ${listEs(where.map((s) => `${s.name} (línea ${c.geneKeys.lines[s.id]})`))}.` : "No está en tu perfil.") : null,
      };
    }
    case "gk-shadows": {
      const { n, face } = parseFace(key, myKeys(c)[0] ?? 1);
      const fc = SHADOW_FACES[face];
      const k = KEY_BY_N.get(n)!;
      const own = notes?.[`${n}:${face}`]?.trim();
      const general: Record<Face, string> = {
        repressive: `En la llave ${n}, la sombra de ${k.shadow.toLowerCase()} vuelta hacia dentro: se siente, pero se esconde, incluso de una misma.`,
        reactive: `En la llave ${n}, la sombra de ${k.shadow.toLowerCase()} vuelta hacia fuera: sale en reacciones y en lo que se le echa a los demás.`,
        gift: `En la llave ${n}, cuando ves la ${k.shadow.toLowerCase()} sin taparla ni echarla fuera, aparece su don: ${k.gift.toLowerCase()}.`,
      };
      const where = spheresWith(c, n);
      return {
        glyph: String(n),
        name: `${fc.name} · llave ${n}`,
        kicker: `${fc.kicker} · sombra: ${k.shadow}`,
        meaning: `${own || general[face]}\n\n${fc.meaning}`,
        personal: c ? (where.length ? `Es tu llave de ${listEs(where.map((x) => x.name))}.` : "No está en tu perfil hologenético.") : null,
      };
    }
    case "gk-today": {
      const t = todayKeys();
      const b = key as TodayBody;
      const a = t[b];
      const k = KEY_BY_N.get(a.gate)!;
      const where = spheresWith(c, a.gate);
      const partner = spheresWith(c, partnerOf(a.gate));
      return {
        glyph: HD_BODY_GLYPH[b] + VS,
        name: `${HD_BODY_ES[b]} hoy: llave ${a.gate}.${a.line}`,
        kicker: `${k.shadow} → ${k.gift} → ${k.siddhi} · ${untilLabel(a.left, b)}`,
        meaning: `${TODAY_TEXT[b]}\n\nHoy va por la línea ${a.line}: ${GK_LINES[a.line - 1].name.toLowerCase()}.`,
        personal: !c ? null : where.length ? `Hoy toca tu ${listEs(where.map((s) => s.name))}: es un buen día para contemplarla.` : partner.length ? `Hoy activa la compañera de tu ${listEs(partner.map((s) => s.name))} (llave ${partnerOf(a.gate)}): la equilibra.` : "Hoy no toca ninguna de tus esferas.",
      };
    }
    case "gk-venus": {
      // Las 3 secuencias a fondo: «venus:attraction».
      const [q, id] = (key.includes(":") ? key.split(":") : ["venus", key]) as [SequenceId, string];
      const sp = SPHERE_BY_ID[id];
      const role = sp.sequence !== q && sp.also?.sequence === q ? sp.also : null;
      const d = q === "venus" ? VENUS_DEPTH[id] : SEQ_DEPTH[q][id];
      const path = SEQ_PATHS[q];
      const step = path.indexOf(id);
      const k = c ? KEY_BY_N.get(c.geneKeys.keys[id]) : null;
      return {
        glyph: k ? String(k.n) : String(step + 1),
        name: `${step + 1}. ${role?.name ?? sp.name}`,
        kicker: `${SEQUENCE_BY_ID[q].name} · paso ${step + 1} de ${path.length} · ${d?.when ?? ""} · ${sp.source}`,
        meaning: `${d?.deep ?? role?.meaning ?? sp.meaning}\n\nContempla: ${role?.contemplation ?? sp.contemplation}${d ? `\n\nPráctica: ${d.practice}` : ""}`,
        personal: k ? `Tu llave ${k.n}.${c!.geneKeys.lines[id]}: de ${k.shadow} a ${k.gift} y ${k.siddhi}.` : null,
      };
    }
  }
  return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
}

/* ------------------------------------------------------------ dibujos */

export function Gk2Diagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: Gk2Layer }) {
  const c = ctx.c;
  const own = new Set(mine);
  const colors = useMemo(() => sphereColors(c), [c]);
  const today = useMemo(() => (layer === "gk-today" ? todayKeys() : null), [layer]);
  switch (layer) {
    case "gk-codons": {
      const ring = RING_BY_ID.get(selected)!;
      return (
        <NightPanel>
          <KeyWheel
            fill={(n) => (ring.keys.includes(n) ? ringHue(ring.id) : null)}
            mark={(n) => colors.has(n)}
            onKey={(n) => tap(ringOf(n).id, ringOf(n).name)}
            chords={ring.keys.length > 1 ? ring.keys.map((n, i) => [n, ring.keys[(i + 1) % ring.keys.length]] as [number, number]).slice(0, ring.keys.length === 2 ? 1 : undefined) : []}
            chordColor={ringHue(ring.id)}
            center={{ top: "ANILLO", big: String(ring.keys.length), bottom: ring.name.replace("Anillo ", "").toUpperCase() }}
          />
          <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}><Tr s={"Toca una llave para ver su anillo · con punto, las de tu perfil"} /></p>
        </NightPanel>
      );
    }
    case "gk-partners": {
      const a = Number(selected);
      const b = partnerOf(a);
      return (
        <NightPanel>
          <KeyWheel
            fill={(n) => (n === a || n === b ? "gold" : (colors.get(n) ?? null))}
            mark={() => false}
            onKey={(n) => {
              const k = keys.includes(String(n)) ? n : partnerOf(n);
              return tap(String(k), `Llaves ${k} y ${partnerOf(k)}`);
            }}
            chords={[...mine.filter((k) => k !== selected).map((k) => [Number(k), partnerOf(Number(k))] as [number, number])]}
            chordColor="rgb(251 246 236 / .25)"
            strong={[a, b]}
            center={{ top: "COMPAÑERAS", big: `${a}·${b}`, bottom: `${KEY_BY_N.get(a)!.gift} · ${KEY_BY_N.get(b)!.gift}`.toUpperCase() }}
          />
          <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}><Tr s={"En color, tus llaves (por secuencia) · cada línea une una pareja tuya"} /></p>
        </NightPanel>
      );
    }
    case "gk-wheel": {
      const n = Number(selected);
      return (
        <NightPanel>
          <KeyWheel fill={(k) => (k === n ? "gold" : (colors.get(k) ?? null))} mark={() => false} onKey={(k) => tap(String(k), `Llave ${k}`)} chords={[]} strong={[n, partnerOf(n)]} center={{ top: "LLAVE", big: String(n), bottom: KEY_BY_N.get(n)!.gift.toUpperCase() }} zodiac />
          <SeqLegend />
        </NightPanel>
      );
    }
    case "gk-shadows":
      return (
        <NightPanel>
          <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <KeyGrid selected={parseFace(selected, myKeys(c)[0] ?? 1).n} colorOf={(x) => colors.get(x) ?? null} tapKey={(x) => tap(`${x}:${parseFace(selected, 1).face}`, `Llave ${x}`)} legend="En color, tus llaves (por secuencia)" />
            <ShadowBalance selected={parseFace(selected, 1).face} n={parseFace(selected, myKeys(c)[0] ?? 1).n} tap={(fc, l) => tap(`${parseFace(selected, myKeys(c)[0] ?? 1).n}:${fc}`, l)} />
          </div>
        </NightPanel>
      );
    case "gk-today": {
      const t = today!;
      const sel = t[selected as TodayBody];
      return (
        <NightPanel>
          <KeyWheel
            fill={(k) => (k === sel.gate ? "gold" : (colors.get(k) ?? null))}
            mark={(k) => TODAY_BODIES.some((b) => t[b].gate === k)}
            onKey={(k) => {
              const b = TODAY_BODIES.find((x) => t[x].gate === k);
              return b ? tap(b, `${HD_BODY_ES[b]} hoy`) : {};
            }}
            chords={[]}
            bodies={TODAY_BODIES.map((b) => ({ lon: t[b].lon, glyph: HD_BODY_GLYPH[b] + VS, on: b === selected }))}
            center={{ top: "HOY", big: String(sel.gate), bottom: KEY_BY_N.get(sel.gate)!.gift.toUpperCase() }}
            zodiac
          />
          <NightChips items={TODAY_BODIES.map((b) => ({ key: b, label: `${HD_BODY_GLYPH[b]}${VS} ${HD_BODY_ES[b]} · ${t[b].gate}.${t[b].line}` }))} selected={selected} mine={own} tap={tap} />
        </NightPanel>
      );
    }
    case "gk-venus": {
      // Las 3 secuencias sobre el Camino Dorado: la elegida encendida y su esfera en oro.
      const [q, id] = (selected.includes(":") ? selected.split(":") : ["venus", selected]) as [SequenceId, string];
      return (
        <GkNightPanel>
          <SequenceLegend active={q} onPick={(x) => tap(`${x}:${SEQ_PATHS[x][0]}`, SEQUENCE_BY_ID[x].name)} />
          <GoldenPath
            c={c}
            lit={(sp) => SEQ_PATHS[q].includes(sp.id)}
            selected={(sp) => sp.id === id}
            onSphere={(sp) => (SEQ_PATHS[q].includes(sp.id) ? tap(`${q}:${sp.id}`, nameIn(sp, q)) : tap(`${sp.sequence}:${sp.id}`, sp.name))}
          />
          <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}>
            {SEQ_PATHS[q].map((x, i) => `${i + 1}. ${nameIn(SPHERE_BY_ID[x], q)}`).join(" · ")}
          </p>
        </GkNightPanel>
      );
    }
  }
  return null;
}

function SeqLegend() {
  return (
    <div className="flex flex-wrap justify-center gap-3 pb-1 text-[0.66rem]" style={{ color: "rgb(251 246 236 / .75)" }}>
      {(["activation", "venus", "pearl"] as SequenceId[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE[s].base }} /> {SEQUENCE_BY_ID[s].name.replace("Secuencia de ", "").replace("la ", "")}
        </span>
      ))}
    </div>
  );
}

/** La rueda de las 64 llaves (como el mandala de Human Design: la 41 empieza en 2° de Acuario). */
function KeyWheel({
  fill,
  mark,
  onKey,
  chords,
  chordColor = NIGHT_GOLD,
  strong,
  center,
  zodiac = true,
  bodies = [],
}: {
  fill: (n: number) => string | null;
  mark: (n: number) => boolean;
  onKey: (n: number) => Record<string, unknown>;
  chords: [number, number][];
  chordColor?: string;
  strong?: [number, number];
  center: { top: string; big: string; bottom: string };
  zodiac?: boolean;
  bodies?: { lon: number; glyph: string; on: boolean }[];
}) {
  const t = useT();
  const p = usePrefix();
  const mid = (n: number) => gateStart(n) + 2.8;
  const R1 = 104;
  const R2 = zodiac ? 140 : 156;
  return (
    // Con planetas (la llave de hoy), la rueda deja sitio fuera para que no toquen el zodiaco.
    <svg viewBox={bodies.length ? "-26 -26 392 392" : "0 0 340 340"} className="mx-auto block h-auto w-full max-w-[46rem] select-none" role="group" aria-label={t("La rueda de las 64 llaves")}>
      <NightDefs p={p} />
      <circle cx={C} cy={C} r="160" fill="rgb(212 181 122 / .04)" stroke="#D4B57A" strokeOpacity="0.6" strokeWidth="0.8" />
      {zodiac &&
        SIGNS.map((s, i) => {
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
      {zodiac && <DegreeTicks r={142} />}
      {chords.map(([a, b], i) => {
        const x = pt(mid(a), R1 - 2);
        const y = pt(mid(b), R1 - 2);
        return <line key={i} x1={x.x} y1={x.y} x2={y.x} y2={y.y} stroke={chordColor} strokeWidth="1.2" strokeOpacity="0.8" pointerEvents="none" />;
      })}
      {strong && (() => {
        const x = pt(mid(strong[0]), R1 - 2);
        const y = pt(mid(strong[1]), R1 - 2);
        return <line x1={x.x} y1={x.y} x2={y.x} y2={y.y} stroke={NIGHT_GOLD} strokeWidth="1.6" strokeDasharray="4 3" pointerEvents="none" />;
      })()}
      {WHEEL.map((n) => {
        const s = gateStart(n);
        const f = fill(n);
        const gold = f === "gold";
        const q = pt(s + 2.8, (R1 + R2) / 2);
        const m = pt(s + 2.8, R1 + 5);
        return (
          <g key={n} {...onKey(n)}>
            <path d={sector(s, s + 5.625, R1, gold ? R2 + 4 : R2)} fill={gold ? `url(#${p}gold)` : (f ?? (n % 2 ? "rgb(255 255 255 / .05)" : "rgb(255 255 255 / .09)"))} fillOpacity={f && !gold ? 0.9 : 1} stroke="rgb(255 255 255 / .16)" strokeWidth="0.5" />
            <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={zodiac ? 6.4 : 7.2} fontWeight={f ? 700 : 500} fill={gold ? NIGHT : STAR}>
              {n}
            </text>
            {mark(n) && <circle cx={m.x} cy={m.y} r="2" fill={NIGHT_GOLD} pointerEvents="none" />}
          </g>
        );
      })}
      {bodies.map((b, i) => {
        const q = pt(b.lon, 178);
        return (
          <g key={i} pointerEvents="none">
            <circle cx={q.x} cy={q.y} r={b.on ? 9 : 7.5} fill={b.on ? `url(#${p}gold)` : NIGHT} stroke={NIGHT_GOLD} strokeWidth="1" />
            <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize="9" fill={b.on ? NIGHT : STAR}>
              <Tr s={b.glyph} />
            </text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r="62" fill={NIGHT} stroke="rgb(233 204 142 / .5)" pointerEvents="none" />
      <text x={C} y={C - 30} textAnchor="middle" fontSize="7.5" letterSpacing="1.4" fill={NIGHT_GOLD} pointerEvents="none">
        <Tr s={center.top} />
      </text>
      <text x={C} y={C - 4} textAnchor="middle" dominantBaseline="central" fontSize={center.big.length > 3 ? 22 : 30} fontFamily="Georgia, serif" fill={NIGHT_GOLD} pointerEvents="none">
        <Tr s={center.big} />
      </text>
      <text x={C} y={C + 24} textAnchor="middle" fontSize={center.bottom.length > 22 ? 6 : 7.5} letterSpacing="0.8" fill={STAR} pointerEvents="none">
        <Tr s={center.bottom} />
      </text>
    </svg>
  );
}

/** La sombra como una balanza: hacia dentro (azul, izquierda), hacia fuera (rojo, derecha) y el don arriba, en medio. */
function ShadowBalance({ selected, tap, n }: { selected: Face; tap: Tap; n: number }) {
  const t = useT();
  const p = usePrefix();
  const k = KEY_BY_N.get(n) ?? null;
  const tilt = selected === "repressive" ? -9 : selected === "reactive" ? 9 : 0;
  const dy = 100 * Math.sin((tilt * Math.PI) / 180);
  const POS: Record<Face, { x: number; y: number }> = { repressive: { x: 70, y: 214 - dy }, reactive: { x: 270, y: 214 + dy }, gift: { x: 170, y: 70 } };
  return (
    <svg viewBox="0 0 340 320" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label={t("Las dos caras de la sombra")}>
      <NightDefs p={p} />
      <Stars w={340} h={320} n={30} />
      <text x="170" y="22" textAnchor="middle" fontSize="8.5" letterSpacing="1.4" fill="rgb(251 246 236 / .65)">
        {k ? `LLAVE ${k.n} · SOMBRA: ${k.shadow.toUpperCase()}` : t("LA SOMBRA")}
      </text>
      {/* El fiel y el brazo de la balanza, que se inclina hacia la cara elegida. */}
      <line x1="170" y1="106" x2="170" y2="262" stroke="rgb(233 204 142 / .55)" strokeWidth="2" />
      <polygon points="150,276 190,276 170,258" fill="rgb(233 204 142 / .4)" />
      <g transform={`rotate(${tilt} 170 170)`} style={{ transition: "transform .5s ease" }}>
        <line x1="70" y1="170" x2="270" y2="170" stroke={NIGHT_GOLD} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="70" y1="170" x2="70" y2="190" stroke="rgb(233 204 142 / .5)" />
        <line x1="270" y1="170" x2="270" y2="190" stroke="rgb(233 204 142 / .5)" />
      </g>
      <circle cx="170" cy="170" r="22" fill={NIGHT} stroke="rgb(233 204 142 / .6)" />
      <text x="170" y="171" textAnchor="middle" dominantBaseline="central" fontSize={k && k.shadow.length > 9 ? 6.5 : 7.5} fill={STAR} pointerEvents="none">
        {k ? k.shadow.toUpperCase() : t("SOMBRA")}
      </text>
      {(Object.keys(POS) as Face[]).map((f) => {
        const { x, y } = POS[f];
        const on = selected === f;
        const face = SHADOW_FACES[f];
        const word = f === "gift" ? (k?.gift ?? "Don") : f === "repressive" ? "Hacia dentro" : "Hacia fuera";
        return (
          <g key={f} {...tap(f, face.name)} style={{ transition: "transform .5s ease" }}>
            {on && <circle cx={x} cy={y} r="46" fill={`url(#${p}goldglow)`} />}
            <circle cx={x} cy={y} r="36" fill={on ? (f === "gift" ? `url(#${p}gold)` : face.color) : "#1D1D20"} stroke={face.color} strokeWidth="2" />
            <text x={x} y={y - 6} textAnchor="middle" dominantBaseline="central" fontSize="8" letterSpacing="1" fill={on ? NIGHT : face.color} fontWeight="700">
              {f === "gift" ? t("DON") : f === "repressive" ? t("REPRIMIDA") : t("REACTIVA")}
            </text>
            <text x={x} y={y + 9} textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill={on ? NIGHT : STAR}>
              <Tr s={word} />
            </text>
          </g>
        );
      })}
      <text x="70" y={268 - dy} textAnchor="middle" fontSize="7.5" fill="rgb(251 246 236 / .55)"><Tr s={"callar · encogerse"} /></text>
      <text x="270" y={268 + dy} textAnchor="middle" fontSize="7.5" fill="rgb(251 246 236 / .55)"><Tr s={"reaccionar · culpar"} /></text>
    </svg>
  );
}

/** La Secuencia de Venus como un descenso: del Propósito, arriba, al Núcleo, en lo más hondo. */
function VenusWell({ selected, tap, c }: { selected: string; tap: Tap; c: LayerCtx["c"] }) {
  const t = useT();
  const p = usePrefix();
  const T = TONE.venus;
  const pos = VENUS_PATH.map((id, i) => ({ id, x: i === 0 ? 170 : i % 2 ? 110 : 230, y: 46 + i * 56 }));
  pos[5].x = 170;
  return (
    <svg viewBox="0 0 340 380" className="mx-auto block h-auto w-full max-w-[24rem] select-none" role="group" aria-label={t("La Secuencia de Venus")}>
      <NightDefs p={p} />
      <Stars w={340} h={380} n={32} />
      <path d={`M170 20 C 330 120, 10 220, 170 370`} fill="none" stroke={T.line} strokeOpacity="0.12" strokeWidth="60" strokeLinecap="round" />
      {pos.slice(1).map((q, i) => (
        <line key={q.id} x1={pos[i].x} y1={pos[i].y} x2={q.x} y2={q.y} stroke={T.line} strokeWidth="1.6" strokeOpacity="0.7" strokeDasharray={i === 0 ? "3 4" : undefined} />
      ))}
      {pos.map((q, i) => {
        const on = q.id === selected;
        const s = SPHERE_BY_ID[q.id];
        const n = c?.geneKeys.keys[q.id];
        const line = c?.geneKeys.lines[q.id];
        const isPurpose = i === 0;
        const label = (isPurpose ? s.name : s.name).toUpperCase();
        const side = q.x < 170 ? -1 : 1;
        return (
          <g key={q.id} {...tap(q.id, s.name)}>
            {on && <circle cx={q.x} cy={q.y} r="32" fill={`url(#${p}goldglow)`} />}
            <circle cx={q.x} cy={q.y} r="22" fill={on ? `url(#${p}gold)` : isPurpose ? TONE.activation.deep : T.deep} stroke={on ? "#FFF3D4" : isPurpose ? TONE.activation.line : T.light} strokeWidth="1.6" />
            <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={n ? 12 : 10} fontWeight="700" fill={on ? NIGHT : STAR}>
              {n ? `${n}.${line}` : i}
            </text>
            <text x={q.x === 170 ? q.x + 30 : q.x + side * 30} y={q.y - 4} textAnchor={q.x === 170 ? "start" : side < 0 ? "end" : "start"} fontSize="8.5" letterSpacing="1" fontWeight={on ? 700 : 500} fill={on ? NIGHT_GOLD : STAR}>
              <Tr s={label} />
            </text>
            <text x={q.x === 170 ? q.x + 30 : q.x + side * 30} y={q.y + 9} textAnchor={q.x === 170 ? "start" : side < 0 ? "end" : "start"} fontSize="7.5" fill="rgb(251 246 236 / .6)">
              {VENUS_DEPTH[q.id].when}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
