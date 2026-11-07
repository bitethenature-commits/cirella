/**
 * La lección larga de ejemplo: «Marte, tu fuerza», en el curso «Tu carta y tu energía» de Ana. Once
 * capítulos con el modelo de la carta deconstruido por partes (planetas, signos, casas, aspectos y
 * elementos, con un texto de Ana para cada pieza), «Tu Marte» calculado con la carta de cada alumna,
 * «Marte hoy», un ejercicio, el repaso y el glosario. Así se ve cómo es una lección de varias horas.
 * Idempotente: si la lección ya existe, no hace nada. Lo usan prisma/seed.ts y scripts/add-demo-lesson.ts.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { BlockPart } from "../lib/lesson-blocks";

export const MARS_LESSON_TITLE = "Marte, tu fuerza";
const COURSE_SLUG = "tu-carta-y-tu-energia";
const MODULE_TITLE = "Los planetas, uno a uno";

type Part = { kind: "TEXT"; body: string } | BlockPart;
const text = (body: string): Part => ({ kind: "TEXT", body });
const chapter = (title: string, minutes: number): Part => ({ kind: "CHAPTER", data: { title, minutes } });

const SIGNS_NOTES: Record<string, string> = {
  "0": "**Domicilio.** Marte está en su casa: actúa sin pedir permiso, rápido y de frente. El reto es terminar lo que empieza y no confundir valentía con prisa.",
  "1": "**Exilio.** La fuerza va despacio y es tenaz: cuesta arrancar, pero nadie la mueve una vez en marcha. Se enfada poco y tarda en olvidar.",
  "2": "La energía se dispersa en mil frentes: muchas ideas, mucha palabra. Lucha con argumentos y se aburre de la rutina. Necesita variedad para no agotarse.",
  "3": "**Caída.** La rabia se vuelve hacia dentro o sale de lado (indirecta, en forma de herida). Defiende con uñas lo que ama: la familia, el hogar.",
  "4": "Actúa para ser vista y desde el corazón: generosa, orgullosa y dramática si la ignoran. Su fuerza crece cuando crea algo propio.",
  "5": "La fuerza se pone al servicio: trabaja mucho, mejora y corrige. Cuidado con la autoexigencia y con la crítica como forma de pelear.",
  "6": "**Exilio.** Le cuesta el conflicto directo: busca el acuerdo y duda antes de actuar. Lucha bien por la justicia de otras personas.",
  "7": "**Domicilio tradicional.** Intensa, estratégica y paciente: no ataca, espera. Una fuerza enorme que necesita un propósito profundo.",
  "8": "Actúa por una causa o una visión: entusiasta, aventurera e impaciente con lo pequeño. Su fuerza se enciende con el sentido.",
  "9": "**Exaltación.** La fuerza mejor administrada del zodiaco: constante, ambiciosa y con un plan a largo plazo. Llega lejos porque no se precipita.",
  "10": "Actúa en grupo y por ideas: rebelde, original e imprevisible. Lucha contra lo injusto y lo establecido, a veces por pura independencia.",
  "11": "La fuerza fluye como el agua: intuitiva, compasiva y a veces sin forma clara. Lucha mejor por otros que por sí misma; el arte la canaliza.",
};

const HOUSES_NOTES: Record<string, string> = {
  "1": "Tu energía se ve antes de que hables: presencia, empuje y cuerpo activo. Empiezas las cosas tú. Cuida la impulsividad y los golpes.",
  "2": "Pones la fuerza en ganarte la vida y defender lo tuyo. Te motiva la seguridad material; peleas por tu valor.",
  "3": "La palabra es tu espada: discutes, convences y escribes con fuerza. Mucho movimiento cotidiano; posibles roces con hermanos o vecinos.",
  "4": "La energía se juega en casa y en la familia: reformas, mudanzas y también tensiones del origen. Defiendes tu raíz.",
  "5": "Tu fuerza crea: deporte, arte, juego, conquista. Amas con pasión y te arriesgas. Los hijos o los proyectos propios te encienden.",
  "6": "Trabajadora incansable: la energía va al día a día, la rutina y el cuerpo. Necesitas movimiento para no somatizar el estrés.",
  "7": "La energía aparece a través de la pareja y los socios: atraes personas fuertes o el conflicto llega por el otro. Aprendes a pelear de igual a igual.",
  "8": "Fuerza profunda: crisis, sexualidad, dinero compartido. Transformas lo que tocas y no temes ir al fondo.",
  "9": "Actúas por tus creencias: viajes, estudios, causas. Defiendes tu verdad con pasión; cuidado con el fanatismo.",
  "10": "Tu fuerza quiere verse en tu vocación: ambición, liderazgo y huella pública. Compites por tu lugar y lo construyes.",
  "11": "La energía va a los grupos y a los proyectos de futuro: lideras amistades o movimientos. Posibles choques de ideas en equipo.",
  "12": "Fuerza escondida: actúas entre bastidores o te cuesta mostrar la rabia. Brilla en el retiro, el servicio, lo espiritual y el trabajo interior.",
};

const ASPECT_NOTES: Record<string, string> = {
  conjunction: "Marte se funde con otro planeta y le presta su fuego: con el Sol, voluntad enorme; con Venus, deseo y magnetismo; con Saturno, fuerza contenida que se vuelve resistencia.",
  sextile: "Oportunidad de usar tu energía con soltura en lo que ese planeta representa. Hay que activarla: si no haces nada, no pasa nada.",
  square: "Fricción que obliga a actuar. Marte en cuadratura crea tensión, prisa o conflicto… y es el motor de muchos logros. Pide canalizar, no reprimir.",
  trine: "La fuerza fluye sin esfuerzo con ese planeta. Talento natural para la acción en ese terreno; el riesgo es darlo por hecho.",
  quincunx: "Dos energías que no se entienden: la acción va por un lado y la otra necesidad por otro. Pide ajustes pequeños y constantes.",
  opposition: "Tu fuerza se encuentra en el espejo: el conflicto llega a través de otras personas hasta que integras los dos lados. Equilibrar empuje y escucha.",
};

const PLANET_NOTES: Record<string, string> = {
  mars: "**Marte** es la energía que se mueve hacia lo que quiere: deseo, valentía, rabia, sexualidad, deporte, competición. Dice *cómo* vas a por las cosas.",
  venus: "Venus es lo que atrae y Marte, lo que va a buscarlo. Juntos describen tu deseo: qué te gusta (Venus) y cómo lo persigues (Marte).",
  sun: "El Sol es quién eres; Marte, la energía para ser eso. Si se llevan bien, tu voluntad y tu fuerza van en la misma dirección.",
  saturn: "Saturno es el freno y Marte, el acelerador. Entre los dos aprendes a dosificar: fuerza con estructura, paciencia con empuje.",
  moon: "La Luna es lo que necesitas para sentirte a salvo; Marte, cómo te defiendes. Su relación cuenta cómo reaccionas cuando algo te hiere.",
  pluto: "Plutón lleva a Marte al extremo: poder, intensidad, transformación. Con aspectos entre ellos, la fuerza es volcánica y hay que darle cauce.",
};

const ELEMENT_NOTES: Record<string, string> = {
  Fuego: "Marte en fuego (Aries, Leo, Sagitario) actúa por impulso y entusiasmo: rápido, valiente, directo. Necesita retos para no apagarse.",
  Tierra: "Marte en tierra (Tauro, Virgo, Capricornio) actúa con constancia y resultados: lento al empezar, imparable después.",
  Aire: "Marte en aire (Géminis, Libra, Acuario) actúa con la mente y la palabra: pelea con ideas y necesita sentido y diálogo.",
  Agua: "Marte en agua (Cáncer, Escorpio, Piscis) actúa desde la emoción: defiende lo que ama, intuye el momento y puede guardar la rabia.",
};

export const MARS_PARTS: Part[] = [
  text(
    "Esta lección es larga a propósito: **Marte** es una de las energías que más cambia tu vida cuando la entiendes. Ve a tu ritmo, capítulo a capítulo. Se guarda dónde lo dejas.",
  ),
  chapter("Mito y símbolo", 12),
  text(`## El dios de la guerra… y de la primavera

En Roma, **Marte** era el dios de la guerra, pero antes fue el dios de los campos y de la primavera: la fuerza que rompe la tierra para que salga la semilla. Por eso su mes es **marzo**, cuando todo empieza.

Su símbolo ♂︎ es un círculo (el espíritu) con una flecha que sale hacia fuera: **la energía que va hacia algo**. Es el mismo símbolo que se usa para lo masculino, pero en tu carta habla de ti, seas quien seas.

- Su color es el rojo; su metal, el hierro (el de tu sangre).
- Tarda unos **dos años** en dar la vuelta al zodiaco: pasa casi dos meses en cada signo.
- Cada dos años y poco se vuelve **retrógrado** unas diez semanas.`),
  chapter("Qué rige en ti", 15),
  text(`Marte habla de **cómo vas a por lo que quieres**. En tu carta describe:

- **Tu energía y tu fuerza física**: cuánta tienes y cómo la gastas.
- **Tu deseo**: lo que te mueve y cómo lo persigues.
- **Tu rabia**: qué te enfada y qué haces con ello.
- **Tu valentía**: cómo te defiendes y defiendes a otros.
- **Tu forma de competir, trabajar y hacer deporte.**

Un Marte bien vivido es iniciativa sana; reprimido, se vuelve cansancio, rabia escondida o dolores. Mira cómo se relaciona con los demás planetas: toca cada uno.`),
  { kind: "MODEL", data: { option: null, layer: "planets", focus: "mars", title: "Marte y los demás planetas", intro: "Cada planeta es una parte de ti. Toca uno para ver cómo se relaciona con Marte.", notes: PLANET_NOTES } },
  chapter("Marte en los 12 signos", 40),
  text("El **signo** dice *cómo* actúa tu Marte: su estilo. Hay signos donde está muy a gusto (domicilio y exaltación) y otros donde le cuesta (exilio y caída). Recorre los doce: el tuyo sale marcado."),
  { kind: "MODEL", data: { option: null, layer: "signs", focus: "mars", title: "El estilo de tu fuerza", intro: "", notes: SIGNS_NOTES } },
  chapter("Marte en las 12 casas", 35),
  text("La **casa** dice *dónde* pones tu energía: en qué parte de la vida actúas, compites y te defiendes. Sin hora de nacimiento no hay casas: entonces quédate con el signo."),
  { kind: "MODEL", data: { option: null, layer: "houses", focus: "mars", title: "Dónde pones tu energía", intro: "", notes: HOUSES_NOTES } },
  chapter("Sus aspectos", 30),
  text("Los **aspectos** son las conversaciones de Marte con otros planetas: el ángulo entre ellos dice si se ayudan, chocan o se funden. Toca cada línea: el ángulo, el significado y cómo lo vive Marte."),
  { kind: "MODEL", data: { option: null, layer: "aspects", focus: "mars", title: "Cómo conversa Marte", intro: "", notes: ASPECT_NOTES } },
  chapter("Dignidades y elementos", 15),
  text(`Cada planeta se siente más o menos cómodo según el signo:

- **Domicilio**: Aries (y Escorpio, en la tradición). En casa.
- **Exaltación**: Capricornio. Su mejor versión.
- **Exilio**: Libra y Tauro. Lejos de casa, tiene que adaptarse.
- **Caída**: Cáncer. Donde más le cuesta mostrarse.

No es «bueno» o «malo»: un Marte en caída enseña a defender sin herir. El **elemento** del signo te da la primera pista de su ritmo.`),
  { kind: "MODEL", data: { option: null, layer: "elements", focus: "mars", title: "Marte en los cuatro elementos", intro: "", notes: ELEMENT_NOTES } },
  chapter("Marte retrógrado", 15),
  text(`Cada dos años, Marte parece ir hacia atrás unas diez semanas. **Retrógrado** es una ilusión óptica desde la Tierra, pero su lectura es clara: la energía se vuelve hacia dentro.

- Si naciste con Marte retrógrado (℞), tu fuerza se revisa antes de salir: piensas la acción, la rumias, y cuando actúas, va en serio.
- Cuando Marte está retrógrado en el cielo es buen momento para **revisar, terminar y recuperar fuerzas**, no para empezar guerras ni grandes proyectos.`),
  chapter("Tu Marte", 20),
  { kind: "MYCHART", data: { focus: "mars", title: "" } },
  text("Lee despacio tu Marte: el signo, la casa y sus aspectos. ¿En qué momentos de tu vida lo reconoces? Anota tres situaciones en las que actuaste así."),
  chapter("Marte hoy en el cielo", 10),
  { kind: "TODAY", data: { focus: "mars", title: "" } },
  chapter("Práctica y diario", 20),
  text(`## Ejercicio: tu mapa de la fuerza

1. Escribe en una hoja tu Marte: signo, casa y aspectos.
2. Durante **siete días**, cada noche, anota un momento en que sentiste rabia, deseo o empuje. ¿Qué lo encendió? ¿Qué hiciste?
3. Al final de la semana, busca el patrón. ¿Se parece a tu signo? ¿Pasa siempre en la misma parte de la vida (tu casa)?
4. Elige **un gesto** para dar cauce a tu Marte esta semana: un deporte, una conversación pendiente, empezar algo.

> Marte no se calma reprimiéndolo: se calma dándole un camino.`),
  chapter("Repaso", 10),
  {
    kind: "QUIZ",
    data: {
      questions: [
        { q: "¿Qué describe Marte en tu carta?", options: ["Cómo amas", "Cómo vas a por lo que quieres", "Tu familia"], answer: 1, why: "Marte es la energía que se mueve hacia algo: deseo, acción y valentía. Cómo amas es más bien Venus." },
        { q: "¿En qué signo está Marte en domicilio?", options: ["Libra", "Aries", "Cáncer"], answer: 1, why: "Aries es su casa (y Escorpio, en la tradición). En Libra está en exilio y en Cáncer, en caída." },
        { q: "¿Y en exaltación?", options: ["Capricornio", "Leo", "Piscis"], answer: 0, why: "En Capricornio la fuerza se administra con un plan a largo plazo: su mejor versión." },
        { q: "¿Qué dice la casa de Marte?", options: ["Su estilo", "Dónde pones tu energía", "Cuándo naciste"], answer: 1, why: "El signo es el estilo (cómo); la casa, el terreno (dónde)." },
        { q: "Una cuadratura de Marte con otro planeta…", options: ["Es siempre mala", "Crea fricción que obliga a actuar", "No significa nada"], answer: 1, why: "La cuadratura es tensión productiva: motor de logros si se canaliza." },
        { q: "¿Cuánto tarda Marte en recorrer el zodiaco?", options: ["Un mes", "Unos dos años", "Doce años"], answer: 1, why: "Unos dos años: casi dos meses en cada signo." },
        { q: "Marte retrógrado en el cielo es buen momento para…", options: ["Empezar una guerra", "Revisar y recuperar fuerzas", "Nada en especial"], answer: 1, why: "Con la energía vuelta hacia dentro, toca revisar y terminar." },
        { q: "Marte en Aire actúa sobre todo…", options: ["Con la mente y la palabra", "Desde la emoción", "Con constancia material"], answer: 0, why: "Géminis, Libra y Acuario: pelea con ideas y necesita diálogo." },
      ],
    },
  },
  {
    kind: "GLOSSARY",
    data: {
      terms: [
        { term: "Domicilio", def: "El signo que rige un planeta: allí se siente en casa (Marte en Aries)." },
        { term: "Exaltación", def: "El signo donde un planeta da su mejor versión (Marte en Capricornio)." },
        { term: "Exilio", def: "El signo opuesto al domicilio: el planeta tiene que adaptarse (Marte en Libra)." },
        { term: "Caída", def: "El signo opuesto a la exaltación: donde más le cuesta mostrarse (Marte en Cáncer)." },
        { term: "Aspecto", def: "El ángulo entre dos planetas: dice cómo se relacionan sus energías." },
        { term: "Orbe", def: "Cuántos grados puede separarse un aspecto del ángulo exacto y seguir contando." },
        { term: "Retrógrado (℞)", def: "Cuando, visto desde la Tierra, un planeta parece ir hacia atrás." },
        { term: "Tránsito", def: "Dónde está un planeta hoy y qué toca de tu carta natal." },
      ],
    },
  },
];

const MARS_MINUTES = 222;

export type DemoPart = Part;

/**
 * Crea una lección larga de ejemplo en un curso de la dueña (por su slug), en un módulo nuevo al final.
 * Todo en una transacción: si algo falla, no queda una lección vacía. Si ya existe (mismo título), nada.
 */
export async function seedDemoLesson(
  prisma: PrismaClient,
  creatorId: string,
  l: { courseSlug: string; moduleTitle: string; title: string; minutes: number; parts: Part[] },
): Promise<string | null> {
  const course = await prisma.product.findFirst({ where: { creatorId, slug: l.courseSlug } });
  if (!course) return null;
  if (await prisma.lesson.findFirst({ where: { productId: course.id, title: l.title }, select: { id: true } })) return null;
  return prisma.$transaction(async (tx) => {
    const modCount = await tx.courseModule.count({ where: { productId: course.id } });
    const mod = await tx.courseModule.create({ data: { creatorId, productId: course.id, title: l.moduleTitle, sortOrder: modCount } });
    const lesson = await tx.lesson.create({
      data: { creatorId, productId: course.id, moduleId: mod.id, title: l.title, durationMin: l.minutes, sortOrder: 0, kind: "TEXT", published: true },
    });
    await tx.lessonPart.createMany({
      data: l.parts.map((p, i) => ({
        creatorId,
        productId: course.id,
        lessonId: lesson.id,
        sortOrder: i,
        kind: p.kind,
        body: p.kind === "TEXT" ? p.body : null,
        bodyFormat: p.kind === "TEXT" ? "MD" : null,
        data: p.kind === "TEXT" ? undefined : (p.data as unknown as Prisma.InputJsonValue),
      })),
    });
    return lesson.id;
  });
}

export function seedMarsLesson(prisma: PrismaClient, creatorId: string): Promise<string | null> {
  return seedDemoLesson(prisma, creatorId, { courseSlug: COURSE_SLUG, moduleTitle: MODULE_TITLE, title: MARS_LESSON_TITLE, minutes: MARS_MINUTES, parts: MARS_PARTS });
}

export const demoText = text;
export const demoChapter = chapter;