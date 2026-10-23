import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Acceso a la cuenta y enlaces personales:
 *   · la sesión que se abre al pagar solo abre ese pedido (nunca otras compras de la misma cuenta);
 *   · el enlace mágico no lo gasta un GET (antivirus del correo) y solo vale una vez;
 *   · el enlace personal del recibo abre la compra sin contraseña y caduca con la marca de la creadora;
 *   · login con la marca de la creadora, «Crea tu contraseña», «No he sido yo» / «Sí, he sido yo»;
 *   · cambiar la contraseña cierra las demás sesiones y un enlace de otra cuenta pregunta antes.
 * Cada prueba deja los datos de demostración como estaban.
 */

const prisma = new PrismaClient();
const stamp = Date.now().toString().slice(-6);

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function passwordLogin(page: Page, email: string, password = "demo1234") {
  await page.goto("/entrar");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

/** Enlace del botón (por su texto) del último email de esa plantilla enviado a `to` desde `since`. */
async function lastEmailLink(to: string, template: string, label: string, since: Date) {
  const m = await prisma.emailMessage.findFirstOrThrow({ where: { to, template, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
  const href = m.html.match(new RegExp(`<a href="([^"]+)"[^>]*>${label}</a>`))?.[1];
  if (!href) throw new Error(`El email ${template} a ${to} no tiene el botón «${label}»`);
  return { url: href.replace(/&amp;/g, "&"), html: m.html };
}

/** Casillas obligatorias del checkout: condiciones de venta y renuncia al desistimiento. */
async function acceptConsents(page: Page) {
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByLabel(/Quiero acceder ya|Solicito que la sesión/).check();
}

async function buy(page: Page, path: string, name: string, email: string) {
  await page.goto(path);
  await page.fill("#name", name);
  await page.fill("#email", email);
  await acceptConsents(page);
  await page.getByRole("button", { name: /Pagar/ }).click();
  await page.waitForURL("**/gracias**");
  await expect(page.getByRole("heading", { name: "Compra completada" })).toBeVisible();
}

test.describe.serial("Acceso a la cuenta", () => {
  let receiptLink = "";

  test("la sesión de una compra solo abre ese pedido, aunque la cuenta ya existiera", async ({ page }) => {
    const laura = await prisma.user.findUniqueOrThrow({ where: { email: "laura@example.com" } });
    const booking = await prisma.booking.findFirstOrThrow({ where: { userId: laura.id, startAt: { not: null } } });
    const course = await prisma.product.findFirstOrThrow({ where: { slug: "curso-conocete-tu-energia" } });
    const oldPdf = await prisma.productFile.findFirstOrThrow({ where: { product: { slug: "gene-keys" } } });

    await buy(page, "/ana/lectura-astrologia/checkout", "Laura Martín", "laura@example.com");
    await page.getByRole("link", { name: /Acceder a mi contenido/ }).click();
    await page.waitForURL("**/cuenta/pedidos/**");
    await expect(page.getByText("Estás viendo solo esta compra.")).toBeVisible();
    const download = page.getByRole("link", { name: "Descargar" }).first();
    expect((await page.request.get((await download.getAttribute("href"))!)).status()).toBe(200);
    // Nada de lo que Laura ya tenía: ni su reserva (con su videollamada), ni su curso, ni su PDF.
    await page.goto(`/cuenta/sesiones/${booking.id}`);
    await expect(page).toHaveURL(/\/ana\/entrar/);
    await expect(page.getByText(/Enlace de (la videollamada|Zoom)/)).toHaveCount(0);
    await page.goto(`/cuenta/cursos/${course.id}`);
    await expect(page).toHaveURL(/\/ana\/entrar/);
    expect((await page.request.get(`/api/download/${oldPdf.id}`, { maxRedirects: 0 })).status()).not.toBe(200);
  });

  test("el enlace mágico no lo gasta un GET: se entra con «Entrar» y solo una vez", async ({ page }) => {
    const since = new Date();
    await page.goto("/entrar");
    await page.getByRole("button", { name: "Enlace por email" }).click();
    await page.fill("#ml-email", "laura@example.com");
    await page.getByRole("button", { name: "Enviarme el enlace" }).click();
    await expect(page.getByText(/Te hemos enviado un enlace/)).toBeVisible();
    const { url } = await lastEmailLink("laura@example.com", "MAGIC_LINK", "Entrar a mi cuenta", since);
    // Lo que haría el antivirus del correo: abrirlo sin pulsar nada.
    for (let i = 0; i < 2; i++) {
      const res = await page.request.get(url);
      expect(res.status()).toBe(200);
      expect(res.headers()["set-cookie"] ?? "").not.toContain("cirella_session");
    }
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Entra a tu cuenta" })).toBeVisible();
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/cuenta");
    await expect(page.getByRole("heading", { name: "Hola, Laura" })).toBeVisible();
    await page.goto(url);
    await expect(page).toHaveURL(/\/entrar\?error=enlace/);
  });

  test("el enlace personal del recibo abre la compra sin contraseña y caduca con la marca", async ({ page, browser }) => {
    const email = `recibo${stamp}@example.com`;
    const since = new Date();
    await buy(page, "/ana/gene-keys/checkout", "Rocío Recibo", email);
    const { url } = await lastEmailLink(email, "PURCHASE_RECEIPT", "Acceder a mi contenido", since);
    receiptLink = url;

    const other = await (await browser.newContext()).newPage();
    await other.goto(url);
    await other.waitForURL("**/cuenta/pedidos/**");
    await expect(other.getByText("Estás viendo solo esta compra.")).toBeVisible();
    await expect(other.getByRole("heading", { name: "Gene Keys" })).toBeVisible();
    await other.goto("/cuenta/compras");
    await expect(other).toHaveURL(/\/ana\/entrar/);
    await expect(other.getByText("Para ver todas tus compras")).toBeVisible();

    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: email } });
    const links = await prisma.orderLink.findMany({ where: { orderId: order.id } });
    await prisma.orderLink.updateMany({ where: { orderId: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    try {
      await other.goto(url);
      await expect(other).toHaveURL(/\/ana\/entrar/);
      await expect(other.getByText("Este enlace personal ha caducado")).toBeVisible();
    } finally {
      for (const l of links) await prisma.orderLink.update({ where: { id: l.id }, data: { expiresAt: l.expiresAt } });
      await other.context().close();
    }
  });

  test("login con la marca de la creadora: solo enlace por email y vuelta al mismo curso", async ({ page }) => {
    const course = await prisma.product.findFirstOrThrow({ where: { slug: "curso-conocete-tu-energia" } });
    await page.goto(`/cuenta/cursos/${course.id}`);
    await expect(page).toHaveURL(/\/ana\/entrar\?next=/);
    await expect(page.getByRole("heading", { name: "Entra a tu área" })).toBeVisible();
    await expect(page.getByText("Ana Luna").first()).toBeVisible();
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    await expect(page.getByText("¿Aún no tienes página?")).toHaveCount(0);

    const since = new Date();
    await page.fill("#ml-email", "laura@example.com");
    await page.getByRole("button", { name: "Enviarme el enlace" }).click();
    await expect(page.getByText(/Te hemos enviado un enlace/)).toBeVisible();
    const { url, html } = await lastEmailLink("laura@example.com", "MAGIC_LINK", "Entrar a mi cuenta", since);
    expect(html).toContain("Ana Luna");
    await page.goto(url);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(`**/cuenta/cursos/${course.id}`);
    await expect(page.getByRole("heading", { name: course.title })).toBeVisible();
  });

  test("registro con el email de una compradora: enlace → «Crea tu contraseña» → onboarding", async ({ page }) => {
    const carmen = await prisma.user.findUniqueOrThrow({ where: { email: "carmen@example.com" } });
    const since = new Date();
    try {
      await page.goto("/registro");
      await page.fill("#email", "carmen@example.com");
      await page.fill("#password", "intrusa1234");
      await page.getByRole("button", { name: "Crear mi cuenta" }).click();
      await expect(page.getByText(/Ya tienes una cuenta con este email/)).toBeVisible();
      await page.goto("/cuenta");
      await expect(page).toHaveURL(/\/entrar/);

      const { url } = await lastEmailLink("carmen@example.com", "MAGIC_LINK", "Entrar a mi cuenta", since);
      await page.goto(url);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.waitForURL("**/contrasena**");
      await expect(page.getByRole("heading", { name: "Crea tu contraseña" })).toBeVisible();
      await page.fill("#password", "carmen12345");
      await page.getByRole("button", { name: "Guardar contraseña" }).click();
      await page.waitForURL("**/onboarding");
    } finally {
      await prisma.user.update({ where: { id: carmen.id }, data: { passwordHash: carmen.passwordHash, emailVerifiedAt: carmen.emailVerifiedAt } });
    }
  });

  test("secuestro previo: «No he sido yo» cierra el acceso de quien registró el email", async ({ page, browser }) => {
    const email = `x${stamp}@example.com`;
    const since = new Date();
    await page.goto("/registro");
    await page.fill("#email", email);
    await page.fill("#password", "secreto123");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await page.waitForURL("**/onboarding");
    // Sin confirmar el email no hay área de cliente.
    await page.goto("/cuenta");
    await expect(page).toHaveURL(/\/entrar.*motivo=confirmar/);

    const { url } = await lastEmailLink(email, "VERIFY_EMAIL", "Confirmar mi email", since);
    const owner = await (await browser.newContext()).newPage();
    await owner.goto(url);
    await expect(owner.getByRole("heading", { name: "¿Has creado tú esta cuenta?" })).toBeVisible();
    await owner.getByRole("button", { name: "No he sido yo" }).click();
    await owner.waitForURL("**/contrasena?motivo=seguridad**");
    await expect(owner.getByText(/hemos borrado la contraseña anterior/)).toBeVisible();
    await owner.context().close();

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/entrar/);
    await passwordLogin(page, email, "secreto123");
    // La contraseña borrada ya no entra. El mensaje es el genérico (no revela que la cuenta existe
    // sin contraseña) y la pista para entrar con un enlace está siempre en el formulario.
    await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pide un enlace para entrar" })).toBeVisible();
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("alta normal: «Sí, he sido yo» sigue dentro y quita el aviso «Confirma tu email» del panel", async ({ page }) => {
    // Alta nueva: el onboarding no espera a la confirmación.
    const email = `y${stamp}@example.com`;
    let since = new Date();
    await page.goto("/registro");
    await page.fill("#email", email);
    await page.fill("#password", "secreto123");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await page.waitForURL("**/onboarding");
    let link = await lastEmailLink(email, "VERIFY_EMAIL", "Confirmar mi email", since);
    await page.goto(link.url);
    await page.getByRole("button", { name: "Sí, he sido yo" }).click();
    await page.waitForURL("**/onboarding");
    await page.goto("/cuenta");
    await expect(page.getByRole("heading", { name: /Hola/ })).toBeVisible();

    // Creadora sin confirmar: aviso en el panel y «Reenviarme el enlace».
    const ana = await prisma.user.findUniqueOrThrow({ where: { email: "ana@cirella.app" } });
    await prisma.user.update({ where: { id: ana.id }, data: { emailVerifiedAt: null } });
    try {
      await page.context().clearCookies();
      await demoLogin(page, "Ana Luna");
      await expect(page.getByText("Confirma tu email")).toBeVisible();
      since = new Date();
      await page.getByRole("button", { name: "Reenviarme el enlace" }).click();
      await expect(page.getByText(/Te hemos enviado el enlace/)).toBeVisible();
      link = await lastEmailLink("ana@cirella.app", "VERIFY_EMAIL", "Confirmar mi email", since);
      await page.goto(link.url);
      await page.getByRole("button", { name: "Sí, he sido yo" }).click();
      await page.waitForURL("**/panel");
      await expect(page.getByText("Confirma tu email")).toHaveCount(0);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: ana.id } })).emailVerifiedAt).not.toBeNull();
    } finally {
      await prisma.user.update({ where: { id: ana.id }, data: { emailVerifiedAt: ana.emailVerifiedAt } });
    }
  });

  test("cambiar la contraseña cierra las demás sesiones", async ({ page, browser }) => {
    const laura = await prisma.user.findUniqueOrThrow({ where: { email: "laura@example.com" } });
    const other = await (await browser.newContext()).newPage();
    try {
      await passwordLogin(page, "laura@example.com");
      await page.waitForURL("**/cuenta");
      await passwordLogin(other, "laura@example.com");
      await other.waitForURL("**/cuenta");

      await page.goto("/cuenta/perfil");
      await page.fill("input[name=password]", "nueva12345");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Perfil y contraseña actualizados")).toBeVisible();

      await other.goto("/cuenta");
      await expect(other).toHaveURL(/\/entrar/);
      await page.goto("/cuenta");
      await expect(page.getByRole("heading", { name: "Hola, Laura" })).toBeVisible();
    } finally {
      await prisma.user.update({ where: { id: laura.id }, data: { passwordHash: laura.passwordHash ?? (await hash("demo1234", 10)) } });
      await other.context().close();
    }
  });

  test("un enlace personal de otra cuenta pregunta antes de cambiar de sesión", async ({ page }) => {
    expect(receiptLink).not.toBe("");
    await demoLogin(page, "Ana Luna");
    await page.goto(receiptLink);
    await page.waitForURL("**/auth/enlace/cambiar**");
    await expect(page.getByRole("heading", { name: "Este enlace es de otra cuenta" })).toBeVisible();
    await page.getByRole("link", { name: /Seguir como Ana/ }).click();
    await page.waitForURL("**/panel");

    await page.goto(receiptLink);
    await page.waitForURL("**/auth/enlace/cambiar**");
    await page.getByRole("button", { name: "Salir y abrir el enlace" }).click();
    await page.waitForURL("**/cuenta/pedidos/**");
    await expect(page.getByText("Estás viendo solo esta compra.")).toBeVisible();
  });
});
