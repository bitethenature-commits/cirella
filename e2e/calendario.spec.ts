import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { moonPhasesBetween } from "../lib/astro-calendar";
import { addDaysToKey, dateKeyInTz } from "../lib/tz";

/**
 * Calendario de Reservas en la web personal de Ana (puerto 3101, iPhone 13):
 *   · el mes con las marcas (su nota de hoy, la próxima luna llena), «Mes siguiente» y «Hoy»;
 *   · tocar un día abre su hoja: agenda, diario y cielo con las casas de su carta (sembrada);
 *   · escribir una nota en un día vacío, que se guarda sola, y seguir ahí al recargar;
 *   · «Mi carta natal» en Tu horario: el resumen y el buscador de ciudades.
 * Borra la nota que escribe.
 */

test.use({ baseURL: process.env.E2E_PERSONAL_URL ?? "http://localhost:3101" });

const prisma = new PrismaClient();
const TZ = "Europe/Madrid";
const today = dateKeyInTz(new Date(), TZ);
let written: string | null = null;

test.afterAll(async () => {
  if (written) {
    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    await prisma.calendarNote.deleteMany({ where: { creatorId: ana.id, date: written } });
  }
  await prisma.$disconnect();
});

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

test("Ana ve el mes con sus marcas, abre un día, escribe su nota y sigue ahí al recargar", async ({ page }) => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const noted = new Set((await prisma.calendarNote.findMany({ where: { creatorId: ana.id } })).map((n) => n.date));
  // Un día de este mes (o el primero del que viene) sin nota.
  let empty = addDaysToKey(today, 1);
  while (noted.has(empty)) empty = addDaysToKey(empty, 1);
  const fullMoon = moonPhasesBetween(new Date(), new Date(Date.now() + 40 * 86_400_000)).find((e) => e.kind === "moon" && e.phase === "full")!;
  const fullKey = dateKeyInTz(fullMoon.at, TZ);

  await demoLogin(page, "Ana Luna");
  await page.goto(`/panel/reservas?mes=${today.slice(0, 7)}`);
  const title = new Date(`${today}T12:00:00Z`).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
  await expect(page.getByRole("heading", { name: new RegExp(title, "i") })).toBeVisible();
  await expect(page.locator(`[data-day="${today}"]`)).toHaveAttribute("aria-label", /nota/);
  await expect(page.getByRole("list", { name: "Leyenda" })).toContainText("Conjunción");

  // La próxima luna llena (puede caer el mes que viene): marcada, y su hoja con signo, casa y hora.
  if (fullKey.slice(0, 7) !== today.slice(0, 7)) await page.getByRole("link", { name: "Mes siguiente" }).click();
  const fullCell = page.locator(`[data-day="${fullKey}"]`).first();
  await expect(fullCell).toHaveAttribute("aria-label", /luna llena/);
  await fullCell.click();
  const fullSheet = page.locator(`dialog[data-day-sheet="${fullKey}"]`);
  await expect(fullSheet.getByText(/Luna llena en \S+ \d+°\d\d′ · Casa \d+/)).toBeVisible();
  await expect(fullSheet.getByText("Planetas retrógrados hoy:")).toBeVisible();
  await expect(fullSheet.getByText("Hoy en tu carta")).toBeVisible();
  await expect(fullSheet.getByText(/Quirón.* · Casa \d+/)).toBeVisible();
  await fullSheet.getByRole("button", { name: "Cerrar" }).click();
  await expect(fullSheet).toHaveCount(0);

  // «Mes siguiente» y «Hoy».
  await page.goto(`/panel/reservas?mes=${today.slice(0, 7)}`);
  await page.getByRole("link", { name: "Mes siguiente" }).click();
  await expect(page).toHaveURL(/mes=\d{4}-\d{2}/);
  await page.getByRole("link", { name: "Hoy" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(title, "i") })).toBeVisible();

  // Un día sin nada: «Escribir una nota», se guarda sola y sigue ahí al recargar.
  await page.goto(`/panel/reservas?dia=${empty}`);
  const sheet = page.locator(`dialog[data-day-sheet="${empty}"]`);
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Escribir una nota" }).click();
  const text = `Tirada de tarot: la Estrella ${Date.now()}`;
  await sheet.getByRole("textbox", { name: "Nota del día" }).fill(text);
  written = empty;
  await expect(sheet.getByRole("status").filter({ hasText: "Guardado" })).toBeVisible();
  await page.reload();
  await expect(page.locator(`dialog[data-day-sheet="${empty}"]`).getByRole("textbox", { name: "Nota del día" })).toHaveValue(text);
  await page.locator(`dialog[data-day-sheet="${empty}"]`).getByRole("button", { name: "Cerrar" }).click();
  if (empty.slice(0, 7) === today.slice(0, 7)) await expect(page.locator(`[data-day="${empty}"]`)).toHaveAttribute("aria-label", /nota/);
  expect((await prisma.calendarNote.findUnique({ where: { creatorId_date: { creatorId: ana.id, date: empty } } }))?.body).toBe(text);
});

test("«Mi carta natal»: el resumen de la carta de Ana y el buscador de ciudades", async ({ page }) => {
  await demoLogin(page, "Ana Luna");
  await page.goto("/panel/reservas/horario#carta-natal");
  const card = page.locator("#carta-natal");
  await expect(card.locator("[data-natal-summary]")).toContainText("Ascendente Cáncer 17°");
  await expect(card.getByText("Valencia, España")).toBeVisible();
  await card.getByLabel("Lugar de nacimiento").fill("bogo");
  await expect(card.getByRole("list", { name: "Ciudades" }).getByRole("button", { name: /Bogotá/ }).first()).toBeVisible();
  await card.getByRole("button", { name: "Introducir coordenadas" }).click();
  await expect(card.getByLabel(/Latitud/)).toBeVisible();
});
