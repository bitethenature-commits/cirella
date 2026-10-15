import { expect, test, type Page } from "@playwright/test";

/**
 * Modo personal (SITE_MODE=personal, OWNER_USERNAME=ana): la web de una sola dueña.
 * Usa el segundo servidor de playwright.config.ts (puerto 3101, mismo build, misma BD de demo):
 *   · la raíz es la página de Ana (con su título, favicon e imagen para redes) y /ana redirige a «/»;
 *   · las demás creadoras no existen (404) y no se puede crear una página;
 *   · la marca es «Ana Luna»: sin «Cirella» ni «Powered by» a la vista;
 *   · las páginas legales de la plataforma llevan a la de Ana (aviso legal y privacidad);
 *   · el panel sin planes ni cobros, con Inscripciones, Publicaciones y Códigos;
 *   · la administración reducida a envíos y ajustes.
 * No cambia datos de la demo.
 */

const PERSONAL = `http://localhost:${process.env.E2E_PERSONAL_PORT ?? 3101}`;
test.use({ baseURL: PERSONAL });

/** Texto visible de la página (sin scripts ni elementos ocultos). */
async function visibleText(page: Page) {
  return page.locator("body").innerText();
}

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

test.describe.serial("Modo personal", () => {
  test("la raíz es la página de Ana, con su SEO y sin la plataforma", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Ana Luna", level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/Ana Luna/);
    // La raíz (Next la escribe sin la barra final).
    const root = new RegExp(`^${PERSONAL}/?$`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", root);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", root);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /\/ana\/opengraph-image/);
    await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /\/ana\/icon/);
    const text = await visibleText(page);
    expect(text).not.toContain("Powered by");
    expect(text).not.toContain("Cirella");
    // El pie lleva a su página legal, no a la de la plataforma.
    await expect(page.getByRole("link", { name: "Aviso legal" })).toHaveAttribute("href", /^\/ana\/legal/);
  });

  test("/ana redirige a la raíz conservando la query", async ({ page }) => {
    await page.goto("/ana?utm_source=instagram");
    expect(page.url()).toBe(`${PERSONAL}/?utm_source=instagram`);
    await expect(page.getByRole("heading", { name: "Ana Luna", level: 1 })).toBeVisible();
    // Sus productos y su página legal siguen en /ana/…
    const legal = await page.goto("/ana/legal");
    expect(legal?.status()).toBe(200);
    expect(page.url()).toBe(`${PERSONAL}/ana/legal`);
  });

  test("las demás creadoras no existen", async ({ page }) => {
    for (const path of ["/sofia", "/maria", "/maria/legal"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
      expect(await visibleText(page)).not.toContain("Cirella");
    }
    // La imagen para redes: la de Ana existe; la de otra creadora, no (nada de una tarjeta «Cirella»).
    const og = await page.request.get("/ana/opengraph-image");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
    expect((await page.request.get("/maria/opengraph-image")).status()).toBe(404);
  });

  test("el favicon de las páginas de la web (login, panel…) es el de Ana", async ({ page }) => {
    await page.goto("/entrar");
    await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /\/ana\/icon/);
    await expect(page.locator('link[rel="icon"][href*="icon.svg"]')).toHaveCount(0);
  });

  test("registro cerrado y login con la marca de Ana", async ({ page }) => {
    await page.goto("/registro?ref=ANALUNA");
    await page.waitForURL("**/entrar");
    await expect(page).toHaveTitle("Entrar · Ana Luna");
    await expect(page.getByRole("link", { name: "Ana Luna inicio" })).toBeVisible();
    await expect(page.getByText("¿Aún no tienes página?")).toHaveCount(0);
    await expect(page.getByText("Plataforma")).toHaveCount(0);
    expect(await visibleText(page)).not.toContain("Cirella");
  });

  test("las páginas legales de la plataforma llevan a la de Ana, sin condiciones de venta", async ({ page }) => {
    await page.goto("/terminos");
    await page.waitForURL("**/ana/legal**");
    await page.goto("/privacidad");
    await page.waitForURL("**/ana/legal**");
    await expect(page.getByRole("heading", { name: "Aviso legal y privacidad", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Privacidad", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Otras webs", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Condiciones de venta" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Cambios y reembolsos" })).toHaveCount(0);
    const text = await visibleText(page);
    expect(text).not.toContain("Cirella");
    expect(text).not.toContain("Stripe");
  });

  test("el asistente de alta está cerrado para una clienta con sesión", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    await page.goto("/onboarding");
    await page.waitForURL("**/entrar?error=cerrado");
    await expect(page.getByText("En esta web no se pueden crear páginas nuevas")).toBeVisible();
    // El área de clienta lleva la marca de Ana.
    await page.goto("/cuenta");
    await expect(page.getByRole("link", { name: "Ana Luna inicio" })).toBeVisible();
    expect(await visibleText(page)).not.toContain("Cirella");
  });

  test("panel de la dueña: sin planes ni cobros, con Inscripciones, Publicaciones y Códigos", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    await page.waitForURL("**/panel");
    await expect(page.getByRole("heading", { name: "Hola, Ana" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ana Luna inicio" })).toBeVisible();
    const home = page.locator("main");
    await expect(home.getByText("Inscripciones", { exact: true }).first()).toBeVisible();
    await expect(home.getByText("Activa tus cobros")).toHaveCount(0);
    await expect(home.getByText("Ingresos")).toHaveCount(0);

    // Barra del móvil
    const bottom = page.locator("nav.fixed");
    await expect(bottom.getByRole("link", { name: "Inscripciones" })).toHaveAttribute("href", "/panel/ventas");
    await expect(bottom.getByRole("link", { name: "Ventas" })).toHaveCount(0);

    await page.goto("/panel/mas");
    const menu = page.locator("main");
    await expect(menu.getByRole("link", { name: "Publicaciones" })).toHaveAttribute("href", "/panel/publicaciones");
    await expect(menu.getByRole("link", { name: "Códigos" })).toHaveAttribute("href", "/panel/codigos");
    await expect(menu.getByRole("link", { name: "Inscripciones" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Plan", exact: true })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Mis compras como clienta" })).toHaveCount(0);

    // Lo de planes y cobros no existe aquí.
    await page.goto("/panel/plan");
    await page.waitForURL((u) => u.pathname === "/panel");
    await page.goto("/panel/ajustes/cobros");
    await page.waitForURL((u) => u.pathname === "/panel/ajustes");
    await expect(page.getByRole("heading", { name: "Invita a otras creadoras" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Cobros" })).toHaveCount(0);
    await expect(page.locator("#compartir").getByText(PERSONAL.replace(/^https?:\/\//, ""), { exact: true })).toBeVisible();
    expect(await visibleText(page)).not.toContain("Cirella");
  });

  test("administración reducida a envíos y ajustes", async ({ page }) => {
    await demoLogin(page, "Administración");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administración" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Envíos fallidos" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Creadoras" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Planes" })).toHaveCount(0);
    for (const path of ["/admin/creadoras", "/admin/planes", "/admin/impuestos", "/admin/reportes/dac7"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
    await page.goto("/admin/ajustes");
    await expect(page.getByRole("heading", { name: "Ajustes de la web" })).toBeVisible();
    await expect(page.getByText("Programa de referidos")).toHaveCount(0);
  });
});
