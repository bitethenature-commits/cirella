import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * Infraestructura: cabeceras de seguridad, peso y caché de la página pública, subida de imágenes
 * (procesadas y sin metadatos) y de archivos, y descargas con enlaces temporales.
 * Con la BD de la demo y el driver de disco (STORAGE_DRIVER=local).
 */

const stamp = Date.now().toString().slice(-6);

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

/** Avisos de la CSP en la consola (o errores de la página) mientras se navega. */
function watchCsp(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (/Content Security Policy/i.test(e.message)) problems.push(e.message);
  });
  return problems;
}

async function demoData() {
  const prisma = new PrismaClient();
  try {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const astro = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, slug: "lectura-astrologia" } });
    const course = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "COURSE" } });
    const video = await prisma.productFile.findFirst({ where: { creatorId: ana.id, kind: "VIDEO" } });
    return { ana, astro, course, video };
  } finally {
    await prisma.$disconnect();
  }
}

test.describe.serial("Infraestructura", () => {
  test("cabeceras de seguridad en la portada y en una página pública", async ({ request }) => {
    for (const path of ["/", "/ana"]) {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const csp = res.headers()["content-security-policy"] ?? "";
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(res.headers()["permissions-policy"]).toContain("camera=()");
      expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    }
  });

  test("la CSP no bloquea nada: página, producto, pago simulado y reproductor del curso", async ({ page }) => {
    const problems = watchCsp(page);
    const { course } = await demoData();
    await page.goto("/ana");
    await expect(page.getByRole("heading", { name: "Ana Luna" }).first()).toBeVisible();
    await page.goto("/ana/lectura-astrologia");
    await page.goto("/ana/lectura-astrologia/checkout");
    await page.fill("#name", "Prueba CSP");
    await page.fill("#email", `csp${stamp}@example.com`);
    await page.getByLabel(/He leído y acepto/).check();
    await page.getByLabel(/Quiero acceder ya/).check();
    await page.getByRole("button", { name: /Pagar/ }).click();
    await page.waitForURL("**/ana/gracias**");
    await page.context().clearCookies();
    await demoLogin(page, "Laura Martín");
    await page.goto(`/cuenta/cursos/${course.id}`);
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });

  test("la página pública pesa menos de 1 MB y la portada usa variantes", async ({ page }) => {
    // Cada prueba empieza con un contexto nuevo: nada en la caché del navegador.
    let bytes = 0;
    page.on("requestfinished", async (req) => {
      const sizes = await req.sizes().catch(() => null);
      if (sizes) bytes += sizes.responseBodySize + sizes.responseHeadersSize;
    });
    await page.goto("/ana", { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    test.info().annotations.push({ type: "peso de /ana", description: `${bytes} bytes` });
    expect(bytes).toBeLessThan(1_000_000);
    const cover = page.locator("img[fetchpriority=high]").first();
    expect(await cover.getAttribute("srcset")).toContain("-w800.webp");
  });

  test("la página pública está cacheada y la vista previa del borrador vive aparte", async ({ page, request }) => {
    for (let i = 0; i < 2; i++) {
      const res = await request.get("/ana");
      expect(res.headers()["cache-control"]).toContain("s-maxage");
      expect(res.headers()["set-cookie"]).toBeUndefined();
    }
    await demoLogin(page, "Ana Luna");
    await page.goto("/ana");
    await expect(page.getByText("Vista previa del borrador")).toHaveCount(0);
    await page.goto("/vista-previa");
    await expect(page.getByText(/Vista previa del borrador/)).toBeVisible();

    // El botón que abre /vista-previa en otra pestaña es el de escritorio (≥ sm); en el móvil,
    // «Vista previa» abre la vista previa dentro del propio editor.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/panel/pagina");
    const popup = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Vista previa", exact: true }).first().click();
    const preview = await popup;
    await preview.waitForLoadState();
    expect(new URL(preview.url()).pathname).toBe("/vista-previa");
  });

  test("«vista-previa» no se puede usar como nombre de usuario", async ({ page }) => {
    await page.goto("/registro");
    await page.fill("#email", `reservado${stamp}@example.com`);
    await page.fill("#password", "secreto123");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await page.waitForURL("**/onboarding");
    await page.getByPlaceholder("tunombre").fill("vista-previa");
    await expect(page.getByText("Este nombre está reservado")).toBeVisible();
  });

  test("subir una foto: se endereza, se le quita el GPS y se guarda en WebP con variantes", async ({ page }) => {
    const { ana, astro } = await demoData();
    await demoLogin(page, "Ana Luna");
    await page.goto(`/panel/productos/${astro.id}`);
    const photo = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: { r: 200, g: 150, b: 220 } } })
      .jpeg({ quality: 85 })
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Make: "TelefonoDePrueba" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "40/1 25/1 0/1" } })
      .toBuffer();
    const input = page.locator('input[type=file][accept^="image/"]').first();
    const preview = input.locator("..").locator("img").first();
    const before = await preview.getAttribute("src");
    await input.setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect.poll(() => preview.getAttribute("src"), { timeout: 30_000 }).not.toBe(before);
    const src = (await preview.getAttribute("src"))!;
    expect(src).toMatch(new RegExp(`^/media/${ana.id}/[a-f0-9]{20}\\.webp$`));

    const res = await page.request.get(src);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/webp");
    expect(res.headers()["cache-control"]).toContain("immutable");
    const body = await res.body();
    const meta = await sharp(body).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.height!).toBeGreaterThan(meta.width!);
    expect(meta.width!).toBeLessThanOrEqual(1600);
    expect(body.includes(Buffer.from("TelefonoDePrueba"))).toBe(false);
    expect((await page.request.get(src.replace(/\.webp$/, "-w400.webp"))).status()).toBe(200);

    // Más de 25 MB: se rechaza antes de subir nada
    await input.setInputFiles({ name: "enorme.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(30 * 1024 * 1024, 1) });
    await expect(page.getByText("La imagen supera 25 MB")).toBeVisible();
  });

  test("subir un PDF y descargarlo con un enlace temporal", async ({ page }) => {
    const { astro } = await demoData();
    await demoLogin(page, "Ana Luna");
    await page.goto(`/panel/productos/${astro.id}`);
    const name = `material-${stamp}.pdf`;
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200_000, 32), Buffer.from("\n%%EOF")]);
    await page.locator('input[type=file][accept^=".pdf"]').setInputFiles({ name, mimeType: "application/pdf", buffer: pdf });
    const row = page.locator("li", { hasText: name });
    await expect(row).toBeVisible();

    const href = (await row.getByRole("link", { name: "Ver" }).getAttribute("href"))!;
    const redirect = await page.request.get(href, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    const location = redirect.headers()["location"];
    expect(location).toContain("/api/storage/local?t=");

    const file = await page.request.get(location);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toContain("application/pdf");
    expect((await file.body()).length).toBe(pdf.length);

    const url = new URL(location, "http://x");
    const t = url.searchParams.get("t")!;
    const i = Math.floor(t.length / 3);
    url.searchParams.set("t", t.slice(0, i) + (t[i] === "a" ? "b" : "a") + t.slice(i + 1));
    expect((await page.request.get(url.pathname + url.search)).status()).toBe(403);
  });

  test("el vídeo del curso se puede adelantar (Range → 206)", async ({ page }) => {
    const { video } = await demoData();
    test.skip(!video, "sin ffmpeg el seed no genera vídeos");
    await demoLogin(page, "Laura Martín");
    const redirect = await page.request.get(`/api/download/${video!.id}?inline=1`, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    const res = await page.request.get(redirect.headers()["location"], { headers: { Range: "bytes=0-99" } });
    expect(res.status()).toBe(206);
    expect(res.headers()["content-length"]).toBe("100");
    expect(res.headers()["content-range"]).toMatch(/^bytes 0-99\/\d+$/);
  });
});
