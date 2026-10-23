import { expect, type Page } from "@playwright/test";

/**
 * Calendario de huecos (components/booking/slot-picker.tsx): los días libres son botones con
 * «martes, 12 de noviembre: 3 horas libres» y las horas, radios dentro de «Horas libres el …».
 */
export const freeDays = (page: Page) => page.getByRole("button", { name: /: \d+ horas? libres?$/ });
export const freeTimes = (page: Page) => page.getByRole("radiogroup", { name: /Horas libres/ }).getByRole("radio");

/** Elige el n-ésimo día libre (desde 0), pasando de mes si hace falta. Devuelve el número del día. */
export async function pickDay(page: Page, n: number): Promise<string> {
  await expect(freeDays(page).first()).toBeVisible();
  // Vuelve al primer mes con huecos.
  while (await page.getByRole("button", { name: "Mes anterior" }).isEnabled()) await page.getByRole("button", { name: "Mes anterior" }).click();
  let rest = n;
  for (;;) {
    const count = await freeDays(page).count();
    if (rest < count) {
      const day = freeDays(page).nth(rest);
      const label = (await day.getAttribute("aria-label")) ?? "";
      await day.click();
      return label.match(/(\d+) de /)![1];
    }
    rest -= count;
    await page.getByRole("button", { name: "Mes siguiente" }).click();
  }
}
