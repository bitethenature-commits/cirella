import { expect, test, type Page } from "@playwright/test";

/**
 * Fiabilidad: un fallo del proveedor de email no rompe el pago, el envío queda a la vista
 * (panel de la creadora y /admin/envios) y se puede reintentar o descartar; las páginas de error
 * y de «no encontrado» de una creadora llevan su plantilla; /api/health responde.
 * El proveedor «log» simula un fallo transitorio con las direcciones +fallo.
 */

const stamp = Date.now().toString().slice(-6);
const buyerEmail = `paula+fallo${stamp}@example.com`;

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

/** Casillas obligatorias del checkout: condiciones de venta y renuncia al desistimiento. */
async function acceptConsents(page: Page) {
  await page.getByLabel(/He leído y acepto/).check();
  // La renuncia la piden lo digital, los cursos, las membresías y los talleres a menos de 15 días (no las sesiones).
  const waiver = page.getByLabel(/Quiero acceder ya|Quiero que se prepare ya|Solicito expresamente/);
  if (await waiver.count()) await waiver.check();
}

test.describe.serial("Fiabilidad", () => {
  test("una compra se completa aunque el email del recibo falle", async ({ page }) => {
    await page.goto("/ana/gene-keys/checkout");
    await page.fill("#name", "Paula Fallo");
    await page.fill("#email", buyerEmail);
    await acceptConsents(page);
    await page.getByRole("button", { name: /Pagar/ }).click();
    await page.waitForURL("**/ana/gracias**");
    await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
  });

  test("la creadora ve que el recibo se está reintentando", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    await page.goto("/panel/automatizaciones");
    // Su registro de envíos: el recibo de Paula (el de bienvenida sigue programado, sin intentos).
    const rows = page.locator("div.px-4.py-3", { hasText: buyerEmail });
    await expect(rows.filter({ hasText: /Reintentando|No entregado/ })).toHaveCount(1);
  });

  test("/admin/envios: reintentar y descartar un envío fallido", async ({ page }) => {
    await demoLogin(page, "Superadmin");
    await page.goto("/admin/envios?ver=reintentando");
    await expect(page.getByRole("heading", { name: "Envíos fallidos" })).toBeVisible();
    const row = page.locator("li", { hasText: buyerEmail });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Intento 1 de 6");

    // Reintentar vuelve a empezar la cuenta: el proveedor vuelve a fallar → intento 1 de 6.
    await row.getByRole("button", { name: "Reintentar ahora" }).click();
    await expect(page.getByText("Reintento lanzado")).toBeVisible();
    await expect(page.locator("li", { hasText: buyerEmail })).toContainText("Intento 1 de 6");

    page.once("dialog", (d) => d.accept());
    await page.locator("li", { hasText: buyerEmail }).getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByText("Envío descartado")).toBeVisible();
    await expect(page.locator("li", { hasText: buyerEmail })).toHaveCount(0);
  });

  test("error con la plantilla de la creadora", async ({ page }) => {
    await page.goto("/ana/_prueba-error");
    await expect(page.getByRole("heading", { name: "Vaya, algo ha fallado al cargar esta página" })).toBeVisible();
    await expect(page.locator("header").getByText("Ana Luna")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("link", { name: "Volver a la página de Ana Luna" }).click();
    await page.waitForURL((u) => u.pathname === "/ana");
  });

  test("404 con la marca de la creadora y 404 neutro", async ({ page }) => {
    const res = await page.goto("/ana/producto-que-no-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Este contenido ya no está disponible" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver la página de Ana Luna" })).toBeVisible();

    await page.goto("/usuaria-inexistente-xyz");
    await expect(page.getByRole("heading", { name: "Esta página no existe… todavía" })).toBeVisible();
  });

  test("/api/health responde y /api/cron exige el secreto", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(health.headers()["cache-control"]).toContain("no-store");
    const body = await health.json();
    expect(body).toMatchObject({ ok: true, db: "ok", cron: { estado: "sin-configurar" } });

    const cron = await request.get("/api/cron");
    expect(cron.status()).toBe(401);
  });
});
