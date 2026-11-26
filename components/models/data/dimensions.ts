/**
 * Las dimensiones del ser, de la 3D a la 12D: una visión espiritual (no científica) muy extendida, contada en
 * sencillo. Cada escuela las cuenta un poco distinto: son para reflexionar, no un dogma. Lo usan el modelo principal
 * (components/models/dimensions-model.tsx) y sus modelos por partes (components/course/layers/dimensions.tsx).
 */

export type DText = { name: string; kicker: string; meaning: string };

export const DIM_KEYS = ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export type DimKey = (typeof DIM_KEYS)[number];

/** El color de cada dimensión: de la tierra roja de la 3D a la luz blanca de la 12D. */
export const DIM_COLOR: Record<DimKey, string> = {
  "3": "#E2574C",
  "4": "#F08A3C",
  "5": "#6FBF73",
  "6": "#5AA9E6",
  "7": "#8E7FE0",
  "8": "#C98FD8",
  "9": "#C9C2F2",
  "10": "#CFE6F5",
  "11": "#E9CC8E",
  "12": "#FBF6EC",
};

/** Cada dimensión: qué es, cómo se vive y su clave. */
export const DIMENSIONS: Record<DimKey, DText & { short: string; key: string }> = {
  "3": {
    short: "La materia",
    name: "3D · La materia",
    kicker: "El cuerpo · los sentidos · la dualidad",
    key: "Estar presente en tu cuerpo.",
    meaning:
      "La realidad que tocamos: largo, ancho y alto. Se vive desde el cuerpo y los cinco sentidos, y con ella llega la dualidad (yo y tú, bien y mal) y el miedo a que falte algo. No es algo malo ni algo que haya que dejar atrás: es la escuela donde el alma aprende a vivir en la materia.",
  },
  "4": {
    short: "El tiempo y lo astral",
    name: "4D · El tiempo y lo astral",
    kicker: "Las emociones · los sueños · el puente",
    key: "Observar lo que sientes sin perderte en ello.",
    meaning:
      "La cuarta dimensión añade el tiempo. En lo espiritual es el plano astral: los sueños, la imaginación, las emociones y las energías que no se ven. Todavía hay luz y sombra mezcladas: es un plano de paso, el puente entre la materia y el amor.",
  },
  "5": {
    short: "El amor y la unidad",
    name: "5D · El amor y la unidad",
    kicker: "El corazón · el presente · la sincronicidad",
    key: "Elegir desde el amor.",
    meaning:
      "Se vive desde el corazón: la sensación de que todo está conectado, de vivir en el presente, de casualidades con sentido. El miedo deja de mandar y se crea desde la intención y la alegría. No es un lugar al que ir: es una forma de vivir aquí, en este cuerpo y en esta vida.",
  },
  "6": {
    short: "Los patrones",
    name: "6D · Los patrones y la geometría",
    kicker: "Las plantillas · los arquetipos · la visión",
    key: "Ver el patrón detrás de lo que pasa.",
    meaning:
      "El plano de los planos: los patrones de todo lo que existe, la geometría sagrada y los arquetipos. Se dice que desde aquí se diseñan las formas que luego se hacen materia, como una plantilla de luz. Se percibe con la intuición más que con la mente.",
  },
  "7": {
    short: "El sonido y la luz",
    name: "7D · El sonido y la luz",
    kicker: "La vibración · la creatividad pura",
    key: "Escuchar tu propia vibración.",
    meaning:
      "Todo es frecuencia: el sonido, el color y la luz en su forma más pura. Es la creatividad antes de tener forma, la música que ordena la energía. Por eso los mantras, el canto y los cuencos se usan tanto para «subir la vibración».",
  },
  "8": {
    short: "El vacío y el grupo de almas",
    name: "8D · El vacío y el grupo de almas",
    kicker: "Lo que no tiene forma · la familia del alma",
    key: "Rendirte al silencio.",
    meaning:
      "Aquí se pierde la idea de ser alguien separado: las almas se viven como grupos, como notas de un mismo acorde. Es el silencio fértil, el vacío que no está vacío sino lleno de posibilidades. Muchas personas lo rozan en la meditación profunda.",
  },
  "9": {
    short: "La conciencia colectiva",
    name: "9D · La conciencia colectiva",
    kicker: "Los planetas · las estrellas · las galaxias",
    key: "Sentirte parte de algo inmenso.",
    meaning:
      "La conciencia de los grandes seres: la Tierra, el Sol, las estrellas y las galaxias, vistos como seres vivos. Es el plano de lo colectivo, donde se sostiene el camino de especies y mundos enteros.",
  },
  "10": {
    short: "Los rayos creadores",
    name: "10D · Los rayos creadores",
    kicker: "La fuerza que crea · los Elohim",
    key: "Crear en colaboración con la vida.",
    meaning:
      "La fuente de los rayos de la creación: la energía que da origen a galaxias y universos. Algunas tradiciones hablan aquí de los Elohim, los grandes creadores. Es la creatividad a escala cósmica.",
  },
  "11": {
    short: "El Logos",
    name: "11D · El Logos",
    kicker: "La palabra creadora · la idea de todo",
    key: "Confiar en un plan mayor.",
    meaning:
      "El instante antes de la creación: la mente divina que guarda la idea de todo antes de que exista, la palabra que crea. En algunas visiones es el plano de la Madre-Padre divina y de los arcángeles, como Metatrón.",
  },
  "12": {
    short: "La Fuente",
    name: "12D · La Fuente",
    kicker: "La unidad total · el todo y la nada",
    key: "Recordar que eres parte del todo.",
    meaning:
      "El origen y el final: todo es uno. No hay separación ni tiempo, solo conciencia. Todas las dimensiones nacen de aquí y vuelven aquí, y por eso la Fuente también está en el centro de todo, también en ti.",
  },
};

/** El paso de la 3D a la 5D (pasando por la 4D): de qué a qué. */
export const SHIFT_KEYS = ["bridge", "fear", "separation", "time", "being", "trust", "signs"] as const;
export const SHIFT: Record<(typeof SHIFT_KEYS)[number], DText & { from?: string; to?: string }> = {
  bridge: {
    name: "La 4D, el puente",
    kicker: "Lo que se vive entre una y otra",
    meaning:
      "No se salta de la 3D a la 5D de golpe: se pasa por la 4D, el plano de las emociones, los sueños y el tiempo. Ahí conviven lo viejo y lo nuevo: hay días de mucha claridad y días en que vuelve el miedo. Es normal: estás cruzando el puente.",
  },
  fear: {
    name: "Del miedo al amor",
    kicker: "La emoción que decide",
    from: "miedo",
    to: "amor",
    meaning: "En la 3D se decide para protegerse: que no falte, que no duela. En la 5D se decide desde el amor: qué me hace bien y qué hace bien a los demás. El miedo no desaparece del todo, pero deja de mandar.",
  },
  separation: {
    name: "De la separación a la unidad",
    kicker: "Tú y los demás",
    from: "separación",
    to: "unidad",
    meaning: "En la 3D cada uno va por su lado y el otro es competencia. En la 5D se siente que todo está conectado: lo que haces a otro te lo haces a ti, y la naturaleza es parte de ti.",
  },
  time: {
    name: "Del reloj al presente",
    kicker: "Cómo se vive el tiempo",
    from: "reloj",
    to: "presente",
    meaning: "En la 3D el tiempo es una línea: el pasado pesa y el futuro preocupa. En la 5D se vive en el ahora; el tiempo se siente más elástico y aparecen más sincronicidades, casualidades con sentido.",
  },
  being: {
    name: "Del hacer al ser",
    kicker: "Qué te da valor",
    from: "hacer",
    to: "ser",
    meaning: "En la 3D vales por lo que haces, tienes o consigues. En la 5D vales por lo que eres, y haces desde la alegría, no para demostrar nada.",
  },
  trust: {
    name: "Del control a la confianza",
    kicker: "Cómo te mueves por la vida",
    from: "control",
    to: "confianza",
    meaning: "En la 3D se intenta controlarlo todo para estar a salvo. En la 5D pones la intención y sueltas: confías en que la vida te acompaña y te dejas guiar por la intuición.",
  },
  signs: {
    name: "Las señales del cambio",
    kicker: "Lo que muchas personas notan",
    meaning:
      "Más sensibilidad a la energía de los lugares y las personas, necesidad de naturaleza, cambios en el sueño, menos tolerancia a la mentira, ganas de simplificar y de vivir con sentido. Tómalo con calma: descansa, toma tierra y cuida tu cuerpo. Si algo te pesa mucho, busca ayuda profesional.",
  },
};

/** Las dimensiones y los chakras: qué chakra (o chakras) abre cada una. Del 8 al 12, los que están sobre la cabeza. */
export const DIM_CHAKRAS: Record<DimKey, { chakras: string[]; name: string; meaning: string }> = {
  "3": { chakras: ["root"], name: "Muladhara, la raíz", meaning: "La raíz sostiene la vida en la materia: el cuerpo, la seguridad y la tierra. Vivir bien la 3D es tener raíces: comer bien, descansar y sentir los pies en el suelo." },
  "4": { chakras: ["sacral", "solar"], name: "El sacro y el plexo solar", meaning: "Las emociones, el deseo y la voluntad. La 4D se vive en el mundo emocional y en los sueños; equilibrar estos dos chakras ayuda a cruzarla sin perderse." },
  "5": { chakras: ["heart"], name: "Anahata, el corazón", meaning: "El corazón es la puerta de la 5D: el amor, la compasión y la unidad. Por eso tantas prácticas para «subir de dimensión» empiezan por abrir el corazón." },
  "6": { chakras: ["throat", "third-eye"], name: "La garganta y el tercer ojo", meaning: "La palabra y la visión. La 6D es el plano de los patrones: se percibe con la intuición del tercer ojo y se trae al mundo con la palabra verdadera." },
  "7": { chakras: ["crown"], name: "Sahasrara, la corona", meaning: "El loto de mil pétalos, la conexión con lo divino. La 7D es la vibración pura, y la corona es la antena que la recibe." },
  "8": { chakras: ["t8"], name: "La estrella del alma · 8º chakra", meaning: "Un palmo por encima de la cabeza. Guarda la memoria de tu alma y te une a tu familia de almas." },
  "9": { chakras: ["t9"], name: "El portal estelar · 9º chakra", meaning: "Más arriba aún: la conexión con la conciencia de la Tierra, las estrellas y las galaxias." },
  "10": { chakras: ["t10"], name: "El 10º chakra", meaning: "Por donde entra en tu campo la energía creadora: tu parte que crea junto a la vida." },
  "11": { chakras: ["t11"], name: "El 11º chakra", meaning: "La conexión con el Logos, la palabra creadora: la confianza en un plan mayor que el tuyo." },
  "12": { chakras: ["t12"], name: "El 12º chakra · la Fuente", meaning: "La unión con la Fuente. En él se recogen todos los demás: el punto donde tú y el todo sois lo mismo." },
};

/** La forma de cada dimensión. */
export const DIM_FIGURES: Record<DimKey, DText> = {
  "3": { name: "El cubo", kicker: "3D · largo, ancho y alto", meaning: "Tres medidas: largo, ancho y alto. El cubo es la forma de la materia y de la tierra: estable, firme, la casa de lo físico. En la geometría sagrada es el sólido de la tierra." },
  "4": { name: "El teseracto", kicker: "4D · un cubo dentro de otro", meaning: "Un cubo dentro de otro, unidos por sus esquinas: es la sombra, en nuestro mundo, de un cubo de cuatro dimensiones (el hipercubo). Como el tiempo, añade una dirección que no vemos pero que lo cambia todo." },
  "5": { name: "La merkaba", kicker: "5D · la estrella de dos tetraedros", meaning: "Dos tetraedros encajados, uno hacia arriba y otro hacia abajo: lo masculino y lo femenino en equilibrio. Su estrella une el cielo y la tierra, como el corazón une lo humano y lo divino. Fíjate: su centro es el teseracto de la 4D." },
  "6": { name: "La flor de la vida", kicker: "6D · la plantilla de todas las formas", meaning: "Diecinueve círculos entrelazados: la plantilla de la que salen todas las formas. Por eso se une a la 6D, el plano de los patrones." },
  "7": { name: "El heptagrama", kicker: "7D · la estrella de siete puntas", meaning: "Siete notas, siete colores, siete chakras: el siete es el número del misterio y del sonido que ordena la energía." },
  "8": { name: "El octograma", kicker: "8D · la estrella de ocho puntas", meaning: "Dos cuadrados entrelazados forman la estrella de ocho puntas. El ocho tumbado es el infinito: lo que no tiene principio ni fin, el vacío que lo contiene todo." },
  "9": { name: "El eneagrama", kicker: "9D · la estrella de nueve puntas", meaning: "Tres veces tres, el número que completa el ciclo. Muchas puntas unidas en una sola figura: la imagen de lo colectivo." },
  "10": { name: "El decagrama", kicker: "10D · la estrella de diez puntas", meaning: "Diez puntas, como las diez esferas del árbol de la vida: la creación completa, del primer impulso a la forma." },
  "11": { name: "El cubo de Metatrón", kicker: "11D · todas las formas antes de existir", meaning: "Trece círculos unidos por setenta y ocho líneas: dentro están todas las formas antes de crearse. Es la imagen del Logos, la idea de todo antes de ser." },
  "12": { name: "El punto en el círculo", kicker: "12D · el principio y el final", meaning: "El círculo sin principio ni fin y, en su centro, el punto: la Fuente. Todo sale del punto y todo vuelve a él." },
};

export const DIM_NOTE = "Es una visión espiritual, no científica, y cada escuela la cuenta un poco distinto: tómala como un mapa para reflexionar.";
