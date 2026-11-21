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
 * (accessMode PAID; sin valor se trata como de pago). Los talleres tienen fecha fija y no admiten
 * desistimiento (isWorkshopProduct) y lo que se paga fuera no se reserva aquí. Las sesiones que da la
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
 * Talleres (sesiones en grupo con fecha fija): actividad de esparcimiento con fecha de ejecución
 * específica, sin derecho de desistimiento (TRLGDCU art. 103 l), queden los días que queden. Al
 * pagar se pide siempre la casilla que lo reconoce (lib/legal.ts → WORKSHOP_FIXED_DATE) y nunca hay
 * «Desistir». Por eso mover la fecha de un taller no cambia nada del desistimiento.
 */
export function isWorkshopProduct(p: { type: string; groupSession?: boolean | null }): boolean {
  return p.type === "SESSION" && !!p.groupSession;
}

/** Días naturales entre dos claves «AAAA-MM-DD» (b − a). */
function keyDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export type MembershipRefund = {
  /** Días del periodo pagado (del día de inicio al de fin, en la zona de la dueña). */
  totalDays: number;
  /** Días disfrutados: del día de inicio al de hoy, ambos incluidos. */
  usedDays: number;
  /** Días sin disfrutar: totalDays − usedDays. */
  unusedDays: number;
  /** Importe a devolver, en céntimos (redondeado hacia abajo). */
  refundCents: number;
};

/**
 * Desistimiento de una membresía (TRLGDCU art. 108.3). La membresía es un servicio continuado que
 * nunca queda «completamente ejecutado» en 14 días: aunque la clienta pida empezar ya, conserva el
 * derecho y, si desiste, paga solo la parte ya disfrutada. Se devuelve:
 *
 *   importe pagado × días sin disfrutar del periodo ÷ días del periodo   (hacia abajo, al céntimo)
 *
 * Los días se cuentan en la zona de la dueña. El día de inicio y el de hoy cuentan como disfrutados
 * (ha tenido acceso esos días y el acceso termina ahora):
 *
 *   membresía de 12,00 € al mes pagada el 27 de octubre (periodo 27 oct → 27 nov: 31 días)
 *   desiste el 3 de noviembre → disfrutados 8 (27 oct a 3 nov), sin disfrutar 23
 *   devolución = 1200 × 23 ÷ 31 = 890,32 → 8,90 €
 */
export function membershipWithdrawalRefund(i: {
  amountCents: number;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
  timezone?: string | null;
}): MembershipRefund {
  const tz = i.timezone || DEFAULT_OWNER_TZ;
  const startKey = dateKeyInTz(i.periodStart, tz);
  const totalDays = Math.max(1, keyDiff(startKey, dateKeyInTz(i.periodEnd, tz)));
  const usedDays = Math.min(totalDays, Math.max(1, keyDiff(startKey, dateKeyInTz(i.now, tz)) + 1));
  const unusedDays = totalDays - usedDays;
  const refundCents = Math.max(0, Math.floor((i.amountCents * unusedDays) / totalDays));
  return { totalDays, usedDays, unusedDays, refundCents };
}
