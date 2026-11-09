"use client";

import type { ReactNode } from "react";
import type { Element } from "@/components/models/data/astrology";
import type { AstroLayer } from "@/lib/lesson-blocks";
import { C, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { GeoFigure, lifePath, numberFig, sunElement, type E } from "./geo";
import { NIGHT, NIGHT_GOLD, NightChips, NightDefs, NightPanel, OptionChips, STAR, usePrefix } from "./night";

/**
 * Leer cualquier oráculo, por partes: cómo hacer una lectura, cómo preguntar, las tiradas, los símbolos, los
 * números, los colores, los elementos, las señales (invertidas, saltadas, repetidas…) y cómo crear tu propia
 * baraja. Sirve con cualquier baraja de oráculo. Con la fecha de nacimiento, se marca lo de la alumna (su
 * número de vida y su color, y el elemento de su Sol).
 */

export type OracleLayer = Extract<AstroLayer, `orc-${string}`>;
export const isOracleLayer = (l: string): l is OracleLayer => l.startsWith("orc-");

type T = { name: string; kicker: string; meaning: string };

/* ------------------------------------------------------------ las tiradas */

type Pos = { name: string; hint: string; x: number; y: number };
const horseshoe = ["El pasado", "El presente", "Lo que viene", "Tú", "Lo que te rodea", "Lo que te frena", "El resultado"];
const horseshoeHint = ["Lo que trae la situación hasta aquí.", "Cómo está hoy.", "Lo que se acerca si nada cambia.", "Tu actitud, lo que tú aportas.", "La gente y el ambiente.", "El miedo, el obstáculo o lo que pesa.", "Adónde lleva todo si escuchas lo anterior."];
export const SPREADS: Record<string, { label: string; text: string; small?: boolean; pos: Pos[] }> = {
  one: { label: "Una carta", text: "La tirada más sencilla y la más usada: una sola carta para el día o para una pregunta. Obliga a escuchar un único mensaje.", pos: [{ name: "El mensaje", hint: "Lo que necesitas oír ahora.", x: 170, y: 125 }] },
  three: {
    label: "Pasado, presente y futuro",
    text: "Tres cartas en línea cuentan una historia en el tiempo. Léelas primero una a una y después como una frase seguida.",
    pos: [
      { name: "El pasado", hint: "Lo que trae la situación hasta aquí.", x: 80, y: 125 },
      { name: "El presente", hint: "Cómo está ahora mismo.", x: 170, y: 125 },
      { name: "El futuro", hint: "Hacia dónde va si sigues igual.", x: 260, y: 125 },
    ],
  },
  advice: {
    label: "Situación, obstáculo y consejo",
    text: "Tres cartas para pasar a la acción: qué pasa, qué lo complica y qué puedes hacer. Muy útil para dudas concretas.",
    pos: [
      { name: "La situación", hint: "Qué está pasando de verdad.", x: 80, y: 125 },
      { name: "El obstáculo", hint: "Lo que lo complica o lo frena.", x: 170, y: 125 },
      { name: "El consejo", hint: "Lo que puedes hacer.", x: 260, y: 125 },
    ],
  },
  choice: {
    label: "Dos caminos",
    text: "Para decidir entre dos opciones: una carta para ti y dos para cada camino (cómo es y adónde lleva). No dice qué elegir: ilumina las dos puertas.",
    pos: [
      { name: "Tú ahora", hint: "Desde dónde eliges.", x: 170, y: 205 },
      { name: "El camino A", hint: "Cómo es esa opción.", x: 90, y: 128 },
      { name: "Adónde lleva A", hint: "Lo que trae si la eliges.", x: 90, y: 46 },
      { name: "El camino B", hint: "Cómo es la otra opción.", x: 250, y: 128 },
      { name: "Adónde lleva B", hint: "Lo que trae si la eliges.", x: 250, y: 46 },
    ],
  },
  cross: {
    label: "La cruz (cinco cartas)",
    text: "La pregunta en el centro, el tiempo a los lados, lo que te sostiene abajo y el consejo arriba. Una tirada completa para un tema importante.",
    pos: [
      { name: "El centro", hint: "El corazón de la pregunta.", x: 170, y: 125 },
      { name: "Lo que se va", hint: "Lo que quedó atrás o termina.", x: 80, y: 125 },
      { name: "Lo que llega", hint: "Lo que empieza a entrar.", x: 260, y: 125 },
      { name: "Lo que te sostiene", hint: "Tu raíz, tu apoyo en esto.", x: 170, y: 212 },
      { name: "El consejo", hint: "Lo que te pide el oráculo.", x: 170, y: 38 },
    ],
  },
  horseshoe: {
    label: "La herradura (siete)",
    small: true,
    text: "Siete cartas en forma de herradura, para mirar una situación entera: el tiempo, tú, los demás, el obstáculo y el resultado.",
    pos: horseshoe.map((name, i) => {
      const t = Math.PI - (i * Math.PI) / 6;
      return { name, hint: horseshoeHint[i], x: 170 + 130 * Math.cos(t), y: 52 + 160 * Math.sin(t) };
    }),
  },
  year: {
    label: "El año (doce)",
    small: true,
    text: "Doce cartas en círculo, una por cada mes desde hoy. Se suele hacer en tu cumpleaños, en Año Nuevo o en el equinoccio.",
    pos: Array.from({ length: 12 }, (_, i) => {
      const t = ((-90 + i * 30) * Math.PI) / 180;
      return { name: `El mes ${i + 1}`, hint: `Lo que trae el mes ${i + 1} del ciclo, contando desde hoy.`, x: 170 + 102 * Math.cos(t), y: 128 + 102 * Math.sin(t) };
    }),
  },
};
const SPREAD_IDS = Object.keys(SPREADS);
export const ORC_SPREAD_KEYS = SPREAD_IDS.flatMap((id) => SPREADS[id].pos.map((_, i) => `${id}-${i}`));

/* ------------------------------------------------------------ los textos */

const COLORS: Record<string, { name: string; hex: string; text: string }> = {
  red: { name: "Rojo", hex: "#D9483B", text: "La fuerza, la pasión, el cuerpo y la acción. También la rabia o la urgencia. Pide moverse." },
  orange: { name: "Naranja", hex: "#EE8A3C", text: "La alegría, el placer, la creatividad y el disfrute. Habla de soltarse y de compartir." },
  yellow: { name: "Amarillo", hex: "#F2C94C", text: "La claridad, la mente, la confianza y la luz del día. Pide ver las cosas como son." },
  green: { name: "Verde", hex: "#5FAF6A", text: "El corazón, la sanación, el crecimiento y la naturaleza. Habla de esperanza y de cuidado." },
  blue: { name: "Azul", hex: "#4D96D9", text: "La calma, la verdad, la palabra y la confianza. Pide decir lo que sientes." },
  indigo: { name: "Índigo", hex: "#5B5FC7", text: "La intuición, la noche, los sueños y lo profundo. Pide escuchar por dentro." },
  violet: { name: "Violeta", hex: "#A07ADB", text: "Lo espiritual, la transformación y la magia. Habla de transmutar y de lo sagrado." },
  pink: { name: "Rosa", hex: "#E58BB0", text: "La ternura, el amor propio, la dulzura y el perdón. Pide tratarte con cariño." },
  white: { name: "Blanco", hex: "#F4F1EA", text: "La pureza, los comienzos, la paz y la protección. Una página en blanco." },
  black: { name: "Negro", hex: "#1B1A22", text: "El misterio, lo oculto, el descanso y lo que aún no se ve. No es malo: es la tierra fértil." },
  gold: { name: "Dorado", hex: "#D4AA55", text: "La abundancia, el sol, el valor y lo divino. Habla de tu brillo y de lo que vale." },
  silver: { name: "Plateado", hex: "#BFC4CC", text: "La Luna, lo femenino, el reflejo y la intuición. Pide mirar en el espejo." },
  brown: { name: "Marrón", hex: "#8A6142", text: "La tierra, la raíz, el hogar y la paciencia. Pide ir despacio y con los pies en el suelo." },
};
const COLOR_OF_NUMBER = ["red", "orange", "yellow", "green", "blue", "indigo", "violet", "pink", "gold"];

const SYMBOLS: Record<string, { name: string; text: string; icon: string }> = {
  sun: { name: "El Sol", text: "La vida, la claridad, el éxito y la alegría. Lo que se ve y lo que da calor.", icon: "M20 13a7 7 0 1 0 0.01 0ZM20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5L32 32M32 8l-3.5 3.5M11.5 28.5L8 32" },
  moon: { name: "La Luna", text: "La intuición, los ciclos, los sueños y lo que cambia. También lo que no se ve del todo.", icon: "M25 6a14 14 0 1 0 0 28a10.5 10.5 0 1 1 0-28Z" },
  star: { name: "La estrella", text: "La esperanza, la guía y los deseos. Lo que te orienta en la noche.", icon: "M20 4L24.2 15.2L36 15.6L26.8 23L30 34.4L20 27.8L10 34.4L13.2 23L4 15.6L15.8 15.2Z" },
  water: { name: "El agua", text: "Las emociones, lo que fluye, la limpieza y la intuición. Pide dejar que algo corra.", icon: "M4 14q4-5 8 0t8 0t8 0t8 0M4 22q4-5 8 0t8 0t8 0t8 0M4 30q4-5 8 0t8 0t8 0t8 0" },
  mountain: { name: "La montaña", text: "El reto, el esfuerzo, la estabilidad y la meta. Lo que se sube paso a paso.", icon: "M3 33L15 11L22 22L27 15L37 33ZM12 16.5l3 2 3-2" },
  key: { name: "La llave", text: "La solución, el permiso y lo que se abre. Tienes lo que necesitas para entrar.", icon: "M12 15a6 6 0 1 0 0.01 0ZM18 21H36M30 21v6M34 21v4" },
  door: { name: "La puerta", text: "Una oportunidad, un paso a otra etapa o un umbral. Toca decidir si cruzas.", icon: "M11 35V15a9 9 0 0 1 18 0V35ZM5 35H35M24 24h1" },
  tree: { name: "El árbol", text: "La familia, el crecimiento, la raíz y el tiempo. Lo que crece despacio y aguanta.", icon: "M20 36V20M20 26l-6-5M20 23l6-5M20 4a10 9 0 1 0 0.01 0M12 36q8-4 16 0" },
  serpent: { name: "La serpiente", text: "La transformación, la sanación, la energía y el cambio de piel. A veces, una alerta.", icon: "M8 33q14 2 14-6t-10-8 4-10q6-4 12 2M30 11l3-1M30 11l2 3" },
  bird: { name: "El pájaro", text: "Las noticias, la libertad, la ligereza y la mirada desde arriba.", icon: "M4 20q8-9 16 0q8-9 16 0M12 28q4-4 8 0q4-4 8 0" },
  heart: { name: "El corazón", text: "El amor, los vínculos, los sentimientos y la compasión. Lo que de verdad importa.", icon: "M20 34C6 24 4 14 11 10c4-2 7 0 9 4c2-4 5-6 9-4c7 4 5 14-9 24Z" },
  sword: { name: "La espada", text: "La mente, la verdad, la decisión y cortar lo que sobra. A veces, el conflicto.", icon: "M20 3V28M14 28H26M20 28v8M17 36h6M20 3l-2 3h4Z" },
  cup: { name: "La copa", text: "Las emociones compartidas, el amor, la celebración y lo que recibes.", icon: "M9 6h22q0 14-11 16Q9 20 9 6ZM20 22v10M13 35h14" },
  wheel: { name: "La rueda", text: "Los ciclos, el destino, el cambio y la suerte que gira.", icon: "M20 5a15 15 0 1 0 0.01 0ZM20 5V35M5 20H35M9.4 9.4L30.6 30.6M30.6 9.4L9.4 30.6M20 16a4 4 0 1 0 0.01 0Z" },
  road: { name: "El camino", text: "Un viaje, una dirección o un proceso. Pide seguir andando.", icon: "M14 36L18 4M26 36L22 4M20 32v-4M20 22v-4M20 12v-3" },
  bridge: { name: "El puente", text: "La unión, la reconciliación y pasar de un lado a otro. Lo que conecta dos orillas.", icon: "M3 24H37M5 24q15-18 30 0M10 24v8M30 24v8M15 18v6M25 18v6M20 15v9" },
  fire: { name: "El fuego", text: "La pasión, la purificación, la energía y la transformación. Lo que arde y renueva.", icon: "M20 36c-8 0-11-6-9-12c2-5 6-7 5-14c5 3 7 7 6 12c2-1 3-3 3-5c4 4 5 9 3 13c-1 4-4 6-8 6Z" },
  mirror: { name: "El espejo", text: "Mirarte, la verdad sobre ti y lo que los demás te reflejan.", icon: "M20 4a10 13 0 1 0 0.01 0ZM20 30v6M16 36h8M16 11q3-3 7-1" },
};

const NUMBERS: Record<string, T> = {
  "0": { name: "El 0 · el vacío", kicker: "Todo es posible", meaning: "El cero es el espacio antes de empezar: el loco del tarot, el salto de fe. Una carta con el cero habla de potencial, de libertad y de no saber todavía." },
  "1": { name: "El 1 · el comienzo", kicker: "Empezar, la voluntad", meaning: "El uno es la semilla: un inicio, una idea nueva, tú misma. Pide dar el primer paso." },
  "2": { name: "El 2 · el encuentro", kicker: "La pareja, la elección", meaning: "El dos es el otro: una relación, un equilibrio o una decisión entre dos cosas. Pide escuchar y colaborar." },
  "3": { name: "El 3 · la creación", kicker: "Crecer, expresarse", meaning: "El tres es lo que nace de dos: un proyecto, una idea que se comparte, la alegría. Pide crear y comunicar." },
  "4": { name: "El 4 · la base", kicker: "Orden, estabilidad", meaning: "El cuatro es la mesa con sus cuatro patas: el trabajo, la casa, la estructura. Pide constancia." },
  "5": { name: "El 5 · el cambio", kicker: "Movimiento, desafío", meaning: "El cinco rompe el orden del cuatro: un cambio, un conflicto o una aventura. Pide adaptarse." },
  "6": { name: "El 6 · la armonía", kicker: "Amor, cuidado", meaning: "El seis vuelve a equilibrar: el hogar, el amor, la belleza y la responsabilidad. Pide cuidar y dejarse cuidar." },
  "7": { name: "El 7 · la búsqueda", kicker: "Interior, misterio", meaning: "El siete se retira para entender: la reflexión, la fe, lo espiritual. Pide silencio y paciencia." },
  "8": { name: "El 8 · la fuerza", kicker: "Poder, resultados", meaning: "El ocho es la energía en movimiento: logros, dinero, la fuerza que se ha ganado. Pide usar bien tu poder." },
  "9": { name: "El 9 · el cierre", kicker: "Completar, soltar", meaning: "El nueve es casi el final: la sabiduría de lo vivido, terminar algo y agradecerlo. Pide soltar." },
  "10": { name: "El 10 · el ciclo completo", kicker: "Final y nuevo comienzo", meaning: "El diez es el uno con un cero: se cierra una vuelta entera y empieza otra en otro nivel. Habla de plenitud y de cambio de etapa." },
};

const ELEMENTS: Record<string, { name: string; color: string; ang: number; text: string; kicker: string }> = {
  spirit: { name: "El espíritu", color: "#E9CC8E", ang: -90, kicker: "El quinto elemento · arriba de la estrella", text: "El espíritu (o éter) une a los otros cuatro. En una lectura aparece en cartas de lo sagrado, la intuición, los ángeles, el destino y lo que no se puede tocar." },
  water: { name: "El agua", color: "#5AA9E6", ang: -18, kicker: "Sentir · copas, mares, lluvia, la Luna", text: "El agua es el mundo de las emociones, los vínculos y la intuición. Si hay muchas cartas de agua, la respuesta está en lo que sientes, no en lo que piensas." },
  fire: { name: "El fuego", color: "#E2574C", ang: 54, kicker: "Actuar · velas, soles, bastones, llamas", text: "El fuego es la pasión, la acción y la voluntad. Muchas cartas de fuego piden moverse ya, con valor, aunque no esté todo claro." },
  earth: { name: "La tierra", color: "#6FBF73", ang: 126, kicker: "Concretar · monedas, árboles, montañas, casas", text: "La tierra es el cuerpo, el dinero, el trabajo y lo práctico. Muchas cartas de tierra piden pasos concretos y paciencia." },
  air: { name: "El aire", color: "#C9C3E8", ang: 198, kicker: "Pensar · espadas, plumas, pájaros, viento", text: "El aire es la mente, la palabra y las decisiones. Muchas cartas de aire piden aclarar las ideas, hablar o cortar con algo." },
};
const ELEMENT_KEY: Record<Element, string> = { Fuego: "fire", Agua: "water", Aire: "air", Tierra: "earth" };

const TX: Record<Exclude<OracleLayer, "orc-spreads" | "orc-symbols" | "orc-colors" | "orc-numbers" | "orc-elements">, Record<string, T>> = {
  "orc-reading": {
    space: { name: "Preparar el espacio", kicker: "Paso 1 · un lugar tranquilo", meaning: "Busca un rato sin prisa y un sitio donde nadie te interrumpa. Muchas personas encienden una vela, ponen un paño y respiran unos minutos: no es obligatorio, pero ayuda a pasar de lo de fuera a lo de dentro." },
    intention: { name: "La intención", kicker: "Paso 2 · para qué consultas", meaning: "Antes de la pregunta, la intención: ¿buscas claridad, consuelo, un consejo? Decirlo, aunque sea en voz baja, orienta toda la lectura." },
    question: { name: "La pregunta", kicker: "Paso 3 · clara y abierta", meaning: "Escribe la pregunta. Que sea sobre ti, abierta y del presente (mira el modelo de las preguntas). Una buena pregunta ya es media respuesta." },
    shuffle: { name: "Barajar", kicker: "Paso 4 · con la pregunta en mente", meaning: "Baraja mientras piensas en tu pregunta, al ritmo que te salga. Hay quien corta en tres montones con la mano izquierda; elige tu forma y repítela siempre igual: el ritual da confianza." },
    draw: { name: "Sacar las cartas", kicker: "Paso 5 · colocarlas en la tirada", meaning: "Saca las cartas que pide la tirada y ponlas en su sitio antes de mirarlas todas. Cada posición es una pregunta pequeña dentro de la grande." },
    first: { name: "La primera impresión", kicker: "Paso 6 · antes de leer el librito", meaning: "Mira las cartas en silencio: ¿qué ves primero?, ¿qué color, qué gesto, qué sientes? Apúntalo. La intuición habla antes que el significado aprendido." },
    story: { name: "Contar la historia", kicker: "Paso 7 · unirlas en una frase", meaning: "Lee cada carta en su posición y después únelas como un cuento: «vengo de…, ahora…, y me conviene…». Una lectura no es una lista de significados: es una historia con sentido." },
    journal: { name: "Apuntarlo", kicker: "Paso 8 · tu diario de lecturas", meaning: "Anota la fecha, la pregunta, las cartas y lo que entendiste. Con el tiempo verás qué cartas se repiten y cómo se cumplían sus mensajes: así aprendes tu baraja." },
    close: { name: "Cerrar", kicker: "Paso 9 · agradecer y guardar", meaning: "Agradece, recoge las cartas y guarda la baraja. Si la lectura te removió, date un momento antes de seguir el día. No repitas la misma pregunta enseguida: escucha la primera respuesta." },
  },
  "orc-questions": {
    open: { name: "Abierta, no de sí o no", kicker: "En vez de «¿Volverá?» → «¿Qué necesito saber sobre esta relación?»", meaning: "Un oráculo no es una moneda: brilla cuando le dejas espacio para contar algo. Las preguntas que empiezan por «qué» o «cómo» dan respuestas más ricas que las de sí o no." },
    self: { name: "Sobre ti", kicker: "En vez de «¿Qué piensa de mí?» → «¿Cómo me siento yo con esto?»", meaning: "Las cartas hablan mejor de quien pregunta. Puedes preguntar por un vínculo, pero desde tu lado: qué puedes hacer tú, qué te enseña a ti." },
    now: { name: "Del presente", kicker: "En vez de «¿Qué pasará?» → «¿Qué puedo hacer ahora para…?»", meaning: "El futuro se mueve con lo que haces hoy. Preguntar por el presente te devuelve el poder: el oráculo aconseja, no dicta." },
    how: { name: "Cómo, no por qué", kicker: "En vez de «¿Por qué me pasa esto?» → «¿Cómo puedo vivirlo mejor?»", meaning: "Los porqués suelen llevar a la culpa; los cómo llevan a la acción. Si necesitas entender, pregunta «¿qué me enseña esto?»." },
    one: { name: "Un tema cada vez", kicker: "En vez de tres preguntas juntas → una sola, bien hecha", meaning: "Si mezclas temas, las cartas se mezclan también. Haz una pregunta, lee la respuesta y, si hace falta, otra tirada después." },
    decision: { name: "Para decidir", kicker: "En vez de «¿Qué hago?» → «¿Qué me trae cada opción?»", meaning: "Para elegir, mira las dos opciones por separado (la tirada de los dos caminos). La decisión sigue siendo tuya: el oráculo solo enciende la luz." },
    daily: { name: "La carta del día", kicker: "«¿Qué necesito tener presente hoy?»", meaning: "Una pregunta sencilla para cada mañana. Saca una carta, léela y vuelve a ella por la noche: es la mejor forma de aprender tu baraja." },
    avoid: { name: "Lo que mejor no preguntar", kicker: "Salud, muerte, embarazos, juicios o la vida de otras personas", meaning: "Para temas médicos o legales hay profesionales; el oráculo puede acompañar, no diagnosticar. Y la intimidad de otra persona, sin su permiso, no se lee." },
  },
  "orc-signals": {
    reversed: { name: "Una carta invertida", kicker: "Sale del revés", meaning: "Si decides leer invertidas, una carta al revés suele decir que su energía está bloqueada, vuelta hacia dentro o que llega con retraso. Muchas barajas de oráculo no las usan: decide antes de barajar si las vas a leer y sé fiel a tu decisión." },
    jumper: { name: "La carta que salta", kicker: "Cae sola mientras barajas", meaning: "Cuando una carta salta del mazo se dice que «tiene prisa por hablar». Muchas lectoras la leen como un mensaje extra que acompaña a la tirada." },
    bottom: { name: "La carta del fondo", kicker: "La última del mazo", meaning: "Al terminar, mira la carta de abajo del todo: algunas personas la leen como la raíz oculta del tema, lo que hay debajo de todo." },
    repeated: { name: "La carta que se repite", kicker: "Sale una y otra vez", meaning: "Si la misma carta aparece en varias lecturas seguidas, es un mensaje que todavía no has escuchado. Apúntala y quédate con ella unos días." },
    "many-reversed": { name: "Muchas invertidas", kicker: "Más de la mitad del revés", meaning: "Si casi todas salen invertidas, quizá no es el momento de la pregunta, o hay algo interno que mirar antes. Puedes dejarlo para otro día." },
    majority: { name: "Lo que domina", kicker: "Un color, un elemento o un número que se repite", meaning: "Antes de leer carta a carta, mira el conjunto: ¿predomina un color, un elemento, un número? Eso es el tono general de la respuesta." },
    sequence: { name: "La mirada de las figuras", kicker: "Hacia dónde miran", meaning: "Si una figura mira hacia otra carta, la conecta con ella; si mira fuera de la tirada, apunta a algo que aún no está. Los gestos dentro de las cartas también hablan." },
    story: { name: "Lo que cuentan juntas", kicker: "De la lista a la historia", meaning: "Las cartas se influyen: una carta dura junto a una amable se suaviza, y dos que se parecen se refuerzan. Lee siempre el conjunto antes de cerrar la lectura." },
  },
  "orc-create": {
    theme: { name: "El tema", kicker: "Paso 1 · de qué habla tu baraja", meaning: "Elige un hilo: la Luna, las plantas, tus antepasadas, los animales, el mar… Un tema claro da unidad a las cartas y te ayuda a escribirlas." },
    size: { name: "Cuántas cartas", kicker: "Paso 2 · entre 22 y 54", meaning: "Las barajas de oráculo suelen tener entre 22 y 54 cartas. Con números con sentido (28 noches de la Luna, 36, 44) la estructura se escribe casi sola." },
    structure: { name: "La estructura", kicker: "Paso 3 · familias de cartas", meaning: "Agrupa las cartas por familias (por ejemplo, por elementos o por fases) para que la baraja tenga equilibrio: luz y sombra, acción y descanso." },
    names: { name: "Los nombres", kicker: "Paso 4 · una palabra que abra", meaning: "Cada carta, un nombre corto y una palabra clave. El nombre es lo primero que se lee: que inspire sin explicarlo todo." },
    images: { name: "Las imágenes", kicker: "Paso 5 · símbolos y colores", meaning: "Usa los símbolos y colores con intención (mira esos modelos). Una imagen sencilla, con un símbolo claro, se recuerda mejor que una muy cargada." },
    messages: { name: "Los mensajes", kicker: "Paso 6 · lo que dice cada carta", meaning: "Escribe un mensaje breve para cada carta y, si quieres, una pregunta para reflexionar. Escribe en positivo y sin amenazas: el oráculo acompaña." },
    test: { name: "Probarla", kicker: "Paso 7 · leer con ella", meaning: "Haz lecturas con tu baraja durante unas semanas y apunta qué funciona y qué no. Ajusta nombres y mensajes: una baraja viva se va puliendo." },
    care: { name: "Cuidarla", kicker: "Paso 8 · tu ritual", meaning: "Dale un lugar, un paño o una caja, y un ritual de limpieza (humo, la luz de la Luna llena o simplemente intención). La relación con tu baraja se construye con el uso." },
  },
};

/* ------------------------------------------------------------ las piezas */

export function oracleKeys(layer: OracleLayer, { option }: LayerCtx): string[] {
  switch (layer) {
    case "orc-spreads": {
      const id = option && SPREADS[option] ? option : "three";
      return SPREADS[id].pos.map((_, i) => `${id}-${i}`);
    }
    case "orc-symbols":
      return Object.keys(SYMBOLS);
    case "orc-colors":
      return Object.keys(COLORS);
    case "orc-numbers":
      return Object.keys(NUMBERS);
    case "orc-elements":
      return Object.keys(ELEMENTS);
    default:
      return Object.keys(TX[layer]);
  }
}

export function oracleMine(layer: OracleLayer, { c }: LayerCtx): string[] {
  const lp = lifePath(c?.profile.date);
  const el = sunElement(c);
  if (layer === "orc-numbers") return lp ? [String(lp.n)] : [];
  if (layer === "orc-colors") return lp ? [COLOR_OF_NUMBER[lp.n - 1]] : [];
  if (layer === "orc-elements") return el ? [ELEMENT_KEY[el]] : [];
  return [];
}

export function oraclePiece(layer: OracleLayer, key: string, ctx: LayerCtx): SystemPiece {
  const own = oracleMine(layer, ctx).includes(key);
  const lp = lifePath(ctx.c?.profile.date);
  switch (layer) {
    case "orc-spreads": {
      const [id, i] = key.split("-");
      const s = SPREADS[id];
      const p = s.pos[Number(i)];
      return { glyph: String(Number(i) + 1), name: p.name, kicker: `${s.label} · carta ${Number(i) + 1} de ${s.pos.length}`, meaning: `${p.hint}\n\n${s.text}\n\nLa carta que caiga aquí se lee desde esta pregunta. Si te cuesta, pregúntate: «¿qué tiene que ver esta carta con ${p.name.toLowerCase()}?».`, personal: null };
    }
    case "orc-symbols": {
      const s = SYMBOLS[key];
      return { glyph: "", name: s.name, kicker: "Un símbolo que aparece en muchas barajas", meaning: `${s.text}\n\nLos símbolos son un lenguaje común a muchas tradiciones, pero lo que un símbolo significa para ti también cuenta: si una imagen te dice otra cosa, escúchala.`, personal: null };
    }
    case "orc-colors": {
      const s = COLORS[key];
      return { glyph: "", name: s.name, kicker: "Lo que dice el color de una carta", meaning: `${s.text}\n\nFíjate en el color que domina en la tirada: es el tono de la respuesta, incluso antes de leer cada carta.`, personal: own && lp ? `Tu número de vida es el ${lp.n}: este es tu color.` : null };
    }
    case "orc-numbers": {
      const n = NUMBERS[key];
      return { glyph: key, name: n.name, kicker: n.kicker, meaning: `${n.meaning}\n\nMuchas barajas numeran sus cartas, y los números también aparecen en las imágenes (tres pájaros, siete estrellas). Si en una tirada se repite un número, su mensaje se refuerza.`, personal: own && lp ? `Tu número de vida es el ${lp.n}${lp.master ? ` (vienes del ${lp.master})` : ""}: este es tu número.` : null };
    }
    case "orc-elements": {
      const e = ELEMENTS[key];
      return { glyph: "", name: e.name, kicker: e.kicker, meaning: `${e.text}\n\nCuenta cuántas cartas de cada elemento hay en una tirada: el que más se repite dice dónde está la respuesta, y el que falta, qué te convendría traer.`, personal: own ? "Tu Sol está en un signo de este elemento: es tu forma natural de responder." : null };
    }
    default: {
      const t = TX[layer][key] ?? { name: key, kicker: "", meaning: "" };
      return { glyph: "", name: t.name, kicker: t.kicker, meaning: t.meaning, personal: null };
    }
  }
}

/* ------------------------------------------------------------ las cartas */

function CardDefs({ p }: { p: string }) {
  return (
    <>
      <NightDefs p={p} />
      <defs>
        <linearGradient id={`${p}card`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#2A2456" />
          <stop offset="100%" stopColor="#130F2E" />
        </linearGradient>
        <linearGradient id={`${p}cardOn`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#FBE7B0" />
          <stop offset="55%" stopColor="#D9AE5C" />
          <stop offset="100%" stopColor="#9C7330" />
        </linearGradient>
        <pattern id={`${p}back`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 4H8M4 0V8" stroke={NIGHT_GOLD} strokeOpacity="0.25" strokeWidth="0.6" />
        </pattern>
        <filter id={`${p}cshadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>
    </>
  );
}

/** Una carta: fondo de noche con doble filo dorado; la elegida, en oro. */
function Card({ p, x, y, w, h, on = false, rot = 0, back = false, children, mine = false }: { p: string; x: number; y: number; w: number; h: number; on?: boolean; rot?: number; back?: boolean; children?: ReactNode; mine?: boolean }) {
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      {on && <rect x={x - w * 0.75} y={y - h * 0.7} width={w * 1.5} height={h * 1.4} rx={w * 0.4} fill={`url(#${p}goldglow)`} />}
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w * 0.09} fill={on ? `url(#${p}cardOn)` : `url(#${p}card)`} stroke={on ? "#FFF1C8" : mine ? NIGHT_GOLD : "rgb(233 204 142 / .55)"} strokeWidth={on || mine ? 1.4 : 0.9} filter={`url(#${p}cshadow)`} />
      <rect x={x - w / 2 + 3} y={y - h / 2 + 3} width={w - 6} height={h - 6} rx={w * 0.06} fill={back ? `url(#${p}back)` : "none"} stroke={on ? "#7A5A26" : NIGHT_GOLD} strokeOpacity={on ? 0.6 : 0.4} strokeWidth="0.6" />
      {children}
    </g>
  );
}

const svgCls = "mx-auto block h-auto w-full max-w-[34rem] select-none";

function SpreadView({ p, keys, selected, tap }: { p: string; keys: string[]; selected: string; tap: Tap }) {
  const id = keys[0]?.split("-")[0] ?? "three";
  const s = SPREADS[id];
  const w = s.small ? 34 : 50;
  const h = s.small ? 50 : 74;
  return (
    <svg viewBox="0 0 340 260" className={svgCls} role="group" aria-label={s.label}>
      <CardDefs p={p} />
      <circle cx={C} cy="128" r="122" fill="rgb(233 204 142 / .04)" stroke="rgb(233 204 142 / .3)" strokeWidth="0.8" />
      {s.pos.map((q, i) => {
        const k = `${id}-${i}`;
        const on = k === selected;
        return (
          <g key={k} {...tap(k, q.name)}>
            <Card p={p} x={q.x} y={q.y} w={w} h={h} on={on} back={!on}>
              <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={s.small ? 13 : 18} fontFamily="Georgia, serif" fill={on ? "#2A1E0C" : NIGHT_GOLD} stroke={on ? "none" : NIGHT} strokeWidth="3" paintOrder="stroke" pointerEvents="none">
                {i + 1}
              </text>
            </Card>
            {!s.small && (
              <text x={q.x} y={q.y + h / 2 + 11} textAnchor="middle" fontSize="8.5" fontWeight={on ? 700 : 500} fill={on ? NIGHT_GOLD : STAR} fillOpacity={on ? 1 : 0.75} stroke={NIGHT} strokeWidth="3" paintOrder="stroke" pointerEvents="none">
                {q.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Una rueda de cartas pequeñas numeradas (pasos), con la elegida en el centro, grande. */
function StepsRing({ p, keys, selected, tap, names }: { p: string; keys: string[]; selected: string; tap: Tap; names: Record<string, T> }) {
  const n = keys.length;
  const i0 = keys.indexOf(selected);
  return (
    <svg viewBox="0 0 340 340" className={svgCls} role="group" aria-label="Los pasos">
      <CardDefs p={p} />
      <circle cx={C} cy={C} r="128" fill="none" stroke="rgb(233 204 142 / .3)" strokeDasharray="2 5" />
      {keys.map((k, i) => {
        const t = ((-90 + (i * 360) / n) * Math.PI) / 180;
        const x = C + 128 * Math.cos(t);
        const y = C + 128 * Math.sin(t);
        const on = k === selected;
        return (
          <g key={k} {...tap(k, names[k].name)}>
            <Card p={p} x={x} y={y} w={30} h={44} on={on} back={!on}>
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="13" fontFamily="Georgia, serif" fill={on ? "#2A1E0C" : NIGHT_GOLD} stroke={on ? "none" : NIGHT} strokeWidth="3" paintOrder="stroke" pointerEvents="none">
                {i + 1}
              </text>
            </Card>
          </g>
        );
      })}
      <Card p={p} x={C} y={C} w={96} h={140} on>
        <text x={C} y={C - 30} textAnchor="middle" fontSize="34" fontFamily="Georgia, serif" fill="#2A1E0C" pointerEvents="none">
          {i0 + 1}
        </text>
        <foreignObject x={C - 42} y={C - 6} width="84" height="60" pointerEvents="none">
          <div style={{ fontSize: 9.5, lineHeight: 1.2, textAlign: "center", color: "#2A1E0C", fontWeight: 700 }}>{names[selected]?.name}</div>
        </foreignObject>
      </Card>
    </svg>
  );
}

function SymbolGrid({ p, keys, selected, tap }: { p: string; keys: string[]; selected: string; tap: Tap }) {
  const cols = 6;
  const cw = 340 / cols;
  const rows = Math.ceil(keys.length / cols);
  const H = rows * 84 + 8;
  return (
    <svg viewBox={`0 0 340 ${H}`} className={svgCls} role="group" aria-label="Los símbolos">
      <CardDefs p={p} />
      {keys.map((k, i) => {
        const x = cw / 2 + (i % cols) * cw;
        const y = 40 + Math.floor(i / cols) * 84;
        const on = k === selected;
        return (
          <g key={k} {...tap(k, SYMBOLS[k].name)}>
            <Card p={p} x={x} y={y} w={46} h={66} on={on}>
              <path d={SYMBOLS[k].icon} transform={`translate(${x - 14} ${y - 18}) scale(0.7)`} fill="none" stroke={on ? "#3A2615" : NIGHT_GOLD} strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" pathLength={on ? 1 : undefined} className={on ? "geo-draw" : undefined} />
              <text x={x} y={y + 22} textAnchor="middle" fontSize="6.4" fontWeight={700} fill={on ? "#3A2615" : STAR} fillOpacity="0.85" pointerEvents="none">
                {SYMBOLS[k].name.replace(/^(El|La) /, "").toUpperCase()}
              </text>
            </Card>
          </g>
        );
      })}
    </svg>
  );
}

function NumberWheel({ p, keys, selected, tap, own }: { p: string; keys: string[]; selected: string; tap: Tap; own: Set<string> }) {
  const n = Number(selected);
  const R = 92;
  const els: E[] =
    n === 0 ? [{ d: `M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0`, tags: ["0"], w: 1.6 }]
    : n === 10 ? [{ d: `M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0`, tags: ["10"] }, { d: `M${C - 4} ${C}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`, tags: ["10"], fill: NIGHT_GOLD }, ...numberFig(9).slice(1).map((e) => ({ ...e, tags: ["10"] }))]
    : numberFig(n);
  return (
    <svg viewBox="0 0 340 340" className={svgCls} role="group" aria-label="Los números">
      <CardDefs p={p} />
      <g key={selected}>
        <GeoFigure els={els} selected={selected} order={keys} mode="only" />
      </g>
      {keys.map((k, i) => {
        const t = ((-90 + (i * 360) / keys.length) * Math.PI) / 180;
        const x = C + 146 * Math.cos(t);
        const y = C + 146 * Math.sin(t);
        const on = k === selected;
        return (
          <g key={k} {...tap(k, `El ${k}`)}>
            <circle cx={x} cy={y} r="15" fill={on ? `url(#${p}gold)` : "rgb(255 255 255 / .04)"} stroke={own.has(k) || on ? NIGHT_GOLD : "rgb(233 204 142 / .35)"} strokeWidth={own.has(k) ? 1.6 : 1} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="13" fontFamily="Georgia, serif" fill={on ? "#2A1E0C" : STAR} pointerEvents="none">
              {k}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ColorWheel({ keys, selected, tap, own }: { keys: string[]; selected: string; tap: Tap; own: Set<string> }) {
  const n = keys.length;
  const sec = (i: number, r1: number, r2: number) => {
    const a1 = ((-90 + (i * 360) / n) * Math.PI) / 180;
    const a2 = ((-90 + ((i + 1) * 360) / n) * Math.PI) / 180;
    const P = (r: number, a: number) => `${C + r * Math.cos(a)} ${C + r * Math.sin(a)}`;
    return `M${P(r1, a1)}A${r1} ${r1} 0 0 1 ${P(r1, a2)}L${P(r2, a2)}A${r2} ${r2} 0 0 0 ${P(r2, a1)}Z`;
  };
  const c = COLORS[selected];
  return (
    <svg viewBox="0 0 340 340" className={svgCls} role="group" aria-label="Los colores">
      {keys.map((k, i) => {
        const on = k === selected;
        return (
          <g key={k} {...tap(k, COLORS[k].name)}>
            <path d={sec(i, on ? 158 : 150, 104)} fill={COLORS[k].hex} fillOpacity={on ? 1 : 0.78} stroke={on ? "#FFF1C8" : own.has(k) ? NIGHT_GOLD : "#100E26"} strokeWidth={on ? 2 : own.has(k) ? 1.6 : 1} />
          </g>
        );
      })}
      <circle cx={C} cy={C} r="90" fill={c.hex} stroke={NIGHT_GOLD} strokeWidth="1.2" className="geo-fade" key={selected} />
      <circle cx={C} cy={C} r="96" fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.4" />
      <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize="20" fontFamily="Georgia, serif" fill={["white", "yellow", "silver", "gold", "pink"].includes(selected) ? "#2A1E0C" : "#FBF6EC"}>
        {c.name}
      </text>
    </svg>
  );
}

function ElementStar({ p, selected, tap, own }: { p: string; selected: string; tap: Tap; own: Set<string> }) {
  const pts = Object.values(ELEMENTS).map((e) => [C + 112 * Math.cos((e.ang * Math.PI) / 180), C + 112 * Math.sin((e.ang * Math.PI) / 180)] as [number, number]);
  const order = [0, 2, 4, 1, 3];
  const star = `M${order.map((i) => pts[i].join(" ")).join("L")}Z`;
  const sym = (k: string, x: number, y: number, col: string) => {
    const up = k === "fire" || k === "air";
    const tri = up ? `M${x} ${y - 11}L${x + 10} ${y + 7}L${x - 10} ${y + 7}Z` : `M${x} ${y + 11}L${x + 10} ${y - 7}L${x - 10} ${y - 7}Z`;
    if (k === "spirit") return <circle cx={x} cy={y} r="9" fill="none" stroke={col} strokeWidth="1.6" />;
    return (
      <g fill="none" stroke={col} strokeWidth="1.6" strokeLinejoin="round">
        <path d={tri} />
        {(k === "air" || k === "earth") && <path d={`M${x - 8} ${y + (up ? 1 : -1)}H${x + 8}`} />}
      </g>
    );
  };
  return (
    <svg viewBox="0 0 340 340" className={svgCls} role="group" aria-label="Los cinco elementos">
      <NightDefs p={p} />
      <circle cx={C} cy={C} r="140" fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.3" />
      <path d={star} fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.55" strokeWidth="1.2" />
      {Object.entries(ELEMENTS).map(([k, e], i) => {
        const [x, y] = pts[i];
        const on = k === selected;
        return (
          <g key={k} {...tap(k, e.name)}>
            {on && <circle cx={x} cy={y} r="40" fill={`url(#${p}goldglow)`} />}
            <circle cx={x} cy={y} r="27" fill={on ? e.color : "#16132E"} fillOpacity={on ? 0.9 : 1} stroke={own.has(k) || on ? "#F7E2AE" : e.color} strokeWidth={on || own.has(k) ? 2 : 1.2} />
            {sym(k, x, y - 4, on ? "#100E26" : e.color)}
            <text x={x} y={y + 15} textAnchor="middle" fontSize="6.5" fontWeight={700} letterSpacing="0.6" fill={on ? "#100E26" : STAR} pointerEvents="none">
              {e.name.replace(/^(El|La) /, "").toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Una pequeña escena para cada señal. */
function SignalScene({ p, selected }: { p: string; selected: string }) {
  const row = (rots: number[], opts: { on?: number[]; back?: number[]; gold?: string } = {}) =>
    rots.map((r, i) => {
      const x = C + (i - (rots.length - 1) / 2) * 66;
      return (
        <Card key={i} p={p} x={x} y={150} w={52} h={78} rot={r} on={opts.on?.includes(i)} back={opts.back?.includes(i)}>
          {!opts.back?.includes(i) && (
            <path d={SYMBOLS[["sun", "moon", "star", "heart", "key"][i % 5]].icon} transform={`rotate(${r} ${x} 150) translate(${x - 14} 132) scale(0.7)`} fill="none" stroke={opts.on?.includes(i) ? "#3A2615" : NIGHT_GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Card>
      );
    });
  let scene: ReactNode = null;
  switch (selected) {
    case "reversed":
      scene = row([0, 180, 0], { on: [1] });
      break;
    case "jumper":
      scene = (
        <>
          {[0, 1, 2, 3].map((i) => <Card key={i} p={p} x={130 + i * 1.5} y={170 - i * 1.5} w={52} h={78} back />)}
          <Card p={p} x={230} y={98} w={52} h={78} rot={24} on>
            <path d={SYMBOLS.bird.icon} transform={`rotate(24 230 98) translate(216 80) scale(0.7)`} fill="none" stroke="#3A2615" strokeWidth="1.8" strokeLinecap="round" />
          </Card>
          <path d="M160 130Q190 90 206 96" fill="none" stroke={NIGHT_GOLD} strokeDasharray="3 4" />
        </>
      );
      break;
    case "bottom":
      scene = (
        <>
          {[0, 1, 2, 3, 4].map((i) => <Card key={i} p={p} x={C} y={120 - i * 3} w={60} h={90} back />)}
          <Card p={p} x={C + 6} y={210} w={60} h={90} on rot={6}>
            <path d={SYMBOLS.tree.icon} transform={`rotate(6 ${C + 6} 210) translate(${C - 8} 192) scale(0.7)`} fill="none" stroke="#3A2615" strokeWidth="1.8" strokeLinecap="round" />
          </Card>
        </>
      );
      break;
    case "repeated":
      scene = row([-6, 0, 6], { on: [0, 1, 2] });
      break;
    case "many-reversed":
      scene = row([180, 180, 0, 180], { on: [0, 1, 3] });
      break;
    case "majority":
      scene = row([0, 0, 0, 0], { on: [0, 2, 3] });
      break;
    case "sequence":
      scene = (
        <>
          {row([0, 0, 0], { on: [0, 2] })}
          <path d="M104 98Q170 60 236 98" fill="none" stroke={NIGHT_GOLD} strokeWidth="1.2" markerEnd="" />
          <path d="M228 92l8 6-9 3" fill="none" stroke={NIGHT_GOLD} strokeWidth="1.2" />
        </>
      );
      break;
    case "story":
      scene = (
        <>
          {row([0, 0, 0], { on: [0, 1, 2] })}
          <path d="M80 210H260" stroke={NIGHT_GOLD} strokeWidth="1.2" />
          <path d="M252 204l8 6-8 6" fill="none" stroke={NIGHT_GOLD} strokeWidth="1.2" />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 340 260" className={svgCls} role="img" aria-label={TX["orc-signals"][selected]?.name ?? ""}>
      <CardDefs p={p} />
      <g key={selected} className="geo-fade">
        {scene}
      </g>
    </svg>
  );
}

function CreateFan({ p, keys, selected, tap }: { p: string; keys: string[]; selected: string; tap: Tap }) {
  const n = keys.length;
  return (
    <svg viewBox="0 0 340 280" className={svgCls} role="group" aria-label="Crea tu propio oráculo">
      <CardDefs p={p} />
      {keys.map((k, i) => {
        const a = -42 + (i * 84) / (n - 1);
        const on = k === selected;
        const t = (a * Math.PI) / 180;
        const x = C + 150 * Math.sin(t);
        const y = 240 - 150 * Math.cos(t) - (on ? 18 : 0);
        return (
          <g key={k} {...tap(k, TX["orc-create"][k].name)}>
            <Card p={p} x={x} y={y} w={50} h={76} rot={a} on={on} back={!on}>
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="17" fontFamily="Georgia, serif" fill={on ? "#2A1E0C" : NIGHT_GOLD} stroke={on ? "none" : NIGHT} strokeWidth="3" paintOrder="stroke" transform={`rotate(${a} ${x} ${y})`} pointerEvents="none">
                {i + 1}
              </text>
            </Card>
          </g>
        );
      })}
      <text x={C} y="262" textAnchor="middle" fontSize="11" fontWeight={700} letterSpacing="1.4" fill={NIGHT_GOLD}>
        {TX["orc-create"][selected]?.name.toUpperCase()}
      </text>
    </svg>
  );
}

function QuestionPair({ selected }: { selected: string }) {
  const t = TX["orc-questions"][selected];
  const m = t.kicker.match(/En vez de «(.+?)» → «(.+?)»/);
  return (
    <div className="mx-auto grid max-w-[34rem] gap-3 py-4 sm:grid-cols-2" key={selected}>
      {m ? (
        <>
          <div className="geo-fade rounded-2xl border p-4 text-center" style={{ borderColor: "rgb(233 204 142 / .25)", background: "rgb(255 255 255 / .03)" }}>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em]" style={{ color: "rgb(251 246 236 / .55)" }}>En vez de</p>
            <p className="mt-2 font-serif text-[1.02rem] leading-snug line-through decoration-1" style={{ color: "rgb(251 246 236 / .6)" }}>«{m[1]}»</p>
          </div>
          <div className="geo-fade rounded-2xl border p-4 text-center" style={{ borderColor: "#F0D9A4", background: "linear-gradient(135deg, #F0D9A4, #C8A86E)", boxShadow: "0 0 24px rgb(233 204 142 / .35)" }}>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em]" style={{ color: "#5A4220" }}>Mejor</p>
            <p className="mt-2 font-serif text-[1.02rem] leading-snug" style={{ color: "#2A1E0C" }}>«{m[2]}»</p>
          </div>
        </>
      ) : (
        <div className="geo-fade rounded-2xl border p-5 text-center sm:col-span-2" style={{ borderColor: "#F0D9A4", background: "rgb(233 204 142 / .08)" }}>
          <p className="font-serif text-[1.1rem] leading-snug" style={{ color: STAR }}>{t.kicker}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ el dibujo */

export function OracleDiagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: OracleLayer }) {
  const p = usePrefix();
  const own = new Set(mine);
  const chips = (names: (k: string) => string) => <NightChips items={keys.map((k) => ({ key: k, label: names(k) }))} selected={selected} mine={own} tap={tap} />;
  switch (layer) {
    case "orc-spreads": {
      const id = keys[0]?.split("-")[0] ?? "three";
      return (
        <NightPanel>
          <OptionChips options={SPREAD_IDS.map((v) => ({ value: v, label: SPREADS[v].label }))} value={id} onPick={ctx.setOption} />
          <SpreadView p={p} keys={keys} selected={selected} tap={tap} />
          {SPREADS[id].small && chips((k) => SPREADS[id].pos[Number(k.split("-")[1])].name)}
        </NightPanel>
      );
    }
    case "orc-reading":
    case "orc-create":
      return (
        <NightPanel>
          {layer === "orc-reading" ? <StepsRing p={p} keys={keys} selected={selected} tap={tap} names={TX["orc-reading"]} /> : <CreateFan p={p} keys={keys} selected={selected} tap={tap} />}
        </NightPanel>
      );
    case "orc-questions":
      return (
        <NightPanel>
          <QuestionPair selected={selected} />
          {chips((k) => TX["orc-questions"][k].name)}
        </NightPanel>
      );
    case "orc-symbols":
      return (
        <NightPanel>
          <SymbolGrid p={p} keys={keys} selected={selected} tap={tap} />
        </NightPanel>
      );
    case "orc-numbers":
      return (
        <NightPanel>
          <NumberWheel p={p} keys={keys} selected={selected} tap={tap} own={own} />
        </NightPanel>
      );
    case "orc-colors":
      return (
        <NightPanel>
          <ColorWheel keys={keys} selected={selected} tap={tap} own={own} />
          {chips((k) => COLORS[k].name)}
        </NightPanel>
      );
    case "orc-elements":
      return (
        <NightPanel>
          <ElementStar p={p} selected={selected} tap={tap} own={own} />
        </NightPanel>
      );
    case "orc-signals":
      return (
        <NightPanel>
          <SignalScene p={p} selected={selected} />
          {chips((k) => TX["orc-signals"][k].name)}
        </NightPanel>
      );
  }
  return null;
}
