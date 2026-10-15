import { PrismaClient } from "@prisma/client";
import { dateKeyInTz, formatSessionDate } from "../lib/tz";
import { DEMO_TZ, demoSchedule } from "../prisma/demo-dates";
import { DEMO_MARKER_KEY } from "../prisma/seed-guard";

/**
 * Datos de la demo que dependen del día en que se sembró (npm run db:reset). Las fechas se calculan
 * con la misma regla que el seed (prisma/demo-dates.ts) a partir del día que guarda su marca.
 */
export async function demoSeedSchedule() {
  const db = new PrismaClient();
  try {
    const marker = await db.platformSetting.findUniqueOrThrow({ where: { key: DEMO_MARKER_KEY } });
    const v = (marker.value ?? {}) as { today?: string; seededAt?: string };
    const today = v.today ?? dateKeyInTz(new Date(v.seededAt ?? Date.now()), DEMO_TZ);
    const schedule = demoSchedule(today);
    // La reserva sembrada tiene que ser la de la regla (mientras nadie la haya cancelado o movido).
    const b = await db.booking.findFirst({
      where: { customer: { email: "laura@example.com" }, product: { title: "Lectura de Human Design" }, status: "CONFIRMED" },
      orderBy: { createdAt: "asc" },
    });
    if (b?.startAt && b.startAt.getTime() !== schedule.lauraAt.getTime())
      throw new Error(`La sesión sembrada de Laura (${b.startAt.toISOString()}) no sigue la regla de la demo (${schedule.lauraAt.toISOString()})`);
    return schedule;
  } finally {
    await db.$disconnect();
  }
}

/** La sesión de Laura como la escribe su área de cliente: «19 de octubre · 17:00». */
export async function lauraSessionLabel() {
  const { lauraAt } = await demoSeedSchedule();
  return formatSessionDate(lauraAt, DEMO_TZ, false);
}
