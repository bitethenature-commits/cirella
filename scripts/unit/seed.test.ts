import { addDaysToKey, dateKeyInTz, weekdayOfKey, zonedParts } from "../../lib/tz";
import { ANA_AVAILABILITY, ANA_BLOCKED_IN_DAYS, DEMO_TZ, demoSchedule, nextSessionDay } from "../../prisma/demo-dates";
import { demoSaleFields } from "../../prisma/demo-sales";
import { eq, ok, test } from "./harness";

// ── Fechas de la demo: relativas al día en que se siembra ──
const madrid = (d: Date) => zonedParts(d, DEMO_TZ);
const minutesOf = (d: Date) => madrid(d).hour * 60 + madrid(d).minute;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);
const fits = (key: string, minutes: number, duration: number) =>
  ANA_AVAILABILITY.some((r) => r.weekday === weekdayOfKey(key) && r.startMinute <= minutes && minutes + duration <= r.endMinute);

// Un año entero de «hoy», incluidos los cambios de hora de marzo y octubre.
const todays = Array.from({ length: 366 }, (_, i) => addDaysToKey("2026-01-01", i));

test("demoSchedule: la sesión de Laura a las 17:00, dentro de su horario, a 3–9 días y nunca en un día bloqueado", () => {
  for (const today of todays) {
    const s = demoSchedule(today);
    const day = dateKeyInTz(s.lauraAt, DEMO_TZ);
    const ahead = daysBetween(today, day);
    ok(ahead >= 3 && ahead <= 9, `${today}: Laura a ${ahead} días`);
    eq(minutesOf(s.lauraAt), 17 * 60, `${today}: hora de Madrid`);
    ok(fits(day, 17 * 60, 75), `${today}: ${day} fuera del horario de Cirella`);
    ok(!s.blocked.includes(day), `${today}: Laura en un día bloqueado`);
  }
});

test("demoSchedule: la sesión de Carmen a las 10:00, después de la de Laura, dentro del horario y no bloqueada", () => {
  for (const today of todays) {
    const s = demoSchedule(today);
    const day = dateKeyInTz(s.carmenAt, DEMO_TZ);
    ok(daysBetween(dateKeyInTz(s.lauraAt, DEMO_TZ), day) >= 1, `${today}: Carmen no va después de Laura`);
    eq(minutesOf(s.carmenAt), 10 * 60, `${today}: hora de Madrid`);
    ok(fits(day, 10 * 60, 60), `${today}: ${day} fuera del horario de Cirella`);
    ok(!s.blocked.includes(day), `${today}: Carmen en un día bloqueado`);
    // El recordatorio (24 h antes) sigue programado: nunca un «Programado» de una sesión pasada.
    ok(s.carmenAt.getTime() - 86400_000 > Date.parse(`${today}T23:59:59Z`), `${today}: recordatorio de Carmen ya pasado`);
  }
});

test("demoSchedule: días bloqueados dentro de dos semanas y siempre la misma respuesta para el mismo día", () => {
  const s = demoSchedule("2026-10-15");
  eq(s.blocked, ANA_BLOCKED_IN_DAYS.map((d) => addDaysToKey("2026-10-15", d)));
  eq(s.blocked, ["2026-10-29", "2026-10-30"]);
  // Jueves 15 → el primer L–J desde el domingo 18 es el lunes 19; Carmen, el martes 20.
  eq(s.lauraAt.toISOString(), "2026-10-19T15:00:00.000Z");
  eq(s.carmenAt.toISOString(), "2026-10-20T08:00:00.000Z");
  eq(demoSchedule("2026-10-15"), s);
});

test("nextSessionDay salta un día bloqueado y un día sin franja suficiente", () => {
  // Lunes 19 bloqueado → martes 20. Una sesión de 5 h no cabe en ninguna franja → error.
  eq(nextSessionDay({ from: "2026-10-15", minDays: 3, minutes: 1020, durationMin: 75, availability: ANA_AVAILABILITY, blocked: ["2026-10-19"] }), "2026-10-20");
  // Viernes solo tiene mañana: una sesión a las 17:00 no cae en viernes.
  eq(nextSessionDay({ from: "2026-10-15", minDays: 1, minutes: 1020, durationMin: 75, availability: ANA_AVAILABILITY, blocked: [] }), "2026-10-19");
  let threw = false;
  try {
    nextSessionDay({ from: "2026-10-15", minDays: 1, minutes: 600, durationMin: 300, availability: ANA_AVAILABILITY, blocked: [] });
  } catch {
    threw = true;
  }
  ok(threw, "sin hueco posible debe fallar");
});

// ── Ventas de la demo: mismos importes que el checkout ──

test("demoSaleFields: «Gene Keys» (59 €, Pro): comisión del 2 % sobre el precio", () => {
  const f = demoSaleFields({ product: { priceCents: 5900 }, commissionBps: 200 });
  eq([f.amountCents, f.platformFeeCents, f.netCents], [5900, 118, 5782]);
  eq(f.amountCents - f.platformFeeCents, f.netCents, "total − comisión");
});

test("demoSaleFields: la meditación de María (12 €, Creator): comisión del 5 %", () => {
  const f = demoSaleFields({ product: { priceCents: 1200 }, commissionBps: 500 });
  eq([f.platformFeeCents, f.netCents], [60, 1140]);
});