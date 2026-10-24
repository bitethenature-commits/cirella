import { PrismaClient, type Prisma } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { mp4 } from "../scripts/fixtures/iso-media";

/**
 * Editor de la página y páginas extra (servidor en modo personal, puerto 3101, web de Ana; y la
 * plataforma en el 3100):
 *   · la portada de la demo con su vídeo subido (302 firmado y Range → 206), su gráfico y su
 *     galería; «Sobre mí» en el pie y en /sobre-mi; la de borrador da 404;
 *   · «Nueva página» de principio a fin desde el móvil: negrita, imagen de Canva (1080×1920 con sus
 *     medidas y srcset), publicar, /<slug> y /ana/p/<slug> con canonical a la raíz;
 *   · borrador y publicado, vista previa «solo tú la ves», despublicar (404) y el sitemap;
 *   · direcciones: query de Instagram, otras usuarias, mayúsculas y la dueña como siempre;
 *   · bloques de la portada: vídeo de YouTube (no carga nada de fuera hasta pulsar ▶) y un
 *     enlace de Instagram que no vale; subir un vídeo HEVC enseña su duración y el aviso;
 *   · en el iPhone: la barra de acciones y la de formato no tapan nada y no hay scroll lateral;
 *   · plataforma: /ana/p/<slug>, sin alias en la raíz, sin «Subir vídeo» y el vídeo se rechaza.
 * Deja los datos de demostración como estaban.
 */

const PERSONAL = process.env.E2E_PERSONAL_URL ?? `http://localhost:${process.env.E2E_PERSONAL_PORT ?? 3101}`;
const PLATFORM = process.env.E2E_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3100}`;
test.use({ baseURL: PERSONAL });

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const TITLE = `Mi historia ${stamp}`;
const SLUG = `mi-historia-${stamp}`;

async function demoLogin(page: Page, label: string, base = PERSONAL) {
  await page.context().clearCookies();
  await page.goto(`${base}/entrar`);
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function canvaPng() {
  return sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#d8c4ef" } }).png().toBuffer();
}

let anaId = "";
let homeBefore: { pageDraft: Prisma.JsonValue; pagePublished: Prisma.JsonValue } | null = null;

test.beforeAll(async () => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  anaId = ana.id;
  homeBefore = { pageDraft: ana.pageDraft, pagePublished: ana.pagePublished };
});

test.afterAll(async () => {
  await prisma.sitePage.deleteMany({ where: { creatorId: anaId, slug: { contains: stamp } } });
  if (homeBefore)
    await prisma.creator.update({
      where: { id: anaId },
      data: { pageDraft: homeBefore.pageDraft as Prisma.InputJsonValue, pagePublished: homeBefore.pagePublished as Prisma.InputJsonValue },
    });
  await prisma.$disconnect();
});

test.describe.serial("Editor de la página y páginas extra", () => {
  test("portada de la demo: vídeo subido, gráfico, galería y «Sobre mí» en el pie", async ({ page, request }) => {
    await page.goto("/");
    const blocks = page.locator("#bloques");
    await expect(blocks.getByRole("heading", { name: "Cómo trabajo" })).toBeVisible();

    const video = blocks.locator("video");
    await expect(video).toHaveAttribute("playsinline", "");
    await expect(video).toHaveAttribute("poster", /^\/media\//);
    await expect(video).toHaveAttribute("preload", "none");
    expect(await video.getAttribute("autoplay")).toBeNull();
    const src = (await video.getAttribute("src")) ?? "";
    expect(src).toMatch(/^\/media\/video\/[a-z0-9]+\/[a-f0-9]{24}\.mp4$/);
    const redirect = await request.get(src, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    const location = redirect.headers()["location"] ?? "";
    expect(location).toContain("/api/storage/local");
    expect(redirect.headers()["cache-control"]).toContain("max-age=600");
    const range = await request.get(location, { headers: { Range: "bytes=0-1" } });
    expect(range.status()).toBe(206);
    expect((await request.get("/media/video/abc/../../private/x.mp4", { maxRedirects: 0 })).status()).toBe(404);

    // El gráfico: sus medidas reales, srcset y carga diferida; sin enlace (el producto no se vende aquí), se amplía.
    const graphic = blocks.locator('[data-block="image"] img').first();
    await expect(graphic).toHaveAttribute("width", "1200");
    await expect(graphic).toHaveAttribute("loading", "lazy");
    await expect(graphic).toHaveAttribute("srcset", /-w400\.webp 400w/);
    await expect(blocks.getByRole("button", { name: /Ampliar imagen: Los 5 tipos/ })).toBeVisible();
    await expect(blocks.locator('[data-block="gallery"] button[aria-label^="Ampliar imagen"]')).toHaveCount(3);
    await expect(blocks.getByText("3 · desliza →")).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Páginas" });
    await expect(nav.getByRole("link", { name: "Sobre mí" })).toHaveAttribute("href", "/sobre-mi");
    await expect(nav.getByRole("link", { name: "Preguntas frecuentes" })).toHaveCount(0);

    await page.goto("/sobre-mi");
    await expect(page.getByRole("heading", { name: "Sobre mí", level: 1 })).toBeVisible();
    await expect(page.locator("main strong", { hasText: "8 años" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mi formación" })).toBeVisible();
    await expect(page).toHaveTitle(/Sobre Ana Luna · Astrología y Human Design/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${PERSONAL}/sobre-mi`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Quién soy/);
    expect((await request.get("/preguntas-frecuentes")).status()).toBe(404);
  });

  test("nueva página «Sobre mí» desde el iPhone: negrita, gráfico de Canva y publicar", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    await page.goto("/panel/paginas");
    await expect(page.getByRole("heading", { name: "Páginas" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Preguntas frecuentes/ })).toContainText("Borrador");
    await page.getByRole("link", { name: "Nueva página" }).first().click();
    await page.getByLabel("Título").fill(TITLE);
    await page.getByRole("button", { name: "Crear página" }).click();
    await page.waitForURL(/\/panel\/paginas\/[^/]+$/);

    await page.getByLabel("Texto del bloque").first().fill(`Soy **astróloga ${stamp}** desde hace 8 años.`);
    await page.getByLabel("Elegir imagen", { exact: true }).setInputFiles({ name: "canva.png", mimeType: "image/png", buffer: await canvaPng() });
    await page.getByLabel("Descripción de la imagen").fill("Mi carta natal en una historia");

    // En el iPhone: la barra fija de acciones se ve y no hay scroll lateral.
    const bar = page.locator("[data-mobile-actions]");
    await expect(bar).toBeVisible();
    expect((await bar.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    // La barra de formato se pega bajo las pestañas, sin taparlas.
    await page.getByLabel("Texto del bloque").first().evaluate((el) => el.scrollIntoView({ block: "start" }));
    const tabs = await page.getByRole("button", { name: "Contenido", exact: true }).boundingBox();
    const bold = await page.getByRole("button", { name: "Negrita" }).first().boundingBox();
    expect(bold!.y).toBeGreaterThanOrEqual(tabs!.y + tabs!.height - 1);

    await bar.getByRole("button", { name: "Vista previa" }).click();
    await expect(page.locator("h1.cp-display", { hasText: TITLE })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar" }).click();

    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await expect(page.getByLabel("Dirección")).toHaveValue(SLUG);
    await bar.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText(`¡Publicada! Ya se ve en /${SLUG}`)).toBeVisible();

    await page.goto(`/${SLUG}`);
    await expect(page.getByRole("heading", { name: TITLE, level: 1 })).toBeVisible();
    await expect(page.locator("main strong", { hasText: `astróloga ${stamp}` })).toBeVisible();
    const img = page.locator('main button img[alt="Mi carta natal en una historia"]');
    await expect(img).toHaveAttribute("width", "1080");
    await expect(img).toHaveAttribute("height", "1920");
    await expect(img).toHaveAttribute("srcset", /-w400\.webp 400w/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${PERSONAL}/${SLUG}`);
    await expect(page.getByRole("navigation", { name: "Páginas" }).getByText(TITLE)).toHaveAttribute("aria-current", "page");
    await page.goto(`/ana/p/${SLUG}`);
    await expect(page.getByRole("heading", { name: TITLE, level: 1 })).toBeVisible();
  });

  test("borrador y publicado, vista previa, direcciones, despublicar y sitemap", async ({ page, request }) => {
    const row = await prisma.sitePage.findFirstOrThrow({ where: { creatorId: anaId, slug: SLUG } });
    await demoLogin(page, "Ana Luna");
    await page.goto(`/panel/paginas/${row.id}`);
    await page.getByLabel("Título", { exact: true }).fill(`${TITLE} (nuevo)`);
    await page.locator("[data-mobile-actions]").getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator("[data-page-status]")).toHaveText("Cambios sin publicar");

    await page.goto(`/${SLUG}`);
    await expect(page.getByRole("heading", { name: TITLE, level: 1, exact: true })).toBeVisible();
    await page.goto(`/panel/paginas/${row.id}/vista-previa`);
    await expect(page.getByText("Vista previa del borrador · solo tú la ves")).toBeVisible();
    await expect(page.getByRole("heading", { name: `${TITLE} (nuevo)`, level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Volver a editar" }).click();
    await page.locator("[data-mobile-actions]").getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText(/¡Publicada!/)).toBeVisible();
    await page.goto(`/${SLUG}`);
    await expect(page.getByRole("heading", { name: `${TITLE} (nuevo)`, level: 1 })).toBeVisible();

    expect((await request.get(`/${SLUG}?utm_source=instagram`)).status()).toBe(200);
    expect((await request.get("/no-existe-esta")).status()).toBe(404);
    expect((await request.get("/maria")).status()).toBe(404);
    expect((await request.get("/maria/yoga-terapeutico")).status()).toBe(404);
    expect((await request.get(`/${SLUG.toUpperCase()}`)).status()).toBe(404);
    const owner = await request.get("/ana", { maxRedirects: 0 });
    expect(owner.status()).toBe(307);
    expect(owner.headers()["location"]).toMatch(/\/$/);
    expect(await (await request.get("/sitemap.xml")).text()).toContain(`${PERSONAL}/${SLUG}</loc>`);

    await page.goto(`/panel/paginas/${row.id}`);
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await page.getByRole("button", { name: "Despublicar" }).click();
    await page.waitForURL(/despublicada=1/);
    expect((await request.get(`/${SLUG}`)).status()).toBe(404);
    expect((await request.get(`/ana/p/${SLUG}`)).status()).toBe(404);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(`/${SLUG}</loc>`);
    expect(await (await request.get("/sitemap.xml")).text()).toContain(`${PERSONAL}/sobre-mi</loc>`);
  });

  test("portada: vídeo de YouTube que no carga nada hasta pulsar ▶, Instagram no vale y un HEVC subido avisa", async ({ page, context }) => {
    await context.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>YouTube</p>" }));
    await demoLogin(page, "Ana Luna");
    await page.goto("/panel/pagina");
    await page.getByRole("button", { name: "Bloques", exact: true }).click();
    await page.getByRole("button", { name: "Añadir vídeo" }).click();
    const card = page.locator('[data-block-editor="video"]').last();
    await card.getByRole("radio", { name: "Enlace de YouTube o Vimeo" }).click();
    await card.getByLabel("Enlace del vídeo").fill("https://instagram.com/reel/abc");
    await expect(card.getByText(/no es de YouTube ni de Vimeo.*súbelo/)).toBeVisible();
    await card.getByLabel("Enlace del vídeo").fill("https://youtu.be/dQw4w9WgXcQ");
    await expect(card.getByText("Vídeo de YouTube")).toBeVisible();
    await card.getByLabel("Título del vídeo").fill(`Directo ${stamp}`);

    // Otro bloque: un vídeo HEVC vertical del iPhone (sin publicarlo).
    await page.getByRole("button", { name: "Añadir vídeo" }).click();
    const upload = page.locator('[data-block-editor="video"]').last();
    await upload.getByLabel("Elegir vídeo").setInputFiles({ name: "bienvenida.mov", mimeType: "video/quicktime", buffer: mp4({ codec: "hvc1", width: 1080, height: 1920, durationSec: 5, brand: "qt  " }) });
    await expect(upload.locator("[data-video-facts]")).toContainText("0:05 · vertical");
    await expect(upload.getByText("Formato del iPhone (HEVC).")).toBeVisible();
    await upload.getByRole("button", { name: "Eliminar bloque" }).click();

    await page.locator("[data-mobile-actions]").getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText(/¡Publicado!/)).toBeVisible();

    await page.goto("/");
    const facade = page.getByRole("button", { name: `Reproducir: Directo ${stamp}` });
    await expect(facade).toBeVisible();
    await expect(page.locator("#bloques iframe")).toHaveCount(0);
    await facade.click();
    await expect(page.locator("#bloques iframe")).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*autoplay=1/);
  });

  test("plataforma: /ana/p/<slug>, sin alias en la raíz, sin «Subir vídeo» y el vídeo subido se rechaza", async ({ page }) => {
    await demoLogin(page, "Ana Luna", PLATFORM);
    const sign = await page.request.post(`${PLATFORM}/api/upload/sign`, { data: { purpose: "video", name: "x.mp4", contentType: "video/mp4", size: 1000 } });
    expect(sign.status()).toBe(400);
    expect((await sign.json()).error).toContain("enlace de YouTube o Vimeo");

    await page.goto(`${PLATFORM}/panel/pagina`);
    await page.getByRole("button", { name: "Secciones", exact: true }).click();
    await page.getByRole("link", { name: "Gestionar páginas" }).click();
    await page.waitForURL("**/panel/paginas");
    await page.getByRole("link", { name: "Nueva página" }).first().click();
    await page.getByText("En blanco", { exact: true }).click();
    await page.getByLabel("Título").fill(`Plataforma ${stamp}`);
    await page.getByRole("button", { name: "Crear página" }).click();
    await page.waitForURL(/\/panel\/paginas\/[^/]+$/);
    await page.getByRole("button", { name: "Añadir vídeo" }).click();
    await expect(page.getByRole("radio", { name: "Subir vídeo" })).toHaveCount(0);
    await expect(page.getByText("Sube el vídeo a YouTube o Vimeo y pega aquí el enlace.")).toBeVisible();
    await page.getByRole("button", { name: "Añadir bloque de texto" }).click();
    await page.getByLabel("Texto del bloque").last().fill("Hola desde la plataforma");
    await page.locator("[data-mobile-actions]").getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText(`¡Publicada! Ya se ve en /ana/p/plataforma-${stamp}`)).toBeVisible();

    const res = await page.request.get(`${PLATFORM}/ana/p/plataforma-${stamp}`);
    expect(res.status()).toBe(200);
    expect((await page.request.get(`${PLATFORM}/plataforma-${stamp}`)).status()).toBe(404);
    await page.goto(`${PLATFORM}/ana/p/plataforma-${stamp}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${PLATFORM}/ana/p/plataforma-${stamp}`);
    await expect(page.getByText("Hola desde la plataforma")).toBeVisible();
  });
});
