"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, revokeOtherSessions } from "@/lib/auth";
import { scopeAllows } from "@/lib/auth-utils";
import { emit } from "@/lib/automations";
import { hasBookingClash, isBookingOverlapError, isSlotAvailable } from "@/lib/booking";
import { notifyRescheduled, releaseBookingEmails } from "@/lib/booking-changes";
import { getBuyerSession, requireBuyerFor, requireBuyerFull } from "@/lib/buyer-access";
import { hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { syncBookingToCalendar } from "@/lib/orders";
import { cancelSubscription, resumeSubscription } from "@/lib/subscriptions";

export async function toggleLessonComplete(lessonId: string, complete: boolean) {
  const b = await getBuyerSession();
  if (!b) return { ok: false };
  const user = b.user;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || !(await hasAccess(user.id, lesson.productId))) return { ok: false };
  // Una sesión limitada solo avanza el curso de su pedido; una de cuenta, si está verificada.
  if (b.scope ? !scopeAllows(b.scope, { productId: lesson.productId }) : !b.verified) return { ok: false };
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
  // Elegir hora es justo lo que hace quien acaba de comprar: vale la sesión limitada a su pedido.
  const { user } = await requireBuyerFor({ bookingId }, `/cuenta/sesiones/${bookingId}`);
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId: user.id }, include: { product: true } });
  if (!booking) return { ok: false as const, error: "Reserva no encontrada" };
  const canReschedule = booking.status === "PENDING_SCHEDULE" || (booking.status === "CONFIRMED" && booking.startAt && booking.startAt.getTime() - Date.now() > 24 * 3600_000);
  if (!canReschedule) return { ok: false as const, error: "Esta reserva ya no se puede cambiar. Escribe a la creadora." };
  if (!z.string().datetime().safeParse(slotStart).success || !(await isSlotAvailable(booking.product, slotStart)))
    return { ok: false as const, error: "Ese horario ya no está disponible" };
  const start = new Date(slotStart);
  const end = new Date(start.getTime() + (booking.product.durationMin ?? 60) * 60000);
  const outcome = await prisma
    .$transaction(async (tx) => {
      if (await hasBookingClash(tx, booking.creatorId, start, end, booking.product.bufferMin ?? 15, booking.id)) return "taken" as const;
      // Condicionado al estado leído: si la creadora la acaba de cancelar, no se resucita.
      const c = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { status: "CONFIRMED", startAt: start, endAt: end, externalEventId: null },
      });
      return c.count ? ("ok" as const) : ("changed" as const);
    })
    // La regla Booking_no_overlap de la BD es la última red de seguridad: mismo mensaje que un choque.
    .catch((e) => {
      if (isBookingOverlapError(e)) return "taken" as const;
      throw e;
    });
  if (outcome === "taken") return { ok: false as const, error: "Ese horario acaba de ocuparse. Elige otro, por favor." };
  if (outcome === "changed") return { ok: false as const, error: "Esta reserva ya no se puede cambiar. Escribe a la creadora." };
  // Si cambia de fecha, los recordatorios antiguos se cancelan y las confirmaciones previas
  // liberan su clave, para que volver a una hora anterior genere avisos nuevos.
  await releaseBookingEmails(booking.id);
  await syncBookingToCalendar(booking.id);
  await emit({ type: "booking.confirmed", bookingId: booking.id });
  // Si la creadora había propuesto otra fecha, le avisamos de la que ha elegido.
  await notifyRescheduled(booking.id);
  revalidatePath(`/cuenta/sesiones/${booking.id}`);
  return { ok: true as const };
}

export async function cancelMembership(form: FormData) {
  const user = await requireBuyerFull("/cuenta/membresias");
  await cancelSubscription(String(form.get("subscriptionId")), user.id);
  revalidatePath("/cuenta", "layout");
}

export async function resumeMembership(form: FormData) {
  const user = await requireBuyerFull("/cuenta/membresias");
  await resumeSubscription(String(form.get("subscriptionId")), user.id);
  revalidatePath("/cuenta", "layout");
}

export type ProfileState = { ok?: string; error?: string } | undefined;

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  // Sesión verificada: fijar o cambiar la contraseña exige haber demostrado que el email es suyo.
  const user = await requireBuyerFull("/cuenta/perfil");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const password = String(form.get("password") ?? "");
  if (!name) return { error: "Escribe tu nombre" };
  if (password && password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  await prisma.user.update({ where: { id: user.id }, data: { name, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
  if (password) await revokeOtherSessions(user.id);
  await prisma.customer.updateMany({ where: { userId: user.id }, data: { name } });
  revalidatePath("/cuenta", "layout");
  return { ok: password ? "Perfil y contraseña actualizados" : "Perfil actualizado" };
}
