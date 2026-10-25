import "server-only";
import { tzCity } from "./timezones";
import { astroByDay, dayRangeUtc, monthGrid, type AstroDay, type YearMonth } from "./owner-calendar";
import { tenantDb } from "./tenant";
import { dateKeyInTz, minutesToLabel, timeInTz } from "./tz";

/**
 * Calendario de Reservas (panel de la dueña): lo de cada día del mes (sesiones, talleres, días y horas
 * bloqueados, fechas especiales, su nota del diario y el cielo) y el guardado de las notas. Todo por
 * tenantDb: es privado de la dueña.
 */

export const NOTE_MAX = 20_000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** «2026-02-30» no es un día. */
export function isDateKey(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_KEY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Guarda la nota de un día; vacía la borra. */
export async function saveDayNote(creatorId: string, date: unknown, body: unknown): Promise<{ ok: true; savedAt: Date | null } | { ok: false; error: string }> {
  if (!isDateKey(date)) return { ok: false, error: "Día no válido" };
  const text = typeof body === "string" ? body.replace(/\r\n/g, "\n").trimEnd() : "";
  if (text.length > NOTE_MAX) return { ok: false, error: `La nota es demasiado larga (máx. ${NOTE_MAX.toLocaleString("es-ES")} caracteres)` };
  const db = tenantDb(creatorId);
  if (!text.trim()) {
    await db.calendarNote.deleteMany({ where: { date } });
    return { ok: true, savedAt: null };
  }
  const n = await db.calendarNote.upsert({
    where: { creatorId_date: { creatorId, date } },
    create: { creatorId, date, body: text, format: "MD" },
    update: { body: text, format: "MD" },
  });
  return { ok: true, savedAt: n.updatedAt };
}

export type DayBooking = { id: string; time: string; client: string; product: string; status: string };
export type DayWorkshop = { productId: string; title: string; time: string; seats: number; capacity: number | null };
export type DayData = {
  key: string;
  inMonth: boolean;
  bookings: DayBooking[];
  workshops: DayWorkshop[];
  /** Día entero bloqueado (BlockedDate). */
  blocked: { reason: string | null } | null;
  /** Horas bloqueadas: «11:00–12:00 · Médico». */
  blockedHours: string[];
  /** Fecha especial: «9:00–13:00 (hora de Bali) · Bali». */
  special: string[];
  note: { body: string; updatedAt: string } | null;
  astro: AstroDay;
};

export type CalendarMonth = {
  month: YearMonth;
  days: DayData[];
};

const hours = (a: number, b: number) => `${minutesToLabel(a)}–${b === 1440 ? "24:00" : minutesToLabel(b)}`;

/** Todo lo de la rejilla del mes (con los días de los meses vecinos que completan las semanas). */
export async function loadCalendarMonth(creator: { id: string; timezone: string }, month: YearMonth): Promise<CalendarMonth> {
  const tz = creator.timezone;
  const keys = monthGrid(month);
  const { from, to } = dayRangeUtc(keys[0], keys[keys.length - 1], tz);
  const db = tenantDb(creator.id);
  const [bookings, workshops, blocked, overrides, notes] = await Promise.all([
    db.booking.findMany({
      where: { groupSeat: false, status: { in: ["CONFIRMED", "COMPLETED"] }, startAt: { gte: from, lt: to } },
      orderBy: { startAt: "asc" },
      select: { id: true, startAt: true, status: true, customer: { select: { name: true, email: true } }, product: { select: { title: true } } },
    }),
    db.product.findMany({
      where: { groupSession: true, status: { not: "ARCHIVED" }, eventStartAt: { gte: from, lt: to } },
      orderBy: { eventStartAt: "asc" },
      select: { id: true, title: true, eventStartAt: true, capacity: true, _count: { select: { bookings: { where: { groupSeat: true, status: { in: ["CONFIRMED", "COMPLETED"] } } } } } },
    }),
    db.blockedDate.findMany({ where: { date: { gte: keys[0], lte: keys[keys.length - 1] } } }),
    db.availabilityOverride.findMany({ where: { date: { gte: keys[0], lte: keys[keys.length - 1] } }, orderBy: { startMinute: "asc" } }),
    db.calendarNote.findMany({ where: { date: { gte: keys[0], lte: keys[keys.length - 1] } } }),
  ]);
  const astro = astroByDay(keys, tz);
  const prefix = `${month.year}-${String(month.month).padStart(2, "0")}`;
  const days = new Map<string, DayData>(
    keys.map((key) => [key, { key, inMonth: key.startsWith(prefix), bookings: [], workshops: [], blocked: null, blockedHours: [], special: [], note: null, astro: astro.get(key)! }]),
  );
  for (const b of bookings) {
    const d = days.get(dateKeyInTz(b.startAt!, tz));
    d?.bookings.push({ id: b.id, time: timeInTz(b.startAt!, tz), client: b.customer.name ?? b.customer.email, product: b.product.title, status: b.status });
  }
  for (const w of workshops) {
    const d = days.get(dateKeyInTz(w.eventStartAt!, tz));
    d?.workshops.push({ productId: w.id, title: w.title, time: timeInTz(w.eventStartAt!, tz), seats: w._count.bookings, capacity: w.capacity });
  }
  for (const b of blocked) {
    const d = days.get(b.date);
    if (d) d.blocked = { reason: b.reason };
  }
  for (const o of overrides) {
    const d = days.get(o.date);
    if (!d) continue;
    const where = o.timezone !== tz ? ` (hora de ${tzCity(o.timezone)})` : "";
    const text = `${hours(o.startMinute, o.endMinute)}${where}${o.note ? ` · ${o.note}` : ""}`;
    (o.kind === "BLOCK" ? d.blockedHours : d.special).push(text);
  }
  for (const n of notes) {
    const d = days.get(n.date);
    if (d) d.note = { body: n.body, updatedAt: n.updatedAt.toISOString() };
  }
  return { month, days: [...days.values()] };
}
