import { expect, test, type Page } from "@playwright/test";
import { lauraSessionLabel } from "./demo-data";
import { freeTimes, pickDay } from "./slots";

/**
 * Reembolsar, cancelar y cambiar de fecha avisando a la clienta:
 *   · Ana cancela y reembolsa la sesión de Carmen (con confirmación; cancelar el diálogo no hace nada);
 *   · Ana propone otra fecha a una compradora nueva, que ve la propuesta en su cuenta;
 *   · Ana devuelve una parte de una venta digital;
 *   · Laura desiste de su lectura dentro de los 14 días.
 * Depende solo del seed (npm run db:reset) y corre después de flujo-principal.spec.ts.
 */

const stamp = Date.now().toString().slice(-6);
const buyerName = `Olga Cambio${stamp}`;
const buyerEmail = `olga${stamp}@example.com`;

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

/** Asuntos del buzón de demostración para un destinatario (lo abre la administradora). */
async function expectMail(page: Page, to: string, subject: string | RegExp) {
  await page.context().clearCookies();
  await page.goto(`/entrar?next=${encodeURIComponent(`/dev/correo?to=${to}`)}`);
  await page.locator("form", { hasText: "Superadmin" }).getByRole("button").click();
  await page.waitForURL("**/dev/correo**");
  await expect(page.getByText(subject).first()).toBeVisible();
}

test.describe.serial("Reembolsos y cambios", () => {
  test("Reservas: cancelar y reembolsar la sesión de Carmen, con confirmación", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    await page.goto("/panel/reservas");
    // Ya no hay un «Cancelar» de un toque junto a la videollamada.
    await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toHaveCount(0);
    const card = page.locator(".card", { hasText: "Carmen Ruiz" }).filter({ hasText: "Sesión 1:1" }).first();
    await card.getByRole("link", { name: /Cambiar o cancelar/ }).click();
    await page.waitForURL(/\/panel\/reservas\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "Cambiar o cancelar" })).toBeVisible();

    // Si se cancela el diálogo, no pasa nada.
    await page.getByRole("radio", { name: /Cancelar y reembolsar/ }).check();
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: /Cancelar y reembolsar \d/ }).click();
    await expect(page).toHaveURL(/\/panel\/reservas\/[^/?]+$/);
    const detail = page.url();
    await page.goto("/panel/reservas");
    await expect(page.locator(".card", { hasText: "Carmen Ruiz" }).filter({ hasText: "Sesión 1:1" }).first()).toBeVisible();

    // Aceptando, se cancela y se devuelve el dinero.
    await page.goto(detail);
    await page.getByRole("radio", { name: /Cancelar y reembolsar/ }).check();
    await page.getByRole("textbox", { name: /Mensaje para Carmen/ }).fill("Me ha surgido un imprevisto, lo siento mucho.");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Cancelar y reembolsar \d/ }).click();
    await page.waitForURL("**/panel/reservas?ok=reembolsada");
    await expect(page.getByText("Sesión cancelada y reembolsada. Hemos avisado a la clienta.")).toBeVisible();
    const history = page.locator("section", { has: page.getByRole("heading", { name: "Historial" }) });
    const row = history.locator(".card > div", { hasText: "Carmen Ruiz" }).filter({ hasText: "Reembolsada" });
    await expect(row).toContainText("Cancelada");
    await expect(row).toContainText("Me ha surgido un imprevisto");

    await page.goto("/panel/ventas?rango=all&estado=reembolsados");
    await expect(page.getByRole("link", { name: /Sesión 1:1/ }).first()).toBeVisible();

    await expectMail(page, "carmen@example.com", "Tu sesión «Sesión 1:1» se ha cancelado");
  });

  test("Proponer otra fecha: la compradora vuelve a elegir y recibe el enlace", async ({ page, browser }) => {
    // Compra de una sesión con fecha (tarjeta 4242).
    await page.goto("/ana/sesion-1-1/checkout");
    await pickDay(page, 4);
    await freeTimes(page).last().click();
    await page.fill("#name", buyerName);
    await page.fill("#email", buyerEmail);
    await page.fill("input[name=cardNumber]", "4242 4242 4242 4242");
    await page.getByLabel(/He leído y acepto/).check();
    // Una sesión se reserva a partir del día 15: no hay casilla de renuncia (tiene sus 14 días).
    await expect(page.getByLabel(/Quiero acceder ya|Solicito expresamente/)).toHaveCount(0);
    await page.getByRole("button", { name: /Reservar y pagar/ }).click();
    await page.waitForURL("**/ana/gracias**");
    // El mismo navegador entra en su cuenta sin contraseña (cookie del checkout).
    await page.getByRole("link", { name: /Ver mi reserva/ }).click();
    await page.waitForURL("**/cuenta/sesiones/**");

    // Ana propone otra fecha (en otra sesión del navegador).
    const ana = await (await browser.newContext()).newPage();
    await demoLogin(ana, "Ana Luna");
    await ana.goto("/panel/reservas");
    await ana.locator(".card", { hasText: buyerName }).first().getByRole("link", { name: /Cambiar o cancelar/ }).click();
    await ana.waitForURL(/\/panel\/reservas\/[^/?]+$/);
    const bookingId = new URL(ana.url()).pathname.split("/").pop()!;
    await expect(ana.getByRole("radio", { name: /Proponer otra fecha/ })).toBeChecked();
    await ana.getByRole("textbox", { name: /Mensaje para Olga/ }).fill("¿Te viene bien otro día?");
    ana.once("dialog", (d) => d.accept());
    await ana.getByRole("button", { name: "Enviar propuesta" }).click();
    await ana.waitForURL("**/panel/reservas?ok=propuesta");
    await expect(ana.getByText("Hemos enviado a la clienta un enlace para elegir otra fecha.")).toBeVisible();
    const pending = ana.locator("section", { has: ana.getByRole("heading", { name: "Pagadas, pendientes de fecha" }) });
    await expect(pending.getByText(buyerName)).toBeVisible();
    await expect(pending.getByText(/Nueva fecha propuesta/).first()).toBeVisible();
    await expectMail(ana, buyerEmail, "Ana Luna te propone cambiar la fecha de tu sesión");
    await ana.context().close();

    // La compradora ve la propuesta y el calendario para elegir.
    await page.goto(`/cuenta/sesiones/${bookingId}`);
    await expect(page.getByText("Ana Luna te propone cambiar la fecha")).toBeVisible();
    await expect(page.getByText("«¿Te viene bien otro día?»")).toBeVisible();
  });

  test("Ventas: reembolso parcial de una venta digital", async ({ page }) => {
    await demoLogin(page, "Ana Luna");
    await page.goto("/panel/ventas?rango=all&estado=pagados");
    await page.getByRole("link", { name: /Gene Keys/ }).first().click();
    await page.waitForURL(/\/panel\/ventas\/[^/?]+$/);
    await page.getByRole("radio", { name: "Una parte" }).check();
    await page.getByLabel("Importe a devolver").fill("5");
    await expect(page.getByRole("checkbox", { name: /Retirar el acceso/ })).not.toBeChecked();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Reembolsar 5,00\s€/ }).click();
    await expect(page.getByText(/Reembolso de 5,00\s€ completado/)).toBeVisible();
    const refunds = page.locator("section", { has: page.getByRole("heading", { name: "Reembolsos" }) });
    await expect(refunds.getByText("Completado")).toBeVisible();
    await expect(page.getByText("Reembolsado parcialmente").first()).toBeVisible();

    await page.goto("/panel/ventas?rango=all&estado=pagados");
    await expect(page.getByRole("link", { name: /Gene Keys/ }).first()).toContainText("Reembolsado parcialmente");
  });

  test("Desistir: Laura desiste de su lectura dentro de los 14 días", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    await page.goto("/cuenta/compras");
    const reading = page.locator(".card > div", { hasText: "Lectura de Human Design" });
    const course = page.locator(".card > div", { hasText: "Conócete a través de tu energía" });
    const guide = page.locator(".card > div", { hasText: "Gene Keys" });
    // Su lectura en directo es el día 15 desde la compra (la demo): aún está en sus 14 días.
    await expect(reading.getByRole("button", { name: "Desistir" })).toBeVisible();
    // El curso y la guía: renunció al desistimiento para tener acceso inmediato.
    await expect(course.getByRole("button", { name: "Desistir" })).toHaveCount(0);
    await expect(guide.getByRole("button", { name: "Desistir" })).toHaveCount(0);

    page.once("dialog", (d) => d.accept());
    await reading.getByRole("button", { name: "Desistir" }).click();
    await page.waitForURL("**/cuenta/compras?ok=desistido");
    await expect(page.getByText(/Hemos tramitado tu desistimiento/)).toBeVisible();
    await expect(reading).toContainText("Reembolsado");
    await expect(reading.getByRole("button", { name: "Desistir" })).toHaveCount(0);

    await page.goto("/cuenta/sesiones");
    await expect(page.getByText(await lauraSessionLabel())).toHaveCount(0);

    await expectMail(page, "laura@example.com", /Hemos recibido tu desistimiento/);
    await page.goto(`/dev/correo?to=ana@cirella.app`);
    await expect(page.getByText("Laura Martín ha desistido de «Lectura de Human Design»").first()).toBeVisible();
  });
});
