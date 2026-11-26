/**
 * Datos de demostración. Solo en local: se niega a ejecutarse en producción, contra una base de
 * datos que no esté en esta máquina o contra una que tenga cuentas que no creó él mismo
 * (ver prisma/seed-guard.ts). Para la base de datos real: `npm run deploy` (prisma/bootstrap.ts).
 *   npm run db:reset   → aplica las migraciones pendientes y ejecuta este seed
 *   npm run db:seed    → solo el seed (vacía las tablas antes de sembrar)
 *
 * Cuentas (contraseña para todas: demo1234):
 *   ana@cirella.app    creadora · plan Pro     · /ana (también la dueña del modo personal: OWNER_USERNAME=ana,
 *                      con un mini-curso gratis con email, una sesión que se reserva en Calendly,
 *                      publicaciones, códigos de descuento, bloques de imagen, galería y vídeo en su
 *                      portada y las páginas extra «Sobre mí» (publicada) y «Preguntas frecuentes» (borrador))
 *   maria@cirella.app  creadora · plan Creator · /maria
 *   sofia@cirella.app  creadora · plan Free    · /sofia
 *   laura@example.com  clienta de Cirella (curso, PDF y sesión)
 *   admin@cirella.app  superadmin
 *
 * Las fechas son relativas al día en que se siembra (prisma/demo-dates.ts): las reservas siempre
 * están por venir y las compras, en los días anteriores. Los importes de las ventas salen de las
 * mismas reglas que el checkout (comisión sobre el precio; prisma/demo-sales.ts), como una venta real.
 */
import "../scripts/load-env";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureBaseData } from "./base-data";
import sharp from "sharp";
import { makeM4a, makePdf, makeVideo, makeWav } from "./demo-files";
import { DEMO_MARKER_KEY, assertSafeToSeed } from "./seed-guard";
import { appUrl, storageDir } from "../lib/env";
import { storeEmailImage, storeImage, storeProcessedImage, storeVideoCover } from "../lib/images";
import { campaignEmail } from "../lib/email/newsletter-templates";
import { unsubscribeHeaders, unsubscribeUrl } from "../lib/newsletter-tokens";
import { newsletterConsentText } from "../lib/newsletter-rules";
import { formatLegalAddress } from "../lib/legal";
import { randomBytes } from "node:crypto";
import { pageVideoUrl, type ContentBlock, type ModelKind, type PageImage } from "../lib/page-blocks";
import { ORACLE_CARDS, ORACLE_NAME } from "../components/models/data/oracle";
import { type SitePageContent } from "../lib/site-pages";
import { mimeFromExt, privateKey, storage } from "../lib/storage";
import { legacyLessonColumns } from "../lib/lesson-parts";
import { parseMediaInfo } from "../lib/media-probe";
import { PLATFORM_TERMS_VERSION } from "../lib/legal";
import { acceptedConsentFields } from "../lib/checkout-consents";
import { defaultSections, READINGS_DEFAULTS, type PageConfig } from "../lib/page-config";
import { nextMoonDates } from "../lib/moon-dates";
import { prisma as appPrisma } from "../lib/db";
import { effectiveCommissionBps } from "../lib/plans";
import { chargeKey } from "../lib/reliability";
import { addDaysToKey, dateKeyInTz, formatInTz, formatSessionDate, labelToMinutes, weekdayOfKey, zonedTimeToUtc } from "../lib/tz";
import { addMonthsToKey } from "../lib/access-end";
import { moonPhasesBetween } from "../lib/astro-calendar";
import { ANA_AVAILABILITY, DEMO_TZ, demoPurchaseDaysAgo, demoSchedule } from "./demo-dates";
import { demoSaleFields } from "./demo-sales";
import { seedDemoStudent } from "./demo-student";
import { seedMarsLesson } from "./demo-lesson-mars";
import { seedSystemLessons } from "./demo-lessons-systems";
import { seedDeepLessons } from "./demo-lessons-deep";
import { seedDemoMembership } from "./demo-membership";
import { seedHomeTexts } from "./demo-home-texts";
import { grantFullAccess } from "./demo-full-access";

const prisma = new PrismaClient();
const STORAGE = path.resolve(process.cwd(), storageDir());
const NOW = new Date();
const DAY = 86400_000;
const TZ = DEMO_TZ;
const TODAY = dateKeyInTz(NOW, TZ);
/** Hace `d` días a la hora `h:m` de Madrid (con su horario de verano o de invierno). */
/** La sala de Zoom personal de Cirella (la de todas sus sesiones). */
const ANA_ZOOM = "https://us02web.zoom.us/j/81234567890?pwd=CirellaDemo";
/**
 * Los enlaces a la web de Ana: en la web personal (SITE_MODE=personal), en la raíz y sin «ana» (/courses,
 * /aboutme, /courses/<curso>); en la plataforma, detrás de /ana (lib/public-paths.ts y lib/site-sections.ts).
 */
const PERSONAL_DEMO = process.env.SITE_MODE?.trim() === "personal";
const ANA_HOME = PERSONAL_DEMO ? "/" : "/ana";
const anaSection = (section: string) => (PERSONAL_DEMO ? `/${section}` : `/ana/${section}`);
const anaPage = (slug: string) => (PERSONAL_DEMO ? `/${slug}` : `/ana/p/${slug}`);
const anaProduct = (section: "courses" | "sessions" | "membership" | "readings", slug: string) => (PERSONAL_DEMO ? `/${section}/${slug}` : `/ana/${slug}`);
const daysAgo = (d: number, h = 12, m = 0) => zonedTimeToUtc(addDaysToKey(TODAY, -d), h * 60 + m, TZ);
/**
 * Días bloqueados y las dos sesiones que vienen (prisma/demo-dates.ts). Las sesiones pagadas en la
 * web caen como pronto el día 15 desde la compra (lib/withdrawal.ts): las compras de Laura y Carmen
 * son de hace los días justos para eso, así Laura aún puede desistir de la suya.
 */
const DEMO_SCHEDULE = demoSchedule(TODAY);
const LAURA_HD_DAYS_AGO = demoPurchaseDaysAgo(TODAY, DEMO_SCHEDULE.lauraAt);
const CARMEN_11_DAYS_AGO = demoPurchaseDaysAgo(TODAY, DEMO_SCHEDULE.carmenAt);
/** Lucía tuvo su lectura hace 7 días: la compró 15 días antes. */
const LUCIA_SESSION_DAYS_AGO = 7;
const LUCIA_HD_DAYS_AGO = LUCIA_SESSION_DAYS_AGO + 15;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Guarda un archivo de pago con el driver configurado (disco local o R2), como una subida real. */
async function storePrivate(creatorId: string, name: string, data: Buffer) {
  const rel = `${creatorId}/${name}`;
  await storage().put(privateKey(rel), data, { contentType: mimeFromExt(rel) });
  return { storageKey: rel, sizeBytes: data.length };
}

/** Duración, códec y tamaño de un vídeo o audio de la demo (como al completar una subida real). */
async function mediaFields(data: Buffer, mime: string) {
  const info = await parseMediaInfo(async (o, l) => data.subarray(o, o + l), data.length, mime);
  return {
    durationSec: info?.durationSec ?? null,
    videoCodec: info?.video?.codec ?? null,
    width: info?.video?.width ?? null,
    height: info?.video?.height ?? null,
  };
}

type SeedPart = { text: string; format?: "MD" } | { file: { id: string; kind: string } } | { embed: string };

/**
 * Lección por partes (lib/lesson-parts.ts), con la copia de compatibilidad en Lesson calculada
 * igual que al guardar desde el panel (legacyLessonColumns).
 */
async function seedLesson(o: { creatorId: string; productId: string; moduleId: string; sortOrder: number; title: string; durationMin: number | null; parts: SeedPart[] }) {
  const parts = o.parts.map((p) =>
    "text" in p
      ? { kind: "TEXT" as const, body: p.text, bodyFormat: p.format ?? null, fileId: null, url: null, fileKind: null }
      : "file" in p
        ? { kind: "FILE" as const, body: null, bodyFormat: null, fileId: p.file.id, url: null, fileKind: p.file.kind }
        : { kind: "EMBED" as const, body: null, bodyFormat: null, fileId: null, url: p.embed, fileKind: null },
  );
  const lesson = await prisma.lesson.create({
    data: { creatorId: o.creatorId, productId: o.productId, moduleId: o.moduleId, title: o.title, durationMin: o.durationMin, sortOrder: o.sortOrder, ...legacyLessonColumns(parts) },
  });
  if (parts.length)
    await prisma.lessonPart.createMany({
      data: parts.map((p, i) => ({ creatorId: o.creatorId, productId: o.productId, lessonId: lesson.id, sortOrder: i, kind: p.kind, body: p.body, bodyFormat: p.bodyFormat, fileId: p.fileId, url: p.url })),
    });
  return lesson;
}

/** Dos cursos de ejemplo con dos temas cada uno (Astrología + Mi energía y Human Design + Gene Keys). */
async function seedComboCourses(anaId: string) {
  const astroEnergy = await prisma.product.create({
    data: {
      creatorId: anaId, type: "COURSE", status: "PUBLISHED", slug: "chart-and-energy", title: "Tu carta y tu energía", emoji: "✨", courseCategory: "ASTROLOGIA+MI_ENERGIA",
      summary: "Lee tu carta natal y aprende a cuidar tu energía según el cielo de cada día.",
      description: "Une la astrología y tu energía en un mismo camino.\n\nIncluye:\n• Tu carta natal, paso a paso\n• Rituales sencillos para tu energía diaria\n• Acceso de por vida",
      imageUrl: await demoImage(anaId, "/demo/astrologia.webp"), priceCents: 7900, ctaLabel: "Ver curso", sortOrder: 8, createdAt: daysAgo(3),
    },
  });
  const aeModule = await prisma.courseModule.create({ data: { creatorId: anaId, productId: astroEnergy.id, title: "Tu cielo y tu energía", sortOrder: 0 } });
  await seedLesson({ creatorId: anaId, productId: astroEnergy.id, moduleId: aeModule.id, sortOrder: 0, title: "Tu Sol, tu Luna y tu Ascendente", durationMin: 14, parts: [{ text: "Tres puntos de tu carta que cuentan **cómo brillas, cómo sientes y cómo te ven**.", format: "MD" }] });
  await seedLesson({ creatorId: anaId, productId: astroEnergy.id, moduleId: aeModule.id, sortOrder: 1, title: "Tu energía de hoy", durationMin: 10, parts: [{ text: "Mira qué despierta hoy el cielo en tu carta y elige un pequeño gesto para cuidarte." }] });

  const hdGk = await prisma.product.create({
    data: {
      creatorId: anaId, type: "COURSE", status: "PUBLISHED", slug: "design-and-keys", title: "Tu diseño y tus llaves", emoji: "🧬", courseCategory: "HUMAN_DESIGN+GENE_KEYS",
      summary: "Tu bodygraph y tus Gene Keys juntos: el mapa completo de tu propósito.",
      description: "Human Design y Gene Keys hablan del mismo mapa con dos lenguajes. Aquí los unimos.\n\nIncluye:\n• Tu tipo y tu autoridad\n• Tus cuatro llaves principales\n• Acceso de por vida",
      imageUrl: await demoImage(anaId, "/demo/gene-keys.webp"), priceCents: 11900, ctaLabel: "Ver curso", sortOrder: 15, createdAt: daysAgo(2),
    },
  });
  const hgModule = await prisma.courseModule.create({ data: { creatorId: anaId, productId: hdGk.id, title: "Tu mapa", sortOrder: 0 } });
  await seedLesson({ creatorId: anaId, productId: hdGk.id, moduleId: hgModule.id, sortOrder: 0, title: "Tu tipo y tu llave de vida", durationMin: 16, parts: [{ text: "Tu tipo de Human Design y tu primera Gene Key cuentan la misma historia: **cómo te mueves por la vida**.", format: "MD" }] });
}

/** Procesa una imagen de public/demo como una subida real: WebP con variantes en /media/…. */
function demoImage(creatorId: string, demoUrl: string) {
  return storeProcessedImage(creatorId, readFileSync(path.join("public", demoUrl)));
}

/** Sustituye el avatar y la portada de /demo por sus versiones procesadas en /media y guarda la página. */
async function storePageImages(creatorId: string, page: PageConfig) {
  const next: PageConfig = {
    ...page,
    avatarUrl: page.avatarUrl ? await demoImage(creatorId, page.avatarUrl) : null,
    coverUrl: page.coverUrl ? await demoImage(creatorId, page.coverUrl) : null,
  };
  const json = next as unknown as Prisma.InputJsonValue;
  await prisma.creator.update({ where: { id: creatorId }, data: { pageDraft: json, pagePublished: json } });
}

/** Imagen de public/demo procesada como un gráfico subido a un bloque (con sus medidas). */
/** Fotos de un código de descuento (DiscountCode.images), procesadas como una subida real. */
async function codePhotos(creatorId: string, list: [string, string][]): Promise<Prisma.InputJsonArray> {
  const out: { src: string; alt: string; width: number; height: number }[] = [];
  for (const [demoUrl, alt] of list) {
    const img = await demoBlockImage(creatorId, demoUrl, alt);
    out.push({ src: img.src, alt: img.alt, width: img.width, height: img.height });
  }
  return out;
}

async function demoBlockImage(creatorId: string, demoUrl: string, alt: string, caption?: string): Promise<PageImage> {
  const img = await storeImage(creatorId, readFileSync(path.join("public", demoUrl)), { profile: "graphic" });
  return { src: img.url, alt, width: img.width, height: img.height, ...(caption ? { caption } : {}) };
}

type AnaSystem = {
  slug: string;
  /** Nombre corto: tarjetas de la portada y de «Sobre mí». */
  title: string;
  img: string;
  text: string;
  /** Resumen con formato para «Mis métodos» de «Sobre mí». */
  body: string;
  /** Título largo de su página. */
  pageTitle: string;
  /** Entradilla de su página (debajo del título): dos o tres frases que explican de verdad. */
  intro: string;
  /**
   * Bloques que explican el sistema (qué es, de dónde viene y sus partes), sin botones ni productos: un
   * texto, o «Foto y texto» si lleva `photo`.
   */
  explain: { id: string; title: string; body: string; photo?: { src: string; alt: string }; side?: "left" | "right" }[];
  /** Modelo interactivo de su página (components/models), en su versión rápida. */
  model?: { kind: Exclude<ModelKind, "geometry">; title: string; intro: string };
  /** Las tres burbujas del final: la comunidad, sus lecturas o sesiones y sus cursos. */
  pills: { label: string; href: string }[];
};

/**
 * Métodos de Cirella: cada uno tiene su página (/<slug>), su tarjeta en «Sistemas con los que trabajo» de
 * la portada y en «Mis métodos» de «Sobre mí». La página no vende: título largo y entradilla, bloques
 * que explican el sistema, su modelo interactivo en versión rápida («Calcular con mis datos» debajo) y
 * tres burbujas hacia donde está todo lo de ese tema (la comunidad, lecturas o sesiones y cursos). La
 * de la Luna termina con los dos próximos círculos; «Mi energía» es su filosofía (ver anaEnergyBlocks()).
 */
const ANA_SYSTEMS: AnaSystem[] = [
  {
    slug: "human-design", title: "Human Design", img: "/demo/human-design.webp", text: "Tu manual de instrucciones energético.",
    body: "El **Human Design** une astrología, I Ching, cábala y el sistema de chakras en un único mapa: tu bodygraph.\n\nCon él descubres tu tipo, tu estrategia y tu autoridad para tomar decisiones con menos resistencia.",
    pageTitle: "Human Design: el manual de instrucciones de tu energía",
    intro:
      "El Human Design (Diseño Humano) calcula, con tu fecha, tu hora y tu lugar de nacimiento, un mapa llamado bodygraph. Une la astrología, el I Ching, la cábala y el sistema de chakras para responder a algo muy práctico: cómo funciona tu energía y cómo tomas buenas decisiones. No sirve para meterte en una caja, sino para que dejes de pelearte con tu propia naturaleza.",
    explain: [
      {
        id: "origen", title: "De dónde viene",
        body:
          "El sistema lo describió **Ra Uru Hu** (Alan Krakower) a partir de una experiencia que vivió en Ibiza en enero de 1987, y lo enseñó hasta su muerte, en 2011. Es una síntesis: toma las **64 puertas** de los 64 hexagramas del I Ching, la estructura del Árbol de la Vida de la cábala, los centros de energía de la tradición de los chakras y el cálculo astrológico de los planetas.\n\n" +
          "Tu bodygraph sale de **dos cálculos**: uno del momento en que naciste (la *personalidad*, lo consciente, que se dibuja en negro) y otro de unos tres meses antes, cuando el Sol estaba 88° más atrás (el *diseño*, lo inconsciente, en rojo). Lo que se enciende con los dos a la vez es lo que llevas a rayas.",
      },
      {
        id: "tipo", title: "El tipo y la estrategia", photo: { src: "/demo/human-design.webp", alt: "Un bodygraph dibujado en un cuaderno" }, side: "right",
        body:
          "Según cómo estén conectados tus centros, eres uno de **cinco tipos**, y cada tipo tiene una **estrategia**: la forma de moverte por la vida con menos resistencia.\n\n" +
          "- **Generador** (y **Generador Manifestante**, su variante rápida): casi siete de cada diez personas. Energía sostenida para lo que te enciende. Estrategia: *responder* a lo que llega (y, el manifestante, informar antes de actuar).\n" +
          "- **Proyector**: una de cada cinco. Ves a los demás con mucha claridad. Estrategia: *esperar la invitación* para lo grande.\n" +
          "- **Manifestador**: menos de una de cada diez. Inicias. Estrategia: *informar* antes de mover las cosas.\n" +
          "- **Reflector**: muy pocas personas. Reflejas tu entorno. Estrategia: *esperar un ciclo lunar* (unos 28 días) antes de las decisiones importantes.",
      },
      {
        id: "autoridad", title: "La autoridad: cómo decides tú",
        body:
          "La **autoridad** es el lugar del cuerpo desde el que tomas decisiones fiables. Casi nunca es la cabeza.\n\n" +
          "- **Emocional** (plexo solar): la claridad llega con el tiempo, cuando pasa la ola. Nada de decidir en caliente.\n" +
          "- **Sacral**: una respuesta visceral, un sí o un no del cuerpo en el momento.\n" +
          "- **Esplénica**: una intuición rápida y suave que solo habla una vez.\n" +
          "- **Del ego** (corazón): lo que de verdad quieres y estás dispuesta a sostener.\n" +
          "- **Autoproyectada** (centro G): escucharte hablar en voz alta y notar qué suena a ti.\n" +
          "- **Mental o del entorno** y **lunar**: en algunos Proyectores y en los Reflectores, la claridad llega hablando con personas de confianza y dejando pasar el tiempo.",
      },
      {
        id: "centros", title: "Los nueve centros",
        body:
          "El bodygraph tiene **nueve centros**: Cabeza, Ajna, Garganta, G (identidad y dirección), Corazón o Ego, Sacro, Plexo Solar, Bazo y Raíz.\n\n" +
          "Un centro **definido** (con color) es energía que tienes siempre y de la misma manera: es fiable y es tuya. Un centro **abierto** (en blanco) recibe y amplifica la energía de quienes te rodean. Ahí es donde más te condicionas, pero también donde, con los años, más sabiduría puedes tener sobre los demás.",
      },
      {
        id: "puertas", title: "Puertas, canales y perfil", photo: { src: "/demo/sesion.webp", alt: "Cirella leyendo un bodygraph en una sesión" }, side: "left",
        body:
          "Entre los centros hay **36 canales**, y cada canal une dos de las **64 puertas**. Cuando tienes las dos puertas de un canal, el canal se *define* y los dos centros que une se colorean.\n\n" +
          "El **perfil** son dos números (de los doce posibles, como 1/3, 2/4 o 6/2) que salen de la línea de tu Sol consciente y la de tu Sol inconsciente. Cada línea es un papel: el investigador, el ermitaño, el que aprende probando, el que teje redes, el que proyectan los demás y el modelo a seguir. Dicen cómo vives tu propósito.",
      },
      {
        id: "como", title: "Cómo lo uso yo",
        body:
          "No te pido que te lo creas: te propongo un **experimento**. Probar tu estrategia y tu autoridad en decisiones pequeñas durante unas semanas y mirar qué cambia. El Human Design no sustituye lo que sabes de ti; te da un idioma para entender por qué unas cosas te cuestan tanto y otras te salen solas.",
      },
    ],
    model: { kind: "bodygraph", title: "Explora un bodygraph", intro: "Toca un centro, un canal o una puerta para ver qué es." },
    pills: [
      { label: "La comunidad", href: anaSection("membership") },
      { label: "Lecturas y sesiones", href: anaSection("sessions") },
      { label: "Cursos de Human Design", href: `${anaSection("courses")}#human_design` },
    ],
  },
  {
    slug: "gene-keys", title: "Gene Keys", img: "/demo/gene-keys.webp", text: "Contempla tu sombra, tu don y tu siddhi.",
    body: "Las **Gene Keys** son 64 llaves de contemplación. Cada una describe un espectro: la sombra, el don y el siddhi.\n\nTrabajamos con tu Secuencia de Activación para encontrar tu genio creativo.",
    pageTitle: "Gene Keys: contemplar tu sombra para encontrar tu don",
    intro:
      "Las Gene Keys son 64 llaves de contemplación que escribió Richard Rudd sobre los mismos 64 hexagramas del I Ching que usa el Human Design. Tu fecha, tu hora y tu lugar de nacimiento colocan algunas de esas llaves en un mapa, tu perfil hologenético. No es un sistema para analizarse, sino para llevarlo contigo y dejar que te trabaje poco a poco.",
    explain: [
      {
        id: "origen", title: "De dónde vienen",
        body:
          "**Richard Rudd** estudió Human Design en sus comienzos y, a partir de ahí, escribió su propio camino: el libro *The Gene Keys* se publicó en 2009. Toma los **64 arquetipos** del I Ching y los lee como 64 frecuencias de la conciencia humana (Rudd los compara, como metáfora, con los 64 codones del código genético).\n\n" +
          "La diferencia con el Human Design es el tono: aquí no hay reglas que seguir, sino **contemplación**. Se lee una llave, se vuelve a ella, se observa en la vida diaria. Lo que entiendes con la cabeza es solo el principio.",
      },
      {
        id: "espectro", title: "Sombra, don y siddhi", photo: { src: "/demo/gene-keys.webp", alt: "Las llaves escritas en tarjetas sobre la mesa" }, side: "right",
        body:
          "Cada llave es un **espectro** con tres frecuencias:\n\n" +
          "- **La sombra**: el patrón de miedo, la forma en que esa energía se nos atasca.\n" +
          "- **El don**: lo que aparece cuando miras la sombra sin pelearte con ella. Tu genio.\n" +
          "- **El siddhi**: la expresión más alta, casi mística, de esa misma energía.\n\n" +
          "Por ejemplo, la **llave 1** va de la *Entropía* (sentirte apagada, sin chispa) a la *Frescura* (crear desde lo que te mueve de verdad) y a la *Belleza*. No son tres cosas distintas: es la misma fuerza a tres temperaturas.",
      },
      {
        id: "secuencias", title: "Las tres secuencias",
        body:
          "El perfil hologenético se recorre en tres viajes:\n\n" +
          "- **La Secuencia de Activación** (Obra de vida, Evolución, Irradiación y Propósito): tu genio, cómo te haces visible y en qué maduras.\n" +
          "- **La Secuencia de Venus** (Atracción, CI, CE, CS y Núcleo): tu corazón, tus patrones en las relaciones y lo que aprendiste en los primeros siete años.\n" +
          "- **La Secuencia de la Perla** (Vocación, Cultura, Perla y Marca): tu prosperidad, que llega como efecto de la coherencia.\n\n" +
          "Cada esfera lleva una llave y una línea, como el perfil del Human Design.",
      },
      {
        id: "como", title: "Cómo trabajo con ellas",
        body:
          "Empezamos siempre por la **Secuencia de Activación**: tus cuatro primeras llaves. Te propongo leer una cada semana, volver a ella cuando algo te remueve y apuntar dónde aparece su sombra. Las Gene Keys piden paciencia: lo que cambia no es lo que sabes de ti, sino desde dónde lo vives.",
      },
    ],
    model: { kind: "geneKeys", title: "Explora un perfil hologenético", intro: "Toca una esfera para ver su llave en sombra, don y siddhi." },
    pills: [
      { label: "La comunidad", href: anaSection("membership") },
      { label: "Lecturas de Gene Keys", href: anaSection("readings") },
      { label: "Cursos de Gene Keys", href: `${anaSection("courses")}#gene_keys` },
    ],
  },
  {
    slug: "astrology", title: "Astrología", img: "/demo/astrologia.webp", text: "Tu carta natal como mapa de tus ritmos.",
    body: "La **carta natal** es una foto del cielo cuando naciste. No te define: describe tus potenciales y tus ritmos.\n\nLeemos tu Sol, tu Luna, tu Ascendente y las casas para aterrizarlo a tu vida.",
    pageTitle: "Astrología: tu carta natal como mapa de tus ritmos",
    intro:
      "La astrología lee dónde estaban el Sol, la Luna y los planetas en el momento exacto en que naciste, vistos desde el lugar donde naciste. Esa foto del cielo es tu carta natal: no dicta lo que te va a pasar, describe tus ritmos, tus necesidades y las energías con las que vienes a trabajar. Aquí te cuento cómo se lee, pieza a pieza.",
    explain: [
      {
        id: "origen", title: "De dónde viene",
        body:
          "La astrología nació en Mesopotamia, hace más de cuatro mil años, cuando se observaba el cielo para entender los ciclos de la tierra. En la Grecia helenística tomó la forma que conocemos (la carta individual con signos, planetas y casas) y **Ptolomeo** la ordenó en el siglo II.\n\n" +
          "En el siglo XX, con **Dane Rudhyar** y la astrología psicológica de **Liz Greene**, dejó de ser un sistema para predecir y pasó a ser un lenguaje para conocerse. Es la que yo practico. Usamos el **zodiaco tropical**, el de las estaciones: 0° de Aries es el equinoccio de primavera.",
      },
      {
        id: "signos", title: "Los doce signos: el cómo", photo: { src: "/demo/astrologia.webp", alt: "La rueda del zodiaco" }, side: "right",
        body:
          "Los signos son **doce tramos de 30°** del recorrido del Sol a lo largo del año. Describen *cómo* se expresa una energía. Cada uno combina:\n\n" +
          "- un **elemento**: fuego (Aries, Leo, Sagitario), tierra (Tauro, Virgo, Capricornio), aire (Géminis, Libra, Acuario) o agua (Cáncer, Escorpio, Piscis);\n" +
          "- y una **cualidad**: cardinal, que empieza; fija, que sostiene; o mutable, que adapta.\n\n" +
          "Tu Sol en Leo y el de tu hermana en Virgo no os hacen mejores ni peores: os dan maneras distintas de brillar.",
      },
      {
        id: "planetas", title: "Los planetas: el qué",
        body:
          "Los planetas son las **energías** de la carta, *qué* se mueve en ti:\n\n" +
          "- el **Sol**: tu identidad, lo que vienes a desarrollar;\n" +
          "- la **Luna**: tus necesidades emocionales, cómo te cuidas;\n" +
          "- **Mercurio**: cómo piensas y te comunicas;\n" +
          "- **Venus**: cómo amas y qué valoras;\n" +
          "- **Marte**: tu deseo y tu forma de actuar;\n" +
          "- **Júpiter** y **Saturno**: dónde creces y dónde maduras con esfuerzo;\n" +
          "- **Urano**, **Neptuno** y **Plutón**: los lentos, que marcan generaciones y grandes transformaciones.\n\n" +
          "Se suman puntos como **Quirón** (la herida que enseña) y los **nodos lunares** (de dónde vienes y hacia dónde creces).",
      },
      {
        id: "casas", title: "Las casas: el dónde",
        body:
          "Las **doce casas** reparten el cielo según la hora y el lugar en que naciste. Dicen *dónde*, en qué área de tu vida, se juega cada energía: la casa 1 es tu forma de presentarte; la 4, tu hogar y tus raíces; la 7, la pareja y las alianzas; la 10, tu vocación y tu lugar en el mundo.\n\n" +
          "Empiezan en el **Ascendente**, el signo que subía por el horizonte al nacer, y el **Medio Cielo** marca lo más alto. Por eso para leer las casas hace falta la **hora exacta**: cuatro minutos mueven el Ascendente un grado.",
      },
      {
        id: "aspectos", title: "Los aspectos: cómo conversan", photo: { src: "/demo/sesion.webp", alt: "Una carta natal impresa con sus líneas de aspecto" }, side: "left",
        body:
          "Los **aspectos** son los ángulos entre los planetas, las líneas del centro de la rueda. Cuentan cómo dialogan tus energías:\n\n" +
          "- **conjunción** (0°): se funden;\n" +
          "- **sextil** (60°) y **trígono** (120°): se ayudan, fluyen;\n" +
          "- **cuadratura** (90°) y **oposición** (180°): se tensan y te piden movimiento.\n\n" +
          "Un aspecto tenso no es algo malo: casi siempre es donde más has crecido.",
      },
      {
        id: "como", title: "Cómo la leo yo",
        body:
          "Leo la carta **sin fatalismo**: nada está escrito, todo es potencial. Empiezo por tu Sol, tu Luna y tu Ascendente, el triángulo que más se nota en el día a día, y desde ahí bajamos a lo concreto: qué necesitas, dónde te exiges de más y qué ritmo te sienta bien. Con los **tránsitos** miramos además qué se mueve ahora en el cielo y cómo toca tu carta.",
      },
    ],
    model: { kind: "chart", title: "Explora una carta natal", intro: "Toca un planeta, un signo, una casa o una línea de aspecto." },
    pills: [
      { label: "La comunidad", href: anaSection("membership") },
      { label: "Lecturas de astrología", href: anaSection("readings") },
      { label: "Cursos de astrología", href: `${anaSection("courses")}#astrologia` },
    ],
  },
  {
    slug: "moon", title: "Luna", img: "/demo/comunidad.webp", text: "Vive cada lunación con intención.",
    body: "La **Luna** marca un ritmo que el cuerpo reconoce antes que la cabeza: sembrar en la luna nueva, ver en la llena, soltar en la menguante.\n\nEn los **círculos de la luna** nos juntamos en cada luna nueva y cada luna llena para vivirla con un ritual guiado y un rato para compartir.",
    pageTitle: "Luna: vivir cada lunación con intención",
    intro:
      "Cada veintinueve días y medio la Luna completa un ciclo de fases, de luna nueva a luna nueva: es la lunación, el mes lunar. Su ritmo de crecer, llenarse y menguar es el de muchos de nuestros procesos, y por eso desde siempre se ha usado para sembrar, recoger y descansar. Aquí te explico cómo funciona y cómo la vivo yo.",
    explain: [
      {
        id: "fases-por-que", title: "Por qué cambia de forma",
        body:
          "La Luna no tiene luz propia: el Sol ilumina siempre **la mitad** que mira hacia él. Lo que cambia es el ángulo desde el que la vemos nosotras mientras gira alrededor de la Tierra.\n\n" +
          "Cuando está entre la Tierra y el Sol, vemos su cara oscura: es la **luna nueva**. Cuando la Tierra queda en medio, vemos toda su cara iluminada: es la **luna llena**. De una luna nueva a la siguiente pasan unos **29,5 días** (el mes sinódico), y en ese tiempo la Luna recorre los doce signos: pasa unos dos días y medio en cada uno.",
      },
      {
        id: "ocho-fases", title: "Las ocho fases de la lunación", photo: { src: "/demo/comunidad.webp", alt: "Las fases de la luna dibujadas en círculo" }, side: "right",
        body:
          "Dane Rudhyar dividió el ciclo en **ocho fases**, y cada una pide algo distinto:\n\n" +
          "- **Luna nueva**: sembrar una intención.\n" +
          "- **Creciente**: el primer impulso, sostener lo que empieza.\n" +
          "- **Cuarto creciente**: decidir y actuar ante el primer obstáculo.\n" +
          "- **Gibosa creciente**: ajustar, pulir.\n" +
          "- **Luna llena**: ver con claridad, culminar, celebrar.\n" +
          "- **Gibosa menguante**: compartir lo aprendido y agradecer.\n" +
          "- **Cuarto menguante**: revisar y soltar lo que ya no sirve.\n" +
          "- **Menguante** (balsámica): descansar y vaciarse antes de volver a empezar.",
      },
      {
        id: "nueva-llena", title: "Luna nueva y luna llena",
        body:
          "En la **luna nueva** el Sol y la Luna están en el mismo signo: es un comienzo con el color de ese signo. Es el momento de escribir intenciones en presente, pocas y concretas.\n\n" +
          "En la **luna llena** están en signos opuestos, y se ilumina un **eje**: lo que sembraste hace dos semanas se ve, para bien y para mal. Es momento de agradecer y de soltar.\n\n" +
          "Dos veces al año, cuando la lunación cae cerca de los nodos, hay **eclipses**: lunas nuevas y llenas más intensas, que abren y cierran etapas.",
      },
      {
        id: "como", title: "Cómo la vivo yo", photo: { src: "/demo/hero.webp", alt: "Una vela y un cuaderno junto a la ventana de noche" }, side: "left",
        body:
          "Llevo años escribiendo un **diario lunar**: una página en cada luna nueva y otra en cada llena. Es la práctica más sencilla que conozco y la que más me ha cambiado.\n\n" +
          "En los **círculos de la luna** nos juntamos por Zoom en cada luna nueva y cada luna llena: un ritual guiado, un rato de escritura y una ronda para compartir. Y si conoces tu **luna natal** (el signo de tu Luna y la fase en la que naciste), puedes ver qué lunaciones te tocan más de cerca.",
      },
    ],
    model: { kind: "lunar", title: "La luna, ahora", intro: "Mueve el ciclo para ver cómo cambia la fase." },
    pills: [
      { label: "La comunidad", href: anaSection("membership") },
      { label: "Círculos y sesiones", href: anaSection("sessions") },
      { label: "Especiales de la luna", href: `${anaSection("courses")}#especial` },
    ],
  },
  {
    slug: "energy", title: "Mi energía", img: "/demo/sesion.webp", text: "Mi forma de mirar: cinco principios y un ensayo.",
    body: "Los métodos los aprendí; **mi energía** es lo que quedó después: cinco principios que sostienen cada lectura y una forma de acompañar sin prisa.\n\nPorque ningún sistema del mundo sustituye la experiencia propia.",
    pageTitle: "Mi energía: lo que creo después de haberlo leído todo",
    intro:
      "Los sistemas con los que trabajo los aprendí de otras personas; esta parte no. Es mi forma de mirar: cinco principios que sostienen cada lectura, un texto de mis cuadernos y dos herramientas sencillas, las runas y mi oráculo, para hacerte mejores preguntas. Las puedes usar sin registrarte.",
    explain: [
      {
        id: "cuatro-mapas", title: "Cuatro mapas, una misma persona", photo: { src: "/demo/ana-avatar.webp", alt: "Cirella sonriendo" }, side: "right",
        body:
          "La astrología, el Human Design, las Gene Keys y la luna miran lo mismo desde sitios distintos. La carta natal cuenta tus ritmos; el bodygraph, cómo funciona tu energía y cómo decides; las Gene Keys, qué sombras esconden tus dones; la luna, el compás del mes.\n\n" +
          "Cuando los juntamos no buscamos que coincidan, sino lo que **se repite**: eso suele ser lo que de verdad importa. Y siempre por delante, lo que tú ya sabes de tu vida.",
      },
    ],
    pills: [
      { label: "La comunidad", href: anaSection("membership") },
      { label: "Sesión 1:1", href: anaSection("sessions") },
      { label: "Cursos de Mi energía", href: `${anaSection("courses")}#mi_energia` },
    ],
  },
];

/**
 * «Mi energía»: la antigua página «Filosofía» contada por Cirella. Todo son bloques que ella puede editar:
 * la frase sobre la geometría sagrada (modelo «geometry»), por qué esta parte, los cinco principios
 * (una trayectoria numerada I–V), el ensayo de sus cuadernos (texto con formato) y, para jugar, una tirada
 * de runas y su oráculo de la luna (modelos «runes» y «oracle»; el oráculo, con su baraja de la BD).
 */
function anaEnergyBlocks(oracleDeckId?: string): ContentBlock[] {
  return [
    {
      id: "geometria", kind: "model", model: "geometry", figure: "enneagram", enabled: true,
      title: "Ningún sistema del mundo\nsustituye la experiencia\npropia.",
      intro: "",
    },
    {
      id: "por-que", kind: "text", title: "Por qué esta parte", format: "MD", enabled: true,
      body:
        "Los otros caminos los aprendí: la astrología, el Human Design, las Gene Keys, la luna. Este no. Es lo que quedó después de haberlo leído todo y seguir plantada ante las mismas preguntas. Para esta parte no puedo citar a nadie, y por eso es la única de la que respondo por completo.\n\n" +
        "Lo que sigue no son dogmas. Son cinco cosas que, después de años acompañando a personas, creo que son ciertas, hasta que alguien me demuestre lo contrario.",
    },
    {
      id: "principios", kind: "timeline", title: "Cinco principios", enabled: true,
      items: [
        { label: "I", title: "No hay atajo", text: "Todo lo que va rápido, o no era importante, o no se quedó. Un árbol que crece en un año tiene la madera blanda." },
        { label: "II", title: "Entender no es sanar", text: "Puedes conocer perfectamente el origen de un patrón y seguir repitiéndolo cada día. La comprensión es el comienzo del trabajo, no su final." },
        { label: "III", title: "Ningún sistema es la verdad", text: "La astrología, el Human Design, las Gene Keys: son idiomas. Los idiomas describen el mundo, no son el mundo. Quien toma un sistema por la verdad ha dejado de mirar." },
        { label: "IV", title: "El dolor quiere ser atravesado", text: "No comprendido. La idea de que el sufrimiento trae un mensaje consuela, pero es una cuenta: si entiendo para qué sirvió, ya no tengo que sentirlo." },
        { label: "V", title: "La presencia gana al consejo", text: "Una persona que se queda sin necesitar que estés mejor es algo raro. También es lo único que ayuda en las horas difíciles." },
      ],
    },
    {
      id: "ensayo", kind: "text", title: "Sobre la confianza en lo que todavía no es visible", format: "MD", enabled: true,
      body: [
        "*De mis cuadernos*",
        "Hay un tiempo entre la decisión y la prueba de que fue acertada.",
        "Ese tiempo es el verdadero lugar de la vida. Todo lo anterior es deliberación; todo lo posterior, recuerdo.",
        "En ese tiempo nadie tiene razón. Ni quienes te advierten ni quienes te animan. No hay nada que saber: solo algo que sostener.",
        "## Lo que la confianza no es",
        "La confianza no es certeza en formato pequeño. Quien dice «confío en que todo saldrá bien» casi siempre quiere decir: *no quiero sentir que también podría no salir bien.*",
        "La confianza de verdad incluye el otro extremo. Dice: voy, y no lo sé.",
        "## Por qué merece la pena",
        "Porque una vida en la que solo caminas cuando sabes es una vida muy corta.",
        "Nunca llegarás a ningún sitio donde no hayas estado ya.",
        "*— Cirella*",
      ].join("\n\n"),
    },
    {
      id: "oraculo", kind: "model", model: "oracle", figure: "enneagram", enabled: true, deck: oracleDeckId,
      title: "El oráculo de la luna",
      intro: "Dibujé estas veintiocho cartas para mis círculos, una por cada noche del ciclo. Baraja, saca una o tres, y quédate más con la pregunta que con la respuesta. Si estás suscrita a mi newsletter, en «Más barajas» tienes las demás.",
    },
    {
      id: "runas", kind: "model", model: "runes", figure: "enneagram", enabled: true,
      title: "Una tirada de runas",
      intro: "Las runas fueron mi primer idioma antes que la astrología. No me dicen qué va a pasar: me ayudan a hacerme una pregunta mejor. Tira una para el día, o tres si quieres mirar de dónde vienes y hacia dónde vas.",
    },
  ];
}

/**
 * Páginas extra de Cirella: «Sobre mí» publicada (foto y texto, cita, tarjetas de métodos y de cómo
 * acompaña, trayectoria, galería y un cierre suave sin empujar a reservar) y «Preguntas frecuentes»
 * en borrador.
 */
async function seedAnaSitePages(creatorId: string) {
  const about: SitePageContent = {
    title: "Sobre mí",
    subtitle: "Astróloga, analista de Human Design y guía de Gene Keys. Te acompaño a leer tu mapa con calma.",
    cover: await demoBlockImage(creatorId, "/demo/ana-cover.webp", "Cirella en su estudio"),
    blocks: [
      {
        id: "historia",
        kind: "photoText",
        title: "Mi historia",
        body: "Empecé a estudiar el cielo hace **8 años**, cuando una lectura me ayudó a entender por qué me costaba tanto descansar.\n\n## Lo que me mueve\n\n- Traducir el cielo a decisiones concretas\n- Que salgas de cada sesión con un plan\n- Cuidar a las mujeres que me confían su historia",
        format: "MD",
        image: await demoBlockImage(creatorId, "/demo/ana-avatar.webp", "Cirella sonriendo"),
        imageSide: "right",
        enabled: true,
      },
      {
        id: "cita",
        kind: "quote",
        text: "No vienes a que te digan quién eres: vienes a recordarlo. Yo solo te ayudo a leer el mapa con tus propios ojos.",
        author: "Cirella",
        enabled: true,
      },
      {
        id: "trayectoria",
        kind: "timeline",
        title: "Mi trayectoria",
        items: [
          { label: "2018", title: "Empiezo a estudiar astrología", text: "Una lectura de mi carta me cambió la forma de mirarme. Esa misma semana me apunté a astrología psicológica." },
          { label: "2020", title: "Me certifico en Human Design", text: "Dos años de formación como analista para leer el bodygraph con rigor." },
          { label: "2021", title: "Mis primeras lecturas", text: "Empecé con amigas y amigas de amigas. Hoy llevo más de 1.200 lecturas." },
          { label: "2022", title: "Guía de Gene Keys", text: "Me formo para acompañar la Secuencia de Activación y unir los tres sistemas." },
          { label: "2024", title: "Nace la comunidad", text: "Abro los círculos lunares y un espacio para practicar juntas cada mes." },
        ],
        enabled: true,
      },
      {
        id: "metodos",
        kind: "text",
        title: "Mis métodos",
        body: "Trabajo con cuatro sistemas que se complementan y con una forma de mirar que los une. Te cuento qué es cada uno y, debajo, tienes su página con todo el detalle.",
        format: "MD",
        enabled: true,
      },
      ...(await Promise.all(
        ANA_SYSTEMS.map(async (sys, i) => ({
          id: `metodo-${sys.slug}`,
          kind: "photoText" as const,
          title: sys.title,
          body: sys.body,
          format: "MD" as const,
          image: await demoBlockImage(creatorId, sys.img, sys.title),
          imageSide: i % 2 === 0 ? ("left" as const) : ("right" as const),
          buttonLabel: `Descubre ${sys.title} →`,
          buttonUrl: anaPage(sys.slug),
          enabled: true,
        })),
      )),
      // Un texto libre debajo de los métodos, para contar más de ella.
      { "id":"mas-sobre-mi","kind":"text","title":"Más allá de los métodos","body":"Cuando no estoy leyendo cartas, me encontrarás **caminando por el campo al atardecer**, con una libreta en el bolsillo y la Luna por compañera.\n\nCreo en las mañanas lentas, en el té caliente y en escribir a mano lo que siento. Cada luna nueva enciendo una vela y escribo mis intenciones, como te propongo a ti.\n\nLo que más me emociona de este trabajo es ver el momento en que alguien **se reconoce en su propio mapa**: ese «ahora lo entiendo» que lo cambia todo.","format":"MD","enabled":true },
      {
        id: "hablamos",
        kind: "text",
        title: "¿Hablamos?",
        body: "No hace falta que sepas qué necesitas. Cuéntame en qué momento estás y te oriento **con calma y sin compromiso**.\n\nY si prefieres ir poco a poco, en mis actualidades comparto cada luna y lo que trae el cielo.",
        format: "MD",
        buttonLabel: "Escríbeme",
        buttonUrl: "mailto:hola@cirella.app",
        enabled: true,
      },
    ],
    seoTitle: "Sobre Cirella · Astrología y Human Design",
    seoDescription: "Quién soy, mi trayectoria y cómo trabajo con astrología, Human Design y Gene Keys.",
  };
  const faq: SitePageContent = {
    title: "Preguntas frecuentes",
    subtitle: "Lo que me preguntáis antes de reservar.",
    cover: null,
    blocks: [
      { id: "hora", kind: "text", title: "¿Necesito mi hora de nacimiento?", body: "Sí, para la carta natal y Human Design la hora exacta es **importante**.", format: "MD", enabled: true },
      { id: "online", kind: "text", title: "¿Las sesiones son online?", body: "Todas son por videollamada y te envío la grabación.", format: "MD", enabled: true },
    ],
    seoTitle: "",
    seoDescription: "",
  };
  const json = (v: SitePageContent) => v as unknown as Prisma.InputJsonValue;
  await prisma.sitePage.create({
    data: { creatorId, slug: "aboutme", title: about.title, publishedTitle: about.title, draft: json(about), published: json(about), status: "PUBLISHED", publishedAt: daysAgo(30), sortOrder: 0, createdAt: daysAgo(31) },
  });
  await prisma.sitePage.create({ data: { creatorId, slug: "faq", title: faq.title, draft: json(faq), status: "DRAFT", sortOrder: 1, createdAt: daysAgo(2) } });
}

/**
 * Newsletter de Cirella (web personal): ~15 suscriptoras (sus clientas que aceptaron novedades y
 * gente que se apuntó en la página o vino de su lista antigua, con algunas bajas, una sin confirmar y
 * un rebote), una newsletter enviada hace 12 días con sus estadísticas, un borrador, una programada
 * y su confirmación de reserva con un texto propio.
 */
/** «Oráculo de la Luna» de Cirella en Panel → Barajas: publicada, con las 28 cartas de serie. */
async function seedAnaOracleDeck(creatorId: string) {
  const deck = await prisma.oracleDeck.create({
    data: {
      creatorId, name: ORACLE_NAME, slug: "oraculo-de-la-luna", status: "PUBLISHED", sortOrder: 0, createdAt: daysAgo(30),
      description: "Veintiocho cartas que dibujé para mis círculos, una por cada noche del ciclo.",
    },
  });
  await prisma.oracleCard.createMany({
    data: ORACLE_CARDS.map((c, i) => ({
      creatorId, deckId: deck.id, name: c.name, keyword: c.keyword, message: c.message, question: c.question, motif: c.id, sortOrder: i,
      // Dos cartas que se leen distinto del revés, para que la demo enseñe las invertidas.
      ...(c.id === "luna-llena"
        ? { reversible: true, reversedMessage: "Todo está a la vista, pero no quieres mirarlo todavía. Date permiso para ir despacio: la luz no se va." }
        : c.id === "puerta"
          ? { reversible: true, reversedMessage: "La puerta sigue ahí, pero hoy no es el día. Quedarte a este lado también es una decisión." }
          : {}),
    })),
  });
  return deck;
}

/** «Oráculo de los elementos»: una baraja corta publicada, la segunda que sale en «Más barajas». */
async function seedAnaElementsDeck(creatorId: string) {
  const cards: { name: string; keyword: string; message: string; question: string; motif: string }[] = [
    { name: "El Fuego", keyword: "Impulso", motif: "fuego", message: "Hay algo que quiere empezar y no necesita más permiso. Da el primer paso aunque sea pequeño: el fuego crece con lo que le das.", question: "¿Qué harías hoy si no tuvieras que justificarlo?" },
    { name: "La Tierra", keyword: "Cuerpo", motif: "montana", message: "Vuelve al cuerpo y a lo concreto. Lo que buscas no está en otra idea, está en el siguiente gesto repetido con paciencia.", question: "¿Qué necesita tu cuerpo de ti esta semana?" },
    { name: "El Aire", keyword: "Claridad", motif: "espiral", message: "Ponle palabras. Lo que da vueltas dentro pierde fuerza en cuanto lo dices en voz alta o lo escribes.", question: "¿Qué conversación llevas tiempo aplazando?" },
    { name: "El Agua", keyword: "Sentir", motif: "marea", message: "No hace falta entenderlo todavía. Deja que la emoción pase entera, como una ola, y mira qué queda en la orilla.", question: "¿Qué estás sintiendo que aún no te has permitido nombrar?" },
    { name: "La Semilla", keyword: "Paciencia", motif: "semilla", message: "Lo que has sembrado está trabajando bajo tierra. Que no lo veas no quiere decir que no esté pasando.", question: "¿Qué estás intentando acelerar?" },
    { name: "La Raíz", keyword: "Sostén", motif: "raiz", message: "Antes de crecer hacia fuera, mira qué te sostiene. Hay personas y hábitos que son tu suelo: cuídalos.", question: "¿Dónde te sientes en casa?" },
    { name: "La Lluvia", keyword: "Limpieza", motif: "lluvia", message: "Algo se está llevando lo viejo. No lo retengas: lo que se va deja sitio.", question: "¿Qué ya no quieres seguir cargando?" },
    { name: "El Silencio", keyword: "Escucha", motif: "silencio", message: "Hoy la respuesta no está en hacer más. Para un momento y escucha lo que ya sabes.", question: "¿Qué oirías si dejaras de buscar fuera?" },
  ];
  const deck = await prisma.oracleDeck.create({
    data: {
      creatorId, name: "Oráculo de los elementos", slug: "oraculo-de-los-elementos", status: "PUBLISHED", sortOrder: 1, createdAt: daysAgo(12),
      description: "Ocho cartas sencillas para cuando necesitas volver a lo básico: fuego, tierra, aire y agua.",
    },
  });
  await prisma.oracleCard.createMany({ data: cards.map((c, i) => ({ creatorId, deckId: deck.id, ...c, sortOrder: i })) });
  return deck;
}

/**
 * «Mi energía» (/area/energy) en la demo: Laura y Carmen son suscriptoras confirmadas de la
 * newsletter de Cirella (si sus compras no las dejaron ya así), con sus datos de nacimiento guardados y los
 * de una persona más, para que la página se vea completa al entrar con ellas. Datos inventados.
 */
async function seedEnergyProfiles(anaId: string, students: { id: string; email: string; name: string | null }[]) {
  const extra: Record<string, { own: { date: string; time: string | null; place: [string, string, number, number] }; other: { name: string; relation: string; date: string; time: string | null; place: [string, string, number, number] } }> = {
    "laura@example.com": {
      own: { date: "1990-03-21", time: "08:30", place: ["Madrid", "Comunidad de Madrid, España", 40.4168, -3.7038] },
      other: { name: "Mario", relation: "pareja", date: "1987-07-02", time: null, place: ["Valencia", "Comunidad Valenciana, España", 39.4699, -0.3763] },
    },
    "carmen@example.com": {
      own: { date: "1984-11-08", time: "22:15", place: ["Sevilla", "Andalucía, España", 37.3891, -5.9845] },
      other: { name: "Lucía", relation: "hijo", date: "2012-05-17", time: "06:40", place: ["Granada", "Andalucía, España", 37.1773, -3.5986] },
    },
  };
  for (const u of students) {
    const d = extra[u.email];
    if (!d) continue;
    const at = daysAgo(6, 19, 30);
    const sub = await prisma.subscriber.findUnique({ where: { creatorId_email: { creatorId: anaId, email: u.email } } });
    if (!sub)
      await prisma.subscriber.create({
        data: {
          creatorId: anaId, email: u.email, name: u.name, status: "CONFIRMED", source: "FORM",
          consentAt: at, consentText: newsletterConsentText("Cirella"), consentMeta: { form: "carta" }, confirmedAt: new Date(at.getTime() + 4 * 60_000), createdAt: at,
        },
      });
    else if (sub.status !== "CONFIRMED") await prisma.subscriber.update({ where: { id: sub.id }, data: { status: "CONFIRMED", confirmedAt: at, unsubscribedAt: null, unsubscribeVia: null } });
    const row = (p: { date: string; time: string | null; place: [string, string, number, number] }) => ({
      birthDate: p.date, birthTime: p.time, placeName: p.place[0], placeDetail: p.place[1], lat: p.place[2], lon: p.place[3], tz: "Europe/Madrid", consentAt: at, createdAt: at,
    });
    await prisma.birthProfile.createMany({
      data: [
        { creatorId: anaId, userId: u.id, name: (u.name ?? "Yo").split(" ")[0], relation: "yo", isOwn: true, ...row(d.own) },
        { creatorId: anaId, userId: u.id, name: d.other.name, relation: d.other.relation, isOwn: false, ...row(d.other) },
      ],
    });
  }
}

async function seedAnaNewsletter(anaId: string, o: { circleId: string; astroId: string }) {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { id: anaId } });
  const consent = newsletterConsentText("Cirella");
  // Sus clientas con la casilla de novedades marcada (como las deja la migración).
  const optIns = await prisma.customer.findMany({ where: { creatorId: anaId, marketingOptIn: true }, orderBy: { createdAt: "asc" } });
  for (const c of optIns)
    await prisma.subscriber.create({
      data: {
        creatorId: anaId, email: c.email.toLowerCase(), name: c.name, status: "CONFIRMED", source: "CHECKOUT",
        consentAt: c.marketingOptInAt ?? c.createdAt, consentText: "Casilla «Quiero recibir novedades» marcada al pagar", consentMeta: { form: "checkout" },
        confirmedAt: c.marketingOptInAt ?? c.createdAt, createdAt: c.marketingOptInAt ?? c.createdAt,
      },
    });
  const extra: { email: string; name: string | null; status: string; source: string; d: number; via?: string }[] = [
    { email: "irene.navarro@example.com", name: "Irene Navarro", status: "CONFIRMED", source: "FORM", d: 40 },
    { email: "marta.gil@example.com", name: "Marta Gil", status: "CONFIRMED", source: "FORM", d: 33 },
    { email: "paula.ortega@example.com", name: "Paula", status: "CONFIRMED", source: "IMPORT", d: 60 },
    { email: "noelia.santos@example.com", name: "Noelia Santos", status: "CONFIRMED", source: "IMPORT", d: 60 },
    { email: "clara.vidal@example.com", name: null, status: "CONFIRMED", source: "FORM", d: 18 },
    { email: "rocio.mena@example.com", name: "Rocío Mena", status: "CONFIRMED", source: "FREEBIE", d: 9 },
    { email: "elena.prieto@example.com", name: "Elena Prieto", status: "CONFIRMED", source: "FORM", d: 4 },
    { email: "sara.molina@example.com", name: "Sara", status: "PENDING", source: "FORM", d: 1 },
    { email: "beatriz.luna@example.com", name: "Beatriz", status: "UNSUBSCRIBED", source: "FORM", d: 45, via: "LINK" },
    { email: "alba.ruiz@example.com", name: "Alba Ruiz", status: "UNSUBSCRIBED", source: "IMPORT", d: 60, via: "ONE_CLICK" },
    { email: "rebote.antiguo@example.com", name: null, status: "BOUNCED", source: "IMPORT", d: 60, via: "BOUNCE" },
  ];
  const subs: Record<string, string> = {};
  for (const e of extra) {
    const at = daysAgo(e.d, 11, 20);
    const imported = e.source === "IMPORT";
    const row = await prisma.subscriber.create({
      data: {
        creatorId: anaId, email: e.email, name: e.name, status: e.status, source: e.source,
        consentAt: imported ? daysAgo(400) : at,
        consentText: imported ? "Confirmo que estas personas aceptaron recibir mi newsletter y puedo demostrarlo." : consent,
        consentMeta: imported ? { form: "import", file: "suscriptoras-mailerlite.csv", declaredBy: "ana@cirella.app" } : { form: e.source === "FREEBIE" ? "freebie" : "portada" },
        sourceRef: imported ? "suscriptoras-mailerlite.csv" : null,
        confirmSentAt: e.status === "PENDING" ? at : null,
        confirmedAt: e.status === "PENDING" ? null : imported ? at : new Date(at.getTime() + 6 * 60_000),
        unsubscribedAt: e.via ? daysAgo(e.via === "LINK" ? 11 : 30) : null,
        unsubscribeVia: e.via ?? null,
        createdAt: at,
      },
    });
    subs[e.email] = row.id;
  }

  const base = appUrl();
  const header = await storeEmailImage(anaId, await sharp(readFileSync(path.join("public", "/demo/hero.webp"))).jpeg().toBuffer());
  const footerFor = (id: string | null, campaignId?: string) => ({
    senderName: "Cirella", legalName: ana.legalName, legalAddress: formatLegalAddress(ana) || null, legalEmail: ana.legalEmail,
    legalUrl: `${base}/${ana.username}/legal`, unsubscribeUrl: id ? unsubscribeUrl(id, campaignId) : null,
  });
  // Editor visual: portada con foto de fondo, destacado, vídeo con su portada (▶ dibujado) y botón
  // bonito, con el estilo «Luna llena». El vídeo es el de bienvenida de su página si se subió (con
  // ffmpeg); si no, un enlace de YouTube.
  const cover = await storeVideoCover(anaId, readFileSync(path.join("public", "/demo/curso.webp")));
  const pageVideo = ((ana.pageDraft as unknown as PageConfig).blocks ?? []).find((b) => b.kind === "video" && b.upload);
  const videoSrc = pageVideo && pageVideo.kind === "video" && pageVideo.upload ? pageVideo.upload.src : "";
  const video = { t: "video", url: videoSrc ? "" : "https://youtu.be/dQw4w9WgXcQ", src: videoSrc, cover: cover.url, title: "Mira la meditación de luna llena", caption: "Dura 8 minutos" };
  const lunaStyle = { bg: "#14163A", content: "#FFFFFF", text: "#3B3950", heading: "#14163A", link: "#4B3FA0", accent: "#4B3FA0", headingFont: "cormorant", bodyFont: "georgia", radius: "l", width: 600 };
  const sentDesign = {
    v: 1,
    style: lunaStyle,
    blocks: [
      { id: "portada", t: "hero", image: header.url, alt: "Luna llena sobre el mar", overlay: "#14163A", opacity: 45, title: "Luna llena en Tauro", subtitle: "Lo que trae esta luna y un ejercicio de 10 minutos", color: "#F3ECDD", align: "center", height: "l" },
      { id: "hola", t: "title", text: "Hola, {nombre}", align: "left", size: "l" },
      { id: "texto", t: "text", body: "Esta luna llena cae en **Tauro** y nos pide ==bajar el ritmo==: cuerpo, casa, lo que de verdad nos sostiene.", highlight: "#FCEFB4" },
      { id: "preguntas", t: "spotlight", icon: "🌕", title: "Tres preguntas para escribir esta semana", body: "- ¿Qué necesito para sentirme a salvo?\n- ¿Qué estoy sosteniendo por costumbre?\n- ¿Qué quiero soltar antes de la luna nueva?", bg: "#F1EEFB", accent: "#4B3FA0", border: "left" },
      { id: "video", ...video },
      { id: "estrellas", t: "divider", style: "stars", color: "#C8A86E" },
      { id: "boton", t: "button", label: "Reservar mi lectura", href: anaProduct("sessions", "human-design-reading"), align: "center", style: "pill", bg: "#14163A", color: "#F3ECDD" },
      { id: "firma", t: "text", body: "Un abrazo,\n{mi_nombre}", align: "center" },
    ],
  };
  const sentAt = daysAgo(12, 10, 0);
  const sent = await prisma.campaign.create({
    data: {
      creatorId: anaId, subject: "La luna llena de octubre (y 3 preguntas para escribir)", preheader: "Lo que trae esta luna y un ejercicio de 10 minutos",
      design: sentDesign, segment: { kind: "all" }, status: "SENT", startedAt: sentAt, finishedAt: new Date(sentAt.getTime() + 20 * 60_000), createdAt: daysAgo(14), updatedAt: sentAt,
    },
  });
  // Quien estaba confirmada entonces (más Beatriz, que se dio de baja desde esta newsletter, y el rebote).
  const all = await prisma.subscriber.findMany({ where: { creatorId: anaId, OR: [{ status: "CONFIRMED", createdAt: { lt: sentAt } }, { email: { in: ["beatriz.luna@example.com", "rebote.antiguo@example.com"] } }] } });
  let n = 0;
  for (const s of all) {
    const bounced = s.email === "rebote.antiguo@example.com";
    const mail = campaignEmail({ brand: "Cirella", subject: sent.subject, preheader: sent.preheader, design: sentDesign as never, baseUrl: base, vars: { nombre: s.name?.split(" ")[0] ?? null, mi_nombre: "Cirella" }, footer: footerFor(s.id, sent.id) });
    const at = new Date(sentAt.getTime() + n++ * 60_000);
    const msg = await prisma.emailMessage.create({
      data: {
        creatorId: anaId, to: s.email, subject: mail.subject, html: mail.html, template: "NEWSLETTER", stream: "news", campaignId: sent.id,
        status: bounced ? "FAILED" : "SENT", sendAt: at, sentAt: bounced ? null : at, attempts: 1, error: bounced ? "Resend 422: la dirección no existe" : null,
        dedupeKey: `nl:${sent.id}:${s.id}`, headers: unsubscribeHeaders(s.id, sent.id), fromName: "Cirella", replyTo: "ana@cirella.app",
        deliveredAt: bounced ? null : new Date(at.getTime() + 4000), bouncedAt: bounced ? new Date(at.getTime() + 5000) : null, createdAt: at,
      },
    });
    await prisma.campaignRecipient.create({ data: { creatorId: anaId, campaignId: sent.id, subscriberId: s.id, status: "QUEUED", emailMessageId: msg.id, createdAt: sentAt } });
  }
  await prisma.campaign.update({ where: { id: sent.id }, data: { recipientsCount: all.length } });
  await prisma.subscriber.update({ where: { id: subs["beatriz.luna@example.com"] }, data: { unsubscribeCampaignId: sent.id } });
  await prisma.subscriber.update({ where: { id: subs["rebote.antiguo@example.com"] }, data: { unsubscribeCampaignId: sent.id, unsubscribedAt: new Date(sentAt.getTime() + 60_000) } });

  await prisma.campaign.create({
    data: {
      creatorId: anaId, subject: "Novedades de noviembre", preheader: "", segment: { kind: "all" }, createdAt: daysAgo(2), updatedAt: daysAgo(1),
      design: {
        v: 1,
        style: { ...lunaStyle, bg: "#F4F1EA", heading: "#2B2160", headingFont: "playfair", bodyFont: "helvetica", radius: "m" },
        blocks: [
          { id: "portada", t: "hero", image: "", alt: "", overlay: "#2B2160", opacity: 0, title: "Novedades de noviembre", subtitle: "Eclipse, lecturas nuevas y un regalo", color: "#F3ECDD", align: "center", height: "s" },
          { id: "hola", t: "title", text: "Hola, {nombre}", align: "left" },
          { id: "texto", t: "text", body: "Noviembre viene con eclipse y con plazas nuevas para las lecturas.\n\n(Borrador: terminar el jueves)", band: "#F1EEFB", bandPad: "m", bandRound: true },
          { id: "eclipse", t: "spotlight", icon: "📅", title: "Eclipse del 7 de noviembre", body: "Te cuento cómo vivirlo según tu signo en el directo del jueves.", bg: "#FBF3E4", accent: "#C8A86E", border: "box" },
          { id: "video", ...video, title: "Así preparo tus lecturas" },
          { id: "boton", t: "button", label: "Ver las lecturas", href: ANA_HOME, align: "center", style: "filled", full: true, bg: "#2B2160" },
        ],
      },
    },
  });
  await prisma.campaign.create({
    data: {
      creatorId: anaId, subject: "Taller de luna nueva: plazas abiertas", preheader: "Solo para quien se apuntó a los talleres",
      segment: { kind: "tag", tag: "talleres" }, status: "SCHEDULED", scheduledAt: zonedTimeToUtc(addDaysToKey(TODAY, 3), 10 * 60, TZ), createdAt: daysAgo(3), updatedAt: daysAgo(1),
      design: {
        v: 1,
        blocks: [
          { id: "hola", t: "title", text: "¡Hola, {nombre}!", align: "left" },
          { id: "texto", t: "text", body: "Abro las plazas del **taller de luna nueva** del mes que viene. Somos pocas, como siempre, para poder escucharnos." },
          { id: "boton", t: "button", label: "Ver el taller", href: anaProduct("sessions", await prisma.product.findUniqueOrThrow({ where: { id: o.circleId } }).then((p) => p.slug)), align: "center" },
        ],
      },
    },
  });
  // Su confirmación de reserva con un texto propio al principio (lo demás sale como siempre).
  await prisma.automation.upsert({
    where: { creatorId_trigger: { creatorId: anaId, trigger: "BOOKING_CONFIRMED" } },
    create: {
      creatorId: anaId, trigger: "BOOKING_CONFIRMED", enabled: true,
      design: { v: 1, blocks: [{ id: "intro", t: "text", body: "¡Qué ilusión, {nombre}! Antes de la sesión busca un rato tranquilo y ten a mano tu **fecha, hora y lugar de nacimiento**." }] },
    },
    update: {},
  });
  void o.astroId;
}

type SeedProduct = { id: string; slug: string; title: string; priceCents: number };

/**
 * La portada nueva de Cirella (lib/page-config.ts): cursos por método (/courses) con uno nuevo en oferta
 * Early Bird, una lectura que prepara ella en oferta, los círculos de la luna (talleres en las próximas
 * luna nueva y luna llena, lib/astro-calendar.ts), publicaciones de cada nivel de la comunidad, las
 * páginas de cada sistema, actualidades con vídeo y audio, el Portal de Noticias y los accesos, la
 * tarjeta «Sobre mí», los sistemas y las lecturas de su portada.
 */
async function seedAnaPortada(o: {
  anaId: string;
  course: SeedProduct;
  freeCourse: SeedProduct;
  esencia: SeedProduct;
  plena: SeedProduct;
  lunaCompleta: SeedProduct;
}) {
  const anaId = o.anaId;
  // ── Cursos por método ──
  await prisma.product.update({ where: { id: o.course.id }, data: { courseCategory: "MI_ENERGIA" } });
  await prisma.product.update({ where: { id: o.freeCourse.id }, data: { courseCategory: "ASTROLOGIA" } });
  const saleEnd = (days: number) => zonedTimeToUtc(addDaysToKey(TODAY, days), 0, TZ);
  const hd = await prisma.product.create({
    data: {
      creatorId: anaId, type: "COURSE", status: "PUBLISHED", slug: "human-design-basics", title: "Human Design desde cero", emoji: "🧬", courseCategory: "HUMAN_DESIGN",
      summary: "Tu tipo, tu estrategia y tu autoridad, paso a paso y con ejemplos.",
      description: "Un curso corto para entender tu bodygraph sin perderte.\n\nIncluye:\n• 2 módulos en lectura y audio\n• Ejercicios para tu día a día\n• Acceso de por vida",
      imageUrl: await demoImage(anaId, "/demo/human-design.webp"), priceCents: 9900, ctaLabel: "Ver curso", sortOrder: 11, createdAt: daysAgo(6),
      // Early Bird (lib/offers.ts): 69 € hasta dentro de dos semanas.
      salePriceCents: 6900, saleLabel: "Early Bird", saleEndsAt: saleEnd(14),
    },
  });
  const hdModule = await prisma.courseModule.create({ data: { creatorId: anaId, productId: hd.id, title: "Tu diseño", sortOrder: 0 } });
  await seedLesson({ creatorId: anaId, productId: hd.id, moduleId: hdModule.id, sortOrder: 0, title: "Qué es tu bodygraph", durationMin: 12, parts: [{ text: "Tu bodygraph es el mapa de cómo funciona tu energía. Hoy aprendes a leer sus **nueve centros**.", format: "MD" }] });
  await seedLesson({ creatorId: anaId, productId: hd.id, moduleId: hdModule.id, sortOrder: 1, title: "Tu estrategia", durationMin: 15, parts: [{ text: "Cada tipo tiene una estrategia para decidir con menos resistencia. Busca la tuya y pruébala una semana." }] });
  await prisma.product.create({
    data: {
      creatorId: anaId, type: "COURSE", status: "PUBLISHED", accessMode: "PAID", slug: "gene-keys-activation", title: "Gene Keys: tu Secuencia de Activación", emoji: "🔑", courseCategory: "GENE_KEYS",
      summary: "Ocho semanas para contemplar tus cuatro llaves principales.",
      description: "Pídelo con el formulario y te cuento por email cómo empezar.",
      imageUrl: await demoImage(anaId, "/demo/gene-keys.webp"), priceCents: 12900, sortOrder: 12, createdAt: daysAgo(30),
    },
  });
  const special = await prisma.product.create({
    data: {
      creatorId: anaId, type: "COURSE", status: "PUBLISHED", accessMode: "PAID", slug: "lunar-year", title: "Especial: tu año lunar", emoji: "🌙", courseCategory: "ESPECIAL",
      summary: "Un pequeño especial para preparar las trece lunas del año que viene.",
      description: "Un especial para cerrar el año: dos lecciones para preparar tus intenciones luna a luna.",
      imageUrl: await demoImage(anaId, "/demo/comunidad.webp"), priceCents: 2900, ctaLabel: "Quiero el especial", sortOrder: 13, createdAt: daysAgo(4),
    },
  });
  const spModule = await prisma.courseModule.create({ data: { creatorId: anaId, productId: special.id, title: "Tu año lunar", sortOrder: 0 } });
  await seedLesson({ creatorId: anaId, productId: special.id, moduleId: spModule.id, sortOrder: 0, title: "Las trece lunas", durationMin: 8, parts: [{ text: "Apunta en tu calendario las lunas nuevas del año: cada una es un pequeño comienzo." }] });
  await seedLesson({ creatorId: anaId, productId: special.id, moduleId: spModule.id, sortOrder: 1, title: "Tus intenciones", durationMin: 10, parts: [{ text: "Escribe una intención para cada luna nueva y léela en voz alta la noche de la luna." }] });
  // Cursos de dos temas (lib/course-categories.ts: «A+B»): van debajo de Especiales en /courses, cada
  // combinación en su grupo con los dos iconos. El primero sale también en la portada (sortOrder 8).
  await seedComboCourses(anaId);

  // ── Una lectura que prepara ella (lib/channel-kind.ts), en oferta ──
  const yearReading = await prisma.product.create({
    data: {
      creatorId: anaId, type: "DIGITAL", status: "PUBLISHED", deliveryMode: "PERSONAL", slug: "year-reading", title: "Lectura de tu año", emoji: "☀️",
      summary: "Tu revolución solar grabada en audio y en PDF, para empezar tu año con un plan.",
      description: "Te preparo la lectura de tu año (de cumpleaños a cumpleaños) y te llega a tu área en audio y en PDF.\n\nIncluye:\n• Audio de unos 40 minutos\n• Resumen en PDF con los meses clave",
      instructions: "Después de pagar, escribe tu fecha, hora y lugar de nacimiento. En 7 días tendrás tu lectura en tu área.",
      imageUrl: await demoImage(anaId, "/demo/astrologia.webp"), priceCents: 9000, ctaLabel: "Quiero mi lectura", sortOrder: 14, createdAt: daysAgo(8),
      salePriceCents: 7200, saleEndsAt: saleEnd(10),
    },
  });

  // ── Círculos de la luna: talleres en las dos próximas lunas nuevas y llenas (20:00, Madrid); así, cuando pasa una, sigue la siguiente ──
  const moons = nextMoonDates(NOW, TZ, 6).filter((m) => zonedTimeToUtc(m.date, labelToMinutes(m.time), TZ).getTime() > NOW.getTime() + 3 * 3600_000).slice(0, 4);
  const circles: { id: string; slug: string; title: string; at: Date }[] = [];
  for (const [i, m] of moons.entries()) {
    const at = zonedTimeToUtc(m.date, labelToMinutes(m.time), TZ);
    const c = await prisma.product.create({
      data: {
        creatorId: anaId, type: "SESSION", status: "PUBLISHED", groupSession: true, moonCircle: true, slug: `${m.phase === "new" ? "new-moon" : "full-moon"}-${m.date}`,
        title: `Círculo de ${m.title.toLowerCase()}`, emoji: m.phase === "new" ? "🌑" : "🌕",
        summary: "Un círculo en directo por Zoom para vivir esta luna juntas. Sin ser miembro.",
        description: "Nos juntamos por Zoom para un ritual guiado, un rato de escritura y una ronda para compartir.\n\nIncluye:\n• Una hora en directo\n• La grabación en tu área",
        imageUrl: await demoImage(anaId, "/demo/comunidad.webp"), priceCents: 2200, ctaLabel: "Apuntarme", sortOrder: 20 + i,
        durationMin: 60, bufferMin: 15, minNoticeHours: 0, meetingUrl: ANA_ZOOM, eventStartAt: at, capacity: 20, createdAt: daysAgo(3),
      },
    });
    circles.push({ id: c.id, slug: c.slug, title: c.title, at });
  }

  // ── Publicaciones de cada nivel de la comunidad ──
  const seen = (d: Date) => ({ notify: false, notifiedAt: d });
  const post = (productId: string, d: number, title: string, kind: string, body: string, extra: Partial<{ eventAt: Date; mediaUrl: string }> = {}) =>
    prisma.membershipPost.create({ data: { creatorId: anaId, productId, title, kind, body, bodyFormat: "MD", publishedAt: daysAgo(d, 9), ...seen(daysAgo(d, 9)), ...extra } });
  await post(o.esencia.id, 2, "Texto energético de la semana: soltar el control", "TEXT", "Esta semana la Luna nos pide **soltar el control** de lo que no depende de nosotras. Escribe tres cosas que puedes dejar en manos del tiempo.");
  await post(o.esencia.id, 9, "Texto energético: la energía de Escorpio", "TEXT", "El Sol entra en Escorpio: es momento de mirar hacia dentro, sin prisa y con honestidad.");
  const ceremonyAt = zonedTimeToUtc(addDaysToKey(TODAY, 9), 19 * 60, TZ);
  await post(o.plena.id, 1, "Ceremonia de cacao de noviembre", "CEREMONIA", "Prepara tu taza de cacao y un rincón tranquilo: abrimos el mes juntas con intención.", { eventAt: ceremonyAt, mediaUrl: ANA_ZOOM });
  await post(o.plena.id, 4, "Podcast privado · Episodio 7: los ciclos del cuerpo", "PODCAST", "Hablamos de cómo los ciclos de la Luna y los del cuerpo se acompañan. Escúchalo con calma.");
  await post(o.plena.id, 6, "Meditación para el cambio de estación", "MEDITACION", "Diez minutos para despedir el verano y abrir el otoño con suavidad.");
  await post(o.plena.id, 11, "Masterclass en directo: preguntas sobre tu carta", "MASTERCLASS", "Traed vuestras preguntas sobre la carta natal: las respondemos en directo y queda la grabación.", { eventAt: zonedTimeToUtc(addDaysToKey(TODAY, 6), 18 * 60, TZ), mediaUrl: ANA_ZOOM });
  if (moons[0])
    await post(o.lunaCompleta.id, 0, `Círculo de ${moons[0].title.toLowerCase()}`, "CIRCULO_LUNAR", "Nos vemos en el círculo para vivir esta luna juntas. Trae papel, una vela y tu intención.", { eventAt: zonedTimeToUtc(moons[0].date, labelToMinutes(moons[0].time), TZ), mediaUrl: ANA_ZOOM });

  // ── Barajas: el «Oráculo de la Luna» de serie, copiado a la BD para que se pueda editar en la demo ──
  // (los mismos textos y, sin imagen, el mismo dibujo de cada carta; el código lo sigue teniendo de serie).
  const oracleDeck = await seedAnaOracleDeck(anaId);

  // Una segunda baraja publicada, para «Más barajas» (solo suscriptoras) en «Mi energía».
  await seedAnaElementsDeck(anaId);

  // ── Páginas de cada sistema (Sistemas con los que trabajo): explicación, modelo en versión rápida y burbujas ──
  const systemCards = [];
  for (const [i, sys] of ANA_SYSTEMS.entries()) {
    const explain: ContentBlock[] = await Promise.all(
      sys.explain.map(async (e): Promise<ContentBlock> =>
        e.photo
          ? { id: e.id, kind: "photoText", title: e.title, body: e.body, format: "MD", imageSide: e.side ?? "left", image: await demoBlockImage(anaId, e.photo.src, e.photo.alt), enabled: true }
          : { id: e.id, kind: "text", title: e.title, body: e.body, format: "MD", enabled: true },
      ),
    );
    const pills: ContentBlock = { id: "burbujas", kind: "pills", title: sys.slug === "energy" ? "Para llevarlo a tu vida" : `Todo sobre ${sys.slug === "moon" ? "la luna" : sys.title}`, items: sys.pills, enabled: true };
    const blocks: ContentBlock[] =
      sys.slug === "energy"
        ? [...explain, ...anaEnergyBlocks(oracleDeck.id), pills]
        : [
            ...explain,
            ...(sys.model ? [{ id: "modelo", kind: "model" as const, model: sys.model.kind, title: sys.model.title, intro: sys.model.intro, figure: "enneagram" as const, quick: true, enabled: true }] : []),
            pills,
            // La Luna termina con los dos próximos círculos (se eligen solos al pintar la página).
            ...(sys.slug === "moon" ? [{ id: "circulos", kind: "moonCircles" as const, title: "Los próximos círculos", enabled: true }] : []),
          ];
    const content: SitePageContent = {
      title: sys.pageTitle,
      subtitle: sys.intro,
      cover: null,
      blocks,
      seoTitle: `${sys.title} · Cirella`,
      seoDescription: sys.slug === "energy" ? "Cinco principios y un ensayo sobre la confianza en lo que todavía no es visible." : sys.text,
    };
    const json = content as unknown as Prisma.InputJsonValue;
    await prisma.sitePage.create({
      data: { creatorId: anaId, slug: sys.slug, title: sys.title, publishedTitle: sys.title, draft: json, published: json, status: "PUBLISHED", publishedAt: daysAgo(20), showInNav: false, sortOrder: 10 + i, createdAt: daysAgo(21) },
    });
    systemCards.push({ id: `s-${sys.slug}`, title: sys.title, text: sys.text, url: anaPage(sys.slug), image: await demoImage(anaId, sys.img) });
  }

  // ── Actualidades con vídeo y con audio ──
  const poster = await demoImage(anaId, "/demo/hero.webp");
  const videoData = makeVideo(path.resolve("public/demo/hero.webp"), 6);
  let media: Prisma.InputJsonValue | undefined;
  if (videoData) {
    const file = `${randomBytes(12).toString("hex")}.mp4`;
    await storage().put(`public/video/${anaId}/${file}`, videoData, { contentType: "video/mp4" });
    const info = await mediaFields(videoData, "video/mp4");
    media = { kind: "VIDEO", src: pageVideoUrl(anaId, file), poster, width: info.width, height: info.height, durationSec: info.durationSec };
  } else media = { kind: "VIDEO", embedUrl: "https://youtu.be/dQw4w9WgXcQ" };
  const audioData = makeM4a(20);
  const audioFile = `${randomBytes(12).toString("hex")}.${audioData ? "m4a" : "wav"}`;
  await storage().put(`public/video/${anaId}/${audioFile}`, audioData ?? makeWav(20), { contentType: audioData ? "audio/mp4" : "audio/wav" });
  await prisma.post.create({
    data: {
      creatorId: anaId, slug: "full-moon-letting-go", status: "PUBLISHED", publishedAt: daysAgo(1, 10), createdAt: daysAgo(1, 10),
      title: "Luna llena: qué soltar", excerpt: "Un vídeo corto para esta luna y el curso de Human Design con código.",
      body: "Esta luna llena nos invita a **soltar** lo que ya no sostenemos. Te dejo un vídeo corto con un ejercicio de cinco minutos.", bodyFormat: "MD",
      imageUrl: poster, mediaKind: "VIDEO", media, ctaLabel: "Ver curso", ctaUrl: anaProduct("courses", hd.slug),
    },
  });
  await prisma.post.create({
    data: {
      creatorId: anaId, slug: "new-gene-keys-reading", status: "PUBLISHED", publishedAt: daysAgo(40, 18), createdAt: daysAgo(40, 18),
      title: "Nueva lectura de Gene Keys", excerpt: "Escucha cómo es por dentro.",
      body: "He preparado un audio para que escuches cómo es una lectura de Gene Keys por dentro.", bodyFormat: "MD",
      imageUrl: await demoImage(anaId, "/demo/gene-keys.webp"), mediaKind: "AUDIO", media: { kind: "AUDIO", src: pageVideoUrl(anaId, audioFile), durationSec: 20 },
      ctaLabel: "Ver lectura", ctaUrl: anaProduct("readings", yearReading.slug),
    },
  });

  // ── Portal de Noticias (archivos privados) ──
  const portalVideo = makeVideo(path.resolve("public/demo/comunidad.webp"), 6);
  const ritual = portalVideo ? await storePrivate(anaId, `${randomBytes(8).toString("hex")}.mp4`, portalVideo) : await storePrivate(anaId, `${randomBytes(8).toString("hex")}.wav`, makeWav(12));
  const ritualMedia = portalVideo
    ? { key: ritual.storageKey, kind: "VIDEO", mime: "video/mp4", name: "Ritual de luna nueva.mp4", sizeBytes: ritual.sizeBytes, ...(await mediaFields(portalVideo, "video/mp4").then((f) => ({ width: f.width, height: f.height, durationSec: f.durationSec }))) }
    : { key: ritual.storageKey, kind: "AUDIO", mime: "audio/wav", name: "Ritual de luna nueva.wav", sizeBytes: ritual.sizeBytes };
  const altar = await storePrivate(anaId, `${randomBytes(8).toString("hex")}.png`, await sharp(path.resolve("public/demo/sesion.webp")).resize(900).png().toBuffer());
  const liveAt = zonedTimeToUtc(addDaysToKey(TODAY, 5), 19 * 60, TZ);
  await prisma.portalItem.createMany({
    data: [
      {
        creatorId: anaId, kind: portalVideo ? "VIDEO" : "AUDIO", title: "Ritual de luna nueva", summary: "Un ritual guiado de 15 minutos para sembrar tus intenciones.",
        body: "Enciende una vela, respira y sigue el vídeo. Al terminar, escribe tres intenciones en presente.", coverUrl: await demoImage(anaId, "/demo/comunidad.webp"),
        media: [ritualMedia], featured: true, sortOrder: 0, status: "PUBLISHED", createdAt: daysAgo(2),
      },
      {
        creatorId: anaId, kind: "EARLY_BIRD", title: "Curso Human Design −30 %", summary: "Precio Early Bird solo para suscriptoras, hasta que se acabe la oferta.",
        body: "Te dejo el curso de Human Design con el precio Early Bird antes de que lo anuncie en redes.", linkUrl: anaProduct("courses", hd.slug), linkLabel: "Ver el curso",
        coverUrl: await demoImage(anaId, "/demo/human-design.webp"), sortOrder: 1, status: "PUBLISHED", createdAt: daysAgo(3),
      },
      {
        creatorId: anaId, kind: "LIVE", title: "Live: tránsitos de noviembre", summary: "El enlace de Zoom llega al suscribirte.",
        body: "Repasamos juntas los tránsitos del mes y respondo vuestras preguntas.", linkUrl: "https://us02web.zoom.us/j/89990001111?pwd=PortalCirella", linkLabel: "Entrar al directo",
        eventAt: liveAt, sortOrder: 2, status: "PUBLISHED", createdAt: daysAgo(1),
      },
      {
        creatorId: anaId, kind: "PHOTOS", title: "Mi altar de luna llena", summary: "Fotos de cómo preparo mi altar.",
        media: [{ key: altar.storageKey, kind: "IMAGE", mime: "image/png", name: "Altar.png", sizeBytes: altar.sizeBytes }],
        coverUrl: await demoImage(anaId, "/demo/sesion.webp"), sortOrder: 3, status: "PUBLISHED", createdAt: daysAgo(5),
      },
    ],
  });

  // ── Portada: accesos, «Sobre mí», sistemas y lecturas ──
  const c = await prisma.creator.findUniqueOrThrow({ where: { id: anaId }, select: { pageDraft: true } });
  const page = c.pageDraft as unknown as PageConfig;
  const next: PageConfig = {
    ...page,
    bubbles: [
      // «1:1»: el acompañamiento individual contado como un camino (app/[username]/1on1).
      { id: "b-uno-a-uno", label: "1:1", url: anaSection("1on1"), image: await demoImage(anaId, "/demo/ana-avatar.webp") },
      { id: "b-cursos", label: "Cursos", url: anaSection("courses"), image: await demoImage(anaId, "/demo/curso.webp") },
      { id: "b-comunidad", label: "Hacerte miembro", url: anaSection("membership"), image: await demoImage(anaId, "/demo/comunidad.webp") },
    ],
    about: {
      eyebrow: "Sobre mí", title: "Hola, soy Cirella",
      text: "Llegué a la astrología buscando respuestas para mí. Hoy acompaño a otras mujeres a encontrar las suyas.",
      url: anaPage("aboutme"), image: await demoImage(anaId, "/demo/ana-cover.webp"), linkLabel: "Conoce mi historia",
    },
    systems: systemCards,
    readings: { reading: { ...READINGS_DEFAULTS.reading }, session: { ...READINGS_DEFAULTS.session }, circlesTitle: READINGS_DEFAULTS.circlesTitle },
  };
  const json = next as unknown as Prisma.InputJsonValue;
  await prisma.creator.update({ where: { id: anaId }, data: { pageDraft: json, pagePublished: json } });
  return { hd, special, yearReading, circles };
}

async function reset() {
  // Los archivos subidos pertenecen a los registros que vamos a borrar. Solo en disco: un bucket
  // de R2 de pruebas se vacía a mano (el seed nunca borra en la nube).
  if (storage().name === "local")
    for (const dir of ["private", "public", "incoming"]) rmSync(path.join(STORAGE, dir), { recursive: true, force: true });
  // Orden inverso de dependencias (claves foráneas de Postgres)
  await prisma.$transaction([
    prisma.campaignRecipient.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.subscriber.deleteMany(),
    prisma.emailMessage.deleteMany(),
    prisma.outboxEvent.deleteMany(),
    prisma.paymentEvent.deleteMany(),
    prisma.rateLimit.deleteMany(),
    prisma.jobLock.deleteMany(),
    prisma.analyticsSalt.deleteMany(),
    prisma.analyticsEvent.deleteMany(),
    prisma.lessonProgress.deleteMany(),
    prisma.access.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.orderLink.deleteMany(),
    prisma.session.deleteMany(),
    prisma.order.deleteMany(),
    prisma.legalSnapshot.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.lessonPart.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.courseModule.deleteMany(),
    prisma.membershipPostLike.deleteMany(),
    prisma.membershipPostView.deleteMany(),
    prisma.membershipComment.deleteMany(),
    prisma.productInclusion.deleteMany(),
    prisma.membershipPost.deleteMany(),
    prisma.productFile.deleteMany(),
    prisma.product.deleteMany(),
    prisma.automation.deleteMany(),
    prisma.recoveryOptOut.deleteMany(),
    prisma.post.deleteMany(),
    prisma.discountCode.deleteMany(),
    prisma.sitePage.deleteMany(),
    prisma.availabilityRule.deleteMany(),
    prisma.blockedDate.deleteMany(),
    prisma.availabilityOverride.deleteMany(),
    prisma.calendarNote.deleteMany(),
    prisma.referral.deleteMany(),
    prisma.creator.deleteMany(),
    prisma.loginToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.category.deleteMany(),
    prisma.platformSetting.deleteMany(),
  ]);
}

async function main() {
  await assertSafeToSeed(prisma);
  console.log("🌙 Sembrando datos de demostración…");
  await reset();
  // Marca de «BD creada por el seed»: permite volver a sembrarla sin que la protección lo impida.
  // `today` es el día del que parten las fechas de la demo (las pruebas e2e las calculan con él).
  await prisma.platformSetting.create({ data: { key: DEMO_MARKER_KEY, value: { seededAt: new Date().toISOString(), today: TODAY } } });
  // Identidad legal de la plataforma de demostración (/legal-notice, /privacy, /terms).
  await prisma.platformSetting.createMany({
    data: Object.entries({
      legalCompanyName: "Cirella Demo S.L.",
      legalTaxId: "B12345674",
      legalAddress: "Calle de Alcalá 100, 28009 Madrid (España)",
      legalRegistry: "Registro Mercantil de Madrid, tomo 0000, folio 0, hoja M-000000 (datos de demostración)",
      privacyEmail: "privacidad@cirella.app",
    }).map(([key, value]) => ({ key, value })),
  });
  const password = await bcrypt.hash("demo1234", 10);

  // ───────────── Plataforma ─────────────
  const { plans: { free, creator: creatorPlan, pro }, categories: cat } = await ensureBaseData(prisma);

  // ───────────── Usuarios ─────────────
  await prisma.user.create({ data: { email: "admin@cirella.app", name: "Equipo Cirella", passwordHash: password, isAdmin: true, emailVerifiedAt: daysAgo(90) } });
  const anaUser = await prisma.user.create({ data: { email: "ana@cirella.app", name: "Cirella", passwordHash: password, createdAt: daysAgo(75), emailVerifiedAt: daysAgo(75) } });
  const mariaUser = await prisma.user.create({ data: { email: "maria@cirella.app", name: "María Sol", passwordHash: password, createdAt: daysAgo(48), emailVerifiedAt: daysAgo(48) } });
  const sofiaUser = await prisma.user.create({ data: { email: "sofia@cirella.app", name: "Sofía Vidal", passwordHash: password, createdAt: daysAgo(9), emailVerifiedAt: daysAgo(9) } });
  const laura = await prisma.user.create({ data: { email: "laura@example.com", name: "Laura Martín", passwordHash: password, createdAt: daysAgo(20), emailVerifiedAt: daysAgo(20) } });
  const carmen = await prisma.user.create({ data: { email: "carmen@example.com", name: "Carmen Ruiz", createdAt: daysAgo(Math.max(8, CARMEN_11_DAYS_AGO), 13, 0) } });
  const lucia = await prisma.user.create({ data: { email: "lucia@example.com", name: "Lucía Torres", createdAt: daysAgo(LUCIA_HD_DAYS_AGO, 20, 0) } });

  // ───────────── Cirella (Pro · Mystical) ─────────────
  const anaPage: PageConfig = {
    displayName: "Cirella",
    tagline: "Astrología · Human Design · Gene Keys",
    headline: "Conócete. Compréndete. Transfórmate.",
    bio: "Acompaño a mujeres a leer su mapa energético para tomar decisiones alineadas con quienes realmente son. Más de 1.200 lecturas y 8 años estudiando el cielo.",
    // storePageImages las procesa como una subida real (WebP con variantes en /media/…).
    avatarUrl: "/demo/ana-avatar.webp",
    coverUrl: "/demo/ana-cover.webp",
    theme: {},
    template: "custom",
    pageThemes: {},
    pieces: {},
    designs: [],
    // La portada nueva (lib/page-config.ts → SECTION_KEYS): accesos, actualidades, portal, ofertas,
    // sobre mí, sistemas, lecturas y sesiones, cursos y códigos. Las listas de productos de siempre
    // (lecturas, sesiones, comunidad) quedan ocultas: sus productos salen en sus páginas.
    sections: defaultSections().map((s) => ({
      ...s,
      enabled: s.enabled && !["products", "sessions", "memberships"].includes(s.key),
      title: { products: "Lecturas", sessions: "Sesiones privadas", courses: "Cursos", memberships: "Comunidad" }[s.key as string],
    })),
    // «Botones principales»: la sección sigue en el editor, pero la demo ya no trae ninguno.
    links: [],
    socials: { instagram: "cirella", tiktok: "cirella", telegram: "cirella", youtube: "cirella" },
    testimonials: [
      { id: "t1", author: "Laura M.", role: "Proyectora 2/4", quote: "Mi lectura de Human Design me dio permiso para descansar sin culpa. Fue como si alguien me explicara mi propio manual de instrucciones." },
      { id: "t2", author: "Carmen R.", role: "Sol en Escorpio", quote: "Cirella tiene un don para traducir el cielo a decisiones concretas. Salí de la sesión con claridad y un plan." },
      { id: "t3", author: "Lucía T.", role: "Miembro del Círculo", quote: "El círculo lunar se ha convertido en mi ritual mensual. Contenido precioso y una comunidad muy cuidada." },
    ],
    faqs: [
      { id: "f1", q: "¿Necesito saber mi hora de nacimiento?", a: "Sí, para las lecturas de astrología y Human Design la hora exacta es importante. Si no la conoces, escríbeme y buscamos alternativas." },
      { id: "f2", q: "¿Cómo recibo mi lectura?", a: "Los productos digitales están disponibles al instante en tu cuenta. Las sesiones se hacen por videollamada y eliges fecha y hora al reservar." },
      { id: "f3", q: "¿Puedo regalar una lectura?", a: "¡Claro! Compra con tu email y escríbeme con el nombre de la persona: le haré llegar su acceso." },
      { id: "f4", q: "¿Puedo cancelar la membresía?", a: "Cuando quieras, desde tu área de cliente. Mantienes el acceso hasta el final del mes pagado." },
    ],
    contact: { email: "hola@cirella.app", message: "¿Dudas sobre qué lectura es para ti? Escríbeme y te oriento." },
    // Sin bloques en la portada: la sección «Bloques» sigue en el editor, vacía (no pinta nada).
    blocks: [],
    hidePoweredBy: false,
  };
  const ana = await prisma.creator.create({
    data: {
      userId: anaUser.id, username: "ana", displayName: "Cirella", categoryId: cat.astrologia, planId: pro.id,
      planRenewsAt: new Date(NOW.getTime() + 19 * DAY),
      pageDraft: anaPage as unknown as Prisma.InputJsonValue, pagePublished: anaPage as unknown as Prisma.InputJsonValue,
      published: true, publishedAt: daysAgo(70), onboardedAt: daysAgo(74), contactEmail: "ana@cirella.app",
      seoTitle: "Cirella · Astrología, Human Design y Gene Keys",
      seoDescription: "Lecturas de astrología, Human Design y Gene Keys, sesiones 1:1, curso y comunidad privada. Conócete. Compréndete. Transfórmate.",
      payoutProvider: "simulated", payoutAccountId: "sim_acct_ana001", payoutConnectedAt: daysAgo(74),
      payoutStatus: "ACTIVE", payoutChargesEnabled: true, payoutPayoutsEnabled: true, payoutStatusUpdatedAt: daysAgo(74),
      // Identidad legal completa (obligatoria para vender).
      legalName: "Cirella", legalTaxId: "12345678Z", legalAddress: "Calle de la Luna 7, 2.º B", legalPostalCode: "28004",
      legalCity: "Madrid", legalCountry: "ES", legalEmail: "hola@cirella.app",
      termsAcceptedAt: daysAgo(75), termsVersion: PLATFORM_TERMS_VERSION,
      referralCode: "CIRELLA", createdAt: daysAgo(75),
    },
  });

  await storePageImages(ana.id, anaPage);
  await seedAnaSitePages(ana.id);

  // Archivos privados
  const guiaCarta = await storePrivate(ana.id, "guia-carta-natal.pdf", makePdf({
    title: "Guía de tu carta natal", subtitle: "Cómo leer tu Sol, tu Luna y tu Ascendente", author: "Cirella · Astrología",
    sections: [
      { heading: "Bienvenida", body: "Gracias por confiar en mí para acompañarte en la lectura de tu carta natal. Esta guía es el punto de partida: te ayudará a reconocer los elementos básicos de tu mapa y a sacar el máximo partido a tu informe personalizado.\nLa carta natal es una fotografía del cielo en el momento exacto en que naciste. No determina quién eres: describe tus potenciales, tus ritmos y los aprendizajes que se repiten en tu vida." },
      { heading: "El Sol: tu propósito", body: "El Sol indica la energía que vienes a desarrollar y el lugar donde brillas cuando te expresas con autenticidad. Observa el signo y la casa en la que se encuentra: el signo describe el cómo y la casa el dónde.\nPregunta de reflexión: ¿en qué momentos de tu vida te has sentido más viva y reconocida?" },
      { heading: "La Luna: tu mundo emocional", body: "La Luna habla de tus necesidades emocionales, de lo que te hace sentir en casa y de cómo te cuidas. Muchas veces vivimos desde la Luna sin darnos cuenta: es el piloto automático emocional.\nPregunta de reflexión: ¿qué necesitas para sentirte segura cuando todo cambia?" },
      { heading: "El Ascendente: tu puerta de entrada", body: "El Ascendente es el signo que se elevaba por el horizonte cuando naciste. Describe la forma en la que te acercas a la vida, la primera impresión que das y el camino de crecimiento que te propone tu carta." },
      { heading: "Próximos pasos", body: "Responde al email de confirmación con tu fecha, hora y lugar de nacimiento. En un máximo de 72 horas tendrás en tu cuenta tu informe personalizado y el audio explicativo.\nCon cariño, Cirella." },
    ],
  }));
  const geneKeysPdf = await storePrivate(ana.id, "gene-keys-perfil-hologenetico.pdf", makePdf({
    title: "Gene Keys", subtitle: "Tu Perfil Hologenético: sombra, don y siddhi", author: "Cirella · Gene Keys",
    sections: [
      { heading: "Qué son las Gene Keys", body: "Las Gene Keys son un sistema de contemplación basado en los 64 hexagramas del I Ching. Cada llave describe un espectro de consciencia con tres frecuencias: la sombra, el don y el siddhi.\nNo se trata de corregir la sombra, sino de mirarla con amabilidad: en ella está escondido tu mayor regalo." },
      { heading: "La Secuencia de Activación", body: "Las cuatro primeras llaves de tu perfil forman la Secuencia de Activación: Trabajo de vida, Evolución, Radiancia y Propósito. Juntas describen tu genio creativo y el camino para expresarlo." },
      { heading: "Cómo contemplar una llave", body: "Elige una llave y léela despacio. Durante una semana, observa cuándo aparece su sombra en tu día a día. No juzgues: simplemente registra. Poco a poco notarás cómo la frecuencia del don empieza a aparecer de forma natural." },
      { heading: "Ejercicio", body: "1. Escribe tus cuatro llaves principales.\n2. Para cada una, anota una situación reciente en la que reconozcas su sombra.\n3. Imagina cómo habría sido esa misma situación vivida desde el don.\n4. Elige una pequeña acción para esta semana." },
    ],
  }));
  const cuaderno = await storePrivate(ana.id, "cuaderno-de-trabajo.pdf", makePdf({
    title: "Cuaderno de trabajo", subtitle: "Curso · Conócete a través de tu energía", author: "Cirella",
    sections: [
      { heading: "Ejercicio 1 · Dibuja tu mapa", body: "Escribe en el centro de una hoja tu Sol, tu Luna y tu Ascendente. Alrededor, anota tu tipo de Human Design, tu autoridad y tu perfil. Une con líneas los elementos que sientes que hablan de lo mismo." },
      { heading: "Ejercicio 2 · Tu estrategia en acción", body: "Durante siete días, registra cada decisión importante: ¿la tomaste desde tu estrategia y tu autoridad o desde la mente? ¿Qué notaste en el cuerpo?" },
      { heading: "Ejercicio 3 · Tu llave de propósito", body: "Contempla tu Gene Key de Propósito durante una semana. Escribe cada día una frase sobre cómo se ha manifestado." },
    ],
  }));
  const meditacion = await storePrivate(ana.id, "meditacion-integracion.wav", makeWav(40));
  const audioCarta = await storePrivate(ana.id, "audio-introduccion-carta.wav", makeWav(24));
  const videoData = makeVideo(path.resolve("public/demo/curso.webp"));
  const video = videoData ? await storePrivate(ana.id, "bienvenida-curso.mp4", videoData) : null;
  // Como los de la dueña: el segundo vídeo es un .mov (iPhone) y el resumen, un .m4a (Zoom).
  const videoTipos = makeVideo(path.resolve("public/demo/human-design.webp"), 14, "mov");
  const video2 = videoTipos ? await storePrivate(ana.id, "los-5-tipos.mov", videoTipos) : null;
  const resumenData = makeM4a(20);
  const resumen = resumenData ? await storePrivate(ana.id, "resumen-5-tipos.m4a", resumenData) : null;
  // Lámina privada (PNG) para ver con zoom en la lección.
  const laminaData = await sharp(path.resolve("public/demo/human-design.webp")).resize(1200).png().toBuffer();
  const lamina = await storePrivate(ana.id, "los-5-tipos.png", laminaData);
  console.log(video ? "  ✓ vídeos y audio de demo generados con ffmpeg" : "  · ffmpeg no disponible: lecciones de vídeo sin archivo");

  const pAstro = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", deliveryMode: "PERSONAL", slug: "astrology", title: "Lectura de Astrología", emoji: "🌙",
      summary: "Tu carta natal interpretada: Sol, Luna, Ascendente y casas. Guía PDF + audio explicativo.",
      description: "Una lectura escrita y en audio de tu carta natal para entender tus talentos, tus ritmos emocionales y los temas que se repiten en tu vida.\n\nIncluye:\n• Guía de lectura de tu carta natal (PDF)\n• Audio de introducción (25 min)\n• Informe personalizado en 72 h tras enviar tus datos de nacimiento",
      imageUrl: await demoImage(ana.id, "/demo/astrologia.webp"), priceCents: 4900, ctaLabel: "Comprar", sortOrder: 1,
      instructions: "Responde al email de confirmación con tu fecha, hora y lugar de nacimiento para recibir tu informe personalizado.",
      createdAt: daysAgo(70),
    },
  });
  const pHD = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "SESSION", status: "PUBLISHED", slug: "human-design-reading", title: "Lectura de Human Design", emoji: "🧬",
      summary: "75 minutos por videollamada para descubrir tu tipo, estrategia y autoridad.",
      description: "Una sesión en directo para leer juntas tu carta de Human Design (bodygraph) y aterrizarla a tu día a día: trabajo, relaciones y decisiones.\n\nIncluye:\n• Sesión de 75 minutos por videollamada\n• Grabación de la sesión\n• Resumen escrito con tus claves",
      imageUrl: await demoImage(ana.id, "/demo/human-design.webp"), priceCents: 7900, ctaLabel: "Reservar", sortOrder: 2,
      // Se paga en la web: se reserva a partir del día 15 desde la compra (15 días = 360 h).
      durationMin: 75, bufferMin: 15, minNoticeHours: 360, meetingUrl: ANA_ZOOM, horizonDays: 56,
      // Calendario propio: pide los datos de nacimiento (obligatorios) y una pregunta suya.
      intake: { birth: "required", questions: [{ id: "tema", label: "¿Qué te gustaría explorar?", long: true, required: false }] },
      instructions: "Antes de la sesión, envíame tu fecha, hora y lugar de nacimiento.", createdAt: daysAgo(70),
    },
  });
  const pGK = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", deliveryMode: "PERSONAL", slug: "gene-keys", title: "Gene Keys", emoji: "🔑",
      summary: "Guía PDF de tu Perfil Hologenético: sombra, don y siddhi de tus llaves principales.",
      description: "Una guía práctica para empezar a contemplar tu Perfil Hologenético y tu Secuencia de Activación.\n\nIncluye:\n• Guía «Tu Perfil Hologenético» (PDF)\n• Ejercicios de contemplación semanales",
      imageUrl: await demoImage(ana.id, "/demo/gene-keys.webp"), priceCents: 5900, ctaLabel: "Comprar", sortOrder: 3, createdAt: daysAgo(60),
    },
  });
  const pCourse = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "COURSE", status: "PUBLISHED", slug: "know-your-energy", title: "Conócete a través de tu energía", emoji: "✨",
      summary: "Curso online: integra astrología, Human Design y Gene Keys en un mapa práctico para tu vida.",
      description: "Un recorrido a tu ritmo en 3 módulos para unir las tres herramientas en un único mapa de autoconocimiento.\n\nIncluye:\n• 7 lecciones en vídeo, audio y lectura\n• Cuaderno de trabajo descargable\n• Meditación de integración\n• Acceso de por vida",
      imageUrl: await demoImage(ana.id, "/demo/curso.webp"), priceCents: 14900, ctaLabel: "Ver curso", sortOrder: 4, featured: true, createdAt: daysAgo(55),
    },
  });
  const p11 = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "SESSION", status: "PUBLISHED", slug: "one-on-one", title: "Sesión 1:1", emoji: "🔮",
      summary: "Una hora a solas para tu pregunta: tránsitos, decisiones, relaciones o propósito.",
      description: "Una sesión abierta para trabajar el tema que más te importa ahora, combinando astrología, Human Design y Gene Keys.\n\nIncluye:\n• 60 minutos por videollamada\n• Grabación de la sesión",
      imageUrl: await demoImage(ana.id, "/demo/sesion.webp"), priceCents: 12000, ctaLabel: "Reservar", sortOrder: 5,
      durationMin: 60, bufferMin: 15, minNoticeHours: 360, meetingUrl: ANA_ZOOM, createdAt: daysAgo(70),
    },
  });
  // Comunidad en tres niveles (lib/tiers.ts): «Esencia» → «Plena» (incluye Esencia) → «Luna completa»
  // (incluye Plena y Esencia). «Luna completa» es el Círculo Lunar de siempre (sus miembros, Laura,
  // Carmen y Lucía, conservan su acceso y leen todo lo de los niveles de abajo).
  const pCircle = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "MEMBERSHIP", status: "PUBLISHED", slug: "full-moon", title: "Luna completa", emoji: "🌕",
      summary: "Todo lo de Plena y, además, los círculos de cada luna nueva y luna llena.",
      description: "El nivel más completo de la comunidad: vivimos juntas cada luna.\n\nIncluye:\n• Círculos de la luna en directo: en cada luna nueva y cada luna llena, por Zoom\n• La grabación de cada círculo: por si no puedes venir ese día\n• Cancela cuando quieras",
      imageUrl: await demoImage(ana.id, "/demo/comunidad.webp"), priceCents: 3300, billingInterval: "month", ctaLabel: "Unirme", sortOrder: 6, createdAt: daysAgo(40),
    },
  });
  const pEsencia = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "MEMBERSHIP", status: "PUBLISHED", slug: "essence", title: "Esencia", emoji: "🌱", pagedReading: true,
      summary: "Un texto energético cada semana para vivir el cielo con calma.",
      description: "La puerta de entrada a la comunidad: cada semana, un texto para leer el cielo y llevarlo a tu día a día.\n\nIncluye:\n• Un texto energético cada semana: la lectura del cielo de esos días y una práctica sencilla para vivirla\n• Cancela cuando quieras",
      imageUrl: await demoImage(ana.id, "/demo/astrologia.webp"), priceCents: 1100, billingInterval: "month", ctaLabel: "Unirme", sortOrder: 9, createdAt: daysAgo(35),
    },
  });
  const pPlena = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "MEMBERSHIP", status: "PUBLISHED", slug: "full", title: "Plena", emoji: "🌗",
      summary: "Todo lo de Esencia, más podcast, meditaciones, Astroweather, masterclases y ceremonias.",
      description: "Para vivir la comunidad a fondo, con la voz y en directo.\n\nIncluye:\n• Podcast privado: episodios para escuchar con calma donde quieras\n• Meditaciones guiadas: en audio, para cada fase de la luna y para tu día a día\n• Astroweather cada semana: el clima astrológico en vídeo y en audio\n• Masterclases: en directo y después grabadas, o directamente en vídeo\n• Ceremonias en directo: cacao, equinoccios, lunas llenas… y su grabación después\n• Cancela cuando quieras",
      imageUrl: await demoImage(ana.id, "/demo/human-design.webp"), priceCents: 2200, billingInterval: "month", ctaLabel: "Unirme", sortOrder: 10, createdAt: daysAgo(35),
      // Oferta del primer mes (lib/offers.ts): las renovaciones van al precio normal.
      salePriceCents: 1100, saleLabel: "1.er mes −50 %", saleEndsAt: zonedTimeToUtc(addDaysToKey(TODAY, 12), 0, TZ),
    },
  });
  await prisma.productInclusion.createMany({
    data: [
      { creatorId: ana.id, productId: pPlena.id, includedProductId: pEsencia.id },
      { creatorId: ana.id, productId: pCircle.id, includedProductId: pPlena.id },
      { creatorId: ana.id, productId: pCircle.id, includedProductId: pEsencia.id },
    ],
  });

  // Las lecturas no guardan archivos: se envían por email.
  const fCuaderno = await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Cuaderno de trabajo.pdf", kind: "PDF", mimeType: "application/pdf", ...cuaderno } });
  const fMedit = await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Meditación de integración.wav", kind: "AUDIO", mimeType: "audio/wav", ...meditacion, ...(await mediaFields(makeWav(40), "audio/wav")) } });
  const fVideo = video && videoData ? await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Bienvenida.mp4", kind: "VIDEO", mimeType: "video/mp4", ...video, ...(await mediaFields(videoData, "video/mp4")) } }) : null;
  const fVideo2 = video2 && videoTipos ? await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Los 5 tipos.mov", kind: "VIDEO", mimeType: "video/quicktime", ...video2, ...(await mediaFields(videoTipos, "video/quicktime")) } }) : null;
  const fResumen = resumen && resumenData ? await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Resumen de los 5 tipos.m4a", kind: "AUDIO", mimeType: "audio/mp4", ...resumen, ...(await mediaFields(resumenData, "audio/mp4")) } }) : null;
  const fLamina = await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Los 5 tipos.png", kind: "IMAGE", mimeType: "image/png", ...lamina } });
  for (const [i, f] of [fCuaderno, fMedit, fVideo, fVideo2, fResumen, fLamina].entries()) if (f) await prisma.productFile.update({ where: { id: f.id }, data: { sortOrder: i } });

  // Curso: 3 módulos · 7 lecciones. Cada lección es un solo paso del progreso y lleva sus partes en
  // orden (vídeo, audio, texto con formato, PDF, imagen…). «Los 5 tipos» lo lleva todo junto.
  const t = (text: string, format?: "MD"): SeedPart => (format ? { text, format } : { text });
  const f = (file: { id: string; kind: string } | null): SeedPart[] => (file ? [{ file }] : []);
  const modules: { title: string; lessons: { title: string; durationMin: number; parts: SeedPart[] }[] }[] = [
    {
      title: "Tu mapa completo",
      lessons: [
        { title: "Bienvenida: cómo aprovechar este curso", durationMin: 8, parts: [...f(fVideo), t("En esta lección te cuento cómo está organizado el curso y cómo sacarle partido. Ten a mano tu carta natal y tu bodygraph de Human Design: los usaremos en todos los módulos.")] },
        { title: "Sol, Luna y Ascendente", durationMin: 12, parts: [t("Tu carta natal tiene tres pilares. El Sol habla de tu propósito y de dónde brillas. La Luna describe tus necesidades emocionales: lo que te hace sentir en casa. El Ascendente es tu puerta de entrada a la vida, la manera en que inicias las cosas.\n\nObserva en tu carta en qué signo y casa está cada uno. Escribe tres palabras que asocies a cada pilar y fíjate en si se parecen o se contradicen. Las contradicciones no son errores: son los lugares donde tu carta te pide integración.")] },
        { title: "Ejercicio: dibuja tu mapa", durationMin: 20, parts: [t("Descarga el cuaderno de trabajo y completa el ejercicio 1. Te llevará unos 20 minutos. Hazlo sin prisa, con una infusión y algo de música suave."), { file: fCuaderno }] },
      ],
    },
    {
      title: "Tu diseño energético",
      lessons: [
        {
          title: "Los 5 tipos de Human Design", durationMin: 15,
          parts: [
            ...f(fVideo2),
            t("Manifestador, Generador, Generador Manifestante, Proyector y Reflector. Cada tipo tiene una estrategia distinta para tomar decisiones con **menos resistencia**.\n\n## Las cinco estrategias\n\n1. **Manifestador:** informar antes de actuar.\n2. **Generador:** esperar para responder.\n3. **Generador Manifestante:** responder e informar.\n4. **Proyector:** esperar la invitación.\n5. **Reflector:** esperar un ciclo lunar.\n\nEscucha el resumen cuando quieras repasarlo y guarda la lámina para tenerla a mano.", "MD"),
            ...f(fResumen),
            { file: fLamina },
            { file: fCuaderno },
          ],
        },
        { title: "Estrategia y autoridad", durationMin: 18, parts: [{ file: fMedit }, t("Escucha este audio con tu bodygraph delante. Identificaremos tu autoridad interna y cómo reconocer su voz en el cuerpo.")] },
      ],
    },
    {
      title: "Tu propósito",
      lessons: [
        {
          title: "Gene Keys: sombra, don y siddhi", durationMin: 14,
          // Texto con formato (lib/rich-text.ts): el resto de la demo es texto de antes, como prueba de que se ve igual.
          parts: [t("Cada Gene Key describe un espectro de consciencia. La **sombra** es el patrón automático; el **don**, la creatividad que aparece cuando miramos la sombra con amabilidad; el **siddhi**, la expresión más elevada.\n\n## Tu práctica de la semana\n\nElige tu llave de Propósito y contémplala durante una semana. Anota cada día una situación en la que la reconozcas.", "MD")],
        },
        { title: "Meditación de integración", durationMin: 12, parts: [{ file: fMedit }, t("Cierra el curso con esta meditación. Busca un lugar tranquilo, cierra los ojos y deja que el sonido del cuenco te acompañe.")] },
      ],
    },
  ];
  const lessonIds: string[] = [];
  for (const [mi, m] of modules.entries()) {
    const mod = await prisma.courseModule.create({ data: { creatorId: ana.id, productId: pCourse.id, title: m.title, sortOrder: mi } });
    for (const [li, l] of m.lessons.entries()) {
      const lesson = await seedLesson({ creatorId: ana.id, productId: pCourse.id, moduleId: mod.id, sortOrder: li, ...l });
      lessonIds.push(lesson.id);
    }
  }

  // El directo del Círculo: el primer jueves dentro de al menos 5 días, a las 19:00.
  let liveKey = addDaysToKey(TODAY, 5);
  while (weekdayOfKey(liveKey) !== 4) liveKey = addDaysToKey(liveKey, 1);
  const liveAt = zonedTimeToUtc(liveKey, 19 * 60, TZ);
  const liveDay = formatInTz(liveAt, TZ, { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
  const liveMonth = formatInTz(liveAt, TZ, { month: "long" });
  // Comunidad: tres publicaciones ya avisadas (notifiedAt), la de luna nueva con sus archivos (audio,
  // PDF e imagen), comentarios y «me gusta» (más abajo, cuando existen las miembros) y una programada.
  const seen = (d: Date) => ({ notify: false, notifiedAt: d });
  const lunaNuevaAt = daysAgo(6);
  const postLunaNueva = await prisma.membershipPost.create({
    data: { creatorId: ana.id, productId: pCircle.id, title: "Luna nueva en Libra · ritual de intención", kind: "MEDITACION", publishedAt: lunaNuevaAt, ...seen(lunaNuevaAt), bodyFormat: "MD",
      body: "Esta luna nueva nos invita a revisar el **equilibrio** entre lo que damos y lo que recibimos.\n\n- Enciende una vela.\n- Escribe tres intenciones en presente.\n- Léelas en voz alta y guárdalas hasta la luna llena.\n\nTe dejo la meditación guiada, la guía del ritual en PDF y la lámina para tener a mano. Cuéntame en los comentarios cómo te ha ido ✨" },
  });
  const directoAt = daysAgo(2);
  await prisma.membershipPost.create({
    data: { creatorId: ana.id, productId: pCircle.id, title: `Directo de ${liveMonth}: los tránsitos del mes`, kind: "MASTERCLASS", publishedAt: directoAt, ...seen(directoAt), mediaUrl: "https://meet.google.com/circulo-lunar",
      body: `Nos vemos el ${liveDay} a las 19:00 (hora de Madrid) para repasar los tránsitos del mes y cómo aprovecharlos en tu día a día. La grabación quedará aquí.` },
  });
  const lunaLlenaAt = daysAgo(18);
  await prisma.membershipPost.create({
    data: { creatorId: ana.id, productId: pCircle.id, title: "Meditación de luna llena", kind: "AUDIO", publishedAt: lunaLlenaAt, ...seen(lunaLlenaAt),
      body: "Una meditación de 15 minutos para soltar lo que ya no necesitas. Escúchala la noche de luna llena o en los tres días siguientes." },
  });
  // Programada: se publica sola dentro de 3 días a las 9:00 (hora de Madrid) y entonces avisa por email.
  await prisma.membershipPost.create({
    data: { creatorId: ana.id, productId: pCircle.id, title: "Tránsitos de la semana: Venus entra en Escorpio", kind: "TEXT", bodyFormat: "MD", publishedAt: zonedTimeToUtc(addDaysToKey(TODAY, 3), 9 * 60, TZ),
      body: "Venus cambia de signo y con ella **cómo nos relacionamos**. Te cuento qué mirar en tu carta esta semana y un pequeño ejercicio para el fin de semana." },
  });
  // Estudio Comunidad (/panel/comunidad): una bienvenida fijada arriba (en Esencia, así la leen los tres
  // niveles), otra programada en Esencia que avisará por email y un borrador en Plena.
  const welcomeAt = daysAgo(25);
  await prisma.membershipPost.create({
    data: { creatorId: ana.id, productId: pEsencia.id, title: "Bienvenida: empieza por aquí", kind: "TEXT", bodyFormat: "MD", publishedAt: welcomeAt, pinnedAt: welcomeAt, ...seen(welcomeAt),
      body: "Qué alegría tenerte aquí 🌙\n\nCada semana te dejo un **texto energético**, y en cada luna, una práctica. Si estás en Plena o en Luna completa, verás también los audios, el podcast, las ceremonias y los círculos.\n\n- Activa los avisos por email para no perderte nada.\n- Preséntate en los comentarios: ¿desde dónde nos lees?" },
  });
  await prisma.membershipPost.create({
    data: { creatorId: ana.id, productId: pEsencia.id, title: "Texto energético: cerrar el año con suavidad", kind: "TEXT", bodyFormat: "MD", publishedAt: zonedTimeToUtc(addDaysToKey(TODAY, 6), 8 * 60, TZ),
      body: "Diciembre se acerca y con él la tentación de correr. Esta semana te propongo **parar un minuto cada mañana** y preguntarte qué necesitas de verdad hoy." },
  });
  await prisma.membershipPost.create({
    data: { creatorId: ana.id, productId: pPlena.id, title: "Ceremonia del solsticio de invierno", kind: "CEREMONIA", status: "DRAFT", bodyFormat: "MD", publishedAt: daysAgo(1),
      body: "Nos reunimos la noche más larga del año para **honrar la oscuridad** y encender juntas la luz que vuelve. Trae una vela, papel y algo de abrigo." },
  });
  const ritualAudioData = makeM4a(36);
  const ritualAudio = ritualAudioData ? await storePrivate(ana.id, "meditacion-luna-nueva.m4a", ritualAudioData) : await storePrivate(ana.id, "meditacion-luna-nueva.wav", makeWav(36));
  const ritualPdf = await storePrivate(ana.id, "ritual-luna-nueva.pdf", makePdf({
    title: "Ritual de luna nueva", subtitle: "Luna nueva en Libra", author: "Cirella · Círculo Lunar",
    sections: [
      { heading: "Prepara tu espacio", body: "Busca un rincón tranquilo, enciende una vela y ten a mano papel y bolígrafo. Apaga el móvil durante veinte minutos." },
      { heading: "Tus tres intenciones", body: "Escríbelas en presente y en positivo, como si ya fueran verdad: «Me doy permiso para descansar», «Pido ayuda cuando la necesito»…" },
      { heading: "Cierre", body: "Léelas en voz alta, dobla el papel y guárdalo hasta la próxima luna llena. Entonces las releeremos juntas en el círculo." },
    ],
  }));
  const ritualImgData = await sharp(path.resolve("public/demo/comunidad.webp")).resize(1200).png().toBuffer();
  const ritualImg = await storePrivate(ana.id, "lamina-luna-nueva.png", ritualImgData);
  await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCircle.id, postId: postLunaNueva.id, name: ritualAudioData ? "Meditación de luna nueva.m4a" : "Meditación de luna nueva.wav", kind: "AUDIO", mimeType: ritualAudioData ? "audio/mp4" : "audio/wav", ...ritualAudio, ...(await mediaFields(ritualAudioData ?? makeWav(36), ritualAudioData ? "audio/mp4" : "audio/wav")), sortOrder: 0 } });
  await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCircle.id, postId: postLunaNueva.id, name: "Ritual de luna nueva.pdf", kind: "PDF", mimeType: "application/pdf", ...ritualPdf, sortOrder: 1 } });
  await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCircle.id, postId: postLunaNueva.id, name: "Lámina luna nueva.png", kind: "IMAGE", mimeType: "image/png", ...ritualImg, sortOrder: 2 } });

  // ───────────── Modo personal: lo gratuito con email, lo que se paga fuera y el contenido de la página ─────────────
  // Mini-curso de pago (en la web no hay nada gratis).
  const pFree = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "COURSE", status: "PUBLISHED", accessMode: "PAID", slug: "natal-chart-in-3-steps",
      title: "Mini-curso: tu carta natal en 3 pasos", emoji: "🎁",
      summary: "Tres lecciones cortas para leer tu Sol, tu Luna y tu Ascendente sin perderte.",
      description: "Un mini-curso para dar tus primeros pasos con la carta natal.\n\nIncluye:\n• 3 lecciones de lectura (10 minutos cada una)\n• Un ejercicio práctico para cerrar",
      imageUrl: await demoImage(ana.id, "/demo/astrologia.webp"), priceCents: 1900, ctaLabel: "Quiero el mini-curso", sortOrder: 7, createdAt: daysAgo(20),
    },
  });
  const freeModule = await prisma.courseModule.create({ data: { creatorId: ana.id, productId: pFree.id, title: "Tu carta en 3 pasos", sortOrder: 0 } });
  const freeLessons = [
    { title: "Paso 1 · Tu Sol: dónde brillas", body: "Busca en tu carta el símbolo del Sol (un círculo con un punto). Fíjate en el signo y en la casa en la que está. El signo describe cómo expresas tu energía vital; la casa, el área de la vida donde más se nota.\n\nEscribe una frase que empiece por «Yo brillo cuando…» y complétala pensando en ese signo y esa casa." },
    { title: "Paso 2 · Tu Luna: lo que te hace sentir en casa", body: "La Luna habla de tus necesidades emocionales. Localízala en tu carta y anota su signo.\n\nPregúntate: ¿qué necesito para sentirme a salvo? ¿Qué me calma cuando todo se mueve? Compara tu respuesta con las palabras clave de ese signo." },
    { title: "Paso 3 · Tu Ascendente y un pequeño ejercicio", body: "El Ascendente es el signo que aparece en el horizonte este en el momento en que naciste: tu manera de empezar las cosas.\n\nPara cerrar: escribe tres palabras para tu Sol, tres para tu Luna y tres para tu Ascendente. Léelas juntas. Ese es tu primer mapa." },
  ];
  // Texto de antes (sin formato): se sigue viendo igual.
  for (const [i, l] of freeLessons.entries())
    await seedLesson({ creatorId: ana.id, productId: pFree.id, moduleId: freeModule.id, title: l.title, durationMin: 10, sortOrder: i, parts: [{ text: l.body }] });

  // Sesión con solicitud: elige día y hora en el formulario y se cierra por email.
  await prisma.product.create({
    data: {
      creatorId: ana.id, type: "SESSION", status: "PUBLISHED", accessMode: "PAID", slug: "solar-return",
      title: "Revolución solar: tu año que empieza", emoji: "☀️",
      summary: "Una sesión de 60 minutos para leer tu año astrológico, de cumpleaños a cumpleaños.",
      description: "Leemos juntas tu revolución solar: los temas que se activan este año, los meses clave y cómo aprovecharlos.\n\nElige día y hora en la solicitud y lo cerramos por email.",
      imageUrl: await demoImage(ana.id, "/demo/sesion.webp"), priceCents: 6500, durationMin: 60, sortOrder: 8, createdAt: daysAgo(15),
    },
  });

  await prisma.post.createMany({
    data: [
      {
        creatorId: ana.id, slug: "october-eclipse", status: "PUBLISHED", publishedAt: daysAgo(3, 9),
        title: "Eclipse de octubre: qué cierra y qué empieza",
        excerpt: "Los eclipses aceleran los finales que ya estaban en marcha. Te cuento cómo vivir este con calma.",
        bodyFormat: "MD",
        body: "Los eclipses no traen cosas nuevas de la nada: aceleran procesos que ya estaban en marcha. Si llevas meses sintiendo que algo tenía que cambiar, es muy posible que este eclipse lo haga evidente.\n\n## Mi consejo para estos días\n\n**No tomes decisiones grandes en caliente.** Observa, apunta lo que aparece y deja que pasen al menos dos semanas antes de mover ficha.\n\nSi quieres ver en qué casa de tu carta cae el eclipse, empieza por el mini-curso gratis: en el paso 1 aprenderás a leer las casas.",
        imageUrl: await demoImage(ana.id, "/demo/ana-cover.webp"), createdAt: daysAgo(3, 9),
      },
      {
        creatorId: ana.id, slug: "moon-circle-open", status: "PUBLISHED", publishedAt: daysAgo(12, 18),
        title: "Abro plazas en el Círculo Lunar",
        excerpt: "Rituales de luna nueva, un directo al mes y meditaciones exclusivas. Te cuento cómo funciona.",
        body: "Después de un verano de pausa, vuelvo a abrir el Círculo Lunar: un espacio pequeño para vivir el cielo mes a mes.\n\nCada luna nueva comparto un ritual de intención, una vez al mes hacemos un directo para repasar los tránsitos y tendrás meditaciones que solo están allí.\n\nToda la información está en la ficha de la comunidad. Si tienes dudas, escríbeme a hola@cirella.app.",
        createdAt: daysAgo(12, 18),
      },
    ],
  });

  await prisma.discountCode.createMany({
    data: [
      {
        creatorId: ana.id, brand: "Velas Alba", code: "CIRELLA15", description: "15 % en velas de soja para tus rituales de luna nueva.", url: "https://example.com/velas-alba", sortOrder: 1, expiresAt: new Date(NOW.getTime() + 75 * DAY),
        // Fotos de lo que recomienda de la marca: se ven al desplegar el código en la portada.
        images: await codePhotos(ana.id, [
          ["/demo/sesion.webp", "Mi vela de luna nueva encendida en el altar"],
          ["/demo/comunidad.webp", "Velas de soja para el ritual de la noche"],
          ["/demo/hero.webp", "Velas junto a la ventana en luna llena"],
        ]),
        // «Recomendaciones»: la lista de «Ver más», cada una con su enlace opcional al producto.
        recommendations: [
          { text: "Vela de lavanda para luna nueva", url: "https://example.com/velas-alba/lavanda" },
          { text: "Vela de salvia para limpiar la energía", url: "https://example.com/velas-alba/salvia" },
          { text: "Pack de velas para el altar", url: null },
        ],
      },
      { creatorId: ana.id, brand: "Cuarzo & Co.", code: "LUNA10", description: "10 % en cuarzos y piedras naturales (pedido mínimo 20 €).", url: "https://example.com/cuarzo-co", sortOrder: 2 },
      {
        creatorId: ana.id, brand: "Té de la Luna", code: "CIELO20", description: "20 % en infusiones ecológicas. Mis favoritas para las noches de luna llena.", url: "https://example.com/te-de-la-luna", sortOrder: 3,
        images: await codePhotos(ana.id, [
          ["/demo/astrologia.webp", "Infusión de lavanda mientras miro mi carta"],
          ["/demo/gene-keys.webp", "Mi taza favorita para las noches de luna llena"],
        ]),
        recommendations: [
          { text: "Infusión de lavanda y manzanilla", url: "https://example.com/te-de-la-luna/lavanda" },
          { text: "Té blanco de luna llena", url: "https://example.com/te-de-la-luna/luna-llena" },
        ],
      },
    ],
  });

  await seedAnaPortada({ anaId: ana.id, course: pCourse, freeCourse: pFree, esencia: pEsencia, plena: pPlena, lunaCompleta: pCircle });

  // Disponibilidad: L–J 10–14 y 17–20 · V 10–14. Dos días bloqueados dentro de dos semanas y las
  // dos reservas en los próximos días con horario (prisma/demo-dates.ts).
  const schedule = DEMO_SCHEDULE;
  await prisma.availabilityRule.createMany({ data: ANA_AVAILABILITY.map((r) => ({ creatorId: ana.id, ...r })) });
  await prisma.blockedDate.createMany({ data: schedule.blocked.map((date) => ({ creatorId: ana.id, date, reason: "Retiro de otoño" })) });
  // Calendario propio: un viaje a Bali dentro de tres semanas (esos días trabaja de 9:00 a 13:00 hora
  // de Bali, que en Madrid es de madrugada) y una hora bloqueada (médico) dentro de diez días.
  await prisma.availabilityOverride.createMany({
    data: [
      ...[21, 22, 23].map((d) => ({ creatorId: ana.id, date: addDaysToKey(TODAY, d), kind: "HOURS", startMinute: 540, endMinute: 780, timezone: "Asia/Makassar", note: "Bali" })),
      { creatorId: ana.id, date: addDaysToKey(TODAY, 10), kind: "BLOCK", startMinute: 11 * 60, endMinute: 12 * 60, timezone: TZ, note: "Médico" },
    ],
  });

  // Calendario de Reservas: unas notas del diario este mes y el siguiente, una en la próxima luna
  // nueva y otra en la próxima luna llena.
  const phases = moonPhasesBetween(NOW, new Date(NOW.getTime() + 40 * DAY));
  const nextNew = phases.find((e) => e.kind === "moon" && e.phase === "new")!;
  const nextFull = phases.find((e) => e.kind === "moon" && e.phase === "full")!;
  const nextMonth = `${addMonthsToKey(TODAY, 1).slice(0, 7)}-05`;
  const notes = new Map<string, string>([
    [nextMonth, "Revisar precios y preparar el programa del **taller de diciembre**."],
    [dateKeyInTz(nextFull.at, TZ), "## Luna llena\n\nSoltar lo que ya no sirve. Directo en el Círculo a las 21:00 🌕"],
    [dateKeyInTz(nextNew.at, TZ), "## Ritual de luna nueva\n\n- Escribir diez intenciones\n- Encender la vela de Velas Alba 🕯️\n- Tirada de tarot para el mes"],
    [TODAY, "**Intención del día:** cerrar las lecturas pendientes antes del fin de semana.\n\n- Preparar la carta de Lucía\n- Grabar el audio del Círculo"],
  ]);
  await prisma.calendarNote.createMany({ data: [...notes].map(([date, body]) => ({ creatorId: ana.id, date, body, format: "MD" })) });

  // Automatizaciones (Cirella es Pro: todas activas)
  const triggers = ["PURCHASE_RECEIPT", "COURSE_ACCESS", "BOOKING_CONFIRMED", "NEW_SUBSCRIPTION", "SUBSCRIPTION_CANCELED", "WELCOME", "SESSION_REMINDER", "ABANDONED_CHECKOUT"];
  await prisma.automation.createMany({
    data: triggers.map((t) => ({
      creatorId: ana.id, trigger: t, enabled: true,
      delayMinutes: t === "SESSION_REMINDER" ? 1440 : t === "ABANDONED_CHECKOUT" ? 60 : t === "WELCOME" ? 10 : 0,
      message: t === "WELCOME" ? "Bienvenida a mi pequeño universo ✨ Gracias por confiar en mí. Si en algún momento tienes dudas sobre tu lectura o tu curso, responde a este email: los leo todos." : null,
    })),
  });

  // ───────────── Clientas, pedidos y reservas de Cirella ─────────────
  /**
   * Consentimientos del checkout de un pedido pagado, como los guarda hoy (condiciones y la casilla
   * obligatoria del desistimiento según el producto, con su texto literal, su versión y la hora): lo
   * digital y los cursos, la renuncia; las membresías (Lucía), «Quiero empezar ya» con el reembolso
   * proporcional; un taller, que tiene fecha fija y no admite desistimiento. Las sesiones
   * individuales no la llevan (se reservan a partir del día 15). El acceso a la comunidad que Cirella le
   * regaló a Laura es a mano: no pasa por aquí.
   */
  const consents = (product: { type: string; deliveryMode?: string | null; groupSession?: boolean | null }, at: Date) => acceptedConsentFields(product, at);
  type SeedCreator = typeof ana;
  type Buy = {
    creator: SeedCreator; plan: typeof pro; user: typeof laura; product: typeof pAstro; at: Date;
    visitor: string; source: string | null; marketingOptIn?: boolean;
  };
  const customers = new Map<string, string>();
  /** Una compra pagada como la deja fulfillOrder (lib/orders.ts): pedido, clienta, cobro y analítica. */
  async function buy(b: Buy) {
    const key = `${b.creator.id}:${b.user.id}`;
    let customerId = customers.get(key);
    if (!customerId) {
      const optIn = b.marketingOptIn ?? true;
      const c = await prisma.customer.create({
        data: {
          creatorId: b.creator.id, userId: b.user.id, email: b.user.email, name: b.user.name, marketingOptIn: optIn, marketingOptInAt: optIn ? b.at : null,
          totalSpentCents: 0, ordersCount: 0, firstPurchaseAt: b.at, lastPurchaseAt: b.at, createdAt: b.at,
        },
      });
      customerId = c.id;
      customers.set(key, c.id);
    }
    const current = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { firstPurchaseAt: true, lastPurchaseAt: true, createdAt: true } });
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalSpentCents: { increment: b.product.priceCents },
        ordersCount: { increment: 1 },
        // Las compras no se siembran por orden de fecha: la primera y la última, las de verdad.
        ...(current.firstPurchaseAt && b.at < current.firstPurchaseAt ? { firstPurchaseAt: b.at, createdAt: b.at < current.createdAt ? b.at : current.createdAt } : {}),
        lastPurchaseAt: current.lastPurchaseAt && current.lastPurchaseAt > b.at ? current.lastPurchaseAt : b.at,
      },
    });
    // Mismos importes que el checkout: comisión sobre el precio.
    const amounts = demoSaleFields({ product: b.product, commissionBps: effectiveCommissionBps(b.plan, b.creator, b.at) });
    const order = await prisma.order.create({
      data: {
        creatorId: b.creator.id, customerId, productId: b.product.id, productTitle: b.product.title, productType: b.product.type,
        buyerEmail: b.user.email, buyerName: b.user.name, status: "PAID", ...amounts,
        paymentProvider: "simulated", paymentRef: `sim_ch_seed_${b.product.slug}`, visitorId: b.visitor, source: b.source,
        createdAt: new Date(b.at.getTime() - 4 * 60000), paidAt: b.at, chargedAt: b.at,
        ...consents(b.product, b.at),
      },
    });
    await prisma.transaction.create({
      data: {
        creatorId: b.creator.id, orderId: order.id, type: "CHARGE", description: b.product.title, amountCents: order.amountCents,
        platformFeeCents: order.platformFeeCents, netCents: order.netCents,
        provider: "simulated", providerRef: order.paymentRef, idempotencyKey: chargeKey(order.id), createdAt: b.at,
      },
    });
    await prisma.analyticsEvent.create({
      data: { creatorId: b.creator.id, type: "PURCHASE", productId: b.product.id, visitorId: b.visitor, source: b.source, amountCents: order.amountCents, createdAt: b.at },
    });
    return { order, customerId };
  }
  const anaBuy = (b: Omit<Buy, "creator" | "plan">) => buy({ ...b, creator: ana, plan: pro });

  const o1 = await anaBuy({ user: laura, product: pCourse, at: daysAgo(20, 21, 14), visitor: "v_laura", source: "instagram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: laura.id, productId: pCourse.id, orderId: o1.order.id, createdAt: daysAgo(20, 21, 14) } });
  for (const [i, lessonId] of lessonIds.slice(0, 3).entries())
    await prisma.lessonProgress.create({ data: { creatorId: ana.id, userId: laura.id, productId: pCourse.id, lessonId, completedAt: daysAgo(19 - i * 4) } });

  const o5 = await anaBuy({ user: lucia, product: pCircle, at: daysAgo(16, 22, 10), visitor: "v_lucia", source: "tiktok" });
  const periodEnd = new Date(daysAgo(16, 22, 10));
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const sub = await prisma.subscription.create({
    data: {
      creatorId: ana.id, productId: pCircle.id, customerId: o5.customerId, userId: lucia.id, orderId: o5.order.id,
      status: "ACTIVE", priceCents: pCircle.priceCents, interval: "month", currentPeriodStart: daysAgo(16, 22, 10), currentPeriodEnd: periodEnd,
      provider: "simulated", createdAt: daysAgo(16, 22, 10),
    },
  });
  await prisma.access.create({ data: { creatorId: ana.id, userId: lucia.id, productId: pCircle.id, orderId: o5.order.id, subscriptionId: sub.id, expiresAt: periodEnd } });

  const o2 = await anaBuy({ user: laura, product: pGK, at: daysAgo(12, 10, 32), visitor: "v_laura", source: "instagram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: laura.id, productId: pGK.id, orderId: o2.order.id, createdAt: daysAgo(12, 10, 32) } });

  const lauraBoughtAt = daysAgo(LAURA_HD_DAYS_AGO, 18, 47);
  const o3 = await anaBuy({ user: laura, product: pHD, at: lauraBoughtAt, visitor: "v_laura", source: "telegram" });
  // Sus datos para la lectura (los mismos que escribió en las notas de la reserva).
  await prisma.order.update({
    where: { id: o3.order.id },
    data: {
      intake: { v: 1, birth: { date: "1991-03-03", time: "06:40", timeUnknown: false, place: "Valencia, España" }, answers: [{ id: "tema", label: "¿Qué te gustaría explorar?", value: "Mi tipo energético y cómo tomar decisiones en el trabajo." }] },
      intakeUpdatedAt: lauraBoughtAt,
      metadata: { slotStart: DEMO_SCHEDULE.lauraAt.toISOString() },
    },
  });
  await prisma.access.create({ data: { creatorId: ana.id, userId: laura.id, productId: pHD.id, orderId: o3.order.id } });
  // Laura: el primer día con horario dentro de al menos 3 días, a las 17:00 (como el ejemplo del
  // briefing); Carmen: el siguiente, a las 10:00. Nunca en un día bloqueado. Las dos el día 15 (o
  // después) desde su compra.
  const { lauraAt, carmenAt } = schedule;
  const bLaura = await prisma.booking.create({
    data: {
      creatorId: ana.id, productId: pHD.id, customerId: o3.customerId, userId: laura.id, orderId: o3.order.id, status: "CONFIRMED",
      startAt: lauraAt, endAt: new Date(lauraAt.getTime() + 75 * 60000), meetingUrl: pHD.meetingUrl,
      customerNotes: "Nací el 3 de marzo de 1991 a las 06:40 en Valencia.", createdAt: lauraBoughtAt,
    },
  });

  const carmenBoughtAt = daysAgo(CARMEN_11_DAYS_AGO, 13, 5);
  const o4 = await anaBuy({ user: carmen, product: p11, at: carmenBoughtAt, visitor: "v_carmen", source: "instagram" });
  await prisma.order.update({ where: { id: o4.order.id }, data: { metadata: { slotStart: DEMO_SCHEDULE.carmenAt.toISOString() } } });
  await prisma.access.create({ data: { creatorId: ana.id, userId: carmen.id, productId: p11.id, orderId: o4.order.id } });
  const bCarmen = await prisma.booking.create({
    data: {
      creatorId: ana.id, productId: p11.id, customerId: o4.customerId, userId: carmen.id, orderId: o4.order.id, status: "CONFIRMED",
      startAt: carmenAt, endAt: new Date(carmenAt.getTime() + 60 * 60000), meetingUrl: p11.meetingUrl, createdAt: carmenBoughtAt,
    },
  });

  // Comunidad: Carmen entró al Círculo con un programa de 3 meses que le dio Cirella a mano (pagó por
  // Bizum): su acceso termina solo ese día. Comenta y da «me gusta» como Lucía (suscripción mensual).
  const carmenGrantAt = daysAgo(30, 10, 0);
  const carmenLastDay = addMonthsToKey(dateKeyInTz(carmenGrantAt, TZ), 3);
  const carmenUntil = zonedTimeToUtc(addDaysToKey(carmenLastDay, 1), 0, TZ);
  const carmenCircle = await prisma.order.create({
    data: {
      creatorId: ana.id, customerId: customers.get(`${ana.id}:${carmen.id}`)!, productId: pCircle.id, productTitle: pCircle.title, productType: pCircle.type,
      buyerEmail: carmen.email, buyerName: carmen.name, status: "PAID", amountCents: 0, commissionBps: 0, platformFeeCents: 0, netCents: 0,
      paymentProvider: "manual", createdAt: carmenGrantAt, paidAt: carmenGrantAt, chargedAt: carmenGrantAt,
      metadata: { grantedByUserId: anaUser.id, accessGrantedAt: carmenGrantAt.toISOString(), accessUntil: carmenUntil.toISOString() },
    },
  });
  await prisma.access.create({ data: { creatorId: ana.id, userId: carmen.id, productId: pCircle.id, orderId: carmenCircle.id, expiresAt: carmenUntil, createdAt: carmenGrantAt } });
  // Laura (la alumna de la demo) también está en el Círculo: Cirella se lo regaló por seis meses, así su
  // área enseña «Mis membresías» con contenido.
  const lauraGrantAt = daysAgo(10, 11, 0);
  const lauraUntil = zonedTimeToUtc(addDaysToKey(addMonthsToKey(dateKeyInTz(lauraGrantAt, TZ), 6), 1), 0, TZ);
  const lauraCircle = await prisma.order.create({
    data: {
      creatorId: ana.id, customerId: customers.get(`${ana.id}:${laura.id}`)!, productId: pCircle.id, productTitle: pCircle.title, productType: pCircle.type,
      buyerEmail: laura.email, buyerName: laura.name, status: "PAID", amountCents: 0, commissionBps: 0, platformFeeCents: 0, netCents: 0,
      paymentProvider: "manual", createdAt: lauraGrantAt, paidAt: lauraGrantAt, chargedAt: lauraGrantAt,
      metadata: { grantedByUserId: anaUser.id, accessGrantedAt: lauraGrantAt.toISOString(), accessUntil: lauraUntil.toISOString() },
    },
  });
  await prisma.access.create({ data: { creatorId: ana.id, userId: laura.id, productId: pCircle.id, orderId: lauraCircle.id, expiresAt: lauraUntil, createdAt: lauraGrantAt } });
  const cLucia = await prisma.membershipComment.create({
    data: { creatorId: ana.id, productId: pCircle.id, postId: postLunaNueva.id, userId: lucia.id, authorName: "Lucía T.", body: "Mis tres intenciones ya están escritas ✨ La meditación me ha encantado.", createdAt: daysAgo(5, 21, 40) },
  });
  await prisma.membershipComment.create({
    data: { creatorId: ana.id, productId: pCircle.id, postId: postLunaNueva.id, userId: anaUser.id, parentId: cLucia.id, authorName: "Cirella", byOwner: true, body: "¡Qué bonito, Lucía! Guárdalas hasta la luna llena y las releemos juntas en el directo.", createdAt: daysAgo(5, 22, 15) },
  });
  await prisma.membershipComment.create({
    data: { creatorId: ana.id, productId: pCircle.id, postId: postLunaNueva.id, userId: carmen.id, authorName: "Carmen R.", body: "La lámina la tengo ya en la nevera 🌑", createdAt: daysAgo(4, 9, 5) },
  });
  await prisma.membershipPostLike.createMany({
    data: [
      { creatorId: ana.id, postId: postLunaNueva.id, userId: lucia.id, createdAt: daysAgo(5, 21, 38) },
      { creatorId: ana.id, postId: postLunaNueva.id, userId: carmen.id, createdAt: daysAgo(4, 9, 3) },
    ],
  });
  // «Vistas» del estudio Comunidad: quién ha abierto la de luna nueva.
  await prisma.membershipPostView.createMany({
    data: [
      { creatorId: ana.id, postId: postLunaNueva.id, userId: lucia.id, createdAt: daysAgo(5, 21, 30) },
      { creatorId: ana.id, postId: postLunaNueva.id, userId: carmen.id, createdAt: daysAgo(4, 9, 0) },
      { creatorId: ana.id, postId: postLunaNueva.id, userId: laura.id, createdAt: daysAgo(3, 19, 12) },
    ],
  });

  // Calendario propio: Lucía (desde Bogotá) tuvo su lectura de Human Design hace una semana y Cirella
  // ya le ha enviado la grabación y un resumen. Se ve en su área (Tu grabación, Mis archivos).
  const luciaBoughtAt = daysAgo(LUCIA_HD_DAYS_AGO, 20, 15);
  const o6 = await anaBuy({ user: lucia, product: pHD, at: luciaBoughtAt, visitor: "v_lucia", source: "instagram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: lucia.id, productId: pHD.id, orderId: o6.order.id } });
  const luciaAt = daysAgo(LUCIA_SESSION_DAYS_AGO, 17, 0);
  await prisma.order.update({
    where: { id: o6.order.id },
    data: {
      metadata: { slotStart: luciaAt.toISOString(), buyerTz: "America/Bogota" },
      intake: { v: 1, birth: { date: "1994-07-21", time: null, timeUnknown: true, place: "Medellín, Colombia" }, answers: [] },
      intakeUpdatedAt: luciaBoughtAt,
      deliveredAt: daysAgo(6, 10, 30),
    },
  });
  await prisma.booking.create({
    data: {
      creatorId: ana.id, productId: pHD.id, customerId: o6.customerId, userId: lucia.id, orderId: o6.order.id, status: "COMPLETED",
      startAt: luciaAt, endAt: new Date(luciaAt.getTime() + 75 * 60000), meetingUrl: ANA_ZOOM, customerTimezone: "America/Bogota", createdAt: luciaBoughtAt,
    },
  });
  // Emails enviados / programados (visibles en /dev/email)
  const base = appUrl();
  const lauraWhen = formatSessionDate(lauraAt, TZ);
  const carmenWhen = formatSessionDate(carmenAt, TZ);
  await prisma.emailMessage.createMany({
    data: [
      { creatorId: ana.id, to: laura.email, subject: "Compra confirmada: Lectura de Human Design", template: "PURCHASE_RECEIPT", status: "SENT", sentAt: new Date(lauraBoughtAt.getTime() + 60_000), sendAt: new Date(lauraBoughtAt.getTime() + 60_000), html: `<p>Hola Laura, gracias por tu compra. <a href="${base}/area">Acceder a mi contenido</a></p>` },
      { creatorId: ana.id, to: laura.email, subject: `Reserva confirmada · ${lauraWhen}`, template: "BOOKING_CONFIRMED", status: "SENT", sentAt: new Date(lauraBoughtAt.getTime() + 60_000), sendAt: new Date(lauraBoughtAt.getTime() + 60_000), html: `<p>Tu sesión está reservada: ${lauraWhen}. <a href="${base}/area/sessions/${bLaura.id}">Ver detalles</a></p>` },
      { creatorId: ana.id, to: laura.email, subject: "Recordatorio: mañana tienes tu sesión", template: "SESSION_REMINDER", status: "QUEUED", sendAt: new Date(lauraAt.getTime() - DAY), dedupeKey: `reminder:${bLaura.id}:${bLaura.startAt!.toISOString()}`, html: `<p>Te recordamos tu sesión Lectura de Human Design: ${lauraWhen}.</p>` },
      { creatorId: ana.id, to: carmen.email, subject: "Recordatorio: mañana tienes tu sesión", template: "SESSION_REMINDER", status: "QUEUED", sendAt: new Date(carmenAt.getTime() - DAY), dedupeKey: `reminder:${bCarmen.id}:${bCarmen.startAt!.toISOString()}`, html: `<p>Te recordamos tu Sesión 1:1: ${carmenWhen}.</p>` },
      { creatorId: ana.id, to: "ana@cirella.app", subject: "Nueva suscripción a Luna completa", template: "NEW_SUBSCRIPTION", status: "SENT", sentAt: daysAgo(16, 22, 11), sendAt: daysAgo(16, 22, 11), html: `<p>Lucía Torres se ha unido a Luna completa.</p>` },
    ],
  });

  await seedAnaNewsletter(ana.id, { circleId: pCircle.id, astroId: pAstro.id });
  await seedEnergyProfiles(ana.id, [laura, carmen]);

  // Analytics: ~60 días de tráfico con estacionalidad semanal y tendencia creciente
  const rand = rng(42);
  const products = [pAstro, pHD, pGK, pCourse, p11, pCircle];
  const weights = [0.22, 0.18, 0.14, 0.24, 0.12, 0.1];
  const pick = () => {
    let r = rand();
    for (let i = 0; i < products.length; i++) {
      r -= weights[i];
      if (r <= 0) return products[i];
    }
    return products[0];
  };
  const sources: [string, number][] = [["instagram", 0.58], ["tiktok", 0.14], ["telegram", 0.09], ["whatsapp", 0.06], ["direct", 0.1], ["google", 0.03]];
  const pickSource = () => {
    let r = rand();
    for (const [s, w] of sources) {
      r -= w;
      if (r <= 0) return s;
    }
    return "direct";
  };
  const events: Prisma.AnalyticsEventCreateManyInput[] = [];
  for (let d = 60; d >= 0; d--) {
    const date = new Date(NOW.getTime() - d * DAY);
    const dow = date.getUTCDay();
    const trend = 1 + (60 - d) / 60;
    const visitors = Math.round((14 + rand() * 12) * trend * (dow === 0 || dow === 6 ? 1.25 : 1));
    for (let v = 0; v < visitors; v++) {
      const visitorId = `v_${d}_${v}`;
      const source = pickSource();
      const t = new Date(date.getTime() - Math.floor(rand() * 14 * 3600_000));
      if (t > NOW) continue;
      events.push({ creatorId: ana.id, type: "PAGE_VIEW", visitorId, source, createdAt: t });
      if (rand() < 0.18) events.push({ creatorId: ana.id, type: "PAGE_VIEW", visitorId, source, createdAt: new Date(t.getTime() + 60000) });
      if (rand() < 0.42) {
        const p = pick();
        events.push({ creatorId: ana.id, type: "PRODUCT_VIEW", productId: p.id, visitorId, source, createdAt: new Date(t.getTime() + 45000) });
        if (rand() < 0.32) {
          events.push({ creatorId: ana.id, type: "PRODUCT_CLICK", productId: p.id, visitorId, source, createdAt: new Date(t.getTime() + 90000) });
          if (rand() < 0.38) events.push({ creatorId: ana.id, type: "CHECKOUT_STARTED", productId: p.id, visitorId, source, createdAt: new Date(t.getTime() + 100000) });
        }
      }
    }
  }
  for (let i = 0; i < events.length; i += 500) await prisma.analyticsEvent.createMany({ data: events.slice(i, i + 500) });

  // Cuotas de plan cobradas por la plataforma
  for (const m of [2, 1, 0])
    await prisma.transaction.create({
      data: { creatorId: ana.id, type: "PLAN_FEE", description: "Plan Pro · mensual", amountCents: 2900, platformFeeCents: 2900, netCents: 0, provider: "simulated", createdAt: daysAgo(m * 30 + 11) },
    });

  // ───────────── María Sol (Creator · Minimal) — otro tenant ─────────────
  const mariaPage: PageConfig = {
    displayName: "María Sol",
    tagline: "Yoga terapéutico · Meditación · Respiración",
    headline: "Vuelve a ti, una respiración cada vez.",
    bio: "Profesora de yoga terapéutico y facilitadora de respiración consciente. Te ayudo a bajar el ritmo y habitar tu cuerpo con calma.",
    avatarUrl: "/demo/maria-avatar.webp",
    coverUrl: "/demo/maria-cover.webp",
    theme: {},
    template: "custom",
    pageThemes: {},
    pieces: {},
    designs: [],
    sections: defaultSections().map((s) => ({ ...s, title: s.key === "products" ? "Prácticas" : undefined })),
    links: [{ id: "m1", label: "Clases en directo · calendario", url: "https://calendar.google.com", highlight: true }],
    socials: { instagram: "maria.sol.yoga", youtube: "mariasolyoga" },
    testimonials: [{ id: "mt1", author: "Paula G.", quote: "La meditación para dormir me ha cambiado las noches. Sencilla y preciosa." }],
    faqs: [{ id: "mf1", q: "¿Necesito experiencia previa?", a: "No. Todas las prácticas están pensadas para empezar desde cero." }],
    contact: { email: "hola@mariasol.yoga" },
    hidePoweredBy: true,
  };
  const maria = await prisma.creator.create({
    data: {
      userId: mariaUser.id, username: "maria", displayName: "María Sol", categoryId: cat.yoga, planId: creatorPlan.id,
      planRenewsAt: new Date(NOW.getTime() + 28 * DAY),
      pageDraft: mariaPage as unknown as Prisma.InputJsonValue, pagePublished: mariaPage as unknown as Prisma.InputJsonValue,
      published: true, publishedAt: daysAgo(45), onboardedAt: daysAgo(47), contactEmail: "maria@cirella.app",
      payoutProvider: "simulated", payoutAccountId: "sim_acct_maria01", payoutConnectedAt: daysAgo(47),
      payoutStatus: "ACTIVE", payoutChargesEnabled: true, payoutPayoutsEnabled: true, payoutStatusUpdatedAt: daysAgo(47),
      // Identidad legal completa.
      legalName: "María Sol Ruiz", legalTaxId: "87654321X", legalAddress: "Calle del Pez 12, 2.º B", legalPostalCode: "28004", legalCity: "Madrid",
      legalCountry: "ES", legalEmail: "hola@mariasol.yoga", termsAcceptedAt: daysAgo(48), termsVersion: PLATFORM_TERMS_VERSION,
      referralCode: "MARIASOL", createdAt: daysAgo(48),
    },
  });
  await storePageImages(maria.id, mariaPage);
  const medMaria = await storePrivate(maria.id, "meditacion-dormir.wav", makeWav(30));
  const mMed = await prisma.product.create({
    data: { creatorId: maria.id, type: "DIGITAL", status: "PUBLISHED", slug: "sleep-meditation", title: "Meditación guiada para dormir", emoji: "🌙", summary: "20 minutos para soltar el día y dormir profundo.", description: "Audio de meditación guiada con respiración 4-7-8.", imageUrl: await demoImage(maria.id, "/demo/maria-meditacion.webp"), priceCents: 1200, sortOrder: 1 },
  });
  await prisma.productFile.create({ data: { creatorId: maria.id, productId: mMed.id, name: "Meditación para dormir.wav", kind: "AUDIO", mimeType: "audio/wav", ...medMaria } });
  // Ningún producto publicado sin nada que entregar (lib/delivery.ts): el programa se entrega con un enlace.
  const mRespira = await prisma.product.create({
    data: { creatorId: maria.id, type: "DIGITAL", status: "PUBLISHED", slug: "breathe-21", title: "Programa Respira · 21 días", emoji: "🌿", summary: "Una práctica corta al día para regular tu sistema nervioso.", imageUrl: await demoImage(maria.id, "/demo/maria-respira.webp"), priceCents: 3900, sortOrder: 2 },
  });
  await prisma.productFile.create({
    data: { creatorId: maria.id, productId: mRespira.id, name: "Las 21 prácticas (vídeo)", kind: "LINK", url: "https://example.com/respira-21" },
  });
  const mSes = await prisma.product.create({
    data: { creatorId: maria.id, type: "SESSION", status: "PUBLISHED", slug: "therapeutic-yoga", title: "Yoga terapéutico 1:1", emoji: "🧘", summary: "Sesión individual adaptada a tu cuerpo y tu momento.", imageUrl: await demoImage(maria.id, "/demo/maria-sesion.webp"), priceCents: 5500, durationMin: 60, bufferMin: 15, minNoticeHours: 360, sortOrder: 3 },
  });
  await prisma.availabilityRule.createMany({ data: [2, 4].map((wd) => ({ creatorId: maria.id, weekday: wd, startMinute: 540, endMinute: 780 })) });
  // Carmen compró la meditación de María.
  const { order: mOrder } = await buy({
    creator: maria, plan: creatorPlan, user: carmen, product: mMed, at: daysAgo(8), visitor: "m_8_1", source: null, marketingOptIn: false,
  });
  await prisma.access.create({ data: { creatorId: maria.id, userId: carmen.id, productId: mMed.id, orderId: mOrder.id, createdAt: daysAgo(8) } });
  const mariaEvents: Prisma.AnalyticsEventCreateManyInput[] = [];
  for (let d = 30; d >= 0; d--)
    for (let v = 0; v < 6 + (d % 5); v++)
      mariaEvents.push({ creatorId: maria.id, type: "PAGE_VIEW", visitorId: `m_${d}_${v}`, source: v % 3 ? "instagram" : "direct", createdAt: new Date(NOW.getTime() - d * DAY - v * 3600_000) });
  await prisma.analyticsEvent.createMany({ data: mariaEvents });
  for (const m of [1, 0])
    await prisma.transaction.create({ data: { creatorId: maria.id, type: "PLAN_FEE", description: "Plan Creator · mensual", amountCents: 1200, platformFeeCents: 1200, netCents: 0, provider: "simulated", createdAt: daysAgo(m * 30 + 2) } });
  void mSes;

  // ───────────── Sofía Vidal (Free · Luxury) — referida por Cirella ─────────────
  const sofiaPage: PageConfig = {
    displayName: "Sofía Vidal",
    tagline: "Coach de marca personal",
    headline: "Tu historia es tu mejor estrategia.",
    bio: "Ayudo a terapeutas y coaches a comunicar lo que hacen con claridad y elegancia.",
    avatarUrl: null,
    coverUrl: null,
    theme: {},
    template: "custom",
    pageThemes: {},
    pieces: {},
    designs: [],
    sections: defaultSections(),
    links: [],
    socials: { instagram: "sofiavidal.coach" },
    testimonials: [],
    faqs: [],
    contact: { email: "sofia@cirella.app" },
    hidePoweredBy: false,
  };
  const sofia = await prisma.creator.create({
    data: {
      userId: sofiaUser.id, username: "sofia", displayName: "Sofía Vidal", categoryId: cat.coaching, planId: free.id,
      pageDraft: sofiaPage as unknown as Prisma.InputJsonValue, pagePublished: sofiaPage as unknown as Prisma.InputJsonValue,
      published: true, publishedAt: daysAgo(8), onboardedAt: daysAgo(8), contactEmail: "sofia@cirella.app",
      payoutProvider: "simulated", payoutAccountId: "sim_acct_sofia01", payoutConnectedAt: daysAgo(8),
      payoutStatus: "ACTIVE", payoutChargesEnabled: true, payoutPayoutsEnabled: true, payoutStatusUpdatedAt: daysAgo(8),
      legalName: "Sofía Vidal Romero", legalTaxId: "11111111H", legalAddress: "Avenida del Mar 21, 4.º", legalPostalCode: "46011", legalCity: "Valencia",
      legalCountry: "ES", legalEmail: "sofia@cirella.app", termsAcceptedAt: daysAgo(9), termsVersion: PLATFORM_TERMS_VERSION,
      referralCode: "SOFIAV", referredById: ana.id, createdAt: daysAgo(9),
    },
  });
  const sGuia = await prisma.product.create({
    data: { creatorId: sofia.id, type: "DIGITAL", status: "PUBLISHED", slug: "instagram-bio-guide", title: "Guía: tu bio de Instagram que vende", emoji: "✍️", summary: "Plantillas y ejemplos para escribir una bio clara en 15 minutos.", priceCents: 1900, sortOrder: 1 },
  });
  await prisma.productFile.create({ data: { creatorId: sofia.id, productId: sGuia.id, name: "Guía en Google Docs", kind: "LINK", url: "https://example.com/guia-bio" } });
  // Demostración de la entrega personal: Sofía prepara los comentarios para cada clienta.
  await prisma.product.create({
    data: {
      creatorId: sofia.id, type: "DIGITAL", status: "PUBLISHED", slug: "message-workbook", title: "Workbook: encuentra tu mensaje", emoji: "📓", summary: "30 preguntas para definir qué haces, para quién y por qué.", priceCents: 2700, sortOrder: 2,
      deliveryMode: "PERSONAL",
      instructions: "Después de pagar te envío por email el workbook rellenable y, en 48 h, mis comentarios sobre tus respuestas.",
    },
  });
  await prisma.referral.create({
    data: { referrerId: ana.id, referredId: sofia.id, status: "REWARDED", rewardType: "FREE_MONTH", rewardValue: 2900, rewardedAt: daysAgo(8) },
  });
  await prisma.creator.update({ where: { id: ana.id }, data: { creditCents: 2900 } });

  // Elena: la alumna con un poco de todo (cursos, lectura, sesión, círculos y la membresía Esencia).
  await seedDemoStudent(prisma, { creatorId: ana.id, ownerUserId: anaUser.id, passwordHash: password, timezone: TZ, now: NOW });
  // La lección larga de ejemplo (capítulos y la carta por partes): «Marte, tu fuerza».
  await seedMarsLesson(prisma, ana.id);
  await seedSystemLessons(prisma, ana.id);
  await seedDeepLessons(prisma, ana.id);
  // La membresía completa de ejemplo (Esencia, Plena y Luna completa con todo tipo de publicaciones).
  await seedDemoMembership(prisma, ana.id);
  // Más opiniones y preguntas frecuentes en la portada.
  await seedHomeTexts(prisma, ana.id);
  // Laura, con acceso a todo para ir probando la web.
  await grantFullAccess(prisma, { creatorId: ana.id, ownerUserId: anaUser.id, now: NOW });

  const counts = {
    usuarios: await prisma.user.count(),
    creadoras: await prisma.creator.count(),
    productos: await prisma.product.count(),
    pedidos: await prisma.order.count(),
    reservas: await prisma.booking.count(),
    eventos: await prisma.analyticsEvent.count(),
    publicaciones: await prisma.post.count(),
    códigos: await prisma.discountCode.count(),
    barajas: await prisma.oracleDeck.count(),
    perfilesNacimiento: await prisma.birthProfile.count(),
  };
  console.log("✓ Listo:", counts);
  console.log("  Cuentas demo (contraseña demo1234): ana@cirella.app · laura@example.com · elena@example.com · admin@cirella.app");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => Promise.all([prisma.$disconnect(), appPrisma.$disconnect()]));
