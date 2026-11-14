import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { conjunctionsBetween, moonPhasesBetween } from "../lib/astro-calendar";
import { addDaysToKey, dateKeyInTz } from "../lib/tz";

/**
 * Calendario de Reservas en la web personal de Cirella (puerto 3101, iPhone 13):
 *   · el mes con las marcas (su nota de hoy, la próxima luna llena), «Mes siguiente» y «Hoy»;
 *   · tocar un día abre su hoja: agenda, diario y cielo (sin casas), con las conjunciones de la Luna;
 *   · «Qué mostrar»: esconder los asteroides se recuerda al recargar;
 *   · escribir una nota en un día vacío, que se guarda sola, y seguir ahí al recargar;
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

test("Cirella ve el mes con sus marcas, abre un día, escribe su nota y sigue ahí al recargar", async ({ page }) => {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const noted = new Set((await prisma.calendarNote.findMany({ where: { creatorId: ana.id } })).map((n) => n.date));
  // Un día de este mes (o el primero del que viene) sin nota.
  let empty = addDaysToKey(today, 1);
  while (noted.has(empty)) empty = addDaysToKey(empty, 1);
  const fullMoon = moonPhasesBetween(new Date(), new Date(Date.now() + 40 * 86_400_000)).find((e) => e.kind === "moon" && e.phase === "full")!;
  const fullKey = dateKeyInTz(fullMoon.at, TZ);

  await demoLogin(page, "Cirella");
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
  await expect(fullSheet.getByText(/Luna llena en \S+ \d+°\d\d′/)).toBeVisible();
  await expect(fullSheet.getByText("Retrógrados hoy:")).toBeVisible();
  await expect(fullSheet.getByText("Hoy en el cielo")).toBeVisible();
  await expect(fullSheet.getByText(/Quirón.* en \S+ \d+°/)).toBeVisible();
  await expect(fullSheet.getByText(/Casa \d+/)).toHaveCount(0);
  await expect(fullSheet.getByText(/^Vesta( ℞)?$/)).toBeVisible();
  await fullSheet.getByRole("button", { name: "Cerrar" }).click();
  await expect(fullSheet).toHaveCount(0);

  // «Qué mostrar»: sin asteroides, Vesta desaparece del día; se recuerda al recargar.
  const asteroids = page.getByRole("group", { name: "Qué mostrar" }).getByRole("button", { name: "Asteroides" });
  await expect(asteroids).toHaveAttribute("aria-pressed", "true");
  await asteroids.click();
  await expect(asteroids).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.getByRole("group", { name: "Qué mostrar" }).getByRole("button", { name: "Asteroides" })).toHaveAttribute("aria-pressed", "false");
  await page.locator(`[data-day="${fullKey}"]`).first().click();
  await expect(fullSheet.getByText("Hoy en el cielo")).toBeVisible();
  await expect(fullSheet.getByText(/^Vesta( ℞)?$/)).toHaveCount(0);
  await fullSheet.getByRole("button", { name: "Cerrar" }).click();
  await page.getByRole("group", { name: "Qué mostrar" }).getByRole("button", { name: "Asteroides" }).click();

  // Una conjunción de la Luna (cada mes hay varias): sale en su día con la hora, no como marca.
  const moonConj = conjunctionsBetween(new Date(), new Date(Date.now() + 10 * 86_400_000)).find((e) => e.kind === "conjunction" && e.a === "Moon")!;
  const moonKey = dateKeyInTz(moonConj.at, TZ);
  await page.goto(`/panel/reservas?dia=${moonKey}`);
  await expect(page.locator(`dialog[data-day-sheet="${moonKey}"]`).getByText(/☌ Luna – /).first()).toBeVisible();
  await page.locator(`dialog[data-day-sheet="${moonKey}"]`).getByRole("button", { name: "Cerrar" }).click();

  // El viaje a Bali (sembrado): en «Tu agenda», sus horas en Bali y en España.
  const bali = await prisma.availabilityOverride.findFirstOrThrow({ where: { creatorId: ana.id, kind: "HOURS", note: "Bali" }, orderBy: { date: "asc" } });
  await page.goto(`/panel/reservas?dia=${bali.date}`);
  await expect(page.locator(`dialog[data-day-sheet="${bali.date}"]`).getByText(/Fecha especial: trabajas 9:00–13:00 en Bali \(\d+:00–\d+:00( del día anterior)? en España\) · Bali/)).toBeVisible();
  await page.locator(`dialog[data-day-sheet="${bali.date}"]`).getByRole("button", { name: "Cerrar" }).click();

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
