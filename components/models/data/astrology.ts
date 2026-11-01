// Portado de la web antigua (src/content). Datos puros de los modelos interactivos.
/* -------------------------------------------------------------------------- *
 *  Astrología — los componentes de una carta natal.
 *
 *  Los signos describen el *cómo*, los planetas el *qué*, las casas el *dónde*
 *  y los aspectos cómo hablan entre sí las partes. Todo lo que explica el
 *  modelo vive aquí; el cálculo de la carta, en lib/natal-chart.ts.
 *
 *  Los textos de «planeta en signo» y «planeta en casa» no son interpretaciones
 *  escritas una a una: se componen con lo que ya dicen el planeta, el signo
 *  (elemento y cualidad) y la casa.
 * -------------------------------------------------------------------------- */

import type { AspectId, BodyId } from "@/lib/natal-chart"

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
  /** Regente moderno (el que da el regente de la carta). */
  ruler: string
  rulerId: BodyId
  /** Regente tradicional, si es otro (Escorpio: Marte; Acuario: Saturno; Piscis: Júpiter). */
  traditional?: BodyId
  keyword: string
  meaning: string
}

export const SIGNS: Sign[] = [
  { n: 0, name: "Aries", glyph: "♈", element: "Fuego", modality: "cardinal", ruler: "Marte", rulerId: "mars", keyword: "Yo empiezo", meaning: "El primer impulso. Actuar antes de que llegue la duda — y aprender que no todo comienzo necesita un final." },
  { n: 1, name: "Tauro", glyph: "♉", element: "Tierra", modality: "fijo", ruler: "Venus", rulerId: "venus", keyword: "Yo tengo", meaning: "El cuerpo y lo que permanece. Disfrute, constancia — y la pregunta de cuándo sostener se convierte en aferrarse." },
  { n: 2, name: "Géminis", glyph: "♊", element: "Aire", modality: "mutable", ruler: "Mercurio", rulerId: "mercury", keyword: "Yo pienso", meaning: "La curiosidad que lo toca todo. Lenguaje, vínculo — y el arte de bajar también a lo hondo." },
  { n: 3, name: "Cáncer", glyph: "♋", element: "Agua", modality: "cardinal", ruler: "Luna", rulerId: "moon", keyword: "Yo siento", meaning: "Origen y refugio. A qué llamas hogar y a quién dejas entrar." },
  { n: 4, name: "Leo", glyph: "♌", element: "Fuego", modality: "fijo", ruler: "Sol", rulerId: "sun", keyword: "Yo quiero", meaning: "El corazón que quiere ser visto. Generosidad — en cuanto deja de pedir aplauso." },
  { n: 5, name: "Virgo", glyph: "♍", element: "Tierra", modality: "mutable", ruler: "Mercurio", rulerId: "mercury", keyword: "Yo sirvo", meaning: "El ojo para el detalle. Mejorar como acto de amor, no como autocrítica." },
  { n: 6, name: "Libra", glyph: "♎", element: "Aire", modality: "cardinal", ruler: "Venus", rulerId: "venus", keyword: "Yo equilibro", meaning: "El otro. Equilibrio, belleza — y el valor de elegir aunque alguien se decepcione." },
  { n: 7, name: "Escorpio", glyph: "♏", element: "Agua", modality: "fijo", ruler: "Plutón", rulerId: "pluto", traditional: "mars", keyword: "Yo deseo", meaning: "Lo que hay bajo la superficie. Profundidad, transformación y la disposición a dejar morir algo." },
  { n: 8, name: "Sagitario", glyph: "♐", element: "Fuego", modality: "mutable", ruler: "Júpiter", rulerId: "jupiter", keyword: "Yo veo", meaning: "La mirada amplia. Sentido, viaje, convicción — hasta que la convicción se estrecha." },
  { n: 9, name: "Capricornio", glyph: "♑", element: "Tierra", modality: "cardinal", ruler: "Saturno", rulerId: "saturn", keyword: "Yo construyo", meaning: "Estructura y tiempo. Lo que levantas y te sobrevive." },
  { n: 10, name: "Acuario", glyph: "♒", element: "Aire", modality: "fijo", ruler: "Urano", rulerId: "uranus", traditional: "saturn", keyword: "Yo sé", meaning: "La distancia que ve claro. Libertad, comunidad — y la soledad de ser distinta." },
  { n: 11, name: "Piscis", glyph: "♓", element: "Agua", modality: "mutable", ruler: "Neptuno", rulerId: "neptune", traditional: "jupiter", keyword: "Yo creo", meaning: "Donde los límites son porosos. Compasión, disolución — y aprender a decir que no." },
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

export type BodyGroup = "luminar" | "personal" | "social" | "transpersonal" | "punto"

export interface BodyInfo {
  id: BodyId
  name: string
  glyph: string
  group: BodyGroup
  keyword: string
  meaning: string
  /** Lo que pone en juego, en pocas palabras: sirve para componer «en signo» y «en casa». */
  theme: string
}

export const GROUP_LABEL: Record<BodyGroup, string> = {
  luminar: "Luminar",
  personal: "Planeta personal",
  social: "Planeta social",
  transpersonal: "Planeta transpersonal",
  punto: "Punto",
}

export const BODY_INFO: Record<BodyId, BodyInfo> = {
  sun: { id: "sun", name: "Sol", glyph: "☉", group: "luminar", keyword: "El núcleo", theme: "lo que te enciende", meaning: "No tu signo en el sentido de las revistas, sino aquello que te enciende cuando nadie mira." },
  moon: { id: "moon", name: "Luna", glyph: "☽", group: "luminar", keyword: "La necesidad", theme: "lo que necesitas para sentirte a salvo", meaning: "El punto más callado y más importante. Lo que necesitas para sentirte a salvo — casi siempre algo distinto de lo que deseas." },
  mercury: { id: "mercury", name: "Mercurio", glyph: "☿", group: "personal", keyword: "La mente", theme: "cómo piensas y hablas", meaning: "Cómo piensas, hablas y ordenas la información." },
  venus: { id: "venus", name: "Venus", glyph: "♀", group: "personal", keyword: "El valor", theme: "qué amas y cómo te valoras", meaning: "Qué amas y cómo amas. También: cuánto te valoras." },
  mars: { id: "mars", name: "Marte", glyph: "♂", group: "personal", keyword: "La voluntad", theme: "cómo te plantas por ti misma", meaning: "Cómo te plantas por ti misma — y cómo te enfadas." },
  jupiter: { id: "jupiter", name: "Júpiter", glyph: "♃", group: "social", keyword: "La amplitud", theme: "dónde creces más allá de ti", meaning: "Donde creces más allá de ti. También donde exageras." },
  saturn: { id: "saturn", name: "Saturno", glyph: "♄", group: "social", keyword: "La estructura", theme: "dónde vas despacio y echas raíces", meaning: "Donde vas más lenta que los demás — y donde acabarás con las raíces más hondas." },
  uranus: { id: "uranus", name: "Urano", glyph: "♅", group: "transpersonal", keyword: "La ruptura", theme: "dónde no puedes ser convencional", meaning: "Donde no puedes ser convencional sin enfermar." },
  neptune: { id: "neptune", name: "Neptuno", glyph: "♆", group: "transpersonal", keyword: "La disolución", theme: "dónde los límites se vuelven porosos", meaning: "Donde los límites son porosos. Ahí conviven la compasión y el engaño." },
  pluto: { id: "pluto", name: "Plutón", glyph: "♇", group: "transpersonal", keyword: "La profundidad", theme: "lo que muere para que otra cosa viva", meaning: "Lo que muere para que otra cosa pueda vivir." },
  chiron: { id: "chiron", name: "Quirón", glyph: "⚷", group: "punto", keyword: "La herida que enseña", theme: "la herida antigua que te enseña a acompañar", meaning: "Donde algo duele desde hace mucho y no se arregla del todo — y, por eso mismo, donde sabes acompañar a otras personas en su dolor." },
  node: { id: "node", name: "Nodo Norte", glyph: "☊", group: "punto", keyword: "El rumbo", theme: "hacia dónde te pide crecer la vida", meaning: "La dirección que cuesta y a la vez hace crecer. No es un talento: es un aprendizaje, lo que todavía no sabes y te llama." },
  southNode: { id: "southNode", name: "Nodo Sur", glyph: "☋", group: "punto", keyword: "Lo conocido", theme: "lo que ya sabes hacer de memoria", meaning: "Lo que ya traes aprendido: un recurso, y también la comodidad de volver siempre a ello. Siempre frente al Nodo Norte." },
  lilith: { id: "lilith", name: "Lilith", glyph: "⚸", group: "punto", keyword: "Lo indómito", theme: "lo que no se deja domesticar", meaning: "La Luna Negra: lo que no pide permiso ni se deja domesticar — y lo que alguna vez se castigó por eso." },
}

export type AngleKey = "asc" | "mc" | "dsc" | "ic"

export const ANGLE_INFO: Record<AngleKey, { short: string; name: string; keyword: string; meaning: string; house: number }> = {
  asc: { short: "AC", name: "Ascendente", keyword: "La entrada", house: 1, meaning: "El grado que asomaba por el horizonte este al nacer. Cómo empiezas las cosas, cómo te ven al llegar, el cuerpo y la manera de estar." },
  ic: { short: "IC", name: "Fondo del Cielo", keyword: "La raíz", house: 4, meaning: "El punto más bajo de la carta. Familia, origen, el lugar al que vuelves: lo que te sostiene sin que se vea." },
  dsc: { short: "DC", name: "Descendente", keyword: "El otro", house: 7, meaning: "Por donde se ponía el cielo. Lo que buscas — y encuentras — en los demás: la pareja, los socios, el espejo." },
  mc: { short: "MC", name: "Medio Cielo", keyword: "La cima", house: 10, meaning: "El punto más alto de la carta. Vocación, reputación, lo que quieres que quede de ti a la vista de todos." },
}

export interface AspectType {
  id: AspectId
  name: string
  glyph: string
  angle: number
  color: string
  dash?: string
  nature: "armónico" | "tenso" | "neutro" | "ajuste"
  meaning: string
}

/** Tensos en rojos, armónicos en azul y verde, la conjunción en oro y el quincuncio (menor), punteado. */
export const ASPECTS: AspectType[] = [
  { id: "conjunction", name: "Conjunción", glyph: "☌", angle: 0, color: "#C9A227", nature: "neutro", meaning: "Dos fuerzas en el mismo lugar. Se refuerzan y ya no pueden separarse." },
  { id: "sextile", name: "Sextil", glyph: "⚹", angle: 60, color: "#7FA3D6", nature: "armónico", meaning: "Una oportunidad. Solo actúa si la aprovechas; si no, se queda dormida." },
  { id: "square", name: "Cuadratura", glyph: "□", angle: 90, color: "#D0584F", nature: "tenso", meaning: "Fricción que obliga a algo. El aspecto más productivo, si no se evita." },
  { id: "trine", name: "Trígono", glyph: "△", angle: 120, color: "#5FA67A", nature: "armónico", meaning: "Talento que no cuesta nada. Justo por eso se desperdicia con facilidad." },
  { id: "quincunx", name: "Quincuncio", glyph: "⚻", angle: 150, color: "#A39673", dash: "2 1.6", nature: "ajuste", meaning: "Dos partes que no se entienden: ni chocan ni se ayudan. Piden un ajuste continuo." },
  { id: "opposition", name: "Oposición", glyph: "☍", angle: 180, color: "#B5487A", nature: "tenso", meaning: "Los dos extremos de un eje. Sueles vivirla a través de otras personas, hasta que sostienes tú misma ambos lados." },
]

export const ASPECT_BY_ID = Object.fromEntries(ASPECTS.map((a) => [a.id, a])) as Record<AspectId, AspectType>

export const signOf = (lon: number) => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)]

/* -------------------------------------------------------------------------- *
 *  Textos compuestos
 * -------------------------------------------------------------------------- */

const ELEMENT_WAY: Record<Element, string> = {
  Fuego: "con impulso y entusiasmo",
  Tierra: "con calma, en lo concreto y lo que se puede tocar",
  Aire: "a través de la idea, la palabra y el vínculo",
  Agua: "desde la emoción, la memoria y la intuición",
}

const MODALITY_WAY: Record<Modality, string> = {
  cardinal: "abriendo camino",
  fijo: "sosteniéndolo en el tiempo",
  mutable: "adaptándose y buscando",
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** «Venus en Escorpio»: el planeta, dicho con el lenguaje del signo (su elemento y su cualidad). */
export function bodyInSignText(body: BodyInfo, sign: Sign) {
  return `${upperFirst(body.theme)} habla el idioma de ${sign.name}: «${sign.keyword}». Signo de ${sign.element} ${sign.modality}, lo vive ${ELEMENT_WAY[sign.element]}, ${MODALITY_WAY[sign.modality]}.`
}

/** «Venus en la Casa VIII»: dónde se juega. */
export function bodyInHouseText(body: BodyInfo, house: House) {
  return `En la ${house.name} (${house.keyword.toLowerCase()}), ${body.theme} se juega sobre todo en este terreno: ${lowerFirst(house.meaning)}`
}

/** «Ascendente en Escorpio». */
export function angleInSignText(sign: Sign) {
  return `Con el idioma de ${sign.name}: «${sign.keyword}». Signo de ${sign.element} ${sign.modality}: ${ELEMENT_WAY[sign.element]}, ${MODALITY_WAY[sign.modality]}.`
}
