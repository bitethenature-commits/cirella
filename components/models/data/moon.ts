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

/** Próxima fecha, a partir de `from`, en la que el ciclo alcanza `targetPhase`. */
export function nextPhaseDate(targetPhase: number, from: Date = new Date()): Date {
  const current = moonPhase(from).phase
  let delta = targetPhase - current
  if (delta <= 0) delta += 1
  return new Date(from.getTime() + delta * SYNODIC * 86400000)
}

export const nextNewMoon = (from?: Date) => nextPhaseDate(0, from)
export const nextFullMoon = (from?: Date) => nextPhaseDate(0.5, from)

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
