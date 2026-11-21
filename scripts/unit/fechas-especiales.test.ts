/**
 * Fechas especiales para la dueña: las horas en la zona en que las puso y, entre paréntesis, en su
 * zona de siempre (lib/special-hours.ts), con el día cuando cambia.
 */
import { placeName, specialHoursLabel as label } from "../../lib/special-hours";
import { eq, test } from "./harness";

const r = (a: string, b: string) => {
  const m = (s: string) => Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]);
  return { startMinute: m(a), endMinute: m(b) };
};

test("placeName: «España» para Madrid, «Bali» para Makassar y la ciudad para el resto", () => {
  eq(placeName("Europe/Madrid"), "España");
  eq(placeName("Asia/Makassar"), "Bali");
  eq(placeName("America/Bogota"), "Colombia");
  eq(placeName("America/New_York"), "Nueva York");
  eq(placeName("Pacific/Fiji"), "Fiji");
});

test("Bali en noviembre (UTC+8, Madrid UTC+1): 9:00–13:00 → 2:00–6:00 en España", () => {
  eq(label("2026-11-15", [r("09:00", "13:00")], "Asia/Makassar", "Europe/Madrid"), "9:00–13:00 en Bali (2:00–6:00 en España)");
});

test("Bali en julio (Madrid en verano, UTC+2): 3:00–7:00", () => {
  eq(label("2026-07-15", [r("09:00", "13:00")], "Asia/Makassar", "Europe/Madrid"), "9:00–13:00 en Bali (3:00–7:00 en España)");
});

test("Varias franjas", () => {
  eq(label("2026-11-15", [r("09:00", "13:00"), r("16:00", "19:00")], "Asia/Makassar", "Europe/Madrid"), "9:00–13:00 y 16:00–19:00 en Bali (2:00–6:00 y 9:00–12:00 en España)");
});

test("Cruza la medianoche en su zona: del día anterior y del día siguiente", () => {
  eq(label("2026-11-15", [r("06:00", "10:00")], "Asia/Makassar", "Europe/Madrid"), "6:00–10:00 en Bali (23:00 del día anterior–3:00 en España)");
  eq(label("2026-11-15", [r("01:00", "03:00")], "Asia/Makassar", "Europe/Madrid"), "1:00–3:00 en Bali (18:00–20:00 del día anterior en España)");
  eq(label("2026-11-15", [r("16:00", "20:00")], "America/Bogota", "Europe/Madrid"), "16:00–20:00 en Colombia (22:00–2:00 del día siguiente en España)");
  eq(label("2026-11-15", [r("20:00", "24:00")], "America/Bogota", "Europe/Madrid"), "20:00–24:00 en Colombia (2:00–6:00 del día siguiente en España)");
  eq(label("2026-07-15", [r("09:00", "13:00")], "Asia/Makassar", "America/Bogota"), "9:00–13:00 en Bali (20:00–24:00 del día anterior en Colombia)");
});

test("Misma zona, o misma hora ese día (París y Madrid): sin paréntesis", () => {
  eq(label("2026-11-15", [r("09:00", "13:00")], "Europe/Madrid", "Europe/Madrid"), "9:00–13:00");
  eq(label("2026-11-15", [r("09:00", "13:00")], "Europe/Paris", "Europe/Madrid"), "9:00–13:00 en Francia");
});

test("Canarias va una hora por detrás de la península", () => {
  eq(label("2026-11-15", [r("09:00", "13:00")], "Atlantic/Canary", "Europe/Madrid"), "9:00–13:00 en Canarias (10:00–14:00 en España)");
});
