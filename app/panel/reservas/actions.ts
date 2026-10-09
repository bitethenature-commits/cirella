"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { isBookingOverlapError } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant";

const rulesSchema = z.array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1440), endMinute: z.number().int().min(0).max(1440) })).max(50);

export async function saveAvailability(rules: z.infer<typeof rulesSchema>, timezone: string) {
  const { creator } = await requireCreator();
  const parsed = rulesSchema.safeParse(rules);
  if (!parsed.success) return { ok: false, error: "Horario no válido" };
  if (parsed.data.some((r) => r.endMinute - r.startMinute < 15)) return { ok: false, error: "Cada franja debe durar al menos 15 minutos" };
  try {
    new Intl.DateTimeFormat("es", { timeZone: timezone });
  } catch {
    return { ok: false, error: "Zona horaria no válida" };
  }
  const db = tenantDb(creator.id);
  await db.availabilityRule.deleteMany({});
  if (parsed.data.length) await db.availabilityRule.createMany({ data: parsed.data.map((r) => ({ ...r, creatorId: creator.id })) });
  await prisma.creator.update({ where: { id: creator.id }, data: { timezone } });
  revalidatePath("/panel/reservas");
  return { ok: true };
}

export async function addBlockedDate(form: FormData) {
  const { creator } = await requireCreator();
  const date = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const reason = String(form.get("reason") ?? "").slice(0, 80) || null;
  await tenantDb(creator.id).blockedDate.upsert({
    where: { creatorId_date: { creatorId: creator.id, date } },
    create: { creatorId: creator.id, date, reason },
    update: { reason },
  });
  revalidatePath("/panel/reservas");
}

export async function removeBlockedDate(form: FormData) {
  const { creator } = await requireCreator();
  await tenantDb(creator.id).blockedDate.deleteMany({ where: { id: String(form.get("id")) } });
  revalidatePath("/panel/reservas");
}

export async function setBookingStatus(form: FormData) {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const id = String(form.get("id"));
  const status = z.enum(["COMPLETED", "CANCELLED", "CONFIRMED"]).parse(form.get("status"));
  const b = await db.booking.findFirst({ where: { id } });
  if (!b) return;
  try {
    await db.booking.update({ where: { id }, data: { status } });
  } catch (e) {
    // Volver a confirmar una reserva cuyo hueco ya ocupa otra: la regla Booking_no_overlap
    // de la BD lo impide y la reserva se queda como estaba.
    if (isBookingOverlapError(e)) return;
    throw e;
  }
  if (status === "CANCELLED")
    await db.emailMessage.updateMany({ where: { status: "QUEUED", dedupeKey: { startsWith: `reminder:${id}:` } }, data: { status: "CANCELED", dedupeKey: null } });
  revalidatePath("/panel/reservas");
}
