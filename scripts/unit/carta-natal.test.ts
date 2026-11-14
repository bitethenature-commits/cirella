/**
 * Carta natal calculada (lib/natal-chart.ts).
 *
 * Referencias:
 *   · Posiciones, ángulos y cúspides de Plácidus: Swiss Ephemeris 2.10 (pyswisseph, efemérides de
 *     Moshier: swe.calc_ut con SE_SUN…SE_PLUTO, SE_MEAN_NODE, SE_TRUE_NODE, SE_MEAN_APOG y
 *     swe.houses_ex(jd, lat, lon, b'P')). Diferencias medidas: ángulos y cúspides < 0,3″; planetas
 *     < 20″; nodos < 20″. Lilith media: < 7′ (el apogeo medio de Swiss Ephemeris lleva términos que
 *     la fórmula de Meeus no tiene), por eso va con 0,15°.
 *   · 1 de enero de 2000, 12:00 UTC, Greenwich: tiempo sidéreo ≈ 18h41m50s (RAMC 280,46°) → MC
 *     9°36′ de Capricornio (279,611°) y Asc 24°15′ de Aries (24,266°) a 51,48° N.
 *   · Quirón (1900–2000, tabla nueva): JPL Horizons (COMMAND='2060;', QUANTITIES='31', TLIST en
 *     instantes que no son de la tabla), diferencias < 2″.
 *   · Zonas horarias: tzdata (Madrid en GMT hasta 1940, hora doble de Londres en 1944, LMT de Madrid
 *     en 1900, cambios de hora de 2023).
 */
import {
  anglesAt,
  bodyLongitude,
  computeChart,
  computeHouses,
  findAspects,
  formatCoord,
  formatOffset,
  houseOf,
  localToUtc,
  orbFor,
  parseFixedOffset,
  spreadLongitudes,
  trueNode,
  zodiacPos,
  type AspectId,
  type BodyId,
} from "../../lib/natal-chart";
import { chironLongitude, lonDiff } from "../../lib/astro-calendar";
import { eq, ok, test } from "./harness";

const close = (got: number, want: number, tolDeg: number, what: string) =>
  ok(Math.abs(lonDiff(got, want)) <= tolDeg, `${what}: ${got.toFixed(4)} (esperado ${want.toFixed(4)} ± ${tolDeg}°)`);

const ARCSEC = 1 / 3600;

const SWISS = [
  {
    utc: "2000-01-01T12:00:00Z", lat: 51.4779, lon: 0.0, asc: 24.2662, mc: 279.6111,
    placidus: [24.2662, 61.1424, 82.0208, 99.6111, 119.0619, 147.7007, 204.2662, 241.1424, 262.0208, 279.6111, 299.0619, 327.7007],
    bodies: { sun: 280.3689, moon: 223.3238, mercury: 271.8893, venus: 241.5658, mars: 327.9633, jupiter: 25.253, saturn: 40.3956, uranus: 314.8092, neptune: 303.193, pluto: 251.4547, node: 125.0406, trueNode: 123.9529, lilith: 263.4643 },
  },
  {
    utc: "1988-11-14T06:45:00Z", lat: 37.3886, lon: -5.9823, asc: 227.7098, mc: 146.6303,
    placidus: [227.7098, 257.4246, 291.2156, 326.6303, 358.8784, 25.6169, 47.7098, 77.4246, 111.2156, 146.6303, 178.8784, 205.6169],
    bodies: { sun: 232.1217, moon: 288.7464, mercury: 222.2201, venus: 198.597, mars: 1.7077, jupiter: 62.2431, saturn: 270.1899, uranus: 268.9933, neptune: 278.2658, pluto: 222.8965, node: 340.3144, trueNode: 341.0755, lilith: 170.4346 },
  },
  {
    utc: "1955-02-24T03:15:00Z", lat: -34.6037, lon: -58.3816, asc: 251.4609, mc: 141.2136,
    placidus: [251.4609, 274.734, 296.6435, 321.2136, 352.2598, 31.3426, 71.4609, 94.734, 116.6435, 141.2136, 172.2598, 211.3426],
    bodies: { sun: 334.7418, moon: 353.6441, mercury: 314.4523, venus: 290.0363, mars: 28.3884, jupiter: 110.5725, saturn: 231.1548, uranus: 114.1645, neptune: 208.0651, pluto: 145.3472, node: 272.5579, trueNode: 273.5795, lilith: 238.4108 },
  },
  {
    utc: "1923-06-01T23:30:00Z", lat: 64.1466, lon: -21.9426, asc: 253.176, mc: 222.4219,
    placidus: [253.176, 309.9422, 15.4246, 42.4219, 56.7098, 66.0714, 73.176, 129.9422, 195.4246, 222.4219, 236.7098, 246.0714],
    bodies: { sun: 70.4239, moon: 287.7259, mercury: 64.6276, venus: 43.6771, mars: 91.376, jupiter: 220.8665, saturn: 193.5407, uranus: 347.3744, neptune: 135.7311, pluto: 99.9552, node: 166.2948, trueNode: 166.4439, lilith: 26.9942 },
  },
];

for (const c of SWISS) {
  const at = new Date(c.utc);
  test(`Ascendente, MC y Plácidus como Swiss Ephemeris (${c.utc}, ${c.lat}°)`, () => {
    const angles = anglesAt(at, c.lat, c.lon);
    close(angles.asc, c.asc, 2 * ARCSEC, "Asc");
    close(angles.mc, c.mc, 2 * ARCSEC, "MC");
    const houses = computeHouses("placidus", angles, c.lat);
    eq(houses.system, "placidus");
    houses.cusps.forEach((x, i) => close(x, c.placidus[i], 2 * ARCSEC, `cúspide ${i + 1}`));
  });
  test(`Posiciones como Swiss Ephemeris (${c.utc})`, () => {
    for (const [id, want] of Object.entries(c.bodies)) {
      if (id === "trueNode") close(trueNode(at), want, 40 * ARCSEC, "nodo verdadero");
      else close(bodyLongitude(id as BodyId, at), want, id === "lilith" ? 0.15 : 40 * ARCSEC, id);
    }
    close(bodyLongitude("southNode", at), c.bodies.node + 180, 40 * ARCSEC, "Nodo Sur");
  });
}

test("MC del 1-1-2000 12:00 UTC en Greenwich: 9°36′ de Capricornio", () => {
  const { mc, asc } = anglesAt(new Date("2000-01-01T12:00:00Z"), 51.4779, 0);
  eq(zodiacPos(mc), { sign: 9, deg: 9, min: 36 });
  eq(zodiacPos(asc), { sign: 0, deg: 24, min: 15 });
});

test("El Ascendente sale por el este y el MC culmina (comprobación geométrica en 5 lugares)", () => {
  for (const [lat, lon, iso] of [[40.4, -3.7, "1975-04-02T08:00Z"], [-33.9, 151.2, "1990-12-24T18:30Z"], [0, 0, "2010-06-21T00:00Z"], [60, 10, "1960-01-01T03:00Z"], [19.4, -99.1, "2049-08-15T21:45Z"]] as const) {
    const at = new Date(iso);
    const { asc, mc, ramc, eps } = anglesAt(at, lat, lon);
    // Ascensión recta y declinación del Asc: su ángulo horario debe dejarlo en el horizonte (altura 0), al este.
    const rad = Math.PI / 180;
    const ra = Math.atan2(Math.sin(asc * rad) * Math.cos(eps * rad), Math.cos(asc * rad)) / rad;
    const dec = Math.asin(Math.sin(eps * rad) * Math.sin(asc * rad)) / rad;
    const H = (ramc - ra) * rad;
    const alt = Math.asin(Math.sin(lat * rad) * Math.sin(dec * rad) + Math.cos(lat * rad) * Math.cos(dec * rad) * Math.cos(H)) / rad;
    ok(Math.abs(alt) < 1e-6, `altura del Asc ${alt}`);
    ok(Math.sin(H) < 0, "el Asc está al este (ángulo horario negativo)");
    // El MC tiene la ascensión recta del RAMC.
    const raMc = Math.atan2(Math.sin(mc * rad) * Math.cos(eps * rad), Math.cos(mc * rad)) / rad;
    close(raMc, ramc, 1e-6, "AR del MC");
  }
});

test("Signos enteros y casas iguales", () => {
  const angles = anglesAt(new Date("1988-11-14T06:45:00Z"), 37.3886, -5.9823);
  const whole = computeHouses("whole", angles, 37.3886).cusps;
  eq(whole[0], 210);
  eq(whole[11], 180);
  const equal = computeHouses("equal", angles, 37.3886).cusps;
  close(equal[0], 227.7098, 2 * ARCSEC, "casa I");
  close(equal[9], 137.7098, 2 * ARCSEC, "casa X");
});

test("Plácidus por encima del círculo polar → casas iguales, avisando", () => {
  const angles = anglesAt(new Date("2000-01-01T12:00:00Z"), 70, 25);
  const h = computeHouses("placidus", angles, 70);
  eq(h.system, "equal");
  eq(h.requested, "placidus");
  ok(h.fallback && /círculo polar/.test(h.fallback));
});

test("houseOf con cúspides desiguales y cruzando 0°", () => {
  const cusps = [350, 20, 45, 80, 110, 140, 170, 200, 225, 260, 290, 320];
  eq(houseOf(355, cusps), 1);
  eq(houseOf(5, cusps), 1);
  eq(houseOf(20, cusps), 2);
  eq(houseOf(349.9, cusps), 12);
  eq(houseOf(259.99, cusps), 9);
});

test("Quirón de 1900 a 2000 como JPL Horizons", () => {
  for (const [iso, want] of [["1900-01-10T21:00Z", 259.9750371], ["1910-03-03T06:00Z", 328.8883608], ["1950-06-16T12:00Z", 258.2160758], ["1985-07-08T18:00Z", 71.7893087], ["1996-02-14T03:00Z", 194.0865783]] as const)
    close(chironLongitude(new Date(iso)), want, 5 * ARCSEC, `Quirón ${iso}`);
  ok(Number.isNaN(chironLongitude(new Date("1899-06-01T00:00Z"))), "antes de la tabla no hay Quirón");
});

test("Hora local → UTC con el desfase histórico", () => {
  const r = (y: number, mo: number, d: number, h: number, mi: number, tz: string) => localToUtc({ year: y, month: mo, day: d, hour: h, minute: mi }, tz);
  eq(r(1988, 11, 14, 7, 45, "Europe/Madrid").utc.toISOString(), "1988-11-14T06:45:00.000Z");
  eq(r(1935, 1, 15, 12, 0, "Europe/Madrid").utc.toISOString(), "1935-01-15T12:00:00.000Z");
  eq(r(1949, 8, 1, 12, 0, "Europe/Madrid").utc.toISOString(), "1949-08-01T10:00:00.000Z");
  eq(r(1944, 6, 1, 12, 0, "Europe/London").utc.toISOString(), "1944-06-01T10:00:00.000Z");
  eq(r(1969, 7, 20, 16, 17, "America/New_York").utc.toISOString(), "1969-07-20T20:17:00.000Z");
  eq(r(1975, 5, 1, 12, 0, "Atlantic/Canary").utc.toISOString(), "1975-05-01T12:00:00.000Z");
  eq(r(1900, 6, 1, 12, 0, "Europe/Madrid").utc.toISOString(), "1900-06-01T12:14:44.000Z");
  eq(r(1980, 1, 1, 0, 0, "UTC+05:30").utc.toISOString(), "1979-12-31T18:30:00.000Z");
});

test("Cambio de hora: la hora repetida y la que no existió", () => {
  const amb = localToUtc({ year: 2023, month: 10, day: 29, hour: 2, minute: 30 }, "Europe/Madrid");
  eq(amb.status, "ambiguous");
  eq(amb.utc.toISOString(), "2023-10-29T00:30:00.000Z");
  eq(amb.offsetMinutes, 120);
  eq(amb.alternative?.utc.toISOString(), "2023-10-29T01:30:00.000Z");
  const gap = localToUtc({ year: 2023, month: 3, day: 26, hour: 2, minute: 30 }, "Europe/Madrid");
  eq(gap.status, "gap");
  eq(gap.utc.toISOString(), "2023-03-26T01:30:00.000Z");
});

test("Desfases fijos y su formato", () => {
  eq(parseFixedOffset("UTC+01:00"), 60);
  eq(parseFixedOffset("-03:30"), -210);
  eq(parseFixedOffset("UTC"), 0);
  eq(parseFixedOffset("Europe/Madrid"), null);
  eq(formatOffset(-14 - 44 / 60), "UTC−00:14:44");
  eq(formatOffset(330), "UTC+05:30");
  eq(formatCoord(40.4168, "lat"), "40°25′N");
  eq(formatCoord(-3.7038, "lon"), "3°42′O");
});

test("Aspectos: orbes, tipo y si se forman", () => {
  eq(orbFor("conjunction", "sun", "mars"), 10);
  eq(orbFor("square", "venus", "mars"), 7);
  eq(orbFor("trine", "moon", "node"), 4);
  const all = new Set<AspectId>(["conjunction", "sextile", "square", "trine", "quincunx", "opposition"]);
  const asp = findAspects(
    [
      { id: "sun", lon: 10, speed: 1 },
      { id: "moon", lon: 101, speed: 13 },
      { id: "mars", lon: 192, speed: 0.5 },
      { id: "node", lon: 300, speed: -0.05 },
      { id: "southNode", lon: 120, speed: -0.05 },
    ],
    all,
  );
  const find = (a: string, b: string) => asp.find((x) => x.a === a && x.b === b);
  eq(find("sun", "moon")?.type, "square");
  eq(find("sun", "moon")?.applying, false, "la Luna, más rápida, se aleja de la cuadratura");
  eq(find("sun", "mars")?.type, "opposition");
  eq(find("sun", "mars")?.applying, true, "el Sol se acerca al punto opuesto a Marte");
  eq(find("node", "southNode"), undefined, "los nodos no se aspectan entre sí");
  eq(find("moon", "mars")?.type, "square");
  eq(find("sun", "node"), undefined, "290° de distancia: nada");
});

test("Los glifos que caen juntos se abren en abanico, sin cruzar el 0°", () => {
  const lons = [100, 101, 102, 250, 359, 1];
  const out = spreadLongitudes(lons, 6);
  const gap = (a: number, b: number) => Math.abs(lonDiff(a, b));
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) ok(gap(out[i], out[j]) >= 6 - 1e-6, `${i}-${j} a ${gap(out[i], out[j])}°`);
  close(out[1], 101, 1e-9, "el del medio no se mueve");
  close(out[3], 250, 1e-9, "el aislado no se mueve");
  close(out[4], 357, 1e-9, "pareja sobre el 0°");
  close(out[5], 3, 1e-9, "pareja sobre el 0°");
});

test("Carta completa: Cirella, Sevilla 14-11-1988 07:45", () => {
  const { utc } = localToUtc({ year: 1988, month: 11, day: 14, hour: 7, minute: 45 }, "Europe/Madrid");
  const chart = computeChart({ utc, timeKnown: true, lat: 37.3886, lon: -5.9823, houseSystem: "placidus", node: "mean" });
  eq(chart.bodies.length, 14);
  const sun = chart.bodies.find((b) => b.id === "sun")!;
  eq(zodiacPos(sun.lon), { sign: 7, deg: 22, min: 7 });
  eq(sun.house, 1);
  eq(zodiacPos(chart.angles!.asc).sign, 7);
  ok(!chart.bodies.find((b) => b.id === "node")!.retro, "los nodos no llevan ℞");
  const noTime = computeChart({ utc, timeKnown: false, lat: 37.3886, lon: -5.9823, houseSystem: "placidus", node: "mean" });
  eq(noTime.angles, undefined);
  eq(noTime.bodies[0].house, undefined);
});
