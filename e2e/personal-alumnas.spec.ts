import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";

/**
 * Área de alumnas en la web personal (puerto 3101, iPhone 13):
 *   · la página pública enseña «Entrar» (y «Mi área» con la sesión abierta) arriba y en el pie;
 *   · «Crear mi cuenta» → email «Confirma tu email para entrar» → «Confirmar y entrar» → su área con
 *     la bienvenida, la contraseña opcional y «Aún no tienes nada: mira los cursos»;
 *   · el perfil: nombre, foto, contraseña y cambio de email confirmado desde el email nuevo;
 *   · lo que consigue después con ese email aparece en su área; /registro sigue cerrado.
 * Deja los datos de demostración como estaban.
 */

test.use({ baseURL: process.env.E2E_PERSONAL_URL ?? "http://localhost:3101" });

const prisma = new PrismaClient();
const stamp = `${Date.now()}`.slice(-7);
const TAG = `alumnas-${stamp}`;
const lucia = `${TAG}-lucia@example.com`;
const nuevo = `${TAG}-nuevo@example.com`;

test.afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const orders = await prisma.order.findMany({ where: { customer: { userId: { in: userIds } } }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  const customers = await prisma.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  await prisma.emailMessage.deleteMany({ where: { to: { startsWith: TAG } } });
  await prisma.outboxEvent.deleteMany({
    where: { OR: [...ids.map((id) => ({ payload: { path: ["orderId"], equals: id } })), ...customers.map((c) => ({ payload: { path: ["customerId"], equals: c.id } }))] },
  });
  await prisma.loginToken.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: userIds.map((u) => `user:${u}`) } } });
  await prisma.access.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.lessonProgress.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.orderLink.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.customer.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

/** Enlace del botón (por su texto) del último email de esa plantilla a `to`. */
async function mailLink(to: string, template: string, label: string) {
  const m = await prisma.emailMessage.findFirstOrThrow({ where: { to, template }, orderBy: { createdAt: "desc" } });
  const href = m.html.match(new RegExp(`<a href="([^"]+)"[^>]*>${label}</a>`))?.[1];
  if (!href) throw new Error(`El email ${template} a ${to} no tiene el botón «${label}»`);
  return href.replace(/&amp;/g, "&");
}

async function passwordLogin(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

test.describe.serial("Web personal · área de alumnas", () => {
  test("«Entrar» visible → «Crear mi cuenta» → confirmar el email → su área de bienvenida", async ({ page }) => {
    await page.goto("/");
    const entry = page.getByTestId("account-entry");
    await expect(entry).toHaveText("Entrar");
    const box = await entry.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("link", { name: "¿Aún no tienes cuenta? Créala" })).toBeVisible();
    await entry.click();
    await page.waitForURL("**/ana/entrar?next=%2Fcuenta");
    await page.getByRole("link", { name: "Crear mi cuenta" }).click();
    await page.waitForURL("**modo=alta");
    await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
    const newsletter = page.getByLabel(/Quiero recibir las novedades/);
    await expect(newsletter).not.toBeChecked();
    await page.getByLabel("Tu nombre").fill("Lucía");
    await page.getByLabel("Tu email").fill(lucia);
    await newsletter.check();
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.getByText("Revisa tu email")).toBeVisible();
    expect(await prisma.user.findUnique({ where: { email: lucia } })).toBeNull();

    await page.goto(await mailLink(lucia, "REGISTER", "Confirmar y entrar"));
    await expect(page.getByRole("heading", { name: "Confirma tu email para entrar" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar y entrar" }).click();
    await page.waitForURL("**/cuenta?bienvenida=1");
    await expect(page.getByRole("heading", { name: "Bienvenida, Lucía. Ya tienes tu área." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aún no tienes nada: mira los cursos" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mini-curso/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver todo" })).toHaveAttribute("href", "/");

    const customer = await prisma.customer.findFirstOrThrow({ where: { email: lucia } });
    expect(customer.marketingOptIn).toBe(true);

    // Contraseña opcional desde la bienvenida.
    await page.getByLabel(/Crea una contraseña/).fill("lucia-12345");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await page.waitForURL((u) => u.pathname === "/cuenta" && !u.search);

    // Con la sesión abierta, la página pública dice «Mi área» y lleva a /cuenta.
    await page.goto("/");
    await expect(page.getByTestId("account-entry")).toHaveText("Mi área");
    await expect(page.getByTestId("account-entry")).toHaveAttribute("href", "/cuenta");
  });

  test("lo que consigue con su email aparece en su área; las fichas de producto también tienen «Entrar»", async ({ page }) => {
    await page.goto("/ana/mini-curso-tu-carta-en-3-pasos");
    await expect(page.getByTestId("account-entry")).toHaveText("Entrar");
    await page.fill("#claim-name", "Lucía");
    await page.fill("#claim-email", lucia);
    await page.getByLabel(/política de privacidad/).check();
    await page.getByRole("button", { name: /Quiero el mini-curso/ }).click();
    await expect(page.getByText("¡Listo! Revisa tu email")).toBeVisible();
    await passwordLogin(page, lucia, "lucia-12345");
    await page.goto("/cuenta");
    await expect(page.getByRole("heading", { name: "Aún no tienes nada: mira los cursos" })).toHaveCount(0);
    await expect(page.getByText(/Mini-curso/).first()).toBeVisible();
  });

  test("perfil: nombre, foto y cambio de email confirmado desde el email nuevo", async ({ page }) => {
    await passwordLogin(page, lucia, "lucia-12345");
    await page.goto("/cuenta/perfil");
    await page.getByLabel("Nombre").fill("Lucía Sol");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Perfil actualizado")).toBeVisible();

    const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 120, g: 90, b: 200 } } }).jpeg().toBuffer();
    await page.locator('#foto input[type=file]').setInputFiles({ name: "yo.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByAltText("Vista previa")).toBeVisible();
    await page.locator("#foto").getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Foto guardada")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("user-avatar").first()).toHaveAttribute("src", /^\/media\/[a-z0-9]+\/[a-f0-9]{20}\.webp$/);

    const card = page.locator("#email");
    await card.getByLabel("Email nuevo").fill(nuevo);
    await card.getByLabel("Tu contraseña").fill("mal-contraseña");
    await card.getByRole("button", { name: "Cambiar email" }).click();
    await expect(card.getByText("La contraseña no es correcta.")).toBeVisible();
    await card.getByLabel("Email nuevo").fill(nuevo);
    await card.getByLabel("Tu contraseña").fill("lucia-12345");
    await card.getByRole("button", { name: "Cambiar email" }).click();
    await expect(card.getByText(/Te hemos enviado un enlace a al•••/)).toBeVisible();
    expect(await prisma.emailMessage.count({ where: { to: lucia, template: "EMAIL_CHANGE_REQUESTED" } })).toBe(1);

    await page.goto(await mailLink(nuevo, "EMAIL_CHANGE_CONFIRM", "Confirmar el cambio"));
    await expect(page.getByRole("heading", { name: "Confirma tu nuevo email" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar el cambio" }).click();
    await page.waitForURL("**/cuenta/perfil?ok=email");
    await expect(page.getByText("Tu email ha cambiado.")).toBeVisible();
    await expect(page.getByText(nuevo).first()).toBeVisible();
    expect(await prisma.emailMessage.count({ where: { to: lucia, template: "EMAIL_CHANGED" } })).toBe(1);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: nuevo } });
    expect((await prisma.customer.findFirstOrThrow({ where: { userId: u.id } })).email).toBe(nuevo);

    // Salir: la página pública vuelve a decir «Entrar».
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await page.waitForURL((x) => x.pathname === "/");
    await expect(page.getByTestId("account-entry")).toHaveText("Entrar");
  });

  test("los emails a la alumna llevan «Tu área» y el registro de páginas sigue cerrado", async ({ page }) => {
    const m = await prisma.emailMessage.findFirstOrThrow({ where: { to: lucia, template: "REGISTER" } });
    expect(m.html).toMatch(/Tu área: <a href="[^"]+\/cuenta"/);
    await page.goto("/registro");
    await expect(page).toHaveURL(/\/entrar/);
  });
});
