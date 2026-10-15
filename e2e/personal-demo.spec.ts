import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

/**
 * Modo personal: lo que se vio al grabar la demo (servidor del puerto 3101, mismo build y BD).
 *   · un producto de pago en la web (oculto en la web personal) no se enlaza desde la página, sale
 *     como «Oculto» en el panel y guardarlo no lo regala;
 *   · la duración del curso en español, el código de descuento sin partirse al copiarlo y el login
 *     sin hablar de compras.
 * Los datos que crea los borra al terminar.
 */

test.use({ baseURL: process.env.E2E_PERSONAL_URL ?? "http://localhost:3101" });

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const TAG = `personal-demo-${stamp}`;
let paidId = "";

test.beforeAll(async () => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  // Una lectura de pago en la web, como las de la demo: en la web personal no se ve.
  const p = await prisma.product.create({
    data: { creatorId: ana.id, type: "DIGITAL", slug: TAG, title: `Lectura de prueba ${stamp}`, priceCents: 4900, status: "PUBLISHED", accessMode: "PAID", sortOrder: 98 },
  });
  await prisma.productFile.create({ data: { creatorId: ana.id, productId: p.id, name: "Lectura en PDF", kind: "LINK", url: "https://example.com/lectura.pdf" } });
  paidId = p.id;
});

test.afterAll(async () => {
  if (paidId) {
    await prisma.productFile.deleteMany({ where: { productId: paidId } });
    await prisma.product.deleteMany({ where: { id: paidId } });
  }
  await prisma.$disconnect();
});

async function ownerLogin(page: Page) {
  await page.goto("/entrar");
  await page.fill("#email", "ana@cirella.app");
  await page.fill("#password", "demo1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

test.describe.serial("Modo personal · detalles de la demo", () => {
  test("la página no enlaza los productos ocultos (el botón destacado de la demo lleva a un curso de pago)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ana Luna", level: 1 })).toBeVisible();
    // «✨ Empieza aquí · Curso Conócete» → /ana/curso-conocete-tu-energia, que en la web personal da 404.
    await expect(page.locator('a[href="/ana/curso-conocete-tu-energia"]')).toHaveCount(0);
    await expect(page.getByText(/Empieza aquí/)).toHaveCount(0);
    // Los demás botones siguen ahí.
    await expect(page.getByRole("link", { name: /Podcast «Cielo interior»/ })).toBeVisible();
  });

  test("la duración del mini-curso se escribe en minutos", async ({ page }) => {
    await page.goto("/ana/mini-curso-tu-carta-en-3-pasos");
    await expect(page.getByText("3 lecciones · 30 min").first()).toBeVisible();
    await expect(page.getByText("0.5 h")).toHaveCount(0);
  });

  test("el login no habla de compras", async ({ page }) => {
    await page.goto("/entrar");
    await expect(page.getByText("¿No tienes contraseña?")).toBeVisible();
    await expect(page.getByText(/Compraste/)).toHaveCount(0);
  });

  test("panel: lo que se cobraba en la web sale como oculto y guardarlo no lo regala", async ({ page }) => {
    await ownerLogin(page);
    await page.goto("/panel/productos");
    await expect(page.getByText(/tu plan/)).toHaveCount(0);
    const row = page.locator(".card", { hasText: `Lectura de prueba ${stamp}` });
    await expect(row.getByText("Oculto: se cobraba en la web")).toBeVisible();
    await expect(row.getByText("Publicado")).toHaveCount(0);
    await expect(row.getByRole("link", { name: "Ver" })).toHaveCount(0);

    await page.goto(`/panel/productos/${paidId}`);
    const modes = page.getByRole("radiogroup", { name: "Cómo se consigue" });
    await expect(modes.getByRole("radio", { name: /Oculto: se cobraba en la web/ })).toBeChecked();
    await expect(modes.getByRole("radio", { name: /Gratis con email/ })).not.toBeChecked();
    await expect(page.getByText("IVA incluido")).toHaveCount(0);

    // Cambiar solo el título y guardar: sigue de pago (oculto) y con su precio.
    await page.locator('input[name="title"]').fill(`Lectura de prueba ${stamp} (editada)`);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText(/No se ve en tu página/)).toBeVisible();
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: paidId } });
    expect(saved.title).toBe(`Lectura de prueba ${stamp} (editada)`);
    expect(saved.accessMode).toBe("PAID");
    expect(saved.priceCents).toBe(4900);

    // Elegir «Gratis con email» a propósito sí lo cambia.
    await modes.getByText("Gratis con email", { exact: true }).click();
    await expect(modes.getByRole("radio", { name: /Gratis con email/ })).toBeChecked();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Guardado y publicado en tu página")).toBeVisible();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: paidId } })).accessMode).toBe("FREE_EMAIL");
  });

  test.describe("en el móvil", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("el código de descuento no se parte al pulsar «Copiar código»", async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: process.env.E2E_PERSONAL_URL ?? "http://localhost:3101" });
      await page.goto("/");
      const card = page.getByRole("article", { name: "Código de descuento de Velas Alba" });
      await card.scrollIntoViewIfNeeded();
      const code = card.locator("code");
      const before = await code.boundingBox();
      await card.getByRole("button", { name: "Copiar código ANALUNA15" }).click();
      await expect(card.getByRole("button", { name: /Copiado/ })).toBeVisible();
      const after = await code.boundingBox();
      expect(after?.height).toBe(before?.height);
      expect(after?.width).toBe(before?.width);
      // Una sola línea de texto («ANALUNA15», no «ANALUNA1 / 5»).
      const lines = await code.evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      });
      expect(lines).toBe(1);
    });
  });
});
