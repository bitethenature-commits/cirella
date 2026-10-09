"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { cancelBooking, requestReschedule } from "@/lib/booking-changes";
import { prisma } from "@/lib/db";
import { refundableCents } from "@/lib/refund-math";
import { refundOrder } from "@/lib/refunds";
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

/** Marca como realizada una sesión confirmada. Cancelar y cambiar de fecha van por changeBooking. */
export async function setBookingStatus(form: FormData) {
  const { creator } = await requireCreator();
  const id = String(form.get("id"));
  const status = z.enum(["COMPLETED"]).parse(form.get("status"));
  await tenantDb(creator.id).booking.updateMany({ where: { id, status: "CONFIRMED" }, data: { status } });
  revalidatePath("/panel/reservas");
}

export type ChangeState = { error?: string } | undefined;

const changeSchema = z.object({
  id: z.string().min(1),
  intent: z.enum(["reschedule", "cancel_refund", "cancel_only"]),
  note: z.string().trim().max(500, "El mensaje es demasiado largo (máx. 500 caracteres)").optional(),
  reason: z.string().trim().max(500, "El motivo es demasiado largo (máx. 500 caracteres)").optional(),
});

/**
 * «Cambiar o cancelar» una sesión (/panel/reservas/[id]):
 *   · reschedule: libera el hueco y la clienta elige otra fecha (el pago se mantiene);
 *   · cancel_refund: cancela y devuelve todo lo que queda del pago;
 *   · cancel_only: cancela sin devolver, con un motivo que verá la clienta.
 */
export async function changeBooking(_: ChangeState, form: FormData): Promise<ChangeState> {
  const { user, creator } = await requireCreator();
  const parsed = changeSchema.safeParse({
    id: form.get("id"),
    intent: form.get("intent"),
    note: form.get("note") ?? undefined,
    reason: form.get("reason") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  const { id, intent } = parsed.data;
  const note = parsed.data.note || null;
  const db = tenantDb(creator.id);
  const booking = await db.booking.findFirst({ where: { id }, include: { order: { include: { refunds: { select: { status: true, amountCents: true } } } } } });
  if (!booking) return { error: "Reserva no encontrada" };

  let ok: string;
  if (intent === "reschedule") {
    const r = await requestReschedule({ creatorId: creator.id, bookingId: id, note });
    if (!r.ok) return { error: r.error };
    ok = "propuesta";
  } else if (intent === "cancel_refund") {
    const o = booking.order;
    const reserved = o?.refunds.filter((r) => r.status !== "FAILED").reduce((a, r) => a + r.amountCents, 0) ?? 0;
    if (!o || o.status !== "PAID" || !o.paymentRef || refundableCents({ amountCents: o.amountCents, reservedCents: reserved }) <= 0)
      return { error: "Esta sesión no tiene un pago que reembolsar. Usa «Cancelar sin reembolso»." };
    if (booking.status !== "CONFIRMED" && booking.status !== "PENDING_SCHEDULE") return { error: "Esta sesión ya no se puede cancelar" };
    const r = await refundOrder({
      orderId: o.id,
      actor: { kind: "creator", creatorId: creator.id, userId: user.id },
      reason: "SESSION_CANCELLED",
      note,
      revokeAccess: true,
      cancelBooking: true,
    });
    if (!r.ok) return { error: r.error };
    ok = r.status === "SUCCEEDED" ? "reembolsada" : "reembolso_en_curso";
  } else {
    const reason = parsed.data.reason ?? "";
    if (reason.length < 5) return { error: "Explica el motivo: lo verá tu clienta" };
    const r = await cancelBooking({ creatorId: creator.id, bookingId: id, by: "CREATOR", reason, notify: true });
    if (!r.ok) return { error: r.error };
    ok = "cancelada";
  }
  revalidatePath("/panel/reservas");
  revalidatePath("/panel/ventas");
  redirect(`/panel/reservas?ok=${ok}`);
}
