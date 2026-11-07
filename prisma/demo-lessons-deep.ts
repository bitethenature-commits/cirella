/**
 * Más lecciones largas de ejemplo, con muchos modelos por partes y sus configuraciones: la carta entera de
 * Human Design (planetas a cada lado, puertas, canales, tipos, autoridades, perfiles), las Gene Keys por
 * colores (secuencias, las 64 llaves, el espectro, las líneas), la Luna en signos, casas y nodos, las
 * cualidades y los ángulos de la carta astral y las runas. Idempotente (seedDemoLesson).
 */
import type { PrismaClient } from "@prisma/client";
import type { AstroLayer } from "../lib/lesson-blocks";
import { demoChapter as chapter, demoText as text, seedDemoLesson, type DemoPart } from "./demo-lesson-mars";

const model = (layer: AstroLayer, title: string, option: string | null = null, intro = "", notes: Record<string, string> = {}): DemoPart => ({
  kind: "MODEL",
  data: { layer, option, focus: null, title, intro, notes },
});

const quiz = (questions: { q: string; options: string[]; answer: number; why: string }[]): DemoPart => ({ kind: "QUIZ", data: { questions } });
const glossary = (terms: [string, string][]): DemoPart => ({ kind: "GLOSSARY", data: { terms: terms.map(([term, def]) => ({ term, def })) } });

/* ---------------------------------- Human Design ---------------------------------- */

const HD_DEEP: DemoPart[] = [
  text("Tu bodygraph no es solo nueve centros: son **26 activaciones** (13 planetas en dos momentos), **64 puertas** y **36 canales**. De ahí salen tu **tipo**, tu **autoridad** y tu **perfil**. En esta lección lo desmontamos pieza a pieza, siempre sobre tu propia carta."),
  chapter("Los planetas a cada lado", 35),
  text("A la **izquierda, en rojo**, el **diseño**: dónde estaban los planetas unos 88 días antes de nacer. Es tu cuerpo, lo inconsciente. A la **derecha, en negro**, la **personalidad**: el instante de nacer, lo que reconoces como tuyo. Cada planeta cae en una puerta y una línea (41.3 = puerta 41, línea 3)."),
  model("hd-planets", "Las 26 activaciones", "both", "Toca un planeta: su puerta se enciende en el bodygraph.", {
    "p-sun": "Tu **Sol consciente** es la puerta que más pesa en tu vida: léela muchas veces.",
    "d-sun": "El **Sol de diseño** es lo que tu cuerpo hace sin pedir permiso. Otros lo ven antes que tú.",
    "d-moon": "La **Luna de diseño** es tu fuerza motriz y, en las Gene Keys, tu Atracción.",
  }),
  model("hd-planets", "Solo tu lado inconsciente", "design", "Mira solo el rojo: lo que tu cuerpo vive sin que lo decidas."),
  chapter("Las 64 puertas", 50),
  text("Cada centro tiene sus puertas. Una puerta activada (con color) es una energía fija en ti; las vacías las recibes de otros. Toca un número para leer su nombre, su tema y con qué puerta forma canal."),
  model("hd-gates", "Toca cada puerta", "all"),
  model("hd-gates", "Tus puertas activadas", "mine", "Solo las tuyas: en negro (personalidad), rojo (diseño) o las dos."),
  model("hd-gates", "Las puertas del Sacro", "sacral", "Las nueve puertas del motor de los Generadores.", {
    "34": "La puerta del **poder**: energía para hacer lo que te mueve, sin dar explicaciones.",
    "5": "La puerta de los **ritmos fijos**: tus rutinas son tu fuerza.",
  }),
  chapter("Los 36 canales", 45),
  text("Un **canal** une dos puertas de dos centros. Si tienes las dos, el canal se define (en dorado) y los dos centros se colorean. Si solo tienes una, es una **puerta colgante**: buscas su otra mitad en otras personas."),
  model("hd-channels", "Toca cada canal", "all"),
  model("hd-channels", "Tus canales definidos", "mine"),
  model("hd-channels", "El circuito tribal", "tribal", "Los canales del sostén: familia, comunidad, recursos, el apretón de manos."),
  chapter("Los 5 tipos", 30),
  text("El tipo sale de qué centros están definidos y de si un motor llega a la Garganta. Cada tipo tiene una **estrategia**, una **firma** (lo que sientes cuando vives bien) y un **tema del no-ser** (la alarma de que te has salido)."),
  model("hd-types", "Las cinco auras"),
  chapter("Las 7 autoridades", 30),
  text("La autoridad es **cómo decides bien**. Sigue una jerarquía: si tienes el Plexo Solar definido, manda la emoción; si no, el Sacro; luego el Bazo, el Corazón, el G… Toca un centro o una autoridad."),
  model("hd-authorities", "Dónde está tu verdad"),
  chapter("Los 12 perfiles", 30),
  text("Tu perfil son las dos líneas de tus Soles. Los perfiles se agrupan en tres **ángulos**: derecho (un destino personal), yuxtaposición (un destino fijo) e izquierdo (un destino que tiene que ver con otros)."),
  model("hd-lines", "Las seis líneas"),
  model("hd-profiles", "Los doce perfiles"),
  chapter("Práctica", 20),
  text("Elige **una puerta tuya** al día durante una semana. Por la mañana lee su tema; por la noche anota dónde apareció. Al final de la semana, mira si tus puertas colgantes se encendieron con alguien concreto."),
  chapter("Repaso", 10),
  quiz([
    { q: "¿De qué color va el diseño (lo inconsciente)?", options: ["Negro", "Rojo", "Dorado"], answer: 1, why: "El diseño se dibuja en rojo; la personalidad, en negro." },
    { q: "¿Cuántas puertas tiene un bodygraph?", options: ["36", "64", "9"], answer: 1, why: "64 puertas, como los hexagramas del I Ching." },
    { q: "Si tienes una sola puerta de un canal, es…", options: ["Un canal definido", "Una puerta colgante", "Un centro abierto"], answer: 1, why: "Una puerta colgante: el canal se enciende cuando alguien trae la otra mitad." },
    { q: "La estrategia del Proyector es…", options: ["Informar", "Responder", "Esperar la invitación"], answer: 2, why: "El Proyector brilla cuando lo reconocen e invitan." },
    { q: "Con el Plexo Solar definido, tu autoridad es…", options: ["Sacral", "Emocional", "Esplénica"], answer: 1, why: "La emocional está arriba de la jerarquía: si el Plexo está definido, manda él." },
  ]),
  glossary([
    ["Activación", "Un planeta en una puerta y una línea (por ejemplo, Sol 41.3)."],
    ["Personalidad", "En negro: el instante de nacer, lo consciente."],
    ["Diseño", "En rojo: unos 88 días antes de nacer, lo inconsciente, el cuerpo."],
    ["Canal", "La unión de dos puertas; si tienes las dos, se define."],
    ["Puerta colgante", "Una puerta de un canal sin su pareja."],
    ["Autoridad", "Tu forma fiable de decidir."],
    ["Perfil", "Las líneas de tus dos Soles."],
  ]),
];

/* ----------------------------------- Gene Keys ------------------------------------ */

const GK_DEEP: DemoPart[] = [
  text("Las Gene Keys se leen **por colores**: verde la Activación, rojo Venus, azul la Perla. Cada esfera guarda una de tus llaves, con su número y su línea (por ejemplo 41.3). En esta lección recorremos las tres secuencias, las 64 llaves y las seis líneas."),
  chapter("Las tres secuencias", 30),
  model("gk-sequences", "Toca un color", null, "Toca una esfera o un color: se enciende su secuencia entera."),
  chapter("La Secuencia de Venus", 40),
  text("Venus es el camino del corazón: empieza en tu **Atracción** y baja hasta tu **Núcleo**, la herida más antigua. Se recorre despacio."),
  model("gk-spheres", "Venus, esfera a esfera", "venus"),
  chapter("La Secuencia de la Perla", 30),
  text("La Perla habla de la prosperidad como efecto secundario: tu **Vocación** (el Núcleo), tu **Cultura**, tu **Marca** (la Obra de vida) y la **Perla**."),
  model("gk-spheres", "La Perla, esfera a esfera", "pearl"),
  chapter("Las 64 llaves", 45),
  text("Las 64 llaves, con tus llaves en el color de su secuencia. Cada llave tiene una **compañera de programación**, la que está enfrente en la rueda: contemplar una ayuda a abrir la otra."),
  model("gk-keys", "Las 64 llaves", "all"),
  model("gk-keys", "Solo tus llaves", "mine"),
  chapter("El espectro de tu Evolución", 25),
  text("La Evolución es tu reto, lo que te hace crecer. Mira su sombra con cariño: ahí está escondido el don."),
  model("gk-spectrum", "Sombra, don y siddhi de tu Evolución", "evolution"),
  chapter("Las seis líneas", 25),
  text("La línea dice **cómo** vives una llave en una esfera. Los puntos de color al lado de cada línea son tus esferas que la tienen."),
  model("gk-lines", "Las seis líneas"),
  chapter("Contemplar", 15),
  text("Elige la llave de tu **Atracción**. Una semana: cada vez que alguien te atraiga o te moleste mucho, recuerda su sombra y su don. ¿Qué te está mostrando esa persona de ti?"),
  chapter("Repaso", 10),
  quiz([
    { q: "¿De qué color es la Secuencia de Venus?", options: ["Verde", "Rojo", "Azul"], answer: 1, why: "Activación verde, Venus rojo, Perla azul." },
    { q: "La compañera de programación de una llave es…", options: ["La siguiente", "La de enfrente en la rueda", "La de la misma esfera"], answer: 1, why: "Está enfrente en la rueda: se equilibran." },
    { q: "La línea de una esfera dice…", options: ["Cuánto vale", "Cómo vives esa llave allí", "Tu edad"], answer: 1, why: "La línea es el modo, el cómo." },
  ]),
  glossary([
    ["Secuencia", "Un grupo de esferas con un tema: Activación, Venus o Perla."],
    ["Compañera de programación", "La llave opuesta en la rueda, que equilibra a la otra."],
    ["Línea", "El número tras el punto (41.3): cómo vives la llave en esa esfera."],
  ]),
];

/* -------------------------------------- Luna -------------------------------------- */

const MOON_DEEP: DemoPart[] = [
  text("La Luna recorre los 12 signos en unos 27 días: pasa dos días y medio en cada uno. Tu **Luna natal** está en un signo y en una casa, y sus **nodos** marcan tu camino. En esta lección lo vemos todo."),
  chapter("Tu Luna natal en los signos", 40),
  text("El signo de tu Luna dice **qué necesitas para sentirte a salvo**. No es lo que muestras: es lo que te calma."),
  model("moon-signs", "Luna en cada signo", "natal"),
  chapter("La Luna de cada día", 25),
  text("La Luna del cielo cambia de signo cada dos días y medio. El punto dorado marca dónde está hoy."),
  model("moon-signs", "El clima de cada signo", "sky"),
  chapter("Lunas nuevas y lunas llenas", 40),
  text("Cada **luna nueva** cae en un signo: es la semilla del mes. Cada **luna llena** ilumina un eje: la Luna en un signo y el Sol enfrente."),
  model("moon-signs", "Qué sembrar en cada luna nueva", "new"),
  model("moon-signs", "Qué soltar en cada luna llena", "full"),
  chapter("La Luna en las 12 casas", 30),
  text("La casa de tu Luna dice **dónde** buscas refugio. Hace falta la hora de nacimiento."),
  model("moon-houses", "Dónde está tu refugio"),
  chapter("Los nodos lunares", 30),
  text("Los nodos son los puntos donde la Luna cruza el camino del Sol. El **Sur** es lo conocido; el **Norte**, hacia dónde creces."),
  model("moon-nodes", "Tu eje de los nodos"),
  chapter("Las 8 fases", 20),
  model("moon-phases", "Las ocho fases"),
  chapter("Repaso", 10),
  quiz([
    { q: "¿Cuánto tiempo pasa la Luna en cada signo?", options: ["Un mes", "Unos dos días y medio", "Una semana"], answer: 1, why: "Recorre los 12 signos en unos 27 días." },
    { q: "En una luna llena en Aries, el Sol está en…", options: ["Aries", "Libra", "Cáncer"], answer: 1, why: "En luna llena el Sol está enfrente: Libra." },
    { q: "El Nodo Norte habla de…", options: ["Lo conocido", "Hacia dónde creces", "Tu familia"], answer: 1, why: "El Sur es lo que traes; el Norte, lo que vienes a aprender." },
  ]),
  glossary([
    ["Luna natal", "Dónde estaba la Luna al nacer: tus necesidades emocionales."],
    ["Nodos lunares", "Los cruces de la órbita de la Luna con el camino del Sol; ahí ocurren los eclipses."],
  ]),
];

/* ------------------------------ Astrología y runas ------------------------------- */

const ASTRO_DEEP: DemoPart[] = [
  text("Dos capas que casi nadie explica bien: las **tres cualidades** (cómo se mueve cada signo) y los **cuatro ángulos** (la cruz de tu carta)."),
  chapter("Las tres cualidades", 30),
  model("modalities", "Empezar, sostener, adaptarse"),
  chapter("Los cuatro ángulos", 30),
  text("El horizonte (Ascendente-Descendente) y el meridiano (Medio Cielo-Fondo del Cielo) dividen la carta en cuatro. Hace falta la hora de nacimiento."),
  model("angles", "La cruz de tu carta"),
  chapter("Repaso", 10),
  quiz([
    { q: "¿Qué signos son cardinales?", options: ["Aries, Cáncer, Libra, Capricornio", "Tauro, Leo, Escorpio, Acuario", "Géminis, Virgo, Sagitario, Piscis"], answer: 0, why: "Los cardinales abren cada estación." },
    { q: "El Ascendente está…", options: ["Arriba", "A la izquierda", "Abajo"], answer: 1, why: "En la carta, el Ascendente va a la izquierda, por donde sale el Sol." },
  ]),
];

const RUNES_DEEP: DemoPart[] = [
  text("Las 24 runas del **Futhark antiguo** se ordenan en tres familias de ocho, los **aettir**: el de Freyr (la vida y el mundo), el de Hagal (las fuerzas que no controlas) y el de Tyr (lo humano y lo sagrado)."),
  chapter("Las 24 runas", 40),
  model("rune-aettir", "Toca cada runa", "all"),
  chapter("El aett de Freyr", 20),
  model("rune-aettir", "Las ocho primeras", "0"),
  chapter("Las tiradas", 30),
  text("En una tirada, cada posición hace una pregunta. La runa que cae allí se lee desde esa pregunta."),
  model("rune-spreads", "Tres runas", "three"),
  model("rune-spreads", "La cruz de cinco", "five"),
  chapter("Repaso", 10),
  quiz([
    { q: "¿Cuántas runas tiene el Futhark antiguo?", options: ["12", "24", "36"], answer: 1, why: "24, en tres aettir de ocho." },
    { q: "Una runa invertida se llama…", options: ["Merkstave", "Aett", "Galdr"], answer: 0, why: "Merkstave: la runa al revés, su energía bloqueada o vuelta hacia dentro." },
  ]),
];

export async function seedDeepLessons(prisma: PrismaClient, creatorId: string): Promise<number> {
  const lessons = [
    { courseSlug: "human-design-desde-cero", moduleTitle: "Tu carta entera", title: "Planetas, puertas y canales", minutes: 280, parts: HD_DEEP },
    { courseSlug: "gene-keys-secuencia-de-activacion", moduleTitle: "Las llaves por colores", title: "Las 64 llaves y sus colores", minutes: 220, parts: GK_DEEP },
    { courseSlug: "especial-tu-ano-lunar", moduleTitle: "La Luna en tu carta", title: "La Luna en signos, casas y nodos", minutes: 195, parts: MOON_DEEP },
    { courseSlug: "tu-carta-y-tu-energia", moduleTitle: "La estructura de la carta", title: "Cualidades y ángulos", minutes: 70, parts: ASTRO_DEEP },
    { courseSlug: "curso-conocete-tu-energia", moduleTitle: "Las runas", title: "Las 24 runas y sus tiradas", minutes: 100, parts: RUNES_DEEP },
  ];
  let n = 0;
  for (const l of lessons) if (await seedDemoLesson(prisma, creatorId, l)) n++;
  return n;
}
