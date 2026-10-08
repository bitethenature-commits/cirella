"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, requireUser, revokeOtherSessions, sendMagicLink } from "@/lib/auth";
import { emit } from "@/lib/automations";
import { hasBookingClash, isSlotAvailable } from "@/lib/booking";
import { hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { syncBookingToCalendar } from "@/lib/orders";
import { cancelSubscription, resumeSubscription } from "@/lib/subscriptions";

export async function toggleLessonComplete(lessonId: string, complete: boolean) {
  const user = await requireUser();
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || !(await hasAccess(user.id, lesson.productId))) return { ok: false };
  if (complete)
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: { userId: user.id, lessonId, productId: lesson.productId, creatorId: lesson.creatorId },
      update: {},
    });
  else await prisma.lessonProgress.deleteMany({ where: { userId: user.id, lessonId } });
  revalidatePath(`/cuenta/cursos/${lesson.productId}`);
  return { ok: true };
}

export async function scheduleBooking(bookingId: string, slotStart: string) {
  const user = await requireUser();
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId: user.id }, include: { product: true } });
  if (!booking) return { ok: false as const, error: "Reserva no encontrada" };
  const canReschedule = booking.status === "PENDING_SCHEDULE" || (booking.status === "CONFIRMED" && booking.startAt && booking.startAt.getTime() - Date.now() > 24 * 3600_000);
  if (!canReschedule) return { ok: false as const, error: "Esta reserva ya no se puede cambiar. Escribe a la creadora." };
  if (!z.string().datetime().safeParse(slotStart).success || !(await isSlotAvailable(booking.product, slotStart)))
    return { ok: false as const, error: "Ese horario ya no está disponible" };
  const start = new Date(slotStart);
  const end = new Date(start.getTime() + (booking.product.durationMin ?? 60) * 60000);
  const taken = await prisma.$transaction(async (tx) => {
    if (await hasBookingClash(tx, booking.creatorId, start, end, booking.product.bufferMin ?? 15, booking.id)) return true;
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", startAt: start, endAt: end, externalEventId: null } });
    return false;
  });
  if (taken) return { ok: false as const, error: "Ese horario acaba de ocuparse. Elige otro, por favor." };
  // Si cambia de fecha, los recordatorios antiguos se cancelan y las confirmaciones previas
  // liberan su clave, para que volver a una hora anterior genere avisos nuevos.
  await prisma.emailMessage.updateMany({
    where: { template: "SESSION_REMINDER", status: "QUEUED", dedupeKey: { startsWith: `reminder:${booking.id}:` } },
    data: { status: "CANCELED", dedupeKey: null },
  });
  await prisma.emailMessage.updateMany({ where: { dedupeKey: { startsWith: `booking:${booking.id}:` } }, data: { dedupeKey: null } });
  await syncBookingToCalendar(booking.id);
  await emit({ type: "booking.confirmed", bookingId: booking.id });
  revalidatePath(`/cuenta/sesiones/${booking.id}`);
  return { ok: true as const };
}

export async function cancelMembership(form: FormData) {
  const user = await requireUser();
  await cancelSubscription(String(form.get("subscriptionId")), user.id);
  revalidatePath("/cuenta", "layout");
}

export async function resumeMembership(form: FormData) {
  const user = await requireUser();
  await resumeSubscription(String(form.get("subscriptionId")), user.id);
  revalidatePath("/cuenta", "layout");
}

export type ProfileState = { ok?: string; error?: string } | undefined;

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const password = String(form.get("password") ?? "");
  if (!name) return { error: "Escribe tu nombre" };
  if (password && password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  if (password && !user.sessionVerified) {
    // Sesión creada en un checkout: antes de fijar contraseña hay que demostrar que el email es suyo.
    await sendMagicLink(user.email, "/cuenta/perfil");
    return { error: "Para crear tu contraseña, entra con el enlace que acabamos de enviarte por email." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { name, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
  if (password) await revokeOtherSessions(user.id);
  await prisma.customer.updateMany({ where: { userId: user.id }, data: { name } });
  revalidatePath("/cuenta", "layout");
  return { ok: password ? "Perfil y contraseña actualizados" : "Perfil actualizado" };
}
