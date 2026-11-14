import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { base32Decode, hotp, totpStep } from "../lib/totp";

/**
 * Verificación en dos pasos de la dueña (web personal, puerto 3101, iPhone 13):
 *   · la activa desde Ajustes › Seguridad con la clave que enseña la pantalla y guarda los códigos;
 *   · entrar con contraseña y con el enlace por email pide el código antes de abrir el panel;
 *   · un código de recuperación vale una vez; «Recordar este dispositivo» se salta el código hasta
 *     «Olvidar todos»; desactivarla pide código y contraseña;
 *   · la alumna entra como siempre, sin código.
 * Deja a Cirella sin la verificación, como en la demo.
 */

test.use({ baseURL: process.env.E2E_PERSONAL_URL ?? "http://localhost:3101" });

const prisma = new PrismaClient();
const ANA = "ana@cirella.app";
let secret: Buffer = Buffer.alloc(0);
let codes: string[] = [];
/** Último paso de 30 s usado: cada código de la app vale una sola vez. */
let lastStep = 0;

async function cleanup() {
  const ana = await prisma.user.findUniqueOrThrow({ where: { email: ANA } });
  await prisma.$transaction([
    prisma.user.update({ where: { id: ana.id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: ana.id } }),
    prisma.trustedDevice.deleteMany({ where: { userId: ana.id } }),
    prisma.twoFactorChallenge.deleteMany({ where: { userId: ana.id } }),
    prisma.rateLimit.deleteMany({ where: { key: { startsWith: "2fa-user" } } }),
  ]);
}

test.beforeAll(cleanup);
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

/** Un código de la app que aún no se ha usado (el siguiente paso, dentro del margen de ±30 s). */
function nextCode() {
  const step = Math.max(totpStep(), lastStep + 1);
  if (step > totpStep() + 1) throw new Error("No quedan códigos sin usar en este momento");
  lastStep = step;
  return hotp(secret, step);
}

async function passwordLogin(page: Page) {
  await page.goto("/entrar");
  await page.fill("#email", ANA);
  await page.fill("#password", "demo1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !(u.pathname === "/entrar"));
}

async function logout(page: Page) {
  await page.context().clearCookies({ name: "cirella_session" });
}

async function useRecovery(page: Page, code: string, remember = false) {
  await page.getByRole("button", { name: /Usa un código de recuperación/ }).click();
  await page.getByLabel("Código de recuperación").fill(code);
  if (!remember) await page.getByLabel("Recordar este dispositivo 30 días").uncheck();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test.describe.serial("Verificación en dos pasos de la dueña", () => {
  test("la activa con la clave de la pantalla y guarda los códigos", async ({ page }) => {
    await passwordLogin(page);
    await expect(page).toHaveURL(/\/panel/);
    await expect(page.getByText("Protege tu panel: activa la verificación en dos pasos.")).toBeVisible();
    await page.goto("/panel/ajustes");
    await expect(page.locator("#seguridad")).toContainText("Sin activar");
    await page.locator("#seguridad").getByRole("link", { name: /Activar/ }).click();
    await page.waitForURL("**/panel/ajustes/seguridad");
    await page.getByRole("button", { name: "Empezar" }).click();
    await page.waitForURL("**/panel/ajustes/seguridad?paso=configurar");
    const open = page.getByRole("link", { name: "Abrir en mi app de códigos" });
    await expect(open).toHaveAttribute("href", /^otpauth:\/\/totp\/.+secret=[A-Z2-7]{32}&issuer=.+&algorithm=SHA1&digits=6&period=30$/);
    const key = (await page.getByTestId("totp-key").innerText()).replace(/\s/g, "");
    secret = base32Decode(key);

    await page.getByLabel("Escribe el código de 6 cifras").fill("000000");
    await page.getByRole("button", { name: "Activar" }).click();
    await expect(page.getByText(/Código incorrecto/)).toBeVisible();
    await page.getByLabel("Escribe el código de 6 cifras").fill(nextCode());
    await page.getByRole("button", { name: "Activar" }).click();

    const panel = page.getByTestId("recovery-codes");
    await expect(panel).toBeVisible();
    codes = (await panel.locator("li").allInnerTexts()).map((c) => c.trim());
    expect(codes).toHaveLength(10);
    await expect(page.getByRole("button", { name: "Terminar" })).toBeDisabled();
    await page.getByLabel("Los he guardado").check();
    await page.getByRole("link", { name: "Terminar" }).click();
    await page.waitForURL("**/panel/ajustes/seguridad?ok=activada");
    await expect(page.getByText("Activada", { exact: true })).toBeVisible();
    await expect(page.getByTestId("codes-left")).toHaveText("10");
    // La sesión desde la que se activó sigue abierta.
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByText("Protege tu panel: activa la verificación en dos pasos.")).toHaveCount(0);
  });

  test("con contraseña pide el código (teclado numérico, sin zoom) antes del panel", async ({ page }) => {
    await passwordLogin(page);
    await page.waitForURL("**/entrar/codigo");
    // Sin el código no hay panel.
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/entrar/);
    await page.goto("/entrar/codigo");
    const input = page.getByLabel("Código de tu app");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(input).toHaveAttribute("autocomplete", "one-time-code");
    const size = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
    await page.getByLabel("Recordar este dispositivo 30 días").uncheck();
    await input.fill("123456");
    await expect(page.getByText(/Código incorrecto/)).toBeVisible();
    await page.getByLabel("Código de tu app").fill(nextCode());
    await page.waitForURL((u) => u.pathname === "/panel");
    const mail = await prisma.emailMessage.findFirst({ where: { to: ANA, template: "LOGIN_ALERT" }, orderBy: { createdAt: "desc" } });
    expect(mail?.subject).toBe("Nuevo acceso a tu panel");
  });

  test("con el enlace por email también pide el código; el de recuperación vale una vez", async ({ page }) => {
    const since = new Date();
    await page.goto("/entrar?modo=enlace");
    await page.getByLabel("Tu email").fill(ANA);
    await page.getByRole("button", { name: "Enviarme el enlace" }).click();
    await expect(page.getByText(/Te hemos enviado un enlace/)).toBeVisible();
    const m = await prisma.emailMessage.findFirstOrThrow({ where: { to: ANA, template: "MAGIC_LINK", createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
    const href = m.html.match(/<a href="([^"]+auth\/magic[^"]+)"/)![1].replace(/&amp;/g, "&");
    await page.goto(href);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/entrar/codigo");

    await useRecovery(page, codes[0].toUpperCase());
    await page.waitForURL("**/panel/ajustes/seguridad?aviso=recuperacion");
    await expect(page.getByText(/Has entrado con un código de recuperación/)).toBeVisible();
    await expect(page.getByTestId("codes-left")).toHaveText("9");

    await logout(page);
    await passwordLogin(page);
    await page.waitForURL("**/entrar/codigo");
    await useRecovery(page, codes[0]);
    await expect(page.getByText(/Código incorrecto/)).toBeVisible();
  });

  test("«Recordar este dispositivo» se salta el código hasta «Olvidar todos»", async ({ page }) => {
    await passwordLogin(page);
    await page.waitForURL("**/entrar/codigo");
    await page.getByRole("button", { name: /Usa un código de recuperación/ }).click();
    await page.getByLabel("Código de recuperación").fill(codes[1]);
    await expect(page.getByLabel("Recordar este dispositivo 30 días")).toBeChecked();
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/panel"));

    await logout(page);
    await passwordLogin(page);
    await expect(page).toHaveURL(/\/panel/);

    await page.goto("/panel/ajustes/seguridad");
    await expect(page.getByText(/· último uso/).first()).toBeVisible();
    const forget = page.locator("details", { hasText: "Olvidar todos los dispositivos" });
    await forget.getByText("Olvidar todos los dispositivos").click();
    await forget.getByLabel("Código de tu app (o de recuperación)").fill(codes[2]);
    await forget.getByLabel("Contraseña", { exact: true }).fill("demo1234");
    await forget.getByRole("button", { name: "Olvidar todos", exact: true }).click();
    await page.waitForURL("**/panel/ajustes/seguridad?ok=olvidados");

    await logout(page);
    await passwordLogin(page);
    await page.waitForURL("**/entrar/codigo");
    await page.getByRole("button", { name: "Volver a empezar" }).click();
    await page.waitForURL((u) => u.pathname === "/entrar");
  });

  test("desactivarla pide código y contraseña; después entra sin código", async ({ page }) => {
    await passwordLogin(page);
    await page.waitForURL("**/entrar/codigo");
    await useRecovery(page, codes[3]);
    await page.waitForURL((u) => u.pathname.startsWith("/panel"));
    await page.goto("/panel/ajustes/seguridad");
    const form = page.locator("details", { hasText: "Desactivar la verificación en dos pasos" });
    await form.getByText("Desactivar la verificación en dos pasos").click();
    await form.getByLabel("Código de tu app (o de recuperación)").fill(codes[4]);
    await form.getByLabel("Contraseña", { exact: true }).fill("otra-contraseña");
    await form.getByRole("button", { name: "Desactivar", exact: true }).click();
    await expect(form.getByText("El código o la contraseña no son correctos.")).toBeVisible();
    await form.getByLabel("Código de tu app (o de recuperación)").fill(codes[4]);
    await form.getByLabel("Contraseña", { exact: true }).fill("demo1234");
    await form.getByRole("button", { name: "Desactivar", exact: true }).click();
    await page.waitForURL("**/panel/ajustes/seguridad?ok=desactivada");
    await expect(page.getByRole("button", { name: "Empezar" })).toBeVisible();

    await logout(page);
    await passwordLogin(page);
    await expect(page).toHaveURL(/\/panel/);
  });

  test("la alumna entra como siempre, sin código", async ({ page }) => {
    await page.goto("/entrar");
    await page.locator("form", { hasText: "Laura Martín" }).getByRole("button").click();
    await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
    await expect(page).toHaveURL(/\/cuenta/);
  });
});
