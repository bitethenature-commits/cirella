import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Portada nueva de la web personal de Ana (iPhone 13):
 *   · el orden de la portada y los accesos (tres burbujas en una fila, también en el móvil);
 *   · «Actualidades»: dos tarjetas con la fecha en grande, «Ver todas» y la lista por meses, con las
 *     direcciones antiguas de «Novedades» redirigidas;
 *   · Portal de Noticias: bloqueado (nada secreto en la página), «Suscribirme» → email → «Confirmar y
 *     entrar» → desbloqueado con su cuenta;
 *   · una oferta cobrada al precio de oferta con PayPal y con tarjeta (y una membresía en oferta que
 *     se renueva al precio normal), en la web que cobra (3102);
 *   · /cursos por método y /comunidad con los tres niveles;
 *   · una miembro de «Luna completa» lee las publicaciones de «Esencia» (nivel de abajo).
 * Deja los datos de demostración como estaban.
 */

const PERSONAL = `http://localhost:${process.env.E2E_PERSONAL_PORT ?? 3101}`;
const SALES = `http://localhost:${process.env.E2E_SALES_PORT ?? 3102}`;
test.use({ baseURL: PERSONAL });

const prisma = new PrismaClient();
const TAG = `e2e-portada-${Date.now()}`;
const MADRID = "Europe/Madrid";

test.afterAll(async () => {
  const users = (await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } })).map((u) => u.id);
  const orders = (await prisma.order.findMany({ where: { buyerEmail: { startsWith: TAG } }, select: { id: true } })).map((o) => o.id);
  const customers = (await prisma.customer.findMany({ where: { userId: { in: users } }, select: { id: true } })).map((c) => c.id);
  await prisma.$transaction([
    prisma.emailMessage.deleteMany({ where: { to: { startsWith: TAG } } }),
    prisma.loginToken.deleteMany({ where: { email: { startsWith: TAG } } }),
    prisma.subscriber.deleteMany({ where: { email: { startsWith: TAG } } }),
    prisma.session.deleteMany({ where: { userId: { in: users } } }),
    prisma.access.deleteMany({ where: { userId: { in: users } } }),
    prisma.subscription.deleteMany({ where: { userId: { in: users } } }),
    prisma.invoice.deleteMany({ where: { recipientEmail: { startsWith: TAG } } }),
    prisma.transaction.deleteMany({ where: { orderId: { in: orders } } }),
    prisma.paymentEvent.deleteMany({ where: { orderId: { in: orders } } }),
    prisma.orderLink.deleteMany({ where: { orderId: { in: orders } } }),
    prisma.order.deleteMany({ where: { id: { in: orders } } }),
    prisma.outboxEvent.deleteMany({ where: { OR: customers.map((id) => ({ payload: { path: ["customerId"], equals: id } })) } }),
    prisma.customer.deleteMany({ where: { userId: { in: users } } }),
    prisma.user.deleteMany({ where: { id: { in: users } } }),
  ]);
  await prisma.$disconnect();
});

async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await page.fill("#email", email);
  await page.fill("#password", "demo1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function fresh(browser: Browser, baseURL = PERSONAL) {
  const ctx = await browser.newContext({ baseURL, timezoneId: MADRID });
  return { ctx, page: await ctx.newPage() };
}

/** Enlace (por su texto) de un email guardado en el buzón de pruebas. */
const href = (html: string, label: string) => html.match(new RegExp(`<a href="([^"]+)"[^>]*>${label}</a>`))?.[1]?.replace(/&amp;/g, "&") ?? "";

test.describe.serial("Portada nueva", () => {
  test("el orden de la portada: presentación, accesos, actualidades, portal, sobre mí, sistemas, lecturas, cursos y códigos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ana Luna", level: 1 })).toBeVisible();
    await expect(page.getByText("Astrología · Human Design · Gene Keys")).toBeVisible();
    await expect(page.getByText("Conócete. Compréndete. Transfórmate.")).toBeVisible();
    // Sin botones principales en la demo.
    await expect(page.locator("a.cp-link")).toHaveCount(0);
    await expect(page.getByText(/Empieza aquí/)).toHaveCount(0);
    // El antiguo «Destacado» ya no sale.
    await expect(page.getByText("Destacado", { exact: true })).toHaveCount(0);

    const ids = ["actualidades", "portal", "sobre-mi", "sistemas", "lecturas", "cursos", "codigos"];
    const tops: number[] = [];
    for (const id of ids) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box, `#${id} en la portada`).not.toBeNull();
      tops.push(box!.y);
    }
    const nav = page.getByRole("navigation", { name: "Accesos" });
    const navBox = await nav.boundingBox();
    expect(navBox!.y).toBeLessThan(tops[0]);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    // Testimonios, preguntas frecuentes y contacto, después.
    const faq = await page.getByRole("heading", { name: "Preguntas frecuentes" }).boundingBox();
    expect(faq!.y).toBeGreaterThan(tops[tops.length - 1]);

    // «Sobre mí»: la tarjeta entera lleva a su página; los sistemas, a la suya.
    await expect(page.locator("#sobre-mi a")).toHaveAttribute("href", "/ana/p/sobre-mi");
    await expect(page.locator("#sobre-mi")).toContainText("Hola, soy Ana");
    for (const name of ["Human Design", "Gene Keys", "Astrología", "Mi energía"]) await expect(page.locator("#sistemas").getByRole("link", { name: new RegExp(name) })).toBeVisible();
    await page.locator("#sistemas").getByRole("link", { name: /Human Design/ }).click();
    await expect(page.getByRole("heading", { name: "Human Design", level: 1 })).toBeVisible();
  });

  test("accesos: tres burbujas con foto en una sola fila (también en el móvil)", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Accesos" });
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toHaveAccessibleName("Sobre mí");
    await expect(links.nth(1)).toHaveAccessibleName("Cursos");
    await expect(links.nth(2)).toHaveAccessibleName("Hacerte miembro");
    await expect(links.nth(2)).toHaveAttribute("href", "/ana/comunidad");
    const ys = await Promise.all([0, 1, 2].map(async (i) => (await links.nth(i).locator("img").boundingBox())!.y));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
    const viewport = page.viewportSize()!;
    const last = await links.nth(2).boundingBox();
    expect(last!.x + last!.width).toBeLessThanOrEqual(viewport.width);
    await links.nth(1).click();
    await page.waitForURL("**/ana/cursos");
    await expect(page.getByRole("heading", { name: "Cursos", level: 1 })).toBeVisible();
  });

  test("actualidades: las dos últimas con la fecha en grande, «Ver todas» y la lista por meses", async ({ page }) => {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const posts = await prisma.post.findMany({ where: { creatorId: ana.id, status: "PUBLISHED", publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" } });
    await page.goto("/");
    const section = page.locator("#actualidades");
    await expect(section.getByRole("heading", { name: "Actualidades" })).toBeVisible();
    const cards = section.locator("[data-post-card]");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveAttribute("data-post-card", posts[0].slug);
    await expect(cards.nth(1)).toHaveAttribute("data-post-card", posts[1].slug);
    // La de vídeo: fecha en grande, «Vídeo», su botón y su código.
    const day = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, day: "2-digit" }).format(posts[0].publishedAt!);
    await expect(cards.nth(0).locator("time")).toContainText(day);
    await expect(cards.nth(0)).toContainText("Vídeo");
    await expect(cards.nth(0).getByRole("link", { name: /Ver curso/ })).toHaveAttribute("href", "/ana/human-design-desde-cero");
    await expect(cards.nth(0)).toContainText("LUNA15");
    await expect(section.getByRole("link", { name: /Ver todas/ })).toHaveAttribute("href", "/actualidades");

    await section.getByRole("link", { name: /Ver todas/ }).click();
    await page.waitForURL("**/actualidades");
    await expect(page.getByRole("heading", { name: "Actualidades", level: 1 })).toBeVisible();
    const month = (d: Date) => {
      const s = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, month: "long", year: "numeric" }).format(d);
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    const months = [...new Set(posts.map((p) => month(p.publishedAt!)))];
    expect(months.length).toBeGreaterThan(1);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(months);
    await expect(page.locator("[data-post-card]")).toHaveCount(posts.length);

    // La publicación con su vídeo y su botón.
    await page.locator(`[data-post-card="${posts[0].slug}"]`).getByRole("link", { name: posts[0].title }).click();
    await page.waitForURL(`**/ana/actualidades/${posts[0].slug}`);
    await expect(page.locator('[data-post-media="video"]')).toBeVisible();
    await expect(page.locator("[data-post-cta]")).toContainText("LUNA15");

    // Las direcciones de antes redirigen para siempre.
    const old = await page.request.get("/ana/novedades", { maxRedirects: 0 });
    expect(old.status()).toBe(308);
    expect(old.headers().location).toMatch(/\/actualidades$/);
    const oldPost = await page.request.get("/ana/novedades/eclipse-de-octubre", { maxRedirects: 0 });
    expect(oldPost.status()).toBe(308);
    expect(oldPost.headers().location).toMatch(/\/ana\/actualidades\/eclipse-de-octubre$/);
    expect((await page.request.get("/novedades", { maxRedirects: 0 })).headers().location).toMatch(/\/actualidades$/);
  });

  test("portal: bloqueado → suscribirse → confirmar desde el email → desbloqueado con su cuenta", async ({ browser }) => {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const live = await prisma.portalItem.findFirstOrThrow({ where: { creatorId: ana.id, kind: "LIVE" } });
    const featured = await prisma.portalItem.findFirstOrThrow({ where: { creatorId: ana.id, featured: true } });
    const email = `${TAG}-nuria@example.com`;
    const { ctx, page } = await fresh(browser);
    await page.goto("/");
    const portal = page.locator("#portal");
    await expect(portal.locator('[data-portal="locked"]')).toBeVisible();
    await expect(portal.getByText(/Suscríbete a mi newsletter para (ver el vídeo|escuchar el audio)/)).toBeVisible();
    // Nada bloqueado viaja en la página ni sale de la API sin desbloquear.
    const html = await page.content();
    expect(html).not.toContain(live.linkUrl!);
    expect(html).not.toContain("/api/portal/");
    const api = await (await page.request.get("/api/portal?u=ana")).json();
    expect([api.unlocked, api.items.length]).toEqual([false, 0]);
    expect((await page.request.get(`/api/portal/${featured.id}/0`)).status()).toBe(401);

    const form = page.locator("#portal-form");
    await form.getByLabel("Tu nombre").fill("Nuria");
    await form.getByLabel("Tu email").fill(email);
    await form.getByRole("button", { name: /Suscribirme/ }).click();
    await expect(form.getByText(/Te hemos enviado un enlace/)).toBeVisible();
    // Sin la casilla no se envía (el navegador la exige); con ella, el email del portal.
    const mail = await prisma.emailMessage.findFirstOrThrow({ where: { to: email, template: "REGISTER" } });
    expect(mail.subject).toBe("Confirma tu suscripción y entra al Portal de Noticias");
    expect(await prisma.subscriber.findFirst({ where: { creatorId: ana.id, email } })).toBeNull();

    await page.goto(href(mail.html, "Confirmar y ver el portal"));
    await page.getByRole("button", { name: "Confirmar y entrar" }).click();
    await page.waitForURL("**/portal?bienvenida=1");
    await expect(page.locator('[data-portal="unlocked"]')).toBeVisible();
    const sub = await prisma.subscriber.findFirstOrThrow({ where: { creatorId: ana.id, email } });
    expect([sub.status, sub.source]).toEqual(["CONFIRMED", "FORM"]);
    expect(sub.consentText).toContain("newsletter de Ana Luna");
    // Ya lo ve todo: el archivo privado y el enlace del directo.
    await expect(page.locator(`[data-portal-item="${live.id}"]`).getByRole("link", { name: "Entrar al directo" })).toHaveAttribute("href", live.linkUrl!);
    const media = await page.request.get(`/api/portal/${featured.id}/0`);
    expect(media.status()).toBe(200);
    expect(media.headers()["content-type"]).toMatch(/^(video|audio)\//);
    expect((await (await page.request.get("/api/portal?u=ana")).json()).unlocked).toBe(true);
    // En la portada también, sin volver a escribir nada.
    await page.goto("/");
    await expect(page.locator('#portal [data-portal="unlocked"]')).toBeVisible();
    await ctx.close();
  });

  test("ofertas: el precio de oferta se ve tachado y se cobra con PayPal y con tarjeta; la membresía se renueva al precio normal", async ({ browser }) => {
    const { ctx, page } = await fresh(browser, SALES);
    await page.goto("/");
    const offers = page.locator("#ofertas");
    await expect(offers.getByRole("heading", { name: "Ofertas" })).toBeVisible();
    const card = offers.locator('[data-offer="human-design-desde-cero"]');
    await expect(card).toContainText("Early Bird");
    await expect(card.locator("s")).toContainText("99");
    await expect(card).toContainText("69");
    await card.click();
    await page.waitForURL("**/ana/human-design-desde-cero");
    await expect(page.locator("[data-regular-price]")).toContainText("99");
    await expect(page.locator("[data-price]")).toContainText("69");
    await expect(page.locator("[data-sale]").first()).toContainText("Early Bird");

    const pay = async (label: string, method: "PayPal" | "Tarjeta") => {
      await page.goto("/ana/human-design-desde-cero/checkout");
      await page.getByRole("radio", { name: new RegExp(method) }).click();
      await page.fill("#name", `Compradora ${label}`);
      await page.fill("#email", `${TAG}-${label}@example.com`);
      await page.getByLabel(/He leído y acepto/).check();
      await page.getByLabel(/Quiero acceder ya/).check();
      if (method === "PayPal") {
        await page.getByRole("button", { name: /Pagar con PayPal · 69/ }).click();
        await page.waitForURL(/checkoutnow\?token=/);
        await expect(page.getByText("69.00 EUR")).toBeVisible();
        await page.getByRole("button", { name: "Pagar con PayPal" }).click();
      } else await page.getByRole("button", { name: /^Pagar 69/ }).click();
      await page.waitForURL("**/ana/gracias**");
      const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: `${TAG}-${label}@example.com` } });
      expect([order.status, order.amountCents, (order.metadata as { sale?: { regularCents: number } }).sale?.regularCents]).toEqual(["PAID", 6900, 9900]);
      const charge = await prisma.transaction.findFirstOrThrow({ where: { orderId: order.id, type: "CHARGE" } });
      expect(charge.amountCents).toBe(6900);
    };
    await pay("paypal", "PayPal");
    await pay("tarjeta", "Tarjeta");

    // Membresía en oferta (primer pago): se cobra 11 € y la suscripción se renueva a 22 €.
    await page.goto("/ana/plena/checkout");
    await page.getByRole("radio", { name: /Tarjeta/ }).click();
    await page.fill("#name", "Compradora Plena");
    await page.fill("#email", `${TAG}-plena@example.com`);
    await page.getByLabel(/He leído y acepto/).check();
    await page.getByLabel(/Quiero empezar ya/).check();
    await page.getByRole("button", { name: /Unirme · 11/ }).click();
    await page.waitForURL("**/ana/gracias**");
    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: `${TAG}-plena@example.com` } });
    const sub = await prisma.subscription.findFirstOrThrow({ where: { orderId: order.id } });
    expect([order.amountCents, sub.priceCents]).toEqual([1100, 2200]);
    await ctx.close();
  });

  test("/cursos agrupa los cursos por método", async ({ browser }) => {
    const { ctx, page } = await fresh(browser, SALES);
    await page.goto("/cursos");
    await expect(page.getByRole("heading", { name: "Cursos", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Astrología", "Human Design", "Gene Keys", "Mi energía", "Especiales"]);
    await expect(page.locator('[data-course-group="HUMAN_DESIGN"]')).toContainText("Human Design desde cero");
    await expect(page.locator('[data-course-group="MI_ENERGIA"]')).toContainText("Conócete a través de tu energía");
    await expect(page.locator('[data-course-group="ESPECIAL"]')).toContainText("Especial: tu año lunar");
    await expect(page.locator('[data-course-group="ASTROLOGIA"]')).toContainText("Mini-curso gratis");
    // La portada lleva a esta página (hay más de un curso).
    await page.goto("/");
    await expect(page.locator("#cursos").getByRole("link", { name: /Ver todos los cursos/ })).toHaveAttribute("href", "/cursos");
    await ctx.close();
  });

  test("/comunidad: tres niveles de menos a más, cada uno con todo lo del anterior", async ({ browser }) => {
    const { ctx, page } = await fresh(browser, SALES);
    await page.goto("/comunidad");
    await expect(page.getByRole("heading", { name: "Elige cómo quieres acompañarte" })).toBeVisible();
    const tiers = page.locator("[data-tier]");
    await expect(tiers).toHaveCount(3);
    expect(await tiers.evaluateAll((els) => els.map((e) => e.getAttribute("data-tier")))).toEqual(["esencia", "plena", "luna-completa"]);
    await expect(tiers.nth(0)).toContainText("11");
    await expect(tiers.nth(0)).toContainText("Textos energéticos semanales");
    await expect(tiers.nth(1)).toContainText("Incluye todo lo de Esencia");
    await expect(tiers.nth(1).locator("s")).toContainText("22");
    await expect(tiers.nth(2)).toContainText("Incluye todo lo de Plena");
    await expect(tiers.nth(2)).toContainText("33");
    await expect(tiers.nth(2)).toContainText("Próximos círculos");
    // Lado a lado en un ordenador.
    await page.setViewportSize({ width: 1280, height: 900 });
    const ys = await Promise.all([0, 1, 2].map(async (i) => (await tiers.nth(i).boundingBox())!.y));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
    await tiers.nth(0).getByRole("link", { name: "Unirme a Esencia" }).click();
    await page.waitForURL("**/ana/esencia/checkout");
    await ctx.close();
  });

  test("una miembro de «Luna completa» lee las publicaciones de «Esencia», el nivel de abajo", async ({ page }) => {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const luna = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, slug: "luna-completa" } });
    const esencia = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, slug: "esencia" } });
    const post = await prisma.membershipPost.findFirstOrThrow({ where: { productId: esencia.id, status: "PUBLISHED", publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" } });
    await login(page, "laura@example.com");
    await page.goto("/cuenta/membresias");
    const included = page.locator("[data-included-membership]");
    await expect(included.filter({ hasText: "Esencia" })).toBeVisible();
    await expect(included.filter({ hasText: "Plena" })).toBeVisible();
    // El feed de su nivel incluye lo de los de abajo, marcado.
    await page.goto(`/cuenta/membresias/${luna.id}`);
    await expect(page.locator("[data-included-tiers]")).toContainText("Esencia");
    await expect(page.locator("[data-post-card]", { hasText: post.title }).locator("[data-tier-badge]")).toHaveText("De «Esencia»");
    await page.locator("[data-post-card]", { hasText: post.title }).click();
    await page.waitForURL(`**/cuenta/membresias/${esencia.id}/${post.id}`);
    await expect(page.getByRole("heading", { name: post.title })).toBeVisible();

    // Sin ese nivel (una alumna sin membresía), no.
    const other = await prisma.user.create({ data: { email: `${TAG}-sin@example.com`, name: "Sin nivel", passwordHash: await (await import("bcryptjs")).hash("demo1234", 10), emailVerifiedAt: new Date() } });
    await prisma.customer.create({ data: { creatorId: ana.id, userId: other.id, email: other.email, name: other.name } });
    await page.context().clearCookies();
    await login(page, other.email);
    await page.goto(`/cuenta/membresias/${esencia.id}/${post.id}`);
    await expect(page.getByRole("heading", { name: post.title })).toHaveCount(0);
  });
});
