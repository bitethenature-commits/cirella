import { execFileSync } from "node:child_process";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { m4a } from "../scripts/fixtures/iso-media";

/**
 * Comunidad de Ana (web personal, puerto 3101):
 *   · programa una publicación con un audio desde el estudio Comunidad (/panel/comunidad, al que lleva
 *     «Nueva publicación» de la ficha); al llegar su hora, el aviso por email sale a sus
 *     miembros con un enlace personal que abre la publicación (audio, ♥; comentar pide entrar);
 *   · comentarios y moderación: comenta Lucía, responde Ana («Autora»), Ana borra y, desde el Muro
 *     del estudio, deja sin comentar a Lucía;
 *   · baja de los avisos con el enlace del email y vuelta a activarlos desde la comunidad;
 *   · acceso a mano con fecha de fin: termina solo (cron de caducidades), avisos y «Cambiar fecha»;
 *   · membresía que incluye un curso: lo ve en «Mis cursos» y lo pierde cuando termina la membresía;
 *   · la ficha pública no enseña las programadas (plataforma, puerto 3100).
 * Deja la BD como estaba.
 */

const PERSONAL = `http://localhost:${process.env.E2E_PERSONAL_PORT ?? 3101}`;
const PLATFORM = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
test.use({ baseURL: PERSONAL });

const TAG = `e2e-comunidad-${Date.now()}`;
const prisma = new PrismaClient();
const MADRID = "Europe/Madrid";

function runJob(job: "comunidad" | "caducidades") {
  return execFileSync("npx", ["tsx", "--conditions=react-server", "scripts/run-job.ts", job], {
    env: { ...process.env, APP_ENV: "test", SITE_MODE: "personal", OWNER_USERNAME: "ana", APP_URL: PERSONAL, EMAIL_PROVIDER: "log", STORAGE_DRIVER: "local", DEMO_MODE: "true", PAYMENT_PROVIDER: "none" },
    encoding: "utf8",
  });
}

async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await page.fill("#email", email);
  await page.fill("#password", "demo1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

const href = (html: string, label: string) => html.match(new RegExp(`<a href="([^"]+)"[^>]*>${label}</a>`))?.[1]?.replace(/&amp;/g, "&") ?? "";
const localValue = (d: Date) => d.toLocaleString("sv-SE", { timeZone: MADRID }).slice(0, 16).replace(" ", "T");

async function newPage(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: PERSONAL, timezoneId: MADRID });
  return { ctx, page: await ctx.newPage() };
}

test.describe.serial("Comunidad: publicaciones, avisos, comentarios y fin de acceso", () => {
  let circleId = "";
  let courseId = "";
  let postId = "";
  let lucia: { id: string; passwordHash: string | null; emailVerifiedAt: Date | null };
  let luciaAccess: { id: string; expiresAt: Date | null };

  test.beforeAll(async () => {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    circleId = (await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, slug: "luna-completa" } })).id;
    courseId = (await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, slug: "curso-conocete-tu-energia" } })).id;
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "lucia@example.com" } });
    lucia = { id: u.id, passwordHash: u.passwordHash, emailVerifiedAt: u.emailVerifiedAt };
    luciaAccess = await prisma.access.findFirstOrThrow({ where: { userId: u.id, productId: circleId }, select: { id: true, expiresAt: true } });
    // Con el email confirmado y contraseña, para entrar con su cuenta (como en pagos.spec.ts).
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hash("demo1234", 10), emailVerifiedAt: new Date() } });
  });

  test.afterAll(async () => {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const posts = await prisma.membershipPost.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } });
    await prisma.productFile.deleteMany({ where: { postId: { in: posts.map((p) => p.id) } } });
    await prisma.membershipPost.deleteMany({ where: { id: { in: posts.map((p) => p.id) } } });
    await prisma.membershipComment.deleteMany({ where: { body: { contains: TAG } } });
    await prisma.membershipComment.deleteMany({ where: { createdAt: { gte: new Date(Date.now() - 3600_000) }, creatorId: ana.id } });
    // Solo la inclusión del curso que añade la prueba: los niveles de abajo (Plena y Esencia) se quedan.
    await prisma.productInclusion.deleteMany({ where: { productId: circleId, includedProductId: courseId } });
    await prisma.user.update({ where: { id: lucia.id }, data: { passwordHash: lucia.passwordHash, emailVerifiedAt: lucia.emailVerifiedAt } });
    await prisma.access.update({ where: { id: luciaAccess.id }, data: { expiresAt: luciaAccess.expiresAt, status: "ACTIVE" } });
    await prisma.customer.updateMany({ where: { creatorId: ana.id }, data: { postEmailsOptOutAt: null, commentsBlockedAt: null } });
    const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
    const orders = await prisma.order.findMany({ where: { buyerEmail: { startsWith: TAG } }, select: { id: true } });
    await prisma.orderLink.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
    await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.access.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
    await prisma.customer.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.$disconnect();
  });

  test("Ana programa una publicación con audio y sus miembros reciben el aviso", async ({ page, browser }) => {
    await login(page, "ana@cirella.app");
    await page.goto(`/panel/productos/${circleId}`);
    await expect(page.getByText("Publicaciones de la comunidad")).toBeVisible();
    await page.getByRole("link", { name: "Nueva publicación" }).click();
    await page.waitForURL(/\/panel\/comunidad\?nivel=/);
    // El compositor sale abierto y con el nivel de la ficha elegido.
    await expect(page.getByRole("radio", { name: /Luna completa/ })).toBeChecked();
    await page.getByLabel("Título").fill(`${TAG} Meditación de luna llena`);
    await page.getByLabel("Texto de la publicación").fill("Escúchala esta noche con una vela encendida.");
    await page.getByTestId("post-attachments-input").setInputFiles({ name: "meditacion.m4a", mimeType: "audio/mp4", buffer: m4a({ durationSec: 840 }) });
    await expect(page.locator('[data-attachment="AUDIO"]')).toBeVisible();
    await expect(page.getByRole("radio", { name: "Audio" })).toBeChecked();
    await page.locator('label:has(input[value="schedule"])').click();
    await page.getByLabel("Día y hora").fill(localValue(new Date(Date.now() + 3600_000)));
    await expect(page.getByText(/Se publicará el .* \(hora de Madrid\)/)).toBeVisible();
    await page.getByRole("button", { name: "Programar", exact: true }).click();
    await page.waitForURL(/\/panel\/comunidad\?tab=programadas/);
    await expect(page.getByText(/Programada para el/).first()).toBeVisible();
    postId = (await prisma.membershipPost.findFirstOrThrow({ where: { title: `${TAG} Meditación de luna llena` } })).id;
    await expect(page.locator(`[data-queue-post="${postId}"]`)).toBeVisible();

    // Antes de su hora, la miembro no la ve aunque conozca la dirección del archivo.
    const file = await prisma.productFile.findFirstOrThrow({ where: { postId } });
    const early = await newPage(browser);
    await login(early.page, "lucia@example.com");
    expect((await early.page.request.get(`/api/stream/${file.id}`)).status()).toBe(403);
    await early.ctx.close();

    // Llega su hora: el cron envía el aviso.
    await prisma.membershipPost.update({ where: { id: postId }, data: { publishedAt: new Date(Date.now() - 60_000) } });
    runJob("comunidad");
    const mail = await prisma.emailMessage.findFirstOrThrow({ where: { to: "lucia@example.com", template: "MEMBER_POST", dedupeKey: `post:${postId}:${lucia.id}` } });
    expect((mail.headers as Record<string, string>)["List-Unsubscribe"]).toContain("/baja/comunidad/un-clic");
    expect(mail.html).toContain("Incluye: 1 audio (14 min)");

    const { ctx, page: member } = await newPage(browser);
    await member.goto(href(mail.html, "Leer la publicación"));
    await expect(member.getByRole("heading", { name: `${TAG} Meditación de luna llena` })).toBeVisible();
    expect(await member.locator("audio").first().getAttribute("src")).toMatch(/^\/api\/stream\//);
    await member.getByRole("button", { name: "Me gusta" }).click();
    await expect(member.getByRole("button", { name: /Quitar me gusta/ })).toContainText("Me gusta · 1");
    await expect(member.getByText("Para comentar, entra con tu email.")).toBeVisible();
    await ctx.close();
  });

  test("Comentarios y moderación", async ({ page, browser }) => {
    await login(page, "lucia@example.com");
    await page.goto(`/cuenta/membresias/${circleId}/${postId}`);
    await expect(page.getByText(/Se publicará como «Lucía T\.»/)).toBeVisible();
    await page.getByPlaceholder("Escribe un comentario…").fill(`Gracias, Ana ${TAG}`);
    await page.getByRole("button", { name: "Publicar comentario" }).click();
    await expect(page.getByPlaceholder("Escribe un comentario…")).toHaveValue("");
    await expect(page.locator("li p", { hasText: `Gracias, Ana ${TAG}` })).toBeVisible();
    const comment = await prisma.membershipComment.findFirstOrThrow({ where: { postId, body: { contains: TAG } } });
    expect(comment.authorName).toBe("Lucía T.");
    await expect.poll(() => prisma.emailMessage.count({ where: { dedupeKey: `comment:${comment.id}`, template: "COMMENT_NEW" } })).toBe(1);

    const owner = await newPage(browser);
    await login(owner.page, "ana@cirella.app");
    await owner.page.goto(`/cuenta/membresias/${circleId}/${postId}`);
    await owner.page.getByRole("button", { name: "Responder a Lucía T." }).click();
    await owner.page.getByPlaceholder("Escribe tu respuesta…").fill("¡Gracias a ti, Lucía!");
    await owner.page.getByRole("button", { name: "Responder", exact: true }).click();
    await expect(owner.page.locator("li p", { hasText: "¡Gracias a ti, Lucía!" })).toBeVisible();
    await expect(owner.page.getByText("Autora").first()).toBeVisible();
    const reply = await prisma.membershipComment.findFirstOrThrow({ where: { postId, parentId: comment.id } });
    await expect.poll(() => prisma.emailMessage.count({ where: { dedupeKey: `reply:${reply.id}`, to: "lucia@example.com" } })).toBe(1);

    owner.page.once("dialog", (d) => d.accept());
    await owner.page.locator(`#c-${comment.id}`).getByRole("button", { name: "Borrar comentario" }).first().click();
    await expect(owner.page.getByText("Comentario eliminado")).toBeVisible();

    // Moderación desde el Muro del estudio, en la propia publicación.
    await owner.page.goto(`/panel/comunidad?nivel=${circleId}`);
    const card = owner.page.locator(`[data-studio-post="${postId}"]`);
    await card.getByRole("button", { name: /Comentarios/ }).click();
    owner.page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "No dejar comentar a Lucía T." }).click();
    await expect(card.getByText("No puede comentar").first()).toBeVisible();
    await owner.ctx.close();

    await page.reload();
    await expect(page.getByText("No puedes comentar en esta comunidad.")).toBeVisible();
  });

  test("Baja de los avisos y vuelta a activarlos", async ({ page }) => {
    const mail = await prisma.emailMessage.findFirstOrThrow({ where: { to: "lucia@example.com", template: "MEMBER_POST", dedupeKey: `post:${postId}:${lucia.id}` } });
    await page.goto(href(mail.html, "Darme de baja"));
    await page.getByRole("button", { name: "Darme de baja" }).click();
    await expect(page.getByRole("heading", { name: "Listo" })).toBeVisible();
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const customer = await prisma.customer.findUniqueOrThrow({ where: { creatorId_userId: { creatorId: ana.id, userId: lucia.id } } });
    expect(customer.postEmailsOptOutAt).not.toBeNull();

    // Una publicación nueva ya no le llega.
    const p2 = await prisma.membershipPost.create({ data: { creatorId: ana.id, productId: circleId, title: `${TAG} Otra`, body: "x", publishedAt: new Date(Date.now() - 60_000) } });
    runJob("comunidad");
    expect(await prisma.emailMessage.count({ where: { dedupeKey: `post:${p2.id}:${lucia.id}` } })).toBe(0);

    await login(page, "lucia@example.com");
    await page.goto(`/cuenta/membresias/${circleId}`);
    await expect(page.getByText("Desactivados")).toBeVisible();
    await page.getByRole("button", { name: "Activar" }).click();
    await expect(page.getByText("Activados")).toBeVisible();
    await expect.poll(async () => (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).postEmailsOptOutAt).toBeNull();
  });

  test("Acceso a mano con fecha de fin: termina solo y se puede cambiar la fecha", async ({ page, browser }) => {
    const who = `${TAG}-programa@example.com`;
    await login(page, "ana@cirella.app");
    await page.goto(`/panel/productos/${circleId}#accesos`);
    const box = page.locator("#accesos");
    await page.fill("#grant-name", "Programa Tres");
    await page.fill("#grant-email", who);
    await box.locator("#grant-end").selectOption("1m");
    await expect(box.getByText(/Tendrá acceso hasta el .* \(incluido\)/).first()).toBeVisible();
    await box.getByRole("button", { name: "Dar acceso" }).click();
    await expect(box.getByText(new RegExp(`${who} ya tiene acceso hasta el`))).toBeVisible();
    await page.reload();
    const row = page.locator("#accesos li", { hasText: who });
    await expect(row).toContainText("Hasta el");
    const granted = await prisma.emailMessage.findFirstOrThrow({ where: { to: who, template: "ACCESS_GRANTED" } });
    expect(granted.html).toContain("Tu acceso dura hasta el");

    // Llega su fecha: sin acceso al momento y el cron lo cierra y avisa.
    const user = await prisma.user.findUniqueOrThrow({ where: { email: who } });
    const access = await prisma.access.findFirstOrThrow({ where: { userId: user.id, productId: circleId } });
    await prisma.access.update({ where: { id: access.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    const viewer = await newPage(browser);
    await viewer.page.goto(href(granted.html, "Entrar en la comunidad"));
    await expect(viewer.page.getByText(/Lo último|Pronto habrá|Ver publicaciones/)).toHaveCount(0);
    await viewer.ctx.close();
    runJob("caducidades");
    expect((await prisma.access.findUniqueOrThrow({ where: { id: access.id } })).status).toBe("EXPIRED");
    expect(await prisma.emailMessage.count({ where: { to: who, template: "ACCESS_ENDED" } })).toBe(1);
    expect(await prisma.emailMessage.count({ where: { template: "ACCESS_ENDED_OWNER", dedupeKey: { startsWith: `access-ended-owner:${access.id}` } } })).toBe(1);
    await page.reload();
    await expect(page.locator("#accesos li", { hasText: who })).toContainText("Terminó el");

    // «Volver a dar acceso» con 3 meses.
    const ended = page.locator("#accesos li", { hasText: who });
    await ended.getByText("Volver a dar acceso").click();
    await ended.getByLabel("Duración del acceso").selectOption("3m");
    await ended.getByRole("button", { name: "Guardar" }).click();
    await expect(ended.getByText(/Fecha cambiada/)).toBeVisible();
    await page.reload();
    await expect(page.locator("#accesos li", { hasText: who })).toContainText("Hasta el");
    expect((await prisma.access.findUniqueOrThrow({ where: { id: access.id } })).status).toBe("ACTIVE");
  });

  test("Una membresía que incluye un curso: lo ve mientras la membresía siga activa", async ({ page, browser }) => {
    const owner = await newPage(browser);
    await login(owner.page, "ana@cirella.app");
    await owner.page.goto(`/panel/productos/${circleId}#incluye`);
    const inc = owner.page.locator("#incluye");
    await inc.getByLabel(/Conócete a través de tu energía/).check();
    await inc.getByRole("button", { name: "Guardar" }).click();
    await expect(inc.getByText(/Guardado/)).toBeVisible();
    await owner.ctx.close();

    await login(page, "lucia@example.com");
    await page.goto("/cuenta/cursos");
    await expect(page.getByText("Incluido en «Luna completa» mientras tu membresía esté activa")).toBeVisible();
    await page.goto(`/cuenta/membresias/${circleId}`);
    await expect(page.getByText("Incluido en tu membresía")).toBeVisible();
    await page.goto(`/cuenta/cursos/${courseId}`);
    await expect(page.getByRole("heading", { name: "Conócete a través de tu energía" })).toBeVisible();

    await prisma.access.update({ where: { id: luciaAccess.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    await page.goto(`/cuenta/cursos/${courseId}`);
    await expect(page).toHaveURL(/\/cuenta\/cursos$/);
    await prisma.access.update({ where: { id: luciaAccess.id }, data: { expiresAt: luciaAccess.expiresAt } });
  });

  test("Plataforma: la ficha no enseña las programadas y la comunidad sembrada se ve", async ({ page }) => {
    await page.goto(`${PLATFORM}/ana/luna-completa`);
    await expect(page.getByText("Lo último en la comunidad")).toBeVisible();
    await expect(page.getByText("Venus entra en Escorpio")).toHaveCount(0);

    await page.goto(`${PLATFORM}/entrar`);
    await page.fill("#email", "lucia@example.com");
    await page.fill("#password", "demo1234");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
    await page.goto(`${PLATFORM}/cuenta/membresias/${circleId}`);
    await page.getByRole("link", { name: /Luna nueva en Libra/ }).click();
    await expect(page.getByText(/Mis tres intenciones ya están escritas/)).toBeVisible();
    await expect(page.locator('[data-post-file="PDF"]')).toHaveCount(1);
  });
});
