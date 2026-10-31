/**
 * Texto con formato contra Postgres (lib/rich-text.ts, lib/email/rich-html.ts).
 *   npm run test:rich-text     (con la BD sembrada: npm run db:reset)
 *
 *   · las columnas de formato se guardan por creadora (tenantDb) y lo de antes queda en NULL;
 *   · la lista pública de novedades da un extracto en texto plano de una publicación MD y el de
 *     siempre de una de antes;
 *   · el email de bienvenida (customer.created → outbox) pinta el formato, escapa el HTML y enseña
 *     el dominio real de los enlaces; uno de antes sale con el cuerpo de siempre (p(esc())).
 * Usa datos temporales de Ana y deja la BD como estaba.
 */
import "./load-env";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { esc, p } from "../lib/email/html";
import { SITE_NAME_TOKEN } from "../lib/email/templates";
import { emit } from "../lib/events";
import { getPublicPostList } from "../lib/public";
import { isPersonalMode } from "../lib/site-mode";
import { tenantDb } from "../lib/tenant";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `formato-${Date.now()}`;

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const db = tenantDb(ana.id);
  const created: { posts: string[]; products: string[]; users: string[] } = { posts: [], products: [], users: [] };
  const welcomeBefore = await prisma.automation.findUnique({ where: { creatorId_trigger: { creatorId: ana.id, trigger: "WELCOME" } } });
  try {
    // ── Columnas ──
    const legacyRows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "Post" WHERE "bodyFormat" IS NOT NULL AND slug NOT IN ('eclipse-de-octubre', 'luna-llena-que-soltar', 'nueva-lectura-de-gene-keys')`;
    check("las publicaciones de antes (salvo las de la demo con formato) siguen con formato NULL", Number(legacyRows[0].n) === 0, legacyRows);
    const seedMd = await prisma.post.findFirst({ where: { creatorId: ana.id, slug: "eclipse-de-octubre" } });
    check("la publicación de la demo «Eclipse de octubre» es MD", seedMd?.bodyFormat === "MD");

    const now = new Date();
    const md = await db.post.create({
      data: { creatorId: ana.id, slug: `${TAG}-md`, title: "Con formato", body: "## Subtítulo\n\n**Hola** _mundo_ y [enlace](https://x.es)", bodyFormat: "MD", status: "PUBLISHED", publishedAt: now },
    });
    const legacy = await db.post.create({
      data: { creatorId: ana.id, slug: `${TAG}-legacy`, title: "De antes", body: "**Hola** _mundo_ tal cual", status: "PUBLISHED", publishedAt: new Date(now.getTime() - 1000) },
    });
    created.posts.push(md.id, legacy.id);
    check("tenantDb guarda bodyFormat MD y deja NULL lo de antes", md.bodyFormat === "MD" && legacy.bodyFormat === null);

    const list = await getPublicPostList(ana.id, ana.timezone, 1);
    const mdCard = list.posts.find((x) => x.id === md.id);
    const legacyCard = list.posts.find((x) => x.id === legacy.id);
    check("extracto de una publicación MD: texto plano sin ** ni ##", mdCard?.excerpt === "Subtítulo Hola mundo y enlace", mdCard?.excerpt);
    check("extracto de una de antes: exactamente como siempre", legacyCard?.excerpt === "**Hola** _mundo_ tal cual", legacyCard?.excerpt);

    const course = await db.product.create({ data: { creatorId: ana.id, type: "COURSE", slug: `${TAG}-curso`, title: "Curso de prueba", priceCents: 0, descriptionFormat: "MD", description: "- uno" } });
    created.products.push(course.id);
    const mod = await db.courseModule.create({ data: { creatorId: ana.id, productId: course.id, title: "M1", sortOrder: 0 } });
    const lesson = await db.lesson.create({ data: { creatorId: ana.id, productId: course.id, moduleId: mod.id, title: "L1", kind: "TEXT", body: "## T", bodyFormat: "MD", sortOrder: 0 } });
    const legacyLesson = await db.lesson.create({ data: { creatorId: ana.id, productId: course.id, moduleId: mod.id, title: "L2", kind: "TEXT", body: "texto", sortOrder: 1 } });
    check("lecciones: MD y NULL", lesson.bodyFormat === "MD" && legacyLesson.bodyFormat === null);
    check("producto: descriptionFormat", course.descriptionFormat === "MD");
    const club = await db.product.create({ data: { creatorId: ana.id, type: "MEMBERSHIP", slug: `${TAG}-club`, title: "Club", priceCents: 900 } });
    created.products.push(club.id);
    const mp = await db.membershipPost.create({ data: { creatorId: ana.id, productId: club.id, title: "P", body: "**x**", bodyFormat: "MD" } });
    check("membresía: bodyFormat", mp.bodyFormat === "MD");

    // ── Email de bienvenida por la outbox ──
    await db.automation.upsert({
      where: { creatorId_trigger: { creatorId: ana.id, trigger: "WELCOME" } },
      create: { creatorId: ana.id, trigger: "WELCOME", enabled: true, delayMinutes: 0, message: "**Hola** <script>alert(1)</script>\n\n[mi web](https://evil.io)", messageFormat: "MD" },
      update: { enabled: true, delayMinutes: 0, message: "**Hola** <script>alert(1)</script>\n\n[mi web](https://evil.io)", messageFormat: "MD" },
    });
    const user = await prisma.user.create({ data: { email: `${TAG}@example.com`, name: "Prueba formato" } });
    created.users.push(user.id);
    const customer = await prisma.customer.create({ data: { creatorId: ana.id, userId: user.id, email: user.email, name: "Prueba" } });
    await emit({ type: "customer.created", customerId: customer.id });
    const mail = await prisma.emailMessage.findUnique({ where: { dedupeKey: `welcome:${customer.id}` } });
    const html = mail?.html ?? "";
    check("WELCOME con formato: negrita con estilo", /<strong[^>]*>Hola<\/strong>/.test(html), html.slice(0, 400));
    check("…el <script> sale escapado", html.includes("&lt;script&gt;") && !html.includes("<script>"));
    const visible = html.replace(/<[^>]+>/g, "");
    check("…el enlace enseña su dominio real: «mi web (evil.io)»", visible.includes("mi web (evil.io)"), visible.slice(0, 600));
    check(`…dedupeKey welcome:<id> (modo ${isPersonalMode() ? "personal" : "plataforma"})`, mail?.template === "WELCOME");
    check("…sin el marcador del nombre de la web", !html.includes(SITE_NAME_TOKEN) && !(mail?.subject ?? "").includes(SITE_NAME_TOKEN));
    await emit({ type: "customer.created", customerId: customer.id });
    check("…un segundo evento no lo duplica", (await prisma.emailMessage.count({ where: { dedupeKey: `welcome:${customer.id}` } })) === 1);

    // Mensaje de antes (formato NULL): el cuerpo de siempre.
    const legacyMessage = "Gracias por venir <3 & bienvenida";
    await db.automation.update({ where: { creatorId_trigger: { creatorId: ana.id, trigger: "WELCOME" } }, data: { message: legacyMessage, messageFormat: null } });
    const user2 = await prisma.user.create({ data: { email: `${TAG}-2@example.com` } });
    created.users.push(user2.id);
    const customer2 = await prisma.customer.create({ data: { creatorId: ana.id, userId: user2.id, email: user2.email } });
    await emit({ type: "customer.created", customerId: customer2.id });
    const mail2 = await prisma.emailMessage.findUnique({ where: { dedupeKey: `welcome:${customer2.id}` } });
    check("WELCOME de antes: exactamente p(esc(mensaje))", !!mail2?.html.includes(p(esc(legacyMessage))), mail2?.html.slice(0, 600));
  } finally {
    await prisma.emailMessage.deleteMany({ where: { to: { startsWith: TAG } } });
    await prisma.customer.deleteMany({ where: { userId: { in: created.users } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.post.deleteMany({ where: { id: { in: created.posts } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    if (welcomeBefore) {
      const { id: _id, creatorId: _c, trigger: _t, design, ...data } = welcomeBefore;
      await prisma.automation.update({ where: { id: welcomeBefore.id }, data: { ...data, design: design ?? Prisma.DbNull } });
    } else await prisma.automation.deleteMany({ where: { creatorId: ana.id, trigger: "WELCOME" } });
  }
  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nTodo bien ✓");
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
