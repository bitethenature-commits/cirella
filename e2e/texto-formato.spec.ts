import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

/**
 * Texto con formato (servidor en modo personal, puerto 3101, web de Cirella):
 *   · Novedad: la barra (Negrita, Encabezado, Lista, Enlace) escribe las marcas, «Cómo queda» las
 *     pinta y la publicación pública también; el enlace lleva rel="noopener nofollow", la meta
 *     descripción va sin marcas y un <script> escrito se ve como texto;
 *   · lo de antes no cambia al guardar sin tocar el texto (publicación, lección) y una lección de
 *     vídeo sin texto se guarda;
 *   · lección con formato vista por Laura (h3 y lista numerada); la de antes, igual que siempre;
 *   · demo: «Qué incluye» con ✦ y la novedad «Eclipse de octubre» con subtítulo y negrita;
 *   · editor de la página: la negrita se ve en la vista previa del móvil sin guardar;
 *   · Automatizaciones › Bienvenida con formato: el email lleva la negrita y el dominio del enlace.
 * Deja los datos de demostración como estaban.
 */

test.use({ baseURL: process.env.E2E_PERSONAL_URL ?? `http://localhost:${process.env.E2E_PERSONAL_PORT ?? 3101}` });

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const TAG = `texto-formato-${stamp}`;
const POST_TITLE = `Novedad con formato ${stamp}`;

async function demoLogin(page: Page, label: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Selecciona un trozo del texto del <textarea>. */
async function select(page: Page, field: ReturnType<Page["locator"]>, word: string) {
  await field.evaluate((el: HTMLTextAreaElement, w: string) => {
    const i = el.value.indexOf(w);
    el.focus();
    el.setSelectionRange(i, i + w.length);
  }, word);
}

async function caretAt(field: ReturnType<Page["locator"]>, text: string) {
  await field.evaluate((el: HTMLTextAreaElement, t: string) => {
    const i = el.value.indexOf(t);
    el.focus();
    el.setSelectionRange(i, i);
  }, text);
}

let anaId = "";
type SavedPart = { creatorId: string; productId: string; lessonId: string; sortOrder: number; kind: string; body: string | null; bodyFormat: string | null; fileId: string | null; url: string | null };
type SavedLesson = { id: string; title: string; kind: string; body: string | null; bodyFormat: string | null; fileId: string | null; version: number; parts: SavedPart[] };
const restore: { lessons: SavedLesson[]; welcome: unknown } = { lessons: [], welcome: undefined };

/** La lección y sus partes tal y como están, para dejarlas igual al acabar. */
async function snapshotLesson(id: string): Promise<SavedLesson> {
  const l = await prisma.lesson.findUniqueOrThrow({ where: { id }, include: { parts: { orderBy: { sortOrder: "asc" } } } });
  return {
    id: l.id, title: l.title, kind: l.kind, body: l.body, bodyFormat: l.bodyFormat, fileId: l.fileId, version: l.version,
    parts: l.parts.map(({ creatorId, productId, lessonId, sortOrder, kind, body, bodyFormat, fileId, url }) => ({ creatorId, productId, lessonId, sortOrder, kind, body, bodyFormat, fileId, url })),
  };
}

test.beforeAll(async () => {
  anaId = (await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } })).id;
});

test.afterAll(async () => {
  await prisma.post.deleteMany({ where: { creatorId: anaId, OR: [{ title: POST_TITLE }, { slug: { startsWith: TAG } }] } });
  await prisma.lesson.deleteMany({ where: { creatorId: anaId, title: { startsWith: TAG } } });
  for (const l of restore.lessons) {
    await prisma.lesson.update({ where: { id: l.id }, data: { title: l.title, kind: l.kind, body: l.body, bodyFormat: l.bodyFormat, fileId: l.fileId, version: l.version } });
    await prisma.lessonPart.deleteMany({ where: { lessonId: l.id } });
    await prisma.lessonPart.createMany({ data: l.parts });
  }
  const w = restore.welcome as { id: string; enabled: boolean; delayMinutes: number; subject: string | null; message: string | null; messageFormat: string | null } | null | undefined;
  if (w) await prisma.automation.update({ where: { id: w.id }, data: { enabled: w.enabled, delayMinutes: w.delayMinutes, subject: w.subject, message: w.message, messageFormat: w.messageFormat } });
  else if (w === null) await prisma.automation.deleteMany({ where: { creatorId: anaId, trigger: "WELCOME" } });
  const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const orders = await prisma.order.findMany({ where: { buyerEmail: { startsWith: TAG } }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await prisma.emailMessage.deleteMany({ where: { to: { startsWith: TAG } } });
  if (ids.length) await prisma.outboxEvent.deleteMany({ where: { OR: ids.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } });
  await prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: userIds.map((u) => `user:${u}`) } } });
  await prisma.access.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.orderLink.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.customer.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test.describe.serial("Texto con formato", () => {
  test("Novedad: barra de formato, «Cómo queda» y la publicación pública", async ({ page }) => {
    const dialogs: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await demoLogin(page, "Cirella");
    await page.goto("/panel/publicaciones/nueva");
    // «Título» sigue siendo solo el campo del título (ningún botón de la barra lo contiene).
    await expect(page.getByLabel("Título")).toHaveCount(1);
    // La barra se desliza de lado dentro de su caja: la página no se ensancha en el móvil.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel("Título").fill(POST_TITLE);
    const body = page.getByLabel("Texto", { exact: true });
    await body.fill("Mi consejo\nHola mundo <script>alert(1)</script>\nuno");
    await select(page, body, "mundo");
    await page.getByRole("button", { name: "Negrita" }).click();
    await caretAt(body, "Mi consejo");
    await page.getByRole("button", { name: "Encabezado", exact: true }).click();
    await caretAt(body, "uno");
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await body.press("End");
    await body.press("Enter");
    await body.pressSequentially("dos");
    await body.press("End");
    await body.press("Enter");
    // Intro en un punto vacío termina la lista; otro Intro deja la línea en blanco.
    await body.press("Enter");
    await body.press("Enter");
    await body.pressSequentially("Sígueme en ");
    await page.getByRole("button", { name: "Enlace" }).click();
    await page.getByLabel("Texto que se ve").fill("mi Instagram");
    // «Dirección» también es la etiqueta de la dirección de la publicación: el campo del enlace, por su ejemplo.
    const href = page.getByPlaceholder(/instagram.com\/tu_usuario/);
    await href.fill("hola");
    await page.getByRole("button", { name: "Insertar enlace" }).click();
    await expect(page.getByText(/Revisa la dirección/)).toBeVisible();
    await href.fill("instagram.com/ana");
    await page.getByRole("button", { name: "Insertar enlace" }).click();
    await expect(body).toHaveValue("## Mi consejo\nHola **mundo** <script>alert(1)</script>\n- uno\n- dos\n\nSígueme en [mi Instagram](https://instagram.com/ana)");

    const preview = page.locator("[data-rte-preview]");
    await expect(preview.locator("h2", { hasText: "Mi consejo" })).toBeVisible();
    await expect(preview.locator("strong", { hasText: "mundo" })).toBeVisible();
    await expect(preview.locator("ul li")).toHaveCount(2);
    await expect(preview.getByRole("link", { name: "mi Instagram" })).toHaveAttribute("href", "https://instagram.com/ana");

    await page.getByText("Publicada", { exact: true }).click();
    await page.getByRole("button", { name: "Publicar" }).click();
    await page.waitForURL(/\/panel\/publicaciones\/[^/?]+\?/);
    const post = await prisma.post.findFirstOrThrow({ where: { creatorId: anaId, title: POST_TITLE } });
    expect(post.bodyFormat).toBe("MD");

    await page.goto(`/ana/news/${post.slug}`);
    const article = page.locator("article");
    await expect(article.getByRole("heading", { name: "Mi consejo", level: 2 })).toBeVisible();
    await expect(article.locator("strong", { hasText: "mundo" })).toBeVisible();
    await expect(article.locator("li")).toHaveCount(2);
    const link = article.getByRole("link", { name: "mi Instagram" });
    await expect(link).toHaveAttribute("rel", "noopener nofollow");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(article.locator("p", { hasText: "<script>alert(1)</script>" })).toBeVisible();
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toContain("Mi consejo Hola mundo");
    expect(description).not.toContain("**");
    expect(description).not.toContain("##");
    expect(dialogs).toHaveLength(0);
  });

  test("lo de antes se guarda igual sin tocar el texto; una lección sin texto se guarda", async ({ page }) => {
    // Publicación de antes en borrador: pasarla a «Publicada» sin tocar el texto.
    const legacy = await prisma.post.create({
      data: { creatorId: anaId, slug: `${TAG}-antes`, title: `Antes ${stamp}`, body: "Texto de antes con **asteriscos** tal cual.", status: "DRAFT" },
    });
    await demoLogin(page, "Cirella");
    await page.goto(`/panel/publicaciones/${legacy.id}`);
    await expect(page.getByText(/Este texto es de antes del formato/)).toBeVisible();
    await page.getByText("Publicada", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Publicada: ya se ve en tu página.")).toBeVisible();
    const saved = await prisma.post.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(saved.status).toBe("PUBLISHED");
    expect(saved.bodyFormat).toBeNull();
    expect(saved.body).toBe(legacy.body);

    // Lección nueva sin texto (solo el título), y una lección de antes a la que solo se cambia el título.
    const course = await prisma.product.findFirstOrThrow({ where: { creatorId: anaId, slug: "know-your-energy" }, include: { modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" } } } } } });
    await page.goto(`/panel/cursos/${course.id}`);
    const firstModule = page.locator("[data-structure-board] [data-module]").first();
    await firstModule.getByRole("link", { name: "Añadir lección" }).click();
    await page.getByLabel("Título de la lección").fill(`${TAG} vídeo`);
    await page.getByRole("button", { name: "Guardar lección" }).click();
    await expect(page.getByText("Lección guardada")).toBeVisible();
    const created = await prisma.lesson.findFirstOrThrow({ where: { creatorId: anaId, title: `${TAG} vídeo` }, include: { parts: true } });
    expect(created.body).toBeNull();
    expect(created.bodyFormat).toBeNull();
    expect(created.parts).toHaveLength(0);
    // Las lecciones nuevas del estudio nacen en borrador.
    expect(created.published).toBe(false);

    const legacyLesson = course.modules[0].lessons.find((l) => l.title === "Sol, Luna y Ascendente")!;
    restore.lessons.push(await snapshotLesson(legacyLesson.id));
    await page.goto(`/panel/cursos/${course.id}/lecciones/${legacyLesson.id}`);
    await expect(page.getByText(/Este texto es de antes del formato/)).toBeVisible();
    await page.getByLabel("Título de la lección").fill("Sol, Luna y Ascendente (editada)");
    await page.getByRole("button", { name: "Guardar lección" }).click();
    await expect(page.getByText("Lección guardada")).toBeVisible();
    const after = await prisma.lesson.findUniqueOrThrow({ where: { id: legacyLesson.id }, include: { parts: true } });
    expect(after.title).toBe("Sol, Luna y Ascendente (editada)");
    expect(after.bodyFormat).toBeNull();
    expect(after.body).toBe(legacyLesson.body);
    expect(after.parts.map((p) => [p.body, p.bodyFormat])).toEqual([[legacyLesson.body, null]]);
  });

  test("lección con formato: Laura ve h3 y lista numerada; la de antes, igual que siempre", async ({ page }) => {
    const course = await prisma.product.findFirstOrThrow({ where: { creatorId: anaId, slug: "know-your-energy" } });
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { productId: course.id, title: "Ejercicio: dibuja tu mapa" } });
    restore.lessons.push(await snapshotLesson(lesson.id));
    await demoLogin(page, "Cirella");
    await page.goto(`/panel/cursos/${course.id}/lecciones/${lesson.id}`);
    const body = page.getByLabel("Texto (parte 1)");
    await body.fill("## Cómo hacerlo\n\n1. Descarga el cuaderno\n2. Completa el ejercicio 1");
    await page.getByRole("button", { name: "Guardar lección" }).click();
    await expect(page.getByText("Lección guardada")).toBeVisible();
    const saved = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id }, include: { parts: { orderBy: { sortOrder: "asc" } } } });
    expect(saved.bodyFormat).toBe("MD");
    expect(saved.parts[0].bodyFormat).toBe("MD");

    await demoLogin(page, "Laura Martín");
    await page.goto(`/area/courses/${course.id}?leccion=${lesson.id}`);
    await expect(page.getByRole("heading", { name: "Cómo hacerlo", level: 3 })).toBeVisible();
    await expect(page.locator("article ol li")).toHaveCount(2);

    const legacyLesson = await prisma.lesson.findFirstOrThrow({ where: { productId: course.id, title: { startsWith: "Sol, Luna y Ascendente" } } });
    await page.goto(`/area/courses/${course.id}?leccion=${legacyLesson.id}`);
    const paragraphs = page.locator("article div.space-y-4 > p");
    await expect(paragraphs).toHaveCount(2);
    expect(await page.locator("article [data-rich]").count()).toBe(0);
    expect(await paragraphs.first().innerHTML()).toBe(legacyLesson.body!.split(/\n{2,}/)[0].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  });

  test("demo: «Qué incluye» con ✦ y la novedad con formato de la semilla", async ({ page }) => {
    await page.goto("/ana/natal-chart-in-3-steps");
    const includes = page.locator("section", { has: page.getByRole("heading", { name: "Qué incluye" }) });
    await expect(includes.getByText("✦").first()).toBeVisible();
    await expect(includes.getByText("3 lecciones de lectura (10 minutos cada una)")).toBeVisible();

    await page.goto("/ana/news/october-eclipse");
    await expect(page.getByRole("heading", { name: "Mi consejo para estos días", level: 2 })).toBeVisible();
    await expect(page.locator("article strong", { hasText: "No tomes decisiones grandes en caliente." })).toBeVisible();
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description ?? "").not.toContain("**");
  });

  test("editor de la página: la negrita se ve en la vista previa del móvil sin guardar", async ({ page }) => {
    await demoLogin(page, "Cirella");
    await page.goto("/panel/pagina");
    await page.getByRole("button", { name: "Bloques", exact: true }).click();
    await page.getByRole("button", { name: "Añadir bloque de texto" }).click();
    await page.getByLabel("Título del bloque").last().fill(`Bloque ${stamp}`);
    await page.getByLabel("Texto del bloque").last().fill(`Texto con **fuerza ${stamp}** y más`);
    await page.getByRole("button", { name: "Vista previa" }).last().click();
    await expect(page.locator("strong", { hasText: `fuerza ${stamp}` }).filter({ visible: true })).toBeVisible();
  });

  test("Bienvenida con formato: el email lleva la negrita y el dominio del enlace", async ({ page }) => {
    restore.welcome = await prisma.automation.findUnique({ where: { creatorId_trigger: { creatorId: anaId, trigger: "WELCOME" } } });
    await demoLogin(page, "Cirella");
    await page.goto("/panel/automatizaciones");
    const card = page.locator("form", { hasText: "Email de bienvenida" });
    await card.getByText("Personalizar").click();
    await card.getByRole("checkbox").check();
    await card.locator('input[name="delayMinutes"]').fill("0");
    await card.getByLabel("Tu mensaje").fill(`Hola, **bienvenida ${stamp}**. Mira [mi Instagram](https://instagram.com/ana)`);
    await card.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect.poll(async () => (await prisma.automation.findUnique({ where: { creatorId_trigger: { creatorId: anaId, trigger: "WELCOME" } } }))?.messageFormat).toBe("MD");

    await page.context().clearCookies();
    const to = `${TAG}-bienvenida@example.com`;
    await page.goto("/ana/natal-chart-in-3-steps");
    await page.fill("#claim-name", "Prueba Formato");
    await page.fill("#claim-email", to);
    await page.getByLabel(/política de privacidad/).check();
    await page.getByRole("button", { name: /Quiero el mini-curso/ }).click();
    await expect(page.getByText("¡Listo! Revisa tu email")).toBeVisible();
    const mail = await expect
      .poll(async () => (await prisma.emailMessage.findFirst({ where: { to, template: "WELCOME" } }))?.html ?? "")
      .toContain(`bienvenida ${stamp}`)
      .then(() => prisma.emailMessage.findFirstOrThrow({ where: { to, template: "WELCOME" } }));
    expect(mail.html).toMatch(new RegExp(`<strong[^>]*>bienvenida ${stamp}</strong>`));
    expect(mail.html.replace(/<[^>]+>/g, "")).toContain("mi Instagram (instagram.com)");
    expect(mail.dedupeKey).toMatch(/^welcome:/);
  });
});
