/**
 * Una membresía de ejemplo completa, para ver cómo queda cada nivel con contenido de verdad:
 *   · Esencia (a página entera): textos energéticos largos con fotos, uno por semana, y dos fijados arriba.
 *   · Plena (a página entera, con filtros): podcast, meditaciones, Astroweather (vídeo + audio), masterclases
 *     (en directo, grabada y solo vídeo) y ceremonias (próxima y grabada), y un aviso fijado.
 *   · Luna completa: un círculo de la luna ya grabado.
 * Con comentarios, «me gusta» y textos guardados por Elena (sale en «Mis archivos»).
 *
 * Idempotente: borra lo que creó la vez anterior (por título) y lo vuelve a crear. Se llama desde el seed y
 * también se puede ejecutar sola sobre la base de datos local: `npx tsx prisma/demo-membership.ts`.
 * Los vídeos de ejemplo están en prisma/demo-media (sin ffmpeg); los audios se generan (lib demo-files).
 */
import "../scripts/load-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { makeM4a, makeWav } from "./demo-files";
import { mimeFromExt, privateKey, storage } from "../lib/storage";
import { parseMediaInfo } from "../lib/media-probe";
import { addDaysToKey, dateKeyInTz, zonedTimeToUtc } from "../lib/tz";

const TZ = "Europe/Madrid";
const ZOOM = "https://zoom.us/j/1234567890";

type Post = {
  tier: "esencia" | "plena" | "luna";
  title: string;
  kind: string;
  days: number; // hace cuántos días se publicó (negativo: aún no)
  body: string;
  pinned?: boolean;
  eventIn?: number; // el encuentro: dentro de cuántos días (negativo: ya pasó), a las 19:00
  zoom?: boolean;
  audio?: number; // segundos de audio
  video?: string; // prisma/demo-media/<nombre>.webm
};

const TIER_TEXTS: Record<string, { summary: string; description: string }> = {
  "essence": {
    "summary": "Un texto energético cada semana para vivir el cielo con calma.",
    "description": "La puerta de entrada a la comunidad: cada semana, un texto para leer el cielo y llevarlo a tu día a día.\n\nIncluye:\n• Un texto energético cada semana: la lectura del cielo de esos días y una práctica sencilla para vivirla\n• Cancela cuando quieras"
  },
  "full": {
    "summary": "Todo lo de Esencia, más podcast, meditaciones, Astroweather, masterclases y ceremonias.",
    "description": "Para vivir la comunidad a fondo, con la voz y en directo.\n\nIncluye:\n• Podcast privado: episodios para escuchar con calma donde quieras\n• Meditaciones guiadas: en audio, para cada fase de la luna y para tu día a día\n• Astroweather cada semana: el clima astrológico en vídeo y en audio\n• Masterclases: en directo y después grabadas, o directamente en vídeo\n• Ceremonias en directo: cacao, equinoccios, lunas llenas… y su grabación después\n• Cancela cuando quieras"
  },
  "full-moon": {
    "summary": "Todo lo de Plena y, además, los círculos de cada luna nueva y luna llena.",
    "description": "El nivel más completo de la comunidad: vivimos juntas cada luna.\n\nIncluye:\n• Círculos de la luna en directo: en cada luna nueva y cada luna llena, por Zoom\n• La grabación de cada círculo: por si no puedes venir ese día\n• Cancela cuando quieras"
  }
};

const COVERS = ["/demo/maria-meditacion.webp", "/demo/astrologia.webp", "/demo/maria-respira.webp", "/demo/comunidad.webp", "/demo/curso.webp", "/demo/maria-sesion.webp", "/demo/gene-keys.webp", "/demo/sesion.webp", "/demo/hero.webp", "/demo/human-design.webp", "/demo/ana-cover.webp", "/demo/maria-cover.webp"];
const img = (src: string, alt: string) => `![${alt}](/demo/${src}.webp)`;

const POSTS: Post[] = [
  // ───────────── Esencia: textos largos con fotos ─────────────
  {
    tier: "esencia", title: "Cómo leer Esencia: tu ritual de cada semana", kind: "TEXT", days: 30, pinned: true,
    body: `Cada lunes te dejo aquí un **texto energético**: una lectura del cielo de la semana y una práctica sencilla para vivirla.

${img("hero", "Un cuaderno abierto junto a una vela")}

## Cómo aprovecharlo

1. **Léelo despacio**, mejor por la mañana, con un café o una infusión.
2. **Guárdalo** con el botón de abajo si quieres volver a él: lo encontrarás en «Mis archivos», en Favoritos.
3. **Usa el calendario** de arriba para ir a cualquier semana anterior.
4. **Comenta**: leer lo que viven las demás también es parte de la práctica.

> No hace falta hacerlo todo. Con una sola frase que te acompañe durante la semana, ya es suficiente.

Gracias por estar aquí. Esta comunidad crece contigo 🌙`,
  },
  {
    tier: "esencia", title: "Luna llena en Tauro: el cuerpo también sabe", kind: "TEXT", days: 1,
    body: `Esta semana la Luna se llena en **Tauro**, el signo del cuerpo, de los sentidos y de lo que permanece. Después de semanas con mucha cabeza, el cielo nos pide **volver a casa**: al cuerpo, al plato de comida, a la cama a su hora.

${img("comunidad", "Manos sosteniendo una taza caliente")}

## Lo que se ilumina

Las lunas llenas muestran. Puede que esta semana veas con claridad **qué te nutre de verdad** y qué solo te llena el hueco un rato. Tauro no juzga: simplemente pregunta «¿esto te sienta bien?».

- Si llevas tiempo durmiendo poco, el cuerpo te lo dirá.
- Si gastas para calmar la ansiedad, también lo verás.
- Si hay algo que llevas tiempo construyendo, es buen momento para mirarlo con orgullo.

## La práctica de la semana

Elige **un placer sencillo al día** y vívelo con los cinco sentidos: una comida sin pantallas, un baño largo, caminar descalza por la hierba. Apunta cómo te sientes antes y después.

${img("ana-cover", "Un campo de trigo al atardecer")}

### Una pregunta para el diario

*¿Qué necesita mi cuerpo para sentirse a salvo esta semana?*

Escribe sin corregir. Y si te apetece, cuéntanos en los comentarios qué placer has elegido ✨`,
  },
  {
    tier: "esencia", title: "Mercurio retrógrado: revisar sin castigarte", kind: "TEXT", days: 8,
    body: `Mercurio empieza su retrogradación y, con ella, la fama de que «todo sale mal». Te propongo mirarlo de otra forma: **es una pausa para revisar**, no un castigo.

${img("astrologia", "Una carta astral dibujada a mano")}

## Qué suele pasar

- Mensajes que se cruzan, citas que cambian, aparatos que fallan.
- Personas del pasado que vuelven a aparecer.
- Proyectos que parecían cerrados y piden un último repaso.

Nada de esto es malo. Es la energía del **«re-»**: revisar, releer, reconsiderar, reparar.

## Cómo vivirlo con calma

1. **Deja margen** en tus planes: llega antes, guarda copias, confirma las citas.
2. **Termina antes de empezar**: es mejor momento para acabar lo pendiente que para lanzar algo nuevo.
3. **Escucha dos veces** antes de responder. Muchos malentendidos se deshacen solos al día siguiente.

> Lo que vuelve durante un retrógrado suele volver para cerrarse bien, no para quedarse.

### Para esta semana

Haz una lista de **tres cosas que dejaste a medias** y elige una para terminarla antes del domingo.`,
  },
  {
    tier: "esencia", title: "Entra el otoño: soltar como los árboles", kind: "TEXT", days: 15,
    body: `Con el Sol en Libra llega el **equinoccio de otoño**: el día y la noche miden lo mismo. Es un momento de equilibrio antes de que la luz empiece a menguar.

${img("curso", "Hojas de otoño sobre una mesa de madera")}

## La lección de los árboles

Los árboles no se aferran a sus hojas. Las sueltan cuando ya han dado todo lo que tenían que dar, y eso les permite **guardar su energía en la raíz** para el invierno.

¿Qué hojas te toca soltar a ti? Quizá una rutina que ya no te sirve, una conversación pendiente o una expectativa sobre ti misma.

## Un pequeño ritual

- Recoge **tres hojas secas** en un paseo.
- En cada una, escribe (o piensa) algo que quieres soltar.
- Déjalas en la tierra o en un río, y da las gracias.

${img("sesion", "Una vela encendida junto a una ventana")}

Nos vemos la semana que viene. Abrázate fuerte 🍂`,
  },
  {
    tier: "esencia", title: "Venus en Virgo: el amor en los detalles", kind: "TEXT", days: 22,
    body: `Venus pasa por **Virgo** y el amor se vuelve práctico: un café preparado como le gusta a la otra persona, una tarea hecha sin que nadie la pida, un mensaje que llega justo a tiempo.

${img("gene-keys", "Flores secas atadas con un cordel")}

## Querer bien

Virgo nos recuerda que querer también es **cuidar lo pequeño**. Y eso incluye cómo te cuidas a ti.

- ¿Te hablas con la misma amabilidad que a una amiga?
- ¿Te permites descansar sin ganártelo?
- ¿Celebras lo que haces bien, o solo ves lo que falta?

## La práctica

Cada noche de esta semana, escribe **tres cosas pequeñas que hiciste bien**. Solo tres. Sin «peros».

> La perfección no es el objetivo de Virgo. El objetivo es el servicio, y el primer servicio es a ti misma.`,
  },
  {
    tier: "esencia", title: "Luna nueva en Virgo: ordenar por dentro", kind: "TEXT", days: 29,
    body: `La **luna nueva en Virgo** es una invitación a sembrar orden: en la casa, en la agenda y en la mente.

${img("human-design", "Un escritorio ordenado con un cuaderno")}

## Sembrar intenciones

Escribe **tres intenciones** en presente y en positivo. Por ejemplo:

- «Me acuesto antes de las once.»
- «Dedico diez minutos al día a mi práctica.»
- «Pido ayuda cuando la necesito.»

Léelas en voz alta y guárdalas hasta la próxima luna llena. Entonces veremos qué ha brotado.

### Un consejo

No hace falta cambiarlo todo. **Una sola rutina** sostenida durante un ciclo lunar transforma más que diez propósitos a la vez.`,
  },

  // ───────────── Plena ─────────────
  {
    tier: "plena", title: "Calendario de Plena: lo que viene este mes", kind: "TEXT", days: 3, pinned: true,
    body: `Esto es lo que tenemos preparado este mes en Plena:

- 🎙 **Podcast** cada dos semanas.
- 🌿 **Meditaciones** nuevas para cada fase de la luna.
- ☁️ **Astroweather** cada lunes: vídeo y audio con el clima astrológico de la semana.
- 🎓 **Masterclass en directo**: tu Luna natal (la grabación queda aquí).
- 🔥 **Ceremonia de cacao** con la luna llena.

Usa los filtros de arriba para ver solo lo que te apetezca. Las sesiones en directo salen también en «Círculos y lecturas».`,
  },
  { tier: "plena", title: "Podcast · Episodio 8: vivir con la Luna sin obsesionarse", kind: "PODCAST", days: 2, audio: 30, body: "Un episodio para quitarle peso a la astrología: cómo usar los ciclos lunares como **brújula**, no como reglas. Hablamos de rutinas sencillas, de escuchar al cuerpo y de qué hacer cuando la vida no va al ritmo de la luna." },
  { tier: "plena", title: "Podcast · Episodio 9: Saturno, el maestro exigente", kind: "PODCAST", days: 16, audio: 30, body: "Saturno tiene mala fama, pero es el planeta que nos ayuda a **madurar**. En este episodio te cuento cómo leer su paso por tu carta y por qué sus lecciones, aunque duelan, dejan raíces firmes." },
  { tier: "plena", title: "Meditación de luna llena: soltar lo que pesa", kind: "MEDITACION", days: 1, audio: 40, body: "Quince minutos para **soltar**. Túmbate o siéntate cómoda, ponte cascos y deja que la voz te guíe. Mejor la noche de luna llena o en los tres días siguientes." },
  { tier: "plena", title: "Meditación para dormir: el cuerpo como un lago", kind: "MEDITACION", days: 10, audio: 40, body: "Una meditación para escuchar ya en la cama. Recorremos el cuerpo de los pies a la cabeza hasta que se queda **quieto como un lago**." },
  { tier: "plena", title: "Meditación de la mañana: tres respiraciones", kind: "MEDITACION", days: 19, audio: 25, body: "Cinco minutos para empezar el día con intención. Tres respiraciones largas, una palabra para el día y una sonrisa." },
  { tier: "plena", title: "Astroweather · semana del Sol en Escorpio", kind: "ASTROWEATHER", days: 0, video: "astroweather", audio: 30, body: "El clima astrológico de la semana en **vídeo** y en **audio** (para escucharlo mientras caminas).\n\n- El Sol entra en Escorpio: mirar hacia dentro.\n- Marte en trígono a Neptuno: actuar desde la intuición.\n- Día bonito para empezar algo: el jueves." },
  { tier: "plena", title: "Astroweather · semana de Mercurio retrógrado", kind: "ASTROWEATHER", days: 7, video: "astroweather", audio: 30, body: "Vídeo y audio para atravesar la semana con calma: **qué revisar, qué esperar y qué no forzar** durante el retrógrado." },
  { tier: "plena", title: "Masterclass en directo: tu Luna natal", kind: "MASTERCLASS", days: 4, eventIn: 5, zoom: true, body: "Una hora en directo para aprender a leer **tu Luna natal**: signo, casa, fase y aspectos. Ten tu carta a mano.\n\nSi no puedes venir, la grabación quedará aquí." },
  { tier: "plena", title: "Masterclass: las casas de la carta (grabada)", kind: "MASTERCLASS", days: 14, eventIn: -12, video: "masterclass", body: "La grabación de la masterclass sobre **las 12 casas**: qué área de la vida es cada una y cómo encontrar tus planetas en ellas. Incluye el turno de preguntas." },
  { tier: "plena", title: "Masterclass en vídeo: los cuatro elementos", kind: "MASTERCLASS", days: 25, video: "masterclass", body: "Una masterclass grabada (sin directo) sobre **fuego, tierra, aire y agua** en tu carta: cómo contarlos y qué hacer con el que te falta." },
  { tier: "plena", title: "Ceremonia de luna llena con cacao", kind: "CEREMONIA", days: 2, eventIn: 12, zoom: true, body: "Prepara tu taza de **cacao**, una vela y un rincón tranquilo. Abrimos con una meditación, compartimos intenciones y cerramos con un ritual de gratitud.\n\nLa grabación quedará aquí para quien no pueda venir." },
  { tier: "plena", title: "Ceremonia del equinoccio de otoño (grabada)", kind: "CEREMONIA", days: 20, eventIn: -18, video: "ceremonia", body: "La grabación de la ceremonia del **equinoccio**: el ritual de las tres hojas, la meditación del equilibrio y la ronda de intenciones." },

  // ───────────── Luna completa ─────────────
  { tier: "luna", title: "Círculo de luna llena en Aries (grabado)", kind: "CIRCULO_LUNAR", days: 26, eventIn: -24, video: "circulo", body: "La grabación del círculo de **luna llena en Aries**: el ritual del fuego, la escritura guiada y la ronda de compartir." },
];

const COMMENTS: { title: string; who: "laura" | "elena" | "owner"; body: string }[] = [
  { title: "Luna llena en Tauro: el cuerpo también sabe", who: "elena", body: "Elegí comer sin el móvil y fue increíble lo distinta que sabe la comida. Gracias por recordármelo 🌿" },
  { title: "Luna llena en Tauro: el cuerpo también sabe", who: "owner", body: "¡Qué bonito, Elena! A veces lo más sencillo es lo que más nos devuelve al cuerpo." },
  { title: "Luna llena en Tauro: el cuerpo también sabe", who: "laura", body: "Yo elegí el baño largo. Dormí como hacía semanas que no dormía." },
  { title: "Mercurio retrógrado: revisar sin castigarte", who: "laura", body: "Me ha ayudado mucho verlo como una pausa y no como un castigo. Ya he terminado una de mis tres cosas." },
  { title: "Meditación de luna llena: soltar lo que pesa", who: "laura", body: "La escuché anoche con la luna en la ventana. Me emocioné al final ✨" },
  { title: "Masterclass en directo: tu Luna natal", who: "laura", body: "¡Allí estaré! ¿Hace falta tener la hora de nacimiento exacta?" },
  { title: "Masterclass en directo: tu Luna natal", who: "owner", body: "Ayuda, pero no es imprescindible: la Luna cambia de signo cada dos días y medio, así que casi siempre se puede saber." },
];

const SAVED_BY_ELENA = ["Luna llena en Tauro: el cuerpo también sabe", "Entra el otoño: soltar como los árboles", "Cómo leer Esencia: tu ritual de cada semana"];

async function store(creatorId: string, name: string, data: Buffer) {
  const rel = `${creatorId}/${name}`;
  await storage().put(privateKey(rel), data, { contentType: mimeFromExt(rel) });
  return { storageKey: rel, sizeBytes: data.length };
}

async function duration(data: Buffer, mime: string) {
  const info = await parseMediaInfo(async (o, l) => data.subarray(o, o + l), data.length, mime);
  return info?.durationSec ?? null;
}

export async function seedDemoMembership(prisma: PrismaClient, anaId: string) {
  const tiers = await prisma.product.findMany({ where: { creatorId: anaId, type: "MEMBERSHIP", slug: { in: ["essence", "full", "full-moon"] } }, select: { id: true, slug: true } });
  const id = (t: Post["tier"]) => tiers.find((x) => x.slug === { esencia: "essence", plena: "full", luna: "full-moon" }[t])?.id;
  if (!id("esencia") || !id("plena")) {
    console.log("  (Sin las membresías Esencia y Plena: no se crean los ejemplos)");
    return;
  }
  // Lo de la vez anterior, fuera (con sus archivos, comentarios, «me gusta» y guardados).
  const old = await prisma.membershipPost.findMany({ where: { creatorId: anaId, title: { in: POSTS.map((p) => p.title) } }, select: { id: true } });
  if (old.length) {
    await prisma.productFile.deleteMany({ where: { postId: { in: old.map((o) => o.id) } } });
    await prisma.membershipPost.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }
  // Lo que incluye cada nivel, con detalle (la página para hacerse miembro lo enseña con sus iconos).
  for (const [slug, t] of Object.entries(TIER_TEXTS)) await prisma.product.updateMany({ where: { creatorId: anaId, type: "MEMBERSHIP", slug }, data: t });
  // Esencia se lee a página entera (Plena, no).
  await prisma.product.updateMany({ where: { id: id("esencia")! }, data: { pagedReading: true } });
  await prisma.product.updateMany({ where: { id: id("plena")! }, data: { pagedReading: false } });

  const today = dateKeyInTz(new Date(), TZ);
  const at = (days: number, hour: number) => zonedTimeToUtc(addDaysToKey(today, days), hour * 60, TZ);
  const m4a = makeM4a(30);
  const created = new Map<string, string>();
  for (const p of POSTS) {
    const productId = id(p.tier);
    if (!productId) continue;
    const publishedAt = at(-p.days, 8);
    const post = await prisma.membershipPost.create({
      data: {
        creatorId: anaId, productId, title: p.title, kind: p.kind, body: p.body, bodyFormat: "MD", publishedAt, notify: false, notifiedAt: publishedAt,
        pinnedAt: p.pinned ? publishedAt : null,
        eventAt: p.eventIn != null ? at(p.eventIn, 19) : null,
        mediaUrl: p.zoom ? ZOOM : null,
        // Portadas variadas para los ejemplos sin foto en el texto (los de Esencia la llevan dentro).
        imageUrl: p.tier === "esencia" ? null : COVERS[POSTS.indexOf(p) % COVERS.length],
      },
    });
    created.set(p.title, post.id);
    let order = 0;
    if (p.video) {
      const data = readFileSync(path.join("prisma", "demo-media", `${p.video}.webm`));
      const file = await store(anaId, `demo-${p.video}-${post.id.slice(-6)}.webm`, data);
      await prisma.productFile.create({ data: { creatorId: anaId, productId, postId: post.id, name: `${p.title.split(":")[0].split("(")[0].trim()}.webm`, kind: "VIDEO", mimeType: "video/webm", ...file, durationSec: 8, width: 640, height: 360, sortOrder: order++ } });
    }
    if (p.audio) {
      const data = m4a ?? makeWav(p.audio);
      const mime = m4a ? "audio/mp4" : "audio/wav";
      const ext = m4a ? "m4a" : "wav";
      const file = await store(anaId, `demo-audio-${post.id.slice(-6)}.${ext}`, data);
      await prisma.productFile.create({ data: { creatorId: anaId, productId, postId: post.id, name: `${p.kind === "ASTROWEATHER" ? "Audio · " : ""}${p.title.split(":")[0].trim()}.${ext}`, kind: "AUDIO", mimeType: mime, ...file, durationSec: await duration(data, mime), sortOrder: order++ } });
    }
  }

  // Comentarios, «me gusta» y lo que guarda Elena.
  const users = await prisma.user.findMany({ where: { email: { in: ["laura@example.com", "elena@example.com"] } }, select: { id: true, email: true, name: true } });
  const laura = users.find((u) => u.email === "laura@example.com");
  const elena = users.find((u) => u.email === "elena@example.com");
  const ana = await prisma.creator.findUnique({ where: { id: anaId }, select: { userId: true, displayName: true } });
  for (const c of COMMENTS) {
    const postId = created.get(c.title);
    const who = c.who === "owner" ? (ana ? { id: ana.userId, name: ana.displayName } : null) : c.who === "laura" ? laura : elena;
    if (!postId || !who) continue;
    const productId = (await prisma.membershipPost.findUnique({ where: { id: postId }, select: { productId: true } }))!.productId;
    await prisma.membershipComment.create({
      data: { creatorId: anaId, productId, postId, userId: who.id, body: c.body, byOwner: c.who === "owner", authorName: c.who === "owner" ? who.name ?? "Cirella" : `${(who.name ?? "").split(" ")[0]} ${(who.name ?? "").split(" ")[1]?.[0] ?? ""}.`.trim() },
    });
  }
  for (const [title, postId] of created) {
    const n = title.length % 3;
    for (const u of [laura, elena].slice(0, n)) if (u) await prisma.membershipPostLike.create({ data: { creatorId: anaId, postId, userId: u.id } }).catch(() => {});
  }
  if (elena)
    for (const t of SAVED_BY_ELENA) {
      const postId = created.get(t);
      if (postId) await prisma.membershipPostSave.create({ data: { creatorId: anaId, postId, userId: elena.id } }).catch(() => {});
    }
  console.log(`  Membresía de ejemplo: ${created.size} publicaciones en Esencia, Plena y Luna completa`);
}

// Ejecutado a mano: sobre la base de datos local, para la cuenta de Cirella.
if (process.argv[1] && /demo-membership\.ts$/.test(process.argv[1])) {
  const prisma = new PrismaClient();
  (async () => {
    const ana = await prisma.creator.findFirst({ where: { username: "ana" }, select: { id: true } });
    if (!ana) throw new Error("No encuentro la cuenta de Cirella (username «ana»).");
    await seedDemoMembership(prisma, ana.id);
  })()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
