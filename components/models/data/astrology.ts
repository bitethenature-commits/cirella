// Portado de la web antigua (src/content). Datos puros de los modelos interactivos.
/* -------------------------------------------------------------------------- *
 *  Astrología — los componentes de una carta natal.
 *
 *  Los signos describen el *cómo*, los planetas el *qué*, las casas el *dónde*
 *  y los aspectos cómo hablan entre sí las partes. Todo lo que explica el
 *  modelo vive aquí.
 * -------------------------------------------------------------------------- */

export type Element = "Fuego" | "Tierra" | "Aire" | "Agua"
export type Modality = "cardinal" | "fijo" | "mutable"

export const ELEMENT_HUE: Record<Element, string> = {
  Fuego: "#B5544F",
  Tierra: "#8A7A4E",
  Aire: "#8FA6C4",
  Agua: "#6E8C9B",
}

export interface Sign {
  n: number
  name: string
  glyph: string
  element: Element
  modality: Modality
  ruler: string
  keyword: string
  meaning: string
}

export const SIGNS: Sign[] = [
  { n: 0, name: "Aries", glyph: "♈", element: "Fuego", modality: "cardinal", ruler: "Marte", keyword: "Yo empiezo", meaning: "El primer impulso. Actuar antes de que llegue la duda — y aprender que no todo comienzo necesita un final." },
  { n: 1, name: "Tauro", glyph: "♉", element: "Tierra", modality: "fijo", ruler: "Venus", keyword: "Yo tengo", meaning: "El cuerpo y lo que permanece. Disfrute, constancia — y la pregunta de cuándo sostener se convierte en aferrarse." },
  { n: 2, name: "Géminis", glyph: "♊", element: "Aire", modality: "mutable", ruler: "Mercurio", keyword: "Yo pienso", meaning: "La curiosidad que lo toca todo. Lenguaje, vínculo — y el arte de bajar también a lo hondo." },
  { n: 3, name: "Cáncer", glyph: "♋", element: "Agua", modality: "cardinal", ruler: "Luna", keyword: "Yo siento", meaning: "Origen y refugio. A qué llamas hogar y a quién dejas entrar." },
  { n: 4, name: "Leo", glyph: "♌", element: "Fuego", modality: "fijo", ruler: "Sol", keyword: "Yo quiero", meaning: "El corazón que quiere ser visto. Generosidad — en cuanto deja de pedir aplauso." },
  { n: 5, name: "Virgo", glyph: "♍", element: "Tierra", modality: "mutable", ruler: "Mercurio", keyword: "Yo sirvo", meaning: "El ojo para el detalle. Mejorar como acto de amor, no como autocrítica." },
  { n: 6, name: "Libra", glyph: "♎", element: "Aire", modality: "cardinal", ruler: "Venus", keyword: "Yo equilibro", meaning: "El otro. Equilibrio, belleza — y el valor de elegir aunque alguien se decepcione." },
  { n: 7, name: "Escorpio", glyph: "♏", element: "Agua", modality: "fijo", ruler: "Plutón", keyword: "Yo deseo", meaning: "Lo que hay bajo la superficie. Profundidad, transformación y la disposición a dejar morir algo." },
  { n: 8, name: "Sagitario", glyph: "♐", element: "Fuego", modality: "mutable", ruler: "Júpiter", keyword: "Yo veo", meaning: "La mirada amplia. Sentido, viaje, convicción — hasta que la convicción se estrecha." },
  { n: 9, name: "Capricornio", glyph: "♑", element: "Tierra", modality: "cardinal", ruler: "Saturno", keyword: "Yo construyo", meaning: "Estructura y tiempo. Lo que levantas y te sobrevive." },
  { n: 10, name: "Acuario", glyph: "♒", element: "Aire", modality: "fijo", ruler: "Urano", keyword: "Yo sé", meaning: "La distancia que ve claro. Libertad, comunidad — y la soledad de ser distinta." },
  { n: 11, name: "Piscis", glyph: "♓", element: "Agua", modality: "mutable", ruler: "Neptuno", keyword: "Yo creo", meaning: "Donde los límites son porosos. Compasión, disolución — y aprender a decir que no." },
]

export interface House {
  n: number
  name: string
  axis: string
  keyword: string
  meaning: string
}

export const HOUSES: House[] = [
  { n: 1, name: "Casa I", axis: "Yo ↔ Tú", keyword: "Aparición", meaning: "La impresión que causas antes de decir nada. Cuerpo, postura, la primera respiración." },
  { n: 2, name: "Casa II", axis: "Mío ↔ Nuestro", keyword: "Valor", meaning: "Lo que te pertenece y lo que vales: son la misma pregunta." },
  { n: 3, name: "Casa III", axis: "Cerca ↔ Lejos", keyword: "Lenguaje", meaning: "Hermanos, vecindario, las primeras palabras. Cómo conviertes el mundo en frases." },
  { n: 4, name: "Casa IV", axis: "Raíz ↔ Corona", keyword: "Origen", meaning: "De dónde vienes y a qué llamas hogar en lo más hondo. El cimiento bajo todo lo demás." },
  { n: 5, name: "Casa V", axis: "Yo muestro ↔ Compartimos", keyword: "Expresión", meaning: "Juego, creación, hijos, enamoramiento. Todo lo que haces porque da alegría." },
  { n: 6, name: "Casa VI", axis: "Servicio ↔ Fusión", keyword: "Cotidiano", meaning: "Trabajo, salud, costumbre. El lugar poco espectacular donde se decide una vida." },
  { n: 7, name: "Casa VII", axis: "Tú ↔ Yo", keyword: "Encuentro", meaning: "A quién atraes, y qué parte de ti te muestra esa persona." },
  { n: 8, name: "Casa VIII", axis: "Nuestro ↔ Mío", keyword: "Transformación", meaning: "Lo que se comparte: intimidad, el dinero de otros, la muerte y lo que viene después." },
  { n: 9, name: "Casa IX", axis: "Lejos ↔ Cerca", keyword: "Sentido", meaning: "Viaje, estudio, creencia. El intento de convertir la experiencia en una visión del mundo." },
  { n: 10, name: "Casa X", axis: "Corona ↔ Raíz", keyword: "Huella", meaning: "Lo que de ti se hace público. No tu profesión: tu huella." },
  { n: 11, name: "Casa XI", axis: "Compartimos ↔ Yo muestro", keyword: "Círculo", meaning: "Amistad, grupo, futuro. Las personas con las que quieres la misma dirección." },
  { n: 12, name: "Casa XII", axis: "Fusión ↔ Servicio", keyword: "Retiro", meaning: "Lo oculto. Sueños, disolución y aquello que tú misma ves peor." },
]

export interface Planet {
  id: string
  name: string
  glyph: string
  /** Longitud eclíptica en la carta de ejemplo, 0° = 0° de Aries. */
  lon: number
  speed: "rápido" | "social" | "lento"
  keyword: string
  meaning: string
}

/** Carta de ejemplo fija y verosímil — no es una consulta de efemérides. */
export const PLANETS: Planet[] = [
  { id: "sun", name: "Sol", glyph: "☉", lon: 83, speed: "rápido", keyword: "El núcleo", meaning: "No tu signo en el sentido de las revistas, sino aquello que te enciende cuando nadie mira." },
  { id: "moon", name: "Luna", glyph: "☽", lon: 214, speed: "rápido", keyword: "La necesidad", meaning: "El punto más callado y más importante. Lo que necesitas para sentirte a salvo — casi siempre algo distinto de lo que deseas." },
  { id: "mercury", name: "Mercurio", glyph: "☿", lon: 68, speed: "rápido", keyword: "La mente", meaning: "Cómo piensas, hablas y ordenas la información." },
  { id: "venus", name: "Venus", glyph: "♀", lon: 118, speed: "rápido", keyword: "El valor", meaning: "Qué amas y cómo amas. También: cuánto te valoras." },
  { id: "mars", name: "Marte", glyph: "♂", lon: 291, speed: "rápido", keyword: "La voluntad", meaning: "Cómo te plantas por ti misma — y cómo te enfadas." },
  { id: "jupiter", name: "Júpiter", glyph: "♃", lon: 12, speed: "social", keyword: "La amplitud", meaning: "Donde creces más allá de ti. También donde exageras." },
  { id: "saturn", name: "Saturno", glyph: "♄", lon: 335, speed: "social", keyword: "La estructura", meaning: "Donde vas más lenta que los demás — y donde acabarás con las raíces más hondas." },
  { id: "uranus", name: "Urano", glyph: "♅", lon: 47, speed: "lento", keyword: "La ruptura", meaning: "Donde no puedes ser convencional sin enfermar." },
  { id: "neptune", name: "Neptuno", glyph: "♆", lon: 356, speed: "lento", keyword: "La disolución", meaning: "Donde los límites son porosos. Ahí conviven la compasión y el engaño." },
  { id: "pluto", name: "Plutón", glyph: "♇", lon: 268, speed: "lento", keyword: "La profundidad", meaning: "Lo que muere para que otra cosa pueda vivir." },
]

export interface AspectType {
  id: string
  name: string
  angle: number
  orb: number
  color: string
  dash?: string
  nature: "suave" | "duro" | "neutro"
  meaning: string
}

export const ASPECTS: AspectType[] = [
  { id: "conjunction", name: "Conjunción", angle: 0, orb: 8, color: "#C9A227", nature: "neutro", meaning: "Dos fuerzas en el mismo lugar. Se refuerzan y ya no pueden separarse." },
  { id: "sextile", name: "Sextil", angle: 60, orb: 5, color: "#8FA6C4", dash: "4 4", nature: "suave", meaning: "Una oportunidad. Solo actúa si la aprovechas; si no, se queda dormida." },
  { id: "square", name: "Cuadratura", angle: 90, orb: 6, color: "#B5544F", nature: "duro", meaning: "Fricción que obliga a algo. El aspecto más productivo, si no se evita." },
  { id: "trine", name: "Trígono", angle: 120, orb: 6, color: "#6E9B7A", nature: "suave", meaning: "Talento que no cuesta nada. Justo por eso se desperdicia con facilidad." },
  { id: "opposition", name: "Oposición", angle: 180, orb: 8, color: "#8C6BB8", dash: "8 4", nature: "duro", meaning: "Los dos extremos de un eje. Sueles vivirla a través de otras personas, hasta que sostienes tú misma ambos lados." },
]

export const signOf = (lon: number) => SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)]
export const degreeInSign = (lon: number) => Math.floor(((lon % 360) + 360) % 360 % 30)

/** Sistema de casas iguales: la casa I empieza en el ascendente. */
export const houseOf = (lon: number, ascendant: number) =>
  Math.floor(((((lon - ascendant) % 360) + 360) % 360) / 30) + 1

export interface FoundAspect {
  a: Planet
  b: Planet
  type: AspectType
  /** Exactitud, 0…1. */
  strength: number
  orbUsed: number
}

export function findAspects(planets: Planet[], enabled: Set<string>): FoundAspect[] {
  const out: FoundAspect[] = []
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i]
      const b = planets[j]
      let diff = Math.abs(a.lon - b.lon) % 360
      if (diff > 180) diff = 360 - diff
      for (const type of ASPECTS) {
        if (!enabled.has(type.id)) continue
        const delta = Math.abs(diff - type.angle)
        if (delta <= type.orb) {
          out.push({ a, b, type, strength: 1 - delta / type.orb, orbUsed: delta })
          break
        }
      }
    }
  }
  return out
}
