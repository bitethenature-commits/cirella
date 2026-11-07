/**
 * Partes de las lecciones largas (además de texto, archivo y vídeo; lib/lesson-parts.ts):
 *   · CHAPTER  → empieza un capítulo: la lección se lee capítulo a capítulo, con su índice y su tiempo;
 *   · MODEL    → el modelo de la carta deconstruido por partes (solo los signos, las casas, los planetas,
 *                los aspectos o los elementos): se toca una parte y se lee, con el texto de la dueña;
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

export const ASTRO_LAYERS = ["signs", "houses", "planets", "aspects", "elements"] as const;
export type AstroLayer = (typeof ASTRO_LAYERS)[number];
export const ASTRO_LAYER_LABEL: Record<AstroLayer, string> = {
  signs: "Los 12 signos",
  houses: "Las 12 casas",
  planets: "Los planetas y puntos",
  aspects: "Los aspectos",
  elements: "Los 4 elementos",
};

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
};

const TEXT_MAX = 4000;
const short = (n: number) => z.string().trim().max(n);
const focus = z.enum(FOCUS_BODIES);

export const chapterSchema = z.object({ title: short(140).min(1, "Pon un título a cada capítulo"), minutes: z.number().int().min(0).max(600).nullable().default(null) });
export const modelSchema = z.object({
  layer: z.enum(ASTRO_LAYERS),
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
      return { kind, data: { layer: "houses", focus: null, title: "", intro: "", notes: {} } };
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
