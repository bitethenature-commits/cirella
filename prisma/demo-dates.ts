/**
 * Fechas de la demo (prisma/seed.ts), relativas al día en que se siembra: con el mismo «hoy» salen
 * siempre las mismas. Las usan también las pruebas e2e para saber qué fecha deben ver.
 * Puro (sin BD): se prueba en scripts/unit/seed.test.ts.
 */
import { addDaysToKey, dateKeyInTz, weekdayOfKey, zonedTimeToUtc } from "../lib/tz";
import { PAID_SESSION_MIN_NOTICE_DAYS } from "../lib/withdrawal";

export const DEMO_TZ = "Europe/Madrid";

export type DemoAvailability = { weekday: number; startMinute: number; endMinute: number }[];

/** Horario de Cirella (0 = domingo): L–J 10–14 y 17–20 · V 10–14. */
export const ANA_AVAILABILITY: DemoAvailability = [
  ...[1, 2, 3, 4].flatMap((weekday) => [
    { weekday, startMinute: 600, endMinute: 840 },
    { weekday, startMinute: 1020, endMinute: 1200 },
  ]),
  { weekday: 5, startMinute: 600, endMinute: 840 },
];

/** Días bloqueados de Cirella («Retiro de otoño»): dentro de dos semanas. */
export const ANA_BLOCKED_IN_DAYS = [14, 15];

/** La sesión de Laura (Lectura de Human Design, 75 min): a las 17:00, como el ejemplo del briefing. */
export const LAURA_SESSION = { minDays: 3, minutes: 17 * 60, durationMin: 75 };
/** La de Carmen (Sesión 1:1, 60 min): a las 10:00 del siguiente día con horario después del de Laura. */
export const CARMEN_SESSION = { minutes: 10 * 60, durationMin: 60 };

/**
 * El primer día desde `from + minDays` en el que una sesión de `durationMin` que empieza a la hora
 * `minutes` cabe entera en una franja del horario y que no está bloqueado.
 */
export function nextSessionDay(i: {
  from: string;
  minDays: number;
  minutes: number;
  durationMin: number;
  availability: DemoAvailability;
  blocked: string[];
}): string {
  for (let d = i.minDays; d < i.minDays + 366; d++) {
    const key = addDaysToKey(i.from, d);
    if (i.blocked.includes(key)) continue;
    const wd = weekdayOfKey(key);
    if (i.availability.some((r) => r.weekday === wd && r.startMinute <= i.minutes && i.minutes + i.durationMin <= r.endMinute)) return key;
  }
  throw new Error("No hay ningún día con horario para la sesión de la demo");
}

/** Días bloqueados y reservas de la demo sembrada el día `today` (AAAA-MM-DD en Madrid). */
export function demoSchedule(today: string) {
  const blocked = ANA_BLOCKED_IN_DAYS.map((d) => addDaysToKey(today, d));
  const base = { availability: ANA_AVAILABILITY, blocked };
  const lauraDay = nextSessionDay({ ...base, from: today, ...LAURA_SESSION });
  const carmenDay = nextSessionDay({ ...base, from: lauraDay, minDays: 1, ...CARMEN_SESSION });
  return {
    blocked,
    lauraAt: zonedTimeToUtc(lauraDay, LAURA_SESSION.minutes, DEMO_TZ),
    carmenAt: zonedTimeToUtc(carmenDay, CARMEN_SESSION.minutes, DEMO_TZ),
  };
}

/**
 * Hace cuántos días se compró una sesión de la demo que es en `sessionAt`: lo justo para que la
 * sesión caiga el día 15 desde la compra (lib/withdrawal.ts), nunca dentro de sus 14 días para
 * desistir, y que la compra sea de hace al menos un día. Con la sesión dentro de 3 días, la compra
 * fue hace 12 y la clienta aún puede desistir 2 días más.
 */
export function demoPurchaseDaysAgo(today: string, sessionAt: Date): number {
  const sessionDay = dateKeyInTz(sessionAt, DEMO_TZ);
  const until = Math.round((Date.parse(`${sessionDay}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return Math.max(1, PAID_SESSION_MIN_NOTICE_DAYS - until);
}
