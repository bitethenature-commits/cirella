/**
 * Reglas del plazo de desistimiento (TRLGDCU arts. 102-108) que comparten el checkout, el motor de
 * huecos, «Mis canales» y las pruebas. Puro (sin BD ni `server-only`): también lo usan componentes
 * de cliente. Se prueba en scripts/unit/desistimiento.test.ts.
 *
 * Cómputo de días (art. 5 del Código Civil y Reglamento 1182/71): el día de la compra NO cuenta
 * (es el «día 0»); el plazo de 14 días naturales son los días 1 a 14 y termina a las 23:59:59 del
 * día 14. Todos los días se cuentan en la zona horaria de la dueña (Creator.timezone).
 *
 *   compra el 25 de octubre a las 10:00   → día 0
 *   puede desistir hasta el 8 de noviembre a las 23:59:59 (día 14)
 *   la primera sesión que se puede reservar empieza el 9 de noviembre a las 00:00 o después (día 15)
 *
 * Así una sesión pagada en la web nunca cae dentro de los 14 días en los que la clienta puede
 * desistir, y siempre empieza al menos 14 días completos (24 h × 14) después del pago (si se compra
 * en la última hora antes de un adelanto de hora, las 00:00 del día 15 llegan antes: entonces manda
 * la segunda condición y la primera hora es las 00:xx del día 15; ver startAfterDays).
 */
import { addDaysToKey, dateKeyInTz, zonedTimeToUtc } from "./tz";

export const WITHDRAWAL_DAYS = 14;
/** Las sesiones que se pagan en la web se reservan como pronto el día 15 desde la compra. */
export const PAID_SESSION_MIN_NOTICE_DAYS = WITHDRAWAL_DAYS + 1;
/** Máximo de días de antelación que se pueden pedir (el formulario y la validación). */
export const PAID_SESSION_MAX_NOTICE_DAYS = 90;
/**
 * Antelación desde «ahora» de una sesión pagada en la web, además del día 15: cuenta al cambiar de
 * fecha cuando el día 15 ya ha pasado (la misma que los cambios gratis, lib/legal.ts).
 */
export const PAID_SESSION_SHORT_NOTICE_HOURS = 24;
/** Con el horario en días: al menos dos semanas para elegir a partir del primer día posible. */
export const PAID_SESSION_MIN_CHOICE_DAYS = 14;
/** Zona por defecto si no se conoce la de la dueña. */
export const DEFAULT_OWNER_TZ = "Europe/Madrid";

/** Las 00:00 (zona `tz`) del día `n` contando el de `from` como día 0. */
export function startOfDayN(from: Date, n: number, tz: string = DEFAULT_OWNER_TZ): Date {
  return zonedTimeToUtc(addDaysToKey(dateKeyInTz(from, tz), n), 0, tz);
}

/** Último instante en el que se puede desistir: las 23:59:59.999 del día 14 desde el pago. */
export function withdrawalDeadline(paidAt: Date, tz: string = DEFAULT_OWNER_TZ): Date {
  return new Date(startOfDayN(paidAt, WITHDRAWAL_DAYS + 1, tz).getTime() - 1);
}

/**
 * Primera hora del día `n` desde `from` y, además, al menos (n − 1) × 24 h después: la segunda
 * condición solo cuenta si se compra en la última hora del día anterior a un adelanto de hora
 * (verano), cuando las 00:00 del día n llegan 1 h antes de cumplirse los días completos.
 */
export function startAfterDays(from: Date, n: number, tz: string = DEFAULT_OWNER_TZ): Date {
  return new Date(Math.max(startOfDayN(from, n, tz).getTime(), from.getTime() + (n - 1) * 86_400_000));
}

/**
 * Primera hora en la que puede empezar una sesión comprada en `purchaseAt`: las 00:00 del día 15
 * (o del que pida la dueña), y nunca antes de 14 × 24 h desde la compra.
 */
export function earliestPaidSessionStart(purchaseAt: Date, tz: string = DEFAULT_OWNER_TZ, noticeDays: number = PAID_SESSION_MIN_NOTICE_DAYS): Date {
  return startAfterDays(purchaseAt, Math.max(PAID_SESSION_MIN_NOTICE_DAYS, noticeDays), tz);
}

/**
 * ¿La regla del día 15 se aplica a esta sesión? Solo a las individuales que se pagan en la web
 * (accessMode PAID; sin valor se trata como de pago). Los talleres tienen fecha fija (otra regla,
 * workshopInWithdrawalPeriod) y lo que se paga fuera no se reserva aquí. Las sesiones que da la
 * dueña a mano («Dar una sesión o lectura») quedan fuera: quien llama lo indica (manual).
 */
export function followsDay15Rule(p: { type: string; groupSession?: boolean | null; accessMode?: string | null }): boolean {
  return p.type === "SESSION" && !p.groupSession && (p.accessMode == null || p.accessMode === "PAID");
}

/**
 * Antelación de una sesión pagada en la web, en días (nunca menos de 15). Se guarda en
 * Product.minNoticeHours (días × 24); los productos de antes con 24 h o 48 h valen 15 días al leerlos.
 */
export function paidSessionNoticeDays(p: { minNoticeHours?: number | null }): number {
  const h = p.minNoticeHours ?? 0;
  const days = Number.isFinite(h) && h > 0 ? Math.ceil(h / 24) : 0;
  return Math.min(PAID_SESSION_MAX_NOTICE_DAYS, Math.max(PAID_SESSION_MIN_NOTICE_DAYS, days));
}

/** Días que se pueden reservar por delante de una sesión pagada en la web: dos semanas como mínimo tras el primer día. */
export function paidSessionHorizon(horizonDays: number, noticeDays: number): number {
  return Math.max(horizonDays, noticeDays + PAID_SESSION_MIN_CHOICE_DAYS);
}

/**
 * ¿Un taller con fecha fija cae dentro del plazo de desistimiento si se compra en `now`? Es decir,
 * ¿empieza antes del día 15? Entonces la compra pide la casilla de servicio en plazo (art. 103.a).
 */
export function workshopInWithdrawalPeriod(eventStartAt: Date | null | undefined, now: Date, tz: string = DEFAULT_OWNER_TZ): boolean {
  if (!eventStartAt) return false;
  return eventStartAt.getTime() < earliestPaidSessionStart(now, tz).getTime();
}
