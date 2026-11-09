/**
 * Lo que dice cada pieza de las capas nuevas del modelo por partes (components/course/layers/*): los
 * planetas, tipos, autoridades y perfiles de Human Design, las líneas de las Gene Keys, la Luna natal en
 * cada signo y en cada casa, los nodos lunares y las tres cualidades. Textos generales y cortos: debajo,
 * la dueña añade el suyo en cada lección (`notes`).
 */
import type { HdBody } from "@/lib/human-design-names";

/** Qué aporta cada planeta en una carta de Human Design (los dos lados lo leen igual). */
export const HD_PLANET_TEXT: Record<HdBody, { role: string; meaning: string }> = {
  sun: { role: "La fuerza vital", meaning: "Cerca del 70 % de tu energía. Es lo que vienes a expresar, tu luz: la puerta del Sol tiñe toda la carta." },
  earth: { role: "El arraigo", meaning: "Lo que te pone los pies en el suelo y te da equilibrio. Sol y Tierra juntos, en los dos lados, forman tu cruz de encarnación." },
  northNode: { role: "Hacia dónde vas", meaning: "El entorno y la dirección de la segunda mitad de la vida (desde la oposición de Urano, hacia los 38-40 años). El paisaje hacia el que te mueves." },
  southNode: { role: "De dónde vienes", meaning: "El entorno y los temas de la primera mitad de la vida: los lugares y las personas que te formaron." },
  moon: { role: "La fuerza motriz", meaning: "Lo que te empuja a moverte. En el diseño, además, la Luna es la Atracción de las Gene Keys: lo que te une a otros." },
  mercury: { role: "La comunicación", meaning: "Lo que necesitas pensar y decir: el mensaje que tu vida quiere transmitir." },
  venus: { role: "Los valores", meaning: "Tu moral y tu sentido de lo justo: lo que consideras bueno y cómo te relacionas desde ahí." },
  mars: { role: "La inmadurez", meaning: "Donde actúas por impulso hasta que maduras, normalmente hacia el retorno de Saturno (unos 29 años). Ahí hay mucha energía por pulir." },
  jupiter: { role: "La ley", meaning: "Tus reglas y tu protección: si vives según esta puerta, la vida se expande y te sostiene." },
  saturn: { role: "El juez", meaning: "La disciplina y la prueba: lo que ocurre cuando no te escuchas. Es exigente, pero te enseña dónde está tu solidez." },
  uranus: { role: "Lo inusual", meaning: "Donde eres distinta y rompes el molde. Una energía generacional que en ti toma un color propio." },
  neptune: { role: "El velo", meaning: "Donde la ilusión y lo espiritual se mezclan: lo que se revela poco a poco, nunca del todo." },
  pluto: { role: "La verdad", meaning: "Lo que se transforma de raíz. La puerta de Plutón es tu verdad más honda, la que regenera." },
};

export const HD_SIDE_TEXT = {
  personality: "Personalidad (en negro): calculada en el instante de nacer. Es lo consciente, lo que reconoces como tuyo y con lo que te identificas.",
  design: "Diseño (en rojo): calculado unos 88 días antes de nacer, cuando el Sol estaba 88° atrás. Es lo inconsciente, el cuerpo: lo que otros ven en ti antes que tú.",
} as const;

export type HdTypeKey = "generator" | "mg" | "manifestor" | "projector" | "reflector";

export const HD_TYPES: Record<HdTypeKey, { name: string; share: string; strategy: string; signature: string; notSelf: string; aura: string; meaning: string }> = {
  generator: {
    name: "Generador",
    share: "≈ 37 % de las personas",
    strategy: "Esperar para responder",
    signature: "Satisfacción",
    notSelf: "Frustración",
    aura: "Abierta y envolvente",
    meaning: "El Sacro definido es un motor que se recarga haciendo lo que ama. No viene a iniciar desde la mente: la vida le trae preguntas y señales, y su vientre responde con un «ajá» o un «ah-ah». Cuando trabaja en lo que le enciende, se va a dormir agotada y satisfecha.",
  },
  mg: {
    name: "Generador manifestante",
    share: "≈ 33 % de las personas",
    strategy: "Responder y después informar",
    signature: "Satisfacción y paz",
    notSelf: "Frustración y enfado",
    aura: "Abierta y envolvente",
    meaning: "Sacro definido y un motor conectado a la Garganta: responde como un Generador y se mueve rápido como un Manifestador. Puede saltarse pasos; su aprendizaje es volver atrás a por lo que dejó, e informar antes de lanzarse.",
  },
  manifestor: {
    name: "Manifestador",
    share: "≈ 9 % de las personas",
    strategy: "Informar antes de actuar",
    signature: "Paz",
    notSelf: "Ira",
    aura: "Cerrada y repelente",
    meaning: "Un motor llega a la Garganta sin el Sacro definido: puede iniciar sin esperar a nadie. Su energía va a ráfagas. Informar no es pedir permiso: es quitar resistencia al impacto que causa en los demás.",
  },
  projector: {
    name: "Proyector",
    share: "≈ 20 % de las personas",
    strategy: "Esperar la invitación",
    signature: "Éxito",
    notSelf: "Amargura",
    aura: "Focalizada y penetrante",
    meaning: "No tiene un motor propio constante: su don es ver a los demás en profundidad y guiar su energía. Brilla cuando la reconocen e invitan, sobre todo en lo grande (trabajo, pareja, casa). Descansar es parte de su estrategia.",
  },
  reflector: {
    name: "Reflector",
    share: "≈ 1 % de las personas",
    strategy: "Esperar un ciclo lunar (28 días)",
    signature: "Sorpresa",
    notSelf: "Decepción",
    aura: "Muestreadora y resistente",
    meaning: "Todos los centros abiertos: es un espejo de su entorno, el termómetro de la comunidad. Su ritmo es el de la Luna, que en 28 días recorre todas sus puertas. Elegir bien el lugar y las personas lo es todo.",
  },
};

/** De la lectura de la carta (readChart) a su clave. */
export const HD_TYPE_KEY: Record<string, HdTypeKey> = {
  Generador: "generator",
  "Generador manifestante": "mg",
  Manifestador: "manifestor",
  Proyector: "projector",
  Reflector: "reflector",
};

export type HdAuthorityKey = "solar" | "sacral" | "spleen" | "heart" | "g" | "mental" | "lunar";

export const HD_AUTHORITIES: Record<HdAuthorityKey, { name: string; how: string; meaning: string }> = {
  solar: { name: "Emocional", how: "Esperar a la claridad", meaning: "Con el Plexo Solar definido (cerca de la mitad de las personas), no hay verdad en el momento: la emoción va en ola, de la esperanza al dolor. La decisión correcta se ve cuando la ola se calma. «Lo consulto con la almohada» es su método." },
  sacral: { name: "Sacral", how: "La respuesta del vientre", meaning: "Un sonido antes que una frase: «ajá» (sí) o «ah-ah» (no). Funciona en el ahora y responde a preguntas de sí o no. Es la voz del cuerpo, no de la mente." },
  spleen: { name: "Esplénica", how: "El instinto del instante", meaning: "El Bazo habla una sola vez, bajito y en el momento: una certeza, un escalofrío, un «aquí no». Si esperas a pensarlo, ya se ha ido. Es la autoridad de la supervivencia y la salud." },
  heart: { name: "Del corazón (ego)", how: "Lo que de verdad quieres", meaning: "La pregunta es «¿qué quiero yo?» y «¿puedo comprometerme con esto?». Su verdad está en su fuerza de voluntad: si no le apetece de verdad, no le da la energía." },
  g: { name: "Autoproyectada", how: "Escucharte al hablar", meaning: "Con el centro G conectado a la Garganta, la verdad aparece al oírse hablar. No busca consejo: busca un oído. La pregunta es si algo la lleva en su dirección y le hace sentirse ella misma." },
  mental: { name: "Mental o del entorno", how: "Hablarlo en el lugar correcto", meaning: "Proyectores sin autoridad interior (solo la Cabeza, Ajna o la Garganta definidas). La mente no decide: habla con personas de confianza como caja de resonancia y siente si el entorno es el adecuado." },
  lunar: { name: "Lunar", how: "Un ciclo de 28 días", meaning: "Solo para Reflectores: con todos los centros abiertos, la claridad llega al vivir una decisión durante un mes lunar completo, hablándola con varias personas en días distintos." },
};

export const HD_AUTHORITY_KEY: Record<string, HdAuthorityKey> = {
  "Emocional — plexo solar": "solar",
  Sacral: "sacral",
  Esplénica: "spleen",
  "Ego / corazón": "heart",
  Autoproyectada: "g",
  "Mental — entorno": "mental",
  "Lunar — reflector": "lunar",
};

/** Los 12 perfiles: línea del Sol consciente / línea del Sol inconsciente. */
export const HD_PROFILES: Record<string, { name: string; meaning: string }> = {
  "1/3": { name: "Investigador / Mártir", meaning: "Busca bases firmes y luego las pone a prueba en la vida. Estudia hasta sentirse segura y aprende chocando: su sabiduría es sólida porque está comprobada." },
  "1/4": { name: "Investigador / Oportunista", meaning: "Va al fondo de las cosas y lo comparte con su red. Su influencia nace del conocimiento y de las personas que ya confían en ella." },
  "2/4": { name: "Ermitaño / Oportunista", meaning: "Un talento natural que necesita retiro. No sale a buscar: la llaman desde su red de amistades para que muestre lo que sabe hacer." },
  "2/5": { name: "Ermitaño / Hereje", meaning: "Los demás ven en ella dones que ella no ve, y proyectan expectativas. Necesita su espacio y cuidar su reputación: solo responde a la llamada correcta." },
  "3/5": { name: "Mártir / Hereje", meaning: "Aprende probando y equivocándose, y viene a ofrecer soluciones prácticas a otros. Sus «fracasos» son exactamente lo que la hace útil." },
  "3/6": { name: "Mártir / Modelo a seguir", meaning: "Hasta los 30, mucha prueba y error; después observa desde arriba y, pasados los 50, se vuelve un ejemplo sabio de lo vivido." },
  "4/6": { name: "Oportunista / Modelo a seguir", meaning: "Su red de personas es su camino. Con los años y las etapas se vuelve una referencia de confianza para su gente." },
  "4/1": { name: "Oportunista / Investigador", meaning: "El único perfil de yuxtaposición: un destino fijo, que no se desvía. Firme sobre bases bien investigadas y fiel a su red." },
  "5/1": { name: "Hereje / Investigador", meaning: "Proyectan en ella a la salvadora. Si responde con soluciones bien investigadas, su fama crece; si no, cae la proyección. Su base es el estudio." },
  "5/2": { name: "Hereje / Ermitaño", meaning: "La llaman para resolver crisis, pero necesita retiro para que sus dones maduren. Elegir bien a qué llamada responde la protege." },
  "6/2": { name: "Modelo a seguir / Ermitaño", meaning: "Vive tres etapas y tiene un talento natural. Su autoridad llega con la madurez: se vuelve ejemplo auténtico sin buscarlo." },
  "6/3": { name: "Modelo a seguir / Mártir", meaning: "Tres etapas y mucha experimentación: incluso de mayor sigue probando. Su sabiduría es la de quien lo ha vivido todo en su propia piel." },
};

export const profileAngle = (key: string) => (key === "4/1" ? "Ángulo de yuxtaposición · destino fijo" : Number(key[0]) >= 5 ? "Ángulo izquierdo · destino transpersonal" : "Ángulo derecho · destino personal");

/** Las seis líneas, como las leen las Gene Keys: cómo vives una llave en una esfera. */
export const GK_LINES: { name: string; meaning: string }[] = [
  { name: "La base", meaning: "Necesitas raíces: estudiar, entender, sentir suelo bajo los pies. En esa esfera tu don aparece cuando te das tiempo para profundizar." },
  { name: "La espontaneidad", meaning: "Un talento natural que fluye cuando no lo miras. Necesitas espacio a solas; en esa esfera, lo mejor llega cuando te relajas." },
  { name: "La experimentación", meaning: "Aprendes probando. En esa esfera tropiezas, cambias, te adaptas: y cada choque te acerca al don." },
  { name: "La amistad", meaning: "Tu don se abre a través de los vínculos. En esa esfera importan la ternura, la confianza y tu red de personas." },
  { name: "La universalidad", meaning: "Lo que vives en esa esfera sirve a otros: soluciones prácticas, ayuda, liderazgo. Cuida las proyecciones." },
  { name: "La sabiduría", meaning: "Una mirada desde arriba. En esa esfera maduras despacio y terminas siendo ejemplo, con el corazón abierto." },
];

/** La Luna natal en cada signo (0 = Aries): lo que necesitas para sentirte a salvo. */
export const MOON_NATAL_SIGN: string[] = [
  "Sientes rápido y con fuego. Necesitas acción, independencia y poder decir lo que te enfada sin culpa. Te calma moverte, empezar algo, salir a correr.",
  "La Luna está exaltada en Tauro: emoción estable y sensual. Necesitas calma, cuerpo, rutina y belleza. Te calma lo que se toca: comida rica, la naturaleza, un abrazo largo.",
  "Sientes pensando. Necesitas hablar de lo que te pasa, variedad y curiosidad. Te calma poner palabras: escribir, llamar a alguien, leer.",
  "La Luna en su casa: emoción honda, memoria larga y necesidad de nido. Te calma cuidar y sentirte cuidada, la familia elegida, tu rincón.",
  "Necesitas sentirte vista y querida tal como eres. Te calma crear, jugar, celebrar y que reconozcan tu corazón generoso.",
  "Sientes a través del cuerpo y los detalles. Necesitas orden y sentirte útil. Te calma una rutina amable, ordenar, cuidar la salud.",
  "Necesitas armonía y compañía; el conflicto te desajusta. Te calma la belleza, el diálogo justo y sentir que hay equilibrio.",
  "La Luna en caída: emoción intensa y total. Necesitas confianza profunda y verdad. Te calma la intimidad real y transformar lo que duele en lugar de esconderlo.",
  "Necesitas libertad, horizonte y sentido. Te calma aprender, viajar, reírte y creer en algo más grande que tú.",
  "La Luna en exilio: contienes lo que sientes y te haces fuerte pronto. Necesitas estructura y logros. Te calma sentirte capaz… y darte permiso para descansar.",
  "Sientes con cierta distancia y necesitas espacio propio. Te calma la amistad, el grupo afín y la libertad de ser rara.",
  "Una esponja emocional: compasión e intuición enormes. Necesitas retiro y belleza. Te calma el agua, la música, el silencio y crear.",
];

/** La Luna natal en cada casa: dónde buscas refugio emocional. */
export const MOON_NATAL_HOUSE: string[] = [
  "Tus emociones se ven en la cara. Necesitas sentirte a salvo siendo tú; tu ánimo cambia tu forma de estar en el mundo.",
  "La seguridad emocional va de la mano de la material: necesitas lo propio, lo tangible y saber que tienes con qué.",
  "Procesas hablando, escribiendo y aprendiendo. Los hermanos, el barrio y las conversaciones cercanas te sostienen.",
  "La Luna en su casa natural: el hogar y la familia son tu centro. Necesitas raíces y un lugar al que volver.",
  "Necesitas crear, jugar y enamorarte. La emoción sale por lo creativo, por los hijos, por lo que te da alegría.",
  "Sientes a través del cuerpo y la rutina: tu bienestar emocional depende de tus hábitos y de sentirte útil.",
  "Te conoces en el espejo del otro. Necesitas pareja y vínculos cercanos; buscas en ellos cuidado y hogar.",
  "Emoción profunda, intimidad y crisis que transforman. Necesitas confianza total y permiso para ir a lo hondo.",
  "Tu hogar emocional está en el horizonte: viajes, estudio, filosofía. Necesitas sentido para estar en paz.",
  "Tus emociones se ven en público y tu vocación tiene que ver con cuidar. La figura materna marca tu camino.",
  "Te sientes en casa en tu tribu: amistades, grupos, causas. Necesitas pertenecer sin perderte.",
  "Un mundo interior rico y escondido. Necesitas retiro, sueños y espiritualidad; a veces sientes lo que otros callan.",
];

/** El Nodo Norte en cada signo (el Sur, enfrente): de dónde vienes y hacia dónde creces. */
/** El Nodo Sur en cada signo: el talento que ya traes y la zona cómoda que conviene no repetir. */
export const SOUTH_NODE_SIGN: string[] = [
  "Traes valentía e iniciativa: sabes arrancar sola. La trampa es ir siempre por tu cuenta y no dejar sitio al otro.",
  "Traes estabilidad y sentido práctico: sabes sostener y disfrutar. La trampa es aferrarte a lo seguro y a lo que ya tienes.",
  "Traes curiosidad y palabra: sabes informarte y conectar. La trampa es quedarte en los datos y no buscar el sentido.",
  "Traes cuidado y sensibilidad: sabes proteger y crear hogar. La trampa es refugiarte en lo conocido y no asumir tu lugar fuera.",
  "Traes brillo y creatividad: sabes expresarte y ser vista. La trampa es necesitar el aplauso y olvidar al grupo.",
  "Traes orden y servicio: sabes mejorar lo concreto. La trampa es el perfeccionismo y no soltar el control.",
  "Traes diplomacia y sentido del otro: sabes acompañar y armonizar. La trampa es complacer y olvidarte de ti.",
  "Traes intensidad y profundidad: sabes atravesar crisis. La trampa es vivir en el drama y no permitirte la calma.",
  "Traes fe y visión: sabes dar sentido a las cosas. La trampa es creer que siempre tienes razón y dejar de escuchar.",
  "Traes responsabilidad y disciplina: sabes construir y llegar a la meta. La trampa es el control y no permitirte sentir.",
  "Traes originalidad y sentido del grupo: sabes ver el futuro. La trampa es esconder tu corazón detrás de las ideas.",
  "Traes compasión e intuición: sabes sentir lo invisible. La trampa es evadirte y no bajar a lo concreto.",
];

export const NORTH_NODE_SIGN: string[] = [
  "Del complacer (Sur en Libra) a atreverte: tu camino es decidir por ti, iniciar, ser valiente aunque decepciones a alguien.",
  "De la crisis (Sur en Escorpio) a la calma: construir tu valor propio, disfrutar de lo sencillo, crear estabilidad.",
  "De tener razón (Sur en Sagitario) a escuchar: curiosidad, preguntas, conversar con lo que tienes cerca.",
  "Del control (Sur en Capricornio) al cuidado: permitirte sentir, crear hogar, pedir apoyo sin vergüenza.",
  "Del grupo (Sur en Acuario) a tu corazón: brillar, crear y expresarte en primera persona.",
  "De la evasión (Sur en Piscis) a la presencia: orden, servicio concreto, cuidar del cuerpo y los días.",
  "De ir sola (Sur en Aries) a cooperar: acuerdos, diplomacia y dejar que el otro también te enseñe.",
  "De acumular (Sur en Tauro) a transformar: soltar apegos, compartir de verdad, atreverte a lo hondo.",
  "Del dato (Sur en Géminis) al sentido: confiar en tu intuición y buscar tu propia verdad.",
  "Del refugio (Sur en Cáncer) a la responsabilidad: madurar, ponerte metas, asumir tu autoridad.",
  "Del ego (Sur en Leo) al nosotros: causas colectivas, amistad, tu originalidad al servicio del grupo.",
  "De la perfección (Sur en Virgo) a la entrega: fe, compasión, dejar que la vida fluya sin controlarlo todo.",
];

export const MODALITY_TEXT: Record<"cardinal" | "fijo" | "mutable", { name: string; verb: string; meaning: string }> = {
  cardinal: { name: "Cardinal", verb: "Empezar", meaning: "Aries, Cáncer, Libra y Capricornio abren cada estación. Iniciativa, liderazgo, impulso: la energía que arranca. Su reto es sostener lo que empieza." },
  fijo: { name: "Fija", verb: "Sostener", meaning: "Tauro, Leo, Escorpio y Acuario están en el centro de cada estación. Constancia, lealtad y fuerza: la energía que mantiene. Su reto es no aferrarse." },
  mutable: { name: "Mutable", verb: "Adaptarse", meaning: "Géminis, Virgo, Sagitario y Piscis cierran cada estación y preparan la siguiente. Flexibilidad y cambio: la energía que transforma. Su reto es no dispersarse." },
};
