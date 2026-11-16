/**
 * Próximas lunas nuevas y llenas y eclipses (lib/astro-calendar.ts; un eclipse ocupa el sitio de su luna), para proponer la fecha de un círculo de la
 * luna o de un directo: «Luna llena en Tauro · jue 5 nov». El círculo se propone a las 20:00 del día
 * de la luna en la zona de la dueña. Sin BD (lo usan el panel, la demo y las pruebas).
 */
import { eclipsesBetween, moonPhasesBetween, SIGNS } from "./astro-calendar";
import { dateKeyInTz, formatInTz } from "./tz";

export type MoonDate = { phase: "new" | "full" | "eclipse"; at: Date; sign: string; title: string; label: string; date: string; time: string };

/** Hora a la que se propone un círculo (en la zona de la dueña). */
export const MOON_CIRCLE_TIME = "20:00";

export function nextMoonDates(from: Date, timeZone: string, count = 4, horizonDays = 90): MoonDate[] {
  const to = new Date(from.getTime() + horizonDays * 86_400_000);
  const events = moonPhasesBetween(from, to);
  const eclipses = eclipsesBetween(from, to).filter((x): x is Extract<typeof x, { kind: "eclipse" }> => x.kind === "eclipse");
  return events.slice(0, count).flatMap((m) => {
    if (m.kind !== "moon") return [];
    // Si hay un eclipse a menos de un día de esta luna, la fecha es la del eclipse.
    const ec = eclipses.find((x) => Math.abs(x.at.getTime() - m.at.getTime()) < 86_400_000);
    const e = ec ?? m;
    const phase = ec ? ("eclipse" as const) : m.phase;
    const sign = SIGNS[Math.floor((((e.lon % 360) + 360) % 360) / 30)];
    const title = `${phase === "eclipse" ? "Eclipse" : phase === "new" ? "Luna nueva" : "Luna llena"} en ${sign}`;
    const day = formatInTz(e.at, timeZone, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");
    return [{ phase, at: e.at, sign, title, label: `${title} · ${day}`, date: dateKeyInTz(e.at, timeZone), time: MOON_CIRCLE_TIME }];
  });
}
