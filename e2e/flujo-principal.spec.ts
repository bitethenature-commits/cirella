import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

/**
 * Instagram → página → producto → pago → entrega → clienta recurrente.
 * Recorre el flujo completo como lo haría una creadora nueva y su primera compradora.
 */

const stamp = Date.now().toString().slice(-6);
const username = `luna${stamp}`;
const creatorEmail = `creadora${stamp}@example.com`;
const buyerEmail = `compradora${stamp}@example.com`;

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

test.describe.serial("Flujo principal", () => {
  test("1. Landing → registro → onboarding de 10 pasos → «Tu página está lista»", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("negocio completo");
    await page.getByRole("link", { name: "Crear mi página" }).first().click();
    await page.waitForURL("**/registro**");

    await page.fill("#email", creatorEmail);
    await page.fill("#password", "secreto123");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await page.waitForURL("**/onboarding");

    const next = page.getByRole("button", { name: /Continuar|Lo haré más tarde/ });
    // 2. Usuario
    await page.getByPlaceholder("tunombre").fill(username);
    await expect(page.getByText("✓ Disponible")).toBeVisible();
    await next.click();
    // 3. Foto (se puede omitir)
    await expect(page.getByText("Sube tu foto")).toBeVisible();
    await next.click();
    // 4. Nombre y descripción
    await page.getByPlaceholder("Ana Luna").fill("Luna Prueba");
    await page.getByPlaceholder("Astrología · Human Design · Gene Keys").fill("Tarot · Astrología");
    await next.click();
    // 5. Categoría
    await page.getByRole("button", { name: /Tarot y oráculos/ }).click();
    await next.click();
    // 6. Estilo visual
    await expect(page.getByText("Elige tu estilo")).toBeVisible();
    await page.getByRole("button", { name: /Editorial/ }).click();
    await next.click();
    // 7. Primer producto
    await page.getByPlaceholder("Lectura de Astrología").fill("Tirada de tarot en PDF");
    await page.getByPlaceholder("Qué recibe tu clienta").fill("Tres cartas y su interpretación.");
    await next.click();
    // 8. Precio
    await page.getByPlaceholder("49").fill("29");
    await expect(page.getByText(/Recibirás/)).toBeVisible();
    await next.click();
    // 9. Pago
    await page.getByRole("button", { name: "Conectar cuenta de cobro" }).click();
    await expect(page.getByText(/Conectada/)).toBeVisible();
    await next.click();
    // 10. Publicar
    await page.getByRole("button", { name: "Publicar mi página" }).click();
    await page.waitForURL("**/onboarding/lista");
    await expect(page.getByRole("heading", { name: "Tu página está lista" })).toBeVisible();
    await expect(page.getByText(`/${username}`)).toBeVisible();
    for (const b of ["Copiar enlace", "Instagram", "WhatsApp", "Telegram", "Ver página"]) await expect(page.getByText(b, { exact: true }).first()).toBeVisible();
  });

  test("2. Compradora sin cuenta: página → producto → checkout → compra completada → su cuenta", async ({ page }) => {
    await page.goto(`/${username}`);
    await expect(page.getByRole("heading", { name: "Luna Prueba" })).toBeVisible();
    await page.getByRole("link", { name: /Comprar: Tirada de tarot/ }).click();
    await page.waitForURL(`**/${username}/**/checkout`);
    await page.fill("#name", "Paula Compradora");
    await page.fill("#email", buyerEmail);
    await page.getByRole("button", { name: /Pagar 29/ }).click();
    await page.waitForURL(`**/${username}/gracias**`);
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
    await expect(page.getByText("Tu contenido está disponible en tu cuenta.")).toBeVisible();
    // Cuenta creada automáticamente tras la compra
    await page.getByRole("link", { name: /Acceder a mi contenido/ }).click();
    await page.waitForURL("**/cuenta");
    await expect(page.getByRole("heading", { name: "Hola, Paula" })).toBeVisible();
    await expect(page.getByText("Tirada de tarot en PDF")).toBeVisible();
  });

  test("3. La venta aparece en el panel de la creadora", async ({ page }) => {
    await page.goto("/entrar");
    await page.fill("#email", creatorEmail);
    await page.fill("#password", "secreto123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/panel");
    await page.goto("/panel/ventas");
    await expect(page.getByText("Tirada de tarot en PDF").first()).toBeVisible();
    await page.goto("/panel/clientes");
    await expect(page.getByText("Paula Compradora")).toBeVisible();
  });

  test("4. Demo: la clienta de Ana ve su curso (43 %), su sesión y su PDF", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    await expect(page.getByRole("heading", { name: "Hola, Laura" })).toBeVisible();
    await expect(page.getByText("Progreso 43%")).toBeVisible();
    await expect(page.getByText(/12 de octubre · 17:00/)).toBeVisible();
    const download = page.getByRole("link", { name: "Descargar" }).first();
    await expect(download).toBeVisible();
    const res = await page.request.get((await download.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
  });

  test("5. Multi-tenant: Ana no puede abrir productos ni archivos de María; Laura tampoco", async ({ page }) => {
    const prisma = new PrismaClient();
    const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
    const product = await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id } });
    const file = await prisma.productFile.findFirstOrThrow({ where: { creatorId: maria.id } });
    const customer = await prisma.customer.findFirstOrThrow({ where: { creatorId: maria.id } });
    await prisma.$disconnect();

    await demoLogin(page, "Ana Luna");
    await expect(page).toHaveURL(/\/panel/);
    expect((await page.request.get(`/panel/productos/${product.id}`)).status()).toBe(404);
    expect((await page.request.get(`/panel/clientes/${customer.id}`)).status()).toBe(404);
    expect((await page.request.get(`/api/download/${file.id}`)).status()).toBe(403);

    await page.context().clearCookies();
    await demoLogin(page, "Laura Martín");
    expect((await page.request.get(`/api/download/${file.id}`)).status()).toBe(403);
  });
});
