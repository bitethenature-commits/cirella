import { rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { m4a, mp4 } from "../scripts/fixtures/iso-media";

/**
 * Lecciones por partes (web personal de Ana en el 3101, tamaño iPhone; regresión en la plataforma, 3100):
 *   · la dueña crea una lección con texto con formato, un .mov del iPhone, un .m4a de Zoom, el PDF
 *     de los materiales y una imagen; la reordena y la guarda (deshabilitado mientras sube);
 *   · borrador local («Recuperar» / «Descartar») y aviso si otra pantalla guardó antes;
 *   · la alumna (Laura) ve el vídeo arriba, el texto, el audio, el PDF y la imagen, y la lección
 *     cuenta como UN paso; «Mis archivos» enlaza cada material con su lección;
 *   · borrar un material usado pide confirmación y lo quita de la lección;
 *   · lista de lecciones plegable en el móvil;
 *   · plataforma: programa público con «Lectura» / «Texto + PDF», PDF con «Descargar PDF»,
 *     texto de antes igual que siempre y el programa del panel con «Editar».
 * Deja los datos de demostración como estaban.
 */

const PERSONAL = process.env.E2E_PERSONAL_URL ?? `http://localhost:${process.env.E2E_PERSONAL_PORT ?? 3101}`;
const PLATFORM = process.env.E2E_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3100}`;

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const TAG = `partes-${stamp}`;
const TITLE = `${TAG} Lección completa`;

async function demoLogin(page: Page, label: string, base = PERSONAL) {
  await page.context().clearCookies();
  await page.goto(`${base}/entrar`);
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

/** Acepta los confirm() y los avisos al salir; guarda los mensajes. */
function acceptDialogs(page: Page) {
  const seen: string[] = [];
  page.on("dialog", (d) => {
    seen.push(d.message());
    void d.accept();
  });
  return seen;
}

async function noHorizontalScroll(page: Page) {
  const width = await page.evaluate(() => document.scrollingElement!.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
}

let anaId = "";
let courseId = "";
let lauraId = "";
let lessonId = "";
const files = { video: "", audio: "", image: "", pdf: "" };

test.beforeAll(async () => {
  anaId = (await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } })).id;
  const course = await prisma.product.findFirstOrThrow({ where: { creatorId: anaId, slug: "curso-conocete-tu-energia" }, include: { files: true } });
  courseId = course.id;
  files.pdf = course.files.find((f) => f.name === "Cuaderno de trabajo.pdf")!.id;
  lauraId = (await prisma.user.findUniqueOrThrow({ where: { email: "laura@example.com" } })).id;
});

test.afterAll(async () => {
  const lessons = await prisma.lesson.findMany({ where: { creatorId: anaId, title: { startsWith: TAG } }, select: { id: true } });
  await prisma.lessonProgress.deleteMany({ where: { lessonId: { in: lessons.map((l) => l.id) } } });
  await prisma.lesson.deleteMany({ where: { id: { in: lessons.map((l) => l.id) } } });
  const uploaded = await prisma.productFile.findMany({ where: { creatorId: anaId, name: { startsWith: TAG } } });
  await prisma.productFile.deleteMany({ where: { id: { in: uploaded.map((f) => f.id) } } });
  for (const f of uploaded) if (f.storageKey) rmSync(path.join(process.cwd(), "storage", "private", f.storageKey), { force: true });
  await prisma.$disconnect();
});

test.describe.serial("Lecciones por partes · web personal (iPhone)", () => {
  test.use({ baseURL: PERSONAL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("la dueña crea una lección con texto, vídeo .mov, audio .m4a, PDF e imagen", async ({ page }) => {
    acceptDialogs(page);
    await demoLogin(page, "Ana Luna");
    await page.goto(`/panel/productos/${courseId}`);
    const firstModule = page.locator("#lecciones [data-module]").first();
    await firstModule.getByRole("link", { name: "Añadir lección" }).click();
    await page.waitForURL(/\/lecciones\/nueva\?modulo=/);
    await page.getByLabel("Título de la lección").fill(TITLE);

    // Texto con formato.
    await page.getByRole("button", { name: "Texto", exact: true }).click();
    await page.getByLabel("Texto (parte 1)").fill("## Subtítulo de prueba\n\nUn párrafo con **negrita**.");

    // Vídeo del iPhone (.mov) subido desde el dispositivo; el primer «completar» tarda un poco.
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/upload/complete", async (route) => {
      await held;
      await route.continue();
    });
    const pick = async (button: string, file: { name: string; mimeType: string; buffer: Buffer }) => {
      await page.getByRole("button", { name: button, exact: true }).click();
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("dialog").getByRole("button", { name: /Subir desde este dispositivo/ }).click();
      await (await chooser).setFiles(file);
    };
    await pick("Vídeo", { name: `${TAG}-clase.mov`, mimeType: "video/quicktime", buffer: mp4({ codec: "avc1", width: 1080, height: 1920, durationSec: 95, brand: "qt  " }) });
    await expect(page.getByText(/Subiendo «.*clase\.mov»|En cola/).first()).toBeVisible();
    const saveButton = page.getByRole("button", { name: "Guardar lección" });
    await expect(saveButton).toBeDisabled();
    await expect(page.getByText("Esperando a que termine la subida…")).toBeVisible();

    // Audio de Zoom (.m4a), en cola detrás del vídeo.
    await pick("Audio", { name: `${TAG}-zoom.m4a`, mimeType: "audio/mp4", buffer: m4a({ durationSec: 125 }) });
    await expect(page.getByText(`En cola: «${TAG}-zoom.m4a»`)).toBeVisible();

    // PDF de los materiales del curso.
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Cuaderno de trabajo\.pdf/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Imagen PNG.
    const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 120, g: 90, b: 160 } } }).png().toBuffer();
    await pick("Imagen", { name: `${TAG}-lamina.png`, mimeType: "image/png", buffer: png });

    release();
    await expect(saveButton).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator("[data-part]")).toHaveCount(5);
    await expect(page.locator("[data-part]").nth(1)).toHaveAttribute("data-part", "VIDEO");

    // El vídeo, arriba del todo.
    await page.getByRole("button", { name: "Subir parte 2" }).click();
    await expect(page.locator("[data-part]").first()).toHaveAttribute("data-part", "VIDEO");
    await expect(page.getByLabel("Duración (min)")).toHaveAttribute("placeholder", "Auto · 4");
    await noHorizontalScroll(page);

    await saveButton.click();
    await page.waitForURL(/\/lecciones\/[^/?]+\?guardada=1$/);
    await expect(page.getByText("Lección guardada")).toBeVisible();
    lessonId = new URL(page.url()).pathname.split("/").pop()!;

    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { parts: { orderBy: { sortOrder: "asc" }, include: { file: true } } } });
    expect(lesson.durationMin).toBe(4);
    expect(lesson.parts.map((p) => p.file?.kind ?? p.kind)).toEqual(["VIDEO", "TEXT", "AUDIO", "PDF", "IMAGE"]);
    expect(lesson.parts[0].file!.mimeType).toBe("video/quicktime");
    expect(lesson.parts[0].file!.durationSec).toBe(95);
    expect(lesson.parts[2].file!.durationSec).toBe(125);
    expect(lesson.parts[1].bodyFormat).toBe("MD");
    expect(lesson.parts[3].fileId).toBe(files.pdf);
    expect(lesson.kind).toBe("VIDEO");
    files.video = lesson.parts[0].fileId!;
    files.audio = lesson.parts[2].fileId!;
    files.image = lesson.parts[4].fileId!;

    // En el programa del curso: qué lleva y su duración.
    await page.goto(`/panel/productos/${courseId}`);
    const row = page.locator("[data-lesson-row]", { hasText: TITLE });
    await expect(row.getByText("Vídeo + texto + audio + PDF + imagen · 4 min")).toBeVisible();
  });

  test("borrador en este dispositivo: «Recuperar» y «Descartar»", async ({ page }) => {
    acceptDialogs(page);
    await demoLogin(page, "Ana Luna");
    const url = `/panel/productos/${courseId}/lecciones/${lessonId}`;
    await page.goto(url);
    await page.getByLabel("Título de la lección").fill(`${TITLE} (borrador)`);
    await expect(page.getByText("Cambios sin guardar")).toBeVisible();
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.getByText(/Tienes cambios sin guardar de las \d\d:\d\d en este dispositivo/)).toBeVisible();
    await expect(page.getByLabel("Título de la lección")).toHaveValue(TITLE);
    await page.getByRole("button", { name: "Recuperar" }).click();
    await expect(page.getByLabel("Título de la lección")).toHaveValue(`${TITLE} (borrador)`);

    await page.waitForTimeout(1000);
    await page.reload();
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByLabel("Título de la lección")).toHaveValue(TITLE);
    await page.reload();
    await expect(page.getByLabel("Título de la lección")).toHaveValue(TITLE);
    await expect(page.getByText(/Tienes cambios sin guardar/)).toHaveCount(0);
  });

  test("dos pantallas a la vez: la segunda no pisa lo que guardó la primera", async ({ page, context }) => {
    acceptDialogs(page);
    await demoLogin(page, "Ana Luna");
    const url = `/panel/productos/${courseId}/lecciones/${lessonId}`;
    await page.goto(url);
    const other = await context.newPage();
    acceptDialogs(other);
    await other.goto(`${PERSONAL}${url}`);

    await page.getByLabel("Título de la lección").fill(`${TITLE} A`);
    await page.getByRole("button", { name: "Guardar lección" }).click();
    await expect(page.getByText("Lección guardada")).toBeVisible();

    await other.getByLabel("Título de la lección").fill(`${TITLE} B`);
    await other.getByRole("button", { name: "Guardar lección" }).click();
    await expect(other.getByText(/Esta lección se ha cambiado desde otro dispositivo/)).toBeVisible();
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } })).title).toBe(`${TITLE} A`);

    // Se deja como estaba (y sin borrador de la otra pantalla).
    await page.getByLabel("Título de la lección").fill(TITLE);
    await page.getByRole("button", { name: "Guardar lección" }).click();
    await expect(page.getByText("Guardada", { exact: true })).toBeVisible();
    await other.evaluate(() => localStorage.clear());
    await other.close();
  });

  test("la alumna ve el vídeo arriba y el resto en orden; la lección es un solo paso", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    const videoRequest = page.waitForRequest((r) => r.url().includes(`/api/download/${files.video}?inline=1`));
    await page.goto(`/cuenta/cursos/${courseId}?leccion=${lessonId}`);
    const article = page.locator("article");
    await expect(article.getByRole("heading", { name: TITLE, level: 2 })).toBeVisible();
    await videoRequest;

    // El vídeo va antes del título.
    const leadFirst = await page.evaluate(() => {
      const lead = document.querySelector("article [data-lesson-lead] video");
      const h2 = document.querySelector("article h2");
      return !!lead && !!h2 && !!(lead.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(leadFirst).toBe(true);
    await expect(article.locator("[data-parts-label]")).toHaveText("Vídeo + texto + audio + PDF + imagen");
    await expect(article.getByRole("heading", { name: "Subtítulo de prueba", level: 3 })).toBeVisible();
    await expect(article.locator("strong", { hasText: "negrita" })).toBeVisible();
    await expect(article.locator("[data-audio-player] audio")).toHaveAttribute("src", `/api/stream/${files.audio}`);
    await expect(article.getByRole("link", { name: /Descargar audio/ })).toHaveAttribute("href", `/api/download/${files.audio}`);
    const pdfStream = page.waitForResponse((r) => r.url().includes(`/api/stream/${files.pdf}`) && [200, 206].includes(r.status()));
    await article.locator("[data-pdf-viewer]").scrollIntoViewIfNeeded();
    await pdfStream;
    await expect(article.getByRole("link", { name: /Descargar PDF/ })).toHaveAttribute("href", `/api/download/${files.pdf}`);
    const img = article.locator("[data-image-viewer] img").first();
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute("src", `/api/stream/${files.image}`);
    await noHorizontalScroll(page);

    // «Completar y seguir»: una fila de progreso para toda la lección y a la siguiente.
    await article.getByRole("button", { name: "Completar y seguir" }).click();
    await page.waitForURL((u) => u.searchParams.get("leccion") !== lessonId);
    await expect.poll(() => prisma.lessonProgress.count({ where: { userId: lauraId, lessonId } })).toBe(1);
  });

  test("«Mis archivos»: audio, imagen y PDF con su lección; el vídeo no", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    await page.goto("/cuenta/archivos");
    for (const name of [`${TAG}-zoom.m4a`, `${TAG}-lamina.png`]) {
      const row = page.locator("div.flex.items-center.gap-4", { hasText: name });
      await expect(row.getByRole("link", { name: `Lección: ${TITLE}` })).toHaveAttribute("href", `/cuenta/cursos/${courseId}?leccion=${lessonId}`);
    }
    const cuaderno = page.locator("div.flex.items-center.gap-4", { hasText: "Cuaderno de trabajo.pdf" });
    await expect(cuaderno.getByRole("link", { name: /^Lección: / })).toHaveAttribute("href", new RegExp(`/cuenta/cursos/${courseId}\\?leccion=`));
    await expect(page.getByText(`${TAG}-clase.mov`)).toHaveCount(0);
  });

  test("lista de lecciones plegable en el móvil", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    await page.goto(`/cuenta/cursos/${courseId}?leccion=${lessonId}`);
    const outline = page.locator("[data-outline-mobile]");
    await expect(outline.locator("summary")).toHaveText(/Lecciones del curso · \d+ de \d+ completadas/);
    await expect(page.locator("[data-outline-desktop]")).toBeHidden();
    await outline.locator("summary").click();
    await outline.getByRole("link", { name: /Sol, Luna y Ascendente/ }).click();
    await expect(page.locator("article h2")).toHaveText("Sol, Luna y Ascendente");
  });

  test("borrar un material usado pregunta y lo quita de la lección", async ({ page }) => {
    const seen = acceptDialogs(page);
    await demoLogin(page, "Ana Luna");
    await page.goto(`/panel/productos/${courseId}`);
    const row = page.locator("li", { hasText: `${TAG}-zoom.m4a` });
    await expect(row.getByText("En 1 lección")).toBeVisible();
    await row.getByRole("button", { name: /Eliminar/ }).click();
    await expect(page.locator("li", { hasText: `${TAG}-zoom.m4a` })).toHaveCount(0);
    expect(seen.some((m) => m.includes("está en 1 lección"))).toBe(true);

    await page.goto(`/panel/productos/${courseId}/lecciones/${lessonId}`);
    await expect(page.locator("[data-part]")).toHaveCount(4);
    await demoLogin(page, "Laura Martín");
    await page.goto(`/cuenta/cursos/${courseId}?leccion=${lessonId}`);
    await expect(page.locator("article h2")).toBeVisible();
    await expect(page.locator("article audio")).toHaveCount(0);
  });
});

test.describe.serial("Lecciones por partes · plataforma", () => {
  test.use({ baseURL: PLATFORM });

  test("programa público, PDF con «Descargar PDF», texto de antes y el programa del panel", async ({ page }) => {
    await page.goto("/ana/curso-conocete-tu-energia");
    const program = page.locator("section", { has: page.getByRole("heading", { name: "Programa" }) });
    await expect(program.locator("li", { hasText: "Sol, Luna y Ascendente" })).toContainText("Lectura · 12 min");
    await expect(program.locator("li", { hasText: "Ejercicio: dibuja tu mapa" })).toContainText("Texto + PDF · 20 min");
    // Sin nombres de archivo en la página pública.
    await expect(program.getByText("Cuaderno de trabajo.pdf")).toHaveCount(0);
    const tipos = await prisma.lesson.findFirstOrThrow({ where: { productId: courseId, title: "Los 5 tipos de Human Design" }, include: { parts: { include: { file: true } } } });
    const kinds = tipos.parts.map((p) => p.file?.kind ?? p.kind);
    expect(kinds).toEqual(expect.arrayContaining(["TEXT", "IMAGE", "PDF"]));

    await demoLogin(page, "Laura Martín", PLATFORM);
    const ejercicio = await prisma.lesson.findFirstOrThrow({ where: { productId: courseId, title: "Ejercicio: dibuja tu mapa" } });
    await page.goto(`/cuenta/cursos/${courseId}?leccion=${ejercicio.id}`);
    const article = page.locator("article");
    const textFirst = await page.evaluate(() => {
      const p = document.querySelector("article p:not(.eyebrow)");
      const pdf = document.querySelector("article [data-pdf-viewer]");
      return !!p && !!pdf && !!(p.compareDocumentPosition(pdf) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(textFirst).toBe(true);
    await expect(article.getByRole("link", { name: /Descargar PDF/ })).toHaveAttribute("href", `/api/download/${files.pdf}`);

    const sol = await prisma.lesson.findFirstOrThrow({ where: { productId: courseId, title: "Sol, Luna y Ascendente" } });
    await page.goto(`/cuenta/cursos/${courseId}?leccion=${sol.id}`);
    const paragraphs = page.locator("article div.space-y-4 > p");
    await expect(paragraphs).toHaveCount(2);
    expect(await page.locator("article [data-rich]").count()).toBe(0);
    expect(await article.innerText()).not.toContain("**");

    await demoLogin(page, "Ana Luna", PLATFORM);
    await page.goto(`/panel/productos/${courseId}`);
    await expect(page.locator("#lecciones select")).toHaveCount(0);
    const rows = page.locator("#lecciones [data-lesson-row]");
    const n = await rows.count();
    expect(n).toBeGreaterThan(5);
    for (let i = 0; i < n; i++) await expect(rows.nth(i).getByRole("link").first()).toHaveAttribute("href", new RegExp(`/panel/productos/${courseId}/lecciones/[^/]+$`));
  });
});
