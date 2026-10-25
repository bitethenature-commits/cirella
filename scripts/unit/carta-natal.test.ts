/**
 * Carta natal de la dueña (lib/natal-chart.ts), ciudades (lib/cities.ts) y casas en el calendario.
 *
 * Referencia de las casas: Swiss Ephemeris 2.10 (pyswisseph, swe.houses con 'P', 'W', 'E' y 'O'),
 * margen ± 0,02° (aquí la oblicuidad es la media; Swiss Ephemeris usa la verdadera).
 */
import { astroByDay } from "../../lib/owner-calendar";
import { searchCities } from "../../lib/cities";
import { birthUtc, computeHouses, houseOf, natalHouses, readNatalChart } from "../../lib/natal-chart";
import { eq, ok, test } from "./harness";

const close = (got: number[], want: number[], tol = 0.02, what = "") =>
  got.forEach((g, i) => ok(Math.abs(((g - want[i] + 540) % 360) - 180) <= tol, `${what} [${i}]: ${g.toFixed(3)} (esperado ${want[i]})`));

const VALENCIA = { at: new Date("1990-05-14T08:30:00Z"), lat: 39.4699, lon: -0.3763 };

test("Plácidus, Valencia 14-5-1990 10:30 (CEST): ASC Cáncer 17°16′, MC Piscis 28°51′ y cúspides (Swiss Ephemeris)", () => {
  const h = computeHouses(VALENCIA.at, VALENCIA.lat, VALENCIA.lon, "placidus");
  eq(h.system, "placidus");
  close([h.asc, h.mc], [107.267, 358.856], 0.02, "ASC/MC");
  close(h.cusps, [107.267, 127.195, 150.064, 178.856, 214.934, 253.587, 287.267, 307.195, 330.064, 358.856, 34.934, 73.587], 0.02, "Plácidus");
});

test("Signos enteros y casas iguales (Valencia 1990)", () => {
  close(computeHouses(VALENCIA.at, VALENCIA.lat, VALENCIA.lon, "whole").cusps, [90, 120, 150, 180, 210, 240, 270, 300, 330, 0, 30, 60], 1e-9, "enteros");
  close(computeHouses(VALENCIA.at, VALENCIA.lat, VALENCIA.lon, "equal").cusps, [107.267, 137.267, 167.267, 197.267, 227.267, 257.267, 287.267, 317.267, 347.267, 17.267, 47.267, 77.267], 0.02, "iguales");
});

test("Plácidus en el hemisferio sur: Buenos Aires 3-11-1985 20:15 (UTC−3)", () => {
  const h = computeHouses(new Date("1985-11-03T23:15:00Z"), -34.6037, -58.3816, "placidus");
  close(h.cusps, [52.631, 82.68, 116.418, 151.499, 183.488, 210.216, 232.631, 262.68, 296.418, 331.499, 3.488, 30.216], 0.02, "Buenos Aires");
});

test("Por encima del círculo polar (Tromsø) Plácidus no existe: Porfirio", () => {
  const h = computeHouses(new Date("2000-01-15T12:00:00Z"), 69.6492, 18.9553, "placidus");
  eq([h.system, h.polar], ["porphyry", true]);
  close(h.cusps, [120.52, 123.933, 127.346, 130.759, 187.346, 243.933, 300.52, 303.933, 307.346, 310.759, 7.346, 63.933], 0.02, "Porfirio");
});

test("houseOf: cúspide incluida, la casa que cruza 0° Aries y el final de la 12", () => {
  const cusps = [350, 20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320];
  eq(houseOf(350, cusps), 1);
  eq(houseOf(359.99, cusps), 1);
  eq(houseOf(0, cusps), 1);
  eq(houseOf(19.99, cusps), 1);
  eq(houseOf(20, cusps), 2);
  eq(houseOf(349.99, cusps), 12);
  eq(houseOf(-5, cusps), 1);
  const plain = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  eq(houseOf(359.5, plain), 12);
  eq(houseOf(0, plain), 1);
});

test("birthUtc: la hora de entonces (España: sin horario de verano en 1965, con él en 1946 y 1975)", () => {
  eq(birthUtc({ date: "1965-07-01", time: "12:00", timezone: "Europe/Madrid" }).toISOString(), "1965-07-01T11:00:00.000Z");
  eq(birthUtc({ date: "1975-07-01", time: "12:00", timezone: "Europe/Madrid" }).toISOString(), "1975-07-01T10:00:00.000Z");
  eq(birthUtc({ date: "1946-06-01", time: "12:00", timezone: "Europe/Madrid" }).toISOString(), "1946-06-01T10:00:00.000Z");
  // México quitó el horario de verano en 2022.
  eq(birthUtc({ date: "2023-07-01", time: "12:00", timezone: "America/Mexico_City" }).toISOString(), "2023-07-01T18:00:00.000Z");
});

test("readNatalChart: válida, con Plácidus por defecto; inválida → null", () => {
  const c = readNatalChart({ date: "1990-05-14", time: "10:30", place: "Valencia, España", lat: 39.47, lon: -0.38, timezone: "Europe/Madrid" });
  eq(c?.houseSystem, "placidus");
  eq(readNatalChart({ date: "1990-05-14", time: "25:00", place: "x", lat: 0, lon: 0, timezone: "UTC" }), null);
  eq(readNatalChart(null), null);
  close([natalHouses(c!).asc], [107.2], 0.2, "ASC de la carta guardada");
});

test("searchCities: sin tildes, nombres en español y la de España antes", () => {
  eq(searchCities("valencia")[0].label, "Valencia, España");
  eq(searchCities("malaga")[0].label, "Málaga, Andalusia, España");
  eq(searchCities("Londres")[0].timezone, "Europe/London");
  eq(searchCities("nueva york")[0].timezone, "America/New_York");
  ok(searchCities("bogo").some((c) => c.timezone === "America/Bogota"));
  eq(searchCities("v"), []);
  const labels = searchCities("buenaventura").map((c) => c.label);
  eq(new Set(labels).size, labels.length);
});

test("astroByDay con carta: casa de cada evento y de cada cuerpo; sin carta, sin casas", () => {
  const cusps = computeHouses(VALENCIA.at, VALENCIA.lat, VALENCIA.lon).cusps;
  const day = astroByDay(["2026-11-09"], "Europe/Madrid", cusps).get("2026-11-09")!;
  const moon = day.lines.find((l) => l.kind === "moon")!;
  eq(moon.house, houseOf(226.88, cusps)); // Luna nueva en Escorpio 16°53′ → casa 5 de Ana
  eq(moon.house, 5);
  ok(day.positions.every((p) => p.house! >= 1 && p.house! <= 12));
  eq(day.positions.map((p) => p.name).slice(-3), ["Nodo Norte", "Nodo Sur", "Lilith"]);
  ok(day.retrograde.includes("Mercurio") && !day.retrograde.includes("Nodo Norte"));
  const bare = astroByDay(["2026-11-09"], "Europe/Madrid").get("2026-11-09")!;
  eq(bare.lines[0].house, undefined);
  eq(bare.positions[0].house, undefined);
});
