/**
 * Calendario de la dueña: el cielo del mes (lib/astro-calendar.ts) y la rejilla en su zona
 * (lib/owner-calendar.ts).
 *
 * Las fechas de referencia:
 *   · Lunas y eclipses de 2026: tablas de fases de la NASA (Espenak, «Phases of the Moon») y los
 *     catálogos de eclipses de la NASA (máximo del eclipse), en UTC.
 *   · Conjunciones: el cruce de longitud eclíptica geocéntrica (de la fecha) de JPL Horizons
 *     (QUANTITIES=31, paso de 1 minuto), y la Gran Conjunción del 21-12-2020 (0°29′ de Acuario).
 *   · Estaciones de Mercurio de 2026: máximo/mínimo de longitud en Horizons (paso de 10 min) y las
 *     posiciones publicadas (Piscis 22°33′ / 8°29′, Escorpio 20°58′ / 5°02′).
 *   · Quirón, Ceres, Palas, Juno, Vesta y Eris: Horizons (COMMAND='2060;', '1;'… '136199;') en
 *     instantes que no son de la tabla (interpolación ± 0,005°), y conjunciones y una estación de 2026
 *     buscadas en Horizons con paso de 1 min (10 min para las lentas).
 *   · Nodo medio y Lilith media: Swiss Ephemeris 2.10 (pyswisseph, SE_MEAN_NODE y SE_MEAN_APOG).
 *     El nodo de Swiss Ephemeris lleva la nutación (± 0,01°); su apogeo medio tiene términos de más
 *     que la fórmula de Meeus, por eso Lilith va con ± 0,2°.
 * astronomy-engine da los minutos con un error de pocos segundos de arco; en un par lento
 * (Saturno–Neptuno se acercan ~0,04° al día) eso son horas, por eso cada caso tiene su margen.
 */
import {
  astroGroups,
  astroLabel,
  astroMarks,
  astroMonth,
  chironLongitude,
  conjunctionsBetween,
  describeAstro,
  eclipsesBetween,
  formatZodiac,
  isRetro,
  longitude,
  meanLilith,
  meanNode,
  moonIngressesBetween,
  moonPhasesBetween,
  positionsAt,
  stationsBetween,
  zodiac,
  type AstroEvent,
} from "../../lib/astro-calendar";
import { astroByDay, dayRangeUtc, monthGrid, monthTitle, parseMonthParam, shiftMonth } from "../../lib/owner-calendar";
import { ALL_VISIBLE, dayMarks, parseVisible, serializeVisible } from "../../lib/calendar-marks";
import { eq, ok, test } from "./harness";

const MIN = 60_000;
const near = (got: Date | undefined, want: string, minutes: number, what: string) => {
  ok(got, `${what}: no encontrado`);
  const diff = Math.abs(got.getTime() - new Date(want).getTime()) / MIN;
  ok(diff <= minutes, `${what}: ${got.toISOString()} (esperado ${want} ± ${minutes} min)`);
};
const Y2026 = { from: new Date("2026-01-01T00:00:00Z"), to: new Date("2027-01-01T00:00:00Z") };

test("Lunas nuevas de 2026 (NASA, UTC, ± 3 min)", () => {
  const got = moonPhasesBetween(Y2026.from, Y2026.to).filter((e) => e.kind === "moon" && e.phase === "new");
  const want = ["01-18T19:52", "02-17T12:01", "03-19T01:23", "04-17T11:52", "05-16T20:01", "06-15T02:54", "07-14T09:43", "08-12T17:37", "09-11T03:27", "10-10T15:50", "11-09T07:02", "12-09T00:52"];
  eq(got.length, want.length);
  want.forEach((w, i) => near(got[i].at, `2026-${w}:00Z`, 3, `Luna nueva ${w}`));
});

test("Lunas llenas de 2026 (NASA, UTC, ± 3 min)", () => {
  const got = moonPhasesBetween(Y2026.from, Y2026.to).filter((e) => e.kind === "moon" && e.phase === "full");
  const want = ["01-03T10:03", "02-01T22:09", "03-03T11:38", "04-02T02:12", "05-01T17:23", "05-31T08:45", "06-29T23:57", "07-29T14:36", "08-28T04:18", "09-26T16:49", "10-26T04:12", "11-24T14:53", "12-24T01:28"];
  eq(got.length, want.length);
  want.forEach((w, i) => near(got[i].at, `2026-${w}:00Z`, 3, `Luna llena ${w}`));
});

test("Luna nueva del 9-11-2026: Escorpio 16°53′ (Horizons: 226,90°)", () => {
  const e = moonPhasesBetween(new Date("2026-11-01T00:00Z"), new Date("2026-11-15T00:00Z"))[0];
  eq(describeAstro(e), "Luna nueva en Escorpio 16°53′");
});

test("Eclipses de 2026 (NASA): anular 17-2, lunar total 3-3, solar total 12-8, lunar parcial 28-8", () => {
  const got = eclipsesBetween(Y2026.from, Y2026.to).sort((a, b) => a.at.getTime() - b.at.getTime());
  eq(
    got.map((e) => (e.kind === "eclipse" ? `${e.body}:${e.type}` : "")),
    ["solar:annular", "lunar:total", "solar:total", "lunar:partial"],
  );
  near(got[0].at, "2026-02-17T12:12:00Z", 3, "anular");
  near(got[1].at, "2026-03-03T11:33:00Z", 3, "lunar total");
  near(got[2].at, "2026-08-12T17:46:00Z", 3, "solar total");
  near(got[3].at, "2026-08-28T04:13:00Z", 3, "lunar parcial");
  eq(describeAstro(got[2]), "Eclipse solar total en Leo 20°02′");
});

const conj = (events: AstroEvent[], a: string, b: string) => events.filter((e) => e.kind === "conjunction" && e.a === a && e.b === b);

test("Gran Conjunción Júpiter–Saturno: 21-12-2020 18:21 UTC en Acuario 0°29′ (Horizons, ± 15 min)", () => {
  const ev = conj(conjunctionsBetween(new Date("2020-12-01T00:00Z"), new Date("2021-01-01T00:00Z")), "Jupiter", "Saturn");
  eq(ev.length, 1);
  near(ev[0].at, "2020-12-21T18:21:00Z", 15, "Júpiter–Saturno");
  eq(describeAstro(ev[0]), "☌ Júpiter – Saturno en Acuario 0°29′");
});

test("Conjunciones de 2026 frente a Horizons", () => {
  const ev = conjunctionsBetween(Y2026.from, Y2026.to);
  const one = (a: string, b: string, when: string, mins: number, where: string) => {
    const hit = conj(ev, a, b).find((e) => Math.abs(e.at.getTime() - new Date(when).getTime()) < 2 * 86_400_000);
    near(hit?.at, when, mins, `${a}–${b}`);
    ok(hit && describeAstro(hit).includes(where), `${a}–${b}: ${hit && describeAstro(hit)} (esperado ${where})`);
  };
  one("Saturn", "Neptune", "2026-02-20T16:55:00Z", 180, "Aries 0°45′");
  one("Venus", "Mars", "2026-01-08T02:44:00Z", 10, "Capricornio 18°");
  one("Sun", "Venus", "2026-10-24T03:45:00Z", 15, "Escorpio 0°");
  one("Mars", "Jupiter", "2026-11-16T06:24:00Z", 10, "Leo 25°53′");
});

test("Retrógrados: Júpiter–Plutón, triple conjunción de 2020 (5-4, 30-6 y 12-11)", () => {
  const ev = conj(conjunctionsBetween(new Date("2020-01-01T00:00Z"), new Date("2021-01-01T00:00Z")), "Jupiter", "Pluto");
  eq(ev.map((e) => e.at.toISOString().slice(0, 10)), ["2020-04-05", "2020-06-30", "2020-11-12"]);
});

test("Sol–Mercurio: 2 conjunciones por cada vuelta de Mercurio (6 en 2026), sin duplicados", () => {
  eq(conj(conjunctionsBetween(Y2026.from, Y2026.to), "Sun", "Mercury").length, 6);
});

test("Conjunciones de la Luna: con cada cuerpo (sin Sol–Luna, que es la luna nueva) y sin marca en el mes", () => {
  const nov = astroMonth(2026, 11);
  const moon = nov.filter((e) => e.kind === "conjunction" && (e.a === "Moon" || e.b === "Moon"));
  ok(moon.length >= 15, `${moon.length} conjunciones de la Luna`);
  ok(moon.every((e) => e.kind === "conjunction" && e.a === "Moon" && e.b !== "Sun" && !astroMarks(e) && astroGroups(e).includes("moon")));
  const jup = moon.find((e) => e.kind === "conjunction" && e.b === "Jupiter" && e.at.toISOString().startsWith("2026-11-02"));
  near(jup?.at, "2026-11-02T22:51:00Z", 5, "Luna–Júpiter (Horizons)");
});

test("Cambios de signo de la Luna: 11–14 al mes, en el borde del signo", () => {
  const ing = moonIngressesBetween(new Date("2026-11-01T00:00Z"), new Date("2026-12-01T00:00Z"));
  ok(ing.length >= 11 && ing.length <= 14, `${ing.length} cambios`);
  eq(new Set(ing.map((e) => e.at.getTime())).size, ing.length);
});

test("Asteroides y Eris: tablas de Horizons interpoladas (± 0,005°) y NaN fuera de 2000–2050", () => {
  const at = new Date("2026-10-25T12:00:00Z");
  ok(Math.abs(longitude("Pallas", at) - 8.4116924) < 0.005, `Palas ${longitude("Pallas", at)}`);
  ok(Math.abs(longitude("Eris", at) - 25.338079) < 0.005, `Eris ${longitude("Eris", at)}`);
  ok(Number.isNaN(longitude("Vesta", new Date("1999-06-01T00:00Z"))));
});

test("Conjunciones con asteroides frente a Horizons (2026)", () => {
  const ev = conjunctionsBetween(Y2026.from, Y2026.to);
  const one = (a: string, b: string, when: string, mins: number, where: string) => {
    const hit = conj(ev, a, b).find((e) => Math.abs(e.at.getTime() - new Date(when).getTime()) < 2 * 86_400_000);
    near(hit?.at, when, mins, `${a}–${b}`);
    ok(hit && describeAstro(hit).includes(where), `${a}–${b}: ${hit && describeAstro(hit)} (esperado ${where})`);
  };
  one("Sun", "Vesta", "2026-01-28T19:44:00Z", 5, "Acuario 8°53′");
  one("Venus", "Ceres", "2026-04-06T19:22:00Z", 5, "Tauro 8°4");
  one("Saturn", "Pallas", "2026-06-10T06:43:00Z", 30, "Aries 12°5");
  one("Ceres", "Eris", "2026-03-01T06:10:00Z", 30, "Aries 24°49′");
});

test("Estaciones de los asteroides: solo en el día (sin marca); con nombre en femenino", () => {
  const st = stationsBetween(new Date("2026-08-01T00:00Z"), new Date("2026-09-01T00:00Z")).find((e) => e.kind === "station" && e.body === "Vesta");
  near(st?.at, "2026-08-25T18:00:00Z", 45, "Vesta se pone retrógrada (Horizons, paso de 10 min)");
  eq(describeAstro(st!).startsWith("Vesta se pone retrógrada en Aries 27°"), true);
  eq(astroMarks(st!), false);
  eq(astroGroups(st!), ["asteroids"]);
});

test("astroMonth: se calcula una vez por mes (caché)", () => {
  ok(astroMonth(2026, 10) === astroMonth(2026, 10));
});

test("zodiac / formatZodiac: signos en español, grados y minutos truncados", () => {
  eq(formatZodiac(0), "Aries 0°00′");
  eq(formatZodiac(222.2), "Escorpio 12°12′");
  eq(formatZodiac(359.9999), "Piscis 29°59′");
  eq(formatZodiac(-1), "Piscis 29°00′");
  eq(zodiac(95.5), { sign: 3, deg: 5, min: 30 });
});

test("monthGrid: semanas de lunes a domingo (octubre de 2026 empieza en jueves)", () => {
  const g = monthGrid({ year: 2026, month: 10 });
  eq(g[0], "2026-09-28");
  eq(g[g.length - 1], "2026-11-01");
  eq(g.length, 35);
  const feb = monthGrid({ year: 2027, month: 2 }); // 1-2-2027 es lunes, 28 días
  eq([feb[0], feb[feb.length - 1], feb.length], ["2027-02-01", "2027-02-28", 28]);
});

test("parseMonthParam / shiftMonth / monthTitle", () => {
  eq(parseMonthParam("2026-11", "2026-10-25"), { year: 2026, month: 11 });
  eq(parseMonthParam("2026-13", "2026-10-25"), { year: 2026, month: 10 });
  eq(parseMonthParam("<script>", "2026-10-25"), { year: 2026, month: 10 });
  eq(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  eq(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  eq(monthTitle({ year: 2026, month: 10 }), "Octubre de 2026");
});

test("dayRangeUtc: los días en la zona de la dueña (cambio de hora del 25-10-2026 en Madrid)", () => {
  const r = dayRangeUtc("2026-10-25", "2026-10-25", "Europe/Madrid");
  eq(r.from.toISOString(), "2026-10-24T22:00:00.000Z");
  eq(r.to.toISOString(), "2026-10-25T23:00:00.000Z");
});

test("astroByDay: la luna llena del 26-10-2026 (04:12 UTC) cae el 26 en Madrid y el 25 en Bogotá", () => {
  const keys = ["2026-10-25", "2026-10-26"];
  const madrid = astroByDay(keys, "Europe/Madrid");
  const full = (d: { lines: Parameters<typeof dayMarks>[0] }) => dayMarks(d.lines, ALL_VISIBLE).fullMoon;
  ok(full(madrid.get("2026-10-26")!) && !full(madrid.get("2026-10-25")!));
  eq(madrid.get("2026-10-26")!.lines.find((l) => l.kind === "moon"), { kind: "moon", label: "Luna llena", text: "Luna llena en Tauro 2°46′", time: "05:12", detail: "full", groups: ["moon"], mark: true });
  const bogota = astroByDay(keys, "America/Bogota");
  ok(full(bogota.get("2026-10-25")!));
  eq(bogota.get("2026-10-25")!.lines.find((l) => l.kind === "moon")!.time, "23:12");
});

test("astroByDay: conjunción Sol–Venus del 24-10-2026 con su hora en Madrid; signo de la Luna cada día", () => {
  const d = astroByDay(["2026-10-24"], "Europe/Madrid").get("2026-10-24")!;
  const sv = d.lines.find((l) => l.text.startsWith("☌ Sol – Venus"));
  ok(sv?.text.startsWith("☌ Sol – Venus ℞ en Escorpio 0°"), sv?.text); // conjunción inferior: Venus va retrógrada
  ok(/^05:\d\d$/.test(sv!.time), sv!.time);
  ok(d.moon.sign.length > 0);
});

test("Estaciones de Mercurio en 2026: retrógrado 26-2, 29-6 y 24-10; directo 20-3, 23-7 y 13-11", () => {
  const st = stationsBetween(Y2026.from, Y2026.to).filter((e) => e.kind === "station" && e.body === "Mercury");
  eq(
    st.map((e) => (e.kind === "station" ? `${e.at.toISOString().slice(0, 10)} ${e.direction}` : "")),
    ["2026-02-26 retrograde", "2026-03-20 direct", "2026-06-29 retrograde", "2026-07-23 direct", "2026-10-24 retrograde", "2026-11-13 direct"],
  );
  near(st[4].at, "2026-10-24T07:10:00Z", 30, "Mercurio se pone retrógrado (Horizons)");
  eq(describeAstro(st[4]), "Mercurio se pone retrógrado en Escorpio 20°58′");
  eq(astroLabel(st[4]), "Estación retrógrada");
  eq(describeAstro(st[0]), "Mercurio se pone retrógrado en Piscis 22°33′");
  eq(describeAstro(st[1]), "Mercurio se pone directo en Piscis 8°29′");
  ok(isRetro("Mercury", new Date("2026-11-01T12:00Z")) && !isRetro("Mercury", new Date("2026-12-01T12:00Z")));
});

test("Quirón: tabla de Horizons interpolada (± 0,005°) y NaN fuera de 1900–2050", () => {
  for (const [at, want] of [["2026-10-25T12:00:00Z", 28.3749946], ["2010-06-01T07:00:00Z", 330.9864848], ["2035-03-07T19:00:00Z", 61.8005266]] as const) {
    const got = chironLongitude(new Date(at));
    ok(Math.abs(got - want) < 0.005, `Quirón ${at}: ${got} (esperado ${want})`);
  }
  ok(Number.isNaN(chironLongitude(new Date("2060-01-01T00:00Z"))));
  ok(isRetro("Chiron", new Date("2026-10-25T12:00Z")), "Quirón va retrógrado en octubre de 2026");
});

test("Nodo Norte medio y Lilith media frente a Swiss Ephemeris", () => {
  for (const [at, node, lilith] of [["2000-01-01T12:00:00Z", 125.0406, 263.4643], ["2026-10-25T12:00:00Z", 326.4176, 274.5531], ["1990-05-14T10:30:00Z", 311.3954, 231.3599]] as const) {
    ok(Math.abs(meanNode(new Date(at)) - node) < 0.01, `nodo ${at}: ${meanNode(new Date(at))}`);
    ok(Math.abs(meanLilith(new Date(at)) - lilith) < 0.2, `Lilith ${at}: ${meanLilith(new Date(at))}`);
  }
  // El nodo medio siempre va hacia atrás; Lilith media, hacia delante.
  ok(isRetro("Node", new Date("2026-10-25T12:00Z")) && !isRetro("Lilith", new Date("2026-10-25T12:00Z")));
});

test("Conjunciones con Quirón y el Nodo, con ℞ en el que va retrógrado", () => {
  const ev = conjunctionsBetween(new Date("2026-02-01T00:00Z"), new Date("2026-05-01T00:00Z"));
  const venusChiron = ev.find((e) => e.kind === "conjunction" && e.a === "Venus" && e.b === "Chiron");
  ok(venusChiron, "Venus – Quirón en marzo de 2026");
  eq(describeAstro(venusChiron!), "☌ Venus – Quirón en Aries 25°24′");
  const mercNode = ev.find((e) => e.kind === "conjunction" && e.a === "Mercury" && e.b === "Node")!;
  ok(describeAstro(mercNode).startsWith("☌ Mercurio – Nodo Norte ℞ en Piscis"), describeAstro(mercNode));
  eq(astroLabel(mercNode), "Conjunción");
});

test("positionsAt: Sol a Lilith (con asteroides y Nodo Sur) y ℞ (25-10-2026: Mercurio, Venus, Saturno… retrógrados)", () => {
  const p = positionsAt(new Date("2026-10-25T12:00Z"));
  eq(p.map((x) => x.body), ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron", "Ceres", "Pallas", "Juno", "Vesta", "Eris", "Node", "SouthNode", "Lilith"]);
  ok(["Mercury", "Venus", "Saturn", "Uranus", "Neptune", "Chiron", "Node", "SouthNode"].every((b) => p.find((x) => x.body === b)!.retro));
  ok(!p.find((x) => x.body === "Jupiter")!.retro && !p.find((x) => x.body === "Lilith")!.retro);
  const node = p.find((x) => x.body === "Node")!.lon;
  ok(Math.abs(((p.find((x) => x.body === "SouthNode")!.lon - node + 360) % 360) - 180) < 1e-9, "Nodo Sur = Nodo Norte + 180°");
  eq(formatZodiac(p.find((x) => x.body === "Venus")!.lon), "Libra 29°55′");
});

test("Qué mostrar: marcas del día según los grupos (la Luna no marca conjunciones; asteroides fuera)", () => {
  const lines = astroByDay(["2026-01-28"], "Europe/Madrid").get("2026-01-28")!.lines;
  const all = dayMarks(lines, ALL_VISIBLE);
  ok(lines.some((l) => l.text.startsWith("☌ Sol – Vesta")), "Sol–Vesta el 28-1-2026");
  const sinAsteroides = dayMarks(lines, { ...ALL_VISIBLE, asteroids: false });
  eq(all.conjunctions - sinAsteroides.conjunctions, lines.filter((l) => l.kind === "conjunction" && l.mark && l.groups.includes("asteroids")).length);
  const moonConj = lines.filter((l) => l.kind === "conjunction" && l.groups.includes("moon"));
  ok(moonConj.every((l) => !l.mark));
  eq(parseVisible(serializeVisible({ ...ALL_VISIBLE, moon: false })), { ...ALL_VISIBLE, moon: false });
  eq(parseVisible(null), ALL_VISIBLE);
  eq(parseVisible("planetas,xx"), ALL_VISIBLE);
  eq(parseVisible(""), { planets: false, moon: false, asteroids: false, points: false });
});
