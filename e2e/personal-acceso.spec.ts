import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

/**
 * Modo personal · acceso a los productos (servidor en modo personal, puerto 3101):
 *   · gratis con email: privacidad obligatoria (validada en el servidor), acceso por email con el
 *     enlace directo al curso, y repetir con el mismo email reenvía el enlace sin duplicar;
 *   · pago en otra web: botón a la web externa (clic medido), precio sin «IVA incluido»;
 *   · el checkout de pago no existe;
 *   · panel: el formulario solo ofrece gratis o externo; «Dar acceso» y «Quitar acceso»;
 *     «Inscripciones» con quién se ha apuntado a qué y su CSV.
 * Deja los datos de demostración como estaban.
 */

test.use({ baseURL: process.env.E2E_PERSONAL_URL ?? "http://localhost:3101" });

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const TAG = `personal-acceso-${stamp}`;
const email = (n: string) => `${TAG}-${n}@example.com`;
const FREE = "/ana/mini-curso-tu-carta-en-3-pasos";
const EXTERNAL = "/ana/revolucion-solar";
let extProductId = "";

test.beforeAll(async () => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  // Una guía que se paga en Hotmart pero se descarga aquí: la dueña da el acceso a mano.
  const p = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "DIGITAL", slug: `${TAG}-guia`, title: `Guía de prueba ${stamp}`, priceCents: 2900, status: "PUBLISHED",
      accessMode: "EXTERNAL", externalUrl: "https://pay.hotmart.com/prueba", externalLabel: "Comprar en Hotmart", sortOrder: 99,
    },
  });
  await prisma.productFile.create({ data: { creatorId: ana.id, productId: p.id, name: "Guía en PDF", kind: "LINK", url: "https://example.com/guia.pdf" } });
  extProductId = p.id;
});

test.afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { buyerEmail: { startsWith: TAG } }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  await prisma.emailMessage.deleteMany({ where: { to: { startsWith: TAG } } });
  if (ids.length) await prisma.outboxEvent.deleteMany({ where: { OR: ids.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } });
  await prisma.analyticsEvent.deleteMany({ where: { OR: [{ productId: extProductId }, { visitorId: { in: userIds.map((u) => `user:${u}`) } }] } });
  await prisma.access.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.lessonProgress.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.orderLink.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.customer.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (extProductId) {
    await prisma.productFile.deleteMany({ where: { productId: extProductId } });
    await prisma.product.deleteMany({ where: { id: extProductId } });
  }
  await prisma.$disconnect();
});

/** Enlace del botón (por su texto) del último email de acceso enviado a `to`. */
async function accessEmailLink(to: string, label: string) {
  const m = await prisma.emailMessage.findFirstOrThrow({ where: { to, template: "ACCESS_GRANTED" }, orderBy: { createdAt: "desc" } });
  const href = m.html.match(new RegExp(`<a href="([^"]+)"[^>]*>${label}</a>`))?.[1];
  if (!href) throw new Error(`El email de acceso a ${to} no tiene el botón «${label}»`);
  return { url: href.replace(/&amp;/g, "&"), subject: m.subject, html: m.html };
}

async function ownerLogin(page: Page) {
  await page.goto("/entrar");
  await page.fill("#email", "ana@cirella.app");
  await page.fill("#password", "demo1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

test.describe.serial("Modo personal · acceso a los productos", () => {
  const lucia = email("lucia");

  test("gratis con email: privacidad obligatoria, acceso por email y directo al curso", async ({ page }) => {
    await page.goto(FREE);
    await expect(page.getByText("Gratis", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("IVA incluido")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^(Pagar|Comprar)/ })).toHaveCount(0);

    await page.fill("#claim-name", "Lucía Prueba");
    await page.fill("#claim-email", lucia);
    // La casilla de privacidad empieza sin marcar y el servidor no deja seguir sin ella.
    await expect(page.getByLabel(/política de privacidad/)).not.toBeChecked();
    await expect(page.getByLabel(/Quiero recibir novedades/)).not.toBeChecked();
    await page.getByRole("button", { name: /Quiero el mini-curso/ }).click();
    await expect(page.getByText("necesitamos que aceptes la política de privacidad")).toBeVisible();
    expect(await prisma.order.count({ where: { buyerEmail: lucia } })).toBe(0);

    await page.getByLabel(/política de privacidad/).check();
    await page.getByLabel(/Quiero recibir novedades/).check();
    await page.getByRole("button", { name: /Quiero el mini-curso/ }).click();
    await expect(page.getByText("¡Listo! Revisa tu email")).toBeVisible();

    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: lucia }, include: { transactions: true, invoices: true } });
    expect(order.paymentProvider).toBe("free");
    expect(order.amountCents).toBe(0);
    expect(order.taxCents + order.platformFeeCents).toBe(0);
    expect(order.transactions).toHaveLength(0);
    expect(order.invoices).toHaveLength(0);

    const mail = await accessEmailLink(lucia, "Empezar el curso");
    expect(mail.subject).toBe("Ya tienes acceso a «Mini-curso gratis: tu carta natal en 3 pasos»");
    expect(mail.html).not.toContain("Enviado con Cirella");
    // El enlace personal abre una sesión limitada a este acceso y lleva directo al curso.
    await page.goto(mail.url);
    await page.waitForURL(`**/cuenta/cursos/${order.productId}**`);
    await expect(page.getByText("Paso 1 · Tu Sol: dónde brillas").first()).toBeVisible();
  });

  test("repetir con el mismo email reenvía el enlace y no duplica", async ({ page }) => {
    await page.goto(FREE);
    await page.fill("#claim-name", "Lucía Prueba");
    await page.fill("#claim-email", lucia);
    await page.getByLabel(/política de privacidad/).check();
    await page.getByRole("button", { name: /Quiero el mini-curso/ }).click();
    // Mismo mensaje que la primera vez: el formulario no revela quién está apuntado.
    await expect(page.getByText("¡Listo! Revisa tu email")).toBeVisible();
    expect(await prisma.order.count({ where: { buyerEmail: lucia } })).toBe(1);
    expect(await prisma.emailMessage.count({ where: { to: lucia, template: "ACCESS_GRANTED" } })).toBe(2);
  });

  test("pago en otra web: botón a la web externa con el clic medido y sin «IVA incluido»", async ({ page, context }) => {
    // La web externa no se visita de verdad.
    await context.route("https://calendly.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>Calendly</p>" }));
    const product = await prisma.product.findFirstOrThrow({ where: { slug: "revolucion-solar" } });
    const clicksBefore = await prisma.analyticsEvent.count({ where: { productId: product.id, type: "PRODUCT_CLICK" } });
    await page.goto(EXTERNAL);
    await expect(page.getByText("Pago en calendly.com").first()).toBeVisible();
    await expect(page.getByText("IVA incluido")).toHaveCount(0);
    const button = page.getByRole("link", { name: /Reservar en Calendly/ }).first();
    await expect(button).toHaveAttribute("href", "https://calendly.com/ana-luna/revolucion-solar");
    await expect(button).toHaveAttribute("target", "_blank");
    const popup = page.waitForEvent("popup");
    await button.click();
    await (await popup).close();
    await expect.poll(() => prisma.analyticsEvent.count({ where: { productId: product.id, type: "PRODUCT_CLICK" } })).toBeGreaterThan(clicksBefore);
  });

  test("el checkout de pago no existe en la web personal", async ({ page }) => {
    const r = await page.goto("/ana/lectura-astrologia/checkout");
    expect(page.url()).not.toContain("/checkout");
    expect(r?.status()).toBe(404);
    const r2 = await page.goto(`${FREE}/checkout`);
    expect(page.url()).not.toContain("/checkout");
    expect(r2?.status()).toBe(200);
  });

  test("panel: solo gratis o externo, dar y quitar acceso, e inscripciones con CSV", async ({ page }) => {
    await ownerLogin(page);
    const free = await prisma.product.findFirstOrThrow({ where: { slug: "mini-curso-tu-carta-en-3-pasos" } });
    await page.goto(`/panel/productos/${free.id}`);
    const modes = page.getByRole("radiogroup", { name: "Cómo se consigue" });
    await expect(modes.getByText("Gratis con email")).toBeVisible();
    await expect(modes.getByText("Pago en otra web")).toBeVisible();
    await expect(modes.getByText("Pago en la web")).toHaveCount(0);

    // Dar acceso a una persona que ha pagado en Hotmart.
    const eva = email("eva");
    await page.goto(`/panel/productos/${extProductId}`);
    await page.fill("#grant-name", "Eva Prueba");
    await page.fill("#grant-email", eva);
    await page.getByRole("button", { name: "Dar acceso" }).click();
    await expect(page.getByText(`${eva} ya tiene acceso`)).toBeVisible();
    const manual = await prisma.order.findFirstOrThrow({ where: { buyerEmail: eva }, include: { customer: true } });
    expect(manual.paymentProvider).toBe("manual");
    expect(manual.amountCents).toBe(0);
    const mail = await accessEmailLink(eva, "Acceder a mi contenido");
    expect(mail.subject).toBe(`Ya tienes acceso a «Guía de prueba ${stamp}»`);

    // Quitar acceso: confirmación y el acceso queda retirado.
    await page.reload();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: `Quitar acceso a ${eva}` }).click();
    await expect(page.getByText("Acceso retirado. Sus enlaces ya no funcionan.")).toBeVisible();
    const access = await prisma.access.findFirstOrThrow({ where: { userId: manual.customer!.userId, productId: extProductId } });
    expect(access.status).toBe("REVOKED");

    // Inscripciones: quién se ha apuntado a qué, y su CSV.
    await page.goto("/panel/ventas?rango=all");
    await expect(page.getByRole("heading", { name: "Inscripciones" })).toBeVisible();
    await expect(page.getByText(lucia).first()).toBeVisible();
    const csv = await page.request.get("/panel/ventas/csv?rango=all");
    expect(csv.status()).toBe(200);
    const body = await csv.text();
    expect(body.split("\n")[0]).toContain("quiere_novedades");
    expect(body).toContain(lucia);
    expect(body).toContain(eva);
  });
});
