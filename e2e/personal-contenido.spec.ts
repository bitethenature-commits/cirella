import { Prisma, PrismaClient } from "@prisma/client";
import { COMO_TRABAJO, withHomeBlocks } from "./home-blocks";
import { expect, test, type Page } from "@playwright/test";

/**
 * Modo personal · contenido de la página (servidor en modo personal, puerto 3101, web de Cirella):
 *   · «Novedades» con las últimas publicaciones y «Ver todas», la lista y cada publicación con su
 *     SEO (canonical, og:type article) y el texto sin HTML, con enlaces automáticos;
 *   · «Bloques»: la demo no trae ninguno (no sale «Cómo trabajo»); con uno de texto puesto por la
 *     prueba, su título, su texto y su botón a una web de fuera;
 *   · «Códigos de descuento»: «Copiar código» (aviso «Copiado» y portapapeles) e «Ir a la tienda»,
 *     los dos registrados por /api/track (y contados en el panel); los caducados y los ocultos no se ven;
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
  await page.goto("/login");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Espera la respuesta de /api/track a un evento de ese tipo (así se sabe qué contestó el servidor). */
function trackResponse(page: Page, type: string) {
  return page.waitForResponse(
    (r) => r.url().endsWith("/api/track") && r.request().method() === "POST" && (r.request().postData() ?? "").includes(`"type":"${type}"`),
  );
}

/** Desde cuándo cuentan los eventos de códigos de esta prueba (se borran al acabar). */
let trackSince: Date | null = null;
/** La portada publicada de Cirella antes de añadirle el bloque de prueba (afterAll la deja como estaba). */
let publishedBefore: { value: Prisma.JsonValue } | null = null;

/** Publica en la portada el bloque de texto «Cómo trabajo» (la demo no trae bloques). */
async function addTextBlock() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" }, select: { id: true, pageDraft: true, pagePublished: true } });
  publishedBefore ??= { value: ana.pagePublished };
  await prisma.creator.update({ where: { id: ana.id }, data: { pagePublished: withHomeBlocks(ana.pagePublished ?? ana.pageDraft, [COMO_TRABAJO]) } });
}

test.afterAll(async () => {
  // Por si una prueba falló a medias: nada de lo creado aquí se queda en la demo.
  const ana = await prisma.creator.findUnique({ where: { username: "ana" }, select: { id: true } });
  if (ana) {
    if (publishedBefore)
      await prisma.creator.update({ where: { id: ana.id }, data: { pagePublished: publishedBefore.value === null ? Prisma.DbNull : (publishedBefore.value as Prisma.InputJsonValue) } });
    await prisma.post.deleteMany({ where: { creatorId: ana.id, title: POST_TITLE } });
    await prisma.discountCode.deleteMany({ where: { creatorId: ana.id, code: CODE } });
    if (trackSince)
      await prisma.analyticsEvent.deleteMany({ where: { creatorId: ana.id, type: { in: ["CODE_COPY", "CODE_CLICK"] }, createdAt: { gte: trackSince } } });
  }
  await prisma.$disconnect();
});

test.describe.serial("Modo personal · contenido", () => {
  test("la portada muestra actualidades, códigos y los precios de lo gratuito y lo externo", async ({ page }) => {
    await page.goto("/");
    const news = page.locator("#actualidades");
    await expect(news.getByRole("heading", { name: "Actualidades" })).toBeVisible();
    await news.locator("> details > summary").click();
    await expect(news.getByRole("link", { name: /Eclipse de octubre/ })).toHaveAttribute("href", "/ana/news/october-eclipse");
    await expect(news.getByRole("link", { name: /Ver todas/ })).toHaveAttribute("href", "/news");

    const codes = page.locator("#codigos");
    await expect(codes.getByRole("heading", { name: "Códigos de descuento" })).toBeVisible();
    await expect(codes.getByText("CIRELLA15")).toBeVisible();

    // La demo no trae bloques: ni la sección ni «Cómo trabajo» salen en la portada.
    await expect(page.locator("#bloques")).toHaveCount(0);
    await expect(page.getByText("Cómo trabajo")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Ver mi agenda/ })).toHaveCount(0);

    // Con un bloque de texto: su título, su texto y su botón a una web de fuera (en otra pestaña).
    await addTextBlock();
    await page.reload();
    const blocks = page.locator("#bloques");
    await expect(blocks.getByRole("heading", { name: "Cómo trabajo" })).toBeVisible();
    await expect(blocks.getByText(/Cada lectura parte de tu carta natal/)).toBeVisible();
    await expect(blocks.getByText(/te envío la grabación/)).toBeVisible();
    const blockButton = blocks.getByRole("link", { name: /Ver mi agenda/ });
    await expect(blockButton).toHaveAttribute("href", "https://calendly.com/cirella");
    await expect(blockButton).toHaveAttribute("target", "_blank");
    await expect(blockButton).toHaveAttribute("rel", "noopener noreferrer");

    const free = page.locator("article", { hasText: "Mini-curso gratis" }).first();
    await expect(free.getByText("Gratis", { exact: true })).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("Powered by");
    expect(text).not.toContain("IVA incluido");
    // Las sesiones (también las que se pagan fuera) están en su página, con los pasos para reservar.
    await page.goto("/sessions");
    await expect(page.getByRole("heading", { name: "Cómo reservar" })).toBeVisible();
    const external = page.locator("article", { hasText: "Revolución solar" }).first();
    await expect(external.getByText("Pago en calendly.com")).toBeVisible();
    const button = external.getByRole("link", { name: /Reservar en Calendly/ });
    await expect(button).toHaveAttribute("href", "https://calendly.com/cirella/revolucion-solar");
    await expect(button).toHaveAttribute("target", "_blank");
    await page.goto("/");

    // Sin condiciones de venta en el pie: aquí no se vende nada.
    const footer = page.getByRole("navigation", { name: "Información legal" });
    await expect(footer.getByRole("link", { name: "Privacidad" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Condiciones" })).toHaveCount(0);
  });

  test("copiar un código: «Copiado», al portapapeles y medido; «Ir a la tienda» también se mide", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: PERSONAL });
    // La tienda es de fuera: no salimos a internet.
    await context.route("https://example.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Tienda</h1>" }));
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" }, select: { id: true } });
    // Sin duplicados en 30 minutos (lib/limits.ts): se olvidan los de antes para que esta vez cuente.
    // Las claves llevan hash, así que se borran por el prefijo (solo en la BD local de e2e).
    await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "track:" } } });
    const since = new Date();
    trackSince ??= since;
    const recorded = (type: string, codeId: string) =>
      prisma.analyticsEvent.count({ where: { creatorId: ana.id, type, productId: codeId, createdAt: { gte: since } } });
    await page.goto("/");
    const card = page.getByRole("article", { name: "Código de descuento de Velas Alba" });
    await card.scrollIntoViewIfNeeded();

    const copied = trackResponse(page, "CODE_COPY");
    await card.getByRole("button", { name: "Copiar código CIRELLA15" }).click();
    await expect(card.getByRole("button", { name: /Copiado/ })).toBeVisible();
    await expect(card.getByText("Código copiado.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("CIRELLA15");
    // Copiar no despliega la fila; al desplegarla salen las fotos de lo que recomienda de la marca.
    await expect(card.locator("details")).toHaveJSProperty("open", false);
    await expect(card.locator("[data-code-more]")).toBeHidden();
    await card.locator("summary").click();
    await expect(card.getByRole("button", { name: /Ampliar imagen/ })).toHaveCount(3);
    const copyRes = await copied;
    expect(copyRes.status()).toBe(204);
    const copyBody = JSON.parse(copyRes.request().postData() ?? "{}");
    expect(copyBody.codeId).toBeTruthy();
    expect(copyBody.productId).toBeUndefined();
    // El servidor lo ha guardado de verdad, con el código como objeto del evento.
    expect(await recorded("CODE_COPY", copyBody.codeId)).toBe(1);

    const shop = card.getByRole("link", { name: /Ir a la tienda/ });
    await expect(shop).toHaveAttribute("href", "https://example.com/velas-alba");
    await expect(shop).toHaveAttribute("rel", /noopener/);
    await expect(shop).toHaveAttribute("rel", /sponsored/);
    const clicked = trackResponse(page, "CODE_CLICK");
    const popup = page.waitForEvent("popup");
    await shop.click();
    const clickRes = await clicked;
    await (await popup).close();
    expect(clickRes.status()).toBe(204);
    expect(JSON.parse(clickRes.request().postData() ?? "{}").codeId).toBe(copyBody.codeId);
    expect(await recorded("CODE_CLICK", copyBody.codeId)).toBe(1);

    // /api/track solo acepta códigos de esa creadora.
    const bad = await page.request.post("/api/track", { data: { creatorId: ana.id, type: "CODE_COPY", codeId: "no-existe" } });
    expect(bad.status()).toBe(400);
    const signup = await page.request.post("/api/track", { data: { creatorId: ana.id, type: "SIGNUP" } });
    expect(signup.status()).toBe(400);
  });

  test("actualidades: la lista y cada publicación con su SEO, sin HTML y con enlaces automáticos", async ({ page }) => {
    await page.goto("/news");
    await expect(page.getByRole("heading", { name: "Actualidades", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Abro plazas en el Círculo Lunar/ })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${PERSONAL}/news`);

    await page.getByRole("link", { name: /Eclipse de octubre/ }).click();
    await page.waitForURL("**/ana/news/october-eclipse");
    await expect(page.getByRole("heading", { name: "Eclipse de octubre: qué cierra y qué empieza", level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/Eclipse de octubre.*Cirella/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${PERSONAL}/ana/news/october-eclipse`);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    expect(await page.locator("body").innerText()).not.toContain("Powered by");

    await page.goto("/ana/news/moon-circle-open");
    await expect(page.locator('a[href="mailto:hola@cirella.app"]')).toBeVisible();

    expect((await page.request.get("/ana/news/no-existe")).status()).toBe(404);
    expect((await page.request.get("/maria/actualidades")).status()).toBe(404);
  });

  test("panel: una publicación en borrador no se ve; publicada sí; borrada desaparece", async ({ page }) => {
    await demoLogin(page, "Cirella");
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

    await page.goto("/news");
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
    await page.locator("#actualidades > details > summary").click();
    const card = page.locator("#actualidades").getByRole("link", { name: new RegExp(POST_TITLE) });
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
    for (const path of ["/", "/news"]) {
      await page.goto(path);
      await expect(page.getByText(POST_TITLE)).toHaveCount(0);
    }
  });

  test("panel: un código caducado no se ve; sin caducidad sí; borrado desaparece", async ({ page }) => {
    await demoLogin(page, "Cirella");
    await page.goto("/panel/codigos");
    await expect(page.getByRole("heading", { name: "Códigos de descuento" })).toBeVisible();
    // Las copias y los clics de los últimos 30 días se cuentan en la lista (los de la prueba anterior incluidos).
    const velas = await prisma.discountCode.findFirstOrThrow({ where: { code: "CIRELLA15" }, select: { id: true } });
    const month = new Date(Date.now() - 30 * 86_400_000);
    const used = (type: string) => prisma.analyticsEvent.count({ where: { type, productId: velas.id, createdAt: { gte: month } } });
    const [copies, clicks] = [await used("CODE_COPY"), await used("CODE_CLICK")];
    expect(copies).toBeGreaterThan(0);
    await expect(page.locator("li", { hasText: "CIRELLA15" })).toContainText(
      `${copies} ${copies === 1 ? "copia" : "copias"} · ${clicks} ${clicks === 1 ? "clic" : "clics"} en 30 días`,
    );
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
    // Ya caducado al crearlo: el aviso no dice que se vea.
    await page.waitForURL("**/panel/codigos?guardado=expired");
    await expect(page.getByText("Código añadido. Ha caducado: no se ve en tu página.")).toBeVisible();
    await expect(page.getByText(/Ya se ve en tu página/)).toHaveCount(0);
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
    await demoLogin(page, "Cirella");
    await page.goto("/panel/pagina");
    await page.getByRole("button", { name: "Secciones", exact: true }).click();
    for (const label of ["Bloques", "Accesos", "Actualidades", "Portal de Noticias", "Ofertas", "Códigos de descuento"]) await expect(page.getByText(label).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Gestionar" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Bloques", exact: true }).click();
    // La demo no trae bloques: el nuevo es el único.
    await expect(page.getByLabel("Título del bloque")).toHaveCount(0);
    await page.getByRole("button", { name: "Añadir bloque de texto" }).click();
    await expect(page.getByLabel("Título del bloque")).toHaveCount(1);
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
