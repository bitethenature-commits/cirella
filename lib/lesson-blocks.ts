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

export const BLOCK_KINDS = ["CHAPTER", "MODEL", "CHART", "MYCHART", "TODAY", "QUIZ", "GLOSSARY"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const isBlockKind = (k: string): k is BlockKind => (BLOCK_KINDS as readonly string[]).includes(k);

export const BLOCK_LABEL: Record<BlockKind, string> = {
  CHAPTER: "Capítulo",
  MODEL: "Modelo por partes",
  CHART: "Carta a mano",
  MYCHART: "En tu carta",
  TODAY: "Hoy en el cielo",
  QUIZ: "Repaso",
  GLOSSARY: "Glosario",
};

export const ASTRO_LAYERS = [
  "signs", "houses", "planets", "aspects", "elements", "modalities", "angles",
  "astro-dignities", "astro-rulers", "astro-axes", "astro-hemis", "astro-patterns", "astro-points", "astro-retro",
  "astro-decans", "astro-cycles", "astro-transits", "astro-progress", "astro-synastry", "astro-balance", "astro-balance-compare", "astro-retro-dates", "astro-combos",
  "hd-centres", "hd-gates", "hd-channels", "hd-planets", "hd-types", "hd-authorities", "hd-lines", "hd-profiles",
  "hd-circuits", "hd-definition", "hd-cross", "hd-variables", "hd-gate-lines", "hd-mandala", "hd-conditioning", "hd-defined", "hd-pairs", "hd-kinds", "hd-transits", "hd-partner",
  "gk-spheres", "gk-sequences", "gk-keys", "gk-spectrum", "gk-lines",
  "gk-codons", "gk-partners", "gk-wheel", "gk-shadows", "gk-today", "gk-venus",
  "moon-phases", "moon-signs", "moon-houses", "moon-nodes",
  "moon-full13", "moon-eclipses", "moon-void", "moon-transit-houses", "moon-return", "moon-apsides", "moon-mansions", "moon-node-cycle",
  "rune-aettir", "rune-spreads",
  "rune-reversed", "rune-elements", "rune-big-spreads", "rune-binds", "rune-yggdrasil",
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
  "astro-dignities": "Dignidades de los planetas",
  "astro-rulers": "Regencias",
  "astro-axes": "Los 6 ejes",
  "astro-hemis": "Hemisferios y cuadrantes",
  "astro-patterns": "Figuras de aspectos",
  "astro-points": "Puntos especiales",
  "astro-retro": "Planetas retrógrados",
  "astro-decans": "Los 36 decanatos",
  "astro-cycles": "Los ciclos de la vida",
  "astro-transits": "Tránsitos de hoy",
  "astro-progress": "Revolución solar y progresiones",
  "astro-synastry": "Sinastría: dos cartas",
  "astro-balance": "Tu balance de elementos y cualidades",
  "astro-balance-compare": "Tu balance comparado con otra persona",
  "astro-retro-dates": "Los retrógrados, fecha a fecha",
  "astro-combos": "Planeta + signo + casa",
  "hd-centres": "Los 9 centros del bodygraph",
  "hd-gates": "Las 64 puertas",
  "hd-channels": "Los 36 canales",
  "hd-planets": "Los planetas a cada lado",
  "hd-types": "Los 5 tipos",
  "hd-authorities": "Las 7 autoridades",
  "hd-lines": "Las 6 líneas del perfil",
  "hd-profiles": "Los 12 perfiles",
  "hd-circuits": "Los circuitos",
  "hd-definition": "La definición",
  "hd-cross": "La cruz de encarnación",
  "hd-variables": "Las 4 variables (flechas)",
  "hd-gate-lines": "Las 6 líneas de una puerta",
  "hd-mandala": "El mandala de las 64 puertas",
  "hd-conditioning": "Centros abiertos y condicionamiento",
  "hd-defined": "Centros definidos",
  "hd-pairs": "Parejas de chakras",
  "hd-kinds": "Clasificación de los centros",
  "hd-transits": "Tránsitos de hoy en tu bodygraph",
  "hd-partner": "En pareja: dos bodygraphs",
  "gk-spheres": "Las esferas del Camino Dorado",
  "gk-sequences": "Las 3 secuencias, por colores",
  "gk-keys": "Las 64 llaves",
  "gk-spectrum": "Sombra, don y siddhi",
  "gk-lines": "Las 6 líneas de cada esfera",
  "gk-codons": "Los 21 anillos de codones",
  "gk-partners": "Las 32 compañeras de programación",
  "gk-wheel": "La rueda de las 64 llaves",
  "gk-shadows": "Las dos caras de la sombra",
  "gk-today": "Tu llave de hoy",
  "gk-venus": "Las 3 secuencias a fondo",
  "moon-phases": "Las 8 fases de la Luna",
  "moon-signs": "La Luna en los 12 signos",
  "moon-houses": "La Luna en las 12 casas",
  "moon-nodes": "Los nodos lunares",
  "moon-full13": "Las lunas llenas del año",
  "moon-eclipses": "Los eclipses",
  "moon-void": "La Luna fuera de curso",
  "moon-transit-houses": "La Luna de hoy por tus casas",
  "moon-return": "Tu retorno lunar",
  "moon-apsides": "Perigeo, apogeo y superlunas",
  "moon-mansions": "Las 28 mansiones lunares",
  "moon-node-cycle": "El ciclo de los nodos (18,6 años)",
  "rune-aettir": "Las 24 runas y sus 3 aettir",
  "rune-spreads": "Las posiciones de cada tirada",
  "rune-reversed": "Las runas invertidas",
  "rune-elements": "Las runas por elemento y por dios",
  "rune-big-spreads": "Tiradas grandes: nueve runas y la cruz",
  "rune-binds": "Las runas ligadas",
  "rune-yggdrasil": "Yggdrasil: los nueve mundos",
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
  "hd-planets": [
    { value: "both", label: "Los dos lados (26 activaciones)" },
    { value: "personality", label: "Solo la personalidad (negro)" },
    { value: "design", label: "Solo el diseño (rojo)" },
  ],
  "gk-keys": [
    { value: "all", label: "Las 64 llaves" },
    { value: "mine", label: "Solo las de su perfil" },
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
  "rune-elements": [
    { value: "elements", label: "Por elemento" },
    { value: "gods", label: "Por dios o diosa" },
  ],
  "rune-big-spreads": [
    { value: "nine", label: "Nueve runas" },
    { value: "cross", label: "La cruz rúnica (seis)" },
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

/** Las 64 puertas en el orden de la rueda (el mandala), desde la 41 en 2° de Acuario. */
const MANDALA = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60];

/** Los diez planetas (del Sol a Plutón): las piezas de varias capas de astrología. */
export const TEN_PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;

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
  "astro-dignities": [...TEN_PLANETS],
  "astro-rulers": range(0, 11),
  "astro-axes": range(0, 5),
  "astro-hemis": ["south", "north", "east", "west", "q1", "q2", "q3", "q4"],
  "astro-patterns": ["grand-trine", "t-square", "grand-cross", "yod", "kite", "stellium"],
  "astro-points": ["chiron", "lilith", "node", "southNode", "fortune"],
  "astro-retro": ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"],
  "astro-decans": range(0, 35),
  "astro-cycles": ["nodes", "jupiter", "saturn", "uranus", "chiron", "saturn2"],
  "astro-transits": [...TEN_PLANETS],
  "astro-progress": ["sr", "p-sun", "p-moon"],
  "astro-synastry": [...TEN_PLANETS],
  "astro-balance": ["Fuego", "Tierra", "Aire", "Agua", "cardinal", "fijo", "mutable"],
  "astro-balance-compare": ["Fuego", "Tierra", "Aire", "Agua", "cardinal", "fijo", "mutable"],
  "astro-retro-dates": ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"],
  // Los textos de la dueña: cada planeta en cada signo («s:mars:7») y en cada casa («h:mars:3»).
  "astro-combos": [...TEN_PLANETS, "chiron", "lilith"].flatMap((p) => [...range(0, 11).map((s) => `s:${p}:${s}`), ...range(1, 12).map((h) => `h:${p}:${h}`)]),
  "hd-centres": ["head", "ajna", "throat", "g", "heart", "spleen", "sacral", "solar", "root"],
  "hd-gates": range(1, 64),
  "hd-channels": HD_CHANNEL_KEYS,
  "hd-planets": [...HD_SIDE_BODIES.map((b) => `d-${b}`), ...HD_SIDE_BODIES.map((b) => `p-${b}`)],
  "hd-types": ["generator", "mg", "manifestor", "projector", "reflector"],
  "hd-authorities": ["solar", "sacral", "spleen", "heart", "g", "mental", "lunar"],
  "hd-lines": range(1, 6),
  "hd-circuits": ["individual", "tribal", "collective", "integration"],
  "hd-definition": ["none", "single", "split", "triple", "quadruple"],
  "hd-cross": ["p-sun", "p-earth", "d-sun", "d-earth"],
  "hd-variables": ["digestion", "environment", "motivation", "perspective"],
  "hd-gate-lines": range(1, 6),
  "hd-mandala": MANDALA.map(String),
  "hd-conditioning": ["head", "ajna", "throat", "g", "heart", "spleen", "sacral", "solar", "root"],
  "hd-defined": ["head", "ajna", "throat", "g", "heart", "spleen", "sacral", "solar", "root"],
  "hd-pairs": ["head-root", "ajna-sacral", "throat-spleen-solar"],
  "hd-kinds": ["motor", "awareness", "manifestation", "compass", "pressure"],
  "hd-transits": [...HD_SIDE_BODIES],
  "hd-partner": ["electromagnetic", "companionship", "dominance", "compromise"],
  "hd-profiles": ["1/3", "1/4", "2/4", "2/5", "3/5", "3/6", "4/6", "4/1", "5/1", "5/2", "6/2", "6/3"],
  "gk-spheres": ["lifework", "evolution", "radiance", "purpose", "attraction", "iq", "eq", "sq", "core", "culture", "pearl"],
  "gk-sequences": ["activation", "venus", "pearl"],
  "gk-keys": range(1, 64),
  "gk-spectrum": ["shadow", "gift", "siddhi"],
  "gk-lines": range(1, 6),
  "gk-codons": ["origin", "fire", "water", "life-death", "union", "light", "alchemy", "humanity", "trials", "purification", "seeking", "prosperity", "divinity", "destiny", "illusion", "gaia", "miracles", "matter", "no-return", "illuminati", "whirlwind"],
  "gk-partners": MANDALA.slice(0, 32).map(String),
  "gk-wheel": MANDALA.map(String),
  // Los textos de la dueña: la cara reprimida y la reactiva de cada llave («21:repressive»).
  "gk-shadows": range(1, 64).flatMap((n) => [`${n}:repressive`, `${n}:reactive`]),
  "gk-today": ["sun", "earth", "moon", "venus", "mars"],
  "gk-venus": [
    ...["lifework", "evolution", "radiance", "purpose"].map((x) => `activation:${x}`),
    ...["purpose", "attraction", "iq", "eq", "sq", "core"].map((x) => `venus:${x}`),
    ...["core", "culture", "lifework", "pearl"].map((x) => `pearl:${x}`),
  ],
  "moon-phases": range(0, 7),
  "moon-signs": range(0, 11),
  "moon-houses": range(1, 12),
  "moon-nodes": range(0, 11),
  "moon-full13": range(0, 12),
  "moon-eclipses": range(0, 7),
  "moon-void": range(0, 5),
  "moon-transit-houses": range(1, 12),
  "moon-return": range(0, 12),
  "moon-apsides": ["perigee", "apogee", "supermoon", "micromoon"],
  "moon-mansions": range(1, 28),
  "moon-node-cycle": range(1, 8),
  "rune-aettir": RUNE_IDS,
  "rune-reversed": RUNE_IDS.filter((r) => !["gebo", "hagalaz", "naudiz", "isa", "jera", "eihwaz", "sowilo", "ingwaz", "dagaz"].includes(r)),
  "rune-elements": ["fire", "ice", "water", "air", "earth", "odin", "vanir", "thor", "norns", "heimdall", "tyr", "sol", "frigg", "njord"],
  "rune-big-spreads": [...range(0, 8).map((i) => `nine-${i}`), ...range(0, 5).map((i) => `cross-${i}`)],
  "rune-binds": ["gibu-auja", "victory", "abundance", "protection", "safe-travel", "love", "home", "voice"],
  "rune-yggdrasil": ["asgard", "alfheim", "vanaheim", "muspelheim", "midgard", "niflheim", "jotunheim", "svartalfheim", "helheim"],
  "rune-spreads": ["one-0", "three-0", "three-1", "three-2", "five-0", "five-1", "five-2", "five-3", "five-4"],
};

const TEXT_MAX = 4000;
const short = (n: number) => z.string().trim().max(n);
const focus = z.enum(FOCUS_BODIES);

export const chapterSchema = z.object({ title: short(140).min(1, "Pon un título a cada capítulo"), minutes: z.number().int().min(0).max(600).nullable().default(null) });
/** Las versiones de cada modelo por partes: con cuál empieza (la alumna puede cambiar luego en la barra de modos). */
export const MODEL_MODES = ["explore", "mine", "today", "compare", "tour", "practice"] as const;
export type ModelMode = (typeof MODEL_MODES)[number];
export const MODEL_MODE_LABEL: Record<ModelMode, string> = {
  explore: "Explorar",
  mine: "Solo lo tuyo",
  today: "Hoy en el cielo",
  compare: "Comparar",
  tour: "Recorrido",
  practice: "Practicar",
};
export const MODEL_MODE_HINT: Record<ModelMode, string> = {
  explore: "Todas las piezas, para tocarlas libremente",
  mine: "Solo las piezas de la carta de la alumna",
  today: "Las piezas que el cielo de hoy tiene activas",
  compare: "Las suyas junto a las de otra persona guardada en «Mi energía»",
  tour: "El modelo avanza solo, pieza a pieza, como una clase",
  practice: "Preguntas para tocar la pieza correcta, con acierto o error",
};

/**
 * Los modos de una capa. En Human Design, solo Explorar y Practicar (y «Hoy en el cielo» en los centros y las
 * puertas). En astrología, sin el recorrido guiado, sin «Comparar» (la sinastría ya compara dos
 * cartas) y sin «Solo lo tuyo» («Explorar» ya va sobre la carta de la alumna).
 */
export function modesFor(layer: AstroLayer): readonly ModelMode[] {
  // Human Design: sin comparar, recorrido ni «Solo lo tuyo»; «Hoy en el cielo», solo en los 9 centros y las 64 puertas.
  if (LAYER_SYSTEM[layer] === "Human Design") return MODEL_MODES.filter((m) => m !== "tour" && m !== "compare" && m !== "mine" && (m !== "today" || layer === "hd-centres" || layer === "hd-gates"));
  // Gene Keys: sin comparar, recorrido ni «Solo lo tuyo»; «Hoy en el cielo», solo en las 64 llaves y en tu llave de hoy.
  if (LAYER_SYSTEM[layer] === "Gene Keys") return MODEL_MODES.filter((m) => m !== "tour" && m !== "compare" && m !== "mine" && (m !== "today" || layer === "gk-keys" || layer === "gk-today"));
  if (LAYER_SYSTEM[layer] !== "Astrología") return MODEL_MODES;
  // Los balances y los tránsitos de hoy (que ya son el cielo de hoy) no tienen «Hoy en el cielo».
  const noToday = layer === "astro-balance" || layer === "astro-balance-compare" || layer === "astro-transits";
  return MODEL_MODES.filter((m) => m !== "tour" && m !== "compare" && m !== "mine" && !(noToday && m === "today"));
}

export const modelSchema = z.object({
  layer: z.enum(ASTRO_LAYERS),
  /** La configuración de la capa (LAYER_OPTIONS): qué piezas se ven o desde qué mirada se leen. */
  option: z.string().trim().max(20).nullable().default(null),
  focus: focus.nullable().default(null),
  title: short(140).default(""),
  intro: short(TEXT_MAX).default(""),
  notes: z.record(z.string().max(20), short(TEXT_MAX)).default({}),
  /** La versión con la que empieza (MODEL_MODES). */
  mode: z.enum(MODEL_MODES).default("explore"),
});
/**
 * «Carta a mano»: la carta natal completa, pero preparada por la dueña para la lección. Parte de una carta
 * (la de ejemplo o la de unos datos) y encima coloca a mano cualquier punto en el signo y el grado que quiera,
 * lo marca retrógrado o lo esconde; elige casas, nodos y aspectos, y puede dejarlos fijos para la alumna.
 * Cada punto puede llevar su texto. Lo pinta components/models/chart-model.tsx (prop `custom`).
 */
export const CUSTOM_POINTS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "node", "lilith", "asc", "mc"] as const;
export type CustomPoint = (typeof CUSTOM_POINTS)[number];
export const CHART_ASPECTS = ["conjunction", "sextile", "square", "trine", "quincunx", "opposition"] as const;
export const customBaseSchema = z.object({
  name: z.string().trim().max(60).default(""),
  date: z.string().regex(/^d{4}-d{2}-d{2}$/),
  time: z.string().regex(/^d{2}:d{2}$/),
  timeKnown: z.boolean().default(true),
  place: z.string().trim().max(120).default(""),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  tz: z.string().trim().min(1).max(60),
});
export const customChartSchema = z.object({
  title: short(140).default(""),
  intro: short(TEXT_MAX).default(""),
  /** El nombre que sale en la carta («Carta de la lección», «Una Luna en Cáncer»…). */
  name: z.string().trim().max(60).default(""),
  /** La carta de partida; null = la de ejemplo. */
  base: customBaseSchema.nullable().default(null),
  /** Longitud (0–360) de cada punto colocado a mano; los demás, como en la carta de partida. */
  positions: z.record(z.enum(CUSTOM_POINTS), z.number().min(0).lt(360)).default({}),
  /** Puntos colocados a mano que van retrógrados. */
  retro: z.array(z.enum(CUSTOM_POINTS)).max(20).default([]),
  /** Puntos que no se ven (el Sol, la Luna y los ángulos siempre se ven). */
  hidden: z.array(z.enum(CUSTOM_POINTS)).max(20).default([]),
  houseSystem: z.enum(["placidus", "whole", "equal"]).default("placidus"),
  node: z.enum(["mean", "true"]).default("mean"),
  aspects: z.array(z.enum(CHART_ASPECTS)).max(6).default([...CHART_ASPECTS]),
  /** Con casas y ejes (sin ellas, como una carta sin hora). */
  showHouses: z.boolean().default(true),
  /** La alumna no puede cambiar las casas ni los nodos. */
  lockSettings: z.boolean().default(false),
  /** El texto de la dueña para cada punto: sale al tocarlo. */
  notes: z.record(z.enum(CUSTOM_POINTS), short(TEXT_MAX)).default({}),
});
export type CustomChartData = z.infer<typeof customChartSchema>;

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

export type BlockDataMap = { CHAPTER: ChapterData; MODEL: ModelData; CHART: CustomChartData; MYCHART: MyChartData; TODAY: TodayData; QUIZ: QuizData; GLOSSARY: GlossaryData };
export type BlockPart = { [K in BlockKind]: { kind: K; data: BlockDataMap[K] } }[BlockKind];

const SCHEMAS: { [K in BlockKind]: z.ZodType<BlockDataMap[K], z.ZodTypeDef, unknown> } = {
  CHAPTER: chapterSchema,
  MODEL: modelSchema,
  CHART: customChartSchema,
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
      return { kind, data: { layer: "houses", option: null, focus: null, title: "", intro: "", notes: {}, mode: "explore" } };
    case "CHART":
      return { kind, data: customChartSchema.parse({}) };
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
