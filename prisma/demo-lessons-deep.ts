/**
 * Más lecciones largas de ejemplo, con muchos modelos por partes y sus configuraciones: la carta entera de
 * Human Design (planetas a cada lado, puertas, canales, tipos, autoridades, perfiles), las Gene Keys por
 * colores (secuencias, las 64 llaves, el espectro, las líneas), la Luna en signos, casas y nodos, las
 * cualidades y los ángulos de la carta astral y las runas. Idempotente (seedDemoLesson).
 */
import type { PrismaClient } from "@prisma/client";
import type { AstroLayer, ModelMode } from "../lib/lesson-blocks";
import { demoChapter as chapter, demoText as text, seedDemoLesson, type DemoPart } from "./demo-lesson-mars";

const model = (layer: AstroLayer, title: string, option: string | null = null, intro = "", notes: Record<string, string> = {}, mode: ModelMode = "explore"): DemoPart => ({
  kind: "MODEL",
  data: { layer, option, focus: null, title, intro, notes, mode },
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

/** Tu diseño a fondo: las 9 capas avanzadas de Human Design, un capítulo cada una. */
const HD_ADVANCED: DemoPart[] = [
  text("Ya conoces tu tipo, tu autoridad y tus centros. Ahora vamos **a fondo**: los circuitos, tu definición, tu cruz, tus flechas, las líneas de cada puerta, el mandala, tus centros abiertos, el cielo de hoy y la pareja. Cada capítulo es un modelo para tocar con tu propio bodygraph."),
  chapter("Los circuitos", 25),
  text("Los 36 canales se agrupan en **circuitos**: familias de energía con una forma propia de vivir."),
  model("hd-circuits", "Las familias de canales"),
  chapter("Tu definición", 20),
  model("hd-definition", "Cómo se conectan tus centros"),
  chapter("La cruz de encarnación", 25),
  text("Tu **cruz** son cuatro puertas: el Sol y la Tierra de tu personalidad y de tu diseño. Es tu propósito."),
  model("hd-cross", "Las cuatro puertas de tu propósito"),
  chapter("Las 4 variables", 25),
  model("hd-variables", "Tus cuatro flechas"),
  chapter("Las 6 líneas de una puerta", 20),
  model("hd-gate-lines", "La puerta de tu Sol, línea a línea", "sun"),
  chapter("El mandala", 25),
  text("Las 64 puertas rodean el zodiaco. Así se ve de dónde sale cada una."),
  model("hd-mandala", "Las 64 puertas en su sitio"),
  chapter("Tus centros abiertos", 25),
  text("En tus centros abiertos recibes la energía de otros. Cada uno tiene una pregunta para no confundirla con la tuya."),
  model("hd-conditioning", "Las preguntas del no-ser"),
  chapter("Tránsitos de hoy", 20),
  model("hd-transits", "El cielo de hoy en tu bodygraph"),
  chapter("En pareja", 25),
  text("Guarda en «Mi energía» los datos de alguien importante para ti y mira cómo se conectan vuestros bodygraphs."),
  model("hd-partner", "Dos bodygraphs juntos"),
  chapter("Repaso", 10),
  quiz([
    { q: "¿Qué forma tu cruz de encarnación?", options: ["Tus 9 centros", "El Sol y la Tierra de los dos lados", "Tu Luna y tus nodos"], answer: 1, why: "Las cuatro puertas del Sol y la Tierra, de personalidad y de diseño." },
    { q: "Si tú tienes una puerta de un canal y la otra persona la otra, es…", options: ["Amistad", "Electromagnético", "Dominio"], answer: 1, why: "Juntas completáis el canal: atracción." },
    { q: "Un centro abierto es…", options: ["Un fallo", "Donde recibes la energía de otros", "Un centro que no sirve"], answer: 1, why: "Es tu lugar de sabiduría, si no te identificas con lo que recibes." },
  ]),
  glossary([
    ["Circuito", "Una familia de canales con una forma propia de energía."],
    ["Definición", "Cómo se conectan entre sí tus centros definidos."],
    ["Cruz de encarnación", "Las cuatro puertas de tu Sol y tu Tierra: tu propósito."],
    ["Variables", "Las cuatro flechas junto a la cabeza: cómo comer, dónde estar, qué te mueve y cómo ves."],
    ["Condicionamiento", "La energía de otros que amplificas en tus centros abiertos."],
  ]),
];

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

/** Tus llaves a fondo: las 6 capas avanzadas de Gene Keys, un capítulo cada una. */
const GK_ADVANCED: DemoPart[] = [
  text("Ya conoces tus esferas y tus secuencias. Ahora vamos **a fondo**: las familias de llaves, sus parejas, la rueda entera, las dos caras de cada sombra, la llave de hoy y un descenso por tu Secuencia de Venus. Cada capítulo es un modelo para tocar con tu propio perfil."),
  chapter("Los 21 anillos de codones", 25),
  text("Las 64 llaves se agrupan en **21 familias**, según el aminoácido que comparten. Lo que vive una llave resuena en las demás de su anillo."),
  model("gk-codons", "Las familias de llaves"),
  chapter("Las compañeras de programación", 20),
  model("gk-partners", "Las 32 parejas"),
  chapter("La rueda", 20),
  text("Las llaves siguen el zodiaco, igual que las puertas de Human Design. Aquí ves dónde caen tus esferas."),
  model("gk-wheel", "Las 64 llaves en círculo"),
  chapter("Las dos caras de la sombra", 25),
  text("Toda sombra tiene dos maneras de vivirse: **hacia dentro** (reprimida) y **hacia fuera** (reactiva)."),
  model("gk-shadows", "La sombra de tu Obra de vida", "lifework"),
  model("gk-shadows", "La sombra de tu Núcleo", "core"),
  chapter("Tu llave de hoy", 15),
  model("gk-today", "La llave que activa hoy el Sol"),
  chapter("La Secuencia de Venus a fondo", 35),
  text("Venus es la secuencia del corazón. Se recorre **hacia abajo**: de tus relaciones de hoy hasta tu herida más honda, que es también tu mayor don."),
  model("gk-venus", "El descenso de Venus"),
  chapter("Repaso", 10),
  quiz([
    { q: "Las compañeras de programación están…", options: ["Una al lado de la otra", "Una enfrente de la otra en la rueda", "En la misma esfera"], answer: 1, why: "Están enfrente en la rueda y se equilibran." },
    { q: "La cara reprimida de una sombra…", options: ["Sale hacia fuera", "Se vuelve hacia dentro", "Es el don"], answer: 1, why: "Reprimida: hacia dentro. Reactiva: hacia fuera." },
    { q: "¿Cuánto tiempo pasa el Sol en cada llave?", options: ["Un día", "Unos 5 o 6 días", "Un mes"], answer: 1, why: "El Sol recorre los 360° en un año: unos 5,7 días por llave." },
  ]),
  glossary([
    ["Anillo de codones", "Una familia de llaves que comparten aminoácido."],
    ["Compañera de programación", "La llave de enfrente en la rueda: su equilibrio."],
    ["Sombra reprimida", "La sombra vivida hacia dentro."],
    ["Sombra reactiva", "La sombra vivida hacia fuera."],
    ["Núcleo", "La herida más honda de la Secuencia de Venus, y su mayor don."],
  ]),
];

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

/** La Luna a fondo: las 8 capas avanzadas de la Luna, un capítulo cada una. */
const MOON_ADVANCED: DemoPart[] = [
  text("Ya conoces las fases y la Luna en tu carta. Ahora vamos **a fondo**: las lunas llenas del año, los eclipses, las horas fuera de curso, la Luna por tus casas, tu retorno lunar, las superlunas, las 28 mansiones y el gran ciclo de los nodos. Cada capítulo es un modelo con el cielo de verdad."),
  chapter("Las lunas llenas del año", 20),
  text("Cada luna llena tiene un **nombre** que viene de las estaciones. Algunas son superlunas, otras microlunas y, a veces, hay una luna azul."),
  model("moon-full13", "Las lunas llenas, con su nombre"),
  chapter("Los eclipses", 25),
  model("moon-eclipses", "Los eclipses de este año y del próximo"),
  chapter("La Luna fuera de curso", 20),
  text("Hay horas en las que la Luna ya no hace aspectos y aún no ha cambiado de signo. Lo que se empieza ahí tiende a no llegar a nada."),
  model("moon-void", "Las próximas horas fuera de curso"),
  chapter("La Luna por tus casas", 20),
  model("moon-transit-houses", "Por dónde pasa hoy la Luna en tu carta"),
  chapter("Tu retorno lunar", 15),
  model("moon-return", "Tu año nuevo emocional, cada mes"),
  chapter("Perigeo, apogeo y superlunas", 15),
  model("moon-apsides", "Cuando la Luna se acerca y se aleja"),
  chapter("Las 28 mansiones", 30),
  text("Antes que los signos, muchos pueblos dividían el camino de la Luna en **28 estaciones**, una por cada noche."),
  model("moon-mansions", "Las 28 mansiones lunares"),
  chapter("El ciclo de los nodos", 20),
  model("moon-node-cycle", "Tus retornos nodales"),
  chapter("Repaso", 10),
  quiz([
    { q: "Una luna azul es…", options: ["Una luna que se ve azul", "La segunda luna llena de un mes", "Un eclipse"], answer: 1, why: "Es la segunda luna llena de un mismo mes." },
    { q: "Una superluna ocurre cuando la luna llena está…", options: ["En el apogeo", "Cerca del perigeo", "En el nodo"], answer: 1, why: "Cerca del perigeo, el punto más cercano a la Tierra." },
    { q: "¿Cada cuánto vuelven los nodos a su sitio?", options: ["Cada año", "Cada 18,6 años", "Cada 29,5 años"], answer: 1, why: "Los nodos dan la vuelta al zodiaco en 18,6 años." },
  ]),
  glossary([
    ["Luna fuera de curso", "Las horas entre el último aspecto de la Luna en un signo y su entrada en el siguiente."],
    ["Retorno lunar", "Cuando la Luna vuelve al grado de tu Luna natal, cada 27,3 días."],
    ["Perigeo", "El punto de la órbita de la Luna más cercano a la Tierra."],
    ["Apogeo", "El punto más lejano."],
    ["Mansión lunar", "Cada una de las 28 partes del camino de la Luna."],
    ["Retorno nodal", "Cuando el Nodo Norte vuelve a su sitio natal, cada 18,6 años."],
  ]),
];

/* ------------------------------ Astrología y runas ------------------------------- */

/** La carta a fondo: las 13 capas de astrología avanzada, un capítulo cada una. */
const ASTRO_ADVANCED: DemoPart[] = [
  text("Ya conoces las piezas básicas de la carta. Ahora vamos a mirarla **a fondo**: cómo se sienten los planetas en cada signo, quién manda en tu carta, sus ejes, sus figuras, los ciclos de tu vida y el cielo de hoy. Cada capítulo es un modelo para tocar con tu propia carta."),
  chapter("Dignidades", 25),
  text("Un planeta no se siente igual en todos los signos: en unos está en casa y en otros, de visita difícil."),
  model("astro-dignities", "Dónde se siente cómodo cada planeta"),
  chapter("Regencias", 20),
  text("Cada signo tiene un planeta que lo gobierna. El que rige tu Ascendente es la **regente de tu carta**."),
  model("astro-rulers", "Quién manda en cada signo"),
  chapter("Los 6 ejes", 20),
  model("astro-axes", "Las dos mitades de cada lección"),
  chapter("Hemisferios y cuadrantes", 20),
  model("astro-hemis", "Dónde se concentra tu energía"),
  chapter("Figuras de aspectos", 25),
  text("Cuando tres o más planetas se unen con aspectos, forman **figuras**: dibujos con un sentido propio."),
  model("astro-patterns", "Las figuras de tu carta"),
  chapter("Puntos especiales", 20),
  model("astro-points", "Quirón, Lilith, los nodos y la Fortuna"),
  chapter("Planetas retrógrados", 20),
  model("astro-retro", "Cuando un planeta mira hacia atrás"),
  chapter("Los 36 decanatos", 25),
  model("astro-decans", "Cada signo en tres matices"),
  chapter("Los ciclos de la vida", 25),
  text("Hay edades en las que el cielo nos sacude a todas: los retornos de Saturno, la oposición de Urano… Mira dónde estás tú."),
  model("astro-cycles", "Tu línea de la vida"),
  chapter("Tránsitos de hoy", 20),
  model("astro-transits", "El cielo de hoy sobre tu carta"),
  chapter("Revolución solar y progresiones", 25),
  model("astro-progress", "Tu año y tu evolución"),
  chapter("Sinastría", 25),
  text("Guarda en «Mi energía» los datos de alguien importante para ti y mira cómo se tocan vuestras cartas."),
  model("astro-synastry", "Dos cartas juntas"),
  chapter("Tu balance", 15),
  model("astro-balance", "Tus elementos y tus cualidades"),
  chapter("Repaso", 10),
  quiz([
    { q: "¿Dónde está Marte en domicilio?", options: ["Aries y Escorpio", "Tauro y Libra", "Cáncer"], answer: 0, why: "Marte rige Aries (y tradicionalmente Escorpio)." },
    { q: "La regente de tu carta es…", options: ["El planeta que rige tu Sol", "El planeta que rige tu Ascendente", "Siempre el Sol"], answer: 1, why: "La regente es el planeta que gobierna el signo de tu Ascendente." },
    { q: "¿Hacia qué edad llega el primer retorno de Saturno?", options: ["21", "29-30", "42"], answer: 1, why: "Saturno tarda unos 29,5 años en volver a su sitio." },
    { q: "Tres planetas en trígono forman…", options: ["Una T-cuadrada", "Un gran trígono", "Un yod"], answer: 1, why: "El gran trígono: un triángulo de talento que fluye." },
  ]),
  glossary([
    ["Dignidad", "Lo cómodo o incómodo que está un planeta en un signo: domicilio, exaltación, exilio o caída."],
    ["Regente", "El planeta que gobierna un signo."],
    ["Decanato", "Cada tercio de diez grados de un signo."],
    ["Tránsito", "Un planeta del cielo de hoy tocando un punto de tu carta."],
    ["Progresión", "La carta que avanza un día por cada año de vida."],
    ["Sinastría", "La comparación de dos cartas."],
  ]),
];

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

/** Las runas a fondo: las 5 capas avanzadas, un capítulo cada una. */
const RUNES_ADVANCED: DemoPart[] = [
  text("Ya conoces las 24 runas y las tiradas sencillas. Ahora vamos **a fondo**: las runas del revés, sus elementos y sus dioses, dos tiradas grandes, las runas ligadas y el árbol de los nueve mundos. Tu **runa de nacimiento** sale marcada con una estrella."),
  chapter("Las runas invertidas", 25),
  text("Quince runas cambian de sentido si caen del revés. Las otras nueve son simétricas y se leen igual."),
  model("rune-reversed", "Las runas del revés"),
  chapter("Elementos y dioses", 25),
  model("rune-elements", "Las runas por elemento", "elements"),
  model("rune-elements", "Las runas por dios o diosa", "gods"),
  chapter("Tiradas grandes", 30),
  model("rune-big-spreads", "La tirada de nueve runas", "nine"),
  model("rune-big-spreads", "La cruz rúnica", "cross"),
  chapter("Las runas ligadas", 20),
  text("Una **runa ligada** une dos o tres runas en un solo signo, para llevarlo como amuleto."),
  model("rune-binds", "Ocho runas ligadas"),
  chapter("Yggdrasil", 25),
  text("El fresno del mundo sostiene **nueve mundos**: de los dioses en la copa a los antepasados en las raíces."),
  model("rune-yggdrasil", "Los nueve mundos y sus runas"),
  chapter("Repaso", 10),
  quiz([
    { q: "¿Cuántas runas se pueden invertir?", options: ["Las 24", "15", "9"], answer: 1, why: "15; las otras 9 son simétricas." },
    { q: "Una runa ligada es…", options: ["Una runa invertida", "Varias runas unidas en un signo", "Una tirada"], answer: 1, why: "Une dos o tres runas compartiendo sus trazos." },
    { q: "¿Qué mundo está en el centro de Yggdrasil?", options: ["Asgard", "Midgard", "Helheim"], answer: 1, why: "Midgard, la tierra del medio: la nuestra." },
  ]),
  glossary([
    ["Merkstave", "Una runa invertida: su energía bloqueada o vuelta hacia dentro."],
    ["Runa ligada", "Dos o tres runas unidas en un solo signo (bindrune)."],
    ["Yggdrasil", "El fresno que sostiene los nueve mundos."],
    ["Runa de nacimiento", "La runa del medio mes en que naciste, según el calendario rúnico."],
  ]),
];

export async function seedDeepLessons(prisma: PrismaClient, creatorId: string): Promise<number> {
  const lessons = [
    { courseSlug: "human-design-desde-cero", moduleTitle: "Tu carta entera", title: "Planetas, puertas y canales", minutes: 280, parts: HD_DEEP },
    { courseSlug: "human-design-desde-cero", moduleTitle: "Tu diseño a fondo", title: "Tu diseño a fondo", minutes: 220, parts: HD_ADVANCED },
    { courseSlug: "gene-keys-secuencia-de-activacion", moduleTitle: "Las llaves por colores", title: "Las 64 llaves y sus colores", minutes: 220, parts: GK_DEEP },
    { courseSlug: "gene-keys-secuencia-de-activacion", moduleTitle: "Tus llaves a fondo", title: "Tus llaves a fondo", minutes: 150, parts: GK_ADVANCED },
    { courseSlug: "especial-tu-ano-lunar", moduleTitle: "La Luna en tu carta", title: "La Luna en signos, casas y nodos", minutes: 195, parts: MOON_DEEP },
    { courseSlug: "especial-tu-ano-lunar", moduleTitle: "La Luna a fondo", title: "La Luna a fondo", minutes: 175, parts: MOON_ADVANCED },
    { courseSlug: "tu-carta-y-tu-energia", moduleTitle: "La estructura de la carta", title: "Cualidades y ángulos", minutes: 70, parts: ASTRO_DEEP },
    { courseSlug: "tu-carta-y-tu-energia", moduleTitle: "La carta a fondo", title: "La carta a fondo", minutes: 295, parts: ASTRO_ADVANCED },
    { courseSlug: "curso-conocete-tu-energia", moduleTitle: "Las runas", title: "Las 24 runas y sus tiradas", minutes: 100, parts: RUNES_DEEP },
    { courseSlug: "curso-conocete-tu-energia", moduleTitle: "Las runas a fondo", title: "Las runas a fondo", minutes: 135, parts: RUNES_ADVANCED },
  ];
  let n = 0;
  for (const l of lessons) if (await seedDemoLesson(prisma, creatorId, l)) n++;
  return n;
}
