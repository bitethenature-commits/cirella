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
 *                      publicaciones y códigos de descuento)
 *   maria@cirella.app  creadora · plan Creator · /maria
 *   sofia@cirella.app  creadora · plan Free    · /sofia
 *   laura@example.com  clienta de Ana (curso, PDF y sesión)
 *   admin@cirella.app  superadmin
 *
 * Las fechas son relativas al día en que se siembra (prisma/demo-dates.ts): las reservas siempre
 * están por venir y las compras, en los días anteriores. Los importes de las ventas salen de las
 * mismas reglas que el checkout (IVA incluido, comisión sobre la base; prisma/demo-sales.ts) y cada
 * cobro tiene su factura, como una venta real.
 */
import "../scripts/load-env";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureBaseData } from "./base-data";
import { makePdf, makeVideo, makeWav } from "./demo-files";
import { DEMO_MARKER_KEY, assertSafeToSeed } from "./seed-guard";
import { appUrl, storageDir } from "../lib/env";
import { storeProcessedImage } from "../lib/images";
import { mimeFromExt, privateKey, storage } from "../lib/storage";
import { PLATFORM_TERMS_VERSION, WAIVER_TEXT, waiverKindFor } from "../lib/legal";
import { defaultSections, type PageConfig } from "../lib/page-config";
import { prisma as appPrisma } from "../lib/db";
import { issueMonthlyPlatformInvoices } from "../lib/invoices/fees";
import { invoiceYear } from "../lib/invoices/format";
import { issueSaleInvoiceTx } from "../lib/invoices/issue";
import { effectiveCommissionBps } from "../lib/plans";
import { chargeKey } from "../lib/reliability";
import type { TaxMode } from "../lib/tax";
import { addDaysToKey, dateKeyInTz, formatInTz, formatSessionDate, weekdayOfKey, zonedTimeToUtc } from "../lib/tz";
import { ANA_AVAILABILITY, DEMO_TZ, demoSchedule } from "./demo-dates";
import { demoSaleFields } from "./demo-sales";

const prisma = new PrismaClient();
const STORAGE = path.resolve(process.cwd(), storageDir());
const NOW = new Date();
const DAY = 86400_000;
const TZ = DEMO_TZ;
const TODAY = dateKeyInTz(NOW, TZ);
/** Hace `d` días a la hora `h:m` de Madrid (con su horario de verano o de invierno). */
const daysAgo = (d: number, h = 12, m = 0) => zonedTimeToUtc(addDaysToKey(TODAY, -d), h * 60 + m, TZ);
/** Política de IVA de la demo (opción A): Cirella vende los productos digitales, cursos y membresías. */
const TAX_MODE: TaxMode = "PLATFORM_DIGITAL";

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

async function reset() {
  // Los archivos subidos pertenecen a los registros que vamos a borrar. Solo en disco: un bucket
  // de R2 de pruebas se vacía a mano (el seed nunca borra en la nube).
  if (storage().name === "local")
    for (const dir of ["private", "public", "incoming"]) rmSync(path.join(STORAGE, dir), { recursive: true, force: true });
  // Orden inverso de dependencias (claves foráneas de Postgres)
  await prisma.$transaction([
    prisma.emailMessage.deleteMany(),
    prisma.outboxEvent.deleteMany(),
    prisma.paymentEvent.deleteMany(),
    prisma.rateLimit.deleteMany(),
    prisma.jobLock.deleteMany(),
    prisma.analyticsSalt.deleteMany(),
    prisma.analyticsEvent.deleteMany(),
    prisma.lessonProgress.deleteMany(),
    prisma.access.deleteMany(),
    // Las facturas se enlazan entre sí (F3 → F2, rectificativas) con ON DELETE RESTRICT.
    prisma.invoice.updateMany({ data: { relatedInvoiceId: null } }),
    prisma.invoice.deleteMany(),
    prisma.invoiceSeries.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.orderLink.deleteMany(),
    prisma.session.deleteMany(),
    prisma.order.deleteMany(),
    prisma.legalSnapshot.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.courseModule.deleteMany(),
    prisma.membershipPost.deleteMany(),
    prisma.productFile.deleteMany(),
    prisma.product.deleteMany(),
    prisma.automation.deleteMany(),
    prisma.recoveryOptOut.deleteMany(),
    prisma.post.deleteMany(),
    prisma.discountCode.deleteMany(),
    prisma.availabilityRule.deleteMany(),
    prisma.blockedDate.deleteMany(),
    prisma.referral.deleteMany(),
    prisma.creator.deleteMany(),
    prisma.loginToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.category.deleteMany(),
    prisma.template.deleteMany(),
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
  // Identidad legal de la plataforma de demostración (/aviso-legal, /privacidad, /terminos).
  await prisma.platformSetting.createMany({
    data: Object.entries({
      legalCompanyName: "Cirella Demo S.L.",
      legalTaxId: "B12345674",
      legalAddress: "Calle de Alcalá 100, 28009 Madrid (España)",
      legalRegistry: "Registro Mercantil de Madrid, tomo 0000, folio 0, hoja M-000000 (datos de demostración)",
      privacyEmail: "privacidad@cirella.app",
      taxMode: TAX_MODE,
    }).map(([key, value]) => ({ key, value })),
  });
  const password = await bcrypt.hash("demo1234", 10);

  // ───────────── Plataforma ─────────────
  const { plans: { free, creator: creatorPlan, pro }, categories: cat } = await ensureBaseData(prisma);

  // ───────────── Usuarios ─────────────
  await prisma.user.create({ data: { email: "admin@cirella.app", name: "Equipo Cirella", passwordHash: password, isAdmin: true, emailVerifiedAt: daysAgo(90) } });
  const anaUser = await prisma.user.create({ data: { email: "ana@cirella.app", name: "Ana Luna", passwordHash: password, createdAt: daysAgo(75), emailVerifiedAt: daysAgo(75) } });
  const mariaUser = await prisma.user.create({ data: { email: "maria@cirella.app", name: "María Sol", passwordHash: password, createdAt: daysAgo(48), emailVerifiedAt: daysAgo(48) } });
  const sofiaUser = await prisma.user.create({ data: { email: "sofia@cirella.app", name: "Sofía Vidal", passwordHash: password, createdAt: daysAgo(9), emailVerifiedAt: daysAgo(9) } });
  const laura = await prisma.user.create({ data: { email: "laura@example.com", name: "Laura Martín", passwordHash: password, createdAt: daysAgo(20), emailVerifiedAt: daysAgo(20) } });
  const carmen = await prisma.user.create({ data: { email: "carmen@example.com", name: "Carmen Ruiz", createdAt: daysAgo(8) } });
  const lucia = await prisma.user.create({ data: { email: "lucia@example.com", name: "Lucía Torres", createdAt: daysAgo(16) } });

  // ───────────── Ana Luna (Pro · Mystical) ─────────────
  const anaPage: PageConfig = {
    displayName: "Ana Luna",
    tagline: "Astrología · Human Design · Gene Keys",
    headline: "Conócete. Compréndete. Transfórmate.",
    bio: "Acompaño a mujeres a leer su mapa energético para tomar decisiones alineadas con quienes realmente son. Más de 1.200 lecturas y 8 años estudiando el cielo.",
    // storePageImages las procesa como una subida real (WebP con variantes en /media/…).
    avatarUrl: "/demo/ana-avatar.webp",
    coverUrl: "/demo/ana-cover.webp",
    template: "mystical",
    theme: {},
    sections: defaultSections().map((s) => ({
      ...s,
      title: { products: "Lecturas", sessions: "Sesiones privadas", courses: "Formación", memberships: "Comunidad" }[s.key as string],
    })),
    links: [
      { id: "l1", label: "✨ Empieza aquí · Curso Conócete", url: "/ana/curso-conocete-tu-energia", highlight: true },
      { id: "l2", label: "Podcast «Cielo interior»", url: "https://open.spotify.com" },
      { id: "l3", label: "Carta lunar gratuita cada mes", url: "https://substack.com" },
    ],
    socials: { instagram: "ana.luna.astro", tiktok: "analuna", telegram: "analunacielo", youtube: "analuna" },
    testimonials: [
      { id: "t1", author: "Laura M.", role: "Proyectora 2/4", quote: "Mi lectura de Human Design me dio permiso para descansar sin culpa. Fue como si alguien me explicara mi propio manual de instrucciones." },
      { id: "t2", author: "Carmen R.", role: "Sol en Escorpio", quote: "Ana tiene un don para traducir el cielo a decisiones concretas. Salí de la sesión con claridad y un plan." },
      { id: "t3", author: "Lucía T.", role: "Miembro del Círculo", quote: "El círculo lunar se ha convertido en mi ritual mensual. Contenido precioso y una comunidad muy cuidada." },
    ],
    faqs: [
      { id: "f1", q: "¿Necesito saber mi hora de nacimiento?", a: "Sí, para las lecturas de astrología y Human Design la hora exacta es importante. Si no la conoces, escríbeme y buscamos alternativas." },
      { id: "f2", q: "¿Cómo recibo mi lectura?", a: "Los productos digitales están disponibles al instante en tu cuenta. Las sesiones se hacen por videollamada y eliges fecha y hora al reservar." },
      { id: "f3", q: "¿Puedo regalar una lectura?", a: "¡Claro! Compra con tu email y escríbeme con el nombre de la persona: le haré llegar su acceso." },
      { id: "f4", q: "¿Puedo cancelar la membresía?", a: "Cuando quieras, desde tu área de cliente. Mantienes el acceso hasta el final del mes pagado." },
    ],
    contact: { email: "hola@analuna.es", whatsapp: "+34600000000", message: "¿Dudas sobre qué lectura es para ti? Escríbeme y te oriento." },
    // Bloque fijo de texto (sección «Bloques de texto»).
    blocks: [
      {
        id: "sobre-mi",
        title: "Cómo trabajo",
        body: "Cada lectura parte de tu carta natal y de tu diseño humano, sin fórmulas genéricas.\n\nTrabajo por videollamada y te envío la grabación y un resumen escrito después de cada sesión.",
        enabled: true,
      },
    ],
    hidePoweredBy: false,
  };
  const ana = await prisma.creator.create({
    data: {
      userId: anaUser.id, username: "ana", displayName: "Ana Luna", categoryId: cat.astrologia, planId: pro.id,
      planRenewsAt: new Date(NOW.getTime() + 19 * DAY),
      pageDraft: anaPage as unknown as Prisma.InputJsonValue, pagePublished: anaPage as unknown as Prisma.InputJsonValue,
      published: true, publishedAt: daysAgo(70), onboardedAt: daysAgo(74), contactEmail: "ana@cirella.app",
      seoTitle: "Ana Luna · Astrología, Human Design y Gene Keys",
      seoDescription: "Lecturas de astrología, Human Design y Gene Keys, sesiones 1:1, curso y comunidad privada. Conócete. Compréndete. Transfórmate.",
      payoutProvider: "simulated", payoutAccountId: "sim_acct_ana001", payoutConnectedAt: daysAgo(74),
      payoutStatus: "ACTIVE", payoutChargesEnabled: true, payoutPayoutsEnabled: true, payoutStatusUpdatedAt: daysAgo(74),
      // Identidad legal completa (obligatoria para vender). Los datos de DAC7 (fecha de nacimiento,
      // IBAN) se dejan sin completar para ver el aviso y el informe con «Faltan».
      legalName: "Ana Luna Pérez", legalTaxId: "12345678Z", legalAddress: "Calle de la Luna 7, 2.º B", legalPostalCode: "28004",
      legalCity: "Madrid", legalCountry: "ES", legalEmail: "hola@analuna.es",
      // Autónoma con IVA: sus sesiones llevan IVA y Cirella emite la factura en su nombre.
      vatStatus: "STANDARD",
      termsAcceptedAt: daysAgo(75), termsVersion: PLATFORM_TERMS_VERSION,
      referralCode: "ANALUNA", createdAt: daysAgo(75),
    },
  });

  await storePageImages(ana.id, anaPage);

  // Archivos privados
  const guiaCarta = await storePrivate(ana.id, "guia-carta-natal.pdf", makePdf({
    title: "Guía de tu carta natal", subtitle: "Cómo leer tu Sol, tu Luna y tu Ascendente", author: "Ana Luna · Astrología",
    sections: [
      { heading: "Bienvenida", body: "Gracias por confiar en mí para acompañarte en la lectura de tu carta natal. Esta guía es el punto de partida: te ayudará a reconocer los elementos básicos de tu mapa y a sacar el máximo partido a tu informe personalizado.\nLa carta natal es una fotografía del cielo en el momento exacto en que naciste. No determina quién eres: describe tus potenciales, tus ritmos y los aprendizajes que se repiten en tu vida." },
      { heading: "El Sol: tu propósito", body: "El Sol indica la energía que vienes a desarrollar y el lugar donde brillas cuando te expresas con autenticidad. Observa el signo y la casa en la que se encuentra: el signo describe el cómo y la casa el dónde.\nPregunta de reflexión: ¿en qué momentos de tu vida te has sentido más viva y reconocida?" },
      { heading: "La Luna: tu mundo emocional", body: "La Luna habla de tus necesidades emocionales, de lo que te hace sentir en casa y de cómo te cuidas. Muchas veces vivimos desde la Luna sin darnos cuenta: es el piloto automático emocional.\nPregunta de reflexión: ¿qué necesitas para sentirte segura cuando todo cambia?" },
      { heading: "El Ascendente: tu puerta de entrada", body: "El Ascendente es el signo que se elevaba por el horizonte cuando naciste. Describe la forma en la que te acercas a la vida, la primera impresión que das y el camino de crecimiento que te propone tu carta." },
      { heading: "Próximos pasos", body: "Responde al email de confirmación con tu fecha, hora y lugar de nacimiento. En un máximo de 72 horas tendrás en tu cuenta tu informe personalizado y el audio explicativo.\nCon cariño, Ana." },
    ],
  }));
  const geneKeysPdf = await storePrivate(ana.id, "gene-keys-perfil-hologenetico.pdf", makePdf({
    title: "Gene Keys", subtitle: "Tu Perfil Hologenético: sombra, don y siddhi", author: "Ana Luna · Gene Keys",
    sections: [
      { heading: "Qué son las Gene Keys", body: "Las Gene Keys son un sistema de contemplación basado en los 64 hexagramas del I Ching. Cada llave describe un espectro de consciencia con tres frecuencias: la sombra, el don y el siddhi.\nNo se trata de corregir la sombra, sino de mirarla con amabilidad: en ella está escondido tu mayor regalo." },
      { heading: "La Secuencia de Activación", body: "Las cuatro primeras llaves de tu perfil forman la Secuencia de Activación: Trabajo de vida, Evolución, Radiancia y Propósito. Juntas describen tu genio creativo y el camino para expresarlo." },
      { heading: "Cómo contemplar una llave", body: "Elige una llave y léela despacio. Durante una semana, observa cuándo aparece su sombra en tu día a día. No juzgues: simplemente registra. Poco a poco notarás cómo la frecuencia del don empieza a aparecer de forma natural." },
      { heading: "Ejercicio", body: "1. Escribe tus cuatro llaves principales.\n2. Para cada una, anota una situación reciente en la que reconozcas su sombra.\n3. Imagina cómo habría sido esa misma situación vivida desde el don.\n4. Elige una pequeña acción para esta semana." },
    ],
  }));
  const cuaderno = await storePrivate(ana.id, "cuaderno-de-trabajo.pdf", makePdf({
    title: "Cuaderno de trabajo", subtitle: "Curso · Conócete a través de tu energía", author: "Ana Luna",
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
  const videoTipos = makeVideo(path.resolve("public/demo/human-design.webp"), 14);
  const video2 = videoTipos ? await storePrivate(ana.id, "los-5-tipos.mp4", videoTipos) : null;
  console.log(video ? "  ✓ vídeos de demo generados con ffmpeg" : "  · ffmpeg no disponible: lecciones de vídeo sin archivo");

  const pAstro = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", slug: "lectura-astrologia", title: "Lectura de Astrología", emoji: "🌙",
      summary: "Tu carta natal interpretada: Sol, Luna, Ascendente y casas. Guía PDF + audio explicativo.",
      description: "Una lectura escrita y en audio de tu carta natal para entender tus talentos, tus ritmos emocionales y los temas que se repiten en tu vida.\n\nIncluye:\n• Guía de lectura de tu carta natal (PDF)\n• Audio de introducción (25 min)\n• Informe personalizado en 72 h tras enviar tus datos de nacimiento",
      imageUrl: await demoImage(ana.id, "/demo/astrologia.webp"), priceCents: 4900, ctaLabel: "Comprar", sortOrder: 1,
      instructions: "Responde al email de confirmación con tu fecha, hora y lugar de nacimiento para recibir tu informe personalizado.",
      createdAt: daysAgo(70),
    },
  });
  const pHD = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "SESSION", status: "PUBLISHED", slug: "lectura-human-design", title: "Lectura de Human Design", emoji: "🧬",
      summary: "75 minutos por videollamada para descubrir tu tipo, estrategia y autoridad.",
      description: "Una sesión en directo para leer juntas tu carta de Human Design (bodygraph) y aterrizarla a tu día a día: trabajo, relaciones y decisiones.\n\nIncluye:\n• Sesión de 75 minutos por videollamada\n• Grabación de la sesión\n• Resumen escrito con tus claves",
      imageUrl: await demoImage(ana.id, "/demo/human-design.webp"), priceCents: 7900, ctaLabel: "Reservar", sortOrder: 2,
      durationMin: 75, bufferMin: 15, minNoticeHours: 24, meetingUrl: "https://meet.google.com/ana-luna-hd",
      instructions: "Antes de la sesión, envíame tu fecha, hora y lugar de nacimiento.", createdAt: daysAgo(70),
    },
  });
  const pGK = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", slug: "gene-keys", title: "Gene Keys", emoji: "🔑",
      summary: "Guía PDF de tu Perfil Hologenético: sombra, don y siddhi de tus llaves principales.",
      description: "Una guía práctica para empezar a contemplar tu Perfil Hologenético y tu Secuencia de Activación.\n\nIncluye:\n• Guía «Tu Perfil Hologenético» (PDF)\n• Ejercicios de contemplación semanales",
      imageUrl: await demoImage(ana.id, "/demo/gene-keys.webp"), priceCents: 5900, ctaLabel: "Comprar", sortOrder: 3, createdAt: daysAgo(60),
    },
  });
  const pCourse = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "COURSE", status: "PUBLISHED", slug: "curso-conocete-tu-energia", title: "Conócete a través de tu energía", emoji: "✨",
      summary: "Curso online: integra astrología, Human Design y Gene Keys en un mapa práctico para tu vida.",
      description: "Un recorrido a tu ritmo en 3 módulos para unir las tres herramientas en un único mapa de autoconocimiento.\n\nIncluye:\n• 7 lecciones en vídeo, audio y lectura\n• Cuaderno de trabajo descargable\n• Meditación de integración\n• Acceso de por vida",
      imageUrl: await demoImage(ana.id, "/demo/curso.webp"), priceCents: 14900, ctaLabel: "Ver curso", sortOrder: 4, featured: true, createdAt: daysAgo(55),
    },
  });
  const p11 = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "SESSION", status: "PUBLISHED", slug: "sesion-1-1", title: "Sesión 1:1", emoji: "🔮",
      summary: "Una hora a solas para tu pregunta: tránsitos, decisiones, relaciones o propósito.",
      description: "Una sesión abierta para trabajar el tema que más te importa ahora, combinando astrología, Human Design y Gene Keys.\n\nIncluye:\n• 60 minutos por videollamada\n• Grabación de la sesión",
      imageUrl: await demoImage(ana.id, "/demo/sesion.webp"), priceCents: 12000, ctaLabel: "Reservar", sortOrder: 5,
      durationMin: 60, bufferMin: 15, minNoticeHours: 24, meetingUrl: "https://meet.google.com/ana-luna-11", createdAt: daysAgo(70),
    },
  });
  const pCircle = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "MEMBERSHIP", status: "PUBLISHED", slug: "comunidad-privada", title: "Comunidad privada", emoji: "💫",
      summary: "El Círculo Lunar: rituales de luna nueva, un directo al mes y meditaciones exclusivas.",
      description: "Un espacio íntimo para vivir el cielo mes a mes.\n\nIncluye:\n• Ritual de luna nueva y luna llena\n• Directo mensual con los tránsitos del mes\n• Meditaciones exclusivas\n• Cancela cuando quieras",
      imageUrl: await demoImage(ana.id, "/demo/comunidad.webp"), priceCents: 1900, billingInterval: "month", ctaLabel: "Unirme", sortOrder: 6, createdAt: daysAgo(40),
    },
  });

  await prisma.productFile.createMany({
    data: [
      { creatorId: ana.id, productId: pAstro.id, name: "Guía de tu carta natal.pdf", kind: "PDF", mimeType: "application/pdf", ...guiaCarta, sortOrder: 1 },
      { creatorId: ana.id, productId: pAstro.id, name: "Audio de introducción.wav", kind: "AUDIO", mimeType: "audio/wav", ...audioCarta, sortOrder: 2 },
      { creatorId: ana.id, productId: pGK.id, name: "Gene Keys · Perfil Hologenético.pdf", kind: "PDF", mimeType: "application/pdf", ...geneKeysPdf, sortOrder: 1 },
    ],
  });
  const fCuaderno = await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Cuaderno de trabajo.pdf", kind: "PDF", mimeType: "application/pdf", ...cuaderno } });
  const fMedit = await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Meditación de integración.wav", kind: "AUDIO", mimeType: "audio/wav", ...meditacion } });
  const fVideo = video ? await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Bienvenida.mp4", kind: "VIDEO", mimeType: "video/mp4", ...video } }) : null;
  const fVideo2 = video2 ? await prisma.productFile.create({ data: { creatorId: ana.id, productId: pCourse.id, name: "Los 5 tipos.mp4", kind: "VIDEO", mimeType: "video/mp4", ...video2 } }) : null;

  // Curso: 3 módulos · 7 lecciones
  const modules = [
    {
      title: "Tu mapa completo",
      lessons: [
        { title: "Bienvenida: cómo aprovechar este curso", kind: "VIDEO", fileId: fVideo?.id, durationMin: 8, body: "En esta lección te cuento cómo está organizado el curso y cómo sacarle partido. Ten a mano tu carta natal y tu bodygraph de Human Design: los usaremos en todos los módulos." },
        { title: "Sol, Luna y Ascendente", kind: "TEXT", durationMin: 12, body: "Tu carta natal tiene tres pilares. El Sol habla de tu propósito y de dónde brillas. La Luna describe tus necesidades emocionales: lo que te hace sentir en casa. El Ascendente es tu puerta de entrada a la vida, la manera en que inicias las cosas.\n\nObserva en tu carta en qué signo y casa está cada uno. Escribe tres palabras que asocies a cada pilar y fíjate en si se parecen o se contradicen. Las contradicciones no son errores: son los lugares donde tu carta te pide integración." },
        { title: "Ejercicio: dibuja tu mapa", kind: "EXERCISE", fileId: fCuaderno.id, durationMin: 20, body: "Descarga el cuaderno de trabajo y completa el ejercicio 1. Te llevará unos 20 minutos. Hazlo sin prisa, con una infusión y algo de música suave." },
      ],
    },
    {
      title: "Tu diseño energético",
      lessons: [
        { title: "Los 5 tipos de Human Design", kind: "VIDEO", fileId: fVideo2?.id, durationMin: 15, body: "Manifestador, Generador, Generador Manifestante, Proyector y Reflector. Cada tipo tiene una estrategia distinta para tomar decisiones con menos resistencia." },
        { title: "Estrategia y autoridad", kind: "AUDIO", fileId: fMedit.id, durationMin: 18, body: "Escucha este audio con tu bodygraph delante. Identificaremos tu autoridad interna y cómo reconocer su voz en el cuerpo." },
      ],
    },
    {
      title: "Tu propósito",
      lessons: [
        { title: "Gene Keys: sombra, don y siddhi", kind: "TEXT", durationMin: 14, body: "Cada Gene Key describe un espectro de consciencia. La sombra es el patrón automático; el don, la creatividad que aparece cuando miramos la sombra con amabilidad; el siddhi, la expresión más elevada.\n\nElige tu llave de Propósito y contémplala durante una semana. Anota cada día una situación en la que la reconozcas." },
        { title: "Meditación de integración", kind: "AUDIO", fileId: fMedit.id, durationMin: 12, body: "Cierra el curso con esta meditación. Busca un lugar tranquilo, cierra los ojos y deja que el sonido del cuenco te acompañe." },
      ],
    },
  ];
  const lessonIds: string[] = [];
  for (const [mi, m] of modules.entries()) {
    const mod = await prisma.courseModule.create({ data: { creatorId: ana.id, productId: pCourse.id, title: m.title, sortOrder: mi } });
    for (const [li, l] of m.lessons.entries()) {
      const lesson = await prisma.lesson.create({
        data: {
          creatorId: ana.id, productId: pCourse.id, moduleId: mod.id, title: l.title,
          kind: l.kind === "VIDEO" && !l.fileId ? "TEXT" : l.kind,
          body: l.body, fileId: l.fileId ?? null, durationMin: l.durationMin, sortOrder: li,
        },
      });
      lessonIds.push(lesson.id);
    }
  }

  // El directo del Círculo: el primer jueves dentro de al menos 5 días, a las 19:00.
  let liveKey = addDaysToKey(TODAY, 5);
  while (weekdayOfKey(liveKey) !== 4) liveKey = addDaysToKey(liveKey, 1);
  const liveAt = zonedTimeToUtc(liveKey, 19 * 60, TZ);
  const liveDay = formatInTz(liveAt, TZ, { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
  const liveMonth = formatInTz(liveAt, TZ, { month: "long" });
  await prisma.membershipPost.createMany({
    data: [
      { creatorId: ana.id, productId: pCircle.id, title: "Luna nueva en Libra · ritual de intención", kind: "TEXT", publishedAt: daysAgo(6),
        body: "Esta luna nueva nos invita a revisar el equilibrio entre lo que damos y lo que recibimos. Enciende una vela, escribe tres intenciones en presente y léelas en voz alta. Comparte (si quieres) una de ellas en el canal de Telegram del círculo." },
      { creatorId: ana.id, productId: pCircle.id, title: `Directo de ${liveMonth}: los tránsitos del mes`, kind: "EVENT", publishedAt: daysAgo(2), mediaUrl: "https://meet.google.com/circulo-lunar",
        body: `Nos vemos el ${liveDay} a las 19:00 (hora de Madrid) para repasar los tránsitos del mes y cómo aprovecharlos en tu día a día. La grabación quedará aquí.` },
      { creatorId: ana.id, productId: pCircle.id, title: "Meditación de luna llena", kind: "AUDIO", publishedAt: daysAgo(18),
        body: "Una meditación de 15 minutos para soltar lo que ya no necesitas. Escúchala la noche de luna llena o en los tres días siguientes." },
    ],
  });

  // ───────────── Modo personal: lo gratuito con email, lo que se paga fuera y el contenido de la página ─────────────
  // Mini-curso gratis con email: nombre + email → acceso inmediato y un email con el enlace.
  const pFree = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "COURSE", status: "PUBLISHED", accessMode: "FREE_EMAIL", slug: "mini-curso-tu-carta-en-3-pasos",
      title: "Mini-curso gratis: tu carta natal en 3 pasos", emoji: "🎁",
      summary: "Tres lecciones cortas para leer tu Sol, tu Luna y tu Ascendente sin perderte.",
      description: "Un mini-curso gratuito para dar tus primeros pasos con la carta natal. Déjame tu nombre y tu email y te llega el acceso al momento.\n\nIncluye:\n• 3 lecciones de lectura (10 minutos cada una)\n• Un ejercicio práctico para cerrar",
      imageUrl: await demoImage(ana.id, "/demo/astrologia.webp"), priceCents: 0, ctaLabel: "Quiero el mini-curso", sortOrder: 7, createdAt: daysAgo(20),
    },
  });
  const freeModule = await prisma.courseModule.create({ data: { creatorId: ana.id, productId: pFree.id, title: "Tu carta en 3 pasos", sortOrder: 0 } });
  const freeLessons = [
    { title: "Paso 1 · Tu Sol: dónde brillas", body: "Busca en tu carta el símbolo del Sol (un círculo con un punto). Fíjate en el signo y en la casa en la que está. El signo describe cómo expresas tu energía vital; la casa, el área de la vida donde más se nota.\n\nEscribe una frase que empiece por «Yo brillo cuando…» y complétala pensando en ese signo y esa casa." },
    { title: "Paso 2 · Tu Luna: lo que te hace sentir en casa", body: "La Luna habla de tus necesidades emocionales. Localízala en tu carta y anota su signo.\n\nPregúntate: ¿qué necesito para sentirme a salvo? ¿Qué me calma cuando todo se mueve? Compara tu respuesta con las palabras clave de ese signo." },
    { title: "Paso 3 · Tu Ascendente y un pequeño ejercicio", body: "El Ascendente es el signo que aparece en el horizonte este en el momento en que naciste: tu manera de empezar las cosas.\n\nPara cerrar: escribe tres palabras para tu Sol, tres para tu Luna y tres para tu Ascendente. Léelas juntas. Ese es tu primer mapa." },
  ];
  for (const [i, l] of freeLessons.entries())
    await prisma.lesson.create({ data: { creatorId: ana.id, productId: pFree.id, moduleId: freeModule.id, title: l.title, kind: "TEXT", body: l.body, durationMin: 10, sortOrder: i } });

  // Sesión que se reserva y se paga fuera (Calendly): el botón lleva a la web externa.
  await prisma.product.create({
    data: {
      creatorId: ana.id, type: "SESSION", status: "PUBLISHED", accessMode: "EXTERNAL", slug: "revolucion-solar",
      title: "Revolución solar: tu año que empieza", emoji: "☀️",
      summary: "Una sesión de 60 minutos para leer tu año astrológico, de cumpleaños a cumpleaños.",
      description: "Leemos juntas tu revolución solar: los temas que se activan este año, los meses clave y cómo aprovecharlos.\n\nLa reserva y el pago se hacen en Calendly.",
      imageUrl: await demoImage(ana.id, "/demo/sesion.webp"), priceCents: 6500, durationMin: 60, sortOrder: 8, createdAt: daysAgo(15),
      externalUrl: "https://calendly.com/ana-luna/revolucion-solar", externalLabel: "Reservar en Calendly",
    },
  });

  await prisma.post.createMany({
    data: [
      {
        creatorId: ana.id, slug: "eclipse-de-octubre", status: "PUBLISHED", publishedAt: daysAgo(3, 9),
        title: "Eclipse de octubre: qué cierra y qué empieza",
        excerpt: "Los eclipses aceleran los finales que ya estaban en marcha. Te cuento cómo vivir este con calma.",
        body: "Los eclipses no traen cosas nuevas de la nada: aceleran procesos que ya estaban en marcha. Si llevas meses sintiendo que algo tenía que cambiar, es muy posible que este eclipse lo haga evidente.\n\nMi consejo para estos días: no tomes decisiones grandes en caliente. Observa, apunta lo que aparece y deja que pasen al menos dos semanas antes de mover ficha.\n\nSi quieres ver en qué casa de tu carta cae el eclipse, empieza por el mini-curso gratis: en el paso 1 aprenderás a leer las casas.",
        imageUrl: await demoImage(ana.id, "/demo/ana-cover.webp"), createdAt: daysAgo(3, 9),
      },
      {
        creatorId: ana.id, slug: "nuevo-circulo-lunar", status: "PUBLISHED", publishedAt: daysAgo(12, 18),
        title: "Abro plazas en el Círculo Lunar",
        excerpt: "Rituales de luna nueva, un directo al mes y meditaciones exclusivas. Te cuento cómo funciona.",
        body: "Después de un verano de pausa, vuelvo a abrir el Círculo Lunar: un espacio pequeño para vivir el cielo mes a mes.\n\nCada luna nueva comparto un ritual de intención, una vez al mes hacemos un directo para repasar los tránsitos y tendrás meditaciones que solo están allí.\n\nToda la información está en la ficha de la comunidad. Si tienes dudas, escríbeme a hola@analuna.es.",
        createdAt: daysAgo(12, 18),
      },
    ],
  });

  await prisma.discountCode.createMany({
    data: [
      { creatorId: ana.id, brand: "Velas Alba", code: "ANALUNA15", description: "15 % en velas de soja para tus rituales de luna nueva.", url: "https://example.com/velas-alba", sortOrder: 1, expiresAt: new Date(NOW.getTime() + 75 * DAY) },
      { creatorId: ana.id, brand: "Cuarzo & Co.", code: "LUNA10", description: "10 % en cuarzos y piedras naturales (pedido mínimo 20 €).", url: "https://example.com/cuarzo-co", sortOrder: 2 },
      { creatorId: ana.id, brand: "Té de la Luna", code: "CIELO20", description: "20 % en infusiones ecológicas. Mis favoritas para las noches de luna llena.", url: "https://example.com/te-de-la-luna", sortOrder: 3 },
    ],
  });

  // Disponibilidad: L–J 10–14 y 17–20 · V 10–14. Dos días bloqueados dentro de dos semanas y las
  // dos reservas en los próximos días con horario (prisma/demo-dates.ts).
  const schedule = demoSchedule(TODAY);
  await prisma.availabilityRule.createMany({ data: ANA_AVAILABILITY.map((r) => ({ creatorId: ana.id, ...r })) });
  await prisma.blockedDate.createMany({ data: schedule.blocked.map((date) => ({ creatorId: ana.id, date, reason: "Retiro de otoño" })) });

  // Automatizaciones (Ana es Pro: todas activas)
  const triggers = ["PURCHASE_RECEIPT", "COURSE_ACCESS", "BOOKING_CONFIRMED", "NEW_SUBSCRIPTION", "SUBSCRIPTION_CANCELED", "WELCOME", "SESSION_REMINDER", "ABANDONED_CHECKOUT"];
  await prisma.automation.createMany({
    data: triggers.map((t) => ({
      creatorId: ana.id, trigger: t, enabled: true,
      delayMinutes: t === "SESSION_REMINDER" ? 1440 : t === "ABANDONED_CHECKOUT" ? 60 : t === "WELCOME" ? 10 : 0,
      message: t === "WELCOME" ? "Bienvenida a mi pequeño universo ✨ Gracias por confiar en mí. Si en algún momento tienes dudas sobre tu lectura o tu curso, responde a este email: los leo todos." : null,
    })),
  });

  // ───────────── Clientas, pedidos y reservas de Ana ─────────────
  /** Consentimientos del checkout de un pedido pagado (condiciones y renuncia según el tipo). */
  const consents = (type: string, at: Date) => {
    const kind = waiverKindFor(type);
    return { termsAcceptedAt: at, waiverKind: kind, waiverText: kind ? WAIVER_TEXT[kind] : null, waiverAcceptedAt: kind ? at : null };
  };
  type SeedCreator = typeof ana;
  type Buy = {
    creator: SeedCreator; plan: typeof pro; user: typeof laura; product: typeof pAstro; at: Date;
    visitor: string; source: string | null; marketingOptIn?: boolean;
  };
  const customers = new Map<string, string>();
  /** Cobros sembrados: se facturan al final, por orden de fecha, como lo habría hecho cada compra. */
  const charges: { id: string; at: Date }[] = [];
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
    await prisma.customer.update({
      where: { id: customerId },
      data: { totalSpentCents: { increment: b.product.priceCents }, ordersCount: { increment: 1 }, lastPurchaseAt: b.at },
    });
    // Mismos importes que el checkout: IVA según quién vende (compradora en España) y comisión sobre la base.
    const amounts = demoSaleFields({
      mode: TAX_MODE,
      product: b.product,
      creator: b.creator,
      commissionBps: effectiveCommissionBps(b.plan, b.creator, b.at),
      buyerCountry: "ES",
    });
    const order = await prisma.order.create({
      data: {
        creatorId: b.creator.id, customerId, productId: b.product.id, productTitle: b.product.title, productType: b.product.type,
        buyerEmail: b.user.email, buyerName: b.user.name, status: "PAID", ...amounts,
        paymentProvider: "simulated", paymentRef: `sim_ch_seed_${b.product.slug}`, visitorId: b.visitor, source: b.source,
        createdAt: new Date(b.at.getTime() - 4 * 60000), paidAt: b.at, chargedAt: b.at,
        ...consents(b.product.type, b.at),
      },
    });
    const charge = await prisma.transaction.create({
      data: {
        creatorId: b.creator.id, orderId: order.id, type: "CHARGE", description: b.product.title, amountCents: order.amountCents,
        platformFeeCents: order.platformFeeCents, netCents: order.netCents,
        taxSeller: order.taxSeller, taxCountry: order.taxCountry, taxRateBps: order.taxRateBps, taxCents: order.taxCents,
        provider: "simulated", providerRef: order.paymentRef, idempotencyKey: chargeKey(order.id), createdAt: b.at,
      },
    });
    charges.push({ id: charge.id, at: b.at });
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
      creatorId: ana.id, productId: pCircle.id, customerId: o5.customerId, userId: lucia.id, orderId: o5.order.id, buyerCountry: o5.order.buyerCountry,
      status: "ACTIVE", priceCents: 1900, interval: "month", currentPeriodStart: daysAgo(16, 22, 10), currentPeriodEnd: periodEnd,
      provider: "simulated", createdAt: daysAgo(16, 22, 10),
    },
  });
  await prisma.access.create({ data: { creatorId: ana.id, userId: lucia.id, productId: pCircle.id, orderId: o5.order.id, subscriptionId: sub.id, expiresAt: periodEnd } });

  const o2 = await anaBuy({ user: laura, product: pGK, at: daysAgo(12, 10, 32), visitor: "v_laura", source: "instagram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: laura.id, productId: pGK.id, orderId: o2.order.id, createdAt: daysAgo(12, 10, 32) } });

  const o3 = await anaBuy({ user: laura, product: pHD, at: daysAgo(5, 18, 47), visitor: "v_laura", source: "telegram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: laura.id, productId: pHD.id, orderId: o3.order.id } });
  // Laura: el primer día con horario dentro de al menos 3 días, a las 17:00 (como el ejemplo del
  // briefing); Carmen: el siguiente, a las 10:00. Nunca en un día bloqueado.
  const { lauraAt, carmenAt } = schedule;
  const bLaura = await prisma.booking.create({
    data: {
      creatorId: ana.id, productId: pHD.id, customerId: o3.customerId, userId: laura.id, orderId: o3.order.id, status: "CONFIRMED",
      startAt: lauraAt, endAt: new Date(lauraAt.getTime() + 75 * 60000), meetingUrl: pHD.meetingUrl,
      customerNotes: "Nací el 3 de marzo de 1991 a las 06:40 en Valencia.", createdAt: daysAgo(5, 18, 47),
    },
  });

  const o4 = await anaBuy({ user: carmen, product: p11, at: daysAgo(3, 13, 5), visitor: "v_carmen", source: "instagram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: carmen.id, productId: p11.id, orderId: o4.order.id } });
  const bCarmen = await prisma.booking.create({
    data: {
      creatorId: ana.id, productId: p11.id, customerId: o4.customerId, userId: carmen.id, orderId: o4.order.id, status: "CONFIRMED",
      startAt: carmenAt, endAt: new Date(carmenAt.getTime() + 60 * 60000), meetingUrl: p11.meetingUrl, createdAt: daysAgo(3, 13, 5),
    },
  });

  // Emails enviados / programados (visibles en /dev/correo)
  const base = appUrl();
  const lauraWhen = formatSessionDate(lauraAt, TZ);
  const carmenWhen = formatSessionDate(carmenAt, TZ);
  await prisma.emailMessage.createMany({
    data: [
      { creatorId: ana.id, to: laura.email, subject: "Compra confirmada: Lectura de Human Design", template: "PURCHASE_RECEIPT", status: "SENT", sentAt: daysAgo(5, 18, 48), sendAt: daysAgo(5, 18, 48), html: `<p>Hola Laura, gracias por tu compra. <a href="${base}/cuenta">Acceder a mi contenido</a></p>` },
      { creatorId: ana.id, to: laura.email, subject: `Reserva confirmada · ${lauraWhen}`, template: "BOOKING_CONFIRMED", status: "SENT", sentAt: daysAgo(5, 18, 48), sendAt: daysAgo(5, 18, 48), html: `<p>Tu sesión está reservada: ${lauraWhen}. <a href="${base}/cuenta/sesiones/${bLaura.id}">Ver detalles</a></p>` },
      { creatorId: ana.id, to: laura.email, subject: "Recordatorio: mañana tienes tu sesión", template: "SESSION_REMINDER", status: "QUEUED", sendAt: new Date(lauraAt.getTime() - DAY), dedupeKey: `reminder:${bLaura.id}:${bLaura.startAt!.toISOString()}`, html: `<p>Te recordamos tu sesión Lectura de Human Design: ${lauraWhen}.</p>` },
      { creatorId: ana.id, to: carmen.email, subject: "Recordatorio: mañana tienes tu sesión", template: "SESSION_REMINDER", status: "QUEUED", sendAt: new Date(carmenAt.getTime() - DAY), dedupeKey: `reminder:${bCarmen.id}:${bCarmen.startAt!.toISOString()}`, html: `<p>Te recordamos tu Sesión 1:1: ${carmenWhen}.</p>` },
      { creatorId: ana.id, to: "ana@cirella.app", subject: "Nueva suscripción a Comunidad privada", template: "NEW_SUBSCRIPTION", status: "SENT", sentAt: daysAgo(16, 22, 11), sendAt: daysAgo(16, 22, 11), html: `<p>Lucía Torres se ha unido a Comunidad privada.</p>` },
    ],
  });

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
    template: "minimal",
    theme: {},
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
      // Identidad legal y datos fiscales completos (DAC7).
      legalName: "María Sol Ruiz", legalTaxId: "87654321X", legalAddress: "Calle del Pez 12, 2.º B", legalPostalCode: "28004", legalCity: "Madrid",
      legalCountry: "ES", legalEmail: "hola@mariasol.yoga", termsAcceptedAt: daysAgo(48), termsVersion: PLATFORM_TERMS_VERSION,
      birthDate: new Date("1988-04-12T00:00:00Z"), iban: "ES9121000418450200051332", dac7ConfirmedAt: daysAgo(40),
      referralCode: "MARIASOL", createdAt: daysAgo(48),
    },
  });
  await storePageImages(maria.id, mariaPage);
  const medMaria = await storePrivate(maria.id, "meditacion-dormir.wav", makeWav(30));
  const mMed = await prisma.product.create({
    data: { creatorId: maria.id, type: "DIGITAL", status: "PUBLISHED", slug: "meditacion-dormir", title: "Meditación guiada para dormir", emoji: "🌙", summary: "20 minutos para soltar el día y dormir profundo.", description: "Audio de meditación guiada con respiración 4-7-8.", imageUrl: await demoImage(maria.id, "/demo/maria-meditacion.webp"), priceCents: 1200, sortOrder: 1 },
  });
  await prisma.productFile.create({ data: { creatorId: maria.id, productId: mMed.id, name: "Meditación para dormir.wav", kind: "AUDIO", mimeType: "audio/wav", ...medMaria } });
  // Ningún producto publicado sin nada que entregar (lib/delivery.ts): el programa se entrega con un enlace.
  const mRespira = await prisma.product.create({
    data: { creatorId: maria.id, type: "DIGITAL", status: "PUBLISHED", slug: "programa-respira-21", title: "Programa Respira · 21 días", emoji: "🌿", summary: "Una práctica corta al día para regular tu sistema nervioso.", imageUrl: await demoImage(maria.id, "/demo/maria-respira.webp"), priceCents: 3900, sortOrder: 2 },
  });
  await prisma.productFile.create({
    data: { creatorId: maria.id, productId: mRespira.id, name: "Las 21 prácticas (vídeo)", kind: "LINK", url: "https://example.com/respira-21" },
  });
  const mSes = await prisma.product.create({
    data: { creatorId: maria.id, type: "SESSION", status: "PUBLISHED", slug: "yoga-terapeutico", title: "Yoga terapéutico 1:1", emoji: "🧘", summary: "Sesión individual adaptada a tu cuerpo y tu momento.", imageUrl: await demoImage(maria.id, "/demo/maria-sesion.webp"), priceCents: 5500, durationMin: 60, bufferMin: 15, minNoticeHours: 12, sortOrder: 3 },
  });
  await prisma.availabilityRule.createMany({ data: [2, 4].map((wd) => ({ creatorId: maria.id, weekday: wd, startMinute: 540, endMinute: 780 })) });
  // Carmen compró la meditación de María (vende Cirella: IVA incluido y factura de la serie V).
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

  // ───────────── Sofía Vidal (Free · Luxury) — referida por Ana ─────────────
  const sofiaPage: PageConfig = {
    displayName: "Sofía Vidal",
    tagline: "Coach de marca personal",
    headline: "Tu historia es tu mejor estrategia.",
    bio: "Ayudo a terapeutas y coaches a comunicar lo que hacen con claridad y elegancia.",
    avatarUrl: null,
    coverUrl: null,
    template: "luxury",
    theme: {},
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
    data: { creatorId: sofia.id, type: "DIGITAL", status: "PUBLISHED", slug: "guia-bio-instagram", title: "Guía: tu bio de Instagram que vende", emoji: "✍️", summary: "Plantillas y ejemplos para escribir una bio clara en 15 minutos.", priceCents: 1900, sortOrder: 1 },
  });
  await prisma.productFile.create({ data: { creatorId: sofia.id, productId: sGuia.id, name: "Guía en Google Docs", kind: "LINK", url: "https://example.com/guia-bio" } });
  // Demostración de la entrega personal: Sofía prepara los comentarios para cada clienta.
  await prisma.product.create({
    data: {
      creatorId: sofia.id, type: "DIGITAL", status: "PUBLISHED", slug: "workbook-mensaje", title: "Workbook: encuentra tu mensaje", emoji: "📓", summary: "30 preguntas para definir qué haces, para quién y por qué.", priceCents: 2700, sortOrder: 2,
      deliveryMode: "PERSONAL",
      instructions: "Después de pagar te envío por email el workbook rellenable y, en 48 h, mis comentarios sobre tus respuestas.",
    },
  });
  await prisma.referral.create({
    data: { referrerId: ana.id, referredId: sofia.id, status: "REWARDED", rewardType: "FREE_MONTH", rewardValue: 2900, rewardedAt: daysAgo(8) },
  });
  await prisma.creator.update({ where: { id: ana.id }, data: { creditCents: 2900 } });

  // Facturas de las ventas sembradas, con la misma función que el cobro real (issueSaleInvoiceTx):
  // simplificada de Cirella (serie V) para lo digital y en nombre de Ana (serie CIR) para sus
  // sesiones, porque repercute IVA. Por orden de fecha y con la fecha de cada venta, salvo que alguna
  // sea del año anterior (la numeración es por año: entonces todas llevan la fecha de hoy).
  charges.sort((a, b) => a.at.getTime() - b.at.getTime());
  const backdate = charges.every((c) => invoiceYear(c.at) === invoiceYear(NOW));
  for (const c of charges) {
    const invoice = await prisma.$transaction((tx) => issueSaleInvoiceTx(tx, { transactionId: c.id }));
    if (invoice && backdate) await prisma.invoice.update({ where: { id: invoice.id }, data: { issuedAt: c.at, createdAt: c.at } });
  }

  // Facturas mensuales de Cirella (serie S) del mes pasado, a partir de las cuotas y comisiones
  // sembradas. María no repercute IVA (vatStatus NONE, el valor por defecto).
  await issueMonthlyPlatformInvoices(NOW);

  const counts = {
    usuarios: await prisma.user.count(),
    creadoras: await prisma.creator.count(),
    productos: await prisma.product.count(),
    pedidos: await prisma.order.count(),
    reservas: await prisma.booking.count(),
    eventos: await prisma.analyticsEvent.count(),
    facturas: await prisma.invoice.count(),
    publicaciones: await prisma.post.count(),
    códigos: await prisma.discountCode.count(),
  };
  console.log("✓ Listo:", counts);
  console.log("  Cuentas demo (contraseña demo1234): ana@cirella.app · laura@example.com · admin@cirella.app");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => Promise.all([prisma.$disconnect(), appPrisma.$disconnect()]));
