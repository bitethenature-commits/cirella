/**
 * «Oráculo de la Luna»: una baraja propia de 28 cartas, una por cada noche del ciclo. Cada carta tiene
 * un nombre, una palabra clave, un mensaje breve, una pregunta para quedarse pensando y un motivo que
 * se dibuja en código (components/models/oracle-model.tsx): lunas, geometría sagrada y signos sencillos.
 * Textos originales: no copian ninguna baraja comercial.
 */

export type OracleMotif =
  | { k: "moon"; phase: number }
  | { k: "eclipse" }
  | { k: "waves" }
  | { k: "rings" }
  | { k: "seed" }
  | { k: "mirror" }
  | { k: "star"; points: number }
  | { k: "arch" }
  | { k: "nest" }
  | { k: "spiral" }
  | { k: "flower" }
  | { k: "vesica" }
  | { k: "flame" }
  | { k: "rain" }
  | { k: "mountain" }
  | { k: "thread" }
  | { k: "eye" }
  | { k: "veil" }
  | { k: "constellation" }
  | { k: "chalice" }
  | { k: "hexagram" }
  | { k: "root" }
  | { k: "point" }
  | { k: "wheel" };

export type OracleCard = { id: string; name: string; keyword: string; message: string; question: string; motif: OracleMotif };

export const ORACLE_NAME = "Oráculo de la Luna";

export const ORACLE_CARDS: OracleCard[] = [
  {
    id: "luna-nueva", name: "La Luna Nueva", keyword: "Intención", motif: { k: "moon", phase: 0 },
    message: "En lo oscuro se siembra. No hace falta ver el camino entero para dar el primer paso: basta con saber hacia dónde miras.",
    question: "¿Qué quieres empezar a cuidar, aunque todavía no se vea?",
  },
  {
    id: "primer-hilo", name: "El Primer Hilo de Luz", keyword: "Comienzo", motif: { k: "moon", phase: 0.12 },
    message: "Una franja de luz basta para orientarse. Lo pequeño de hoy es el principio de algo.",
    question: "¿Cuál es el gesto más pequeño que puedes hacer hoy por lo que deseas?",
  },
  {
    id: "media-luna", name: "La Media Luna", keyword: "Decisión", motif: { k: "moon", phase: 0.25 },
    message: "Mitad luz, mitad sombra: es momento de elegir. Decidir también es renunciar, y está bien.",
    question: "¿Qué decisión estás aplazando, y qué te pide en realidad?",
  },
  {
    id: "luna-llena", name: "La Luna Llena", keyword: "Plenitud", motif: { k: "moon", phase: 0.5 },
    message: "Todo se ve. Lo que has cultivado se ilumina, y también lo que preferías no mirar. Celebra y observa.",
    question: "¿Qué se ha hecho visible para ti en estos días?",
  },
  {
    id: "menguante", name: "La Menguante", keyword: "Soltar", motif: { k: "moon", phase: 0.8 },
    message: "La luz se retira sin drama. Soltar no es perder: es hacer sitio.",
    question: "¿Qué puedes dejar ir con gratitud?",
  },
  {
    id: "eclipse", name: "El Eclipse", keyword: "Lo inesperado", motif: { k: "eclipse" },
    message: "Algo se interpone y cambia la luz por un momento. No dura para siempre, y deja ver lo que la claridad escondía.",
    question: "¿Qué te ha enseñado lo que no salió como esperabas?",
  },
  {
    id: "marea", name: "La Marea", keyword: "Ritmo", motif: { k: "waves" },
    message: "Sube y baja, y nunca se equivoca de hora. Tus ganas también tienen marea.",
    question: "¿En qué momento de tu propia marea estás ahora?",
  },
  {
    id: "pozo", name: "El Pozo", keyword: "Profundidad", motif: { k: "rings" },
    message: "Quizá lo que buscas fuera está abajo, en lo quieto. Baja despacio y escucha el eco.",
    question: "¿Qué sabes ya, en el fondo, que todavía no te has dicho?",
  },
  {
    id: "semilla", name: "La Semilla", keyword: "Paciencia", motif: { k: "seed" },
    message: "Lo que crece bien crece lento. Bajo la tierra también pasan cosas.",
    question: "¿Qué necesita más tiempo del que le estás dando?",
  },
  {
    id: "espejo", name: "El Espejo de Agua", keyword: "Reflejo", motif: { k: "mirror" },
    message: "Lo que te molesta de los demás a veces habla de ti; lo que admiras, también.",
    question: "¿Qué ves en otra persona que también vive en ti?",
  },
  {
    id: "estrella-polar", name: "La Estrella Polar", keyword: "Orientación", motif: { k: "star", points: 8 },
    message: "Cuando todo gira, hay un punto que no se mueve. Tus valores son esa estrella.",
    question: "¿Qué es lo que no quieres perder de vista?",
  },
  {
    id: "puerta", name: "La Puerta", keyword: "Umbral", motif: { k: "arch" },
    message: "Delante hay un paso. No tienes que cruzarlo hoy, pero sí puedes asomarte al otro lado.",
    question: "¿Qué te espera si te atreves a cruzar?",
  },
  {
    id: "nido", name: "El Nido", keyword: "Refugio", motif: { k: "nest" },
    message: "Descansar no es rendirse. Vuelve a lo que te sostiene antes de volver a salir.",
    question: "¿Dónde, y con quién, te sientes a salvo?",
  },
  {
    id: "espiral", name: "La Espiral", keyword: "Proceso", motif: { k: "spiral" },
    message: "Parece que vuelves al mismo lugar, pero lo miras desde un poco más arriba.",
    question: "¿Qué tema regresa a tu vida, y qué ha cambiado en ti desde la última vez?",
  },
  {
    id: "flor", name: "La Flor de la Vida", keyword: "Conexión", motif: { k: "flower" },
    message: "Nada crece a solas. Cada círculo toca a otros seis, y entre todos sostienen la forma.",
    question: "¿Qué vínculo te está nutriendo, y cuál pide más cuidado?",
  },
  {
    id: "vesica", name: "La Vesica", keyword: "Encuentro", motif: { k: "vesica" },
    message: "Donde dos se cruzan nace un tercer espacio. Escuchar es entrar en él.",
    question: "¿Qué podría nacer si dejaras de defender tu postura un momento?",
  },
  {
    id: "fuego", name: "El Fuego del Hogar", keyword: "Calor", motif: { k: "flame" },
    message: "Un fuego pequeño y bien cuidado calienta toda la casa. No necesitas arder.",
    question: "¿Qué te devuelve el calor cuando estás cansada?",
  },
  {
    id: "lluvia", name: "La Lluvia", keyword: "Limpieza", motif: { k: "rain" },
    message: "Lo que cae también limpia. Permítete llorar, o simplemente dejar que algo pase.",
    question: "¿Qué emoción pide salir sin que tengas que explicarla?",
  },
  {
    id: "montana", name: "La Montaña", keyword: "Constancia", motif: { k: "mountain" },
    message: "Paso a paso. La cima no se mueve, y tú tampoco tienes prisa.",
    question: "¿Qué paso te toca hoy, solo hoy?",
  },
  {
    id: "hilo-plata", name: "El Hilo de Plata", keyword: "Intuición", motif: { k: "thread" },
    message: "Un hilo fino te une a lo que sabes sin saber cómo. Tira de él con suavidad.",
    question: "¿Qué te dice el cuerpo antes de que la mente opine?",
  },
  {
    id: "lechuza", name: "La Lechuza", keyword: "Ver en la noche", motif: { k: "eye" },
    message: "Hay sabiduría en lo oscuro. No todo se entiende de día.",
    question: "¿Qué ves con claridad cuando todo está en silencio?",
  },
  {
    id: "velo", name: "El Velo", keyword: "Misterio", motif: { k: "veil" },
    message: "No todo tiene que desvelarse ya. Lo que aún se oculta también te protege.",
    question: "¿Puedes estar en paz sin saberlo todavía?",
  },
  {
    id: "constelacion", name: "La Constelación", keyword: "Sentido", motif: { k: "constellation" },
    message: "Puntos sueltos que, unidos, dibujan una figura. Tu historia también tiene forma.",
    question: "¿Qué hilo une lo que has vivido este año?",
  },
  {
    id: "caliz", name: "El Cáliz", keyword: "Recibir", motif: { k: "chalice" },
    message: "Ábrete a recibir: ayuda, cariño, descanso. Un cuenco vacío es un cuenco preparado.",
    question: "¿Qué te cuesta recibir sin devolverlo enseguida?",
  },
  {
    id: "dos-mareas", name: "Las Dos Mareas", keyword: "Equilibrio", motif: { k: "hexagram" },
    message: "Lo que sube y lo que baja se encuentran en el centro. Dar y recibir, hacer y descansar.",
    question: "¿Dónde estás dando más de lo que recibes, o al revés?",
  },
  {
    id: "raiz", name: "La Raíz", keyword: "Origen", motif: { k: "root" },
    message: "Vienes de algún lugar. Mirar atrás con cariño te da suelo para ir hacia delante.",
    question: "¿Qué te dieron tus raíces que quieres conservar?",
  },
  {
    id: "silencio", name: "El Silencio", keyword: "Pausa", motif: { k: "point" },
    message: "Entre dos notas está la música. Parar también es parte del camino.",
    question: "¿Qué pasaría si hoy no hicieras nada más?",
  },
  {
    id: "rueda", name: "La Rueda", keyword: "Ciclo", motif: { k: "wheel" },
    message: "Todo vuelve, pero nada vuelve igual. Estás en un ciclo, no en un círculo cerrado.",
    question: "¿Qué cierras para que otro ciclo pueda empezar?",
  },
];

export type OracleSpreadId = "one" | "three";

export const ORACLE_SPREADS: Record<OracleSpreadId, { label: string; positions: Array<{ name: string; hint: string }> }> = {
  one: { label: "Una carta", positions: [{ name: "Tu carta", hint: "Lo que la luna te propone mirar hoy." }] },
  three: {
    label: "Tres cartas",
    positions: [
      { name: "Situación", hint: "Cómo están las cosas ahora." },
      { name: "Consejo", hint: "Una forma de acompañarlo." },
      { name: "Resultado", hint: "Hacia dónde puede ir, si sigues el consejo." },
    ],
  },
};

/**
 * Una carta tal como la pinta el modelo: la de serie (arriba) o una de las barajas propias de la dueña
 * (Panel → Barajas, lib/oracle-decks.ts). Con imagen se ve la imagen; sin ella, un motivo dibujado.
 * `messageFormat`: "MD" = texto con formato (lib/rich-text.ts); null = texto sencillo (la de serie).
 */
export type OracleCardView = {
  id: string;
  name: string;
  keyword: string;
  message: string;
  messageFormat: "MD" | null;
  question: string;
  imageUrl: string | null;
  motif: OracleMotif;
  /** Puede salir invertida (con `reversedMessage`, o el mensaje de siempre si no lo tiene). */
  reversible: boolean;
  reversedMessage: string | null;
};

/** Una baraja lista para el modelo. `id` null = la de serie. */
export type OracleDeckView = {
  id: string | null;
  name: string;
  description: string | null;
  backImageUrl: string | null;
  cards: OracleCardView[];
};

/** Barajas propias por id: lo que la página carga en el servidor para sus bloques «Oráculo». */
export type OracleDecks = Record<string, OracleDeckView>;

/**
 * Motivo de una carta sin imagen: el de la carta de serie que eligió (por su id) o, si no eligió
 * ninguno, el de la misma posición en la baraja de serie (así cada carta lleva uno distinto).
 */
export function oracleMotifFor(key: string | null | undefined, index: number): OracleMotif {
  const byKey = key ? ORACLE_CARDS.find((c) => c.id === key) : undefined;
  return (byKey ?? ORACLE_CARDS[((index % ORACLE_CARDS.length) + ORACLE_CARDS.length) % ORACLE_CARDS.length]).motif;
}

/** El «Oráculo de la Luna» de serie como baraja del modelo (sin imágenes ni cartas invertidas). */
export const BUILTIN_ORACLE_DECK: OracleDeckView = {
  id: null,
  name: ORACLE_NAME,
  description: "Veintiocho cartas, una por cada noche del ciclo.",
  backImageUrl: null,
  cards: ORACLE_CARDS.map((c) => ({
    id: c.id,
    name: c.name,
    keyword: c.keyword,
    message: c.message,
    messageFormat: null,
    question: c.question,
    imageUrl: null,
    motif: c.motif,
    reversible: false,
    reversedMessage: null,
  })),
};
