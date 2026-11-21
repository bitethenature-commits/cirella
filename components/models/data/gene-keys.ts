// Portado de la web antigua (src/content). Datos puros de los modelos interactivos.
/* -------------------------------------------------------------------------- *
 *  Gene Keys — las 64 llaves y el perfil hologenético.
 *
 *  Cada llave lleva la misma fuerza a tres frecuencias: sombra, don y siddhi.
 *  El perfil coloca once esferas sobre el Camino Dorado, agrupadas en las tres
 *  secuencias (Activación, Venus y Perla). Dos esferas son de dos secuencias a la
 *  vez: la Obra de vida es también la Marca de la Perla, y el Núcleo de Venus es
 *  también la Vocación de la Perla. El Propósito cierra la Activación y abre Venus.
 *
 *  La geometría y los caminos son los de la carta del perfil hologenético: la
 *  Obra de vida arriba, el triángulo de la Perla debajo, el racimo de Venus en
 *  el centro con la Irradiación y la Evolución a los lados, y el Propósito abajo.
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

/** Una esfera puede ser también una esfera de otra secuencia, con otro nombre. */
export interface SphereRole {
  sequence: SequenceId
  name: string
  /** Orden dentro de esa secuencia; sin él, la esfera es la puerta de entrada a la secuencia. */
  step?: number
  meaning?: string
  contemplation?: string
}

export interface Sphere {
  id: string
  name: string
  /** La secuencia principal de la esfera. */
  sequence: SequenceId
  /** Orden dentro de su secuencia, para el recorrido guiado. */
  step: number
  /** El otro papel de la esfera en otra secuencia (Marca, Vocación, la puerta de Venus). */
  also?: SphereRole
  /** Qué posición celeste alimenta esta esfera en un perfil real. */
  source: string
  /** De qué trata la esfera. */
  meaning: string
  /** La pregunta con la que sentarse. */
  contemplation: string
  /** Posición dentro del viewBox de la carta (GK_VIEWBOX). */
  x: number
  y: number
  /** De qué lado de la esfera van sus tres frecuencias en la carta: hacia fuera del centro. */
  side: "left" | "right"
}

/** Las once esferas del Camino Dorado, en su sitio en la carta. */
export const SPHERES: Sphere[] = [
  {
    id: "lifework",
    name: "Obra de vida",
    sequence: "activation",
    step: 1,
    also: {
      sequence: "pearl",
      name: "Marca",
      step: 3,
      meaning: "En la Perla es tu Marca: cómo aparece tu don hacia fuera, sin que tengas que explicarlo.",
      contemplation: "¿Para qué vienen a mí sin que yo lo pida?",
    },
    source: "Sol (consciente)",
    meaning: "Aquello por lo que te haces visible. Tu forma natural de expresarte en el mundo.",
    contemplation: "¿Qué hago sin que nadie me lo pida?",
    x: 445,
    y: 105,
    side: "right",
  },
  {
    id: "pearl",
    name: "Perla",
    sequence: "pearl",
    step: 4,
    source: "Júpiter (consciente)",
    meaning:
      "La simplificación. El punto en que la prosperidad deja de ser un objetivo y pasa a ser una consecuencia.",
    contemplation: "¿Qué podría quitar sin perder nada?",
    x: 445,
    y: 225,
    side: "right",
  },
  {
    id: "core",
    name: "Núcleo",
    sequence: "venus",
    step: 5,
    also: {
      sequence: "pearl",
      name: "Vocación",
      step: 1,
      meaning: "En la Perla es tu Vocación: el terreno en el que tu trabajo se vuelve ligero, porque encaja. La herida y la vocación son la misma llave.",
      contemplation: "¿Con qué se me olvida el tiempo?",
    },
    source: "Marte (inconsciente)",
    meaning:
      "La herida nuclear. El lugar donde empezó todo — y del que, invertido, sale tu mayor don.",
    contemplation: "¿Qué creí sobre mí a los siete años?",
    x: 345,
    y: 283,
    side: "left",
  },
  {
    id: "culture",
    name: "Cultura",
    sequence: "pearl",
    step: 2,
    source: "Júpiter (inconsciente)",
    meaning: "Las personas que sostienen tu obra. La prosperidad llega por vínculos, no por esfuerzo.",
    contemplation: "¿Quién se beneficia de verdad de que yo exista?",
    x: 547,
    y: 283,
    side: "right",
  },
  {
    id: "radiance",
    name: "Irradiación",
    sequence: "activation",
    step: 3,
    source: "Sol (inconsciente)",
    meaning:
      "Tu salud y tu vitalidad. No es algo que se practique: ocurre cuando las otras tres maduran.",
    contemplation: "¿Cuándo tuve energía por última vez sin forzarla?",
    x: 213,
    y: 340,
    side: "left",
  },
  {
    id: "sq",
    name: "CS",
    sequence: "venus",
    step: 4,
    source: "Venus (inconsciente)",
    meaning: "Inteligencia espiritual. El punto donde las otras dos se encuentran.",
    contemplation: "¿Qué queda cuando ni pienso ni siento?",
    x: 445,
    y: 340,
    side: "right",
  },
  {
    id: "evolution",
    name: "Evolución",
    sequence: "activation",
    step: 2,
    source: "Tierra (consciente)",
    meaning:
      "El desafío que te hace madurar. Vuelve una y otra vez hasta que entrega su don.",
    contemplation: "¿Qué dificultad regresa con toda fiabilidad a mi vida?",
    x: 678,
    y: 340,
    side: "right",
  },
  {
    id: "iq",
    name: "CI",
    sequence: "venus",
    step: 2,
    source: "Venus (consciente)",
    meaning: "Inteligencia mental. Cómo traduces la experiencia en comprensión.",
    contemplation: "¿Dónde pienso para no tener que sentir?",
    x: 345,
    y: 398,
    side: "left",
  },
  {
    id: "eq",
    name: "CE",
    sequence: "venus",
    step: 3,
    source: "Marte (consciente)",
    meaning: "Inteligencia emocional. Cuánto sentimiento aguantas sin huir.",
    contemplation: "¿Qué emoción evito con más fiabilidad?",
    x: 547,
    y: 398,
    side: "right",
  },
  {
    id: "attraction",
    name: "Atracción",
    sequence: "venus",
    step: 1,
    source: "Luna (inconsciente)",
    meaning:
      "El patrón que atraes en tus relaciones — y que viene de tu impronta más temprana.",
    contemplation: "¿Qué se repite en todas mis relaciones?",
    x: 445,
    y: 455,
    side: "right",
  },
  {
    id: "purpose",
    name: "Propósito",
    sequence: "activation",
    step: 4,
    also: {
      sequence: "venus",
      name: "Propósito",
      meaning: "Es también la puerta de Venus: de aquí sale el camino hacia la Atracción.",
    },
    source: "Tierra (inconsciente)",
    meaning:
      "El suelo firme bajo todo. No lo que debes hacer: aquello sobre lo que te apoyas mientras lo haces.",
    contemplation: "¿Qué sigue siendo verdad aunque todo lo demás cambie?",
    x: 445,
    y: 573,
    side: "right",
  },
]

export const SPHERE_BY_ID = Object.fromEntries(SPHERES.map((s) => [s.id, s])) as Record<
  string,
  Sphere
>

/** ¿Está la esfera en esta secuencia (como principal o con su otro papel)? */
export const inSequence = (s: Sphere, seq: SequenceId) => s.sequence === seq || s.also?.sequence === seq

/** Tamaño de la carta: el viewBox en el que viven las coordenadas de las esferas. */
export const GK_VIEWBOX = { x: 20, y: 30, w: 870, h: 630 }
/** El centro de la rueda de fondo (anillo del zodiaco y hexagramas). */
export const GK_CENTER = { x: 445, y: 340 }

export interface PathEdge {
  from: string
  to: string
  sequence: SequenceId
  /** Los caminos interiores (punteados en la carta). */
  dashed?: boolean
}

/** Los caminos de la carta, cada uno con el color de su secuencia. */
export const PATH_EDGES: PathEdge[] = [
  // Perla: el triángulo Obra de vida (Marca) – Núcleo (Vocación) – Cultura, y la Perla dentro
  { from: "lifework", to: "core", sequence: "pearl" },
  { from: "lifework", to: "culture", sequence: "pearl" },
  { from: "core", to: "culture", sequence: "pearl" },
  { from: "lifework", to: "pearl", sequence: "pearl", dashed: true },
  { from: "pearl", to: "core", sequence: "pearl", dashed: true },
  { from: "pearl", to: "culture", sequence: "pearl", dashed: true },
  // Activación: Obra de vida → Evolución, Irradiación → Propósito, y el eje Irradiación – Evolución
  { from: "lifework", to: "evolution", sequence: "activation" },
  { from: "radiance", to: "evolution", sequence: "activation", dashed: true },
  { from: "radiance", to: "purpose", sequence: "activation" },
  // Venus: del Núcleo al CS, al CE, al CI, a la Atracción y al Propósito
  { from: "core", to: "sq", sequence: "venus" },
  { from: "sq", to: "eq", sequence: "venus" },
  { from: "iq", to: "eq", sequence: "venus" },
  { from: "iq", to: "attraction", sequence: "venus" },
  { from: "attraction", to: "purpose", sequence: "venus" },
]

/** Un ejemplo trabajado (el perfil de Cirella), para que el modelo abra con algo que leer: llave y línea. */
export const EXAMPLE_PROFILE: Record<string, number> = {
  lifework: 54,
  pearl: 42,
  core: 18,
  culture: 42,
  radiance: 32,
  sq: 28,
  evolution: 53,
  iq: 30,
  eq: 34,
  attraction: 33,
  purpose: 42,
}

/** La línea (1–6) de cada llave en el ejemplo: 54.6 es la llave 54 en la línea 6. */
export const EXAMPLE_LINES: Record<string, number> = {
  lifework: 6,
  pearl: 1,
  core: 1,
  culture: 5,
  radiance: 2,
  sq: 5,
  evolution: 6,
  iq: 1,
  eq: 2,
  attraction: 1,
  purpose: 2,
}
