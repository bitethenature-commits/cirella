/**
 * Próximas lunas nuevas y llenas (lib/astro-calendar.ts), para proponer la fecha de un círculo de la
 * luna o de un directo: «Luna llena en Tauro · jue 5 nov». El círculo se propone a las 20:00 del día
 * de la luna en la zona de la dueña. Sin BD (lo usan el panel, la demo y las pruebas).
 */
import { moonPhasesBetween, SIGNS } from "./astro-calendar";
import { dateKeyInTz, formatInTz } from "./tz";

export type MoonDate = { phase: "new" | "full"; at: Date; sign: string; title: string; label: string; date: string; time: string };

/** Hora a la que se propone un círculo (en la zona de la dueña). */
export const MOON_CIRCLE_TIME = "20:00";

export function nextMoonDates(from: Date, timeZone: string, count = 4, horizonDays = 90): MoonDate[] {
  const events = moonPhasesBetween(from, new Date(from.getTime() + horizonDays * 86_400_000));
  return events.slice(0, count).flatMap((e) => {
    if (e.kind !== "moon") return [];
    const sign = SIGNS[Math.floor((((e.lon % 360) + 360) % 360) / 30)];
    const title = `${e.phase === "new" ? "Luna nueva" : "Luna llena"} en ${sign}`;
    const day = formatInTz(e.at, timeZone, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");
    return [{ phase: e.phase, at: e.at, sign, title, label: `${title} · ${day}`, date: dateKeyInTz(e.at, timeZone), time: MOON_CIRCLE_TIME }];
  });
}
