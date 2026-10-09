/**
 * Datos de demostración. Solo en local: se niega a ejecutarse en producción, contra una base de
 * datos que no esté en esta máquina o contra una que tenga cuentas que no creó él mismo
 * (ver prisma/seed-guard.ts). Para la base de datos real: `npm run deploy` (prisma/bootstrap.ts).
 *   npm run db:reset   → aplica las migraciones pendientes y ejecuta este seed
 *   npm run db:seed    → solo el seed (vacía las tablas antes de sembrar)
 *
 * Cuentas (contraseña para todas: demo1234):
 *   ana@cirella.app    creadora · plan Pro     · /ana
 *   maria@cirella.app  creadora · plan Creator · /maria
 *   sofia@cirella.app  creadora · plan Free    · /sofia
 *   laura@example.com  clienta de Ana (curso, PDF y sesión)
 *   admin@cirella.app  superadmin
 */
import "../scripts/load-env";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureBaseData } from "./base-data";
import { makePdf, makeVideo, makeWav } from "./demo-files";
import { DEMO_MARKER_KEY, assertSafeToSeed } from "./seed-guard";
import { appUrl, storageDir } from "../lib/env";
import { defaultSections, type PageConfig } from "../lib/page-config";

const prisma = new PrismaClient();
const STORAGE = path.resolve(process.cwd(), storageDir());
const NOW = new Date();
const DAY = 86400_000;
const daysAgo = (d: number, h = 12, m = 0) => {
  const x = new Date(NOW.getTime() - d * DAY);
  x.setUTCHours(h - 2, m, 0, 0); // hora de Madrid (CEST, UTC+2)
  return x;
};
/** Fecha concreta en hora de Madrid (octubre → UTC+2). */
const madrid = (iso: string) => new Date(`${iso}:00+02:00`);

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function storePrivate(creatorId: string, name: string, data: Buffer) {
  const rel = `${creatorId}/${name}`;
  const full = path.join(STORAGE, "private", rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, data);
  return { storageKey: rel, sizeBytes: data.length };
}

async function reset() {
  // Los archivos subidos pertenecen a los registros que vamos a borrar.
  rmSync(path.join(STORAGE, "private"), { recursive: true, force: true });
  rmSync(path.join(STORAGE, "public"), { recursive: true, force: true });
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
  await prisma.platformSetting.create({ data: { key: DEMO_MARKER_KEY, value: { seededAt: new Date().toISOString() } } });
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
      referralCode: "ANALUNA", createdAt: daysAgo(75),
    },
  });

  // Archivos privados
  const guiaCarta = storePrivate(ana.id, "guia-carta-natal.pdf", makePdf({
    title: "Guía de tu carta natal", subtitle: "Cómo leer tu Sol, tu Luna y tu Ascendente", author: "Ana Luna · Astrología",
    sections: [
      { heading: "Bienvenida", body: "Gracias por confiar en mí para acompañarte en la lectura de tu carta natal. Esta guía es el punto de partida: te ayudará a reconocer los elementos básicos de tu mapa y a sacar el máximo partido a tu informe personalizado.\nLa carta natal es una fotografía del cielo en el momento exacto en que naciste. No determina quién eres: describe tus potenciales, tus ritmos y los aprendizajes que se repiten en tu vida." },
      { heading: "El Sol: tu propósito", body: "El Sol indica la energía que vienes a desarrollar y el lugar donde brillas cuando te expresas con autenticidad. Observa el signo y la casa en la que se encuentra: el signo describe el cómo y la casa el dónde.\nPregunta de reflexión: ¿en qué momentos de tu vida te has sentido más viva y reconocida?" },
      { heading: "La Luna: tu mundo emocional", body: "La Luna habla de tus necesidades emocionales, de lo que te hace sentir en casa y de cómo te cuidas. Muchas veces vivimos desde la Luna sin darnos cuenta: es el piloto automático emocional.\nPregunta de reflexión: ¿qué necesitas para sentirte segura cuando todo cambia?" },
      { heading: "El Ascendente: tu puerta de entrada", body: "El Ascendente es el signo que se elevaba por el horizonte cuando naciste. Describe la forma en la que te acercas a la vida, la primera impresión que das y el camino de crecimiento que te propone tu carta." },
      { heading: "Próximos pasos", body: "Responde al email de confirmación con tu fecha, hora y lugar de nacimiento. En un máximo de 72 horas tendrás en tu cuenta tu informe personalizado y el audio explicativo.\nCon cariño, Ana." },
    ],
  }));
  const geneKeysPdf = storePrivate(ana.id, "gene-keys-perfil-hologenetico.pdf", makePdf({
    title: "Gene Keys", subtitle: "Tu Perfil Hologenético: sombra, don y siddhi", author: "Ana Luna · Gene Keys",
    sections: [
      { heading: "Qué son las Gene Keys", body: "Las Gene Keys son un sistema de contemplación basado en los 64 hexagramas del I Ching. Cada llave describe un espectro de consciencia con tres frecuencias: la sombra, el don y el siddhi.\nNo se trata de corregir la sombra, sino de mirarla con amabilidad: en ella está escondido tu mayor regalo." },
      { heading: "La Secuencia de Activación", body: "Las cuatro primeras llaves de tu perfil forman la Secuencia de Activación: Trabajo de vida, Evolución, Radiancia y Propósito. Juntas describen tu genio creativo y el camino para expresarlo." },
      { heading: "Cómo contemplar una llave", body: "Elige una llave y léela despacio. Durante una semana, observa cuándo aparece su sombra en tu día a día. No juzgues: simplemente registra. Poco a poco notarás cómo la frecuencia del don empieza a aparecer de forma natural." },
      { heading: "Ejercicio", body: "1. Escribe tus cuatro llaves principales.\n2. Para cada una, anota una situación reciente en la que reconozcas su sombra.\n3. Imagina cómo habría sido esa misma situación vivida desde el don.\n4. Elige una pequeña acción para esta semana." },
    ],
  }));
  const cuaderno = storePrivate(ana.id, "cuaderno-de-trabajo.pdf", makePdf({
    title: "Cuaderno de trabajo", subtitle: "Curso · Conócete a través de tu energía", author: "Ana Luna",
    sections: [
      { heading: "Ejercicio 1 · Dibuja tu mapa", body: "Escribe en el centro de una hoja tu Sol, tu Luna y tu Ascendente. Alrededor, anota tu tipo de Human Design, tu autoridad y tu perfil. Une con líneas los elementos que sientes que hablan de lo mismo." },
      { heading: "Ejercicio 2 · Tu estrategia en acción", body: "Durante siete días, registra cada decisión importante: ¿la tomaste desde tu estrategia y tu autoridad o desde la mente? ¿Qué notaste en el cuerpo?" },
      { heading: "Ejercicio 3 · Tu llave de propósito", body: "Contempla tu Gene Key de Propósito durante una semana. Escribe cada día una frase sobre cómo se ha manifestado." },
    ],
  }));
  const meditacion = storePrivate(ana.id, "meditacion-integracion.wav", makeWav(40));
  const audioCarta = storePrivate(ana.id, "audio-introduccion-carta.wav", makeWav(24));
  const videoData = makeVideo(path.resolve("public/demo/curso.webp"));
  const video = videoData ? storePrivate(ana.id, "bienvenida-curso.mp4", videoData) : null;
  const videoTipos = makeVideo(path.resolve("public/demo/human-design.webp"), 14);
  const video2 = videoTipos ? storePrivate(ana.id, "los-5-tipos.mp4", videoTipos) : null;
  console.log(video ? "  ✓ vídeos de demo generados con ffmpeg" : "  · ffmpeg no disponible: lecciones de vídeo sin archivo");

  const pAstro = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", slug: "lectura-astrologia", title: "Lectura de Astrología", emoji: "🌙",
      summary: "Tu carta natal interpretada: Sol, Luna, Ascendente y casas. Guía PDF + audio explicativo.",
      description: "Una lectura escrita y en audio de tu carta natal para entender tus talentos, tus ritmos emocionales y los temas que se repiten en tu vida.\n\nIncluye:\n• Guía de lectura de tu carta natal (PDF)\n• Audio de introducción (25 min)\n• Informe personalizado en 72 h tras enviar tus datos de nacimiento",
      imageUrl: "/demo/astrologia.webp", priceCents: 4900, ctaLabel: "Comprar", sortOrder: 1,
      instructions: "Responde al email de confirmación con tu fecha, hora y lugar de nacimiento para recibir tu informe personalizado.",
      createdAt: daysAgo(70),
    },
  });
  const pHD = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "SESSION", status: "PUBLISHED", slug: "lectura-human-design", title: "Lectura de Human Design", emoji: "🧬",
      summary: "75 minutos por videollamada para descubrir tu tipo, estrategia y autoridad.",
      description: "Una sesión en directo para leer juntas tu carta de Human Design (bodygraph) y aterrizarla a tu día a día: trabajo, relaciones y decisiones.\n\nIncluye:\n• Sesión de 75 minutos por videollamada\n• Grabación de la sesión\n• Resumen escrito con tus claves",
      imageUrl: "/demo/human-design.webp", priceCents: 7900, ctaLabel: "Reservar", sortOrder: 2,
      durationMin: 75, bufferMin: 15, minNoticeHours: 24, meetingUrl: "https://meet.google.com/ana-luna-hd",
      instructions: "Antes de la sesión, envíame tu fecha, hora y lugar de nacimiento.", createdAt: daysAgo(70),
    },
  });
  const pGK = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", slug: "gene-keys", title: "Gene Keys", emoji: "🔑",
      summary: "Guía PDF de tu Perfil Hologenético: sombra, don y siddhi de tus llaves principales.",
      description: "Una guía práctica para empezar a contemplar tu Perfil Hologenético y tu Secuencia de Activación.\n\nIncluye:\n• Guía «Tu Perfil Hologenético» (PDF)\n• Ejercicios de contemplación semanales",
      imageUrl: "/demo/gene-keys.webp", priceCents: 5900, ctaLabel: "Comprar", sortOrder: 3, createdAt: daysAgo(60),
    },
  });
  const pCourse = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "COURSE", status: "PUBLISHED", slug: "curso-conocete-tu-energia", title: "Conócete a través de tu energía", emoji: "✨",
      summary: "Curso online: integra astrología, Human Design y Gene Keys en un mapa práctico para tu vida.",
      description: "Un recorrido a tu ritmo en 3 módulos para unir las tres herramientas en un único mapa de autoconocimiento.\n\nIncluye:\n• 7 lecciones en vídeo, audio y lectura\n• Cuaderno de trabajo descargable\n• Meditación de integración\n• Acceso de por vida",
      imageUrl: "/demo/curso.webp", priceCents: 14900, ctaLabel: "Ver curso", sortOrder: 4, featured: true, createdAt: daysAgo(55),
    },
  });
  const p11 = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "SESSION", status: "PUBLISHED", slug: "sesion-1-1", title: "Sesión 1:1", emoji: "🔮",
      summary: "Una hora a solas para tu pregunta: tránsitos, decisiones, relaciones o propósito.",
      description: "Una sesión abierta para trabajar el tema que más te importa ahora, combinando astrología, Human Design y Gene Keys.\n\nIncluye:\n• 60 minutos por videollamada\n• Grabación de la sesión",
      imageUrl: "/demo/sesion.webp", priceCents: 12000, ctaLabel: "Reservar", sortOrder: 5,
      durationMin: 60, bufferMin: 15, minNoticeHours: 24, meetingUrl: "https://meet.google.com/ana-luna-11", createdAt: daysAgo(70),
    },
  });
  const pCircle = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "MEMBERSHIP", status: "PUBLISHED", slug: "comunidad-privada", title: "Comunidad privada", emoji: "💫",
      summary: "El Círculo Lunar: rituales de luna nueva, un directo al mes y meditaciones exclusivas.",
      description: "Un espacio íntimo para vivir el cielo mes a mes.\n\nIncluye:\n• Ritual de luna nueva y luna llena\n• Directo mensual con los tránsitos del mes\n• Meditaciones exclusivas\n• Cancela cuando quieras",
      imageUrl: "/demo/comunidad.webp", priceCents: 1900, billingInterval: "month", ctaLabel: "Unirme", sortOrder: 6, createdAt: daysAgo(40),
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

  await prisma.membershipPost.createMany({
    data: [
      { creatorId: ana.id, productId: pCircle.id, title: "Luna nueva en Libra · ritual de intención", kind: "TEXT", publishedAt: daysAgo(6),
        body: "Esta luna nueva nos invita a revisar el equilibrio entre lo que damos y lo que recibimos. Enciende una vela, escribe tres intenciones en presente y léelas en voz alta. Comparte (si quieres) una de ellas en el canal de Telegram del círculo." },
      { creatorId: ana.id, productId: pCircle.id, title: "Directo de octubre: los tránsitos del mes", kind: "EVENT", publishedAt: daysAgo(2), mediaUrl: "https://meet.google.com/circulo-lunar",
        body: "Nos vemos el jueves 22 de octubre a las 19:00 (hora de Madrid) para repasar los tránsitos del mes: Venus entra en Escorpio y Mercurio empieza su sombra retrógrada. La grabación quedará aquí." },
      { creatorId: ana.id, productId: pCircle.id, title: "Meditación de luna llena", kind: "AUDIO", publishedAt: daysAgo(18),
        body: "Una meditación de 15 minutos para soltar lo que ya no necesitas. Escúchala la noche de luna llena o en los tres días siguientes." },
    ],
  });

  // Disponibilidad: L–J 10–14 y 17–20 · V 10–14
  const rules = [1, 2, 3, 4].flatMap((wd) => [
    { creatorId: ana.id, weekday: wd, startMinute: 600, endMinute: 840 },
    { creatorId: ana.id, weekday: wd, startMinute: 1020, endMinute: 1200 },
  ]);
  rules.push({ creatorId: ana.id, weekday: 5, startMinute: 600, endMinute: 840 });
  await prisma.availabilityRule.createMany({ data: rules });
  await prisma.blockedDate.createMany({
    data: [
      { creatorId: ana.id, date: "2026-10-20", reason: "Retiro de otoño" },
      { creatorId: ana.id, date: "2026-10-21", reason: "Retiro de otoño" },
    ],
  });

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
  type Buy = { user: typeof laura; product: typeof pAstro; at: Date; visitor: string; source: string };
  const fee = (cents: number) => Math.round((cents * pro.commissionBps) / 10000);
  const customers = new Map<string, string>();
  async function buy(b: Buy) {
    let customerId = customers.get(b.user.id);
    if (!customerId) {
      const c = await prisma.customer.create({
        data: {
          creatorId: ana.id, userId: b.user.id, email: b.user.email, name: b.user.name, marketingOptIn: true,
          totalSpentCents: 0, ordersCount: 0, firstPurchaseAt: b.at, lastPurchaseAt: b.at, createdAt: b.at,
        },
      });
      customerId = c.id;
      customers.set(b.user.id, c.id);
    }
    await prisma.customer.update({
      where: { id: customerId },
      data: { totalSpentCents: { increment: b.product.priceCents }, ordersCount: { increment: 1 }, lastPurchaseAt: b.at },
    });
    const order = await prisma.order.create({
      data: {
        creatorId: ana.id, customerId, productId: b.product.id, productTitle: b.product.title, productType: b.product.type,
        buyerEmail: b.user.email, buyerName: b.user.name, status: "PAID", amountCents: b.product.priceCents,
        commissionBps: pro.commissionBps, platformFeeCents: fee(b.product.priceCents), netCents: b.product.priceCents - fee(b.product.priceCents),
        paymentProvider: "simulated", paymentRef: `sim_ch_seed_${b.product.slug}`, visitorId: b.visitor, source: b.source,
        createdAt: new Date(b.at.getTime() - 4 * 60000), paidAt: b.at,
      },
    });
    await prisma.transaction.create({
      data: {
        creatorId: ana.id, orderId: order.id, type: "CHARGE", description: b.product.title, amountCents: order.amountCents,
        platformFeeCents: order.platformFeeCents, netCents: order.netCents, provider: "simulated", providerRef: order.paymentRef, createdAt: b.at,
      },
    });
    await prisma.analyticsEvent.create({
      data: { creatorId: ana.id, type: "PURCHASE", productId: b.product.id, visitorId: b.visitor, source: b.source, amountCents: order.amountCents, createdAt: b.at },
    });
    return { order, customerId };
  }

  const o1 = await buy({ user: laura, product: pCourse, at: daysAgo(20, 21, 14), visitor: "v_laura", source: "instagram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: laura.id, productId: pCourse.id, orderId: o1.order.id, createdAt: daysAgo(20, 21, 14) } });
  for (const [i, lessonId] of lessonIds.slice(0, 3).entries())
    await prisma.lessonProgress.create({ data: { creatorId: ana.id, userId: laura.id, productId: pCourse.id, lessonId, completedAt: daysAgo(19 - i * 4) } });

  const o2 = await buy({ user: laura, product: pGK, at: daysAgo(12, 10, 32), visitor: "v_laura", source: "instagram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: laura.id, productId: pGK.id, orderId: o2.order.id, createdAt: daysAgo(12, 10, 32) } });

  const o3 = await buy({ user: laura, product: pHD, at: daysAgo(5, 18, 47), visitor: "v_laura", source: "telegram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: laura.id, productId: pHD.id, orderId: o3.order.id } });
  const bLaura = await prisma.booking.create({
    data: {
      creatorId: ana.id, productId: pHD.id, customerId: o3.customerId, userId: laura.id, orderId: o3.order.id, status: "CONFIRMED",
      startAt: madrid("2026-10-12T17:00"), endAt: madrid("2026-10-12T18:15"), meetingUrl: pHD.meetingUrl,
      customerNotes: "Nací el 3 de marzo de 1991 a las 06:40 en Valencia.", createdAt: daysAgo(5, 18, 47),
    },
  });

  const o4 = await buy({ user: carmen, product: p11, at: daysAgo(3, 13, 5), visitor: "v_carmen", source: "instagram" });
  await prisma.access.create({ data: { creatorId: ana.id, userId: carmen.id, productId: p11.id, orderId: o4.order.id } });
  const bCarmen = await prisma.booking.create({
    data: {
      creatorId: ana.id, productId: p11.id, customerId: o4.customerId, userId: carmen.id, orderId: o4.order.id, status: "CONFIRMED",
      startAt: madrid("2026-10-15T10:00"), endAt: madrid("2026-10-15T11:00"), meetingUrl: p11.meetingUrl, createdAt: daysAgo(3, 13, 5),
    },
  });

  const o5 = await buy({ user: lucia, product: pCircle, at: daysAgo(16, 22, 10), visitor: "v_lucia", source: "tiktok" });
  const periodEnd = new Date(daysAgo(16, 22, 10));
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const sub = await prisma.subscription.create({
    data: {
      creatorId: ana.id, productId: pCircle.id, customerId: o5.customerId, userId: lucia.id, status: "ACTIVE", priceCents: 1900,
      interval: "month", currentPeriodStart: daysAgo(16, 22, 10), currentPeriodEnd: periodEnd, provider: "simulated", createdAt: daysAgo(16, 22, 10),
    },
  });
  await prisma.access.create({ data: { creatorId: ana.id, userId: lucia.id, productId: pCircle.id, orderId: o5.order.id, subscriptionId: sub.id, expiresAt: periodEnd } });

  // Emails enviados / programados (visibles en /dev/correo)
  const base = appUrl();
  await prisma.emailMessage.createMany({
    data: [
      { creatorId: ana.id, to: laura.email, subject: "Compra confirmada: Lectura de Human Design", template: "PURCHASE_RECEIPT", status: "SENT", sentAt: daysAgo(5, 18, 48), sendAt: daysAgo(5, 18, 48), html: `<p>Hola Laura, gracias por tu compra. <a href="${base}/cuenta">Acceder a mi contenido</a></p>` },
      { creatorId: ana.id, to: laura.email, subject: "Reserva confirmada · lunes, 12 de octubre · 17:00", template: "BOOKING_CONFIRMED", status: "SENT", sentAt: daysAgo(5, 18, 48), sendAt: daysAgo(5, 18, 48), html: `<p>Tu sesión está reservada: lunes, 12 de octubre · 17:00. <a href="${base}/cuenta/sesiones/${bLaura.id}">Ver detalles</a></p>` },
      { creatorId: ana.id, to: laura.email, subject: "Recordatorio: mañana tienes tu sesión", template: "SESSION_REMINDER", status: "QUEUED", sendAt: madrid("2026-10-11T17:00"), dedupeKey: `reminder:${bLaura.id}:${bLaura.startAt!.toISOString()}`, html: `<p>Te recordamos tu sesión Lectura de Human Design: lunes, 12 de octubre · 17:00.</p>` },
      { creatorId: ana.id, to: carmen.email, subject: "Recordatorio: mañana tienes tu sesión", template: "SESSION_REMINDER", status: "QUEUED", sendAt: madrid("2026-10-14T10:00"), dedupeKey: `reminder:${bCarmen.id}:${bCarmen.startAt!.toISOString()}`, html: `<p>Te recordamos tu Sesión 1:1: jueves, 15 de octubre · 10:00.</p>` },
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
      referralCode: "MARIASOL", createdAt: daysAgo(48),
    },
  });
  const medMaria = storePrivate(maria.id, "meditacion-dormir.wav", makeWav(30));
  const mMed = await prisma.product.create({
    data: { creatorId: maria.id, type: "DIGITAL", status: "PUBLISHED", slug: "meditacion-dormir", title: "Meditación guiada para dormir", emoji: "🌙", summary: "20 minutos para soltar el día y dormir profundo.", description: "Audio de meditación guiada con respiración 4-7-8.", imageUrl: "/demo/maria-meditacion.webp", priceCents: 1200, sortOrder: 1 },
  });
  await prisma.productFile.create({ data: { creatorId: maria.id, productId: mMed.id, name: "Meditación para dormir.wav", kind: "AUDIO", mimeType: "audio/wav", ...medMaria } });
  await prisma.product.create({
    data: { creatorId: maria.id, type: "DIGITAL", status: "PUBLISHED", slug: "programa-respira-21", title: "Programa Respira · 21 días", emoji: "🌿", summary: "Una práctica corta al día para regular tu sistema nervioso.", imageUrl: "/demo/maria-respira.webp", priceCents: 3900, sortOrder: 2 },
  });
  const mSes = await prisma.product.create({
    data: { creatorId: maria.id, type: "SESSION", status: "PUBLISHED", slug: "yoga-terapeutico", title: "Yoga terapéutico 1:1", emoji: "🧘", summary: "Sesión individual adaptada a tu cuerpo y tu momento.", imageUrl: "/demo/maria-sesion.webp", priceCents: 5500, durationMin: 60, bufferMin: 15, minNoticeHours: 12, sortOrder: 3 },
  });
  await prisma.availabilityRule.createMany({ data: [2, 4].map((wd) => ({ creatorId: maria.id, weekday: wd, startMinute: 540, endMinute: 780 })) });
  const carmenMaria = await prisma.customer.create({
    data: { creatorId: maria.id, userId: carmen.id, email: carmen.email, name: carmen.name, totalSpentCents: 1200, ordersCount: 1, firstPurchaseAt: daysAgo(8), lastPurchaseAt: daysAgo(8), createdAt: daysAgo(8) },
  });
  const mOrder = await prisma.order.create({
    data: {
      creatorId: maria.id, customerId: carmenMaria.id, productId: mMed.id, productTitle: mMed.title, productType: "DIGITAL", buyerEmail: carmen.email, buyerName: carmen.name,
      status: "PAID", amountCents: 1200, commissionBps: creatorPlan.commissionBps, platformFeeCents: 60, netCents: 1140, paymentProvider: "simulated", paymentRef: "sim_ch_seed_maria", createdAt: daysAgo(8), paidAt: daysAgo(8),
    },
  });
  await prisma.transaction.create({ data: { creatorId: maria.id, orderId: mOrder.id, type: "CHARGE", description: mMed.title, amountCents: 1200, platformFeeCents: 60, netCents: 1140, provider: "simulated", createdAt: daysAgo(8) } });
  await prisma.access.create({ data: { creatorId: maria.id, userId: carmen.id, productId: mMed.id, orderId: mOrder.id, createdAt: daysAgo(8) } });
  const mariaEvents: Prisma.AnalyticsEventCreateManyInput[] = [];
  for (let d = 30; d >= 0; d--)
    for (let v = 0; v < 6 + (d % 5); v++)
      mariaEvents.push({ creatorId: maria.id, type: "PAGE_VIEW", visitorId: `m_${d}_${v}`, source: v % 3 ? "instagram" : "direct", createdAt: new Date(NOW.getTime() - d * DAY - v * 3600_000) });
  await prisma.analyticsEvent.createMany({ data: mariaEvents });
  await prisma.analyticsEvent.create({ data: { creatorId: maria.id, type: "PURCHASE", productId: mMed.id, visitorId: "m_8_1", amountCents: 1200, createdAt: daysAgo(8) } });
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
      referralCode: "SOFIAV", referredById: ana.id, createdAt: daysAgo(9),
    },
  });
  await prisma.product.createMany({
    data: [
      { creatorId: sofia.id, type: "DIGITAL", status: "PUBLISHED", slug: "guia-bio-instagram", title: "Guía: tu bio de Instagram que vende", emoji: "✍️", summary: "Plantillas y ejemplos para escribir una bio clara en 15 minutos.", priceCents: 1900, sortOrder: 1 },
      { creatorId: sofia.id, type: "DIGITAL", status: "PUBLISHED", slug: "workbook-mensaje", title: "Workbook: encuentra tu mensaje", emoji: "📓", summary: "30 preguntas para definir qué haces, para quién y por qué.", priceCents: 2700, sortOrder: 2 },
    ],
  });
  await prisma.referral.create({
    data: { referrerId: ana.id, referredId: sofia.id, status: "REWARDED", rewardType: "FREE_MONTH", rewardValue: 2900, rewardedAt: daysAgo(8) },
  });
  await prisma.creator.update({ where: { id: ana.id }, data: { creditCents: 2900 } });

  const counts = {
    usuarios: await prisma.user.count(),
    creadoras: await prisma.creator.count(),
    productos: await prisma.product.count(),
    pedidos: await prisma.order.count(),
    reservas: await prisma.booking.count(),
    eventos: await prisma.analyticsEvent.count(),
  };
  console.log("✓ Listo:", counts);
  console.log("  Cuentas demo (contraseña demo1234): ana@cirella.app · laura@example.com · admin@cirella.app");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
