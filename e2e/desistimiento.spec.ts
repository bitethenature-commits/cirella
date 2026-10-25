import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { dateKeyInTz } from "../lib/tz";
import { earliestPaidSessionStart } from "../lib/withdrawal";
import { freeDays } from "./slots";

/**
 * Desistimiento (lib/withdrawal.ts) en el navegador:
 *   · lo digital y las membresías no se pagan sin la casilla de renuncia;
 *   · el calendario de una sesión pagada no ofrece ningún día antes del día 15, ni al comprar ni al
 *     elegir la fecha después del pago;
 *   · «Mis canales» de Laura: sin «Desistir» en lo digital y con «Desistir» en su sesión en plazo;
 *   · el formulario del producto explica la regla y no deja bajar de 15 días.
 * Depende solo del seed (npm run db:reset). No toca la reserva de Laura (la usa reembolsos.spec.ts).
 */

const prisma = new PrismaClient();
const stamp = Date.now().toString().slice(-6);
const TZ = "Europe/Madrid";

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function demoLogin(page: Page, label: string) {
  await page.goto("/entrar");
  await page.locator("form", { hasText: label }).getByRole("button").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

/** Fechas (AAAA-MM-DD) de todos los días libres del calendario, mes a mes. */
async function allFreeDates(page: Page): Promise<string[]> {
  await expect(freeDays(page).first()).toBeVisible();
  while (await page.getByRole("button", { name: "Mes anterior" }).isEnabled()) await page.getByRole("button", { name: "Mes anterior" }).click();
  const dates: string[] = [];
  for (;;) {
    for (const d of await freeDays(page).all()) dates.push((await d.getAttribute("data-date")) ?? "");
    const next = page.getByRole("button", { name: "Mes siguiente" });
    if (!(await next.isEnabled())) return dates;
    await next.click();
  }
}

test.describe.serial("Desistimiento", () => {
  test("lo digital y las membresías no se pagan sin la casilla de renuncia", async ({ page }) => {
    for (const [path, button, label] of [
      ["/ana/curso-conocete-tu-energia/checkout", /Pagar/, "curso"],
      ["/ana/comunidad-privada/checkout", /Unirme/, "membresia"],
    ] as const) {
      const email = `renuncia-${label}${stamp}@example.com`;
      await page.goto(path);
      await page.fill("#name", "Rita Renuncia");
      await page.fill("#email", email);
      await page.getByLabel(/He leído y acepto/).check();
      const waiver = page.getByLabel(/Quiero acceder ya al contenido: doy mi consentimiento expreso/);
      await expect(waiver).not.toBeChecked();
      await page.getByRole("button", { name: button }).click();
      await expect(page.getByText("Para pagar, marca la casilla de acceso inmediato y renuncia al desistimiento")).toBeVisible();
      expect(await prisma.order.count({ where: { buyerEmail: email, status: "PAID" } })).toBe(0);
    }
  });

  test("calendario de una sesión pagada: ningún día antes del día 15", async ({ page }) => {
    const day15 = dateKeyInTz(earliestPaidSessionStart(new Date(), TZ), TZ);
    await page.goto("/ana/sesion-1-1/checkout");
    await expect(page.getByTestId("dia-15")).toContainText("se reservan desde el día 15 tras la compra");
    const dates = await allFreeDates(page);
    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) expect(d >= day15, `${d} es antes del día 15 (${day15})`).toBe(true);
  });

  test("«Prefiero elegir la fecha después del pago»: al elegirla, también desde el día 15 de su compra", async ({ page }) => {
    const email = `despues${stamp}@example.com`;
    const day15 = dateKeyInTz(earliestPaidSessionStart(new Date(), TZ), TZ);
    await page.goto("/ana/sesion-1-1/checkout");
    await page.getByLabel("Prefiero elegir la fecha después del pago").check();
    await page.fill("#name", "Dora Después");
    await page.fill("#email", email);
    await page.getByLabel(/He leído y acepto/).check();
    await expect(page.getByLabel(/Quiero acceder ya|Solicito expresamente/)).toHaveCount(0);
    await page.getByRole("button", { name: /Reservar y pagar/ }).click();
    await page.waitForURL("**/ana/gracias**");
    await page.getByRole("link", { name: /Elegir fecha y hora/ }).click();
    await page.waitForURL("**/cuenta/sesiones/**");
    const dates = await allFreeDates(page);
    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) expect(d >= day15, `${d} es antes del día 15 (${day15})`).toBe(true);
    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: email } });
    expect(order.waiverKind).toBeNull();
  });

  test("«Mis canales» de Laura: sin «Desistir» en lo digital, con «Desistir» en su sesión en plazo", async ({ page }) => {
    await demoLogin(page, "Laura Martín");
    await page.goto("/cuenta/compras");
    const row = (title: string) => page.locator(".card > div", { hasText: title });
    await expect(row("Lectura de Human Design").getByRole("button", { name: "Desistir" })).toBeVisible();
    await expect(row("Lectura de Human Design")).toContainText(/Puedes desistir hasta el \d+ de \p{L}+ \(incluido\)/u);
    for (const title of ["Gene Keys", "Conócete a través de tu energía"]) {
      await expect(row(title)).toBeVisible();
      await expect(row(title).getByRole("button", { name: "Desistir" })).toHaveCount(0);
    }
  });

  test("producto: la regla del día 15 explicada y sin bajar de 15 días", async ({ page }) => {
    const p = await prisma.product.findFirstOrThrow({ where: { slug: "sesion-1-1", creator: { username: "ana" } } });
    await demoLogin(page, "Ana Luna");
    await page.goto(`/panel/productos/${p.id}`);
    await expect(page.getByText("Las sesiones que se pagan en la web se pueden reservar a partir del día 15 desde la compra: así nunca caen dentro de los 14 días en los que tu clienta puede desistir.")).toBeVisible();
    const notice = page.getByLabel("Antelación mínima (días desde la compra)");
    await expect(notice).toHaveValue("15");
    // Sin la comprobación del navegador, el servidor también lo rechaza.
    await notice.evaluate((el) => el.removeAttribute("min"));
    await notice.fill("10");
    await page.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByText(/La antelación mínima de una sesión que se paga en la web es de 15 días/)).toBeVisible();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).minNoticeHours).toBe(360);
  });
});
