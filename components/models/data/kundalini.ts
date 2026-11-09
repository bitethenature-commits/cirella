/**
 * Kundalini: la energía (la serpiente, los chakras, los nadis y los nudos) y el Kundalini Yoga (los 10
 * cuerpos y su numerología, los cierres, los mudras, la respiración, los mantras y la clase). Textos propios
 * y sencillos, para aprender; no sustituyen a una profesora ni a un médico.
 */

export type KText = { name: string; kicker: string; meaning: string };

/* ------------------------------------------------------------ los chakras */

export const K_CHAKRAS = ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown", "aura"] as const;
export type KChakra = (typeof K_CHAKRAS)[number];
export const CHAKRA_INFO: Record<KChakra, KText & { color: string; y: number; bija: string; element: string }> = {
  root: { name: "Muladhara · la raíz", kicker: "1º · rojo · tierra · LAM", color: "#E2574C", y: 262, bija: "LAM", element: "Tierra", meaning: "En la base de la columna, donde duerme la kundalini enroscada. Es la seguridad, el cuerpo, el dinero y la pertenencia. Equilibrado da confianza y raíces; bloqueado, miedo y prisa por sobrevivir." },
  sacral: { name: "Svadhisthana · el sacro", kicker: "2º · naranja · agua · VAM", color: "#F08A3C", y: 236, bija: "VAM", element: "Agua", meaning: "Debajo del ombligo. Es la creatividad, el placer, la sexualidad y las emociones que fluyen. Equilibrado da alegría y creatividad; bloqueado, culpa o apegos." },
  solar: { name: "Manipura · el ombligo", kicker: "3º · amarillo · fuego · RAM", color: "#F2C94C", y: 206, bija: "RAM", element: "Fuego", meaning: "En el ombligo, el centro de la energía en el Kundalini Yoga (muchos ejercicios lo trabajan). Es la voluntad, el compromiso y el poder personal. Equilibrado da fuerza para terminar lo que empiezas." },
  heart: { name: "Anahata · el corazón", kicker: "4º · verde · aire · YAM", color: "#6FBF73", y: 158, bija: "YAM", element: "Aire", meaning: "En el centro del pecho, el puente entre los tres de abajo (lo humano) y los tres de arriba (lo espiritual). Es el amor, la compasión y el perdón." },
  throat: { name: "Vishuddha · la garganta", kicker: "5º · azul · éter · HAM", color: "#5AA9E6", y: 113, bija: "HAM", element: "Éter", meaning: "En la garganta. Es la verdad, la palabra y escuchar. Equilibrado, dices lo que sientes con claridad y amabilidad; por eso se canta tanto en Kundalini Yoga." },
  "third-eye": { name: "Ajna · el tercer ojo", kicker: "6º · índigo · la mente · OM", color: "#6C6FD8", y: 70, bija: "OM", element: "Luz", meaning: "Entre las cejas, el punto donde se miran con los ojos cerrados en muchas meditaciones. Es la intuición, la visión interior y la claridad." },
  crown: { name: "Sahasrara · la corona", kicker: "7º · violeta · la conciencia · el silencio", color: "#B58AE0", y: 36, bija: "—", element: "Conciencia", meaning: "En lo alto de la cabeza, el loto de mil pétalos. Es la unión con todo: donde llega la kundalini al final de su camino y se encuentran Shakti (la energía) y Shiva (la conciencia)." },
  aura: { name: "El aura · el octavo chakra", kicker: "8º · blanco · el campo que te rodea", color: "#F4F1EA", y: 0, bija: "—", element: "Luz", meaning: "En el Kundalini Yoga se cuenta un octavo chakra: el aura, el campo de luz que rodea el cuerpo y une a todos los demás. Protege y proyecta: cuando es fuerte, la persona contiene y eleva lo que pasa a su alrededor." },
};

/* ------------------------------------------------------------ los nadis */

export const NADIS: Record<string, KText> = {
  ida: { name: "Ida · el canal de la Luna", kicker: "Izquierda · frío · calma · la fosa izquierda", meaning: "Ida nace a la izquierda de la base de la columna y sube serpenteando hasta la fosa nasal izquierda. Es la energía lunar: fresca, receptiva, emocional y tranquila. Respirar por la izquierda calma." },
  pingala: { name: "Pingala · el canal del Sol", kicker: "Derecha · calor · acción · la fosa derecha", meaning: "Pingala nace a la derecha y sube hasta la fosa nasal derecha, cruzándose con ida en cada chakra. Es la energía solar: cálida, activa, mental y decidida. Respirar por la derecha da energía." },
  sushumna: { name: "Sushumna · el canal central", kicker: "Por el centro de la columna · el camino de la kundalini", meaning: "Sushumna sube recto por el centro de la columna, de la raíz a la corona. Se abre cuando ida y pingala están en equilibrio: por él sube la kundalini cuando despierta." },
  nadis: { name: "Los 72.000 nadis", kicker: "Una red de canales de energía", meaning: "Los textos del yoga cuentan 72.000 nadis (canales sutiles) por los que circula el prana, la energía vital, como ríos por todo el cuerpo. Los tres principales son ida, pingala y sushumna." },
  nostrils: { name: "La fosa que domina", kicker: "Cambia cada hora y media o dos horas", meaning: "Casi siempre respiramos más por una fosa que por otra, y se van turnando a lo largo del día. Compruébalo: tapa una y luego la otra. Puedes cambiar tu estado eligiendo por dónde respiras." },
};

/* ------------------------------------------------------------ la serpiente */

export const SERPENT: Record<string, KText> = {
  coiled: { name: "La serpiente dormida", kicker: "Tres vueltas y media en la base de la columna", meaning: "La tradición imagina la kundalini como una serpiente enroscada tres vueltas y media en la raíz, dormida. Es nuestra energía creadora en reposo: está en todas las personas, aunque no la sintamos." },
  awakening: { name: "El despertar", kicker: "Poco a poco, con la práctica", meaning: "La respiración, los cierres, los mantras y la meditación van despertando esa energía. En el Kundalini Yoga se busca un despertar suave y gradual, sostenido por un sistema nervioso fuerte, no una explosión." },
  rising: { name: "La subida por sushumna", kicker: "Chakra a chakra, de la raíz a la corona", meaning: "Al despertar, la energía sube por el canal central y va abriendo cada chakra. Cada uno que se atraviesa trae su lección: seguridad, creatividad, voluntad, amor, verdad, intuición." },
  crown: { name: "La unión en la corona", kicker: "Shakti se encuentra con Shiva", meaning: "Cuando la energía llega a la corona, la tradición dice que Shakti (la energía) se une con Shiva (la conciencia): un estado de paz, amplitud y unidad. No es una meta para correr: es un camino de toda la vida." },
  signs: { name: "Las señales", kicker: "Calor, hormigueo, emociones, más intuición", meaning: "Al practicar pueden aparecer calor en la columna, hormigueos, emociones que suben, sueños más vivos o más intuición. Suelen ser suaves y pasajeras: observa, respira y apúntalo." },
  care: { name: "Con cuidado", kicker: "Sin forzar y acompañada", meaning: "Practica de forma gradual, con una profesora formada y escuchando tu cuerpo. Si aparecen síntomas fuertes (insomnio, ansiedad, mareos), para, toma tierra (comer, caminar descalza, descansar) y busca ayuda profesional." },
};

export const GRANTHIS: Record<string, KText> = {
  brahma: { name: "Brahma granthi", kicker: "El primer nudo · en la raíz y el sacro", meaning: "El nudo de Brahma ata la energía a lo físico: la seguridad, el cuerpo, los deseos y el miedo a no tener. Se va soltando cuando confías en que la vida te sostiene." },
  vishnu: { name: "Vishnu granthi", kicker: "El segundo nudo · en el corazón", meaning: "El nudo de Vishnu ata a lo emocional: los apegos, la necesidad de que te quieran de una manera concreta. Se suelta con amor sin condiciones, empezando por ti." },
  rudra: { name: "Rudra granthi", kicker: "El tercer nudo · en el tercer ojo", meaning: "El nudo de Rudra ata a la mente: las ideas sobre una misma, incluso el orgullo espiritual. Se suelta con humildad y dejando de identificarte con lo que piensas." },
};

export const BANDHAS: Record<string, KText> = {
  mula: { name: "Mula bandha · el cierre de raíz", kicker: "Contraer la base: ano, órganos sexuales y ombligo", meaning: "Se contraen a la vez los músculos del ano, de los órganos sexuales y el ombligo hacia la columna. Une la energía que sube (prana) con la que baja (apana) y la dirige hacia arriba. Se hace al final de muchos ejercicios." },
  uddiyana: { name: "Uddiyana bandha · el cierre del diafragma", kicker: "El vientre hacia dentro y hacia arriba, sin aire", meaning: "Con el aire fuera, se sube el diafragma y se lleva el vientre hacia la columna. Masajea los órganos y empuja la energía hacia el corazón. No se hace con el estómago lleno ni durante el embarazo." },
  jalandhara: { name: "Jalandhara bandha · el cierre del cuello", kicker: "La barbilla un poco atrás, el cuello largo", meaning: "Se alarga la nuca llevando la barbilla un poco hacia atrás, sin bajar la cabeza. Protege el cuello y la cabeza de la presión y deja que la energía suba tranquila. Se mantiene casi siempre al meditar." },
  maha: { name: "Maha bandha · el gran cierre", kicker: "Los tres a la vez", meaning: "Los tres cierres juntos, normalmente con el aire fuera. Es el cierre más poderoso: sella la energía y la equilibra en todo el cuerpo. Se aprende poco a poco." },
};

export const MUDRAS: Record<string, KText & { finger: number | null }> = {
  gyan: { name: "Gyan mudra", kicker: "Pulgar con índice · la sabiduría", finger: 1, meaning: "La punta del pulgar toca la del índice y los otros dedos quedan rectos. Es el mudra más usado al meditar: abre a la sabiduría, la calma y la receptividad. El índice es Júpiter: la expansión." },
  shuni: { name: "Shuni mudra", kicker: "Pulgar con corazón · la paciencia", finger: 2, meaning: "El pulgar toca el dedo corazón (Saturno). Da paciencia, discernimiento y compromiso: ayuda a sostener lo que empiezas." },
  surya: { name: "Surya (Ravi) mudra", kicker: "Pulgar con anular · la energía", finger: 3, meaning: "El pulgar toca el anular (el Sol). Da vitalidad, salud y confianza: es bueno cuando te falta fuerza." },
  buddhi: { name: "Buddhi mudra", kicker: "Pulgar con meñique · la comunicación", finger: 4, meaning: "El pulgar toca el meñique (Mercurio). Ayuda a comunicarte con claridad y a confiar en tu intuición." },
  prayer: { name: "Las manos en oración", kicker: "Palmas unidas en el centro del pecho", finger: null, meaning: "Las palmas juntas frente al corazón, los pulgares tocando el esternón. Neutraliza los dos lados (Sol y Luna) y centra. Así empieza cada clase, al cantar el Adi Mantra." },
  venus: { name: "El cierre de Venus", kicker: "Los dedos entrelazados", finger: null, meaning: "Los dedos entrelazados, con un pulgar sobre el otro (en mujeres, normalmente el izquierdo encima). Canaliza la energía sexual y creativa y ayuda a concentrarse." },
  bear: { name: "El agarre del oso", kicker: "Las manos enganchadas frente al pecho", finger: null, meaning: "Una palma hacia fuera y otra hacia dentro, los dedos doblados y enganchados, tirando sin soltar. Estimula el corazón y fortalece la concentración." },
  dhyani: { name: "Dhyani mudra", kicker: "Las manos en cuenco, una sobre otra", finger: null, meaning: "Las manos descansan en el regazo, una sobre otra, como un cuenco, y los pulgares se tocan. Es el gesto de la meditación profunda y la receptividad." },
};

export const BREATHS: Record<string, KText & { wave: "long" | "fire" | "left" | "right" | "alt" | "seg" | "sitali" | "hold" }> = {
  long: { name: "La respiración larga y profunda", kicker: "Lenta, por la nariz, del vientre al pecho", wave: "long", meaning: "Se llena primero el vientre, después el pecho y al final la parte de arriba de los pulmones, y se vacía al revés. Muy lenta (menos de ocho por minuto) calma la mente y el sistema nervioso. Es la base de todo." },
  fire: { name: "La respiración de fuego", kicker: "Rápida, rítmica, desde el ombligo", wave: "fire", meaning: "Por la nariz, rápida y sin pausa, unas dos o tres veces por segundo, con el ombligo que entra al soltar el aire. La misma cantidad de aire al entrar y al salir. Limpia, da energía y fortalece. No se hace durante el embarazo ni los primeros días de la regla." },
  left: { name: "Por la fosa izquierda", kicker: "Ida · calma y enfría", wave: "left", meaning: "Tapa la fosa derecha y respira largo y profundo solo por la izquierda. Activa ida, la energía lunar: calma, ayuda a dormir y suaviza las emociones." },
  right: { name: "Por la fosa derecha", kicker: "Pingala · da energía", wave: "right", meaning: "Tapa la fosa izquierda y respira por la derecha. Activa pingala, la energía solar: despierta, da claridad y ganas de actuar." },
  alt: { name: "La respiración alterna", kicker: "Una fosa y la otra", wave: "alt", meaning: "Inhala por una fosa, exhala por la otra, y cambia. Equilibra los dos hemisferios y los dos canales, ida y pingala, y abre el camino central." },
  seg: { name: "La respiración segmentada", kicker: "En cuatro (u ocho) tiempos", wave: "seg", meaning: "Se inhala en cuatro golpes cortos y se exhala en otros cuatro, como en escalera. Ordena la mente y da energía estable. Suele acompañar a un mantra (Sa Ta Na Ma)." },
  sitali: { name: "Sitali", kicker: "La lengua en tubo · refresca", wave: "sitali", meaning: "Se saca la lengua enrollada como un tubo, se inhala por ella y se exhala por la nariz. Refresca el cuerpo, calma y ayuda a la digestión." },
  hold: { name: "La suspensión del aire", kicker: "Retener dentro o fuera", wave: "hold", meaning: "Al final de muchos ejercicios se retiene el aire unos segundos, dentro o fuera, a menudo con el cierre de raíz. Es el momento en que la energía se mueve y se integra. Nunca se fuerza." },
};

export const MANTRAS: Record<string, KText & { words: string[] }> = {
  adi: { name: "Adi Mantra", kicker: "«Ong Namo Guru Dev Namo» · para empezar", words: ["Ong", "Namo", "Guru", "Dev", "Namo"], meaning: "Se canta tres veces al empezar cada clase, con las manos en oración. Significa «me inclino ante la sabiduría creativa, ante la sabiduría divina que hay en mí». Conecta con la cadena de enseñantes y con tu maestra interior." },
  satnam: { name: "Sat Nam", kicker: "«Verdad es mi identidad»", words: ["Sat", "Nam"], meaning: "El mantra semilla del Kundalini Yoga: «la verdad es mi nombre». Se usa como saludo, se canta al final de la clase y acompaña muchos ejercicios: Sat al inhalar, Nam al exhalar." },
  wahe: { name: "Wahe Guru", kicker: "El mantra del asombro", words: ["Wa", "He", "Gu", "Ru"], meaning: "Expresa la alegría y el asombro ante lo infinito: «¡qué maravillosa es la sabiduría!». Es un mantra de éxtasis y de gratitud." },
  satanama: { name: "Sa Ta Na Ma", kicker: "Nacimiento, vida, muerte y renacimiento", words: ["Sa", "Ta", "Na", "Ma"], meaning: "Los cuatro sonidos del ciclo de la vida: el infinito, la vida, la muerte (la transformación) y el renacimiento. En la Kirtan Kriya se canta tocando el pulgar con cada dedo, uno por sonido." },
  ramadasa: { name: "Ra Ma Da Sa", kicker: "El mantra de la sanación", words: ["Ra", "Ma", "Da", "Sa", "Sa", "Say", "So", "Hung"], meaning: "Sol, Luna, Tierra e infinito; y después «yo soy Tú». Une la energía de la tierra y del cielo para sanar a una misma o enviarla a otra persona." },
  ekongkar: { name: "Ek Ong Kar", kicker: "«Un creador, una creación»", words: ["Ek", "Ong", "Kar", "Sat", "Nam", "Siri", "Wahe", "Guru"], meaning: "«Un solo creador ha creado esta creación; la verdad es su nombre; grande e indescriptible es su sabiduría». Abre la energía del corazón y de la corona." },
  closing: { name: "El cierre", kicker: "Una bendición cantada y tres Sat Nam largos", words: ["Sat", "Nam"], meaning: "La clase termina cantando una bendición tradicional para todas las personas (la canción «Long Time Sun») y tres Sat Nam largos, con la palma de las manos unidas." },
};

export const CLASS_PARTS: Record<string, KText & { min: number }> = {
  tunein: { name: "Sintonizar", kicker: "Adi Mantra · 2 minutos", min: 2, meaning: "Con las manos en oración, se canta tres veces el Adi Mantra para dejar fuera el día y entrar en la práctica." },
  warmup: { name: "Calentar", kicker: "Columna y respiración · 5-10 minutos", min: 8, meaning: "Flexiones de columna, giros y respiración para despertar el cuerpo y preparar la energía." },
  kriya: { name: "La kriya", kicker: "La serie de ejercicios · 20-45 minutos", min: 30, meaning: "Una kriya es una serie concreta de posturas, respiraciones, mudras y mantras con un efecto completo (por ejemplo, para el ombligo, el hígado o el sistema nervioso). Se hace tal como está, sin cambiar el orden." },
  relax: { name: "Relajación", kicker: "Tumbada, de 5 a 11 minutos", min: 8, meaning: "Después de la kriya, tumbada boca arriba, se deja que todo se integre. A veces con un gong. Es parte del ejercicio, no un descanso." },
  meditation: { name: "Meditación", kicker: "De 3 a 31 minutos", min: 11, meaning: "Una meditación con mantra, mudra y respiración. En Kundalini Yoga los tiempos tienen sentido: 3, 11, 31 minutos… y una misma meditación durante 40 días cambia un hábito." },
  closing: { name: "Cerrar", kicker: "Bendición y Sat Nam · 2 minutos", min: 2, meaning: "Se canta la bendición de cierre y tres Sat Nam largos, para sellar la práctica y llevarla al día." },
};

/* ------------------------------------------------------------ los 10 cuerpos */

export const BODIES: Record<string, KText> = {
  "1": { name: "1 · El cuerpo del alma", kicker: "El corazón · la humildad", meaning: "La conexión con lo infinito que llevas dentro. Cuando está fuerte, vives desde el corazón, con creatividad y humildad. Cuando está débil, vives desde la cabeza y te cuesta saber qué quieres de verdad." },
  "2": { name: "2 · La mente negativa", kicker: "La protección · el discernimiento", meaning: "La mente que ve los riesgos y protege. Fuerte, sabes decir no y elegir con quién estar. Débil, te dejas arrastrar o te hundes en lo que puede salir mal." },
  "3": { name: "3 · La mente positiva", kicker: "El optimismo · la voluntad", meaning: "La mente que ve las posibilidades y dice sí. Fuerte, das ánimo y te pones en marcha. Débil, te cuesta ver el lado bueno o actuar." },
  "4": { name: "4 · La mente neutral", kicker: "La intuición · la meditación", meaning: "La mente que escucha a las otras dos y decide en un instante. Fuerte, tienes intuición y calma para servir. Débil, te sientes perdida o te victimizas." },
  "5": { name: "5 · El cuerpo físico", kicker: "El equilibrio · enseñar", meaning: "El templo donde todo ocurre. Fuerte, equilibras lo de dentro y lo de fuera y te sale enseñar lo que sabes. Débil, te cuesta cuidarte o te pierdes en un extremo." },
  "6": { name: "6 · La línea del arco", kicker: "La proyección · el foco", meaning: "Un arco de luz de oreja a oreja, por encima de la frente (en las mujeres, también de pezón a pezón). Fuerte, tienes foco, justicia e intuición. Débil, te dispersas o te dejas impresionar." },
  "7": { name: "7 · El aura", kicker: "La protección · la elevación", meaning: "El campo de luz que te rodea. Fuerte, contienes y elevas a quien está cerca y te sientes segura. Débil, te afecta todo lo de fuera." },
  "8": { name: "8 · El cuerpo pránico", kicker: "La energía · sin miedo", meaning: "La energía vital que entra con la respiración. Fuerte, tienes vitalidad y vives sin miedo. Débil, te cansas o buscas energía fuera (café, prisas, drama)." },
  "9": { name: "9 · El cuerpo sutil", kicker: "La calma · la maestría", meaning: "La capacidad de ver lo sutil y entender lo que no se dice. Fuerte, tienes calma y aprendes rápido. Débil, eres impaciente o ingenua." },
  "10": { name: "10 · El cuerpo radiante", kicker: "El coraje · el brillo", meaning: "El brillo que hace que se te note al entrar. Fuerte, tienes coraje, nobleza y carisma. Débil, te escondes o te da miedo destacar." },
  "11": { name: "11 · El once", kicker: "La maestría de los diez", meaning: "No es un cuerpo más: es tenerlos todos en equilibrio, la encarnación del sonido infinito. Quien lo tiene en su numerología vive con una intensidad especial: su reto es estar en paz consigo misma." },
};

export const POSITIONS: Record<string, KText> = {
  soul: { name: "Tu número del alma", kicker: "El día en que naciste", meaning: "Lo que tu alma viene a vivir: lo que te sale de forma natural cuando estás bien contigo." },
  karma: { name: "Tu número del karma", kicker: "El mes en que naciste", meaning: "Lo que te toca trabajar en esta vida: tu reto, lo que la vida te pone delante una y otra vez para que lo aprendas." },
  gift: { name: "Tu número del don", kicker: "Las dos últimas cifras del año", meaning: "El regalo que traes: lo que te sale sin esfuerzo y puedes ofrecer a los demás." },
  destiny: { name: "Tu número del destino", kicker: "Las cuatro cifras del año, sumadas", meaning: "Hacia dónde te lleva la vida cuando la escuchas: lo que viniste a desplegar." },
  path: { name: "Tu número del camino", kicker: "Todas las cifras de tu fecha, sumadas", meaning: "El camino de tu vida: lo que integra todo lo anterior y te guía hacia la madurez." },
};

/** Suma las cifras hasta que quede del 1 al 11 (el 10 y el 11 se guardan; el 0 cuenta como 10). */
function reduce(n: number) {
  let s = n;
  while (s > 11) s = String(s).split("").reduce((a, d) => a + Number(d), 0);
  return s === 0 ? 10 : s;
}

/** Los cinco números de los 10 cuerpos según la fecha («AAAA-MM-DD»). */
export function tenBodies(date: string | null | undefined): Record<keyof typeof POSITIONS, number> | null {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const digits = (s: string) => s.split("").reduce((a, x) => a + Number(x), 0);
  return {
    soul: reduce(Number(d)),
    karma: reduce(Number(mo)),
    gift: reduce(Number(y.slice(2))),
    destiny: reduce(digits(y)),
    path: reduce(digits(y + mo + d)),
  };
}
