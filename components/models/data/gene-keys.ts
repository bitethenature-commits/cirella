// Portado de la web antigua (src/content). Datos puros de los modelos interactivos.
/* -------------------------------------------------------------------------- *
 *  Gene Keys — las 64 llaves y el perfil hologenético.
 *
 *  Cada llave lleva la misma fuerza a tres frecuencias: sombra, don y siddhi.
 *  El perfil coloca trece esferas sobre el Camino Dorado, agrupadas en las tres
 *  secuencias (Activación, Venus y Perla).
 *
 *  La geometría sigue la carta del perfil hologenético: arriba el rombo de la
 *  Activación (Irradiación, Obra de vida, Evolución, Propósito); del Propósito
 *  baja el camino a la Atracción y el rombo de Venus (CI, CE, CS) que se cierra
 *  en el Núcleo; del Núcleo, a la Vocación y el rombo de la Perla.
 *  Colores convencionales: Activación verde, Venus rojo, Perla azul.
 * -------------------------------------------------------------------------- */

export interface GeneKey {
  n: number
  shadow: string
  gift: string
  siddhi: string
}

/** Las 64 llaves, en su orden canónico. */
export const GENE_KEYS: GeneKey[] = [
  { n: 1, shadow: "Entropía", gift: "Frescura", siddhi: "Belleza" },
  { n: 2, shadow: "Desorientación", gift: "Orientación", siddhi: "Unidad" },
  { n: 3, shadow: "Caos", gift: "Innovación", siddhi: "Inocencia" },
  { n: 4, shadow: "Intolerancia", gift: "Comprensión", siddhi: "Perdón" },
  { n: 5, shadow: "Impaciencia", gift: "Paciencia", siddhi: "Atemporalidad" },
  { n: 6, shadow: "Conflicto", gift: "Diplomacia", siddhi: "Paz" },
  { n: 7, shadow: "División", gift: "Guía", siddhi: "Virtud" },
  { n: 8, shadow: "Mediocridad", gift: "Estilo", siddhi: "Exquisitez" },
  { n: 9, shadow: "Inercia", gift: "Determinación", siddhi: "Invencibilidad" },
  { n: 10, shadow: "Autonegación", gift: "Naturalidad", siddhi: "Ser" },
  { n: 11, shadow: "Oscurecimiento", gift: "Idealismo", siddhi: "Luz" },
  { n: 12, shadow: "Vanidad", gift: "Discernimiento", siddhi: "Pureza" },
  { n: 13, shadow: "Discordia", gift: "Discernimiento", siddhi: "Empatía" },
  { n: 14, shadow: "Compromiso", gift: "Competencia", siddhi: "Abundancia" },
  { n: 15, shadow: "Apatía", gift: "Magnetismo", siddhi: "Florecimiento" },
  { n: 16, shadow: "Indiferencia", gift: "Versatilidad", siddhi: "Maestría" },
  { n: 17, shadow: "Opinión", gift: "Amplitud de miras", siddhi: "Omnisciencia" },
  { n: 18, shadow: "Juicio", gift: "Integridad", siddhi: "Perfección" },
  { n: 19, shadow: "Codependencia", gift: "Sensibilidad", siddhi: "Sacrificio" },
  { n: 20, shadow: "Superficialidad", gift: "Seguridad", siddhi: "Presencia" },
  { n: 21, shadow: "Control", gift: "Autoridad", siddhi: "Valentía" },
  { n: 22, shadow: "Deshonra", gift: "Gracia", siddhi: "Gracia divina" },
  { n: 23, shadow: "Complejidad", gift: "Simplicidad", siddhi: "Quintaesencia" },
  { n: 24, shadow: "Adicción", gift: "Invención", siddhi: "Silencio" },
  { n: 25, shadow: "Constricción", gift: "Aceptación", siddhi: "Amor universal" },
  { n: 26, shadow: "Orgullo", gift: "Ingenio", siddhi: "Invisibilidad" },
  { n: 27, shadow: "Egoísmo", gift: "Altruismo", siddhi: "Desprendimiento" },
  { n: 28, shadow: "Sinsentido", gift: "Totalidad", siddhi: "Inmortalidad" },
  { n: 29, shadow: "Tibieza", gift: "Entrega", siddhi: "Despliegue" },
  { n: 30, shadow: "Deseo", gift: "Ligereza", siddhi: "Éxtasis" },
  { n: 31, shadow: "Arrogancia", gift: "Liderazgo", siddhi: "Humildad" },
  { n: 32, shadow: "Fracaso", gift: "Preservación", siddhi: "Veneración" },
  { n: 33, shadow: "Olvido", gift: "Atención", siddhi: "Revelación" },
  { n: 34, shadow: "Violencia", gift: "Vigor", siddhi: "Majestad" },
  { n: 35, shadow: "Hambre", gift: "Aventura", siddhi: "Ilimitación" },
  { n: 36, shadow: "Turbulencia", gift: "Humanidad", siddhi: "Compasión" },
  { n: 37, shadow: "Debilidad", gift: "Igualdad", siddhi: "Ternura" },
  { n: 38, shadow: "Lucha", gift: "Perseverancia", siddhi: "Honor" },
  { n: 39, shadow: "Provocación", gift: "Dinamismo", siddhi: "Liberación" },
  { n: 40, shadow: "Agotamiento", gift: "Resolución", siddhi: "Voluntad divina" },
  { n: 41, shadow: "Fantasía", gift: "Anticipación", siddhi: "Emanación" },
  { n: 42, shadow: "Expectativa", gift: "Desapego", siddhi: "Celebración" },
  { n: 43, shadow: "Sordera", gift: "Perspicacia", siddhi: "Epifanía" },
  { n: 44, shadow: "Interferencia", gift: "Trabajo en equipo", siddhi: "Sinarquía" },
  { n: 45, shadow: "Dominio", gift: "Sinergia", siddhi: "Comunión" },
  { n: 46, shadow: "Seriedad", gift: "Deleite", siddhi: "Éxtasis corporal" },
  { n: 47, shadow: "Opresión", gift: "Transmutación", siddhi: "Transfiguración" },
  { n: 48, shadow: "Insuficiencia", gift: "Ingenio", siddhi: "Sabiduría" },
  { n: 49, shadow: "Reacción", gift: "Revolución", siddhi: "Renacimiento" },
  { n: 50, shadow: "Corrupción", gift: "Equilibrio", siddhi: "Armonía" },
  { n: 51, shadow: "Agitación", gift: "Iniciativa", siddhi: "Despertar" },
  { n: 52, shadow: "Estrés", gift: "Contención", siddhi: "Quietud" },
  { n: 53, shadow: "Inmadurez", gift: "Expansión", siddhi: "Superabundancia" },
  { n: 54, shadow: "Codicia", gift: "Aspiración", siddhi: "Ascensión" },
  { n: 55, shadow: "Victimismo", gift: "Libertad", siddhi: "Libertad plena" },
  { n: 56, shadow: "Distracción", gift: "Enriquecimiento", siddhi: "Embriaguez" },
  { n: 57, shadow: "Inquietud", gift: "Intuición", siddhi: "Claridad" },
  { n: 58, shadow: "Insatisfacción", gift: "Vitalidad", siddhi: "Dicha" },
  { n: 59, shadow: "Deshonestidad", gift: "Intimidad", siddhi: "Transparencia" },
  { n: 60, shadow: "Limitación", gift: "Realismo", siddhi: "Justicia" },
  { n: 61, shadow: "Psicosis", gift: "Inspiración", siddhi: "Santidad" },
  { n: 62, shadow: "Intelecto", gift: "Precisión", siddhi: "Impecabilidad" },
  { n: 63, shadow: "Duda", gift: "Indagación", siddhi: "Verdad" },
  { n: 64, shadow: "Confusión", gift: "Imaginación", siddhi: "Iluminación" },
]

export const KEY_BY_N = new Map(GENE_KEYS.map((k) => [k.n, k]))

/* -------------------------------------------------------------------------- */

export type SequenceId = "activation" | "venus" | "pearl"

export interface Sequence {
  id: SequenceId
  name: string
  subtitle: string
  question: string
  hue: string
  description: string
}

export const SEQUENCES: Sequence[] = [
  {
    id: "activation",
    name: "Secuencia de Activación",
    subtitle: "Cuatro puntos · tu genio",
    question: "¿Quién soy?",
    hue: "#7DB08A",
    description:
      "El comienzo de todo recorrido. Cuatro esferas que describen juntas cómo te haces visible, en qué maduras, qué cambia por dentro y qué ocurre después por sí solo.",
  },
  {
    id: "venus",
    name: "Secuencia de Venus",
    subtitle: "Cinco esferas · tu corazón",
    question: "¿Para qué estoy aquí, con otros?",
    hue: "#CF6F66",
    description:
      "La más vulnerable de las tres. Recorre hacia atrás la atracción, la intimidad y los primeros siete años, hasta el punto en que aprendiste si el mundo te sostenía.",
  },
  {
    id: "pearl",
    name: "Secuencia de la Perla",
    subtitle: "Cuatro esferas · tu prosperidad",
    question: "¿De qué vivo?",
    hue: "#6F98D0",
    description:
      "La prosperidad como efecto secundario de la coherencia. Llega la última porque sin las otras dos secuencias no significa nada.",
  },
]

export const SEQUENCE_BY_ID = Object.fromEntries(SEQUENCES.map((s) => [s.id, s])) as Record<
  SequenceId,
  Sequence
>

export interface Sphere {
  id: string
  name: string
  sequence: SequenceId
  /** Qué posición celeste alimenta esta esfera en un perfil real. */
  source: string
  /** De qué trata la esfera. */
  meaning: string
  /** La pregunta con la que sentarse. */
  contemplation: string
  /** Posición dentro del viewBox de la carta (GK_VIEWBOX). */
  x: number
  y: number
  /** Orden dentro de su secuencia, para el recorrido guiado. */
  step: number
}

/** Las trece esferas del Camino Dorado. */
export const SPHERES: Sphere[] = [
  // ── Secuencia de Venus: de la Atracción al Núcleo ──────────────────────
  {
    id: "attraction",
    name: "Atracción",
    sequence: "venus",
    source: "Luna (inconsciente)",
    meaning:
      "El patrón que atraes en tus relaciones — y que viene de tu impronta más temprana.",
    contemplation: "¿Qué se repite en todas mis relaciones?",
    x: 380,
    y: 446,
    step: 1,
  },
  {
    id: "iq",
    name: "CI",
    sequence: "venus",
    source: "Venus (consciente)",
    meaning: "Inteligencia mental. Cómo traduces la experiencia en comprensión.",
    contemplation: "¿Dónde pienso para no tener que sentir?",
    x: 190,
    y: 546,
    step: 2,
  },
  {
    id: "eq",
    name: "CE",
    sequence: "venus",
    source: "Marte (consciente)",
    meaning: "Inteligencia emocional. Cuánto sentimiento aguantas sin huir.",
    contemplation: "¿Qué emoción evito con más fiabilidad?",
    x: 570,
    y: 546,
    step: 3,
  },
  {
    id: "sq",
    name: "CS",
    sequence: "venus",
    source: "Venus (inconsciente)",
    meaning: "Inteligencia espiritual. El punto donde las otras dos se encuentran.",
    contemplation: "¿Qué queda cuando ni pienso ni siento?",
    x: 380,
    y: 646,
    step: 4,
  },
  {
    id: "core",
    name: "Núcleo",
    sequence: "venus",
    source: "Marte (inconsciente)",
    meaning:
      "La herida nuclear. El lugar donde empezó todo — y del que, invertido, sale tu mayor don.",
    contemplation: "¿Qué creí sobre mí a los siete años?",
    x: 380,
    y: 806,
    step: 5,
  },

  // ── Rombo de la Activación, arriba ────────────────────────────────────
  {
    id: "radiance",
    name: "Irradiación",
    sequence: "activation",
    source: "Sol (inconsciente)",
    meaning:
      "Tu salud y tu vitalidad. No es algo que se practique: ocurre cuando las otras tres maduran.",
    contemplation: "¿Cuándo tuve energía por última vez sin forzarla?",
    x: 380,
    y: 66,
    step: 3,
  },
  {
    id: "purpose",
    name: "Propósito",
    sequence: "activation",
    source: "Tierra (inconsciente)",
    meaning:
      "El suelo firme bajo todo. No lo que debes hacer: aquello sobre lo que te apoyas mientras lo haces.",
    contemplation: "¿Qué sigue siendo verdad aunque todo lo demás cambie?",
    x: 380,
    y: 266,
    step: 4,
  },
  {
    id: "lifework",
    name: "Obra de vida",
    sequence: "activation",
    source: "Sol (consciente)",
    meaning: "Aquello por lo que te haces visible. Tu forma natural de expresarte en el mundo.",
    contemplation: "¿Qué hago sin que nadie me lo pida?",
    x: 150,
    y: 166,
    step: 1,
  },
  {
    id: "evolution",
    name: "Evolución",
    sequence: "activation",
    source: "Tierra (consciente)",
    meaning:
      "El desafío que te hace madurar. Vuelve una y otra vez hasta que entrega su don.",
    contemplation: "¿Qué dificultad regresa con toda fiabilidad a mi vida?",
    x: 610,
    y: 166,
    step: 2,
  },

  // ── Rombo de la Perla, abajo ──────────────────────────────────────────
  {
    id: "vocation",
    name: "Vocación",
    sequence: "pearl",
    source: "Marte (inconsciente) · la misma llave que el Núcleo",
    meaning: "El terreno en el que tu trabajo se vuelve ligero, porque encaja.",
    contemplation: "¿Con qué se me olvida el tiempo?",
    x: 380,
    y: 986,
    step: 1,
  },
  {
    id: "culture",
    name: "Cultura",
    sequence: "pearl",
    source: "Júpiter (inconsciente)",
    meaning: "Las personas que sostienen tu obra. La prosperidad llega por vínculos, no por esfuerzo.",
    contemplation: "¿Quién se beneficia de verdad de que yo exista?",
    x: 190,
    y: 1086,
    step: 2,
  },
  {
    id: "brand",
    name: "Marca",
    sequence: "pearl",
    source: "Sol (consciente) · la misma llave que la Obra de vida",
    meaning: "Cómo aparece tu don hacia fuera, sin que tengas que explicarlo.",
    contemplation: "¿Para qué vienen a mí sin que yo lo pida?",
    x: 570,
    y: 1086,
    step: 3,
  },
  {
    id: "pearl",
    name: "Perla",
    sequence: "pearl",
    source: "Júpiter (consciente)",
    meaning:
      "La simplificación. El punto en que la prosperidad deja de ser un objetivo y pasa a ser una consecuencia.",
    contemplation: "¿Qué podría quitar sin perder nada?",
    x: 380,
    y: 1186,
    step: 4,
  },
]

export const SPHERE_BY_ID = Object.fromEntries(SPHERES.map((s) => [s.id, s])) as Record<
  string,
  Sphere
>

/** Tamaño de la carta: el ancho y el alto del viewBox en el que viven las coordenadas de las esferas. */
export const GK_VIEWBOX = { w: 760, h: 1250 }

/**
 * Los caminos de la carta. Cada secuencia es un rombo con su cruz (en Venus, el rombo se cierra además
 * en el Núcleo), y dos caminos enlazan las secuencias: Propósito → Atracción y Núcleo → Vocación.
 * El orden solo cuenta para el dibujado (de arriba abajo).
 */
export const PATH_EDGES: Array<[string, string]> = [
  // Activación: Obra de vida → Evolución → Irradiación → Propósito, y el rombo que los encierra
  ["lifework", "evolution"],
  ["radiance", "lifework"],
  ["radiance", "evolution"],
  ["radiance", "purpose"],
  ["lifework", "purpose"],
  ["evolution", "purpose"],
  // De la Activación a Venus
  ["purpose", "attraction"],
  // Venus: Atracción → CI → CE → CS → Núcleo
  ["attraction", "iq"],
  ["attraction", "eq"],
  ["iq", "eq"],
  ["iq", "sq"],
  ["eq", "sq"],
  ["iq", "core"],
  ["eq", "core"],
  ["sq", "core"],
  // De Venus a la Perla
  ["core", "vocation"],
  // Perla: Vocación → Cultura → Marca → Perla
  ["vocation", "culture"],
  ["vocation", "brand"],
  ["culture", "brand"],
  ["vocation", "pearl"],
  ["culture", "pearl"],
  ["brand", "pearl"],
]

/** Un ejemplo trabajado, para que el modelo abra con algo que leer. */
export const EXAMPLE_PROFILE: Record<string, number> = {
  lifework: 44,
  evolution: 24,
  radiance: 43,
  purpose: 23,
  attraction: 25,
  iq: 17,
  eq: 22,
  sq: 51,
  core: 47,
  vocation: 47,
  culture: 13,
  brand: 44,
  pearl: 2,
}
