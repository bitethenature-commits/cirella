// Portado de la web antigua (src/lib/moon.ts): aproximación sinódica sin efemérides. El modelo lunar la usa
// mientras carga lib/astro-calendar.ts (los datos reales) y para las guías de cada fase.
/**
 * Matemática de las fases lunares.
 *
 * Aproximación sinódica al estilo de Conway, afinada con la elongación media
 * de la Luna. Su precisión queda muy por debajo de un día para nombrar la fase
 * y calcular la iluminación, que es todo lo que necesita un calendario lunar:
 * no hace falta descargar ninguna efeméride.
 */

const SYNODIC = 29.530588853
/** 6 de enero de 2000, 18:14 UTC — una luna nueva conocida. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 86400000

export interface MoonInfo {
  /** 0…1 dentro del ciclo (0 = luna nueva, 0.5 = luna llena). */
  phase: number
  /** Fracción iluminada del disco, 0…1. */
  illumination: number
  /** Días transcurridos desde la última luna nueva. */
  age: number
  name: MoonPhaseName
  /** Verdadero mientras la Luna crece (nueva → llena). */
  waxing: boolean
}

export type MoonPhaseName =
  | "Luna nueva"
  | "Creciente"
  | "Cuarto creciente"
  | "Gibosa creciente"
  | "Luna llena"
  | "Gibosa menguante"
  | "Cuarto menguante"
  | "Menguante"

const toDays = (d: Date) => d.getTime() / 86400000

export function moonPhase(date: Date = new Date()): MoonInfo {
  const daysSince = toDays(date) - KNOWN_NEW_MOON
  let phase = (daysSince / SYNODIC) % 1
  if (phase < 0) phase += 1

  const age = phase * SYNODIC
  // La fracción iluminada sigue el coseno del ángulo de fase.
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2

  return {
    phase,
    illumination,
    age,
    name: phaseName(phase),
    waxing: phase < 0.5,
  }
}

export function phaseName(phase: number): MoonPhaseName {
  const p = phase % 1
  if (p < 0.0212 || p >= 0.9788) return "Luna nueva"
  if (p < 0.2288) return "Creciente"
  if (p < 0.2712) return "Cuarto creciente"
  if (p < 0.4788) return "Gibosa creciente"
  if (p < 0.5212) return "Luna llena"
  if (p < 0.7288) return "Gibosa menguante"
  if (p < 0.7712) return "Cuarto menguante"
  return "Menguante"
}

/** Signo por el que transita la Luna — aproximación por movimiento medio (13,176°/día). */
const SIGNS = [
  "Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo",
  "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis",
] as const

export type ZodiacSign = (typeof SIGNS)[number]

export function moonSign(date: Date = new Date()): ZodiacSign {
  // Referencia: el 6-1-2000 la Luna estaba cerca de los 12° de Capricornio.
  const days = toDays(date) - KNOWN_NEW_MOON
  const longitude = (282 + days * 13.176358) % 360
  return SIGNS[Math.floor(longitude / 30)]
}

export const ZODIAC_SIGNS = SIGNS

/** Un mes de días con sus datos de fase — alimenta la rejilla del calendario. */
export function lunarMonth(year: number, month: number) {
  const days: Array<{ date: Date; info: MoonInfo; sign: ZodiacSign }> = []
  const total = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= total; d++) {
    // Mediodía local, para que cada día tenga una fase representativa.
    const date = new Date(year, month, d, 12)
    days.push({ date, info: moonPhase(date), sign: moonSign(date) })
  }
  return days
}

/** Guía de práctica para cada una de las ocho fases principales. */
export const PHASE_GUIDANCE: Record<MoonPhaseName, { intent: string; practice: string }> = {
  "Luna nueva": {
    intent: "Sembrar",
    practice: "Escribe a oscuras. ¿Qué quiere empezar, antes de tener forma?",
  },
  Creciente: {
    intent: "Atreverse",
    practice: "El primer paso importa más que el paso correcto. Dalo hoy.",
  },
  "Cuarto creciente": {
    intent: "Decidir",
    practice: "La resistencia es información. ¿Dónde puede nacer un no claro?",
  },
  "Gibosa creciente": {
    intent: "Afinar",
    practice: "No empieces nada nuevo. Solo pule lo que ya respira.",
  },
  "Luna llena": {
    intent: "Ver",
    practice: "Todo queda a la luz. Observa sin juzgar.",
  },
  "Gibosa menguante": {
    intent: "Compartir",
    practice: "Transmite lo que recibiste. La sabiduría se echa a perder guardada.",
  },
  "Cuarto menguante": {
    intent: "Soltar",
    practice: "Perdonar no es un sentimiento, es una decisión. Tómala.",
  },
  Menguante: {
    intent: "Descansar",
    practice: "El vacío no es ausencia. Es preparación.",
  },
}

/* -------------------------------------------------------------------------- *
 *  Lo que se añadió con el zodiaco del modelo lunar
 * -------------------------------------------------------------------------- */

/** Las ocho estaciones en orden (múltiplos de 45° de elongación). */
export const EIGHT_PHASES: MoonPhaseName[] = ["Luna nueva", "Creciente", "Cuarto creciente", "Gibosa creciente", "Luna llena", "Gibosa menguante", "Cuarto menguante", "Menguante"]

/** Longitudes medias (sin efemérides) para el modelo mientras carga el cielo exacto. */
const J2000 = Date.UTC(2000, 0, 1, 12) / 86400000
export const meanSunLongitude = (date: Date) => (((280.46 + 0.9856474 * (toDays(date) - J2000)) % 360) + 360) % 360
export const meanMoonLongitude = (date: Date) => (((282 + (toDays(date) - KNOWN_NEW_MOON) * 13.176358) % 360) + 360) % 360

/** La Luna en cada signo (0 = Aries): el clima de esos dos días y medio. */
export const MOON_IN_SIGN: string[] = [
  "Días de arranque y poca paciencia. Buen momento para empezar algo corto, mover el cuerpo y decir las cosas claras. Antes de responder con prisa, respira.",
  "La Luna está cómoda: pide cuerpo, calma y placeres sencillos. Cocina, pasea, ordena tus cuentas. Lo que siembres ahora crece despacio y firme.",
  "Mente inquieta y ganas de conversar. Escribe, llama, aprende algo pequeño. Para no dispersarte, elige dos cosas y termínalas.",
  "La Luna en su casa: sensibilidad a flor de piel. Cuida tu hogar, tu gente y tu refugio. Date permiso para quedarte dentro y nutrirte.",
  "Ganas de brillar y de que te vean. Crea, juega, celebra. Ofrece tu calidez sin esperar aplausos: el corazón se ensancha al dar.",
  "Días de orden y cuidado práctico. Limpia, organiza, atiende la salud y las rutinas. Con la autoexigencia, suavidad: hecho es mejor que perfecto.",
  "Búsqueda de armonía y de compañía. Buen momento para acuerdos, citas y belleza. Escucha a la otra persona sin perderte para complacer.",
  "Emociones intensas y hondas. Propicia para la terapia, la intimidad y mirar lo escondido. Afloja el control: lo que se transforma, libera.",
  "Ánimo expansivo y ganas de horizonte. Estudia, sal a la naturaleza, habla de lo que da sentido. Promete solo lo que puedas cumplir.",
  "Emociones más contenidas y foco en lo concreto. Planifica, asume compromisos, pon límites sanos. También el descanso es parte del trabajo.",
  "Necesidad de aire y de libertad. Buena para el grupo, la amistad y las ideas nuevas. Mira lo que sientes con distancia, sin desconectarte.",
  "Sensibilidad, intuición y sueños vívidos. Medita, crea, escucha música, ayuda. Protege tu energía: no todo lo que sientes es tuyo.",
]

/** Luna nueva en cada signo: qué sembrar. */
export const NEW_MOON_IN_SIGN: string[] = [
  "Semilla de valentía. Empieza eso que llevas tiempo posponiendo: un proyecto propio, un hábito de movimiento, una decisión que solo depende de ti. Intención: «Me atrevo a empezar».",
  "Semilla de estabilidad. Siembra en lo material y en el cuerpo: ahorro, alimentación, un rincón bonito. Intención: «Construyo despacio lo que quiero que dure».",
  "Semilla de palabra. Empieza un curso, un diario, una conversación pendiente. Intención: «Me abro a aprender y a decir lo que pienso».",
  "Semilla de hogar. Siembra cuidados: en casa, en la familia, en tu forma de tratarte. Intención: «Me doy el cuidado que doy a los demás».",
  "Semilla de expresión. Inicia algo creativo y visible, algo que te ilusione. Intención: «Me permito brillar con mi propia luz».",
  "Semilla de buenos hábitos. Empieza una rutina amable, un sistema de orden, un cuidado del cuerpo. Intención: «Cuido los detalles que me sostienen».",
  "Semilla de vínculo. Abre acuerdos, alianzas, una relación más justa. Intención: «Busco el equilibrio entre lo que doy y lo que recibo».",
  "Semilla de transformación. Siembra en lo hondo: sanar, comprometerte, compartir de verdad. Intención: «Me atrevo a ir a la raíz».",
  "Semilla de sentido. Empieza un estudio, planea un viaje, escribe tu visión. Intención: «Confío en el camino que se abre».",
  "Semilla de propósito. Fija una meta concreta, con pasos y fechas. Intención: «Me comprometo con lo que quiero construir».",
  "Semilla de libertad. Inicia algo original, en comunidad o fuera de la costumbre. Intención: «Me permito ser distinta».",
  "Semilla de fe. Siembra en lo espiritual y lo creativo: meditación, arte, perdón. Intención: «Me dejo guiar por lo que me inspira».",
]

/** Luna llena en cada signo (el de la Luna; el Sol está enfrente): qué culmina y qué soltar en ese eje. */
export const FULL_MOON_IN_SIGN: string[] = [
  "Yo y nosotros. Se ilumina dónde te dejas de lado por agradar o dónde vas sola sin escuchar. Suelta la prisa o la complacencia; quédate con una decisión tuya y justa.",
  "Lo mío y lo compartido. Culmina lo sembrado en lo material. Suelta apegos y miedo a perder; agradece lo que tienes y deja ir lo que pesa.",
  "Los datos y el sentido. Se aclaran conversaciones e ideas. Suelta el ruido mental y las verdades absolutas; quédate con lo que de verdad has comprendido.",
  "El hogar y el mundo. Se ve el equilibrio entre cuidar y lograr. Suelta la culpa por no llegar a todo; honra tus emociones y también tus metas.",
  "El corazón propio y el grupo. Celebra lo que has creado. Suelta la necesidad de aprobación; brilla en compañía.",
  "El orden y la entrega. Se ve dónde controlas y dónde te desbordas. Suelta la perfección; deja una parte al misterio y otra a la rutina.",
  "Nosotros y yo. Culminan acuerdos y relaciones. Suelta lo que es desigual; pide lo que necesitas con amabilidad y firmeza.",
  "Lo profundo y lo sencillo. Sale a la luz lo que estaba oculto. Suelta rencores y control; vuelve al cuerpo y a lo que te da paz.",
  "La visión y el detalle. Cosecha de aprendizajes. Suelta creencias que te limitan; comparte lo que sabes sin sermonear.",
  "El logro y el refugio. Se ven los frutos del esfuerzo. Suelta la dureza contigo; reconoce lo conseguido y date calor.",
  "La libertad y el corazón. Se iluminan amistades y causas. Suelta lo que te ata a una imagen; celebra tu forma única de estar en el grupo.",
  "El sueño y el servicio. Culmina un ciclo sensible. Suelta la confusión y el sacrificio; quédate con la compasión y un gesto práctico.",
]

/** Nacer en cada una de las ocho estaciones (a la manera de Dane Rudhyar). */
export const NATAL_PHASE: Record<MoonPhaseName, string> = {
  "Luna nueva": "Naciste con la Luna nueva: tu impulso va por delante de las explicaciones. Vienes a empezar cosas; confía en el instinto y deja que la forma llegue después.",
  Creciente: "Naciste con la Luna creciente: te toca abrir camino a lo nuevo frente a la costumbre y la duda. Tu fuerza crece cuando te comprometes.",
  "Cuarto creciente": "Naciste en cuarto creciente: tu vida pide decidir y construir. Te mueves bien en lo que hay que levantar; aprende a elegir sin romperlo todo.",
  "Gibosa creciente": "Naciste con la Luna gibosa creciente: buscas el sentido y la mejora. Tienes ojo para pulir; lo bueno ya es suficiente para empezar a darlo.",
  "Luna llena": "Naciste con la Luna llena: vives en el espejo de los demás, en la claridad y la plenitud. Tu camino es unir lo que sientes y lo que piensas.",
  "Gibosa menguante": "Naciste con la Luna gibosa menguante (diseminadora): vienes a transmitir lo que comprendes. Enseñas, cuentas, divulgas; tu don crece al darlo.",
  "Cuarto menguante": "Naciste en cuarto menguante: revisas creencias y sueltas lo que ya no te representa. Tienes valor para cerrar etapas y cambiar de rumbo.",
  Menguante: "Naciste con la Luna menguante (balsámica): sensibilidad, cierre de ciclos y visión de futuro. Lo que haces prepara algo que otras personas continuarán.",
}
