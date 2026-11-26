/**
 * Lecciones largas de ejemplo con el modelo por partes para Human Design, Gene Keys y la Luna (como
 * «Marte, tu fuerza» para la astrología): capítulos, el modelo deconstruido con un texto de Cirella para cada
 * pieza, ejercicio, repaso y glosario. Idempotente (prisma/demo-lesson-mars.ts → seedDemoLesson).
 */
import type { PrismaClient } from "@prisma/client";
import { demoChapter as chapter, demoText as text, seedDemoLesson, type DemoPart } from "./demo-lesson-mars";

const HD_CENTRES: Record<string, string> = {
  head: "La Cabeza hace preguntas, no da respuestas. **Definida**: te inspiran siempre los mismos temas. **Abierta**: te contagias de las preguntas de otros; suelta las que no son tuyas.",
  ajna: "Ajna es la mente que procesa y opina. **Definida**: piensas de una forma fija y reconocible. **Abierta**: puedes ver todos los puntos de vista; no necesitas tener certezas.",
  throat: "La Garganta es la voz y la acción. **Definida**: hablas de un modo propio. **Abierta**: sientes presión por hablar para que te vean; espera a que te pregunten.",
  g: "El centro G es identidad, amor y dirección. **Definido**: sabes quién eres. **Abierto**: tu identidad cambia según el lugar y las personas: elige bien dónde estás.",
  heart: "El Corazón (Ego) es fuerza de voluntad y valor propio. **Definido**: cumples lo que prometes. **Abierto**: no tienes que demostrar nada a nadie.",
  spleen: "El Bazo es la intuición del instante, el miedo que protege y el sistema inmune. **Definido**: tu intuición es constante. **Abierto**: te aferras a lo que no te hace bien por miedo.",
  sacral: "El Sacro es la energía vital y de trabajo, la que responde «ajá» o «ah-ah». **Definido**: eres Generador. **Abierto**: tu energía no es constante; descansa antes de agotarte.",
  solar: "El Plexo Solar es la emoción en ola. **Definido**: necesitas tiempo para decidir. **Abierto**: amplificas las emociones de otros; no todo lo que sientes es tuyo.",
  root: "La Raíz es presión de adrenalina y estrés. **Definida**: manejas la presión a tu ritmo. **Abierta**: tienes prisa por quitarte la presión de encima; no hace falta.",
};

const HD_LINES: Record<string, string> = {
  "1": "Antes de dar un paso, investiga. Si no sabe, se siente insegura: los libros, los cursos y la información son su suelo firme.",
  "2": "Brilla sin esfuerzo y no sabe por qué. Necesita tiempo a solas para recargarse y espera la llamada adecuada para salir.",
  "3": "Prueba, falla y aprende. Lo que para otros es un error, para ella es un descubrimiento. Necesita libertad para experimentar.",
  "4": "Su red de personas es su fuerza: las oportunidades le llegan por amigos y conocidos. Necesita una base estable.",
  "5": "Los demás ven en ella una salvadora. Da soluciones prácticas; cuidado con las expectativas que no son suyas.",
  "6": "Tres etapas: experimentar, observar desde arriba y, después de los 50, ser ejemplo vivo de lo aprendido.",
};

const HD_PARTS: DemoPart[] = [
  text("El bodygraph tiene **9 centros**. Cada uno es una energía. Los que salen de color están **definidos** (constantes en ti); los blancos, **abiertos** (allí recibes la energía de los demás). Con tus datos guardados, el modelo pinta tu bodygraph."),
  chapter("Qué es un centro"),
  text(`Los centros son como los chakras, pero son nueve. Cada uno se ocupa de algo: pensar, hablar, sentir, decidir, tener energía…

- **Definido** no es mejor que abierto: es lo que eres siempre.
- **Abierto** es donde aprendes de los demás… y donde te condicionan.

La sabiduría está en tus centros abiertos: allí puedes llegar a ser muy sabia, si no te identificas con lo que recibes.`),
  chapter("Los 9 centros, uno a uno"),
  { kind: "MODEL", data: { option: null, mode: "explore", layer: "hd-centres", focus: null, title: "Toca cada centro", intro: "", notes: HD_CENTRES } },
  chapter("Tu perfil: las 6 líneas"),
  text("Tu **perfil** son dos números (por ejemplo 5/1): la línea del Sol consciente y la del Sol inconsciente. Dicen tu manera de aprender y de relacionarte. Toca cada línea."),
  { kind: "MODEL", data: { option: null, mode: "explore", layer: "hd-lines", focus: null, title: "Las seis líneas", intro: "", notes: HD_LINES } },
  chapter("Práctica"),
  text("Durante una semana, cada vez que sientas presión por **hablar**, **decidir** o **demostrar**, mira qué centro tienes abierto en esa energía. Anótalo: ¿era tuyo o lo recibías?"),
  chapter("Repaso"),
  {
    kind: "QUIZ",
    data: {
      questions: [
        { q: "¿Cuántos centros tiene el bodygraph?", options: ["7", "9", "12"], answer: 1, why: "Son nueve: Cabeza, Ajna, Garganta, G, Corazón, Bazo, Sacro, Plexo Solar y Raíz." },
        { q: "Un centro abierto es…", options: ["Peor que uno definido", "Donde recibes y amplificas la energía de otros", "Un centro roto"], answer: 1, why: "Abierto no es malo: es donde aprendes de los demás, y también donde te condicionan." },
        { q: "¿Qué centro define a los Generadores?", options: ["El Sacro", "La Garganta", "La Cabeza"], answer: 0, why: "Con el Sacro definido eres Generador (o Generador manifestante)." },
        { q: "La línea 3 aprende…", options: ["Investigando", "Por prueba y error", "Observando desde arriba"], answer: 1, why: "La línea 3, el Mártir: chocándose es como descubre lo que funciona." },
      ],
    },
  },
  { kind: "GLOSSARY", data: { terms: [{ term: "Centro definido", def: "Coloreado en tu bodygraph: una energía constante y fiable en ti." }, { term: "Centro abierto", def: "En blanco: allí recibes y amplificas la energía de otras personas." }, { term: "Perfil", def: "Las líneas de tu Sol consciente e inconsciente (por ejemplo 5/1)." }] } },
];

const GK_SPECTRUM: Record<string, string> = {
  shadow: "No se combate: se **contempla**. Mirar tu sombra con cariño, sin juzgarla, es lo que libera la energía que guarda.",
  gift: "El don aparece solo cuando dejas de luchar con la sombra. No hay que ganárselo: hay que permitirlo.",
  siddhi: "No es una meta. Es lo que queda cuando el don se entrega del todo. Se intuye en momentos de gracia.",
};

const GK_SPHERES: Record<string, string> = {
  lifework: "Tu **Obra de vida**: lo que haces que hace que te vean. Contempla cómo te expresas cuando nadie te lo pide.",
  evolution: "Tu **Evolución**: el reto que te hace crecer. Lo que más te cuesta es, justo, lo que te madura.",
  radiance: "Tu **Irradiación**: tu salud y tu presencia física. Cuando cuidas tu cuerpo, tu luz se nota sin palabras.",
  purpose: "Tu **Propósito**: lo que pasa por sí solo cuando las tres anteriores están en paz. No se busca: llega.",
  attraction: "La **Atracción**, puerta de la Secuencia de Venus: a quién atraes y por qué. Las relaciones como espejo.",
  iq: "Tu **CI**: tu forma de pensar en las relaciones. Cómo tu mente se defiende o se abre.",
  eq: "Tu **CE**: tu inteligencia emocional. Lo que sientes y cómo lo compartes.",
  sq: "Tu **CS**: tu inteligencia espiritual. La capacidad de amar sin condiciones.",
  core: "Tu **Núcleo**: la herida más antigua y, a la vez, tu mayor fuerza. La puerta de la Perla (tu Vocación).",
  culture: "Tu **Cultura**: los grupos donde floreces. Con quién colaborar para que tu don crezca.",
  pearl: "Tu **Perla**: la prosperidad como efecto de la coherencia. Llega cuando todo lo demás está alineado.",
};

const GK_PARTS: DemoPart[] = [
  text("Las **Gene Keys** son 64 llaves. Cada una tiene tres frecuencias: **sombra**, **don** y **siddhi**. Tu perfil las coloca en once **esferas** del Camino Dorado. Con tus datos, verás tu llave en cada esfera."),
  chapter("Qué es una llave"),
  text("Cada llave es una energía con un espectro. La misma energía puede vivirse con miedo (sombra), con genio (don) o con gracia (siddhi). No hay que «subir»: se **contempla** con paciencia."),
  chapter("Sombra, don y siddhi"),
  { kind: "MODEL", data: { option: null, mode: "explore", layer: "gk-spectrum", focus: null, title: "Las tres frecuencias", intro: "", notes: GK_SPECTRUM } },
  chapter("Las esferas del Camino Dorado"),
  text("El Camino Dorado tiene tres secuencias: **Activación** (verde, tu genio), **Venus** (rojo, tu corazón) y **Perla** (azul, tu prosperidad). Empieza por la Activación: Obra de vida, Evolución, Irradiación y Propósito."),
  { kind: "MODEL", data: { option: null, mode: "explore", layer: "gk-spheres", focus: null, title: "Esfera a esfera", intro: "", notes: GK_SPHERES } },
  chapter("Contemplar"),
  text("Elige tu llave de la **Obra de vida**. Durante siete días, lee cada mañana su sombra, su don y su siddhi. No hagas nada con ello: solo obsérvate. Anota cada noche cuándo apareció la sombra y cuándo el don."),
  chapter("Repaso"),
  {
    kind: "QUIZ",
    data: {
      questions: [
        { q: "¿Cuántas Gene Keys hay?", options: ["12", "36", "64"], answer: 2, why: "Son 64, como los hexagramas del I Ching y las puertas de Human Design." },
        { q: "La sombra se…", options: ["Combate", "Contempla", "Ignora"], answer: 1, why: "Contemplarla con cariño es lo que libera el don." },
        { q: "¿Por qué secuencia se empieza?", options: ["Activación", "Venus", "Perla"], answer: 0, why: "La Activación (tu genio) es la base de las otras dos." },
      ],
    },
  },
  { kind: "GLOSSARY", data: { terms: [{ term: "Sombra", def: "La frecuencia del miedo de una llave." }, { term: "Don", def: "La misma energía vivida con aceptación: tu genio." }, { term: "Siddhi", def: "La expresión más alta, un estado de gracia." }, { term: "Esfera", def: "Cada lugar del Camino Dorado donde cae una de tus llaves." }] } },
];

const MOON_PHASES: Record<string, string> = {
  "0": "**Luna nueva**: siembra. Escribe tus intenciones; aún no hace falta saber cómo.",
  "1": "**Creciente**: el primer paso. Atrévete aunque no tengas todo claro.",
  "2": "**Cuarto creciente**: llegan los obstáculos. Decide qué sigues y qué no.",
  "3": "**Gibosa creciente**: afina. No empieces nada nuevo; pule lo que ya está en marcha.",
  "4": "**Luna llena**: todo se ve. Celebra, agradece y observa lo que se ilumina.",
  "5": "**Gibosa menguante**: comparte. Cuenta lo que aprendiste.",
  "6": "**Cuarto menguante**: suelta. Cierra, perdona, ordena.",
  "7": "**Menguante**: descansa. El vacío prepara la próxima siembra.",
};

const MOON_PARTS: DemoPart[] = [
  text("La Luna tarda **29,5 días** en dar una vuelta completa de fases. Cada fase tiene una energía. Aprender a acompañarlas es vivir con un ritmo más natural."),
  chapter("El ciclo lunar"),
  text("La fase depende del ángulo entre el Sol y la Luna vistos desde la Tierra: juntos, **luna nueva**; enfrentados, **luna llena**. Entre medias, la Luna crece (creciente) y decrece (menguante)."),
  chapter("Las 8 fases, una a una"),
  { kind: "MODEL", data: { option: null, mode: "explore", layer: "moon-phases", focus: null, title: "Toca cada fase", intro: "El punto dorado marca la fase de hoy. Con tus datos, la tuya al nacer sale marcada.", notes: MOON_PHASES } },
  chapter("Tu Luna natal"),
  text("La fase en la que naciste dice tu manera de empezar y terminar los ciclos. Mira en el modelo cuál es la tuya y léela despacio. ¿Te reconoces?"),
  chapter("Un ritual por fase"),
  text(`1. **Luna nueva**: escribe tres intenciones.
2. **Cuarto creciente**: revisa qué obstáculos han aparecido.
3. **Luna llena**: agradece y celebra lo conseguido.
4. **Cuarto menguante**: suelta lo que ya no sirve.

Repite el ciclo tres meses y compara.`),
  chapter("Repaso"),
  {
    kind: "QUIZ",
    data: {
      questions: [
        { q: "¿Cuánto dura un ciclo lunar?", options: ["Unos 29,5 días", "Una semana", "Un año"], answer: 0, why: "De una luna nueva a la siguiente pasan unos 29,5 días." },
        { q: "En luna llena, el Sol y la Luna están…", options: ["Juntos", "Enfrentados", "En ángulo recto"], answer: 1, why: "Enfrentados: la Luna se ve entera iluminada." },
        { q: "¿Qué toca en cuarto menguante?", options: ["Sembrar", "Soltar", "Celebrar"], answer: 1, why: "Es la fase de soltar, cerrar y ordenar." },
      ],
    },
  },
];

export async function seedSystemLessons(prisma: PrismaClient, creatorId: string): Promise<number> {
  let n = 0;
  if (await seedDemoLesson(prisma, creatorId, { courseSlug: "human-design-basics", moduleTitle: "Tu bodygraph por dentro", title: "Tus 9 centros y tu perfil", minutes: 145, parts: HD_PARTS })) n++;
  if (await seedDemoLesson(prisma, creatorId, { courseSlug: "gene-keys-activation", moduleTitle: "El Camino Dorado", title: "Esfera a esfera", minutes: 135, parts: GK_PARTS })) n++;
  if (await seedDemoLesson(prisma, creatorId, { courseSlug: "lunar-year", moduleTitle: "El ritmo de la Luna", title: "Las 8 fases de la Luna", minutes: 120, parts: MOON_PARTS })) n++;
  return n;
}
