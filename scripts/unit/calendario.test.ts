/**
 * Calendario propio: motor de huecos (lib/slots.ts), zonas horarias (lib/timezones.ts) y las horas
 * para la clienta y la dueña (lib/tz.ts).
 */
import { availabilityWindows, computeSlots, groupSlotsByDay, horizonOf, subtractIntervals, type SlotInput } from "../../lib/slots";
import { canonicalTimezone, FREQUENT_TIMEZONES, listTimezones, sameOffset, tzCity, tzOffsetLabel } from "../../lib/timezones";
import { clientTimeNote, ownerWhen, sessionWhen } from "../../lib/tz";
import { eq, ok, test } from "./harness";

const MADRID = "Europe/Madrid";
// Domingo 1 de noviembre de 2026 a las 08:00 en Madrid (CET, UTC+1).
const NOW = new Date("2026-11-01T07:00:00Z");
const base = (o: Partial<SlotInput> = {}): SlotInput => ({
  now: NOW,
  timezone: MADRID,
  durationMin: 60,
  bufferMin: 15,
  minNoticeHours: 0,
  horizonDays: 28,
  rules: [{ weekday: 1, startMinute: 600, endMinute: 840 }],
  blockedDates: [],
  overrides: [],
  busy: [],
  ...o,
});
const on = (slots: string[], day: string) => slots.filter((s) => s.startsWith(day));

test("computeSlots: lunes 10–14, 60 min + 15 de margen → 10:00, 11:15 y 12:30 (13:45 no cabe)", () => {
  // 10:00 Madrid = 09:00 UTC en noviembre.
  eq(on(computeSlots(base()), "2026-11-02"), ["2026-11-02T09:00:00.000Z", "2026-11-02T10:15:00.000Z", "2026-11-02T11:30:00.000Z"]);
});

test("computeSlots: un día bloqueado no da huecos, aunque tenga horario especial", () => {
  const s = computeSlots(base({ blockedDates: ["2026-11-02"], overrides: [{ date: "2026-11-02", kind: "HOURS", startMinute: 900, endMinute: 1080, timezone: MADRID }] }));
  eq(on(s, "2026-11-02"), []);
  ok(on(s, "2026-11-09").length === 3, "el lunes siguiente sigue igual");
});

test("computeSlots: un horario especial sustituye al semanal de ese día y solo de ese día", () => {
  const s = computeSlots(base({ overrides: [{ date: "2026-11-02", kind: "HOURS", startMinute: 960, endMinute: 1080, timezone: MADRID }] }));
  eq(on(s, "2026-11-02"), ["2026-11-02T15:00:00.000Z"]);
  eq(on(s, "2026-11-09").length, 3);
});

test("computeSlots: horario especial en Bali (Asia/Makassar) 9:00–13:00 → 01:00–05:00 UTC", () => {
  const s = computeSlots(base({ rules: [], overrides: [{ date: "2026-11-05", kind: "HOURS", startMinute: 540, endMinute: 780, timezone: "Asia/Makassar" }] }));
  eq(s, ["2026-11-05T01:00:00.000Z", "2026-11-05T02:15:00.000Z", "2026-11-05T03:30:00.000Z"]);
});

test("computeSlots: unas horas bloqueadas quitan los huecos que tocan y dejan el resto", () => {
  const s = computeSlots(base({ overrides: [{ date: "2026-11-02", kind: "BLOCK", startMinute: 660, endMinute: 720, timezone: MADRID }] }));
  // Bloqueo 11:00–12:00 Madrid: la franja queda 10–11 y 12–14 → 10:00 y 12:00, 13:15 no cabe hasta las 14.
  eq(on(s, "2026-11-02"), ["2026-11-02T09:00:00.000Z", "2026-11-02T11:00:00.000Z"]);
});

test("computeSlots: horizonte de 28 días frente a 56 (el último día entra, el siguiente no)", () => {
  const all = base({ rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 600, endMinute: 660 })) });
  const s28 = computeSlots(all);
  eq(s28[s28.length - 1], "2026-11-29T09:00:00.000Z");
  const s56 = computeSlots({ ...all, horizonDays: 56 });
  eq(s56[s56.length - 1], "2026-12-27T09:00:00.000Z");
});

test("computeSlots: antelación mínima de 24 h y su cálculo desde la hora del pedido", () => {
  const s = computeSlots(base({ now: new Date("2026-11-01T10:00:00Z"), minNoticeHours: 24 }));
  eq(on(s, "2026-11-02"), ["2026-11-02T10:15:00.000Z", "2026-11-02T11:30:00.000Z"]);
  const fromOrder = computeSlots(base({ now: new Date("2026-11-01T10:00:00Z"), minNoticeHours: 24, noticeFrom: new Date("2026-11-01T08:00:00Z") }));
  eq(on(fromOrder, "2026-11-02").length, 3);
});

test("computeSlots: lo ocupado (± margen) y los pagos en curso no se ofrecen", () => {
  const busy = [{ start: Date.parse("2026-11-02T10:15:00Z"), end: Date.parse("2026-11-02T11:15:00Z") }];
  // Con 15 min de margen: 10:00–11:00 Madrid (09:00Z) termina justo al empezar el margen; 11:15 choca; 12:30 libre.
  eq(on(computeSlots(base({ busy })), "2026-11-02"), ["2026-11-02T09:00:00.000Z", "2026-11-02T11:30:00.000Z"]);
  const tight = computeSlots(base({ bufferMin: 0, busy }));
  eq(on(tight, "2026-11-02"), ["2026-11-02T09:00:00.000Z", "2026-11-02T12:00:00.000Z"]);
});

test("computeSlots DST: Madrid 25-oct-2026 (se atrasa) y 28-mar-2027 (se adelanta), franja 01:00–04:00", () => {
  const rules = [{ weekday: 0, startMinute: 60, endMinute: 240 }];
  const fall = computeSlots(base({ now: new Date("2026-10-24T00:00:00Z"), rules, bufferMin: 0, horizonDays: 2 }));
  // 01:00 CEST = 23:00Z; 04:00 CET = 03:00Z: 4 horas reales, sin duplicados.
  eq(fall, ["2026-10-24T23:00:00.000Z", "2026-10-25T00:00:00.000Z", "2026-10-25T01:00:00.000Z", "2026-10-25T02:00:00.000Z"]);
  const spring = computeSlots(base({ now: new Date("2027-03-27T00:00:00Z"), rules, bufferMin: 0, horizonDays: 2 }));
  // 01:00 CET = 00:00Z; 04:00 CEST = 02:00Z: 2 horas reales.
  eq(spring, ["2027-03-28T00:00:00.000Z", "2027-03-28T01:00:00.000Z"]);
});

test("computeSlots: dos fechas especiales que se pisan no duplican huecos y salen ordenados", () => {
  const s = computeSlots(
    base({
      rules: [],
      bufferMin: 0,
      overrides: [
        { date: "2026-11-03", kind: "HOURS", startMinute: 600, endMinute: 720, timezone: MADRID },
        { date: "2026-11-03", kind: "HOURS", startMinute: 600, endMinute: 660, timezone: MADRID },
      ],
    }),
  );
  eq(s, ["2026-11-03T09:00:00.000Z", "2026-11-03T10:00:00.000Z"]);
});

test("subtractIntervals: contiguos, contenidos y varios", () => {
  eq(subtractIntervals([{ start: 0, end: 10 }], [{ start: 10, end: 20 }]), [{ start: 0, end: 10 }]);
  eq(subtractIntervals([{ start: 0, end: 10 }], [{ start: 2, end: 4 }, { start: 6, end: 8 }]), [{ start: 0, end: 2 }, { start: 4, end: 6 }, { start: 8, end: 10 }]);
  eq(subtractIntervals([{ start: 0, end: 10 }], [{ start: -5, end: 15 }]), []);
});

test("availabilityWindows: sin reglas ni fechas especiales no hay franjas", () => eq(availabilityWindows({ ...base(), rules: [] }), []));

test("horizonOf: null → 28, máximo 180", () => {
  eq(horizonOf({ horizonDays: null }), 28);
  eq(horizonOf({ horizonDays: 56 }), 56);
  eq(horizonOf({ horizonDays: 400 }), 180);
});

test("groupSlotsByDay: un 23:30 de Madrid es el día siguiente a las 07:30 en Tokio", () => {
  const days = groupSlotsByDay(["2026-11-02T22:30:00.000Z"], "Asia/Tokyo");
  eq(days.length, 1);
  eq(days[0].date, "2026-11-03");
  eq(days[0].slots[0].label, "07:30");
  eq(days[0].weekday, "mar");
  eq(days[0].month, "nov");
  eq(groupSlotsByDay(["2026-11-02T22:30:00.000Z"], MADRID)[0].slots[0].label, "23:30");
});

test("canonicalTimezone: válidas, alias y basura", () => {
  eq(canonicalTimezone("Europe/Madrid"), "Europe/Madrid");
  eq(canonicalTimezone("US/Eastern"), "America/New_York");
  for (const bad of ["Mars/Base", "", "../../etc", "x".repeat(65), 42, null]) eq(canonicalTimezone(bad), null);
});

test("listTimezones: Madrid, Bogotá y Bali, frecuentes primero y con su GMT", () => {
  const list = listTimezones(NOW);
  const ids = list.map((z) => z.id);
  for (const id of ["Europe/Madrid", "America/Bogota", "Asia/Makassar"]) ok(ids.includes(id), id);
  eq(list[0].id, FREQUENT_TIMEZONES[0]);
  eq(list[0].region, "Frecuentes");
  eq(list.find((z) => z.id === "America/Bogota")!.label, "Bogotá · GMT-5");
  ok(list.some((z) => z.region === "Europa") && list.some((z) => z.region === "América"));
});

test("tzCity: nombres en español y el resto legible", () => {
  eq(tzCity("America/Bogota"), "Bogotá");
  eq(tzCity("America/Mexico_City"), "Ciudad de México");
  eq(tzCity("America/New_York"), "Nueva York");
  eq(tzCity("America/Port_of_Spain"), "Port of Spain");
  eq(tzOffsetLabel("Asia/Kolkata", NOW), "GMT+5:30");
});

test("sessionWhen: «(hora de Bogotá)» solo si la hora es distinta de la de la dueña", () => {
  const d = new Date("2026-11-12T16:00:00Z");
  eq(sessionWhen(d, "America/Bogota", MADRID), "jueves, 12 de noviembre · 11:00 (hora de Bogotá)");
  eq(sessionWhen(d, "Europe/Paris", MADRID), "jueves, 12 de noviembre · 17:00");
  eq(sessionWhen(d, null, MADRID), "jueves, 12 de noviembre · 17:00");
  ok(sameOffset("Europe/Paris", MADRID, d));
});

test("ownerWhen: su hora y «para ella, 11:00 en Bogotá»", () => {
  const d = new Date("2026-11-12T16:00:00Z");
  eq(ownerWhen(d, MADRID, "America/Bogota"), "jueves, 12 de noviembre · 17:00 · para ella, 11:00 en Bogotá");
  eq(ownerWhen(d, MADRID, null), "jueves, 12 de noviembre · 17:00");
  // Otro día para ella: lo dice.
  eq(clientTimeNote(new Date("2026-11-12T22:30:00Z"), MADRID, "Asia/Tokyo"), "para ella, vie 13, 07:30 en Tokio");
});
