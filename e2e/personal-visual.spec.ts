import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";

/**
 * Editor visual de la newsletter y «Personalizar mi panel» en la web personal (puerto 3101, iPhone 13):
 *   · la dueña monta una newsletter con portada (foto de fondo), un texto con palabras resaltadas y
 *     fondo, destacado, vídeo (con su portada ▶) y un botón bonito con fondo detrás, la ve en «Vista previa» y se manda una prueba con ese mismo HTML;
 *   · en Ajustes elige los colores «Tierra», sube «Newsletter» al segundo puesto y oculta «Códigos»:
 *     al recargar sigue así (barra de abajo, «Más» y colores) y «Restaurar» lo deja como venía.
 * Deja los datos de demostración como estaban.
 */

const PERSONAL = process.env.E2E_PERSONAL_URL ?? "http://localhost:3101";
test.use({ baseURL: PERSONAL });

const prisma = new PrismaClient();
const TAG = `visual-e2e-${`${Date.now()}`.slice(-7)}`;

test.afterAll(async () => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const campaigns = await prisma.campaign.findMany({ where: { creatorId: ana.id, subject: { contains: TAG } }, select: { id: true } });
  await prisma.emailMessage.deleteMany({ where: { OR: [{ campaignId: { in: campaigns.map((c) => c.id) } }, { template: "NEWSLETTER_TEST", subject: { contains: TAG } }] } });
  await prisma.campaign.deleteMany({ where: { id: { in: campaigns.map((c) => c.id) } } });
  await prisma.$executeRaw`UPDATE "Creator" SET "panelPrefs" = NULL WHERE id = ${ana.id}`;
  await prisma.$disconnect();
});

async function loginAna(page: Page) {
  await page.goto("/login");
  await page.locator("form", { hasText: "Cirella" }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

const addBlock = async (page: Page, name: RegExp) => {
  await page.getByRole("button", { name: "Añadir bloque" }).click();
  await page.getByRole("group", { name: "Añadir bloque" }).getByRole("button", { name }).click();
};

test.describe.serial("Editor visual y panel a su gusto", () => {
  test("newsletter con portada, destacado, vídeo y botón: vista previa y prueba", async ({ page }) => {
    await loginAna(page);
    await page.goto("/panel/newsletter");
    await page.getByRole("button", { name: "Nueva newsletter" }).click();
    await page.waitForURL(/\/panel\/newsletter\/c[a-z0-9]+$/);
    await page.getByLabel("Asunto").fill(`Luna llena ${TAG}`);

    // Estilo general: fondo de alrededor oscuro y títulos con Cormorant.
    await page.getByRole("button", { name: /Estilo del email/ }).click();
    await page.getByLabel("Fondo de alrededor (código)").fill("#14163A");
    await page.getByLabel("Tipo de letra de los títulos").selectOption("cormorant");

    const png = (color: string) => sharp({ create: { width: 1200, height: 600, channels: 3, background: color } }).png().toBuffer();

    // Portada con foto de fondo.
    await addBlock(page, /^Portada/);
    await page.locator('input[type=file][aria-label="Foto de fondo"]').setInputFiles({ name: "luna.png", mimeType: "image/png", buffer: await png("#2b2160") });
    await expect(page.locator('[data-block="hero"] img')).toHaveAttribute("src", /\/media\/[a-z0-9]+\/[a-f0-9]{20}\.jpg$/);
    await page.getByLabel("Título de la portada").fill(`Luna en Tauro ${TAG}`);
    await page.getByLabel("Subtítulo").fill("Lo que trae y cómo aprovecharla");
    await page.getByLabel("Qué se ve en la foto (texto alternativo)").fill("El cielo de noche");

    // El texto de siempre: unas palabras resaltadas con «Resaltar» y fondo de color detrás del bloque.
    const text = page.locator('[data-block="text"]').first();
    const area = page.getByLabel("Texto", { exact: true });
    await area.fill("Plazas abiertas para noviembre");
    await area.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 15));
    await text.getByRole("button", { name: "Resaltar" }).click();
    await expect(area).toHaveValue("==Plazas abiertas== para noviembre");
    await text.getByText("Colores y letra").click();
    await text.getByLabel("Fondo del bloque (código)").fill("#F1EEFB");
    await text.getByLabel("Esquinas redondeadas").check();

    // Destacado.
    await addBlock(page, /^Destacado/);
    await page.getByLabel("Título del destacado").fill("Ritual de esta semana");
    await page.getByLabel("Texto del destacado", { exact: true }).fill("Escribe tres cosas que quieres soltar.");

    // Vídeo de YouTube: sin internet no llega su miniatura, así que se sube una portada (le ponemos el ▶).
    await addBlock(page, /^Vídeo/);
    const video = page.locator('[data-block="video"]');
    await video.getByLabel("Enlace del vídeo").fill("https://youtu.be/dQw4w9WgXcQ");
    await video.getByLabel("Texto del enlace").fill("Mira la meditación");
    await video.locator('input[type=file][aria-label="Portada del vídeo"]').setInputFiles({ name: "portada.png", mimeType: "image/png", buffer: await png("#0e1024") });
    await expect(video.locator("img")).toHaveAttribute("src", /\/media\/[a-z0-9]+\/[a-f0-9]{20}\.jpg$/, { timeout: 20_000 });

    // Botón de todo el ancho y solo borde.
    await addBlock(page, /^Botón/);
    const button = page.locator('[data-block="button"]').last();
    await button.getByLabel("Texto del botón").fill("Reservar mi lectura");
    await button.getByRole("textbox", { name: "Enlace", exact: true }).fill("/ana/human-design-reading");
    await button.getByText("Forma y colores").click();
    await button.getByRole("button", { name: "Solo borde" }).click();
    await button.getByLabel("Todo el ancho").check();
    await button.getByLabel("Fondo detrás del botón (código)").fill("#F4EFE4");

    // Ordenar con ↑: la portada, arriba del todo.
    const up = page.locator('[data-block="hero"]').getByRole("button", { name: "Subir" });
    for (let i = 0; i < 6 && (await up.isEnabled()); i++) await up.click();
    await expect(page.locator("[data-block]").first()).toHaveAttribute("data-block", "hero");
    await expect(page.getByTestId("save-state")).toHaveText(/Guardado/, { timeout: 20_000 });

    await page.getByRole("tab", { name: "Vista previa" }).click();
    const frame = page.frameLocator('iframe[title="Vista previa del email"]');
    await expect(frame.getByRole("heading", { name: `Luna en Tauro ${TAG}` })).toBeVisible();
    await expect(frame.getByText("Ritual de esta semana")).toBeVisible();
    await expect(frame.getByRole("link", { name: /Mira la meditación/ }).last()).toHaveAttribute("href", "https://youtu.be/dQw4w9WgXcQ");
    await expect(frame.getByRole("link", { name: "Reservar mi lectura" })).toBeVisible();
    await page.getByRole("button", { name: "Ordenador" }).click();
    await expect(frame.getByText("Darme de baja")).toBeVisible();
    await page.getByRole("tab", { name: "Editar" }).click();

    await page.getByRole("button", { name: "Enviarme una prueba" }).click();
    await expect(page.getByText(/Prueba enviada a ana@cirella.app/)).toBeVisible();
    const mail = await prisma.emailMessage.findFirstOrThrow({ where: { template: "NEWSLETTER_TEST", subject: { contains: TAG } } });
    expect(mail.html).toMatch(/background="http:\/\/localhost:\d+\/media\/[a-z0-9]+\/[a-f0-9]{20}\.jpg"/);
    expect(mail.html).toContain("v:rect");
    expect(mail.html).toContain('bgcolor="#14163A"');
    expect(mail.html).toContain("Ritual de esta semana");
    expect(mail.html).toContain('href="https://youtu.be/dQw4w9WgXcQ"');
    expect(mail.html).toContain("border:2px solid");
    expect(mail.html).toContain("Cormorant+Garamond");
    expect(mail.html).toContain('background-color:#FCEFB4;padding:0 2px;border-radius:3px">Plazas abiertas</span>');
    expect(mail.html).toContain('bgcolor="#F1EEFB"');
    expect(mail.html).toContain('bgcolor="#F4EFE4"');
  });

  test("Personalizar mi panel: colores «Tierra», Newsletter segunda y Códigos oculta; se mantiene al recargar", async ({ page }) => {
    await loginAna(page);
    await page.goto("/panel/ajustes");
    const look = page.getByTestId("panel-look");
    await look.getByRole("button", { name: /Tierra/ }).click();
    // Vista previa en vivo: el panel entero ya lleva el acento.
    await expect(page.locator("[data-panel-root]")).toHaveAttribute("style", /--panel-accent:\s*#B4583F/i);

    const order = look.getByTestId("nav-order");
    for (let i = 0; i < 10; i++) {
      const second = await order.locator("li").nth(1).getAttribute("data-nav");
      if (second === "/panel/newsletter") break;
      await look.getByRole("button", { name: "Subir Newsletter" }).click();
    }
    await expect(order.locator("li").nth(1)).toHaveAttribute("data-nav", "/panel/newsletter");
    await look.getByRole("button", { name: "Ocultar Códigos" }).click();
    await look.getByRole("button", { name: "Guardar mi panel" }).click();
    await expect(look.getByText(/Guardado: así se verá tu panel/)).toBeVisible();

    await page.reload();
    await expect(page.locator("[data-panel-root]")).toHaveAttribute("style", /--panel-accent:\s*#B4583F/i);
    const bottom = page.locator("nav.fixed");
    await expect(bottom.getByRole("link").nth(1)).toHaveAttribute("href", "/panel/newsletter");
    await expect(bottom.getByRole("link").nth(4)).toHaveAttribute("href", "/panel/mas");
    await page.goto("/panel/mas");
    await expect(page.locator("main").getByRole("link", { name: "Newsletter" })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Códigos" })).toHaveCount(0);
    // La sección oculta sigue funcionando si se entra directamente.
    expect((await page.goto("/panel/codigos"))?.status()).toBe(200);

    // «Restaurar»: el panel de siempre.
    await page.goto("/panel/ajustes");
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("panel-look").getByRole("button", { name: "Restaurar" }).click();
    await expect(page.getByText(/vuelve a ser como venía/)).toBeVisible();
    await page.reload();
    expect((await page.locator("[data-panel-root]").getAttribute("style")) ?? "").not.toContain("--panel-accent");
    await expect(page.locator("nav.fixed").getByRole("link").nth(1)).toHaveAttribute("href", "/panel/productos");
  });
});
