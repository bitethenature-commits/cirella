import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

/**
 * Modo personal · contenido de la página (servidor en modo personal, puerto 3101, web de Ana):
 *   · «Novedades» con las últimas publicaciones y «Ver todas», la lista y cada publicación con su
 *     SEO (canonical, og:type article) y el texto sin HTML, con enlaces automáticos;
 *   · «Códigos de descuento»: «Copiar código» (aviso «Copiado» y portapapeles) e «Ir a la tienda»,
 *     los dos medidos en /api/track; los caducados y los ocultos no se ven;
 *   · tarjetas de producto: «Gratis» y «Pago en <dominio>», sin «Powered by»;
 *   · panel: crear, publicar y borrar una publicación; crear y borrar un código; bloques de texto
 *     en el editor (vista previa, sin guardar).
 * Deja los datos de demostración como estaban.
 */

const PERSONAL = process.env.E2E_PERSONAL_URL ?? `http://localhost:${process.env.E2E_PERSONAL_PORT ?? 3101}`;
test.use({ baseURL: PERSONAL });

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const POST_TITLE = `Publicación de prueba ${stamp}`;
const CODE = `E2E${stamp}`;

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

/** Espera el POST a /api/track de un tipo de evento y devuelve su cuerpo. */
function trackRequest(page: Page, type: string) {
  return page.waitForRequest((r) => r.url().endsWith("/api/track") && r.method() === "POST" && (r.postData() ?? "").includes(`"type":"${type}"`));
}

test.afterAll(async () => {
  // Por si una prueba falló a medias: nada de lo creado aquí se queda en la demo.
  const ana = await prisma.creator.findUnique({ where: { username: "ana" }, select: { id: true } });
  if (ana) {
    await prisma.post.deleteMany({ where: { creatorId: ana.id, title: POST_TITLE } });
    await prisma.discountCode.deleteMany({ where: { creatorId: ana.id, code: CODE } });
  }
  await prisma.$disconnect();
});

test.describe.serial("Modo personal · contenido", () => {
  test("la portada muestra novedades, códigos y los precios de lo gratuito y lo externo", async ({ page }) => {
    await page.goto("/");
    const news = page.locator("#novedades");
    await expect(news.getByRole("heading", { name: "Novedades" })).toBeVisible();
    await expect(news.getByRole("link", { name: /Eclipse de octubre/ })).toHaveAttribute("href", "/ana/novedades/eclipse-de-octubre");
    await expect(news.getByRole("link", { name: /Ver todas/ })).toHaveAttribute("href", "/ana/novedades");

    const codes = page.locator("#codigos");
    await expect(codes.getByRole("heading", { name: "Códigos de descuento" })).toBeVisible();
    await expect(codes.getByText("ANALUNA15")).toBeVisible();

    const free = page.locator("article", { hasText: "Mini-curso gratis" }).first();
    await expect(free.getByText("Gratis", { exact: true })).toBeVisible();
    const external = page.locator("article", { hasText: "Revolución solar" }).first();
    await expect(external.getByText("Pago en calendly.com")).toBeVisible();
    const button = external.getByRole("link", { name: /Reservar en Calendly/ });
    await expect(button).toHaveAttribute("href", "https://calendly.com/ana-luna/revolucion-solar");
    await expect(button).toHaveAttribute("target", "_blank");

    const text = await page.locator("body").innerText();
    expect(text).not.toContain("Powered by");
    expect(text).not.toContain("IVA incluido");
    // Sin condiciones de venta en el pie: aquí no se vende nada.
    const footer = page.getByRole("navigation", { name: "Información legal" });
    await expect(footer.getByRole("link", { name: "Privacidad" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Condiciones" })).toHaveCount(0);
  });

  test("copiar un código: «Copiado», al portapapeles y medido; «Ir a la tienda» también se mide", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: PERSONAL });
    // La tienda es de fuera: no salimos a internet.
    await context.route("https://example.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Tienda</h1>" }));
    await page.goto("/");
    const card = page.getByRole("article", { name: "Código de descuento de Velas Alba" });
    await card.scrollIntoViewIfNeeded();

    const copied = trackRequest(page, "CODE_COPY");
    await card.getByRole("button", { name: "Copiar código ANALUNA15" }).click();
    await expect(card.getByRole("button", { name: /Copiado/ })).toBeVisible();
    await expect(card.getByText("Código copiado.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("ANALUNA15");
    const copyBody = JSON.parse((await copied).postData() ?? "{}");
    expect(copyBody.codeId).toBeTruthy();
    expect(copyBody.productId).toBeUndefined();

    const shop = card.getByRole("link", { name: /Ir a la tienda/ });
    await expect(shop).toHaveAttribute("href", "https://example.com/velas-alba");
    await expect(shop).toHaveAttribute("rel", /noopener/);
    await expect(shop).toHaveAttribute("rel", /sponsored/);
    const clicked = trackRequest(page, "CODE_CLICK");
    const popup = page.waitForEvent("popup");
    await shop.click();
    await clicked;
    await (await popup).close();

    // /api/track solo acepta códigos de esa creadora.
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" }, select: { id: true } });
    const bad = await page.request.post("/api/track", { data: { creatorId: ana.id, type: "CODE_COPY", codeId: "no-existe" } });
    expect(bad.status()).toBe(400);
    const signup = await page.request.post("/api/track", { data: { creatorId: ana.id, type: "SIGNUP" } });
    expect(signup.status()).toBe(400);
  });

  test("novedades: la lista y cada publicación con su SEO, sin HTML y con enlaces automáticos", async ({ page }) => {
    await page.goto("/ana/novedades");
    await expect(page.getByRole("heading", { name: "Novedades", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Abro plazas en el Círculo Lunar/ })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${PERSONAL}/ana/novedades`);

    await page.getByRole("link", { name: /Eclipse de octubre/ }).click();
    await page.waitForURL("**/ana/novedades/eclipse-de-octubre");
    await expect(page.getByRole("heading", { name: "Eclipse de octubre: qué cierra y qué empieza", level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/Eclipse de octubre.*Ana Luna/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${PERSONAL}/ana/novedades/eclipse-de-octubre`);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    expect(await page.locator("body").innerText()).not.toContain("Powered by");

    await page.goto("/ana/novedades/nuevo-circulo-lunar");
    await expect(page.locator('a[href="mailto:hola@analuna.es"]')).toBeVisible();

    expect((await page.request.get("/ana/novedades/no-existe")).status()).toBe(404);
    expect((await page.request.get("/maria/novedades")).status()).toBe(404);
  });

  test("panel: una publicación en borrador no se ve; publicada sí; borrada desaparece", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    await page.goto("/panel/publicaciones");
    await expect(page.getByRole("heading", { name: "Publicaciones" })).toBeVisible();
    await expect(page.getByText("Eclipse de octubre: qué cierra y qué empieza")).toBeVisible();
    await page.getByRole("link", { name: "Nueva publicación" }).first().click();

    await page.getByLabel("Título").fill(POST_TITLE);
    await page.getByLabel("Texto", { exact: true }).fill("Primer párrafo con <b>etiquetas</b> y un enlace: https://example.com/prueba.\n\nSegundo párrafo.");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await page.waitForURL(/\/panel\/publicaciones\/[^/]+\?guardada=borrador/);
    await expect(page.getByText("Borrador guardado")).toBeVisible();
    const editUrl = page.url().split("?")[0];

    await page.goto("/ana/novedades");
    await expect(page.getByText(POST_TITLE)).toHaveCount(0);

    // Vista previa del borrador (solo la dueña).
    await page.goto(`${editUrl}/vista-previa`);
    await expect(page.getByRole("heading", { name: POST_TITLE, level: 1 })).toBeVisible();
    await expect(page.getByText("<b>etiquetas</b>")).toBeVisible();

    await page.goto(editUrl);
    await page.getByText("Publicada", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Publicada: ya se ve en tu página.")).toBeVisible();

    await page.goto("/");
    const card = page.locator("#novedades").getByRole("link", { name: new RegExp(POST_TITLE) });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByRole("heading", { name: POST_TITLE, level: 1 })).toBeVisible();
    const link = page.getByRole("link", { name: "https://example.com/prueba" });
    await expect(link).toHaveAttribute("rel", "noopener nofollow");
    await expect(link).toHaveAttribute("target", "_blank");

    await page.goto(editUrl);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Borrar publicación" }).click();
    await page.waitForURL("**/panel/publicaciones?borrada=1");
    await expect(page.getByText(POST_TITLE)).toHaveCount(0);
    for (const path of ["/", "/ana/novedades"]) {
      await page.goto(path);
      await expect(page.getByText(POST_TITLE)).toHaveCount(0);
    }
  });

  test("panel: un código caducado no se ve; sin caducidad sí; borrado desaparece", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    await page.goto("/panel/codigos");
    await expect(page.getByRole("heading", { name: "Códigos de descuento" })).toBeVisible();
    await page.getByRole("link", { name: "Nuevo código" }).first().click();

    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Marca").fill("Marca de prueba");
    await page.getByLabel("Código", { exact: true }).fill(CODE);
    await page.getByLabel("Enlace a la tienda").fill("http://example.com/prueba");
    await page.getByLabel(/Válido hasta/).fill(yesterday);
    await page.getByRole("button", { name: "Añadir código" }).click();
    await expect(page.getByText("El enlace de la tienda debe empezar por https://")).toBeVisible();
    await page.getByLabel("Enlace a la tienda").fill("https://example.com/prueba");
    await page.getByRole("button", { name: "Añadir código" }).click();
    await page.waitForURL("**/panel/codigos?guardado=1");
    const row = page.locator("li", { hasText: CODE });
    await expect(row.getByText("Caducado")).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(CODE)).toHaveCount(0);

    await page.goto("/panel/codigos");
    await row.getByRole("link").first().click();
    await page.getByLabel(/Válido hasta/).fill("");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Guardado. Ya se ve en tu página.")).toBeVisible();
    await page.goto("/");
    await expect(page.locator("#codigos").getByText(CODE)).toBeVisible();

    // Oculto: tampoco se ve.
    await page.goto("/panel/codigos");
    await row.getByRole("link").first().click();
    await page.getByLabel("Visible en mi página").uncheck();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText(/Está oculto/)).toBeVisible();
    await page.goto("/");
    await expect(page.getByText(CODE)).toHaveCount(0);

    await page.goto("/panel/codigos");
    await row.getByRole("link").first().click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Borrar código" }).click();
    await page.waitForURL("**/panel/codigos?borrado=1");
    await expect(page.getByText(CODE)).toHaveCount(0);
  });

  test("editor: bloques de texto en la vista previa y las secciones nuevas", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    await page.goto("/panel/pagina");
    await page.getByRole("button", { name: "Secciones", exact: true }).click();
    for (const label of ["Bloques de texto", "Novedades", "Códigos de descuento"]) await expect(page.getByText(label).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Gestionar" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Bloques de texto", exact: true }).click();
    await page.getByRole("button", { name: "Añadir bloque de texto" }).click();
    // La demo ya trae un bloque («Cómo trabajo»): el nuevo es el último.
    await page.getByLabel("Título del bloque").last().fill(`Sobre mí ${stamp}`);
    await page.getByLabel("Texto del bloque").last().fill("Soy astróloga.\n\nMás en https://example.com/sobre-mi");
    // Sin «Powered by» que ocultar en la web personal.
    await page.getByRole("button", { name: "Botones y redes", exact: true }).click();
    await expect(page.getByText(/Powered by/)).toHaveCount(0);

    // Vista previa del móvil, sin guardar: la demo no cambia.
    await page.getByRole("button", { name: "Vista previa" }).last().click();
    await expect(page.getByRole("heading", { name: `Sobre mí ${stamp}` })).toBeVisible();
    await expect(page.getByText("Soy astróloga.").filter({ visible: true })).toBeVisible();
  });
});
