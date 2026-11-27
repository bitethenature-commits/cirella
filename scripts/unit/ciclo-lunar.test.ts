/**
 * El cielo del modelo lunar (lib/lunar-sky.ts).
 *
 * Referencias:
 *   · Fases (UTC): USNO, «Phases of the Moon» (aa.usno.navy.mil/api/moon/phases/year), que coinciden con
 *     las tablas de la NASA (Espenak) que ya prueba calendario-cielo.test.ts.
 *   · Salida y puesta: USNO, «Rise/Set/Transit» (aa.usno.navy.mil/api/rstt/oneday), Madrid (40,4168 N,
 *     3,7038 O) y Barcelona; USNO da el minuto redondeado, por eso ± 2 min.
 *   · Superlunas llenas publicadas (definición de Nolle): 7-10, 5-11 y 4-12 de 2025; 3-1, 24-11 y 24-12
 *     de 2026 (ninguna otra llena de esos años).
 *   · Eclipses de 2026 (NASA): anular 17-2, lunar total 3-3, solar total 12-8, lunar parcial 28-8.
 *   · Luna natal: Swiss Ephemeris 2.10 para el 14-11-1988 06:45 UTC (Luna 288,7464°, Sol 232,1217°).
 */
import { apsidesBetween, buildLunarIcs, foldIcsLine, lunarMonth, lunarReturnsBetween, lunarYear, lunationsBetween, lunationStart, moonRiseSet, moonState, natalMoon, nextMainLunation, timeAtElongation, dayBounds } from "../../lib/lunar-sky";
import { lonDiff } from "../../lib/astro-calendar";
import { timeInTz } from "../../lib/tz";
import { eq, ok, test } from "./harness";

const near = (got: Date | null | undefined, want: string, minutes: number, what: string) => {
  ok(got, `${what}: no encontrado`);
  const diff = Math.abs(got.getTime() - new Date(want).getTime()) / 60_000;
  ok(diff <= minutes, `${what}: ${got.toISOString()} (esperado ${want} ± ${minutes} min)`);
};

test("Las ocho estaciones de noviembre de 2026 y las cuatro principales como USNO (± 2 min)", () => {
  const all = lunationsBetween(new Date("2026-11-01T00:00Z"), new Date("2026-12-01T00:00Z"));
  const main = all.filter((l) => l.k % 2 === 0);
  eq(main.map((l) => l.k), [6, 0, 2, 4]);
  near(main[0].at, "2026-11-01T20:28Z", 2, "cuarto menguante");
  near(main[1].at, "2026-11-09T07:02Z", 2, "luna nueva");
  near(main[2].at, "2026-11-17T11:48Z", 2, "cuarto creciente");
  near(main[3].at, "2026-11-24T14:53Z", 2, "luna llena");
  // Las intermedias, entre sus vecinas y a 45° justos.
  for (const l of all) ok(Math.abs(lonDiff(moonState(l.at).elong, l.k * 45)) < 0.05, `elongación de la estación ${l.k}`);
  ok(all.length === 8, `8 estaciones en noviembre (salen ${all.length})`);
});

test("Superlunas (Nolle): las llenas publicadas de 2025 y 2026, y ninguna más", () => {
  const full = [...lunarYear(2025, "UTC"), ...lunarYear(2026, "UTC")].filter((l) => l.k === 4);
  const supers = full.filter((l) => l.supermoon).map((l) => l.at.toISOString().slice(0, 10));
  eq(supers, ["2025-10-07", "2025-11-05", "2025-12-04", "2026-01-03", "2026-11-24", "2026-12-24"]);
});

test("Eclipses de 2026 unidos a su lunación", () => {
  const y = lunarYear(2026);
  const ecl = y.filter((l) => l.eclipse).map((l) => `${l.at.toISOString().slice(0, 10)} ${l.k === 0 ? "nueva" : "llena"} ${l.eclipse!.body} ${l.eclipse!.type}`);
  eq(ecl, ["2026-02-17 nueva solar annular", "2026-03-03 llena lunar total", "2026-08-12 nueva solar total", "2026-08-28 llena lunar partial"]);
  eq(y.length, 25, "13 llenas y 12 nuevas en 2026");
});

test("Luna llena del 24-12-2026 (USNO 01:28 UTC, 02:28 en España): Cáncer, superluna cerca del perigeo", () => {
  const l = lunarYear(2026).find((l) => l.k === 4 && l.at.toISOString().startsWith("2026-12-24"))!;
  near(l.at, "2026-12-24T01:28Z", 2, "luna llena");
  ok(/^02:2\d$/.test(timeInTz(l.at, "Europe/Madrid")), "hora de España");
  eq(Math.floor(l.moonLon / 30), 3);
  ok(l.distKm < 357_000 && l.supermoon);
  const peri = apsidesBetween(new Date("2026-12-20T00:00Z"), new Date("2026-12-28T00:00Z")).find((a) => a.kind === "perigee");
  ok(peri && Math.abs(peri.at.getTime() - l.at.getTime()) < 12 * 3_600_000, "perigeo a pocas horas");
});

test("Lunación en curso y búsqueda por elongación", () => {
  const at = new Date("2026-11-20T12:00Z");
  near(lunationStart(at), "2026-11-09T07:02Z", 2, "inicio de la lunación");
  near(timeAtElongation(180, lunationStart(at)), "2026-11-24T14:53Z", 2, "llena de esa lunación");
  near(nextMainLunation(at).at, "2026-11-24T14:53Z", 2, "próxima fase principal");
  const s = moonState(new Date("2026-11-24T14:53Z"));
  ok(s.illum > 0.99 && Math.abs(s.elong - 180) < 0.1, "llena: iluminada y a 180°");
});

test("Salida y puesta de la Luna como USNO (± 2 min, hora local)", () => {
  const madrid = { lat: 40.4168, lon: -3.7038 };
  const day = (key: string, tz: string, lat: number, lon: number) => {
    const b = dayBounds(new Date(`${key}T12:00:00Z`), tz);
    const r = moonRiseSet(b.start, b.end, lat, lon);
    return { rise: r.rise, set: r.set };
  };
  const nov1 = day("2026-11-01", "Europe/Madrid", madrid.lat, madrid.lon);
  eq(nov1.rise, null, "el 1-11-2026 no sale en Madrid");
  near(nov1.set, "2026-11-01T13:18Z", 2, "puesta 14:18");
  const nov24 = day("2026-11-24", "Europe/Madrid", madrid.lat, madrid.lon);
  near(nov24.set, "2026-11-24T07:08Z", 2, "puesta 08:08");
  near(nov24.rise, "2026-11-24T16:26Z", 2, "salida 17:26");
  const jul14 = day("2026-07-14", "Europe/Madrid", madrid.lat, madrid.lon);
  near(jul14.rise, "2026-07-14T04:35Z", 2, "salida 06:35 (verano)");
  near(jul14.set, "2026-07-14T20:13Z", 2, "puesta 22:13 (verano)");
  const bcn = day("2026-03-03", "Europe/Madrid", 41.3888, 2.159);
  near(bcn.set, "2026-03-03T06:20Z", 2, "Barcelona, puesta 07:20");
  near(bcn.rise, "2026-03-03T17:58Z", 2, "Barcelona, salida 18:58");
});

test("lunarMonth: noviembre de 2026 en Madrid", () => {
  const m = lunarMonth(2026, 11);
  eq(m.length, 30);
  eq(m[0].start.toISOString(), "2026-10-31T23:00:00.000Z");
  const full = m.find((d) => d.lunations.some((l) => l.k === 4))!;
  eq(full.key, "2026-11-24");
  near(full.lunations.find((l) => l.k === 4)!.at, "2026-11-24T14:53Z", 2, "llena (15:53 en España)");
  // El cuarto menguante del 1-11 (USNO 20:28 UTC, 21:28 en España).
  eq(m[0].lunations.map((l) => l.k), [6]);
  near(m[0].lunations[0].at, "2026-11-01T20:28Z", 2, "cuarto menguante");
  const ingresses = m.flatMap((d) => d.ingresses);
  ok(ingresses.length >= 12 && ingresses.length <= 14, `${ingresses.length} cambios de signo`);
  // El signo de mediodía es el del día salvo que cambie antes de las 12.
  for (const d of m) ok(d.sign >= 0 && d.sign < 12);
  ok(m.some((d) => d.apsides.some((a) => a.kind === "perigee")) && m.some((d) => d.apsides.some((a) => a.kind === "apogee")));
});

test("Luna natal (Swiss Ephemeris): Sevilla 14-11-1988 07:45 → Luna en Capricornio, creciente", () => {
  const n = natalMoon({ date: "1988-11-14", time: "07:45", timeKnown: true, tz: "Europe/Madrid" });
  eq(n.utc.toISOString(), "1988-11-14T06:45:00.000Z");
  ok(Math.abs(lonDiff(n.moonLon, 288.7464)) < 0.01, `Luna ${n.moonLon}`);
  ok(Math.abs(lonDiff(n.sunLon, 232.1217)) < 0.01, `Sol ${n.sunLon}`);
  eq(n.phase, 1, "56,6° de elongación: creciente (45°–90°)");
  const u = natalMoon({ date: "1988-11-14", time: "", timeKnown: false, tz: "Europe/Madrid" });
  ok(u.range && lonDiff(u.range.to, u.range.from) > 11 && lonDiff(u.range.to, u.range.from) < 16, "sin hora: el recorrido del día");
});

test("Retornos lunares: uno cada mes sidéreo, en la longitud natal", () => {
  const r = lunarReturnsBetween(288.7464, new Date("2026-01-01T00:00Z"), new Date("2027-01-01T00:00Z"));
  ok(r.length === 13 || r.length === 14, `${r.length} retornos`);
  for (const at of r) ok(Math.abs(lonDiff(moonState(at).moonLon, 288.7464)) < 0.02);
  for (let i = 1; i < r.length; i++) {
    const days = (r[i].getTime() - r[i - 1].getTime()) / 86_400_000;
    ok(days > 27 && days < 27.7, `${days} días entre retornos`);
  }
});

test(".ics: con hora en Europe/Madrid (horario de verano incluido) y de día completo", () => {
  const ev = [
    { uid: "a@x", at: new Date("2026-12-24T01:28:00Z"), summary: "Luna llena en Cáncer, superluna", description: "Eje Cáncer–Capricornio; suelta, agradece" },
    { uid: "b@x", at: new Date("2026-07-14T09:44:00Z"), summary: "Luna nueva en Cáncer" },
  ];
  const now = new Date("2026-11-01T10:00:00Z");
  const timed = buildLunarIcs(ev, { mode: "timed", name: "Año lunar 2026", now });
  ok(timed.startsWith("BEGIN:VCALENDAR\r\n") && timed.endsWith("END:VCALENDAR\r\n"));
  ok(timed.includes("BEGIN:VTIMEZONE\r\nTZID:Europe/Madrid"));
  ok(timed.includes("DTSTART;TZID=Europe/Madrid:20261224T022800\r\n"));
  ok(timed.includes("DTEND;TZID=Europe/Madrid:20261224T032800\r\n"));
  ok(timed.includes("DTSTART;TZID=Europe/Madrid:20260714T114400\r\n"), "verano: UTC+2");
  ok(timed.includes("SUMMARY:Luna llena en Cáncer\\, superluna"));
  ok(timed.includes("DESCRIPTION:Eje Cáncer–Capricornio\\; suelta\\, agradece"));
  ok(timed.includes("DTSTAMP:20261101T100000Z"));
  const allday = buildLunarIcs(ev, { mode: "allday", name: "Año lunar 2026", now });
  ok(allday.includes("DTSTART;VALUE=DATE:20261224\r\nDTEND;VALUE=DATE:20261225"));
  ok(!allday.includes("VTIMEZONE"));
  for (const line of timed.split("\r\n")) ok(new TextEncoder().encode(line).length <= 75, `línea de más de 75 octetos: ${line}`);
});

test("foldIcsLine: corta a 75 octetos sin partir letras con tilde", () => {
  const line = `DESCRIPTION:${"ñá".repeat(60)}`;
  const folded = foldIcsLine(line);
  const parts = folded.split("\r\n");
  ok(parts.length > 1);
  for (const p of parts) ok(new TextEncoder().encode(p).length <= 75);
  eq(parts.map((p, i) => (i ? p.slice(1) : p)).join(""), line);
});
