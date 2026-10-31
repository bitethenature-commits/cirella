// Portado de la web antigua (src/content). Datos puros de los modelos interactivos.
/* -------------------------------------------------------------------------- *
 *  Diseño Humano — los datos estructurales completos de un bodygraph.
 *
 *  Nueve centros, las 64 puertas repartidas entre ellos y los 36 canales que
 *  los conectan. Aquí no hay geometría: el dibujo (polígonos, números y trazos)
 *  sale entero de ./bodygraph-layout.ts, el layout exportado del editor visual.
 * -------------------------------------------------------------------------- */

export type CentreId =
  | "head"
  | "ajna"
  | "throat"
  | "g"
  | "heart"
  | "spleen"
  | "sacral"
  | "solar"
  | "root"

export type CentreKind = "awareness" | "motor" | "identity" | "expression" | "pressure"

export interface Centre {
  id: CentreId
  name: string
  /** Nombre alternativo, tal como aparece en la mayoría de las cartas. */
  alias: string
  kind: CentreKind
  hue: string
  /** De qué se ocupa el centro. */
  role: string
  /** Cómo se vive cuando está definido. */
  defined: string
  /** El patrón de condicionamiento cuando está abierto. */
  open: string
}

export const CENTRES: Centre[] = [
  {
    id: "head",
    name: "Cabeza",
    alias: "Head · Corona",
    kind: "pressure",
    hue: "#8C6BB8",
    role: "Presión de inspiración. La fuente de todas las preguntas, no de las respuestas.",
    defined: "Definido: te habita un tipo de preguntas fiable y reconocible.",
    open: "Abierto: le das vueltas a preguntas que no son tuyas. La presión es prestada.",
  },
  {
    id: "ajna",
    name: "Ajna",
    alias: "Ajna · Mente",
    kind: "awareness",
    hue: "#3F4E8C",
    role: "Conceptualización. Cómo encuentran orden los pensamientos.",
    defined: "Definido: tu manera de pensar es fija y recurrente — fiable, pero nunca neutral.",
    open: "Abierto: puedes adoptar cualquier punto de vista. El riesgo es fingir seguridad.",
  },
  {
    id: "throat",
    name: "Garganta",
    alias: "Throat · Expresión",
    kind: "expression",
    hue: "#4FB3C4",
    role: "Expresión y manifestación. Todo lo que sale hacia fuera pasa por aquí.",
    defined: "Definido: hablas desde una fuente estable y puedes contar con ella.",
    open: "Abierto: sientes la presión de hablar para que te noten. Esperar lo cambia todo.",
  },
  {
    id: "g",
    name: "Centro G",
    alias: "Identidad · Amor",
    kind: "identity",
    hue: "#7FBB42",
    role: "Identidad, amor y dirección. El núcleo magnético.",
    defined: "Definido: sabes quién eres, aunque nadie te esté mirando.",
    open: "Abierto: tu identidad cambia con el lugar y con la gente. El sitio importa más de lo que crees.",
  },
  {
    id: "heart",
    name: "Corazón / Ego",
    alias: "Ego · Voluntad",
    kind: "motor",
    hue: "#4E7A32",
    role: "Voluntad, valor y promesa. El motor más pequeño y más potente.",
    defined: "Definido: puedes proponerte algo y sostenerlo, en olas de trabajo y descanso.",
    open: "Abierto: te demuestras donde no había nada que demostrar. No prometas lo que no sientas.",
  },
  {
    id: "spleen",
    name: "Bazo",
    alias: "Spleen · Intuición",
    kind: "awareness",
    hue: "#E4CE96",
    role: "Intuición, salud, supervivencia. La inteligencia más antigua del cuerpo.",
    defined: "Definido: tu intuición habla una vez, bajito, en el ahora. Quien pregunta dos veces ya no oye nada.",
    open: "Abierto: te aferras a cosas por miedo a soltarlas, no porque sean buenas.",
  },
  {
    id: "sacral",
    name: "Sacral",
    alias: "Sacral · Vida",
    kind: "motor",
    hue: "#E8862E",
    role: "Fuerza vital y respuesta. La energía que reacciona en lugar de iniciar.",
    defined: "Definido: tienes fuerza para aquello a lo que de verdad respondes — y ninguna para el resto.",
    open: "Abierto: no sabes cuándo es suficiente. Tienes que aprender a parar antes de agotarte.",
  },
  {
    id: "solar",
    name: "Plexo solar",
    alias: "Solar · Emociones",
    kind: "motor",
    hue: "#EFC53F",
    role: "La emoción como ola. No un estado, sino un movimiento a lo largo del tiempo.",
    defined: "Definido: para ti no hay verdad en el momento. Solo verdad a lo largo del tiempo.",
    open: "Abierto: tomas el ambiente de la sala por tuyo y evitas la confrontación.",
  },
  {
    id: "root",
    name: "Raíz",
    alias: "Root · Presión",
    kind: "pressure",
    hue: "#D2564F",
    role: "Presión adrenalínica. El impulso bajo el que todo empieza y todo termina.",
    defined: "Definido: llevas tu propio ritmo de presión. Va y viene a rachas.",
    open: "Abierto: corres para quitarte de encima una presión que no es tuya. No hay ninguna prisa.",
  },
]

export const CENTRE_BY_ID = Object.fromEntries(CENTRES.map((c) => [c.id, c])) as Record<
  CentreId,
  Centre
>

/** Motores — necesarios para derivar el tipo energético. */
export const MOTORS: CentreId[] = ["heart", "sacral", "solar", "root"]

export interface Gate {
  n: number
  centre: CentreId
  name: string
  /** Una línea sobre lo que aporta esta puerta. */
  theme: string
}

export const GATES: Gate[] = [
  // ── Cabeza ─────────────────────────────────────────────────────────────
  { n: 64, centre: "head", name: "Confusión", theme: "Imágenes sin orden, justo antes de tener sentido." },
  { n: 61, centre: "head", name: "Misterio", theme: "La presión por comprender lo inexplicable." },
  { n: 63, centre: "head", name: "Duda", theme: "La pregunta de si el patrón se sostiene de verdad." },

  // ── Ajna ───────────────────────────────────────────────────────────────
  { n: 47, centre: "ajna", name: "Comprensión", theme: "Del desorden nace, mirando atrás, el sentido." },
  { n: 24, centre: "ajna", name: "Racionalización", theme: "El mismo pensamiento vuelve hasta que madura." },
  { n: 4, centre: "ajna", name: "Formulación", theme: "Una respuesta posible — todavía no una prueba." },
  { n: 17, centre: "ajna", name: "Opiniones", theme: "La mirada que quiere compartirse." },
  { n: 43, centre: "ajna", name: "Perspicacia", theme: "El saber repentino que nadie ha explicado." },
  { n: 11, centre: "ajna", name: "Ideas", theme: "Imágenes que no te pertenecen, solo pasan por ti." },

  // ── Garganta ───────────────────────────────────────────────────────────
  { n: 62, centre: "throat", name: "Detalles", theme: "Poner nombre a las cosas pequeñas." },
  { n: 23, centre: "throat", name: "Asimilación", theme: "Decir en una frase lo incomprensible." },
  { n: 56, centre: "throat", name: "Estímulo", theme: "La historia que los demás siguen contando." },
  { n: 16, centre: "throat", name: "Habilidades", theme: "El entusiasmo que se convierte en maestría." },
  { n: 20, centre: "throat", name: "El ahora", theme: "Hablar en el instante presente." },
  { n: 35, centre: "throat", name: "Cambio", theme: "El hambre de lo que aún no has vivido." },
  { n: 12, centre: "throat", name: "Cautela", theme: "Hablar solo cuando el ánimo acompaña." },
  { n: 45, centre: "throat", name: "El recolector", theme: "La voz que mantiene unido a un grupo." },
  { n: 31, centre: "throat", name: "Liderazgo", theme: "«Yo dirijo» — pero solo si me eligen." },
  { n: 8, centre: "throat", name: "Contribución", theme: "Aportar lo propio sin explicarlo." },
  { n: 33, centre: "throat", name: "Retiro", theme: "Contar lo que se reconoció en el silencio." },

  // ── Centro G ───────────────────────────────────────────────────────────
  { n: 7, centre: "g", name: "El papel del yo", theme: "Liderazgo desde atrás, no sobre el escenario." },
  { n: 1, centre: "g", name: "Expresión del yo", theme: "Creación que no puede venir de nadie más." },
  { n: 13, centre: "g", name: "La que escucha", theme: "La gente te cuenta lo que no le cuenta a nadie." },
  { n: 10, centre: "g", name: "Conducta del yo", theme: "Quererse a una misma — como acto, no como sentimiento." },
  { n: 25, centre: "g", name: "Espíritu del yo", theme: "Un amor que no prefiere a nadie." },
  { n: 15, centre: "g", name: "Extremos", theme: "Ningún ritmo propio — a cambio, todos los humanos." },
  { n: 2, centre: "g", name: "Dirección del yo", theme: "La dirección te conoce antes de que tú la conozcas." },
  { n: 46, centre: "g", name: "Determinación del yo", theme: "En el lugar justo en el momento justo — dentro del cuerpo." },

  // ── Corazón ────────────────────────────────────────────────────────────
  { n: 21, centre: "heart", name: "La cazadora", theme: "Control sobre el propio territorio." },
  { n: 51, centre: "heart", name: "Conmoción", theme: "El golpe que despierta." },
  { n: 26, centre: "heart", name: "La egoísta", theme: "Convencer — con honestidad o nada." },
  { n: 40, centre: "heart", name: "Soledad", theme: "Dar y tener derecho a retirarse después." },

  // ── Bazo ───────────────────────────────────────────────────────────────
  { n: 48, centre: "spleen", name: "La profundidad", theme: "El pozo del que salen las soluciones." },
  { n: 57, centre: "spleen", name: "Intuición", theme: "Claridad en el oído, un segundo antes del pensamiento." },
  { n: 44, centre: "spleen", name: "Alerta", theme: "Hueles el pasado de una persona." },
  { n: 50, centre: "spleen", name: "Valores", theme: "La responsabilidad que nadie te dio." },
  { n: 32, centre: "spleen", name: "Continuidad", theme: "Reconocer lo que va a durar." },
  { n: 28, centre: "spleen", name: "La jugadora", theme: "La búsqueda de aquello por lo que merece la pena luchar." },
  { n: 18, centre: "spleen", name: "Corrección", theme: "El ojo para lo que podría estar mejor." },

  // ── Sacral ─────────────────────────────────────────────────────────────
  { n: 5, centre: "sacral", name: "Patrones fijos", theme: "Un ritmo que no quiere negociarse." },
  { n: 14, centre: "sacral", name: "Poder", theme: "Medios para lo que de verdad te importa." },
  { n: 29, centre: "sacral", name: "Decir sí", theme: "Entrega — la fuerza de mantenerse." },
  { n: 34, centre: "sacral", name: "Fuerza", theme: "Fuerza pura. Solo al hacer muestra para qué." },
  { n: 27, centre: "sacral", name: "Cuidado", theme: "Nutrir — a los demás y a ti." },
  { n: 59, centre: "sacral", name: "Sexualidad", theme: "La capacidad de atravesar barreras." },
  { n: 42, centre: "sacral", name: "Crecimiento", theme: "Llevar hasta el final lo que se empezó." },
  { n: 3, centre: "sacral", name: "Orden", theme: "La dificultad del principio de todo lo nuevo." },
  { n: 9, centre: "sacral", name: "Enfoque", theme: "La constancia para el detalle." },

  // ── Plexo solar ────────────────────────────────────────────────────────
  { n: 37, centre: "solar", name: "Amistad", theme: "El contacto que sella una alianza." },
  { n: 22, centre: "solar", name: "Apertura", theme: "Gracia — escuchar cuando el ánimo acompaña." },
  { n: 36, centre: "solar", name: "Crisis", theme: "La experiencia que no se puede saltar." },
  { n: 6, centre: "solar", name: "Fricción", theme: "La puerta de la intimidad y del conflicto." },
  { n: 49, centre: "solar", name: "Principios", theme: "Donde tu no se vuelve definitivo." },
  { n: 55, centre: "solar", name: "Espíritu", theme: "Ánimo sin causa. Plenitud o vacío." },
  { n: 30, centre: "solar", name: "Sentimientos", theme: "Un anhelo que arde hasta que se vive." },

  // ── Raíz ───────────────────────────────────────────────────────────────
  { n: 53, centre: "root", name: "Comienzo", theme: "La presión por empezar." },
  { n: 60, centre: "root", name: "Aceptación", theme: "Aceptar el límite — de ahí nace lo nuevo." },
  { n: 52, centre: "root", name: "Quietud", theme: "La presión por quedarse sentada." },
  { n: 54, centre: "root", name: "Ambición", theme: "El impulso hacia arriba." },
  { n: 38, centre: "root", name: "La luchadora", theme: "La resistencia que genera sentido." },
  { n: 58, centre: "root", name: "Vitalidad", theme: "La alegría de vivir como presión por mejorarlo." },
  { n: 19, centre: "root", name: "Querer", theme: "La necesidad de pertenecer." },
  { n: 39, centre: "root", name: "Provocación", theme: "El empujón que saca el sentimiento de los demás." },
  { n: 41, centre: "root", name: "Contracción", theme: "El inicio de toda experiencia. Fantasía bajo presión." },
]

export const GATE_BY_N = new Map(GATES.map((g) => [g.n, g]))

export type Circuit = "individual" | "tribal" | "collective" | "integration"

export const CIRCUIT_LABEL: Record<Circuit, string> = {
  individual: "Individual — mutación",
  tribal: "Tribal — sostén",
  collective: "Colectivo — compartir",
  integration: "Integración — el yo",
}

export interface Channel {
  /** Siempre de menor a mayor, para tener una clave estable. */
  a: number
  b: number
  name: string
  circuit: Circuit
  /** Lo que hace el canal cuando está definido. */
  gift: string
}

/** Los 36 canales. */
export const CHANNELS: Channel[] = [
  { a: 47, b: 64, name: "Abstracción", circuit: "collective", gift: "De la vivencia confusa nace, mirando atrás, el sentido." },
  { a: 24, b: 61, name: "Conciencia", circuit: "individual", gift: "Un pensamiento vuelve hasta convertirse en revelación." },
  { a: 4, b: 63, name: "Lógica", circuit: "collective", gift: "La duda busca el patrón que se sostiene." },
  { a: 17, b: 62, name: "Aceptación", circuit: "collective", gift: "La opinión se vuelve verificable gracias al detalle." },
  { a: 23, b: 43, name: "Estructuración", circuit: "individual", gift: "Lo inexplicable encuentra de pronto lenguaje." },
  { a: 11, b: 56, name: "Curiosidad", circuit: "collective", gift: "Las ideas se vuelven relatos que siguen viajando." },
  { a: 16, b: 48, name: "La longitud de onda", circuit: "collective", gift: "La profundidad se convierte en talento visible." },
  { a: 20, b: 57, name: "La onda cerebral", circuit: "integration", gift: "La intuición habla en el mismo instante en que llega." },
  { a: 10, b: 20, name: "Despertar", circuit: "integration", gift: "Ser y expresarse coinciden." },
  { a: 20, b: 34, name: "Carisma", circuit: "integration", gift: "Fuerza y voz en el mismo instante." },
  { a: 10, b: 57, name: "Forma perfecta", circuit: "integration", gift: "Sobrevivir gracias a la propia conducta." },
  { a: 10, b: 34, name: "Exploración", circuit: "integration", gift: "Serse fiel a través del hacer." },
  { a: 34, b: 57, name: "Poder", circuit: "integration", gift: "Instinto que pasa a la acción de inmediato." },
  { a: 7, b: 31, name: "Alfa", circuit: "collective", gift: "Un liderazgo que se elige, no que se toma." },
  { a: 1, b: 8, name: "Inspiración", circuit: "individual", gift: "Lo propio se hace visible sin explicación." },
  { a: 13, b: 33, name: "El hijo pródigo", circuit: "collective", gift: "La experiencia se convierte en memoria del grupo." },
  { a: 35, b: 36, name: "Transitoriedad", circuit: "collective", gift: "La crisis se hace experiencia; la experiencia, progreso." },
  { a: 12, b: 22, name: "Apertura", circuit: "individual", gift: "Gracia según el ánimo. Hablar cuando toca." },
  { a: 21, b: 45, name: "Dinero", circuit: "tribal", gift: "Orden material al servicio de la comunidad." },
  { a: 25, b: 51, name: "Iniciación", circuit: "individual", gift: "El impacto que conduce a lo universal." },
  { a: 5, b: 15, name: "Ritmo", circuit: "collective", gift: "El compás propio en medio de los extremos humanos." },
  { a: 2, b: 14, name: "El pulso", circuit: "individual", gift: "Una dirección que se financia a sí misma." },
  { a: 29, b: 46, name: "Descubrimiento", circuit: "collective", gift: "Decir sí y acabar en el lugar correcto." },
  { a: 26, b: 44, name: "Rendición", circuit: "tribal", gift: "Instinto para las personas unido a poder de convicción." },
  { a: 37, b: 40, name: "Comunidad", circuit: "tribal", gift: "El apretón de manos: trabajo a cambio de pertenencia." },
  { a: 27, b: 50, name: "Preservación", circuit: "tribal", gift: "Un cuidado que transporta valores entre generaciones." },
  { a: 32, b: 54, name: "Transformación", circuit: "tribal", gift: "Ambición que sabe lo que va a durar." },
  { a: 28, b: 38, name: "La lucha", circuit: "individual", gift: "Resistencia que le arranca sentido a la vida." },
  { a: 18, b: 58, name: "Juicio", circuit: "collective", gift: "Alegría de vivir que quiere mejorar las cosas." },
  { a: 42, b: 53, name: "Maduración", circuit: "collective", gift: "Empezar ciclos y terminarlos de verdad." },
  { a: 3, b: 60, name: "Mutación", circuit: "individual", gift: "De la limitación nace lo nuevo." },
  { a: 9, b: 52, name: "Concentración", circuit: "collective", gift: "Quedarse quieta el tiempo suficiente para acabar algo." },
  { a: 6, b: 59, name: "Apareamiento", circuit: "tribal", gift: "Caen las barreras — la intimidad se hace posible." },
  { a: 19, b: 49, name: "Síntesis", circuit: "tribal", gift: "La necesidad se encuentra con el principio. ¿Quién pertenece?" },
  { a: 39, b: 55, name: "Emotividad", circuit: "individual", gift: "Provocación al servicio del espíritu." },
  { a: 30, b: 41, name: "Reconocimiento", circuit: "collective", gift: "La fantasía se convierte en anhelo vivido." },
]

export const channelKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`

export const CHANNEL_BY_KEY = new Map(CHANNELS.map((c) => [channelKey(c.a, c.b), c]))

/** Todos los canales en los que participa cada puerta. */
export const CHANNELS_OF_GATE = new Map<number, Channel[]>()
for (const ch of CHANNELS) {
  for (const g of [ch.a, ch.b]) {
    const list = CHANNELS_OF_GATE.get(g) ?? []
    list.push(ch)
    CHANNELS_OF_GATE.set(g, list)
  }
}

/* -------------------------------------------------------------------------- *
 *  Derivación — lo que convierte el modelo en una carta que funciona en lugar
 *  de un dibujo. Dado un conjunto de puertas activadas, todo lo demás se sigue.
 * -------------------------------------------------------------------------- */

export type HdType = "Generador" | "Generador manifestante" | "Manifestador" | "Proyector" | "Reflector"

export type Authority =
  | "Emocional — plexo solar"
  | "Sacral"
  | "Esplénica"
  | "Ego / corazón"
  | "Autoproyectada"
  | "Mental — entorno"
  | "Lunar — reflector"

export interface ChartReading {
  definedChannels: Channel[]
  definedCentres: Set<CentreId>
  type: HdType
  typeNote: string
  authority: Authority
  authorityNote: string
  strategy: string
}

export function readChart(activeGates: Set<number>): ChartReading {
  const definedChannels = CHANNELS.filter((c) => activeGates.has(c.a) && activeGates.has(c.b))

  const definedCentres = new Set<CentreId>()
  for (const ch of definedChannels) {
    definedCentres.add(GATE_BY_N.get(ch.a)!.centre)
    definedCentres.add(GATE_BY_N.get(ch.b)!.centre)
  }

  // Adyacencia solo sobre canales definidos, para comprobar si un motor llega
  // a la garganta.
  const adjacency = new Map<CentreId, Set<CentreId>>()
  for (const ch of definedChannels) {
    const from = GATE_BY_N.get(ch.a)!.centre
    const to = GATE_BY_N.get(ch.b)!.centre
    if (from === to) continue
    if (!adjacency.has(from)) adjacency.set(from, new Set())
    if (!adjacency.has(to)) adjacency.set(to, new Set())
    adjacency.get(from)!.add(to)
    adjacency.get(to)!.add(from)
  }

  const reaches = (start: CentreId, target: CentreId) => {
    if (!adjacency.has(start)) return false
    const seen = new Set<CentreId>([start])
    const queue: CentreId[] = [start]
    while (queue.length) {
      const cur = queue.shift()!
      if (cur === target) return true
      for (const next of adjacency.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    return false
  }

  const motorToThroat = MOTORS.some((m) => definedCentres.has(m) && reaches(m, "throat"))
  const sacralDefined = definedCentres.has("sacral")

  let type: HdType
  let typeNote: string
  let strategy: string

  if (definedCentres.size === 0) {
    type = "Reflector"
    typeNote = "Ningún centro definido. Reflejas la comunidad en la que vives."
    strategy = "Espera un ciclo lunar completo antes de decidir algo grande."
  } else if (sacralDefined && motorToThroat) {
    type = "Generador manifestante"
    typeNote = "Sacral definido y un motor conectado a la garganta: responder y actuar coinciden."
    strategy = "Responder — y después informar, antes de echar a andar."
  } else if (sacralDefined) {
    type = "Generador"
    typeNote = "El sacral está definido. Tu energía responde en lugar de iniciar."
    strategy = "Esperar aquello a lo que puedas responder."
  } else if (motorToThroat) {
    type = "Manifestador"
    typeNote = "Un motor conectado a la garganta y el sacral sin definir. Tú inicias."
    strategy = "Informar antes de actuar — no por permiso, sino por paz."
  } else {
    type = "Proyector"
    typeNote = "Hay centros definidos, pero ningún motor en la garganta. Guías viendo, no haciendo."
    strategy = "Espera la invitación para lo que de verdad cuenta."
  }

  // La autoridad sigue una jerarquía fija: gana la primera que esté definida.
  let authority: Authority
  let authorityNote: string
  if (definedCentres.has("solar")) {
    authority = "Emocional — plexo solar"
    authorityNote = "No hay verdad en el momento. Consúltalo con la almohada, no por cortesía sino como método."
  } else if (sacralDefined) {
    authority = "Sacral"
    authorityNote = "Un sonido, no una frase. El cuerpo responde antes de que exista la explicación."
  } else if (definedCentres.has("spleen")) {
    authority = "Esplénica"
    authorityNote = "Habla una vez, bajito, en el ahora. Quien pregunta dos veces ya no oye nada."
  } else if (definedCentres.has("heart")) {
    authority = "Ego / corazón"
    authorityNote = "¿Qué quiero de verdad? Tu verdad está en tu propio querer."
  } else if (definedCentres.has("g")) {
    authority = "Autoproyectada"
    authorityNote = "Solo oyes lo que piensas al hablar. No necesitas un juicio, solo un oído."
  } else if (definedCentres.size === 0) {
    authority = "Lunar — reflector"
    authorityNote = "Un ciclo completo, veintiocho días, y la misma pregunta en días distintos."
  } else {
    authority = "Mental — entorno"
    authorityNote = "Habla con personas de confianza — no para pedir consejo, sino para escucharte."
  }

  return { definedChannels, definedCentres, type, typeNote, authority, authorityNote, strategy }
}

/** Cartas de ejemplo, para que el modelo abra con algo que mirar. */
export const EXAMPLE_CHARTS: Array<{ label: string; gates: number[] }> = [
  {
    // Sin ninguna puerta de garganta, el motor sacral nunca llega a la expresión.
    label: "Generador",
    gates: [34, 57, 10, 2, 14, 5, 15, 59, 6, 42, 53, 3, 60],
  },
  {
    // Definición puramente mental — sin motores, se queda en proyector.
    label: "Proyector",
    gates: [64, 47, 61, 24, 43, 23, 17, 62],
  },
  {
    label: "Manifestador",
    gates: [21, 45, 37, 40, 22, 12, 61, 24, 39, 55],
  },
  {
    label: "Gen. manifestante",
    gates: [34, 20, 5, 15, 29, 46, 35, 36, 30, 41, 9, 52],
  },
  {
    label: "Reflector",
    gates: [64, 24, 17, 8, 25, 44, 27, 5, 30, 53],
  },
]
