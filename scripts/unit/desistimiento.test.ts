/**
 * Reglas del desistimiento (lib/withdrawal.ts): el día 15 de las sesiones que se pagan en la web, el
 * fin del plazo de 14 días, los talleres (sin desistimiento), el reembolso proporcional de las
 * membresías y su encaje con el motor de huecos, en varias zonas horarias y con los cambios de hora.
 */
import { demoPurchaseDaysAgo, demoSchedule } from "../../prisma/demo-dates";
import { computeSlots } from "../../lib/slots";
import { dateKeyInTz } from "../../lib/tz";
import {
  earliestPaidSessionStart,
  followsDay15Rule,
  PAID_SESSION_MIN_NOTICE_DAYS,
  paidSessionHorizon,
  paidSessionNoticeDays,
  startOfDayN,
  isWorkshopProduct,
  membershipWithdrawalRefund,
  withdrawalDeadline,
} from "../../lib/withdrawal";
import { toWithdrawalInput, withdrawalEligibility, type WithdrawalInput } from "../../lib/refund-math";
import { eq, ok, test } from "./harness";

const H = 3600_000;
const DAY = 24 * H;
const MAD = "Europe/Madrid";

test("día 15: comprar el 25 de octubre a las 12:00 en Madrid → sesiones desde el 9 de noviembre a las 00:00", () => {
  const buy = new Date("2026-10-25T11:00:00Z"); // 12:00 CET (ya en horario de invierno)
  eq(earliestPaidSessionStart(buy, MAD).toISOString(), "2026-11-08T23:00:00.000Z");
  eq(withdrawalDeadline(buy, MAD).toISOString(), "2026-11-08T22:59:59.999Z");
});
test("día 15: el día de la compra es el día 0 aunque se compre a las 00:05 o a las 23:55", () => {
  eq(earliestPaidSessionStart(new Date("2026-11-01T23:05:00Z"), MAD).toISOString(), "2026-11-16T23:00:00.000Z"); // 2 nov 00:05 → 17 nov
  eq(earliestPaidSessionStart(new Date("2026-11-02T22:55:00Z"), MAD).toISOString(), "2026-11-16T23:00:00.000Z"); // 2 nov 23:55 → 17 nov
});
test("día 15 con cambio de hora: compra en verano, sesión en invierno (y al revés)", () => {
  // 20 oct (CEST, +2) → 4 nov 00:00 CET (+1).
  eq(earliestPaidSessionStart(new Date("2026-10-20T08:00:00Z"), MAD).toISOString(), "2026-11-03T23:00:00.000Z");
  // 20 mar (CET, +1) → 4 abr 00:00 CEST (+2).
  eq(earliestPaidSessionStart(new Date("2026-03-20T08:00:00Z"), MAD).toISOString(), "2026-04-03T22:00:00.000Z");
  // La noche del cambio (25 oct 2026, 03:00 → 02:00): 00:30 CEST sigue siendo el 25.
  eq(dateKeyInTz(new Date("2026-10-24T22:30:00Z"), MAD), "2026-10-25");
  eq(earliestPaidSessionStart(new Date("2026-10-24T22:30:00Z"), MAD).toISOString(), "2026-11-08T23:00:00.000Z");
});
test("día 15 en otras zonas: Bogotá, Los Ángeles (DST) y Kiritimati (+14)", () => {
  eq(earliestPaidSessionStart(new Date("2026-10-25T03:00:00Z"), "America/Bogota").toISOString(), "2026-11-08T05:00:00.000Z"); // 24 oct 22:00 → 8 nov
  eq(earliestPaidSessionStart(new Date("2026-10-25T18:00:00Z"), "America/Los_Angeles").toISOString(), "2026-11-09T08:00:00.000Z"); // PDT → PST
  eq(earliestPaidSessionStart(new Date("2026-10-25T18:00:00Z"), "Pacific/Kiritimati").toISOString(), "2026-11-09T10:00:00.000Z"); // 26 oct 08:00 → 10 nov
});
test("día 15: nunca dentro del plazo y siempre al menos 14 días completos después (miles de compras, 4 zonas)", () => {
  const zones = [MAD, "America/Bogota", "America/Los_Angeles", "Asia/Makassar", "Pacific/Kiritimati"];
  let t = Date.parse("2026-01-01T00:00:00Z");
  for (let i = 0; i < 4000; i++) {
    t += 2 * H + 17 * 60_000; // recorre todas las horas del día y los dos cambios de hora del año
    const buy = new Date(t);
    for (const tz of zones) {
      const first = earliestPaidSessionStart(buy, tz).getTime();
      const deadline = withdrawalDeadline(buy, tz).getTime();
      ok(first > deadline, `${tz} ${buy.toISOString()}: la primera sesión cae dentro del plazo`);
      // Casi siempre justo al acabar el plazo (00:00 del día 15); si no, en la primera hora del día 15.
      ok(first === deadline + 1 || (first - deadline <= H && first === t + 14 * DAY), `${tz} ${buy.toISOString()}: no es el día 15`);
      ok(first - t >= 14 * DAY, `${tz} ${buy.toISOString()}: menos de 14 días completos`);
      ok(first - t <= 15 * DAY + H, `${tz} ${buy.toISOString()}: más de 15 días`);
    }
  }
});
test("día 15 antes de un adelanto de hora: comprar a las 23:47 en Los Ángeles → 14 × 24 h, a las 00:47 del día 15", () => {
  const buy = new Date("2026-02-24T07:47:00Z"); // 23 feb 23:47 PST; el 8 de marzo se adelanta la hora
  eq(startOfDayN(buy, 15, "America/Los_Angeles").toISOString(), "2026-03-10T07:00:00.000Z");
  eq(earliestPaidSessionStart(buy, "America/Los_Angeles").toISOString(), "2026-03-10T07:47:00.000Z");
});
test("startOfDayN(·, 0) es el principio del día de la compra", () => eq(startOfDayN(new Date("2026-10-25T11:00:00Z"), 0, MAD).toISOString(), "2026-10-24T22:00:00.000Z"));

test("followsDay15Rule: solo las sesiones individuales que se pagan en la web", () => {
  ok(followsDay15Rule({ type: "SESSION", groupSession: false, accessMode: "PAID" }));
  ok(followsDay15Rule({ type: "SESSION" })); // sin modo: de pago (nunca se regala por error)
  ok(!followsDay15Rule({ type: "SESSION", groupSession: true, accessMode: "PAID" }));
  ok(!followsDay15Rule({ type: "SESSION", accessMode: "EXTERNAL" }));
  ok(!followsDay15Rule({ type: "DIGITAL", accessMode: "PAID" }));
});
test("paidSessionNoticeDays: nunca menos de 15 (las de antes con 24 h valen 15) ni más de 90", () => {
  eq(paidSessionNoticeDays({ minNoticeHours: 24 }), 15);
  eq(paidSessionNoticeDays({ minNoticeHours: null }), 15);
  eq(paidSessionNoticeDays({ minNoticeHours: 0 }), 15);
  eq(paidSessionNoticeDays({ minNoticeHours: 360 }), 15);
  eq(paidSessionNoticeDays({ minNoticeHours: 21 * 24 }), 21);
  eq(paidSessionNoticeDays({ minNoticeHours: 1000 * 24 }), 90);
  eq(PAID_SESSION_MIN_NOTICE_DAYS, 15);
});
test("paidSessionHorizon: siempre dos semanas para elegir desde el primer día", () => {
  eq(paidSessionHorizon(14, 15), 29);
  eq(paidSessionHorizon(28, 15), 29);
  eq(paidSessionHorizon(56, 15), 56);
  eq(paidSessionHorizon(28, 30), 44);
});

test("talleres: sin desistimiento, queden los días que queden (art. 103 l)", () => {
  ok(isWorkshopProduct({ type: "SESSION", groupSession: true }));
  ok(!isWorkshopProduct({ type: "SESSION", groupSession: false }));
  ok(!isWorkshopProduct({ type: "MEMBERSHIP", groupSession: true }));
  const paidAt = new Date("2026-10-25T11:00:00Z");
  const base: WithdrawalInput = { status: "PAID", paidAt, productType: "SESSION", amountCents: 3500, refundedCents: 0, withdrawalWaived: true, hasPendingRefund: false, timezone: MAD };
  // Taller a 40 días comprado con su casilla: ni el primer minuto.
  const far = { ...base, waiverKind: "WORKSHOP_FIXED_DATE", booking: { status: "CONFIRMED", startAt: new Date("2026-12-04T18:00:00Z") } };
  eq(withdrawalEligibility(far, new Date(paidAt.getTime() + 60_000)), { eligible: false, reason: "WORKSHOP" });
  // Uno de antes (sin esa casilla) sigue con las reglas que se le dieron.
  ok(withdrawalEligibility({ ...far, waiverKind: "SERVICE_IN_PERIOD" }, new Date(paidAt.getTime() + 60_000)).eligible);
  ok(withdrawalEligibility({ ...far, waiverKind: null }, new Date(paidAt.getTime() + 60_000)).eligible);
});

// ── Membresías: reembolso proporcional (art. 108.3) ──

test("membresía mensual: 12 € pagados el 27 oct, desiste el 3 nov → 23 de 31 días → 8,90 € (hacia abajo)", () => {
  const start = new Date("2026-10-27T09:00:00Z"); // 10:00 en Madrid
  const end = new Date("2026-11-27T09:00:00Z");
  eq(membershipWithdrawalRefund({ amountCents: 1200, periodStart: start, periodEnd: end, now: new Date("2026-11-03T17:00:00Z"), timezone: MAD }), {
    totalDays: 31,
    usedDays: 8,
    unusedDays: 23,
    refundCents: 890, // 1200 × 23 / 31 = 890,32
  });
});
test("membresía: el mismo día del pago ya cuenta como disfrutado; redondeo siempre hacia abajo", () => {
  const start = new Date("2026-02-03T10:00:00Z");
  const end = new Date("2026-03-03T10:00:00Z"); // febrero: 28 días
  const r = membershipWithdrawalRefund({ amountCents: 2900, periodStart: start, periodEnd: end, now: new Date("2026-02-03T10:05:00Z"), timezone: MAD });
  eq(r, { totalDays: 28, usedDays: 1, unusedDays: 27, refundCents: 2796 }); // 2900 × 27 / 28 = 2796,43
  // 999 × 1 / 3 = 333 exacto; 1000 × 2 / 3 = 666,67 → 666.
  eq(membershipWithdrawalRefund({ amountCents: 1000, periodStart: new Date("2026-05-01T10:00:00Z"), periodEnd: new Date("2026-05-04T10:00:00Z"), now: new Date("2026-05-01T12:00:00Z"), timezone: MAD }).refundCents, 666);
});
test("membresía anual: 290 € el 27 oct 2026 (365 días); el día 14 a las 23:59 → 350 de 365 días", () => {
  const start = new Date("2026-10-27T09:00:00Z");
  const end = new Date("2027-10-27T09:00:00Z");
  const last = withdrawalDeadline(start, MAD); // 10 nov 23:59:59.999 en Madrid
  eq(last.toISOString(), "2026-11-10T22:59:59.999Z");
  eq(membershipWithdrawalRefund({ amountCents: 29000, periodStart: start, periodEnd: end, now: last, timezone: MAD }), {
    totalDays: 365,
    usedDays: 15,
    unusedDays: 350,
    refundCents: 27808, // 29000 × 350 / 365 = 27808,21
  });
});
test("membresía: los días se cuentan en la zona de la dueña (Bogotá) y con el cambio de hora", () => {
  // Pago el 1 nov a las 03:00 UTC = 31 oct 22:00 en Bogotá: el periodo empieza el 31 oct allí.
  const start = new Date("2026-11-01T03:00:00Z");
  const end = new Date("2026-12-01T03:00:00Z"); // 30 nov 22:00 en Bogotá → 30 días
  const r = membershipWithdrawalRefund({ amountCents: 3000, periodStart: start, periodEnd: end, now: new Date("2026-11-01T04:00:00Z"), timezone: "America/Bogota" });
  eq(r, { totalDays: 30, usedDays: 1, unusedDays: 29, refundCents: 2900 });
  // Madrid, el periodo cruza el cambio de hora del 25 oct: 20 oct → 20 nov = 31 días.
  eq(membershipWithdrawalRefund({ amountCents: 3100, periodStart: new Date("2026-10-20T08:00:00Z"), periodEnd: new Date("2026-11-20T08:00:00Z"), now: new Date("2026-10-26T08:00:00Z"), timezone: MAD }).unusedDays, 24);
});

const memberOrder = (over: Partial<WithdrawalInput> = {}): WithdrawalInput => ({
  status: "PAID",
  paidAt: new Date("2026-10-27T09:00:00Z"),
  productType: "MEMBERSHIP",
  amountCents: 1200,
  refundedCents: 0,
  withdrawalWaived: false,
  hasPendingRefund: false,
  timezone: MAD,
  waiverKind: "MEMBERSHIP_START",
  membership: { periodStart: new Date("2026-10-27T09:00:00Z"), periodEnd: new Date("2026-11-27T09:00:00Z"), live: true, renewed: false },
  ...over,
});
test("membresía: «Desistir» durante los 14 días con el importe proporcional; después, no", () => {
  const e = withdrawalEligibility(memberOrder(), new Date("2026-11-03T17:00:00Z"));
  ok(e.eligible && e.amountCents === 890 && e.proportional?.unusedDays === 23, JSON.stringify(e));
  // 10 nov 23:59 (día 14): aún; 11 nov 00:00: no.
  const last = withdrawalEligibility(memberOrder(), new Date("2026-11-10T22:59:59Z"));
  ok(last.eligible && last.amountCents === Math.floor((1200 * 16) / 31), JSON.stringify(last));
  eq(withdrawalEligibility(memberOrder(), new Date("2026-11-10T23:00:00Z")), { eligible: false, reason: "EXPIRED" });
});
test("membresía: una renuncia de antes (DIGITAL_IMMEDIATE) no quita el derecho: también proporcional", () => {
  const e = withdrawalEligibility(memberOrder({ waiverKind: "DIGITAL_IMMEDIATE", withdrawalWaived: true }), new Date("2026-11-03T17:00:00Z"));
  ok(e.eligible && e.amountCents === 890);
});
test("membresía: renovada, terminada o sin suscripción → no se desiste", () => {
  const at = new Date("2026-11-03T17:00:00Z");
  eq(withdrawalEligibility(memberOrder({ membership: { ...memberOrder().membership!, renewed: true } }), at), { eligible: false, reason: "RENEWED" });
  eq(withdrawalEligibility(memberOrder({ membership: { ...memberOrder().membership!, live: false } }), at), { eligible: false, reason: "MEMBERSHIP_ENDED" });
  eq(withdrawalEligibility(memberOrder({ membership: null }), at), { eligible: false, reason: "MEMBERSHIP_ENDED" });
});
test("membresía: con un reembolso parcial previo se devuelve como mucho lo que queda", () => {
  const e = withdrawalEligibility(memberOrder({ refundedCents: 1000 }), new Date("2026-11-03T17:00:00Z"));
  ok(e.eligible && e.amountCents === 200, JSON.stringify(e));
});
test("toWithdrawalInput: pasa la casilla y la suscripción de la membresía", () => {
  const m = { periodStart: new Date("2026-10-27T09:00:00Z"), periodEnd: new Date("2026-11-27T09:00:00Z"), live: true, renewed: false };
  const i = toWithdrawalInput({ status: "PAID", paidAt: new Date(), productType: "MEMBERSHIP", amountCents: 1200, refundedCents: 0, waiverAcceptedAt: new Date(), waiverKind: "MEMBERSHIP_START", bookings: [], refunds: [], membership: m });
  eq(i.waiverKind, "MEMBERSHIP_START");
  eq(i.membership, m);
});

// ── Motor de huecos con la regla ──

const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 600, endMinute: 840 }));
const slotsFor = (now: Date, extra: Partial<Parameters<typeof computeSlots>[0]> = {}) =>
  computeSlots({ now, timezone: MAD, durationMin: 60, bufferMin: 0, minNoticeHours: 24, horizonDays: 40, rules: weekdays, blockedDates: [], overrides: [], busy: [], ...extra });

test("computeSlots: con minNoticeDays 15 no hay ningún hueco antes del día 15 (zona de la dueña)", () => {
  const now = new Date("2026-10-26T09:00:00Z"); // lunes 26 oct, 10:00 CET
  const starts = slotsFor(now, { minNoticeDays: 15 });
  eq(starts[0], "2026-11-10T09:00:00.000Z"); // martes 10 nov 10:00 (día 15)
  ok(starts.every((s) => Date.parse(s) >= Date.parse("2026-11-09T23:00:00Z")));
  // Sin la regla, desde mañana.
  eq(slotsFor(now)[0], "2026-10-27T09:00:00.000Z");
});
test("computeSlots: el día 15 cuenta desde la compra (firstDayFrom), no desde hoy, y la antelación en horas desde ahora", () => {
  const paid = new Date("2026-10-20T09:00:00Z"); // martes 20 oct
  const now = new Date("2026-10-26T09:00:00Z");
  eq(slotsFor(now, { minNoticeDays: 15, firstDayFrom: paid })[0], "2026-11-04T09:00:00.000Z"); // miércoles 4 nov (día 15)
  // Pasado el día 15, manda la antelación de 24 h desde ahora.
  const late = new Date("2026-11-20T09:00:00Z"); // viernes
  eq(slotsFor(late, { minNoticeDays: 15, firstDayFrom: paid })[0], "2026-11-23T09:00:00.000Z"); // lunes siguiente (sábado y domingo sin horario)
});
test("computeSlots: día 15 con cambio de hora en medio (compra en CEST, día 15 en CET)", () => {
  const now = new Date("2026-10-20T08:00:00Z"); // martes 20 oct, 10:00 CEST
  const starts = slotsFor(now, { minNoticeDays: 15 });
  eq(starts[0], "2026-11-04T09:00:00.000Z"); // miércoles 4 nov 10:00 CET
});

test("demo: las sesiones de Laura y Carmen caen el día 15 desde su compra y Laura aún puede desistir", () => {
  for (const today of ["2026-10-15", "2026-10-25", "2026-11-01", "2026-12-24", "2027-03-28"]) {
    const s = demoSchedule(today);
    for (const at of [s.lauraAt, s.carmenAt]) {
      const p = demoPurchaseDaysAgo(today, at);
      ok(p >= 1 && p <= 14, `${today}: compra hace ${p} días`);
      const bought = new Date(Date.parse(`${today}T12:00:00Z`) - p * DAY);
      ok(at.getTime() >= earliestPaidSessionStart(bought, MAD).getTime(), `${today}: la sesión cae dentro del plazo`);
    }
    // Laura: su plazo sigue abierto hoy (para el e2e de «Desistir»).
    const lauraBought = new Date(Date.parse(`${today}T16:47:00Z`) - demoPurchaseDaysAgo(today, s.lauraAt) * DAY);
    ok(withdrawalDeadline(lauraBought, MAD).getTime() > Date.parse(`${today}T21:00:00Z`), `${today}: Laura ya no puede desistir`);
  }
});
