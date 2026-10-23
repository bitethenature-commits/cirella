/**
 * Motor de huecos: puro (sin BD), se prueba en scripts/unit/calendario.test.ts. lib/booking.ts carga
 * los datos y llama aquí; el mismo cálculo sirve para listar huecos y para volver a comprobar uno al
 * pagar, así que un hueco que se ofrece nunca falla después por otra regla.
 *
 *   disponible = horario semanal (zona de la dueña)
 *              − días bloqueados enteros (BlockedDate)
 *              − días con horario especial (sus franjas SUSTITUYEN a las semanales, cada una en su zona)
 *              − horas bloqueadas (BLOCK)
 *   huecos     = cada «duración + margen» desde el inicio de cada franja, desde ahora + antelación
 *                mínima hasta el horizonte, sin chocar (± margen) con lo ocupado: reservas, talleres,
 *                calendario externo y pagos en curso (solo en la web personal).
 *
 * Todas las horas internas van en milisegundos UTC: los cambios de hora (DST) no duplican ni pierden huecos.
 */
import { addDaysToKey, dateKeyInTz, formatInTz, weekdayOfKey, zonedTimeToUtc } from "./tz";

/** Intervalo [start, end) en milisegundos UTC. */
export type Interval = { start: number; end: number };
export type WeeklyRule = { weekday: number; startMinute: number; endMinute: number };
export type DateOverride = { date: string; kind: string; startMinute: number; endMinute: number; timezone: string };

export type SlotInput = {
  now: Date;
  /** Zona de la dueña: la del horario semanal y la de los días del horizonte. */
  timezone: string;
  durationMin: number;
  bufferMin: number;
  minNoticeHours: number;
  horizonDays: number;
  rules: WeeklyRule[];
  /** Días enteros bloqueados (YYYY-MM-DD en la zona de la dueña). Ganan a todo. */
  blockedDates: string[];
  overrides: DateOverride[];
  /** Ocupado: no se ofrece nada que lo toque, con el margen de la sesión a cada lado. */
  busy: Interval[];
  /**
   * Desde cuándo cuenta la antelación mínima (por defecto `now`). Al confirmar un pago se usa la hora
   * del pedido: quien eligió a tiempo no pierde su hueco por tardar unos minutos en pagar.
   */
  noticeFrom?: Date;
};

export const HORIZON_DEFAULT_DAYS = 28;
export const HORIZON_MAX_DAYS = 180;
/** Opciones del panel: 2, 4, 8 y 13 semanas y 6 meses. */
export const HORIZON_CHOICES = [14, 28, 56, 90, 180] as const;

/** Días por delante que se pueden reservar (null = 28; nunca más de 180). */
export function horizonOf(p: { horizonDays?: number | null }): number {
  const d = p.horizonDays;
  if (!d || !Number.isInteger(d) || d < 1) return HORIZON_DEFAULT_DAYS;
  return Math.min(d, HORIZON_MAX_DAYS);
}

/** «2 semanas», «6 meses». */
export function horizonLabel(days: number): string {
  if (days === 180) return "6 meses";
  if (days === 90) return "13 semanas (3 meses)";
  if (days % 7 === 0) return `${days / 7} semanas`;
  return `${days} días`;
}

/** a − b, con los intervalos de a ordenados y sin solapes en la salida. */
export function subtractIntervals(a: Interval[], b: Interval[]): Interval[] {
  const cuts = [...b].filter((x) => x.end > x.start).sort((x, y) => x.start - y.start);
  const out: Interval[] = [];
  for (const iv of [...a].sort((x, y) => x.start - y.start)) {
    let pieces: Interval[] = [{ ...iv }];
    for (const c of cuts) {
      if (c.start >= iv.end) break;
      if (c.end <= iv.start) continue;
      pieces = pieces.flatMap((p) => {
        if (c.end <= p.start || c.start >= p.end) return [p];
        const res: Interval[] = [];
        if (c.start > p.start) res.push({ start: p.start, end: c.start });
        if (c.end < p.end) res.push({ start: c.end, end: p.end });
        return res;
      });
    }
    out.push(...pieces.filter((p) => p.end > p.start));
  }
  return out;
}

/** Fin (exclusivo) del horizonte: las 00:00 del día siguiente al último día que se puede reservar. */
export function horizonEnd(now: Date, timezone: string, horizonDays: number): number {
  return zonedTimeToUtc(addDaysToKey(dateKeyInTz(now, timezone), horizonDays + 1), 0, timezone).getTime();
}

/** Franjas disponibles (UTC) desde hoy hasta el horizonte, antes de quitar lo ocupado. */
export function availabilityWindows(i: Pick<SlotInput, "now" | "timezone" | "horizonDays" | "rules" | "blockedDates" | "overrides">): Interval[] {
  const tz = i.timezone;
  const blocked = new Set(i.blockedDates);
  const todayKey = dateKeyInTz(i.now, tz);
  const lastKey = addDaysToKey(todayKey, i.horizonDays);
  // Una fecha especial (aunque sea en otra zona) se reconoce por su fecha: ese día no hay horario semanal.
  const specialDays = new Set(i.overrides.filter((o) => o.kind === "HOURS").map((o) => o.date));
  const windows: Interval[] = [];
  for (let d = 0; d <= i.horizonDays; d++) {
    const key = addDaysToKey(todayKey, d);
    if (blocked.has(key) || specialDays.has(key)) continue;
    const wd = weekdayOfKey(key);
    for (const r of i.rules) {
      if (r.weekday !== wd || r.endMinute <= r.startMinute) continue;
      windows.push({ start: zonedTimeToUtc(key, r.startMinute, tz).getTime(), end: zonedTimeToUtc(key, r.endMinute, tz).getTime() });
    }
  }
  // Fechas especiales: cada una en su zona. Un día bloqueado entero gana también a su horario especial.
  const from = addDaysToKey(todayKey, -1);
  const to = addDaysToKey(lastKey, 1);
  for (const o of i.overrides) {
    if (o.kind !== "HOURS" || blocked.has(o.date) || o.date < from || o.date > to || o.endMinute <= o.startMinute) continue;
    windows.push({ start: zonedTimeToUtc(o.date, o.startMinute, o.timezone).getTime(), end: zonedTimeToUtc(o.date, o.endMinute, o.timezone).getTime() });
  }
  const blocks = i.overrides
    .filter((o) => o.kind === "BLOCK" && o.endMinute > o.startMinute)
    .map((o) => ({ start: zonedTimeToUtc(o.date, o.startMinute, o.timezone).getTime(), end: zonedTimeToUtc(o.date, o.endMinute, o.timezone).getTime() }));
  return subtractIntervals(windows, blocks);
}

/** Inicios de los huecos libres (ISO), únicos y en orden. */
export function computeSlots(i: SlotInput): string[] {
  const durMs = i.durationMin * 60000;
  const bufMs = i.bufferMin * 60000;
  const step = durMs + bufMs;
  const now = i.now.getTime();
  const earliest = Math.max(now, (i.noticeFrom ?? i.now).getTime() + i.minNoticeHours * 3600_000);
  const end = horizonEnd(i.now, i.timezone, i.horizonDays);
  const busy = i.busy.filter((b) => b.end > b.start);
  const out = new Set<number>();
  if (durMs <= 0) return [];
  for (const w of availabilityWindows(i)) {
    for (let t = w.start; t + durMs <= w.end; t += step) {
      if (t < earliest || t >= end) continue;
      const tEnd = t + durMs;
      if (busy.some((b) => t < b.end + bufMs && tEnd + bufMs > b.start)) continue;
      out.add(t);
    }
  }
  return [...out].sort((a, b) => a - b).map((t) => new Date(t).toISOString());
}

export type DaySlots = {
  date: string; // YYYY-MM-DD en la zona de quien mira
  weekday: string; // "lun"
  day: string; // "12"
  month: string; // "oct"
  slots: { start: string; label: string }[];
};

/** Huecos agrupados por día y con la hora en la zona de quien mira (es-ES, 24 h). */
export function groupSlotsByDay(starts: string[], timeZone: string): DaySlots[] {
  const days = new Map<string, DaySlots>();
  for (const iso of starts) {
    const d = new Date(iso);
    const key = dateKeyInTz(d, timeZone);
    let day = days.get(key);
    if (!day) {
      const ref = zonedTimeToUtc(key, 12 * 60, timeZone);
      day = {
        date: key,
        weekday: formatInTz(ref, timeZone, { weekday: "short" }).replace(".", ""),
        day: formatInTz(ref, timeZone, { day: "numeric" }),
        month: formatInTz(ref, timeZone, { month: "short" }).replace(".", ""),
        slots: [],
      };
      days.set(key, day);
    }
    day.slots.push({ start: iso, label: formatInTz(d, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) });
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
