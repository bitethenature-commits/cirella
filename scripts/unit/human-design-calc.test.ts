/**
 * Diseño Humano y Gene Keys calculados (lib/human-design-calc.ts).
 *
 * Referencias:
 *   · El mandala rave (Ra Uru Hu, «The Rave I'Ching» / la rueda de Jovian Archive): la puerta 41 empieza en
 *     2°00′ de Acuario; la 17 en 3°52′30″ de Aries; la 27 en 2°00′ de Tauro; la 1 en 13°15′ de Escorpio;
 *     las puertas opuestas (las que forman los ejes de las cruces: 1–2, 13–7, 41–31…) quedan a 180°.
 *   · Cartas publicadas (los cálculos de Jovian Archive / MMI que repiten las biografías de Diseño Humano):
 *       - Ra Uru Hu (Alan Krakower), 9-4-1948, 00:14, Montreal: Manifestador 5/1, autoridad esplénica,
 *         Cruz de Ángulo Izquierdo del Clarín (51/57 | 61/62), definición simple.
 *       - Albert Einstein, 14-3-1879, 11:30, Ulm: Generador 1/4, autoridad emocional, Cruz de Ángulo
 *         Derecho del Edén (36/6 | 11/12).
 *       - Barack Obama, 4-8-1961, 19:24, Honolulu: Proyector 6/2, autoridad emocional, Cruz de Ángulo
 *         Izquierdo del Refinamiento (33/19 | 2/1).
 *     Solo se comprueban líneas que quedan a más de 4′ de arco de su borde (la hora de nacimiento de
 *     estas personas se cita con unos minutos de diferencia según la fuente).
 *   · Gene Keys (Richard Rudd, «The Gene Keys», perfil hologenético): Obra de vida = Sol consciente,
 *     Evolución = Tierra consciente, Irradiación = Sol inconsciente, Propósito = Tierra inconsciente,
 *     Atracción = Luna inconsciente, CI = Venus consciente, CE = Marte consciente, CS = Venus inconsciente,
 *     Núcleo/Vocación = Marte inconsciente, Cultura = Júpiter inconsciente, Perla = Júpiter consciente.
 */
import {
  GATE_ARC,
  LINE_ARC,
  MANDALA_ORDER,
  centreComponents,
  crossAngle,
  designInstant,
  gateAt,
  gateStart,
  geneKeysProfile,
  humanDesignAt,
} from "../../lib/human-design-calc";
import { bodyLongitude, localToUtc } from "../../lib/natal-chart";
import { lonDiff } from "../../lib/astro-calendar";
import { CHANNELS } from "../../components/models/data/human-design";
import { computeAll } from "../../lib/birth-profile";
import { eq, ok, test } from "./harness";

const at = (date: string, time: string, tz: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return localToUtc({ year, month, day, hour, minute }, tz).utc;
};
const gl = (a: { gate: number; line: number }) => `${a.gate}.${a.line}`;
const channels = (hd: ReturnType<typeof humanDesignAt>) => hd.definedChannels.map((c) => `${c.a}-${c.b}`).sort();

/* -------------------------------------------------------------- el mandala */

test("mandala: las 64 puertas, cada una una vez", () => eq([...MANDALA_ORDER].sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i + 1)));

test("mandala: inicios publicados de las puertas 41, 17, 27, 1 y 25", () => {
  eq(gateStart(41), 302);
  eq(gateStart(17), 3.875); // 3°52′30″ Aries
  eq(gateStart(27), 32); // 2°00′ Tauro
  eq(gateStart(1), 223.25); // 13°15′ Escorpio
  eq(gateStart(25), 358.25); // 28°15′ Piscis
});

test("mandala: cada puerta enfrente de su opuesta", () => {
  for (const [a, b] of [[1, 2], [41, 31], [13, 7], [36, 6], [11, 12], [51, 57], [61, 62], [33, 19], [3, 50], [25, 46]])
    eq(Math.abs(lonDiff(gateStart(a), gateStart(b))), 180, `${a}–${b}`);
});

test("mandala: líneas y bordes", () => {
  eq(gateAt(302), { gate: 41, line: 1 });
  eq(gateAt(302 + LINE_ARC * 5.5), { gate: 41, line: 6 });
  eq(gateAt(302 + GATE_ARC - 1e-9), { gate: 41, line: 6 });
  eq(gateAt(302 + GATE_ARC), { gate: 19, line: 1 });
  eq(gateAt(301.999), { gate: 60, line: 6 });
  eq(gateAt(0), { gate: 25, line: 2 }); // 0° Aries: 1°45′ dentro de la 25 (desde 358,25°) → 1,75 / 0,9375 = 1,87 → línea 2
});

/* ---------------------------------------------------------- instante de diseño */

test("diseño: el Sol 88° antes, unos 88 días antes", () => {
  for (const iso of ["1948-04-09T05:14:00Z", "1961-08-05T05:24:00Z", "2000-01-01T12:00:00Z", "1990-07-04T03:00:00Z"]) {
    const birth = new Date(iso);
    const d = designInstant(birth);
    const arc = lonDiff(bodyLongitude("sun", birth), bodyLongitude("sun", d));
    ok(Math.abs(arc - 88) < 1 / 3600, `${iso}: arco ${arc}`);
    const days = (birth.getTime() - d.getTime()) / 86_400_000;
    ok(days > 85 && days < 93, `${iso}: ${days} días`);
  }
});

/* ------------------------------------------------------------ cartas publicadas */

test("Ra Uru Hu: Manifestador 5/1 esplénico, Clarín 51/57 | 61/62", () => {
  const hd = humanDesignAt(at("1948-04-09", "00:14", "America/Montreal"));
  eq(gl(hd.personality.sun), "51.5");
  eq(gl(hd.personality.earth), "57.5");
  eq(gl(hd.design.sun), "61.1");
  eq(gl(hd.design.earth), "62.1");
  eq(hd.reading.type, "Manifestador");
  eq(hd.reading.authority, "Esplénica");
  eq(hd.profile.label, "5/1");
  eq(hd.cross.angle, "left");
  eq(hd.cross.gates, [51, 57, 61, 62]);
  eq(hd.definition, "single");
  eq(channels(hd), ["10-20", "10-57", "20-57", "23-43", "25-51"]);
  eq([...hd.definedCentres].sort(), ["ajna", "g", "heart", "spleen", "throat"]);
  // Gene Keys de las mismas activaciones
  const gk = geneKeysProfile(hd);
  eq([gk.keys.lifework, gk.keys.evolution, gk.keys.radiance, gk.keys.purpose], [51, 57, 61, 62]);
  eq([gk.lines.lifework, gk.lines.radiance], [5, 1]);
  eq([gk.keys.attraction, gk.keys.core, gk.keys.culture, gk.keys.pearl], [41, 40, 26, 10]);
});

test("Albert Einstein: Generador 1/4 emocional, Edén 36/6 | 11/12", () => {
  const hd = humanDesignAt(at("1879-03-14", "11:30", "Europe/Berlin"));
  eq(hd.cross.gates, [36, 6, 11, 12]);
  eq(hd.cross.angle, "right");
  eq(hd.profile.label, "1/4");
  eq(hd.reading.type, "Generador");
  eq(hd.reading.authority, "Emocional — plexo solar");
});

test("Barack Obama: Proyector 6/2 emocional, Refinamiento 33/19 | 2/1", () => {
  const hd = humanDesignAt(at("1961-08-04", "19:24", "Pacific/Honolulu"));
  eq(gl(hd.personality.sun), "33.6");
  eq(gl(hd.design.sun), "2.2");
  eq(hd.cross.gates, [33, 19, 2, 1]);
  eq(hd.cross.angle, "left");
  eq(hd.reading.type, "Proyector");
  eq(hd.reading.authority, "Emocional — plexo solar");
  eq(channels(hd), ["30-41"]);
  eq(hd.definition, "single");
});

/* ------------------------------------------------------- definición, cruz, GK */

test("definición: componentes conexas", () => {
  const ch = (...keys: string[]) => CHANNELS.filter((c) => keys.includes(`${c.a}-${c.b}`));
  eq(centreComponents([]).length, 0);
  eq(centreComponents(ch("47-64")).length, 1);
  eq(centreComponents(ch("47-64", "34-57")).length, 2);
  eq(centreComponents(ch("47-64", "34-57", "19-49")).length, 3);
  eq(centreComponents(ch("47-64", "34-57", "19-49", "21-45")).length, 4);
  eq(centreComponents(ch("4-63", "17-62", "20-34")).length, 1); // cabeza–ajna–garganta–sacral
});

test("cruz: ángulo según el perfil", () => {
  eq(["1/3", "1/4", "2/4", "2/5", "3/5", "3/6", "4/6", "4/1", "5/1", "5/2", "6/2", "6/3"].map((p) => crossAngle(+p[0], +p[2])), [
    "right", "right", "right", "right", "right", "right", "right", "juxtaposition", "left", "left", "left", "left",
  ]);
});

test("Gene Keys: once esferas, cada una de su activación", () => {
  const hd = humanDesignAt(new Date("2000-01-01T12:00:00Z"));
  const gk = geneKeysProfile(hd);
  eq(Object.keys(gk.keys).length, 11);
  eq(gk.keys.lifework, hd.personality.sun.gate);
  eq(gk.keys.evolution, hd.personality.earth.gate);
  eq(gk.keys.radiance, hd.design.sun.gate);
  eq(gk.keys.purpose, hd.design.earth.gate);
  eq(gk.keys.attraction, hd.design.moon.gate);
  eq(gk.keys.iq, hd.personality.venus.gate);
  eq(gk.keys.eq, hd.personality.mars.gate);
  eq(gk.keys.sq, hd.design.venus.gate);
  eq(gk.keys.core, hd.design.mars.gate);
  eq(gk.keys.culture, hd.design.jupiter.gate);
  eq(gk.keys.pearl, hd.personality.jupiter.gate);
  eq(gk.lines.attraction, hd.design.moon.line);
});

/* ------------------------------------------------------------- computeAll */

test("computeAll: un perfil → carta, Diseño Humano, Gene Keys y Luna natal coherentes", () => {
  const p = { name: "Ra Uru Hu", date: "1948-04-09", time: "00:14", place: { name: "Montreal", lat: 45.5017, lon: -73.5673, tz: "America/Montreal" } };
  const all = computeAll(p);
  eq(all.utc.toISOString(), "1948-04-09T05:14:00.000Z");
  eq(all.humanDesign.profile.label, "5/1");
  eq(all.geneKeys.keys.lifework, 51);
  const sun = all.chart.bodies.find((b) => b.id === "sun")!;
  eq(gateAt(sun.lon).gate, 51);
  eq(gateAt(all.natalMoon.moonLon).gate, all.humanDesign.personality.moon.gate);
  ok(all.chart.angles, "con hora hay ángulos");
  const noTime = computeAll({ ...p, time: null });
  eq(noTime.chart.angles, undefined);
  eq(noTime.natalMoon.range !== undefined, true);
});
