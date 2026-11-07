/**
 * Partes de las lecciones largas (además de texto, archivo y vídeo; lib/lesson-parts.ts):
 *   · CHAPTER  → empieza un capítulo: la lección se lee capítulo a capítulo, con su índice y su tiempo;
 *   · MODEL    → un modelo deconstruido por partes: de la carta astral (signos, casas, planetas, aspectos o
 *                elementos), del bodygraph (centros o las seis líneas del perfil), de las Gene Keys (las
 *                esferas del Camino Dorado o el espectro sombra-don-siddhi) o de la Luna (sus ocho fases).
 *                Se toca una pieza y se lee, con el texto de la dueña;
 *   · MYCHART  → «Tu Marte»: ese planeta en la carta de la alumna (signo, casa y aspectos);
 *   · TODAY    → «Marte hoy»: dónde está hoy ese planeta y qué toca de su carta;
 *   · QUIZ     → repaso: preguntas con varias respuestas y su explicación;
 *   · GLOSSARY → las palabras nuevas de la lección.
 * Su contenido va en LessonPart.data (JSON). Puro (solo zod): lo usan el editor, el reproductor y lib/lessons.ts.
 */
import { z } from "zod";

export const BLOCK_KINDS = ["CHAPTER", "MODEL", "MYCHART", "TODAY", "QUIZ", "GLOSSARY"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const isBlockKind = (k: string): k is BlockKind => (BLOCK_KINDS as readonly string[]).includes(k);

export const BLOCK_LABEL: Record<BlockKind, string> = {
  CHAPTER: "Capítulo",
  MODEL: "Modelo por partes",
  MYCHART: "En tu carta",
  TODAY: "Hoy en el cielo",
  QUIZ: "Repaso",
  GLOSSARY: "Glosario",
};

export const ASTRO_LAYERS = [
  "signs", "houses", "planets", "aspects", "elements", "modalities", "angles",
  "hd-centres", "hd-gates", "hd-channels", "hd-planets", "hd-types", "hd-authorities", "hd-lines", "hd-profiles",
  "gk-spheres", "gk-sequences", "gk-keys", "gk-spectrum", "gk-lines",
  "moon-phases", "moon-signs", "moon-houses", "moon-nodes",
  "rune-aettir", "rune-spreads",
] as const;
export type AstroLayer = (typeof ASTRO_LAYERS)[number];
export const ASTRO_LAYER_LABEL: Record<AstroLayer, string> = {
  signs: "Los 12 signos",
  houses: "Las 12 casas",
  planets: "Los planetas y puntos",
  aspects: "Los aspectos",
  elements: "Los 4 elementos",
  modalities: "Las 3 cualidades",
  angles: "Los 4 ángulos",
  "hd-centres": "Los 9 centros del bodygraph",
  "hd-gates": "Las 64 puertas",
  "hd-channels": "Los 36 canales",
  "hd-planets": "Los planetas a cada lado",
  "hd-types": "Los 5 tipos",
  "hd-authorities": "Las 7 autoridades",
  "hd-lines": "Las 6 líneas del perfil",
  "hd-profiles": "Los 12 perfiles",
  "gk-spheres": "Las esferas del Camino Dorado",
  "gk-sequences": "Las 3 secuencias, por colores",
  "gk-keys": "Las 64 llaves",
  "gk-spectrum": "Sombra, don y siddhi",
  "gk-lines": "Las 6 líneas de cada esfera",
  "moon-phases": "Las 8 fases de la Luna",
  "moon-signs": "La Luna en los 12 signos",
  "moon-houses": "La Luna en las 12 casas",
  "moon-nodes": "Los nodos lunares",
  "rune-aettir": "Las 24 runas y sus 3 aettir",
  "rune-spreads": "Las posiciones de cada tirada",
};

export const LAYER_SYSTEMS = ["Astrología", "Human Design", "Gene Keys", "Luna", "Runas"] as const;
export type LayerSystem = (typeof LAYER_SYSTEMS)[number];

/** De qué sistema es cada capa (el editor las agrupa así). */
export const LAYER_SYSTEM = Object.fromEntries(
  ASTRO_LAYERS.map((l) => [l, l.startsWith("hd-") ? "Human Design" : l.startsWith("gk-") ? "Gene Keys" : l.startsWith("moon-") ? "Luna" : l.startsWith("rune-") ? "Runas" : "Astrología"]),
) as Record<AstroLayer, LayerSystem>;

/**
 * Las configuraciones de cada capa (la dueña elige una en el editor): qué piezas se ven o desde qué
 * mirada se leen. La primera es la de siempre. Las capas sin lista no tienen configuración.
 */
export const LAYER_OPTIONS: Partial<Record<AstroLayer, { value: string; label: string }[]>> = {
  "hd-gates": [
    { value: "all", label: "Las 64 puertas" },
    { value: "mine", label: "Solo las activadas en su carta" },
    { value: "head", label: "Solo las de la Cabeza" },
    { value: "ajna", label: "Solo las de Ajna" },
    { value: "throat", label: "Solo las de la Garganta" },
    { value: "g", label: "Solo las del centro G" },
    { value: "heart", label: "Solo las del Corazón" },
    { value: "spleen", label: "Solo las del Bazo" },
    { value: "sacral", label: "Solo las del Sacro" },
    { value: "solar", label: "Solo las del Plexo Solar" },
    { value: "root", label: "Solo las de la Raíz" },
  ],
  "hd-channels": [
    { value: "all", label: "Los 36 canales" },
    { value: "mine", label: "Solo los definidos en su carta" },
    { value: "individual", label: "Circuito individual" },
    { value: "tribal", label: "Circuito tribal" },
    { value: "collective", label: "Circuito colectivo" },
    { value: "integration", label: "Canales de integración" },
  ],
  "hd-planets": [
    { value: "both", label: "Los dos lados (26 activaciones)" },
    { value: "personality", label: "Solo la personalidad (negro)" },
    { value: "design", label: "Solo el diseño (rojo)" },
  ],
  "gk-spheres": [
    { value: "all", label: "Las 11 esferas" },
    { value: "activation", label: "Secuencia de Activación (verde)" },
    { value: "venus", label: "Secuencia de Venus (rojo)" },
    { value: "pearl", label: "Secuencia de la Perla (azul)" },
  ],
  "gk-keys": [
    { value: "all", label: "Las 64 llaves" },
    { value: "mine", label: "Solo las de su perfil" },
  ],
  "gk-spectrum": [
    { value: "lifework", label: "En su Obra de vida" },
    { value: "evolution", label: "En su Evolución" },
    { value: "radiance", label: "En su Irradiación" },
    { value: "purpose", label: "En su Propósito" },
    { value: "attraction", label: "En su Atracción" },
    { value: "iq", label: "En su CI" },
    { value: "eq", label: "En su CE" },
    { value: "sq", label: "En su CS" },
    { value: "core", label: "En su Núcleo" },
    { value: "culture", label: "En su Cultura" },
    { value: "pearl", label: "En su Perla" },
  ],
  "moon-signs": [
    { value: "natal", label: "La Luna natal en cada signo" },
    { value: "sky", label: "La Luna del día en cada signo" },
    { value: "new", label: "La Luna nueva en cada signo" },
    { value: "full", label: "La Luna llena en cada signo" },
  ],
  "rune-aettir": [
    { value: "all", label: "Las 24 runas" },
    { value: "0", label: "Aett de Freyr (1-8)" },
    { value: "1", label: "Aett de Hagal (9-16)" },
    { value: "2", label: "Aett de Tyr (17-24)" },
  ],
  "rune-spreads": [
    { value: "three", label: "Tres runas" },
    { value: "five", label: "Cinco runas (la cruz)" },
    { value: "one", label: "Una runa" },
  ],
};

/** La configuración de una capa: la guardada si vale para esa capa; si no, la primera. */
export function layerOption(layer: AstroLayer, option: string | null | undefined): string | null {
  const list = LAYER_OPTIONS[layer];
  if (!list) return null;
  return option && list.some((o) => o.value === option) ? option : list[0].value;
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}
/** Los 36 canales («1-8»), las 26 activaciones («p-sun» personalidad, «d-moon» diseño) y las 24 runas. */
const HD_CHANNEL_KEYS = ["47-64", "24-61", "4-63", "17-62", "23-43", "11-56", "16-48", "20-57", "10-20", "20-34", "10-57", "10-34", "34-57", "7-31", "1-8", "13-33", "35-36", "12-22", "21-45", "25-51", "5-15", "2-14", "29-46", "26-44", "37-40", "27-50", "32-54", "28-38", "18-58", "42-53", "3-60", "9-52", "6-59", "19-49", "39-55", "30-41"];
export const HD_SIDE_BODIES = ["sun", "earth", "northNode", "southNode", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
const RUNE_IDS = ["fehu", "uruz", "thurisaz", "ansuz", "raidho", "kenaz", "gebo", "wunjo", "hagalaz", "naudiz", "isa", "jera", "eihwaz", "perthro", "algiz", "sowilo", "tiwaz", "berkano", "ehwaz", "mannaz", "laguz", "ingwaz", "dagaz", "othala"];

/** Planetas y puntos que puede tener una lección (los de la carta). */
export const FOCUS_BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "node", "lilith"] as const;
export type FocusBody = (typeof FOCUS_BODIES)[number];
export const FOCUS_BODY_LABEL: Record<FocusBody, string> = {
  sun: "Sol", moon: "Luna", mercury: "Mercurio", venus: "Venus", mars: "Marte", jupiter: "Júpiter", saturn: "Saturno",
  uranus: "Urano", neptune: "Neptuno", pluto: "Plutón", chiron: "Quirón", node: "Nodo Norte", lilith: "Lilith",
};

/**
 * Las piezas de cada capa del modelo, en orden, con su clave en `notes` (el texto que escribe la dueña
 * para esa pieza en esta lección: «Marte en Aries…»).
 */
export const LAYER_KEYS: Record<AstroLayer, string[]> = {
  signs: Array.from({ length: 12 }, (_, i) => String(i)),
  houses: Array.from({ length: 12 }, (_, i) => String(i + 1)),
  planets: [...FOCUS_BODIES],
  aspects: ["conjunction", "sextile", "square", "trine", "quincunx", "opposition"],
  elements: ["Fuego", "Tierra", "Aire", "Agua"],
  modalities: ["cardinal", "fijo", "mutable"],
  angles: ["asc", "ic", "dsc", "mc"],
  "hd-centres": ["head", "ajna", "throat", "g", "heart", "spleen", "sacral", "solar", "root"],
  "hd-gates": range(1, 64),
  "hd-channels": HD_CHANNEL_KEYS,
  "hd-planets": [...HD_SIDE_BODIES.map((b) => `d-${b}`), ...HD_SIDE_BODIES.map((b) => `p-${b}`)],
  "hd-types": ["generator", "mg", "manifestor", "projector", "reflector"],
  "hd-authorities": ["solar", "sacral", "spleen", "heart", "g", "mental", "lunar"],
  "hd-lines": range(1, 6),
  "hd-profiles": ["1/3", "1/4", "2/4", "2/5", "3/5", "3/6", "4/6", "4/1", "5/1", "5/2", "6/2", "6/3"],
  "gk-spheres": ["lifework", "evolution", "radiance", "purpose", "attraction", "iq", "eq", "sq", "core", "culture", "pearl"],
  "gk-sequences": ["activation", "venus", "pearl"],
  "gk-keys": range(1, 64),
  "gk-spectrum": ["shadow", "gift", "siddhi"],
  "gk-lines": range(1, 6),
  "moon-phases": range(0, 7),
  "moon-signs": range(0, 11),
  "moon-houses": range(1, 12),
  "moon-nodes": range(0, 11),
  "rune-aettir": RUNE_IDS,
  "rune-spreads": ["one-0", "three-0", "three-1", "three-2", "five-0", "five-1", "five-2", "five-3", "five-4"],
};

const TEXT_MAX = 4000;
const short = (n: number) => z.string().trim().max(n);
const focus = z.enum(FOCUS_BODIES);

export const chapterSchema = z.object({ title: short(140).min(1, "Pon un título a cada capítulo"), minutes: z.number().int().min(0).max(600).nullable().default(null) });
export const modelSchema = z.object({
  layer: z.enum(ASTRO_LAYERS),
  /** La configuración de la capa (LAYER_OPTIONS): qué piezas se ven o desde qué mirada se leen. */
  option: z.string().trim().max(20).nullable().default(null),
  focus: focus.nullable().default(null),
  title: short(140).default(""),
  intro: short(TEXT_MAX).default(""),
  notes: z.record(z.string().max(20), short(TEXT_MAX)).default({}),
});
export const myChartSchema = z.object({ focus, title: short(140).default("") });
export const todaySchema = z.object({ focus, title: short(140).default("") });
export const quizSchema = z.object({
  questions: z
    .array(z.object({ q: short(400).min(1, "Escribe cada pregunta"), options: z.array(short(200)).min(2).max(6), answer: z.number().int().min(0).max(5), why: short(1000).default("") }))
    .min(1, "Añade al menos una pregunta")
    .max(20),
});
export const glossarySchema = z.object({ terms: z.array(z.object({ term: short(80).min(1), def: short(600).min(1) })).min(1, "Añade al menos una palabra").max(60) });

export type ChapterData = z.infer<typeof chapterSchema>;
export type ModelData = z.infer<typeof modelSchema>;
export type MyChartData = z.infer<typeof myChartSchema>;
export type TodayData = z.infer<typeof todaySchema>;
export type QuizData = z.infer<typeof quizSchema>;
export type GlossaryData = z.infer<typeof glossarySchema>;

export type BlockDataMap = { CHAPTER: ChapterData; MODEL: ModelData; MYCHART: MyChartData; TODAY: TodayData; QUIZ: QuizData; GLOSSARY: GlossaryData };
export type BlockPart = { [K in BlockKind]: { kind: K; data: BlockDataMap[K] } }[BlockKind];

const SCHEMAS: { [K in BlockKind]: z.ZodType<BlockDataMap[K], z.ZodTypeDef, unknown> } = {
  CHAPTER: chapterSchema,
  MODEL: modelSchema,
  MYCHART: myChartSchema,
  TODAY: todaySchema,
  QUIZ: quizSchema,
  GLOSSARY: glossarySchema,
} as never;

/** Valida el contenido de una parte nueva. Quita las notas vacías y las respuestas fuera de rango. */
export function parseBlock(kind: BlockKind, data: unknown): { ok: true; part: BlockPart } | { ok: false; error: string } {
  const r = SCHEMAS[kind].safeParse(data);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message || `Revisa la parte «${BLOCK_LABEL[kind]}»` };
  const d = r.data as BlockDataMap[BlockKind];
  if (kind === "MODEL") {
    const m = d as ModelData;
    m.notes = Object.fromEntries(Object.entries(m.notes).filter(([k, v]) => LAYER_KEYS[m.layer].includes(k) && /\S/.test(v)));
  }
  if (kind === "QUIZ") for (const q of (d as QuizData).questions) if (q.answer >= q.options.length) return { ok: false, error: "Marca la respuesta correcta de cada pregunta" };
  return { ok: true, part: { kind, data: d } as BlockPart };
}

/** Lee lo guardado (LessonPart.data): si no es válido, null (la parte no se pinta). */
export function readBlock<K extends BlockKind>(kind: K, data: unknown): BlockDataMap[K] | null {
  const r = parseBlock(kind, data);
  return r.ok ? (r.part.data as BlockDataMap[K]) : null;
}

/** Contenido inicial de cada parte nueva en el editor. */
export function emptyBlock(kind: BlockKind): BlockPart {
  switch (kind) {
    case "CHAPTER":
      return { kind, data: { title: "", minutes: null } };
    case "MODEL":
      return { kind, data: { layer: "houses", option: null, focus: null, title: "", intro: "", notes: {} } };
    case "MYCHART":
      return { kind, data: { focus: "sun", title: "" } };
    case "TODAY":
      return { kind, data: { focus: "sun", title: "" } };
    case "QUIZ":
      return { kind, data: { questions: [{ q: "", options: ["", ""], answer: 0, why: "" }] } };
    case "GLOSSARY":
      return { kind, data: { terms: [{ term: "", def: "" }] } };
  }
}

export type LessonChapter<P> = { title: string; minutes: number | null; parts: P[] };

/**
 * Parte la lección por sus capítulos: lo que va antes del primero es la entrada. Sin capítulos, null
 * (la lección se ve entera, como siempre).
 */
export function splitChapters<P extends { kind?: string; data?: unknown }>(parts: P[]): { intro: P[]; chapters: LessonChapter<P>[] } | null {
  if (!parts.some((p) => p.kind === "CHAPTER")) return null;
  const intro: P[] = [];
  const chapters: LessonChapter<P>[] = [];
  for (const p of parts) {
    if (p.kind === "CHAPTER") {
      const d = readBlock("CHAPTER", p.data);
      chapters.push({ title: d?.title ?? "Capítulo", minutes: d?.minutes ?? null, parts: [] });
    } else if (chapters.length) chapters[chapters.length - 1].parts.push(p);
    else intro.push(p);
  }
  return { intro, chapters };
}
