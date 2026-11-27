/**
 * El futhark antiguo: las 24 runas en su orden tradicional (tres «aettir» de ocho), con el glifo del
 * bloque rúnico de Unicode, su nombre protogermánico, el sonido y una lectura breve en castellano.
 *
 * Las lecturas son nuestras: cortas, cálidas y sin fatalismo. Una runa es una palabra de un idioma
 * antiguo, no un veredicto. Las que tienen forma simétrica (Gebo, Hagalaz, Naudiz, Isa, Jera, Eihwaz,
 * Sowilo, Ingwaz y Dagaz) no se pueden leer «invertidas» (merkstave): `reversed` es null.
 */

export type Rune = {
  id: string;
  /** Carácter del bloque rúnico (U+16A0–U+16F8). Se pinta en presentación de texto (ver RUNE_TEXT). */
  glyph: string;
  name: string;
  /** Sonido que representa. */
  sound: string;
  /** Lo que nombra la runa y su idea principal, en pocas palabras. */
  meaning: string;
  /** 0 = aett de Freyr, 1 = de Hagal, 2 = de Tyr. */
  aett: 0 | 1 | 2;
  upright: string;
  /** Lectura merkstave (invertida); null en las runas simétricas, que no se invierten. */
  reversed: string | null;
};

export const AETT_NAME = ["Aett de Freyr", "Aett de Hagal", "Aett de Tyr"] as const;

/** Selector de variación «texto» (U+FE0E): que ningún sistema intente pintarlo como emoji. */
export const TEXT_VS = "︎";

export const RUNES: Rune[] = [
  {
    id: "fehu", glyph: "ᚠ", name: "Fehu", sound: "f", meaning: "Ganado · la riqueza que se mueve", aett: 0,
    upright: "Lo que tienes —tiempo, recursos, energía— pide circular. Mira la abundancia que ya está en tus manos y cómo la cuidas.",
    reversed: "Algo se escapa o se estanca. No es una pérdida definitiva: es una invitación a revisar dónde pones tu energía y qué das por sentado.",
  },
  {
    id: "uruz", glyph: "ᚢ", name: "Uruz", sound: "u", meaning: "Uro · fuerza vital", aett: 0,
    upright: "Una fuerza sana y un poco salvaje te sostiene. Buen momento para cuidar el cuerpo y confiar en tu resistencia.",
    reversed: "La energía anda baja o dispersa. Descansar también es fuerza: no empujes lo que pide pausa.",
  },
  {
    id: "thurisaz", glyph: "ᚦ", name: "Thurisaz", sound: "th", meaning: "Espina · umbral", aett: 0,
    upright: "La espina protege a la rosa. Hay un umbral delante: detente, mira bien y cruza cuando estés lista.",
    reversed: "Quizá estés reaccionando a la defensiva. Antes de cortar por lo sano, pregúntate qué intentas proteger.",
  },
  {
    id: "ansuz", glyph: "ᚨ", name: "Ansuz", sound: "a", meaning: "Aliento · la palabra", aett: 0,
    upright: "Llega un mensaje: una conversación, una señal, una intuición. Escucha con atención y di lo que es verdad para ti.",
    reversed: "Hay ruido o malentendidos. Antes de responder, distingue lo que has oído de lo que has supuesto.",
  },
  {
    id: "raidho", glyph: "ᚱ", name: "Raidho", sound: "r", meaning: "Viaje · el ritmo justo", aett: 0,
    upright: "El camino se ordena. Viaje, decisión o cambio de ritmo: avanza al paso que te deja seguir escuchándote.",
    reversed: "Los planes se retrasan o se tuercen. Un desvío también es camino: revisa el mapa sin culparte.",
  },
  {
    id: "kenaz", glyph: "ᚲ", name: "Kenaz", sound: "k", meaning: "Antorcha · claridad", aett: 0,
    upright: "Se enciende una luz: comprensión, creatividad, un oficio que se aprende. Lo que ahora ves puedes llevarlo a tus manos.",
    reversed: "La luz se apaga un rato. Cuando falta claridad basta una vela: un paso pequeño y honesto.",
  },
  {
    id: "gebo", glyph: "ᚷ", name: "Gebo", sound: "g", meaning: "Regalo · intercambio", aett: 0,
    upright: "El don que se da y se recibe. Un vínculo equilibrado, un acuerdo, un gesto. Recibir también es un arte.",
    reversed: null,
  },
  {
    id: "wunjo", glyph: "ᚹ", name: "Wunjo", sound: "w", meaning: "Alegría · pertenencia", aett: 0,
    upright: "Alegría sencilla, sentirse en casa entre los tuyos. Permítete disfrutar sin pedir permiso.",
    reversed: "Algo apaga tu alegría. Nómbralo sin dramatizar: a veces reconocer lo que pesa ya lo aligera.",
  },
  {
    id: "hagalaz", glyph: "ᚺ", name: "Hagalaz", sound: "h", meaning: "Granizo · lo que irrumpe", aett: 1,
    upright: "Llega lo que no depende de ti, como el granizo. Rompe, sí, pero se derrite en agua que riega. ¿Qué puede crecer después?",
    reversed: null,
  },
  {
    id: "naudiz", glyph: "ᚾ", name: "Naudiz", sound: "n", meaning: "Necesidad · el fuego que se frota", aett: 1,
    upright: "La necesidad enseña. Ante un límite o una carencia, ¿qué recurso tuyo estás aprendiendo a encender? Paciencia: es fuego que nace frotando.",
    reversed: null,
  },
  {
    id: "isa", glyph: "ᛁ", name: "Isa", sound: "i", meaning: "Hielo · quietud", aett: 1,
    upright: "Todo parece detenido. El hielo también protege lo que duerme debajo. Quédate quieta un poco: el agua se aclara cuando se calma.",
    reversed: null,
  },
  {
    id: "jera", glyph: "ᛃ", name: "Jera", sound: "j", meaning: "Año · la cosecha", aett: 1,
    upright: "Lo sembrado llega a su tiempo. No puedes apurar las estaciones, pero sí cuidar la tierra. Una cosecha se acerca.",
    reversed: null,
  },
  {
    id: "eihwaz", glyph: "ᛇ", name: "Eihwaz", sound: "ei", meaning: "Tejo · raíz y copa", aett: 1,
    upright: "El tejo vive siglos y une la raíz con la copa. Lo que atraviesas te hace flexible y fuerte a la vez. Sostente.",
    reversed: null,
  },
  {
    id: "perthro", glyph: "ᛈ", name: "Perthro", sound: "p", meaning: "Copa de suertes · misterio", aett: 1,
    upright: "Lo que aún no se ve. Está bien no saberlo todo: deja un hueco a lo inesperado.",
    reversed: "Algo oculto incomoda. No hace falta forzar la respuesta: a veces un secreto es solo una pregunta que aún madura.",
  },
  {
    id: "algiz", glyph: "ᛉ", name: "Algiz", sound: "z", meaning: "Alce · protección", aett: 1,
    upright: "Estás protegida, y tu intuición hace de antena. Confía en lo que sientes cuando algo no encaja.",
    reversed: "Quizá te expones más de lo que necesitas. Cuida tus límites: decir que no también es cuidarte.",
  },
  {
    id: "sowilo", glyph: "ᛊ", name: "Sowilo", sound: "s", meaning: "Sol · vitalidad", aett: 1,
    upright: "La luz del Sol: vitalidad, dirección, logro. Lo que buscas tiene brillo propio; déjate ver.",
    reversed: null,
  },
  {
    id: "tiwaz", glyph: "ᛏ", name: "Tiwaz", sound: "t", meaning: "Tyr · valor y justicia", aett: 2,
    upright: "Valor y rectitud. Actúa según lo que consideras justo, aunque te cueste algo.",
    reversed: "La confianza flaquea o la energía se dispersa. No tienes que ganar cada batalla: elige la que de verdad es tuya.",
  },
  {
    id: "berkano", glyph: "ᛒ", name: "Berkano", sound: "b", meaning: "Abedul · nacimiento", aett: 2,
    upright: "Algo nace o renace: un proyecto, un vínculo, una versión de ti. Cuídalo como se cuida un brote.",
    reversed: "El crecimiento se frena. Quizá pide más cuidado y menos exigencia: vuelve a lo que te nutre.",
  },
  {
    id: "ehwaz", glyph: "ᛖ", name: "Ehwaz", sound: "e", meaning: "Caballo · avanzar en compañía", aett: 2,
    upright: "Confianza mutua, un cambio que se hace mejor a dos. Deja que te acompañen y acompaña.",
    reversed: "Falta sintonía o cuesta moverse. Antes de tirar de las riendas, escucha el ritmo del otro y el tuyo.",
  },
  {
    id: "mannaz", glyph: "ᛗ", name: "Mannaz", sound: "m", meaning: "Ser humano · tú entre los demás", aett: 2,
    upright: "Mírate con honestidad y con ternura: eres parte de algo más grande que tú.",
    reversed: "Quizá te sientes sola o te juzgas con dureza. Busca un espejo amable: una persona, un rato de silencio.",
  },
  {
    id: "laguz", glyph: "ᛚ", name: "Laguz", sound: "l", meaning: "Agua · fluir", aett: 2,
    upright: "Agua, intuición, sueños. Déjate llevar por la corriente sin soltar el remo.",
    reversed: "Las emociones se agitan o desbordan. Vuelve a la orilla un momento y respira antes de decidir.",
  },
  {
    id: "ingwaz", glyph: "ᛜ", name: "Ingwaz", sound: "ng", meaning: "Semilla · gestación", aett: 2,
    upright: "Algo se gesta en silencio. Un ciclo se cierra para que otro empiece: deja que la semilla haga su trabajo.",
    reversed: null,
  },
  {
    id: "dagaz", glyph: "ᛞ", name: "Dagaz", sound: "d", meaning: "Día · el amanecer", aett: 2,
    upright: "Amanece. Un cambio de mirada, un antes y un después. Lo que parecía oscuro empieza a verse claro.",
    reversed: null,
  },
  {
    id: "othala", glyph: "ᛟ", name: "Othala", sound: "o", meaning: "Herencia · el hogar", aett: 2,
    upright: "Lo heredado: casa, raíces, valores. Elige qué guardas y qué dejas a quien viene detrás.",
    reversed: "Viejas lealtades pesan. Puedes honrar tu origen sin cargar con lo que no es tuyo.",
  },
];

export type RuneSpreadId = "one" | "three" | "five";

/** Tiradas: cada posición con su nombre y lo que pregunta. En la cruz, `area` coloca la piedra en una rejilla de 3 × 3. */
export const RUNE_SPREADS: Record<RuneSpreadId, { label: string; positions: Array<{ name: string; hint: string; area?: string }> }> = {
  one: { label: "Una runa", positions: [{ name: "Consejo del día", hint: "Lo que conviene tener presente hoy." }] },
  three: {
    label: "Tres runas",
    positions: [
      { name: "Pasado", hint: "Lo que te ha traído hasta aquí." },
      { name: "Presente", hint: "Lo que se mueve ahora." },
      { name: "Camino", hint: "Hacia dónde puede llevarte, si sigues así." },
    ],
  },
  five: {
    label: "Cinco runas",
    positions: [
      { name: "El centro", hint: "El corazón del asunto.", area: "2 / 2" },
      { name: "Lo que queda atrás", hint: "Lo que ya pasó y aún resuena.", area: "2 / 1" },
      { name: "Lo que se acerca", hint: "Lo que empieza a asomar.", area: "2 / 3" },
      { name: "Lo que te ayuda", hint: "Tu apoyo, por dentro o por fuera.", area: "1 / 2" },
      { name: "Lo que pide cuidado", hint: "Donde conviene ir despacio.", area: "3 / 2" },
    ],
  },
};
