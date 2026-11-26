import { expect, test, type Page } from "@playwright/test";

/**
 * Buzón de demostración protegido: /dev/email enseña los emails de todas las cuentas (con sus
 * enlaces de acceso), así que solo lo abre la administradora, incluso en modo demo.
 */

const SEEDED_SUBJECT = "Compra confirmada: Lectura de Human Design";

async function demoLogin(page: Page, label: string) {
  await page.goto("/login");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test.describe.serial("Buzón protegido", () => {
  test("sin sesión: tarjeta «solo para la administradora» y ningún email", async ({ page }) => {
    await page.goto("/dev/email");
    await expect(page.getByText("solo puede abrirlo la administradora")).toBeVisible();
    await expect(page.getByText(SEEDED_SUBJECT)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ejecutar tareas programadas" })).toHaveCount(0);
  });

  test("como clienta (Laura): sigue sin ver el buzón", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    await page.goto("/dev/email");
    await expect(page.getByText("solo puede abrirlo la administradora")).toBeVisible();
    await expect(page.getByText(SEEDED_SUBJECT)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ejecutar tareas programadas" })).toHaveCount(0);
  });

  test("«Entrar como administradora (demo)» vuelve al buzón con los emails", async ({ page }) => {
    await page.goto("/dev/email");
    await page.getByRole("button", { name: "Entrar como administradora (demo)" }).click();
    await page.waitForURL("**/dev/email");
    await expect(page.getByText(SEEDED_SUBJECT).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Ejecutar tareas programadas" })).toBeVisible();
    await expect(page.getByText("solo puede abrirlo la administradora")).toHaveCount(0);
  });

  test("los accesos rápidos de /login respetan ?next=", async ({ page }) => {
    await page.goto("/login?next=/dev/email");
    await page.locator("form", { hasText: "Superadmin" }).getByRole("button").click();
    await page.waitForURL("**/dev/email");
    await expect(page.getByText(SEEDED_SUBJECT).first()).toBeVisible();
  });

  test("el enlace de «gracias» (?to=) conserva el filtro tras entrar como administradora", async ({ page }) => {
    await page.goto("/dev/email?to=laura@example.com");
    await page.getByRole("button", { name: "Entrar como administradora (demo)" }).click();
    await page.waitForURL((u) => u.pathname === "/dev/email" && u.searchParams.get("to") === "laura@example.com");
    await expect(page.getByText("Filtrando: laura@example.com")).toBeVisible();
    await expect(page.getByText(SEEDED_SUBJECT).first()).toBeVisible();
  });
});
