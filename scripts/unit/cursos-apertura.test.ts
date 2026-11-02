/**
 * Estudio de cursos: «Abrir las lecciones poco a poco» (lib/course-drip.ts).
 */
import { dripDayFor, dripDayLabel, dripSummary, lessonLocks, opensAt, parseDripDays, readDrip } from "../../lib/course-drip";
import { eq, ok, test } from "./harness";

const enrolled = new Date("2026-11-01T10:00:00Z");
const lessons = [
  { id: "a", dripDays: null },
  { id: "b", dripDays: 3 },
  { id: "c", dripDays: 10 },
];

test("readDrip: sin modo, modo desconocido o «cada 0 días» = todas a la vez", () => {
  eq(readDrip({ dripMode: null, dripEveryDays: null }), { mode: null, everyDays: null });
  eq(readDrip({ dripMode: "OTRO", dripEveryDays: 7 }), { mode: null, everyDays: null });
  eq(readDrip({ dripMode: "INTERVAL", dripEveryDays: 0 }), { mode: null, everyDays: null });
  eq(readDrip({ dripMode: "INTERVAL", dripEveryDays: 7 }), { mode: "INTERVAL", everyDays: 7 });
  eq(readDrip({ dripMode: "LESSON", dripEveryDays: 7 }), { mode: "LESSON", everyDays: null });
});

test("cada N días: la 1.ª el primer día, la 2.ª a los N, la 3.ª a los 2N", () => {
  const drip = readDrip({ dripMode: "INTERVAL", dripEveryDays: 7 });
  eq([0, 1, 2].map((i) => dripDayFor(drip, i, 99)), [0, 7, 14]);
});

test("por lección: su «disponible a los N días» (vacío = el primer día)", () => {
  const drip = readDrip({ dripMode: "LESSON", dripEveryDays: null });
  eq(lessons.map((l, i) => dripDayFor(drip, i, l.dripDays)), [0, 3, 10]);
});

test("lessonLocks: cerradas hasta su día; abiertas cuando llega (misma hora del alta)", () => {
  const drip = readDrip({ dripMode: "LESSON", dripEveryDays: null });
  const at4 = lessonLocks(drip, lessons, enrolled, new Date("2026-11-05T09:00:00Z"));
  eq(at4.get("a"), null);
  eq(at4.get("b"), null);
  eq(at4.get("c")?.toISOString(), opensAt(enrolled, 10).toISOString());
  const justBefore = lessonLocks(drip, lessons, enrolled, new Date("2026-11-04T09:59:59Z"));
  ok(justBefore.get("b") instanceof Date, "un segundo antes, aún cerrada");
});

test("lessonLocks: la dueña (sin fecha de alta) o sin apertura poco a poco → todo abierto", () => {
  const drip = readDrip({ dripMode: "INTERVAL", dripEveryDays: 1 });
  ok([...lessonLocks(drip, lessons, null).values()].every((v) => v === null));
  ok([...lessonLocks(readDrip({ dripMode: null, dripEveryDays: null }), lessons, enrolled, enrolled).values()].every((v) => v === null));
});

test("textos y lectura del formulario", () => {
  eq(dripDayLabel(0), "Desde el primer día");
  eq(dripDayLabel(1), "Al día siguiente");
  eq(dripDayLabel(7), "A los 7 días");
  eq(dripSummary(readDrip({ dripMode: "INTERVAL", dripEveryDays: 1 })), "Una lección cada día");
  eq(dripSummary(readDrip({ dripMode: null, dripEveryDays: null })), "Todas las lecciones a la vez");
  eq([parseDripDays(""), parseDripDays("0"), parseDripDays("7"), parseDripDays("9999"), parseDripDays("x")], [null, null, 7, 365, null]);
});
