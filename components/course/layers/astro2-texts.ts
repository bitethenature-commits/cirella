/**
 * Los textos de las capas de astrología a fondo (components/course/layers/astro2.tsx): dignidades, ejes,
 * hemisferios, figuras de aspectos, retrogradaciones, ciclos de la vida, revolución solar y progresiones.
 * Generales y cortos: debajo, la dueña añade el suyo en cada lección.
 */

export type Dignity = "domicile" | "exaltation" | "exile" | "fall";

/** Signos (0 = Aries) de cada dignidad de cada planeta (regencias modernas y tradicionales). */
export const DIGNITIES: Record<string, Record<Dignity, number[]>> = {
  sun: { domicile: [4], exaltation: [0], exile: [10], fall: [6] },
  moon: { domicile: [3], exaltation: [1], exile: [9], fall: [7] },
  mercury: { domicile: [2, 5], exaltation: [5], exile: [8, 11], fall: [11] },
  venus: { domicile: [1, 6], exaltation: [11], exile: [7, 0], fall: [5] },
  mars: { domicile: [0, 7], exaltation: [9], exile: [6, 1], fall: [3] },
  jupiter: { domicile: [8, 11], exaltation: [3], exile: [2, 5], fall: [9] },
  saturn: { domicile: [9, 10], exaltation: [6], exile: [3, 4], fall: [0] },
  uranus: { domicile: [10], exaltation: [7], exile: [4], fall: [1] },
  neptune: { domicile: [11], exaltation: [3], exile: [5], fall: [9] },
  pluto: { domicile: [7], exaltation: [0], exile: [1], fall: [6] },
};

export const DIGNITY_TEXT: Record<Dignity | "peregrine", { name: string; short: string; meaning: string }> = {
  domicile: { name: "Domicilio", short: "D", meaning: "El planeta está en su casa: se expresa con naturalidad, sin pedir permiso. Es su forma más pura." },
  exaltation: { name: "Exaltación", short: "E", meaning: "Invitado de honor: brilla, a veces con un punto de exceso. Lo mejor de sí sale con facilidad." },
  exile: { name: "Exilio", short: "X", meaning: "Lejos de casa: tiene que aprender otro idioma. Cuesta más, y por eso madura más hondo." },
  fall: { name: "Caída", short: "C", meaning: "Donde peor se siente: aprende por el camino difícil. Bien trabajado, se vuelve una fuerza humilde y sabia." },
  peregrine: { name: "Peregrino", short: "·", meaning: "Sin dignidad ni debilidad: el planeta va de paso y toma el color del signo y de los planetas con los que se relaciona." },
};

/** Los 6 ejes del zodiaco (0 = Aries-Libra) con sus dos casas. */
export const AXES: { title: string; poles: [string, string]; houses: [string, string]; meaning: string }[] = [
  { title: "Yo y nosotros", poles: ["Aries", "Libra"], houses: ["I", "VII"], meaning: "El eje de la identidad y la relación. Afirmarte sin dejar de ver a la otra persona; acompañar sin perderte." },
  { title: "Lo mío y lo compartido", poles: ["Tauro", "Escorpio"], houses: ["II", "VIII"], meaning: "El eje del valor y la intimidad. Lo que tienes y lo que entregas; la seguridad y la transformación." },
  { title: "El dato y el sentido", poles: ["Géminis", "Sagitario"], houses: ["III", "IX"], meaning: "El eje del conocimiento. La pregunta pequeña y la gran visión; aprender de lo cercano y buscar lo lejano." },
  { title: "La raíz y la cima", poles: ["Cáncer", "Capricornio"], houses: ["IV", "X"], meaning: "El eje del hogar y la vocación. Cuidar y ser cuidada, construir y ser vista; de dónde vienes y adónde llegas." },
  { title: "El corazón y el grupo", poles: ["Leo", "Acuario"], houses: ["V", "XI"], meaning: "El eje de la expresión y la comunidad. Brillar con tu luz y ponerla al servicio de algo más grande." },
  { title: "El orden y la entrega", poles: ["Virgo", "Piscis"], houses: ["VI", "XII"], meaning: "El eje del servicio y la fe. Cuidar los detalles y soltar el control; la rutina y el misterio." },
];

export const HEMIS: Record<string, { name: string; houses: number[]; meaning: string }> = {
  south: { name: "Hemisferio sur (arriba)", houses: [7, 8, 9, 10, 11, 12], meaning: "Sobre el horizonte: lo visible. Muchos planetas aquí hablan de una vida que se juega hacia fuera, en lo público y con los demás." },
  north: { name: "Hemisferio norte (abajo)", houses: [1, 2, 3, 4, 5, 6], meaning: "Bajo el horizonte: lo íntimo. Muchos planetas aquí hablan de una vida que se cocina por dentro, en lo personal y lo cercano." },
  east: { name: "Hemisferio este (izquierda)", houses: [10, 11, 12, 1, 2, 3], meaning: "El lado del Ascendente: la iniciativa propia. Muchos planetas aquí piden decidir tú y empezar las cosas a tu manera." },
  west: { name: "Hemisferio oeste (derecha)", houses: [4, 5, 6, 7, 8, 9], meaning: "El lado del Descendente: la relación. Muchos planetas aquí hablan de crecer a través de los demás y de los encuentros." },
  q1: { name: "Primer cuadrante (casas I-III)", houses: [1, 2, 3], meaning: "El yo que se descubre: el cuerpo, los recursos propios, la palabra. La energía va hacia conocerte." },
  q2: { name: "Segundo cuadrante (casas IV-VI)", houses: [4, 5, 6], meaning: "El yo que se expresa: el hogar, la creatividad, el día a día. La energía va hacia hacer tu mundo." },
  q3: { name: "Tercer cuadrante (casas VII-IX)", houses: [7, 8, 9], meaning: "El yo con los otros: la pareja, lo compartido, la búsqueda de sentido. La energía va hacia el encuentro." },
  q4: { name: "Cuarto cuadrante (casas X-XII)", houses: [10, 11, 12], meaning: "El yo en el mundo: la vocación, el grupo, lo trascendente. La energía va hacia dejar huella." },
};

export const PATTERNS: Record<string, { name: string; how: string; meaning: string }> = {
  "grand-trine": { name: "Gran trígono", how: "Tres planetas en trígono entre sí, casi siempre del mismo elemento: un triángulo.", meaning: "Un talento que fluye solo, un circuito cerrado de facilidad. El reto es usarlo: lo que no cuesta, a veces no se aprovecha." },
  "t-square": { name: "T-cuadrada", how: "Dos planetas en oposición y un tercero en cuadratura con los dos: una T.", meaning: "Tensión que empuja a actuar. El planeta del vértice es el motor y el punto de salida: allí se resuelve la tensión." },
  "grand-cross": { name: "Gran cruz", how: "Cuatro planetas: dos oposiciones cruzadas en cuadratura.", meaning: "Mucha fuerza en todas las direcciones. Exige equilibrio constante; da una resistencia enorme a quien la sostiene." },
  yod: { name: "Yod (el dedo de Dios)", how: "Dos planetas en sextil y los dos en quincuncio con un tercero: un triángulo alargado.", meaning: "Un ajuste fino hacia una misión. El planeta del vértice señala algo que la vida pide afinar una y otra vez." },
  kite: { name: "Cometa", how: "Un gran trígono con un cuarto planeta enfrente de uno de los tres.", meaning: "El talento del gran trígono con una dirección: la oposición le da un objetivo y lo pone en marcha." },
  stellium: { name: "Stellium", how: "Tres o más planetas juntos en el mismo signo o casa.", meaning: "Toda una orquesta en un mismo lugar: ese signo o esa casa se vuelve el centro de tu vida." },
};

export const POINT_FORTUNE = {
  name: "Parte de la Fortuna",
  glyph: "⊗",
  keyword: "La alegría",
  meaning: "Un punto que se calcula con el Ascendente, el Sol y la Luna. Señala dónde fluye tu bienestar natural: lo que te hace sentir afortunada cuando lo vives.",
};

export const RETRO: Record<string, { how: string; meaning: string; natal: string }> = {
  mercury: { how: "Tres o cuatro veces al año, unas tres semanas.", meaning: "La mente mira hacia atrás: revisar, repensar, retomar conversaciones. No es mal momento: es momento de re-.", natal: "Piensas por dentro antes de decir: tu mente es reflexiva y original, aunque a veces te cueste explicarte a la primera." },
  venus: { how: "Cada año y medio, unos cuarenta días.", meaning: "Se revisan los vínculos, el dinero y lo que valoras. Vuelven personas del pasado; conviene no precipitar compromisos.", natal: "Amas a tu manera, sin seguir el guion: tu sentido del valor se forma por dentro, a veces tarde y muy hondo." },
  mars: { how: "Cada dos años, unos dos meses y medio.", meaning: "La energía va hacia dentro: revisar cómo te plantas, qué batallas eliges. Bien para terminar, no tanto para empezar.", natal: "Tu fuerza es interior y estratégica: te cuesta la confrontación directa, pero sabes resistir y elegir el momento." },
  jupiter: { how: "Una vez al año, unos cuatro meses.", meaning: "El crecimiento es interior: revisar creencias y sentido antes de expandirte fuera.", natal: "Tu fe y tu sentido son propios: no crees por costumbre, crees lo que has comprobado por dentro." },
  saturn: { how: "Una vez al año, unos cuatro meses y medio.", meaning: "Revisar estructuras, compromisos y límites: lo que sostienes y lo que ya pesa.", natal: "Tu disciplina nace de dentro: te pones tus propias normas y tu autoridad tarda en llegar, pero llega sólida." },
  uranus: { how: "Una vez al año, unos cinco meses.", meaning: "Los cambios se gestan por dentro: libertad interior antes que revolución fuera.", natal: "Tu rebeldía es silenciosa: cambias por dentro antes de que nadie lo note." },
  neptune: { how: "Una vez al año, unos cinco meses.", meaning: "Se aclaran ilusiones; la intuición y los sueños se vuelven más nítidos.", natal: "Tu mundo espiritual es muy íntimo: sientes mucho y lo cuidas en silencio." },
  pluto: { how: "Una vez al año, entre cinco y seis meses.", meaning: "La transformación es profunda e interior: soltar lo que ya no tiene vida.", natal: "Tu poder de transformarte es interno: te regeneras por dentro, sin necesidad de testigos." },
};

/** Los grandes ciclos: cada cuántos años vuelve y a qué edades se vive. */
export const CYCLES: Record<string, { name: string; glyph: string; period: number; ages: number[]; meaning: string }> = {
  nodes: { name: "Retorno de los nodos", glyph: "☊", period: 18.6, ages: [18.6, 37.2, 55.8, 74.4], meaning: "Los nodos vuelven a su sitio cada 18,6 años: momentos de rumbo, en los que la vida te recuerda hacia dónde crecer." },
  jupiter: { name: "Retorno de Júpiter", glyph: "♃", period: 11.86, ages: [11.9, 23.7, 35.6, 47.4, 59.3, 71.2, 83], meaning: "Cada doce años, Júpiter vuelve: se abre un ciclo de crecimiento, confianza y nuevas oportunidades." },
  saturn: { name: "Primer retorno de Saturno", glyph: "♄", period: 29.46, ages: [29.5], meaning: "Hacia los 29-30 años: la entrada en la madurez. Se cae lo que no es tuyo y empiezas a construir sobre lo verdadero." },
  uranus: { name: "Oposición de Urano", glyph: "♅", period: 84, ages: [42], meaning: "Hacia los 40-42 años, la crisis de la mitad de la vida: el deseo de ser por fin tú, sin moldes." },
  chiron: { name: "Retorno de Quirón", glyph: "⚷", period: 50.7, ages: [50.7], meaning: "Hacia los 50 años: la herida antigua vuelve para sanarse y convertirse en sabiduría para acompañar." },
  saturn2: { name: "Segundo retorno de Saturno", glyph: "♄", period: 29.46, ages: [58.9], meaning: "Hacia los 58-60 años: la entrada en la sabiduría. Recoges lo sembrado y eliges qué legado dejar." },
};

export const PROGRESS: Record<string, { name: string; glyph: string; meaning: string }> = {
  sr: { name: "Revolución solar", glyph: "☉", meaning: "Cada año, el Sol vuelve al grado exacto en que naciste: tu cumpleaños solar. La carta de ese momento describe el clima de tu año." },
  "p-sun": { name: "Sol progresado", glyph: "☉", meaning: "En las progresiones, cada día después de nacer equivale a un año de vida. Tu Sol avanza un grado al año y cambia de signo cada treinta: tu identidad madura por etapas." },
  "p-moon": { name: "Luna progresada", glyph: "☽", meaning: "La Luna progresada cambia de signo cada dos años y medio y da una vuelta entera hacia los 27-28 años: marca tus estaciones emocionales." },
};

export const ELEMENT_TEXT: Record<string, string> = {
  Fuego: "Impulso, entusiasmo y fe. El fuego empieza, inspira y se apaga si no tiene a qué arder.",
  Tierra: "Cuerpo, constancia y lo concreto. La tierra sostiene, construye y necesita tiempo.",
  Aire: "Idea, palabra y vínculo. El aire conecta, compara y pone distancia para ver claro.",
  Agua: "Emoción, memoria e intuición. El agua siente antes de entender y se adapta a lo que la contiene.",
};
