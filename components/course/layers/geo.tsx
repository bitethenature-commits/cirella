"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SIGNS, type Element } from "@/components/models/data/astrology";
import type { AstroLayer } from "@/lib/lesson-blocks";
import { C, signIndex, type DiagramProps, type LayerCtx, type SystemPiece } from "./common";
import { Astrolabe, NIGHT_GOLD, NightChips, NightDefs, NightPanel, STAR, usePrefix } from "./night";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Geometría sagrada por partes: del punto y el círculo a la vesica, la flor de la vida, el cubo de Metatrón,
 * los sólidos platónicos, la proporción áurea, los números y sus formas, el árbol de la vida, el Sri Yantra,
 * la merkaba, el toro y los chakras. Las figuras se dibujan paso a paso en oro, como con compás, y se pueden
 * volver a ver dibujarse. Con la fecha de nacimiento, se marca lo de la alumna (su número de vida y la forma
 * del elemento de su Sol).
 */

export type GeoLayer = Extract<AstroLayer, `geo-${string}`>;
export const isGeoLayer = (l: string): l is GeoLayer => l.startsWith("geo-");

/* ------------------------------------------------------------ lo personal */

/** El número de vida: las cifras de la fecha sumadas hasta una sola (guarda el maestro 11, 22 o 33). */
export function lifePath(date: string | null | undefined): { n: number; master: number | null } | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  let s = date.replace(/-/g, "").split("").reduce((a, d) => a + Number(d), 0);
  let master: number | null = null;
  while (s > 9) {
    if (s === 11 || s === 22 || s === 33) master = master ?? s;
    s = String(s).split("").reduce((a, d) => a + Number(d), 0);
  }
  return { n: s, master };
}
const lifeLine = (c: LayerCtx["c"]) => {
  const lp = lifePath(c?.profile.date);
  return lp ? `Tu número de vida es el ${lp.n}${lp.master ? ` (vienes del ${lp.master}, un número maestro)` : ""}` : null;
};
/** El elemento del signo del Sol. */
export function sunElement(c: LayerCtx["c"]): Element | null {
  const s = c?.chart.bodies.find((b) => b.id === "sun");
  return s ? SIGNS[signIndex(s.lon)].element : null;
}
const SOLID_OF: Record<Element, string> = { Fuego: "tetra", Tierra: "cube", Aire: "octa", Agua: "ico" };

/* ------------------------------------------------------------ textos */

type T = { name: string; kicker: string; meaning: string };
const TX: Record<GeoLayer, Record<string, T>> = {
  "geo-circle": {
    point: { name: "El punto", kicker: "Todo empieza en un punto: la unidad", meaning: "Antes de cualquier forma hay un punto: no tiene tamaño, solo posición. En la geometría sagrada es el origen, la conciencia antes de expresarse, la semilla de todo lo que vendrá. Cuando mires una figura, busca su centro: desde ahí se construye." },
    circle: { name: "El círculo", kicker: "El punto que se abre en todas las direcciones", meaning: "Si el punto se mueve a la misma distancia en todas las direcciones, nace el círculo: lo completo, sin principio ni fin. Es el símbolo del todo, del ciclo y de lo eterno. Casi todas las figuras sagradas se trazan solo con compás y regla, y todas empiezan por un círculo." },
    radius: { name: "El radio", kicker: "La distancia del centro al borde", meaning: "El radio es la medida que lo ordena todo: con la misma abertura del compás se dibujan la vesica, el hexágono y la flor de la vida. Es la idea de que una sola medida, repetida con paciencia, crea armonía." },
    diameter: { name: "El diámetro", kicker: "La línea que parte el círculo en dos", meaning: "El diámetro atraviesa el centro y divide el círculo en dos mitades iguales: la primera dualidad (arriba y abajo, luz y sombra, dentro y fuera). Mide exactamente dos radios." },
    pi: { name: "El número π", kicker: "3,14159…: el borde dividido por el diámetro", meaning: "Si estiras el borde de cualquier círculo, mide un poco más de tres veces su diámetro: 3,14159…, sin fin y sin repetirse. π recuerda que lo curvo y lo recto no se pueden medir del todo con la misma regla: en el círculo siempre queda un misterio." },
  },
  "geo-vesica": {
    two: { name: "Dos círculos", kicker: "El segundo círculo, trazado desde el borde del primero", meaning: "Pon el compás en el borde del primer círculo y traza otro igual: el centro de cada uno queda en el borde del otro. Es el primer movimiento de la creación: la unidad que se mira a sí misma." },
    vesica: { name: "La vesica piscis", kicker: "La almendra donde los dos se cruzan", meaning: "La zona que comparten los dos círculos se llama vesica piscis («vejiga de pez»). Es el útero de la geometría: de ella nacen el triángulo, el cuadrado, el hexágono y todas las demás formas. Simboliza el encuentro de dos mundos: lo masculino y lo femenino, el cielo y la tierra." },
    triangle: { name: "El triángulo", kicker: "Los dos centros y un cruce", meaning: "Si unes los dos centros con uno de los puntos donde se cruzan los círculos, sale un triángulo de lados iguales: el primer polígono. Con los dos cruces salen dos triángulos, uno que sube y otro que baja." },
    sqrt3: { name: "La raíz de 3", kicker: "El alto de la almendra entre su ancho: 1,732…", meaning: "El alto de la vesica dividido por su ancho da √3 = 1,732… Es una de las tres proporciones que aparecen al construir con compás (con √2 y √5). Las catedrales góticas usaron la vesica para trazar sus ventanas y sus arcos." },
    fish: { name: "El pez", kicker: "Ichthys y la mandorla", meaning: "Al prolongar las líneas de la almendra aparece un pez. Los primeros cristianos lo usaron como señal secreta, y en el arte sagrado la mandorla (la almendra) rodea a las figuras divinas como una puerta entre mundos." },
  },
  "geo-flower": {
    seed: { name: "La semilla de la vida", kicker: "Siete círculos: los siete días de la creación", meaning: "Empieza con un círculo y traza otros seis, cada uno desde un cruce del anterior. Siete círculos iguales forman la semilla de la vida, que muchas tradiciones unen a los siete días de la creación. Es una figura de comienzo: todo lo que sigue nace de ella." },
    egg: { name: "El huevo de la vida", kicker: "Siete esferas que solo se tocan", meaning: "Si separas los círculos hasta que solo se toquen, aparece el huevo de la vida. En tres dimensiones son ocho esferas, la misma forma que tiene un embrión en sus primeras divisiones. Simboliza lo que se gesta y la estructura de todo lo vivo." },
    flower: { name: "La flor de la vida", kicker: "Diecinueve círculos dentro de uno mayor", meaning: "Si sigues trazando círculos con la misma abertura, sale la flor de la vida: diecinueve círculos entrelazados dentro de un círculo grande. Se ha encontrado grabada en templos de Egipto, China, India y Europa. Dentro guarda las proporciones de casi todas las formas sagradas." },
    fruit: { name: "El fruto de la vida", kicker: "Trece círculos: la base del cubo de Metatrón", meaning: "Dentro de la flor se esconden trece círculos que no se cortan: el fruto de la vida. Si unes sus centros con líneas rectas aparece el cubo de Metatrón y, dentro de él, los sólidos platónicos. Por eso se dice que es el mapa de la materia." },
  },
  "geo-metatron": {
    fruit: { name: "Los trece círculos", kicker: "El fruto de la vida, el punto de partida", meaning: "El cubo de Metatrón parte de los trece círculos del fruto de la vida: primero lo femenino (los círculos) y después lo masculino (las líneas). Lleva el nombre de Metatrón, el arcángel que en la tradición hebrea custodia el trono y escribe en el libro de la vida." },
    lines: { name: "Las 78 líneas", kicker: "Cada centro unido con todos los demás", meaning: "Al unir cada centro con todos los otros salen 78 líneas rectas. De esa red, sin añadir nada, salen las formas que construyen la materia: es como si el universo ya estuviera dibujado dentro." },
    cube: { name: "El cubo", kicker: "Tierra · estabilidad", meaning: "El hexágono de fuera y tres líneas hasta el centro dibujan un cubo visto desde una esquina. Es la forma de la tierra: lo firme, lo que da base y cuerpo." },
    tetra: { name: "El tetraedro", kicker: "Fuego · voluntad", meaning: "Un triángulo de esquinas alternas y sus líneas al centro forman el tetraedro, la pirámide de cuatro caras. Es el fuego: la forma más sencilla y más afilada, la chispa que empuja." },
    star: { name: "La estrella tetraédrica", kicker: "Dos tetraedros encajados", meaning: "Los dos triángulos juntos dan la estrella de seis puntas, que en tres dimensiones son dos tetraedros encajados: la merkaba. Une lo que sube y lo que baja, lo masculino y lo femenino." },
    octa: { name: "El octaedro", kicker: "Aire · equilibrio", meaning: "El hexágono con la estrella dentro dibuja el octaedro, dos pirámides unidas por la base. Es el aire: el equilibrio entre arriba y abajo, la respiración, el corazón." },
    ico: { name: "El icosaedro", kicker: "Agua · fluir", meaning: "Los dos hexágonos unidos por sus triángulos dibujan el icosaedro, de veinte caras. Es el agua: la forma más redonda de las de caras triangulares, la que se adapta y fluye." },
    dodeca: { name: "El dodecaedro", kicker: "Éter · el espíritu escondido", meaning: "El quinto sólido, de doce caras de cinco lados, no sale con las líneas rectas del cubo: hay que usar también las curvas de los círculos. Por eso se dice que está escondido: es el éter, la forma del cosmos y de la conciencia." },
  },
  "geo-platonic": {
    tetra: { name: "El tetraedro", kicker: "4 caras · 4 vértices · 6 aristas · Fuego", meaning: "La forma más sencilla que puede encerrar un espacio: cuatro triángulos. Platón lo unió al fuego por sus puntas afiladas. Habla de voluntad, de inicio y de transformación. Se relaciona con el chakra del plexo solar." },
    cube: { name: "El cubo", kicker: "6 caras · 8 vértices · 12 aristas · Tierra", meaning: "Seis cuadrados iguales: lo más estable y lo que mejor se apila. Es la tierra, la materia, el cuerpo y lo que permanece. Se relaciona con el chakra raíz." },
    octa: { name: "El octaedro", kicker: "8 caras · 6 vértices · 12 aristas · Aire", meaning: "Dos pirámides unidas por la base, con ocho triángulos. Gira con facilidad sobre sus puntas: es el aire, la mente y el amor que equilibra. Se relaciona con el chakra del corazón." },
    ico: { name: "El icosaedro", kicker: "20 caras · 12 vértices · 30 aristas · Agua", meaning: "Veinte triángulos, casi una esfera: la forma que más rueda. Es el agua, las emociones, la creatividad y el cambio. Se relaciona con el chakra sacro." },
    dodeca: { name: "El dodecaedro", kicker: "12 caras · 20 vértices · 30 aristas · Éter", meaning: "Doce pentágonos llenos de proporción áurea. Platón dijo que el creador lo usó «para el todo»: es el éter, el cosmos y el espíritu. Se relaciona con los chakras de la garganta hacia arriba." },
  },
  "geo-golden": {
    phi: { name: "La proporción áurea (φ)", kicker: "1,618…: la parte grande es a la pequeña lo que el todo a la grande", meaning: "Divide una línea de modo que la parte larga sea a la corta lo mismo que la línea entera es a la parte larga: esa razón es φ = 1,618… Se llama número de oro o divina proporción. Aparece en el cuerpo, en las plantas, en las conchas y en el arte, y el ojo la siente como armonía." },
    rectangle: { name: "El rectángulo áureo", kicker: "Le quitas un cuadrado y queda otro igual, en pequeño", meaning: "Un rectángulo cuyos lados están en proporción φ guarda un secreto: si le quitas un cuadrado, lo que queda es otro rectángulo áureo más pequeño, y así sin fin. Es la imagen del crecimiento que conserva su forma." },
    spiral: { name: "La espiral áurea", kicker: "Un cuarto de círculo en cada cuadrado", meaning: "Uniendo los cuadrados con cuartos de círculo sale la espiral áurea: crece sin cambiar de forma. La ves en la concha del nautilus, en los huracanes, en las galaxias y en tu oreja. Habla de evolución: avanzar volviendo, cada vez más amplio." },
    fibonacci: { name: "La serie de Fibonacci", kicker: "1, 1, 2, 3, 5, 8, 13, 21…", meaning: "Cada número es la suma de los dos anteriores, y la división entre dos seguidos se acerca cada vez más a φ (21 ÷ 13 = 1,615…). La naturaleza crece así: muchas flores tienen 3, 5, 8 o 13 pétalos, y las espirales de una piña o de un girasol también siguen esta serie." },
    pentagram: { name: "El pentagrama", kicker: "La estrella de cinco puntas, llena de φ", meaning: "En una estrella de cinco puntas cada línea corta a las demás exactamente en proporción áurea. Los pitagóricos la usaban como símbolo de salud y de la persona completa: la cabeza, los brazos y las piernas, y los cinco elementos." },
    nature: { name: "En la naturaleza", kicker: "El ángulo de oro: 137,5°", meaning: "Un girasol coloca cada semilla girando 137,5° (el ángulo de oro) respecto a la anterior. Así ninguna tapa a otra y caben las máximas posibles, y salen espirales en los dos sentidos, en números de Fibonacci. Aquí la belleza es la forma más eficaz." },
  },
  "geo-numbers": {
    "1": { name: "El 1 · la mónada", kicker: "El punto en el círculo · la unidad", meaning: "El uno no es solo el primer número: es el origen de todos. Se dibuja como un punto dentro de un círculo. Habla de empezar, de la voluntad y de ser una misma." },
    "2": { name: "El 2 · la díada", kicker: "La línea y la vesica · la dualidad", meaning: "Con el dos aparece el otro: la línea une dos puntos y la vesica, dos círculos. Es la polaridad (luz y sombra), la unión, la escucha y la cooperación." },
    "3": { name: "El 3 · la tríada", kicker: "El triángulo · la creación", meaning: "Tres puntos ya encierran un espacio: el triángulo es la primera forma. El tres es lo que nace de dos (cuerpo, mente y espíritu; pasado, presente y futuro). Habla de crear, expresar y comunicar." },
    "4": { name: "El 4 · la tétrada", kicker: "El cuadrado · la materia", meaning: "Cuatro esquinas, cuatro elementos, cuatro estaciones y cuatro puntos cardinales. El cuadrado da orden y estabilidad: el cuatro es construir, el trabajo y la base." },
    "5": { name: "El 5 · la péntada", kicker: "El pentágono y el pentagrama · la vida", meaning: "El cinco es el número de la vida y de la persona: cinco dedos, cinco sentidos, la estrella con cabeza, brazos y piernas. Está lleno de proporción áurea. Habla de cambio, libertad y movimiento." },
    "6": { name: "El 6 · la héxada", kicker: "El hexágono y la estrella de seis puntas · la armonía", meaning: "El radio cabe exactamente seis veces en el borde de su círculo: el hexágono es la forma favorita de la naturaleza (panales, copos de nieve). El seis es armonía, amor, cuidado y belleza, y su estrella une lo de arriba con lo de abajo." },
    "7": { name: "El 7 · la héptada", kicker: "El heptágono · el misterio", meaning: "El heptágono es el único de estos polígonos que no se puede trazar exacto con compás y regla: por eso el siete es el número del misterio. Siete días, siete notas, siete colores, siete chakras. Habla de búsqueda interior y de sabiduría." },
    "8": { name: "El 8 · la óctada", kicker: "El octógono · el infinito", meaning: "Dos cuadrados girados forman el octógono, que media entre el cuadrado (la tierra) y el círculo (el cielo): por eso es la planta de muchos baptisterios. El ocho tumbado es el infinito: abundancia, poder y equilibrio entre dar y recibir." },
    "9": { name: "El 9 · la enéada", kicker: "El eneágono · la plenitud", meaning: "Tres veces tres: el nueve cierra el ciclo de los números. Si sumas las cifras de cualquier múltiplo de nueve, vuelve a dar nueve. Habla de completar, de compasión y de soltar para empezar de nuevo." },
  },
  "geo-tree": {
    keter: { name: "Kéter · la Corona", kicker: "1 · lo más alto · la fuente", meaning: "La primera esfera, en lo alto del pilar del medio: la voluntad divina antes de tener forma, la pura existencia. Es el punto del que todo brota." },
    chokmah: { name: "Jojmá · la Sabiduría", kicker: "2 · pilar de la derecha · el impulso", meaning: "La chispa que sale de la Corona: la inspiración repentina, la idea entera en un instante, la fuerza que empuja. Es lo masculino creador." },
    binah: { name: "Biná · el Entendimiento", kicker: "3 · pilar de la izquierda · la forma", meaning: "Recibe la chispa de la Sabiduría y le da forma, como un útero. Es comprender, estructurar y gestar: lo femenino que hace posible que algo nazca." },
    daat: { name: "Daat · el Conocimiento", kicker: "La esfera oculta · el abismo", meaning: "No siempre se cuenta: está entre las tres de arriba y las de abajo, como una puerta. Es el conocimiento que se vive, no el que se aprende, y el paso de lo invisible a lo visible." },
    chesed: { name: "Jésed · la Misericordia", kicker: "4 · pilar de la derecha · dar", meaning: "La generosidad sin límite, el amor que se expande y la abundancia. Por sí sola puede desbordarse: necesita a su compañera, el Rigor." },
    gevurah: { name: "Guevurá · el Rigor", kicker: "5 · pilar de la izquierda · poner límites", meaning: "La fuerza que corta, juzga y pone orden: el no que protege. Sin ella el amor no tiene forma; con demasiada, se vuelve dureza." },
    tiferet: { name: "Tiféret · la Belleza", kicker: "6 · el corazón del árbol", meaning: "En el centro, equilibra la Misericordia y el Rigor. Es la armonía, la compasión y el sol interior: el lugar donde lo de arriba y lo de abajo se encuentran." },
    netzach: { name: "Nétsaj · la Victoria", kicker: "7 · pilar de la derecha · el deseo", meaning: "La emoción, el arte, la naturaleza y la perseverancia del deseo. Es lo que sentimos y lo que nos mueve a seguir." },
    hod: { name: "Hod · el Esplendor", kicker: "8 · pilar de la izquierda · la mente", meaning: "El intelecto, la palabra y los símbolos: lo que da nombre y orden a lo que sentimos. Netsaj y Hod se necesitan: el corazón y la cabeza." },
    yesod: { name: "Yesod · el Fundamento", kicker: "9 · el pilar del medio · los sueños", meaning: "Recoge todo lo de arriba antes de bajar a la materia: la imaginación, los sueños, la Luna y el inconsciente. Es la base invisible de lo que se manifiesta." },
    malkuth: { name: "Maljut · el Reino", kicker: "10 · la raíz · la tierra", meaning: "La última esfera: el mundo físico, el cuerpo y la vida cotidiana. No es lo más bajo, sino el lugar donde todo lo anterior se hace real." },
  },
  "geo-sriyantra": {
    bindu: { name: "El bindu", kicker: "El punto del centro · la unidad", meaning: "En el centro del Sri Yantra hay un punto: el bindu, la unión de Shiva (la conciencia) y Shakti (la energía) antes de separarse. Todo el diagrama sale de él y vuelve a él." },
    shakti: { name: "Los cinco triángulos de Shakti", kicker: "Apuntan hacia abajo · lo femenino", meaning: "Cinco triángulos que miran hacia abajo representan a Shakti: la energía creadora, la materia y la diosa. Se relacionan con los cinco elementos y los cinco sentidos." },
    shiva: { name: "Los cuatro triángulos de Shiva", kicker: "Apuntan hacia arriba · lo masculino", meaning: "Cuatro triángulos que miran hacia arriba representan a Shiva: la conciencia pura que observa. Al cruzarse con los de Shakti, la creación se pone en marcha." },
    triangles: { name: "Los 43 triángulos", kicker: "Nueve triángulos que forman 43", meaning: "Al entrelazarse, los nueve triángulos crean 43 triángulos más pequeños, ordenados en círculos alrededor del centro. Cada uno es una diosa y un estado de conciencia: meditar en el yantra es recorrerlos de fuera hacia dentro." },
    circles: { name: "Los dos círculos", kicker: "El ciclo de la vida", meaning: "Dos círculos rodean los triángulos: el movimiento de la creación y el ciclo de nacer y morir. Separan el mundo de las formas del mundo del centro." },
    lotus8: { name: "El loto de ocho pétalos", kicker: "Lo que se abre por dentro", meaning: "El primer anillo de pétalos tiene ocho: las ocho direcciones y la conciencia que empieza a abrirse. El loto nace en el barro y florece limpio." },
    lotus16: { name: "El loto de dieciséis pétalos", kicker: "La realización de los deseos", meaning: "El segundo anillo tiene dieciséis pétalos: los deseos cumplidos, los sentidos y la mente en armonía. Juntos, los dos lotos son la belleza que rodea al centro." },
    bhupura: { name: "El bhupura", kicker: "El cuadrado con cuatro puertas · la tierra", meaning: "El borde es un cuadrado de tres líneas con cuatro puertas, una por cada dirección: el templo, el mundo material. Se entra por las puertas y se camina hacia el bindu." },
  },
  "geo-merkaba": {
    sun: { name: "El tetraedro del Sol", kicker: "Apunta hacia arriba · lo masculino", meaning: "Uno de los dos tetraedros apunta hacia arriba: el Sol, lo masculino, la acción y el espíritu que sube. En la meditación de la merkaba gira en un sentido." },
    earth: { name: "El tetraedro de la Tierra", kicker: "Apunta hacia abajo · lo femenino", meaning: "El otro apunta hacia abajo: la Tierra, lo femenino, la receptividad y el espíritu que baja a la materia. Gira en sentido contrario al del Sol." },
    star: { name: "La estrella de ocho puntas", kicker: "Los dos tetraedros juntos", meaning: "Encajados, los dos tetraedros forman una estrella de ocho puntas: el equilibrio de las dos energías. Vista de frente es la estrella de seis puntas, la que une el cielo y la tierra." },
    spin: { name: "El giro", kicker: "Mer-ka-ba: luz, espíritu y cuerpo", meaning: "La palabra se suele traducir como luz (mer), espíritu (ka) y cuerpo (ba). Se dice que, al girar los dos tetraedros en sentidos contrarios, se forma un campo de luz que sirve de vehículo a la conciencia." },
    body: { name: "El campo de luz", kicker: "Una esfera y un disco alrededor del cuerpo", meaning: "Las prácticas de la merkaba imaginan la estrella alrededor del cuerpo, con el corazón en el centro, y un disco de luz a la altura del pecho. Es una imagen para meditar: sentirse centrada y protegida." },
  },
  "geo-torus": {
    shape: { name: "El toro", kicker: "Un círculo que gira alrededor de un centro", meaning: "Si haces girar un círculo alrededor de un punto que está en su borde, sale el toro: una forma como una rosquilla sin agujero. Es la forma de la energía que fluye y vuelve sobre sí misma." },
    flow: { name: "El flujo", kicker: "Sale por arriba y vuelve por abajo", meaning: "En un toro, la energía sale por un polo, rodea la forma por fuera y vuelve a entrar por el otro, sin parar. Es un sistema que se alimenta a sí mismo: dar y recibir a la vez." },
    heart: { name: "El corazón", kicker: "El campo del corazón tiene forma de toro", meaning: "El campo electromagnético del corazón, el más fuerte del cuerpo, tiene forma de toro y se extiende alrededor de nosotras. Por eso muchas prácticas ponen el corazón en el centro." },
    vortex: { name: "Los vórtices", kicker: "Una espiral en cada polo", meaning: "En los dos polos del toro la energía gira en espiral, como un remolino: una hacia dentro y otra hacia fuera. Es lo que vemos en un tornado, en el agua que se va por un desagüe o en una galaxia." },
    everywhere: { name: "En todas partes", kicker: "Del átomo a la galaxia", meaning: "La forma del toro aparece en el campo magnético de la Tierra, en una manzana, en los átomos, en los huracanes y en las galaxias. Es la geometría de lo que está vivo y en equilibrio." },
  },
  "geo-chakras": {
    root: { name: "Muladhara · la raíz", kicker: "4 pétalos · el cuadrado · tierra · rojo", meaning: "En la base de la columna. Su forma es un cuadrado con un triángulo que apunta hacia abajo: la tierra, la seguridad, el cuerpo y la pertenencia." },
    sacral: { name: "Svadhisthana · el sacro", kicker: "6 pétalos · la media luna · agua · naranja", meaning: "Debajo del ombligo. Su forma es un círculo con una media luna: el agua, el placer, las emociones y la creatividad." },
    solar: { name: "Manipura · el plexo solar", kicker: "10 pétalos · el triángulo · fuego · amarillo", meaning: "Encima del ombligo. Su forma es un triángulo que apunta hacia abajo: el fuego, la voluntad, la confianza y el poder personal." },
    heart: { name: "Anahata · el corazón", kicker: "12 pétalos · la estrella de seis puntas · aire · verde", meaning: "En el centro del pecho. Su forma es la estrella de seis puntas, dos triángulos que se unen: el aire, el amor y el equilibrio entre lo de arriba y lo de abajo." },
    throat: { name: "Vishuddha · la garganta", kicker: "16 pétalos · el círculo en el triángulo · éter · azul", meaning: "En la garganta. Su forma es un círculo dentro de un triángulo: el éter, la voz, la verdad y la expresión." },
    "third-eye": { name: "Ajna · el tercer ojo", kicker: "2 pétalos · el círculo · luz · índigo", meaning: "Entre las cejas. Su forma es un círculo con dos grandes pétalos: la intuición, la visión interior y la claridad." },
    crown: { name: "Sahasrara · la corona", kicker: "1.000 pétalos · el loto · conciencia · violeta", meaning: "En lo alto de la cabeza. Es un loto de mil pétalos: la conexión con todo, la conciencia y el espíritu." },
  },
};

export const GEO_KEYS: Record<GeoLayer, string[]> = Object.fromEntries(Object.entries(TX).map(([l, t]) => [l, Object.keys(t)])) as Record<GeoLayer, string[]>;

const TREE_NOTE = "\n\nEl árbol de la vida de la cábala tiene diez esferas (sefirot) y veintidós senderos entre ellas, que se corresponden con las veintidós letras hebreas y, en la tradición moderna, con los arcanos mayores del tarot. Su dibujo sale de la flor de la vida.";
const PLATONIC_NOTE = "\n\nLos cinco sólidos platónicos son los únicos cuerpos con todas las caras, aristas y ángulos iguales. Todos caben dentro de una esfera tocándola con todos sus vértices.";
const TREE_BY_NUMBER = ["keter", "chokmah", "binah", "chesed", "gevurah", "tiferet", "netzach", "hod", "yesod"];

/* ------------------------------------------------------------ piezas */

export function geoKeys(layer: GeoLayer): string[] {
  return GEO_KEYS[layer];
}

export function geoMine(layer: GeoLayer, { c }: LayerCtx): string[] {
  const lp = lifePath(c?.profile.date);
  const el = sunElement(c);
  switch (layer) {
    case "geo-numbers":
      return lp ? [String(lp.n)] : [];
    case "geo-tree":
      return lp ? [TREE_BY_NUMBER[lp.n - 1]] : [];
    case "geo-platonic":
    case "geo-metatron":
      return el ? [SOLID_OF[el]] : [];
    default:
      return [];
  }
}

export function geoPiece(layer: GeoLayer, key: string, ctx: LayerCtx): SystemPiece {
  const t = TX[layer][key] ?? { name: key, kicker: "", meaning: "" };
  const own = geoMine(layer, ctx).includes(key);
  const el = sunElement(ctx.c);
  let personal: string | null = null;
  if (own && (layer === "geo-numbers" || layer === "geo-tree")) personal = `${lifeLine(ctx.c)}: ${layer === "geo-numbers" ? "esta es tu forma." : "esta es tu esfera en el árbol."}`;
  if (own && (layer === "geo-platonic" || layer === "geo-metatron") && el) personal = `Tu Sol está en un signo de ${el.toLowerCase()}: esta es tu forma.`;
  const extra = layer === "geo-tree" ? TREE_NOTE : layer === "geo-platonic" ? PLATONIC_NOTE : "";
  return { glyph: layer === "geo-numbers" ? key : "", name: t.name, kicker: t.kicker, meaning: t.meaning + extra, personal };
}

/* ------------------------------------------------------------ cómo se dibuja */

export type P = [number, number];
export const circ = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
export const poly = (pts: P[], close = true) => `M${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("L")}${close ? "Z" : ""}`;
export const line = (a: P, b: P) => poly([a, b], false);
export const at = (r: number, deg: number, cx = C, cy = C): P => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
export const ngon = (n: number, r: number, rot = -90, cx = C, cy = C): P[] => Array.from({ length: n }, (_, i) => at(r, rot + (360 / n) * i, cx, cy));
/** Un polígono estrellado {n/k} (o, si no sale de un trazo, varios polígonos). */
export function starPath(n: number, k: number, r: number, rot = -90, cx = C, cy = C) {
  const v = ngon(n, r, rot, cx, cy);
  const g = gcd(n, k);
  const parts: string[] = [];
  for (let s = 0; s < g; s++) {
    const pts: P[] = [];
    for (let i = 0; i < n / g; i++) pts.push(v[(s + i * k) % n]);
    parts.push(poly(pts));
  }
  return parts.join("");
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Una pieza del dibujo: su trazo y a qué piezas pertenece. */
export type E = { d: string; tags: string[]; fill?: string; w?: number; color?: string; dash?: string };
type L = { x: number; y: number; t: string; tags: string[]; size?: number; anchor?: "start" | "middle" | "end" };

/**
 * Pinta las piezas. «build»: se ve todo hasta la pieza elegida (como al construir); «focus»: se ve todo y la
 * elegida brilla; «only»: solo la elegida (y la base). Lo de la pieza elegida se dibuja paso a paso.
 */
export function GeoFigure({
  p,
  els,
  labels = [],
  selected,
  show,
  order,
  mode,
}: {
  /** El prefijo de los degradados (NightDefs): con él, el trazo es de oro con degradado y lo elegido lleva halo. */
  p?: string;
  els: E[];
  labels?: L[];
  /** La pieza elegida (brilla). Vacía: nada tocado, la figura entera se dibuja sola, en calma. */
  selected: string;
  /** Hasta dónde se ve (si no, lo elegido): sin nada tocado, la parte de la figura que se enseña. */
  show?: string;
  order: string[];
  mode: "build" | "focus" | "only";
}) {
  const idle = !selected;
  const view = show ?? selected;
  // Sin nada tocado y con una parte para enseñar: solo esa (o hasta esa, si la figura se construye).
  const m = idle && show && mode === "focus" ? "only" : mode;
  const idx = order.indexOf(view);
  const visible = (tags: string[]) =>
    tags.includes("base") ||
    (idle && !show) ||
    (m === "build" ? tags.some((t) => order.indexOf(t) <= idx && order.indexOf(t) >= 0) : m === "only" ? tags.includes(view) : true);
  const cur = (tags: string[]) => !idle && tags.includes(selected);
  const shown = els.filter((e) => visible(e.tags));
  const moving = idle ? shown : shown.filter((e) => cur(e.tags));
  const step = Math.min(0.2, (idle ? 3.2 : 2.4) / Math.max(1, moving.length));
  const gold = p ? `url(#${p}line)` : NIGHT_GOLD;
  // El halo de lo elegido, solo si no son demasiadas piezas (el girasol tiene cientos).
  const glow = !!p && !idle && moving.length <= 90;
  let k = 0;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
      {glow && (
        <g filter={`url(#${p}soft)`} opacity="0.55">
          {moving.map((e, i) => (
            <path key={`g${i}`} d={e.d} stroke={e.color ?? "#F7E2AE"} strokeWidth={(e.w ?? 1) * 3.2} className="geo-fade" />
          ))}
        </g>
      )}
      {shown.map((e, i) => {
        const on = cur(e.tags);
        const anim = on || idle;
        const base = e.tags.includes("base") && !on;
        const delay = anim ? k++ * step : 0;
        return (
          <path
            key={i}
            d={e.d}
            pathLength={1}
            className={anim ? "geo-draw" : undefined}
            style={anim ? { animationDelay: `${delay}s`, animationDuration: idle ? "1.6s" : undefined } : undefined}
            fill={e.fill ? e.fill : "none"}
            fillOpacity={e.fill ? (on ? 0.28 : 0.1) : undefined}
            stroke={e.color ?? (on ? "#FFF3D2" : gold)}
            strokeOpacity={on ? 1 : idle ? (base ? 0.3 : 0.85) : base ? 0.2 : m === "focus" ? 0.28 : 0.55}
            strokeWidth={(e.w ?? 1) * (on ? 1.35 : 0.85)}
            strokeDasharray={e.dash}
          />
        );
      })}
      {!idle &&
        labels
          .filter((l) => visible(l.tags) && (m !== "build" || cur(l.tags)))
          .map((l, i) => (
            <text
              key={`l${i}`}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor ?? "middle"}
              dominantBaseline="central"
              fontSize={l.size ?? 9.5}
              fontFamily="Georgia, 'Times New Roman', serif"
              fontStyle="italic"
              letterSpacing="0.3"
              fill={cur(l.tags) ? "#F7E2AE" : STAR}
              fillOpacity={cur(l.tags) ? 1 : 0.6}
              className={cur(l.tags) ? "geo-fade" : undefined}
              stroke="#0B0B0D"
              strokeWidth="3"
              paintOrder="stroke"
            >
              <Tr s={l.t} />
            </text>
          ))}
    </g>
  );
}

/* ---- Cada figura ---- */

function circleFig(): { els: E[]; labels: L[] } {
  const R = 110;
  return {
    els: [
      { d: circ(C, C, 2.5), tags: ["point"], fill: NIGHT_GOLD },
      { d: circ(C, C, R), tags: ["circle", "pi"] },
      { d: line([C, C], [C + R, C]), tags: ["radius"] },
      { d: line([C - R, C], [C + R, C]), tags: ["diameter"] },
      ...[0, 1, 2].map((i): E => ({ d: `M${at(R, -90 + i * 114.6)[0]} ${at(R, -90 + i * 114.6)[1]}A${R} ${R} 0 0 1 ${at(R, -90 + (i + 1) * 114.6)[0]} ${at(R, -90 + (i + 1) * 114.6)[1]}`, tags: ["pi"], w: 2.4 })),
    ],
    labels: [
      { x: C, y: C - 14, t: "el centro", tags: ["point"] },
      { x: C + R / 2, y: C - 10, t: "radio", tags: ["radius"] },
      { x: C - R / 2, y: C + 12, t: "diámetro = 2 radios", tags: ["diameter"] },
      { x: C, y: C + R + 20, t: "el borde mide 3,14159… diámetros", tags: ["pi"] },
      { x: C, y: C + 30, t: "π", tags: ["pi"], size: 26 },
    ],
  };
}

function vesicaFig(): { els: E[]; labels: L[] } {
  const r = 78;
  const a: P = [C - r / 2, C - 20];
  const b: P = [C + r / 2, C - 20];
  const h = (r * Math.sqrt(3)) / 2;
  const top: P = [C, C - 20 - h];
  const bot: P = [C, C - 20 + h];
  return {
    els: [
      { d: circ(a[0], a[1], r), tags: ["two", "base"] },
      { d: circ(b[0], b[1], r), tags: ["two", "base"] },
      { d: `M${top[0]} ${top[1]}A${r} ${r} 0 0 1 ${bot[0]} ${bot[1]}A${r} ${r} 0 0 1 ${top[0]} ${top[1]}Z`, tags: ["vesica", "fish"], fill: NIGHT_GOLD },
      { d: poly([a, b, top]), tags: ["triangle"] },
      { d: poly([a, b, bot]), tags: ["triangle"] },
      { d: line(top, bot), tags: ["sqrt3"], w: 1.6 },
      { d: line([C - r / 2, C - 20], [C + r / 2, C - 20]), tags: ["sqrt3"], w: 1.6 },
      { d: `M${bot[0]} ${bot[1]}L${bot[0] - 26} ${bot[1] + 34}M${bot[0]} ${bot[1]}L${bot[0] + 26} ${bot[1] + 34}`, tags: ["fish"], w: 1.6 },
    ],
    labels: [
      { x: C, y: bot[1] + 52, t: "alto : ancho = √3 = 1,732…", tags: ["sqrt3"] },
      { x: C, y: bot[1] + 52, t: "ichthys: el pez", tags: ["fish"] },
      { x: C, y: bot[1] + 52, t: "dos triángulos de lados iguales", tags: ["triangle"] },
    ],
  };
}

function flowerFig(): { els: E[]; labels: L[] } {
  const r = 34;
  const els: E[] = [];
  // La semilla, en el orden de los siete días.
  els.push({ d: circ(C, C, r), tags: ["seed", "flower"] });
  for (let i = 0; i < 6; i++) els.push({ d: circ(...at(r, -90 + i * 60), r), tags: ["seed", "flower"] });
  // El huevo: siete círculos que se tocan.
  els.push({ d: circ(C, C, r), tags: ["egg"] });
  for (let i = 0; i < 6; i++) els.push({ d: circ(...at(2 * r, -90 + i * 60), r), tags: ["egg"] });
  // La flor: el segundo anillo de doce y el círculo que la envuelve.
  for (let i = 0; i < 6; i++) {
    els.push({ d: circ(...at(2 * r, -90 + i * 60), r), tags: ["flower"] });
    els.push({ d: circ(...at(r * Math.sqrt(3), -60 + i * 60), r), tags: ["flower"] });
  }
  els.push({ d: circ(C, C, 3 * r), tags: ["flower"], w: 1.5 });
  els.push({ d: circ(C, C, 2 * r), tags: ["seed"], w: 1.5 });
  // El fruto: trece círculos.
  const rf = 22;
  els.push({ d: circ(C, C, rf), tags: ["fruit"] });
  for (let i = 0; i < 6; i++) els.push({ d: circ(...at(2 * rf, -90 + i * 60), rf), tags: ["fruit"] });
  for (let i = 0; i < 6; i++) els.push({ d: circ(...at(4 * rf, -90 + i * 60), rf), tags: ["fruit"] });
  return {
    els,
    labels: [
      { x: C, y: C + 3 * r + 18, t: "7 círculos", tags: ["seed"] },
      { x: C, y: C + 3 * r + 18, t: "7 esferas que se tocan", tags: ["egg"] },
      { x: C, y: C + 3 * r + 18, t: "19 círculos", tags: ["flower"] },
      { x: C, y: C + 5 * rf + 18, t: "13 círculos", tags: ["fruit"] },
    ],
  };
}

function metatronFig(): { els: E[]; labels: L[] } {
  const rf = 24;
  const ctr: P = [C, C];
  const inner = ngon(6, 2 * rf);
  const outer = ngon(6, 4 * rf);
  const pts = [ctr, ...inner, ...outer];
  const els: E[] = pts.map((p) => ({ d: circ(p[0], p[1], rf), tags: ["fruit", "dodeca", "base"] }));
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) els.push({ d: line(pts[i], pts[j]), tags: ["lines"], w: 0.6 });
  const o = (i: number) => outer[i % 6];
  const n = (i: number) => inner[i % 6];
  const hexO = [0, 1, 2, 3, 4, 5].map((i) => line(o(i), o(i + 1)));
  const hexI = [0, 1, 2, 3, 4, 5].map((i) => line(n(i), n(i + 1)));
  const add = (ds: string[], tag: string) => ds.forEach((d) => els.push({ d, tags: [tag], w: 1.2 }));
  add([...hexO, line(ctr, o(1)), line(ctr, o(3)), line(ctr, o(5))], "cube");
  add([poly([o(0), o(2), o(4)]), line(ctr, o(0)), line(ctr, o(2)), line(ctr, o(4))], "tetra");
  add([poly([o(0), o(2), o(4)]), poly([o(1), o(3), o(5)])], "star");
  add([...hexO, poly([o(0), o(2), o(4)]), poly([o(1), o(3), o(5)])], "octa");
  add([...hexO, ...hexI, ...[0, 1, 2, 3, 4, 5].flatMap((i) => [line(o(i), n(i)), line(o(i), n(i + 1))]), poly([n(0), n(2), n(4)])], "ico");
  return { els, labels: [{ x: C, y: 318, t: "el quinto sólido se esconde en las curvas", tags: ["dodeca"] }] };
}

function goldenFig(): { els: E[]; labels: L[] } {
  const els: E[] = [];
  const labels: L[] = [];
  // La línea dividida en proporción áurea.
  const x0 = 40;
  const L0 = 260;
  const a = L0 / 1.618034;
  els.push({ d: line([x0, 120], [x0 + L0, 120]), tags: ["phi"], w: 1.6 });
  els.push({ d: line([x0 + a, 108], [x0 + a, 132]), tags: ["phi"], w: 1.6 });
  els.push({ d: `M${x0} 140Q${x0 + a / 2} 170 ${x0 + a} 140`, tags: ["phi"] });
  els.push({ d: `M${x0 + a} 140Q${x0 + a + (L0 - a) / 2} 160 ${x0 + L0} 140`, tags: ["phi"] });
  els.push({ d: `M${x0} 100Q${x0 + L0 / 2} 56 ${x0 + L0} 100`, tags: ["phi"] });
  labels.push({ x: x0 + a / 2, y: 172, t: "a", tags: ["phi"], size: 13 }, { x: x0 + a + (L0 - a) / 2, y: 164, t: "b", tags: ["phi"], size: 13 }, { x: C, y: 70, t: "a + b", tags: ["phi"], size: 12 });
  labels.push({ x: C, y: 220, t: "(a + b) : a  =  a : b  =  1,618…", tags: ["phi"], size: 12 });
  // El rectángulo de Fibonacci, la espiral y los números.
  const fib = [1, 1, 2, 3, 5, 8, 13, 21];
  const sq: { x: number; y: number; s: number }[] = [{ x: 0, y: 0, s: 1 }];
  let bx0 = 0, by0 = 0, bx1 = 1, by1 = 1;
  for (let i = 1; i < fib.length; i++) {
    const s = fib[i];
    const dir = (i - 1) % 4;
    let x = 0, y = 0;
    if (dir === 0) { x = bx1; y = by0; bx1 += s; }
    else if (dir === 1) { x = bx0; y = by1; by1 += s; }
    else if (dir === 2) { x = bx0 - s; y = by0; bx0 -= s; }
    else { x = bx0; y = by0 - s; by0 -= s; }
    sq.push({ x, y, s });
  }
  const W = bx1 - bx0;
  const H = by1 - by0;
  const u = 270 / W;
  const ox = C - (W * u) / 2 - bx0 * u;
  const oy = 160 - (H * u) / 2 - by0 * u;
  const X = (v: number) => ox + v * u;
  const Y = (v: number) => oy + v * u;
  sq.forEach((q, i) => {
    els.push({ d: poly([[X(q.x), Y(q.y)], [X(q.x + q.s), Y(q.y)], [X(q.x + q.s), Y(q.y + q.s)], [X(q.x), Y(q.y + q.s)]]), tags: ["rectangle", "spiral", "fibonacci"], w: 0.9 });
    if (q.s * u > 14) labels.push({ x: X(q.x + q.s / 2), y: Y(q.y + q.s / 2), t: String(fib[i]), tags: ["fibonacci"], size: Math.min(22, 6 + q.s * u * 0.12) });
  });
  els.push({ d: poly([[X(bx0), Y(by0)], [X(bx1), Y(by0)], [X(bx1), Y(by1)], [X(bx0), Y(by1)]]), tags: ["rectangle"], w: 1.8 });
  // Los cuartos de círculo: de esquina a esquina, girando siempre igual.
  const arcs = sq.map((q, i) => {
    const dir = i === 0 ? 3 : (i - 1) % 4;
    const [from, to]: [P, P] =
      dir === 0 ? [[q.x, q.y], [q.x + q.s, q.y + q.s]] : dir === 1 ? [[q.x + q.s, q.y], [q.x, q.y + q.s]] : dir === 2 ? [[q.x + q.s, q.y + q.s], [q.x, q.y]] : [[q.x, q.y + q.s], [q.x + q.s, q.y]];
    return `M${X(from[0])} ${Y(from[1])}A${q.s * u} ${q.s * u} 0 0 1 ${X(to[0])} ${Y(to[1])}`;
  });
  arcs.forEach((d) => els.push({ d, tags: ["spiral"], w: 2 }));
  labels.push({ x: C, y: Y(by1) + 22, t: "34 : 21 = 1,619…", tags: ["rectangle"], size: 11 });
  // El pentagrama.
  els.push({ d: circ(C, C, 120), tags: ["pentagram"] });
  els.push({ d: poly(ngon(5, 120)), tags: ["pentagram"] });
  els.push({ d: starPath(5, 2, 120), tags: ["pentagram"], w: 1.6 });
  // El girasol.
  for (let i = 1; i < 260; i++) {
    const rr = 7.6 * Math.sqrt(i);
    const p = at(rr, i * 137.508);
    els.push({ d: circ(p[0], p[1], 1.2 + i / 140), tags: ["nature"], fill: NIGHT_GOLD, w: 0.4 });
  }
  return { els, labels };
}

export function numberFig(n: number): E[] {
  const R = 92;
  const t = [String(n)];
  if (n === 1) return [{ d: circ(C, C, R), tags: t }, { d: circ(C, C, 4), tags: t, fill: NIGHT_GOLD }];
  if (n === 2) return [{ d: circ(C - R / 2, C, R / 1.4), tags: t }, { d: circ(C + R / 2, C, R / 1.4), tags: t }, { d: line([C - R / 2, C], [C + R / 2, C]), tags: t, w: 1.6 }];
  const out: E[] = [{ d: circ(C, C, R), tags: t, w: 0.8 }, { d: poly(ngon(n, R)), tags: t, w: 1.6 }];
  const k = n === 5 ? 2 : n === 6 ? 2 : n === 7 ? 3 : n === 8 ? 3 : n === 9 ? 4 : 0;
  if (k) out.push({ d: starPath(n, k, R), tags: t, w: 1 });
  return out;
}

/** Las esferas del árbol de la vida y sus 22 senderos. */
const TREE_POS: Record<string, P> = {
  keter: [170, 30], chokmah: [242, 72], binah: [98, 72], daat: [170, 114], chesed: [242, 156], gevurah: [98, 156], tiferet: [170, 186], netzach: [242, 232], hod: [98, 232], yesod: [170, 262], malkuth: [170, 312],
};
const TREE_PATHS: [string, string][] = [
  ["keter", "chokmah"], ["keter", "binah"], ["keter", "tiferet"], ["chokmah", "binah"], ["chokmah", "tiferet"], ["chokmah", "chesed"], ["binah", "tiferet"], ["binah", "gevurah"], ["chesed", "gevurah"], ["chesed", "tiferet"], ["chesed", "netzach"],
  ["gevurah", "tiferet"], ["gevurah", "hod"], ["tiferet", "netzach"], ["tiferet", "yesod"], ["tiferet", "hod"], ["netzach", "hod"], ["netzach", "yesod"], ["netzach", "malkuth"], ["hod", "yesod"], ["hod", "malkuth"], ["yesod", "malkuth"],
];

function sriFig(): E[] {
  const R = 64;
  const X = (v: number) => C + v * R;
  const Y = (v: number) => C + v * R;
  const els: E[] = [];
  // Abajo (Shakti): base arriba, punta abajo. Arriba (Shiva): base abajo, punta arriba. Dibujo aproximado.
  const down: [number, number, number][] = [[-0.82, 1, 1], [-0.6, 0.78, 1], [-0.38, 0.6, 0.84], [-0.17, 0.4, 0.64], [0.06, 0.24, 0.42]];
  const up: [number, number, number][] = [[0.8, -1, 1], [0.6, -0.76, 1], [0.36, -0.52, 0.8], [0.2, -0.28, 0.56]];
  for (const [b, a, f] of down) {
    const w = Math.sqrt(1 - b * b) * f;
    els.push({ d: poly([[X(-w), Y(b)], [X(w), Y(b)], [X(0), Y(a)]]), tags: ["shakti", "triangles"], w: 1.1 });
  }
  for (const [b, a, f] of up) {
    const w = Math.sqrt(1 - b * b) * f;
    els.push({ d: poly([[X(-w), Y(b)], [X(w), Y(b)], [X(0), Y(a)]]), tags: ["shiva", "triangles"], w: 1.1 });
  }
  els.push({ d: circ(C, Y(0.12), 2.6), tags: ["bindu"], fill: NIGHT_GOLD });
  els.push({ d: circ(C, C, 1.06 * R), tags: ["circles"] }, { d: circ(C, C, 1.12 * R), tags: ["circles"] });
  const petals = (n: number, r1: number, r2: number, tag: string) => {
    const dd = 180 / n;
    for (let i = 0; i < n; i++) {
      const th = -90 + i * (360 / n);
      const p1 = at(r1 * R, th - dd);
      const q1 = at(r2 * R * 0.96, th - dd * 0.55);
      const tip = at(r2 * R, th);
      const q2 = at(r2 * R * 0.96, th + dd * 0.55);
      const p2 = at(r1 * R, th + dd);
      els.push({ d: `M${p1[0]} ${p1[1]}Q${q1[0]} ${q1[1]} ${tip[0]} ${tip[1]}Q${q2[0]} ${q2[1]} ${p2[0]} ${p2[1]}`, tags: [tag], w: 1 });
    }
    els.push({ d: circ(C, C, r1 * R), tags: [tag], w: 0.7 });
  };
  petals(8, 1.14, 1.46, "lotus8");
  petals(16, 1.5, 1.8, "lotus16");
  els.push({ d: circ(C, C, 1.84 * R), tags: ["lotus16"], w: 0.7 });
  // El cuadrado con cuatro puertas, en tres líneas.
  [2.0, 2.1, 2.2].forEach((hh) => {
    const h = hh * R * 0.92;
    const g = 0.36 * R;
    const d = 0.2 * R;
    const side: P[] = [[-h, -h], [-g, -h], [-g, -h - d], [g, -h - d], [g, -h]];
    const pts: P[] = [];
    for (let s = 0; s < 4; s++) for (const [x, y] of side) {
      const [rx, ry] = s === 0 ? [x, y] : s === 1 ? [-y, x] : s === 2 ? [-x, -y] : [y, -x];
      pts.push([C + rx, C + ry]);
    }
    els.push({ d: poly(pts), tags: ["bhupura"], w: 1 });
  });
  return els;
}

function torusFig(): { els: E[]; labels: L[] } {
  const R = 58;
  const els: E[] = [];
  for (let i = 0; i < 24; i++) els.push({ d: circ(...at(R, i * 15), R), tags: ["shape", "everywhere"], w: 0.7 });
  els.push({ d: line([C, 26], [C, 314]), tags: ["flow", "vortex"], w: 0.8, dash: "2 5" });
  // Las líneas del campo: salen por arriba, rodean la forma por fuera y vuelven a entrar por abajo (dentro del marco).
  for (const s of [0.55, 0.8, 1.05]) {
    for (const g of [1, -1]) {
      const x = C + g * 140 * s;
      els.push({ d: `M${C} ${C}C${C} ${C - 118 * s} ${x} ${C - 118 * s} ${x} ${C}C${x} ${C + 118 * s} ${C} ${C + 118 * s} ${C} ${C}`, tags: ["flow"], w: 1.1 });
    }
  }
  els.push({ d: `M${C} ${C + 14}C${C - 30} ${C - 6} ${C - 14} ${C - 26} ${C} ${C - 12}C${C + 14} ${C - 26} ${C + 30} ${C - 6} ${C} ${C + 14}Z`, tags: ["heart"], fill: "#E36B5F", color: "#F2A097", w: 1.4 });
  for (const sgn of [-1, 1]) {
    const pts: string[] = [];
    for (let t = 0; t <= 4 * Math.PI; t += 0.2) {
      const rr = 3 + t * 3.2;
      pts.push(`${(C + rr * Math.cos(t)).toFixed(1)} ${(C + sgn * 132 + rr * Math.sin(t) * 0.35).toFixed(1)}`);
    }
    els.push({ d: `M${pts.join("L")}`, tags: ["vortex"], w: 1.2 });
  }
  return { els, labels: [{ x: C, y: 326, t: "la Tierra · una manzana · un huracán · una galaxia", tags: ["everywhere"], size: 9 }] };
}

const CHAKRA: { k: string; color: string; petals: number }[] = [
  { k: "root", color: "#E2574C", petals: 4 },
  { k: "sacral", color: "#F08A3C", petals: 6 },
  { k: "solar", color: "#F2C94C", petals: 10 },
  { k: "heart", color: "#6FBF73", petals: 12 },
  { k: "throat", color: "#5AA9E6", petals: 16 },
  { k: "third-eye", color: "#6C6FD8", petals: 2 },
  { k: "crown", color: "#B58AE0", petals: 24 },
];

function chakraFig(): E[] {
  const els: E[] = [{ d: line([C, 20], [C, 320]), tags: ["base"], w: 0.8 }];
  const ida: string[] = [];
  const pin: string[] = [];
  for (let y = 300; y >= 40; y -= 4) {
    const s = Math.sin(((300 - y) / 45) * Math.PI) * 22;
    ida.push(`${(C + s).toFixed(1)} ${y}`);
    pin.push(`${(C - s).toFixed(1)} ${y}`);
  }
  els.push({ d: `M${ida.join("L")}`, tags: ["base"], w: 0.8 }, { d: `M${pin.join("L")}`, tags: ["base"], w: 0.8 });
  CHAKRA.forEach((ch, i) => {
    const y = 300 - i * 44;
    const t = [ch.k];
    const r = 14;
    els.push({ d: circ(C, y, r), tags: t, color: ch.color, fill: ch.color });
    const n = ch.petals;
    // Los pétalos del loto: almendras finas, con un poco de su color dentro.
    for (let j = 0; j < n; j++) {
      const th = -90 + j * (360 / n);
      const dd = Math.min(26, 140 / n);
      const len = n > 12 ? 7 : n === 2 ? 15 : 9.5;
      const p1 = at(r, th - dd, C, y);
      const c1 = at(r + len * 0.75, th - dd * 0.95, C, y);
      const tip = at(r + len, th, C, y);
      const c2 = at(r + len * 0.75, th + dd * 0.95, C, y);
      const p2 = at(r, th + dd, C, y);
      const f = (q: P) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
      els.push({ d: `M${f(p1)}Q${f(c1)} ${f(tip)}Q${f(c2)} ${f(p2)}`, tags: t, color: ch.color, fill: ch.color, w: 0.8 });
    }
    const inner = 9;
    if (ch.k === "root") els.push({ d: poly(ngon(4, inner * 1.3, -45, C, y)), tags: t, color: ch.color }, { d: poly(ngon(3, inner * 0.8, 90, C, y)), tags: t, color: ch.color });
    if (ch.k === "sacral") els.push({ d: `M${C - 8} ${y - 2}A8 8 0 0 0 ${C + 8} ${y - 2}A9 6 0 0 1 ${C - 8} ${y - 2}Z`, tags: t, color: ch.color });
    if (ch.k === "solar") els.push({ d: poly(ngon(3, inner, 90, C, y)), tags: t, color: ch.color });
    if (ch.k === "heart") els.push({ d: starPath(6, 2, inner, -90, C, y), tags: t, color: ch.color });
    if (ch.k === "throat") els.push({ d: poly(ngon(3, inner, 90, C, y)), tags: t, color: ch.color }, { d: circ(C, y + 1, 3.6), tags: t, color: ch.color });
    if (ch.k === "third-eye") els.push({ d: circ(C, y, 5), tags: t, color: ch.color });
    if (ch.k === "crown") els.push({ d: circ(C, y, 5), tags: t, color: ch.color }, { d: circ(C, y, 9), tags: t, color: ch.color });
  });
  return els;
}

/* ---- Los sólidos en tres dimensiones, girando ---- */

const PHI = (1 + Math.sqrt(5)) / 2;
type V3 = [number, number, number];
const SOLIDS: Record<string, V3[]> = {
  tetra: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  cube: [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): V3 => [x, y, z]))),
  octa: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  ico: [-1, 1].flatMap((a) => [-1, 1].flatMap((b): V3[] => [[0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]])),
  dodeca: [
    ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): V3 => [x, y, z]))),
    ...[-1, 1].flatMap((a) => [-1, 1].flatMap((b): V3[] => [[0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI]])),
  ],
};
function edgesOf(v: V3[]): [number, number][] {
  const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let min = Infinity;
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) min = Math.min(min, d(v[i], v[j]));
  const out: [number, number][] = [];
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (d(v[i], v[j]) < min * 1.01) out.push([i, j]);
  return out;
}
const EDGES = Object.fromEntries(Object.entries(SOLIDS).map(([k, v]) => [k, edgesOf(v)])) as Record<string, [number, number][]>;

/** El ángulo de giro, que avanza solo (salvo si la alumna prefiere menos movimiento). */
function useSpin(speed = 0.35) {
  const [a, setA] = useState(0.6);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      setA((x) => x + ((t - last) / 1000) * speed);
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return a;
}

function project(v: V3[], a: number, tilt: number, S: number, cx = C, cy = C) {
  const r = Math.max(...v.map((p) => Math.hypot(...p)));
  return v.map(([x, y, z]) => {
    const x1 = x * Math.cos(a) + z * Math.sin(a);
    const z1 = -x * Math.sin(a) + z * Math.cos(a);
    const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt);
    const z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
    return { x: cx + (x1 / r) * S, y: cy + (y2 / r) * S, z: z2 / r };
  });
}

function Wire({ id, a, S, cx = C, cy = C, on = true, color, flip = false, draw = false }: { id: string; a: number; S: number; cx?: number; cy?: number; on?: boolean; color?: string; flip?: boolean; draw?: boolean }) {
  const v = flip ? SOLIDS[id].map(([x, y, z]): V3 => [-x, -y, -z]) : SOLIDS[id];
  const pts = project(v, a, 0.42, S, cx, cy);
  const col = color ?? (on ? "#F7E2AE" : NIGHT_GOLD);
  return (
    <g pointerEvents="none">
      {EDGES[id].map(([i, j], k) => {
        const z = (pts[i].z + pts[j].z) / 2;
        return (
          <path
            key={k}
            d={`M${pts[i].x} ${pts[i].y}L${pts[j].x} ${pts[j].y}`}
            pathLength={1}
            className={draw ? "geo-draw" : undefined}
            style={draw ? { animationDelay: `${k * 0.06}s` } : undefined}
            stroke={col}
            strokeOpacity={(on ? 0.45 : 0.18) + (on ? 0.55 : 0.25) * ((z + 1) / 2)}
            strokeWidth={on ? 1.2 + 0.8 * ((z + 1) / 2) : 0.8}
            strokeLinecap="round"
          />
        );
      })}
      {on && pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.2 + 1.4 * ((p.z + 1) / 2)} fill={col} fillOpacity={0.5 + 0.5 * ((p.z + 1) / 2)} />)}
    </g>
  );
}

const SOLID_NAME: Record<string, string> = { tetra: "fuego", cube: "tierra", octa: "aire", ico: "agua", dodeca: "éter" };

function Platonic({ selected, run, p }: { selected: string; run: number; p: string }) {
  const t = useT();
  const a = useSpin();
  const one = selected in SOLIDS;
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[34rem] select-none" role="img" aria-label={t("Los sólidos platónicos")}>
      <NightDefs p={p} />
      <Astrolabe p={p} />
      <g key={`${selected}-${run}`}>
        {one ? (
          <>
            <circle cx={C} cy={C} r="122" fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.22" strokeDasharray="1 4" />
            <g filter={`url(#${p}soft)`} opacity="0.5">
              <Wire id={selected} a={a} S={118} />
            </g>
            <Wire id={selected} a={a} S={118} draw />
          </>
        ) : (
          // Sin nada tocado: los cinco, girando despacio en un pentágono.
          (["tetra", "cube", "octa", "ico", "dodeca"] as const).map((id, i) => {
            const q = at(100, -90 + i * 72);
            return (
              <g key={id}>
                <Wire id={id} a={a + i * 0.7} S={34} cx={q[0]} cy={q[1]} draw />
                <text x={q[0]} y={q[1] + 50} textAnchor="middle" fontSize="10" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill={STAR} fillOpacity="0.7" className="geo-fade">
                  <Tr s={SOLID_NAME[id]} />
                </text>
              </g>
            );
          })
        )}
      </g>
    </svg>
  );
}

function Merkaba({ selected, run, p }: { selected: string; run: number; p: string }) {
  const t = useT();
  const a = useSpin(0.4);
  const idle = !selected;
  const turning = selected === "spin" || idle;
  const sunOn = idle || selected === "sun" || selected === "star" || selected === "spin";
  const earthOn = idle || selected === "earth" || selected === "star" || selected === "spin";
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[34rem] select-none" role="img" aria-label={t("La merkaba")}>
      <NightDefs p={p} />
      <Astrolabe p={p} />
      <g key={`${selected}-${run}`}>
        {selected === "body" && (
          <g fill="none" stroke="#F7E2AE" pointerEvents="none">
            <circle cx={C} cy={C} r="140" pathLength={1} className="geo-draw" strokeWidth="1.2" />
            <ellipse cx={C} cy={C + 8} rx="156" ry="20" pathLength={1} className="geo-draw" style={{ animationDelay: ".4s" }} strokeWidth="1" />
            <circle cx={C} cy={C} r="16" fill="#E36B5F" opacity="0.35" filter={`url(#${p}soft)`} stroke="none" className="geo-fade" />
            <circle cx={C} cy={C} r="5" fill="#E36B5F" stroke="none" className="geo-fade" />
          </g>
        )}
        {selected === "spin" && (
          <g fill="none" stroke="#F7E2AE" strokeWidth="1" pointerEvents="none">
            <path d={`M${C - 120} ${C - 118}A170 40 0 0 1 ${C + 120} ${C - 118}`} pathLength={1} className="geo-draw" />
            <path d={`M${C + 120} ${C + 128}A170 40 0 0 1 ${C - 120} ${C + 128}`} pathLength={1} className="geo-draw" style={{ animationDelay: ".3s" }} />
          </g>
        )}
        {(sunOn || earthOn) && !idle && (
          <g filter={`url(#${p}soft)`} opacity="0.45">
            {sunOn && <Wire id="tetra" a={turning ? a : 0.6} S={120} color="#F7D27A" />}
            {earthOn && <Wire id="tetra" a={turning ? -a : 0.6} S={120} color="#B8D8F2" flip />}
          </g>
        )}
        <Wire id="tetra" a={turning ? a : 0.6} S={120} on={sunOn || selected === "body"} color={sunOn ? "#F7D27A" : undefined} draw={idle || selected === "sun" || selected === "star"} />
        <Wire id="tetra" a={turning ? -a : 0.6} S={120} on={earthOn || selected === "body"} color={earthOn ? "#B8D8F2" : undefined} flip draw={idle || selected === "earth"} />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------ el dibujo */

/** Sin nada tocado: la parte de la figura que se enseña entera (si no está, la figura completa). */
const IDLE_SHOW: Partial<Record<GeoLayer, string>> = {
  "geo-circle": "diameter",
  "geo-vesica": "triangle",
  "geo-flower": "flower",
  "geo-golden": "spiral",
  "geo-torus": "shape",
};

/** Sin nada tocado en los números: los polígonos del 3 al 9, uno sobre otro, como una rosa. */
function numbersRose(): E[] {
  const R = 96;
  const out: E[] = [{ d: circ(C, C, R), tags: ["all"], w: 0.8 }, { d: circ(C, C, 3), tags: ["all"], fill: NIGHT_GOLD }];
  for (let n = 3; n <= 9; n++) out.push({ d: poly(ngon(n, R)), tags: ["all"], w: 0.9 });
  return out;
}

export function GeoDiagram({ layer, selected, mine, keys, tap }: DiagramProps & { layer: GeoLayer }) {
  const t = useT();
  const p = usePrefix();
  const [run, setRun] = useState(0);
  const own = new Set(mine);
  const order = keys;
  const show = selected ? undefined : IDLE_SHOW[layer];
  let body: ReactNode = null;
  const svg = (children: ReactNode, frame = true) => (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[34rem] select-none" role="img" aria-label={t(TX[layer][selected]?.name ?? GEO_TITLE[layer])}>
      <NightDefs p={p} />
      {frame && <Astrolabe p={p} />}
      <g key={`${selected}-${run}`}>{children}</g>
    </svg>
  );
  const fig = (f: { els: E[]; labels: L[] }, mode: "build" | "focus" | "only", frame = true) =>
    svg(<GeoFigure p={p} els={f.els} labels={f.labels} selected={selected} show={show} order={order} mode={mode} />, frame);
  switch (layer) {
    case "geo-circle":
      body = fig(circleFig(), "build");
      break;
    case "geo-vesica":
      body = fig(vesicaFig(), "build");
      break;
    case "geo-flower":
      body = fig(flowerFig(), "only");
      break;
    case "geo-metatron":
      body = fig(metatronFig(), "focus");
      break;
    case "geo-golden":
      body = fig(goldenFig(), "only", false);
      break;
    case "geo-numbers": {
      body = (
        <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[34rem] select-none" role="group" aria-label={t("Los números y sus formas")}>
          <NightDefs p={p} />
          <Astrolabe p={p} r={164} />
          <g key={`${selected}-${run}`}>
            {selected ? <GeoFigure p={p} els={numberFig(Number(selected))} selected={selected} order={order} mode="only" /> : <GeoFigure p={p} els={numbersRose()} selected="" order={order} mode="focus" />}
          </g>
          {keys.map((k, i) => {
            const q = at(146, -90 + i * 40);
            const on = k === selected;
            return (
              <g key={k} {...tap(k, `El ${k}`)}>
                {on && <circle cx={q[0]} cy={q[1]} r="22" fill={`url(#${p}goldglow)`} />}
                <circle cx={q[0]} cy={q[1]} r="14.5" fill={on ? `url(#${p}gold)` : "#121214"} stroke={own.has(k) || on ? "#F7E2AE" : "rgb(233 204 142 / .45)"} strokeWidth={own.has(k) ? 1.5 : 0.9} />
                <text x={q[0]} y={q[1] + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="14" fontFamily="Georgia, 'Times New Roman', serif" fill={on ? "#2A1E0C" : STAR} pointerEvents="none">
                  <Tr s={k} />
                </text>
              </g>
            );
          })}
        </svg>
      );
      break;
    }
    case "geo-tree": {
      body = (
        <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[30rem] select-none" role="group" aria-label={t("El árbol de la vida")}>
          <NightDefs p={p} />
          {/* Los tres pilares, muy suaves: el Rigor, el Equilibrio y la Misericordia. */}
          <g pointerEvents="none" stroke={NIGHT_GOLD} strokeOpacity="0.1" strokeWidth="14" strokeLinecap="round">
            <line x1="98" y1="72" x2="98" y2="232" />
            <line x1="170" y1="30" x2="170" y2="312" />
            <line x1="242" y1="72" x2="242" y2="232" />
          </g>
          <g key={`t-${run}`} fill="none" pointerEvents="none">
            {TREE_PATHS.map(([a, b], i) => {
              const hit = a === selected || b === selected;
              return (
                <g key={i}>
                  {hit && <path d={line(TREE_POS[a], TREE_POS[b])} stroke="#F7E2AE" strokeWidth="4" opacity="0.45" filter={`url(#${p}soft)`} />}
                  <path d={line(TREE_POS[a], TREE_POS[b])} pathLength={1} className="geo-draw" style={{ animationDelay: `${i * 0.05}s` }} stroke={hit ? "#FFF3D2" : `url(#${p}line)`} strokeOpacity={hit ? 1 : selected ? 0.4 : 0.6} strokeWidth={hit ? 1.6 : 0.9} />
                </g>
              );
            })}
          </g>
          {Object.entries(TREE_POS).map(([k, q]) => {
            const on = k === selected;
            const hidden = k === "daat";
            const n = ["keter", "chokmah", "binah", "chesed", "gevurah", "tiferet", "netzach", "hod", "yesod", "malkuth"].indexOf(k) + 1;
            return (
              <g key={k} {...tap(k, TX["geo-tree"][k].name)}>
                {on && <circle cx={q[0]} cy={q[1]} r="32" fill={`url(#${p}goldglow)`} />}
                <circle cx={q[0]} cy={q[1]} r="19" fill={on ? `url(#${p}gold)` : "#121214"} stroke={own.has(k) || on ? "#F7E2AE" : `url(#${p}line)`} strokeOpacity={on || own.has(k) ? 1 : 0.75} strokeWidth={own.has(k) ? 1.6 : 1} strokeDasharray={hidden ? "2.5 3" : undefined} />
                <circle cx={q[0]} cy={q[1]} r="19" fill={`url(#${p}gloss)`} opacity={on ? 0.5 : 0.18} pointerEvents="none" />
                <text x={q[0]} y={q[1] - 4} textAnchor="middle" dominantBaseline="central" fontSize="10" fontFamily="Georgia, 'Times New Roman', serif" fill={on ? "#2A1E0C" : NIGHT_GOLD} pointerEvents="none">
                  {n || "·"}
                </text>
                <text x={q[0]} y={q[1] + 8} textAnchor="middle" dominantBaseline="central" fontSize="5.4" letterSpacing="0.6" fontWeight={600} fill={on ? "#2A1E0C" : STAR} fillOpacity={on ? 1 : 0.8} pointerEvents="none">
                  {TX["geo-tree"][k].name.split(" · ")[0].toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      );
      break;
    }
    case "geo-sriyantra":
      body = svg(<GeoFigure p={p} els={sriFig()} selected={selected} order={order} mode="build" />);
      break;
    case "geo-merkaba":
      body = <Merkaba selected={selected} run={run} p={p} />;
      break;
    case "geo-platonic":
      body = <Platonic selected={selected} run={run} p={p} />;
      break;
    case "geo-torus":
      body = fig(torusFig(), "focus");
      break;
    case "geo-chakras":
      body = svg(
        <>
          <GeoFigure p={p} els={chakraFig()} selected={selected} order={order} mode="focus" />
          {CHAKRA.map((ch, i) => {
            const on = ch.k === selected;
            return (
              <g key={ch.k} {...tap(ch.k, TX["geo-chakras"][ch.k].name)}>
                <rect x={C - 34} y={300 - i * 44 - 22} width="150" height="44" fill="transparent" />
                <text x={C + 44} y={300 - i * 44} dominantBaseline="central" fontSize="10" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill={on ? "#F7E2AE" : STAR} fillOpacity={on ? 1 : 0.7}>
                  <Tr s={TX["geo-chakras"][ch.k].name.split(" · ")[1]} />
                </text>
              </g>
            );
          })}
        </>,
        false,
      );
      break;
  }
  const tappable = layer === "geo-numbers" || layer === "geo-tree" || layer === "geo-chakras";
  return (
    <NightPanel>
      {body}
      {!tappable && <NightChips items={keys.map((k) => ({ key: k, label: TX[layer][k].name }))} selected={selected} mine={own} tap={tap} />}
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          data-model-keep=""
          onClick={() => setRun((r) => r + 1)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-4 text-[0.66rem] uppercase tracking-[0.18em] transition hover:opacity-100"
          style={{ borderColor: "rgb(233 204 142 / .3)", color: NIGHT_GOLD, opacity: 0.85 }}
        ><Tr s={"↻ Volver a dibujar"} /></button>
      </div>
    </NightPanel>
  );
}

/** El nombre de cada figura (para leerla sin vista y para el modelo principal). */
export const GEO_TITLE: Record<GeoLayer, string> = {
  "geo-circle": "El punto y el círculo",
  "geo-vesica": "La vesica piscis",
  "geo-flower": "La flor de la vida",
  "geo-metatron": "El cubo de Metatrón",
  "geo-platonic": "Los sólidos platónicos",
  "geo-golden": "La proporción áurea",
  "geo-numbers": "Los números y sus formas",
  "geo-tree": "El árbol de la vida",
  "geo-sriyantra": "El Sri Yantra",
  "geo-merkaba": "La merkaba",
  "geo-torus": "El toro",
  "geo-chakras": "Los chakras y sus formas",
};

/** Lo que se cuenta de cada figura antes de tocar nada (el modelo principal). */
export const GEO_INTRO: Record<GeoLayer, string> = {
  "geo-circle": "Toda la geometría sagrada empieza igual: un punto y, alrededor, un círculo. Con un compás y una regla, y nada más, salen todas las demás figuras. Toca cada parte para ver cómo nace.",
  "geo-vesica": "Dos círculos iguales, cada uno con su centro en el borde del otro. Donde se cruzan nace la almendra de la que salen el triángulo, el cuadrado y todas las formas.",
  "geo-flower": "De siete círculos a diecinueve: la semilla, el huevo, la flor y el fruto de la vida. Está grabada en templos de medio mundo y guarda dentro casi todas las formas sagradas.",
  "geo-metatron": "Trece círculos y setenta y ocho líneas: el mapa de la materia. Dentro se esconden los cinco sólidos que, según Platón, construyen todo lo que existe.",
  "geo-platonic": "Los únicos cinco cuerpos con todas las caras, aristas y ángulos iguales. Platón los unió a los elementos: fuego, tierra, aire, agua y éter.",
  "geo-golden": "1,618…: la proporción que el ojo siente como armonía. La ves en las conchas, en las flores, en las galaxias y en tu propio cuerpo.",
  "geo-numbers": "Cada número tiene su forma: el uno es el punto, el tres el triángulo, el seis el hexágono… Toca un número para ver su figura.",
  "geo-tree": "Diez esferas y veintidós senderos: el mapa de la cábala para ir de lo más alto a lo más concreto, y de vuelta. Toca una esfera.",
  "geo-sriyantra": "Nueve triángulos entrelazados alrededor de un punto: el yantra más venerado de la India, para meditar de fuera hacia dentro.",
  "geo-merkaba": "Dos tetraedros encajados, uno que sube y otro que baja: el vehículo de luz de muchas meditaciones.",
  "geo-torus": "La forma de la energía que sale, da la vuelta y vuelve a entrar: del campo del corazón a las galaxias.",
  "geo-chakras": "Cada chakra tiene su forma y su número de pétalos: del cuadrado de la raíz al loto de mil pétalos de la corona.",
};
