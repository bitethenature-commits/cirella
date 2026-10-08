import type { Product } from "@prisma/client";
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

export const SESSION_DEFAULTS = { durationMin: 60, bufferMin: 15, minNoticeHours: 24 };

/**
 * Huecos disponibles para una sesión: reglas semanales de la creadora
 * − días bloqueados − anticipación mínima − reservas existentes (± margen)
 * − ocupado en calendario externo.
 */
export async function getAvailableSlots(product: SessionProduct, opts: { days?: number; now?: Date } = {}) {
  const days = opts.days ?? 28;
  const now = opts.now ?? new Date();
  const creator = await prisma.creator.findUniqueOrThrow({
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
    prisma.availabilityRule.findMany({ where: { creatorId: product.creatorId } }),
    prisma.blockedDate.findMany({ where: { creatorId: product.creatorId } }),
    prisma.booking.findMany({
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

export async function isSlotAvailable(product: SessionProduct, startIso: string) {
  const { days } = await getAvailableSlots(product);
  return days.some((d) => d.slots.some((s) => s.start === startIso));
}
