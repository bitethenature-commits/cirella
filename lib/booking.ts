import type { Prisma, Product } from "@prisma/client";
import { prisma } from "./db";
import { getBusyIntervals } from "./calendar";
import { addDaysToKey, dateKeyInTz, formatInTz, weekdayOfKey, zonedTimeToUtc } from "./tz";

export type DaySlots = {
  date: string; // YYYY-MM-DD (zona de la creadora)
  weekday: string; // "lun"
  day: string; // "12"
  month: string; // "oct"
  slots: { start: string; label: string }[];
};

type SessionProduct = Pick<Product, "id" | "creatorId" | "durationMin" | "bufferMin" | "minNoticeHours">;

/** Cliente con el que se leen los huecos: `prisma` o el de una transacción. */
type SlotsClient = Pick<Prisma.TransactionClient, "creator" | "availabilityRule" | "blockedDate" | "booking">;

export const SESSION_DEFAULTS = { durationMin: 60, bufferMin: 15, minNoticeHours: 24 };

/**
 * Huecos disponibles para una sesión: reglas semanales de la creadora
 * − días bloqueados − anticipación mínima − reservas existentes (± margen)
 * − ocupado en calendario externo.
 */
export async function getAvailableSlots(product: SessionProduct, opts: { days?: number; now?: Date; client?: SlotsClient } = {}) {
  const days = opts.days ?? 28;
  const now = opts.now ?? new Date();
  const db = opts.client ?? prisma;
  const creator = await db.creator.findUniqueOrThrow({
    where: { id: product.creatorId },
    select: { timezone: true, calendarProvider: true, calendarAccountId: true },
  });
  const tz = creator.timezone;
  const duration = product.durationMin ?? SESSION_DEFAULTS.durationMin;
  const buffer = product.bufferMin ?? SESSION_DEFAULTS.bufferMin;
  const notice = product.minNoticeHours ?? SESSION_DEFAULTS.minNoticeHours;
  const earliest = new Date(now.getTime() + notice * 3600_000);
  const horizon = new Date(now.getTime() + (days + 1) * 86400_000);

  const [rules, blocked, bookings, external] = await Promise.all([
    db.availabilityRule.findMany({ where: { creatorId: product.creatorId } }),
    db.blockedDate.findMany({ where: { creatorId: product.creatorId } }),
    db.booking.findMany({
      where: { creatorId: product.creatorId, status: "CONFIRMED", startAt: { gte: new Date(now.getTime() - 86400_000), lte: horizon } },
      select: { startAt: true, endAt: true },
    }),
    getBusyIntervals(creator, now, horizon),
  ]);
  const blockedSet = new Set(blocked.map((b) => b.date));
  const busy = [
    ...bookings.filter((b) => b.startAt && b.endAt).map((b) => ({ start: b.startAt!.getTime(), end: b.endAt!.getTime() })),
    ...external.map((e) => ({ start: e.start.getTime(), end: e.end.getTime() })),
  ];

  const out: DaySlots[] = [];
  const todayKey = dateKeyInTz(now, tz);
  for (let i = 0; i <= days; i++) {
    const key = addDaysToKey(todayKey, i);
    if (blockedSet.has(key)) continue;
    const wd = weekdayOfKey(key);
    const dayRules = rules.filter((r) => r.weekday === wd).sort((a, b) => a.startMinute - b.startMinute);
    const slots: DaySlots["slots"] = [];
    for (const r of dayRules) {
      for (let t = r.startMinute; t + duration <= r.endMinute; t += duration + buffer) {
        const start = zonedTimeToUtc(key, t, tz);
        const end = new Date(start.getTime() + duration * 60000);
        if (start < earliest) continue;
        const clash = busy.some((b) => start.getTime() < b.end + buffer * 60000 && end.getTime() + buffer * 60000 > b.start);
        if (clash) continue;
        slots.push({ start: start.toISOString(), label: formatInTz(start, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) });
      }
    }
    if (slots.length) {
      const ref = zonedTimeToUtc(key, 12 * 60, tz);
      out.push({
        date: key,
        weekday: formatInTz(ref, tz, { weekday: "short" }).replace(".", ""),
        day: formatInTz(ref, tz, { day: "numeric" }),
        month: formatInTz(ref, tz, { month: "short" }).replace(".", ""),
        slots,
      });
    }
  }
  return { timezone: tz, durationMin: duration, days: out };
}

type BookingClient = Pick<Prisma.TransactionClient, "booking" | "$executeRaw">;

/**
 * Cerrojo de reservas de una creadora: dura hasta el final de la transacción en curso,
 * así que dos compras o reprogramaciones simultáneas de la misma creadora se comprueban
 * y se escriben una detrás de otra. Las de creadoras distintas no se esperan entre sí.
 * Tomarlo dos veces en la misma transacción no bloquea (es reentrante).
 */
export async function lockCreatorBookings(client: Pick<Prisma.TransactionClient, "$executeRaw">, creatorId: string) {
  // $executeRaw y no $queryRaw: pg_advisory_xact_lock devuelve void, que $queryRaw no sabe leer.
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking:${creatorId}`}, 0))`;
}

/**
 * ¿Choca [start, end) (± margen) con otra reserva confirmada de la creadora?
 *
 * Toma el cerrojo de reservas de la creadora (lockCreatorBookings), que dura hasta el final
 * de la transacción: dos compras o reprogramaciones simultáneas se comprueban una detrás de
 * otra. Llamar siempre dentro de prisma.$transaction y antes de escribir la reserva.
 */
export async function hasBookingClash(
  client: BookingClient,
  creatorId: string,
  start: Date,
  end: Date,
  bufferMin: number,
  excludeBookingId?: string,
) {
  await lockCreatorBookings(client, creatorId);
  const buf = bufferMin * 60000;
  const clash = await client.booking.findFirst({
    where: {
      creatorId,
      status: "CONFIRMED",
      startAt: { lt: new Date(end.getTime() + buf) },
      endAt: { gt: new Date(start.getTime() - buf) },
      ...(excludeBookingId ? { NOT: { id: excludeBookingId } } : {}),
    },
    select: { id: true },
  });
  return !!clash;
}

/** ¿Sigue ofreciéndose ese hueco? Con `client` = la transacción, se lee bajo su cerrojo. */
export async function isSlotAvailable(product: SessionProduct, startIso: string, opts: { client?: SlotsClient } = {}) {
  const { days } = await getAvailableSlots(product, { client: opts.client });
  return days.some((d) => d.slots.some((s) => s.start === startIso));
}

/**
 * ¿El error viene de la regla Booking_no_overlap de la base de datos? Es la última red de
 * seguridad (dos reservas CONFIRMED solapadas de la misma creadora): si salta, la transacción
 * ya está anulada y quien llama decide qué hacer (p. ej. dejar la reserva pendiente de fecha).
 */
export function isBookingOverlapError(e: unknown) {
  return e instanceof Error && /23P01|Booking_no_overlap/.test(e.message);
}
