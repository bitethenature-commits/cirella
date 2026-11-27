import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { mp4 } from "../scripts/fixtures/iso-media";

/**
 * Multimedia (servidor en modo personal, puerto 3101, web de Cirella; y la plataforma en el 3100):
 *   · un .mov HEVC vertical: avisos «HEVC» y «Vertical», «Min» relleno solo y, en Chromium (sin HEVC),
 *     el aviso con «Descargar» en un marco vertical;
 *   · audio de la web personal por /api/stream (Range → 206, velocidad) y «Tu acceso a este contenido
 *     ha terminado» al quitar el acceso;
 *   · plataforma: la URL firmada del audio se renueva sola (?format=json) sin perder el segundo;
 *   · PDF (pdf.js) en la lección y desde «Tu compra», también con la sesión de la compra;
 *   · imagen privada: se amplía, doble toque, Escape; /api/stream con nosniff y CSP sandbox;
 *   · Vimeo con código de privacidad, YouTube Shorts y un enlace de Loom que se abre fuera.
 * Deja los datos de demostración como estaban.
 */

const PERSONAL = process.env.E2E_PERSONAL_URL ?? `http://localhost:${process.env.E2E_PERSONAL_PORT ?? 3101}`;
const PLATFORM = process.env.E2E_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3100}`;
test.use({ baseURL: PERSONAL });

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const TAG = `multimedia-${stamp}`;
const tmp = mkdtempSync(path.join(tmpdir(), "cirella-e2e-media-"));

async function demoLogin(page: Page, label: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

let anaId = "";
let courseId = "";
let lauraId = "";
const created = { lessons: [] as string[], files: [] as string[], sessions: [] as string[] };

test.beforeAll(async () => {
  anaId = (await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } })).id;
  courseId = (await prisma.product.findFirstOrThrow({ where: { creatorId: anaId, slug: "know-your-energy" } })).id;
  lauraId = (await prisma.user.findUniqueOrThrow({ where: { email: "laura@example.com" } })).id;
});

test.afterAll(async () => {
  await prisma.lesson.deleteMany({ where: { OR: [{ id: { in: created.lessons } }, { creatorId: anaId, title: { startsWith: TAG } }] } });
  const files = await prisma.productFile.findMany({ where: { OR: [{ id: { in: created.files } }, { creatorId: anaId, name: { startsWith: TAG } }] } });
  await prisma.lesson.updateMany({ where: { fileId: { in: files.map((f) => f.id) } }, data: { fileId: null } });
  await prisma.productFile.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
  for (const f of files) if (f.storageKey) rmSync(path.join(process.cwd(), "storage", "private", f.storageKey), { force: true });
  await prisma.session.deleteMany({ where: { id: { in: created.sessions } } });
  await prisma.access.updateMany({ where: { userId: lauraId, productId: courseId }, data: { status: "ACTIVE" } });
  rmSync(tmp, { recursive: true, force: true });
  await prisma.$disconnect();
});

/** Guarda un archivo privado de Cirella (en el disco del almacenamiento local) y su ProductFile. */
async function privateFile(name: string, kind: string, mimeType: string, bytes: Buffer, ext: string) {
  const storageKey = `${anaId}/${TAG}-${randomBytes(4).toString("hex")}.${ext}`;
  const full = path.join(process.cwd(), "storage", "private", storageKey);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, bytes);
  const f = await prisma.productFile.create({ data: { creatorId: anaId, productId: courseId, name, kind, mimeType, sizeBytes: bytes.length, storageKey } });
  created.files.push(f.id);
  return f;
}

/** Lección con un vídeo de YouTube/Vimeo (una parte EMBED y su copia en Lesson.mediaUrl). */
async function lessonWith(data: { title: string; kind: string; mediaUrl: string }) {
  const mod = await prisma.courseModule.findFirstOrThrow({ where: { productId: courseId }, orderBy: { sortOrder: "asc" } });
  const l = await prisma.lesson.create({ data: { creatorId: anaId, productId: courseId, moduleId: mod.id, sortOrder: 90, ...data } });
  await prisma.lessonPart.create({ data: { creatorId: anaId, productId: courseId, lessonId: l.id, sortOrder: 0, kind: "EMBED", url: data.mediaUrl } });
  created.lessons.push(l.id);
  return l;
}

test.describe.serial("Multimedia", () => {
  test("HEVC vertical: avisos en Materiales, «Min» relleno y aviso para las alumnas sin HEVC", async ({ page }) => {
    const file = path.join(tmp, `${TAG}-vertical.mov`);
    writeFileSync(file, mp4({ codec: "hvc1", width: 1920, height: 1080, rotation: 90, durationSec: 125, brand: "qt  " }));
    await demoLogin(page, "Cirella");
    await page.goto(`/panel/productos/${courseId}`);
    await page.locator('input[accept^=".pdf"]').first().setInputFiles(file);
    const row = page.locator("li", { hasText: `${TAG}-vertical.mov` });
    await expect(row).toBeVisible();
    await expect(row.getByText("HEVC", { exact: true })).toBeVisible();
    await expect(row.getByText("Vertical", { exact: true })).toBeVisible();
    await expect(row.getByText("2 min", { exact: true })).toBeVisible();
    await row.getByText("HEVC", { exact: true }).click();
    await expect(row.getByText(/Más compatible/)).toBeVisible();
    const saved = await prisma.productFile.findFirstOrThrow({ where: { creatorId: anaId, name: `${TAG}-vertical.mov` } });
    created.files.push(saved.id);
    expect([saved.videoCodec, saved.width, saved.height, saved.durationSec, saved.mimeType]).toEqual(["HEVC", 1080, 1920, 125, "video/quicktime"]);

    // Lección nueva (estudio de Cursos) con el archivo de los materiales: la duración sale sola del vídeo.
    await page.goto(`/panel/cursos/${courseId}`);
    await page.locator("[data-structure-board]").getByRole("link", { name: "Añadir lección" }).first().click();
    await page.getByLabel("Título de la lección").fill(`${TAG} lección HEVC`);
    await page.getByRole("radiogroup", { name: "Estado de la lección" }).getByText("Publicada").click();
    await page.getByRole("button", { name: "Vídeo", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(`${TAG}-vertical\\.mov`) }).click();
    const card = page.locator('[data-part="VIDEO"]');
    await expect(card.getByText("HEVC", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Duración (min)")).toHaveAttribute("placeholder", "Auto · 3");
    await page.getByRole("button", { name: "Guardar lección" }).click();
    await expect(page.getByText("Lección guardada")).toBeVisible();
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { creatorId: anaId, title: `${TAG} lección HEVC` } });
    created.lessons.push(lesson.id);
    expect(lesson.durationMin).toBe(3);

    await demoLogin(page, "Laura Martín");
    await page.goto(`/area/courses/${courseId}?leccion=${lesson.id}`);
    const box = page.locator("[data-video-player] > div").first();
    await expect(box).toHaveAttribute("style", /aspect-ratio: ?1080 \/ 1920/);
    const hevc = await page.evaluate(() => document.createElement("video").canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"'));
    if (hevc === "") {
      const fallback = page.locator("[data-hevc-fallback]");
      await expect(fallback).toBeVisible();
      await expect(fallback.getByRole("link", { name: "Descargar" })).toHaveAttribute("href", `/api/download/${saved.id}`);
      // «Intentar igualmente» solo mientras no haya fallado de verdad (este vídeo sintético no tiene imagen).
    }
  });

  test("audio de la web personal: /api/stream con Range, velocidad y acceso retirado", async ({ page }) => {
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { productId: courseId, title: "Estrategia y autoridad" }, include: { file: true } });
    await demoLogin(page, "Laura Martín");
    await page.goto(`/area/courses/${courseId}?leccion=${lesson.id}`);
    const audio = page.locator("[data-audio-player] audio");
    await expect(audio).toHaveAttribute("src", `/api/stream/${lesson.file!.id}`);
    await page.waitForFunction(() => (document.querySelector("[data-audio-player] audio") as HTMLAudioElement | null)?.readyState! >= 1);
    const ranged = page.waitForResponse((r) => r.url().includes(`/api/stream/${lesson.file!.id}`) && r.status() === 206);
    await audio.evaluate((el: HTMLAudioElement) => {
      el.muted = true;
      el.currentTime = 30;
      void el.play().catch(() => {});
    });
    await ranged;
    await page.getByRole("button", { name: /Velocidad/ }).click();
    await page.getByRole("button", { name: /Velocidad/ }).click();
    expect(await audio.evaluate((el: HTMLAudioElement) => el.playbackRate)).toBe(1.5);
    await expect(page.getByRole("button", { name: "Velocidad 1,5×" })).toBeVisible();

    // La dueña le quita el acceso: la siguiente petición se rechaza y el reproductor lo dice.
    await prisma.access.updateMany({ where: { userId: lauraId, productId: courseId }, data: { status: "REVOKED" } });
    try {
      expect((await page.request.get(`/api/stream/${lesson.file!.id}`, { headers: { Range: "bytes=0-1" } })).status()).toBe(403);
      await audio.evaluate((el: HTMLAudioElement) => {
        el.pause();
        el.src = `${el.src.split("?")[0]}?r=${Date.now()}`;
        el.load();
      });
      await expect(page.getByText("Tu acceso a este contenido ha terminado")).toBeVisible();
    } finally {
      await prisma.access.updateMany({ where: { userId: lauraId, productId: courseId }, data: { status: "ACTIVE" } });
    }
  });

  test("plataforma: la URL firmada del audio se renueva sola y sigue en el mismo segundo", async ({ page }) => {
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { productId: courseId, title: "Estrategia y autoridad" }, include: { file: true } });
    await page.clock.install();
    await page.context().clearCookies();
    await page.goto(`${PLATFORM}/login`);
    await page.locator("form", { hasText: "Laura Martín" }).getByRole("button").click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.goto(`${PLATFORM}/area/courses/${courseId}?leccion=${lesson.id}`);
    const audio = page.locator("[data-audio-player] audio");
    await expect(audio).toHaveAttribute("src", `/api/download/${lesson.file!.id}?inline=1`);
    await page.waitForFunction(() => (document.querySelector("[data-audio-player] audio") as HTMLAudioElement | null)?.readyState! >= 1);
    await audio.evaluate((el: HTMLAudioElement) => {
      el.currentTime = 20;
    });
    // Casi 3 horas después (con la pestaña en pausa), la URL ya está a punto de caducar.
    const refreshed = page.waitForResponse((r) => r.url().includes(`/api/download/${lesson.file!.id}?inline=1&format=json`) && r.status() === 200);
    await page.clock.fastForward("02:50:00");
    await audio.evaluate((el: HTMLAudioElement) => {
      el.muted = true;
      void el.play().catch(() => {});
    });
    const res = await refreshed;
    const { url } = (await res.json()) as { url: string };
    await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.src)).toBe(url);
    await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThanOrEqual(19);
  });

  test("PDF en la lección: páginas con pdf.js, «Página 1 de N» y «Abrir»", async ({ page }) => {
    const worker = await page.request.get("/assets/pdfjs/6.3.289/pdf.worker.min.mjs");
    expect(worker.status()).toBe(200);
    expect(worker.headers()["content-type"]).toMatch(/javascript/);
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { productId: courseId, title: "Ejercicio: dibuja tu mapa" }, include: { file: true } });
    await demoLogin(page, "Laura Martín");
    await page.goto(`/area/courses/${courseId}?leccion=${lesson.id}`);
    const viewer = page.locator("[data-pdf-viewer]");
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer.getByText(/^Página 1 de \d+$/)).toBeVisible();
    await expect(viewer.locator('[data-pdf-page="1"] canvas')).toBeVisible();
    const total = Number((await viewer.getByText(/^Página 1 de \d+$/).textContent())!.match(/de (\d+)/)![1]);
    if (total > 1) {
      await viewer.locator('[data-pdf-page="2"]').scrollIntoViewIfNeeded();
      await expect(viewer.locator('[data-pdf-page="2"] canvas')).toBeVisible();
    }
    await expect(viewer.getByRole("link", { name: "Abrir" }).first()).toHaveAttribute("href", `/api/download/${lesson.file!.id}?inline=1`);
  });

  test("producto digital: «Ver» desde «Tu compra», también con la sesión de la compra; otro archivo no", async ({ page }) => {
    const gk = await prisma.product.findFirstOrThrow({ where: { creatorId: anaId, slug: "gene-keys" }, include: { files: true } });
    const order = await prisma.order.findFirstOrThrow({ where: { productId: gk.id, customer: { userId: lauraId } } });
    const pdf = gk.files.find((f) => f.kind === "PDF")!;
    await demoLogin(page, "Laura Martín");
    await page.goto(`/area/orders/${order.id}`);
    await page.locator("li", { hasText: pdf.name }).getByRole("link", { name: "Ver" }).click();
    await page.waitForURL(`**/area/files/${pdf.id}`);
    await expect(page.locator('[data-pdf-page="1"] canvas')).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Mis archivos" }).first()).toHaveAttribute("href", "/area/files");

    // Sesión limitada a ese pedido (la de justo después de pagar).
    const token = randomBytes(32).toString("base64url");
    const id = createHash("sha256").update(token).digest("hex");
    await prisma.session.create({ data: { id, userId: lauraId, verified: false, orderId: order.id, expiresAt: new Date(Date.now() + 3600_000) } });
    created.sessions.push(id);
    await page.context().clearCookies();
    await page.context().addCookies([{ name: "cirella_session", value: token, url: PERSONAL }]);
    await page.goto(`/area/files/${pdf.id}`);
    await expect(page.getByRole("link", { name: "Volver a tu compra" })).toHaveAttribute("href", `/area/orders/${order.id}`);
    await expect(page.locator('[data-pdf-page="1"] canvas')).toBeVisible();

    // Un archivo de otro producto (el curso, que no es de este pedido) no se enseña.
    const other = await prisma.productFile.findFirstOrThrow({ where: { productId: courseId, kind: "PDF" } });
    expect((await page.request.get(`/api/stream/${other.id}`)).status()).toBe(403);
  });

  test("imagen privada: se amplía, doble toque, Escape; /api/stream con nosniff y sandbox", async ({ page }) => {
    const png = await sharp({ create: { width: 600, height: 400, channels: 3, background: { r: 200, g: 170, b: 110 } } }).png().toBuffer();
    const file = await privateFile(`${TAG}-ficha.png`, "IMAGE", "image/png", png, "png");
    await demoLogin(page, "Laura Martín");
    await page.goto(`/area/files/${file.id}`);
    const img = page.locator("[data-image-viewer] button img");
    await expect(img).toHaveAttribute("src", `/api/stream/${file.id}`);
    const res = await page.request.get(`/api/stream/${file.id}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["content-security-policy"]).toContain("sandbox");
    expect(res.headers()["cross-origin-resource-policy"]).toBe("same-origin");
    expect(res.headers()["content-type"]).toBe("image/png");
    await img.click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    const zoomed = dialog.locator("img");
    await expect(zoomed).toHaveAttribute("data-zoom-scale", "1");
    await dialog.locator("[data-zoom-stage]").dblclick();
    await expect(zoomed).toHaveAttribute("data-zoom-scale", "2.5");
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Descargar para imprimir" })).toBeVisible();

    // Sin acceso: sin sesión pide entrar; con otra cuenta sin compra, prohibido.
    await page.context().clearCookies();
    expect((await page.request.get(`/api/stream/${file.id}`)).status()).toBe(401);
  });

  test("Vimeo con código, YouTube Shorts y un enlace de Loom que se abre fuera", async ({ page }) => {
    const vimeo = await lessonWith({ title: `${TAG} Vimeo`, kind: "VIDEO", mediaUrl: "https://vimeo.com/76979871/abcdef1234" });
    const shorts = await lessonWith({ title: `${TAG} Shorts`, kind: "VIDEO", mediaUrl: "https://youtube.com/shorts/dQw4w9WgXcQ" });

    // El panel avisa del enlace de Loom pero lo guarda.
    await demoLogin(page, "Cirella");
    await page.goto(`/panel/cursos/${courseId}`);
    await page.locator("[data-structure-board]").getByRole("link", { name: "Añadir lección" }).first().click();
    await page.getByLabel("Título de la lección").fill(`${TAG} Loom`);
    await page.getByRole("radiogroup", { name: "Estado de la lección" }).getByText("Publicada").click();
    await page.getByRole("button", { name: "Vídeo", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Pegar un enlace de YouTube o Vimeo" }).click();
    await page.getByLabel("Enlace de YouTube o Vimeo").fill("https://vimeo.com/76979871/abcdef1234");
    await expect(page.getByText(/Vimeo · oculto ✓/)).toBeVisible();
    await page.getByLabel("Enlace de YouTube o Vimeo").fill("https://www.loom.com/share/abc123");
    await expect(page.locator("[data-video-warning]")).toBeVisible();
    await page.getByRole("button", { name: "Guardar lección" }).click();
    await expect(page.getByText("Lección guardada")).toBeVisible();
    await expect(page.getByText(/No reconocemos el enlace del vídeo/)).toBeVisible();
    const loom = await prisma.lesson.findFirstOrThrow({ where: { creatorId: anaId, title: `${TAG} Loom` }, include: { parts: true } });
    created.lessons.push(loom.id);
    expect(loom.mediaUrl).toBe("https://www.loom.com/share/abc123");
    expect(loom.parts.map((p) => [p.kind, p.url])).toEqual([["EMBED", "https://www.loom.com/share/abc123"]]);

    await demoLogin(page, "Laura Martín");
    await page.goto(`/area/courses/${courseId}?leccion=${vimeo.id}`);
    const frame = page.locator("article iframe");
    await expect(frame).toHaveAttribute("src", /player\.vimeo\.com\/video\/76979871\?h=abcdef1234&dnt=1/);
    await page.goto(`/area/courses/${courseId}?leccion=${shorts.id}`);
    await expect(frame).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    await page.goto(`/area/courses/${courseId}?leccion=${loom.id}`);
    await expect(page.getByRole("link", { name: "Abrir el vídeo" })).toHaveAttribute("href", "https://www.loom.com/share/abc123");
  });

  test("subida por partes en la web personal (y «Cancelar»); en la plataforma, un solo PUT", async ({ page }) => {
    const big = path.join(tmp, `${TAG}-grande.mp4`);
    writeFileSync(big, Buffer.alloc(70 * 1024 * 1024, 1));
    const calls = { parts: 0, complete: 0, abort: 0, partPuts: 0, puts: 0 };
    page.on("request", (r) => {
      const u = r.url();
      if (u.includes("/api/upload/parts")) calls.parts++;
      if (u.includes("/api/upload/complete")) calls.complete++;
      if (u.includes("/api/upload/abort")) calls.abort++;
      if (r.method() === "PUT" && u.includes("/api/storage/local")) calls.puts++;
    });
    await demoLogin(page, "Cirella");
    await page.goto(`/panel/productos/${courseId}`);
    await expect(page.getByText(/Vídeo MP4 o MOV hasta 4 GB/)).toBeVisible();
    await page.locator('input[accept^=".pdf"]').first().setInputFiles(big);
    const row = page.locator("li", { hasText: `${TAG}-grande.mp4` });
    await expect(row).toBeVisible({ timeout: 60_000 });
    await expect(row.getByText("70 MB", { exact: true })).toBeVisible();
    expect(calls.parts).toBeGreaterThanOrEqual(1);
    expect(calls.puts).toBe(5);
    expect(calls.complete).toBe(1);

    // «Cancelar» a mitad: se avisa a /api/upload/abort y no aparece el archivo.
    const cancelled = path.join(tmp, `${TAG}-cancelada.mp4`);
    writeFileSync(cancelled, Buffer.alloc(70 * 1024 * 1024, 2));
    await page.route("**/api/storage/local?**", async (route) => {
      if (route.request().method() === "PUT") await new Promise((r) => setTimeout(r, 4000));
      await route.continue().catch(() => {});
    });
    const aborted = page.waitForRequest((r) => r.url().includes("/api/upload/abort"));
    await page.locator('input[accept^=".pdf"]').first().setInputFiles(cancelled);
    await expect(page.getByText(/No bloquees el iPhone/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await aborted;
    await expect(page.getByText(/subida cancelada/)).toBeVisible();
    await page.unroute("**/api/storage/local?**");
    expect(await prisma.productFile.count({ where: { creatorId: anaId, name: `${TAG}-cancelada.mp4` } })).toBe(0);

    // Plataforma: el mismo archivo va en un solo PUT, sin /api/upload/parts.
    const plat = path.join(tmp, `${TAG}-plataforma.mp4`);
    writeFileSync(plat, Buffer.alloc(70 * 1024 * 1024, 3));
    await page.context().clearCookies();
    await page.goto(`${PLATFORM}/login`);
    await page.locator("form", { hasText: "Cirella" }).getByRole("button").click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.goto(`${PLATFORM}/panel/productos/${courseId}`);
    await expect(page.getByText(/Hasta 1 GB por archivo/).first()).toBeVisible();
    const before = { ...calls };
    await page.locator('input[accept^=".pdf"]').first().setInputFiles(plat);
    await expect(page.locator("li", { hasText: `${TAG}-plataforma.mp4` })).toBeVisible({ timeout: 60_000 });
    expect(calls.parts).toBe(before.parts);
    expect(calls.puts - before.puts).toBe(1);
  });
});
