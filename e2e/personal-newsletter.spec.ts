import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";

/**
 * Newsletter propia en la web personal (puerto 3101, iPhone 13):
 *   · una visitante se apunta en la portada → «Confirma que quieres recibir la newsletter» →
 *     «Sí, quiero recibirla» → confirmada;
 *   · la dueña escribe una newsletter desde el móvil (texto, imagen subida, botón), la ve en «Vista
 *     previa», se manda una prueba y la envía a una etiqueta; con las tareas programadas sale con su
 *     «Darme de baja», que la da de baja y cuenta en las estadísticas;
 *   · edita el email de acceso a lo gratis (y lo restaura), importa un CSV y lo exporta;
 *   · en la plataforma no hay newsletter.
 * Deja los datos de demostración como estaban.
 */

const PERSONAL = process.env.E2E_PERSONAL_URL ?? "http://localhost:3101";
const PLATFORM = process.env.E2E_BASE_URL ?? "http://localhost:3100";
test.use({ baseURL: PERSONAL });

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const TAG = `nl-e2e-${stamp}`;
const visitor = `${TAG}-eva@example.com`;
const rosa = `${TAG}-rosa@example.com`;
const CRON = readFileSync(".env", "utf8").match(/^CRON_SECRET="?([^"\n]+)"?/m)?.[1] ?? "";

let pageBefore: unknown = null;
let accessBefore: Awaited<ReturnType<typeof prisma.automation.findFirst>> = null;

test.beforeAll(async () => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  pageBefore = ana.pagePublished;
  accessBefore = await prisma.automation.findFirst({ where: { creatorId: ana.id, trigger: "ACCESS_GRANTED" } });
  // La dueña activa la sección «Newsletter» (Mi página › Secciones).
  const cfg = ana.pagePublished as { sections?: { key: string; enabled: boolean }[] };
  const sections = (cfg.sections ?? []).filter((s) => s.key !== "newsletter");
  await prisma.creator.update({ where: { id: ana.id }, data: { pagePublished: { ...cfg, sections: [...sections, { key: "newsletter", enabled: true, title: "Recibe mis lecturas del mes" }] } } });
});

test.afterAll(async () => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  await prisma.creator.update({ where: { id: ana.id }, data: { pagePublished: pageBefore as never } });
  const campaigns = await prisma.campaign.findMany({ where: { creatorId: ana.id, subject: { contains: TAG } }, select: { id: true } });
  await prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, { campaignId: { in: campaigns.map((c) => c.id) } }, { template: "NEWSLETTER_TEST", subject: { contains: TAG } }] } });
  await prisma.campaign.deleteMany({ where: { id: { in: campaigns.map((c) => c.id) } } });
  await prisma.subscriber.deleteMany({ where: { email: { startsWith: TAG } } });
  const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const orders = await prisma.order.findMany({ where: { buyerEmail: { startsWith: TAG } }, select: { id: true } });
  await prisma.outboxEvent.deleteMany({ where: { OR: orders.map((o) => ({ payload: { path: ["orderId"], equals: o.id } })) } }).catch(() => {});
  await prisma.orderLink.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
  await prisma.access.deleteMany({ where: { userId: { in: ids } } });
  await prisma.lessonProgress.deleteMany({ where: { userId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  const customers = await prisma.customer.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await prisma.outboxEvent.deleteMany({ where: { OR: customers.map((c) => ({ payload: { path: ["customerId"], equals: c.id } })) } }).catch(() => {});
  await prisma.customer.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.automation.deleteMany({ where: { creatorId: ana.id, trigger: "ACCESS_GRANTED" } });
  if (accessBefore) await prisma.automation.create({ data: { ...accessBefore, design: accessBefore.design ?? undefined } as never });
  await prisma.$disconnect();
});

/** Enlace (por su texto) del último email de esa plantilla a `to`. */
async function mailLink(to: string, template: string, label: string) {
  const m = await prisma.emailMessage.findFirstOrThrow({ where: { to, template }, orderBy: { createdAt: "desc" } });
  const href = m.html.match(new RegExp(`<a href="([^"]+)"[^>]*>${label}</a>`))?.[1];
  if (!href) throw new Error(`El email ${template} a ${to} no tiene «${label}»`);
  return href.replace(/&amp;/g, "&");
}

async function loginAna(page: Page) {
  await page.goto("/login");
  await page.locator("form", { hasText: "Cirella" }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test.describe.serial("Web personal · newsletter", () => {
  test("una visitante se apunta en la portada y lo confirma desde su email", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/");
    const form = page.getByTestId("newsletter-section");
    await expect(form.getByRole("heading", { name: "Recibe mis lecturas del mes" })).toBeVisible();
    await expect(form.getByText(/Te enviaré un email para confirmar/)).toBeVisible();
    await form.getByLabel("Nombre (opcional)").fill("Eva");
    await form.getByLabel("Email").fill(visitor);
    await form.getByRole("button", { name: "Apuntarme" }).click();
    await expect(page.getByText("Revisa tu email y confirma")).toBeVisible();
    const pending = await prisma.subscriber.findFirstOrThrow({ where: { email: visitor } });
    expect(pending.status).toBe("PENDING");
    expect(pending.consentText).toContain("newsletter de Cirella");

    await page.goto(await mailLink(visitor, "NEWSLETTER_CONFIRM", "Sí, quiero recibirla"));
    await expect(page.getByRole("heading", { name: /¿Quieres recibir la newsletter/ })).toBeVisible();
    expect((await prisma.subscriber.findFirstOrThrow({ where: { email: visitor } })).status).toBe("PENDING");
    await page.getByRole("button", { name: "Sí, quiero recibirla" }).click();
    await expect(page.getByRole("heading", { name: "¡Listo! Ya estás dentro" })).toBeVisible();
    expect((await prisma.subscriber.findFirstOrThrow({ where: { email: visitor } })).status).toBe("CONFIRMED");
    await ctx.close();
  });

  test("la dueña escribe la newsletter en el móvil, se manda una prueba y la envía; la baja cuenta", async ({ page, request, browser }) => {
    await loginAna(page);
    await page.goto("/panel/newsletter");
    await expect(page.getByRole("link", { name: /La luna llena de octubre/ })).toBeVisible();
    await page.getByRole("button", { name: "Nueva newsletter" }).click();
    await page.waitForURL(/\/panel\/newsletter\/c[a-z0-9]+$/);
    await page.getByLabel("Asunto").fill(`Luna nueva ${TAG}`);
    await page.getByLabel("Texto", { exact: true }).fill(`Hola de nuevo. **Plazas abiertas** ${TAG}.`);
    await page.getByLabel("A quién").selectOption({ label: `Etiqueta «${TAG}»` });
    await expect(page.getByTestId("segment-count")).toHaveText(/Se enviará a 1 persona/);

    // Imagen de cabecera (como una exportación de Canva) y un botón.
    await page.getByRole("button", { name: "Añadir bloque" }).click();
    await page.getByRole("group", { name: "Añadir bloque" }).getByRole("button", { name: /^Imagen/ }).click();
    const png = await sharp({ create: { width: 900, height: 400, channels: 3, background: "#4a3f8f" } }).png().toBuffer();
    await page.locator('input[type=file][aria-label="Imagen"]').setInputFiles({ name: "cabecera-canva.png", mimeType: "image/png", buffer: png });
    await expect(page.locator('[data-block="image"] img')).toHaveAttribute("src", /\/media\/[a-z0-9]+\/[a-f0-9]{20}\.jpg$/);
    await page.getByLabel("Qué se ve (texto alternativo)").fill("Luna nueva");
    await page.getByRole("button", { name: "Añadir bloque" }).click();
    await page.getByRole("group", { name: "Añadir bloque" }).getByRole("button", { name: /^Botón/ }).click();
    await page.getByLabel("Texto del botón").fill("Reservar mi plaza");
    await page.getByRole("textbox", { name: "Enlace", exact: true }).fill("/ana/human-design-reading");
    await expect(page.getByTestId("save-state")).toHaveText(/Guardado/, { timeout: 20_000 });

    await page.getByRole("tab", { name: "Vista previa" }).click();
    const frame = page.frameLocator('iframe[title="Vista previa del email"]');
    await expect(frame.getByText(`Plazas abiertas`)).toBeVisible();
    await expect(frame.getByRole("link", { name: "Reservar mi plaza" })).toBeVisible();
    await expect(frame.getByText("Darme de baja")).toBeVisible();
    await page.getByRole("tab", { name: "Editar" }).click();

    await page.getByRole("button", { name: "Enviarme una prueba" }).click();
    await expect(page.getByText(/Prueba enviada a ana@cirella.app/)).toBeVisible();
    const testMail = await prisma.emailMessage.findFirstOrThrow({ where: { template: "NEWSLETTER_TEST", subject: { contains: TAG } } });
    expect(testMail.subject).toBe(`[Prueba] Luna nueva ${TAG}`);
    expect(testMail.html).toMatch(/\/media\/[a-z0-9]+\/[a-f0-9]{20}\.jpg/);

    await page.getByRole("button", { name: "Enviar ahora" }).click();
    await expect(page.getByRole("dialog")).toContainText("Se enviará a 1 persona");
    await page.getByRole("dialog").getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText(/Enviadas/)).toBeVisible();

    const cron = await request.get("/api/cron", { headers: { Authorization: `Bearer ${CRON}` } });
    expect(cron.status()).toBe(200);
    const sent = await prisma.emailMessage.findFirstOrThrow({ where: { to: visitor, template: "NEWSLETTER" } });
    expect(sent.status).toBe("SENT");
    expect(sent.subject).toBe(`Luna nueva ${TAG}`);
    expect(sent.html).toContain("Cirella");
    expect((sent.headers as Record<string, string>)["List-Unsubscribe"]).toContain("/unsubscribe/newsletter/one-click?t=");

    const ctx = await browser.newContext();
    const reader = await ctx.newPage();
    await reader.goto(await mailLink(visitor, "NEWSLETTER", "Darme de baja"));
    await reader.getByRole("button", { name: "Darme de baja" }).click();
    await expect(reader.getByRole("heading", { name: "Hecho" })).toBeVisible();
    await ctx.close();
    expect((await prisma.subscriber.findFirstOrThrow({ where: { email: visitor } })).status).toBe("UNSUBSCRIBED");
    await page.reload();
    await expect(page.getByTestId("sent-count")).toHaveText("1");
    await expect(page.getByTestId("unsub-count")).toHaveText("1");
  });

  test("edita el email de acceso a lo gratis: lo usa el siguiente acceso y se puede restaurar", async ({ page, browser }) => {
    await loginAna(page);
    await page.goto("/panel/newsletter/emails");
    await page.getByRole("link", { name: /Acceso a un contenido gratis/ }).click();
    await page.getByLabel("Asunto").fill("Tu regalo, {nombre}");
    await page.getByLabel("Texto", { exact: true }).fill(`¡Qué alegría, {nombre}! Aquí tienes **{producto}**. ${TAG}`);
    await page.getByRole("tab", { name: "Vista previa" }).click();
    await expect(page.getByTestId("preview-subject")).toHaveText("Tu regalo, Laura");
    await expect(page.frameLocator('iframe[title="Vista previa del email"]').getByText(/Qué alegría, Laura/)).toBeVisible();
    await page.getByRole("tab", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado: los próximos emails saldrán así.")).toBeVisible();

    const ctx = await browser.newContext();
    const v = await ctx.newPage();
    await v.goto("/ana/natal-chart-in-3-steps");
    await v.fill("#claim-name", "Rosa");
    await v.fill("#claim-email", rosa);
    await v.getByLabel(/política de privacidad/).check();
    await v.getByRole("button", { name: /Quiero el mini-curso/ }).click();
    await expect(v.getByText("¡Listo! Revisa tu email")).toBeVisible();
    await ctx.close();
    await expect.poll(async () => (await prisma.emailMessage.findFirst({ where: { to: rosa, template: "ACCESS_GRANTED" } }))?.subject).toBe("Tu regalo");
    const mail = await prisma.emailMessage.findFirstOrThrow({ where: { to: rosa, template: "ACCESS_GRANTED" } });
    expect(mail.html).toContain(TAG);
    expect(mail.html).toContain("No necesitas contraseña");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Restaurar el original" }).click();
    await expect(page.getByRole("button", { name: "Restaurar el original" })).toHaveCount(0);
    await page.goto("/panel/newsletter/emails");
    await expect(page.getByRole("link", { name: /Acceso a un contenido gratis/ })).toContainText("Original");
  });

  test("en la plataforma no hay newsletter (ni en el menú ni en la página)", async ({ page }) => {
    await page.goto(`${PLATFORM}/login`);
    await page.locator("form", { hasText: "Cirella" }).getByRole("button").click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.goto(`${PLATFORM}/panel/mas`);
    await expect(page.getByRole("link", { name: "Automatizaciones" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Newsletter" })).toHaveCount(0);
    expect((await page.request.get(`${PLATFORM}/panel/newsletter`)).status()).toBe(404);
    await page.goto(`${PLATFORM}/ana`);
    await expect(page.getByTestId("newsletter-section")).toHaveCount(0);
  });
});
