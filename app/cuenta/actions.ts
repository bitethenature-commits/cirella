"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { scopeAllows } from "@/lib/auth-utils";
import { emit } from "@/lib/automations";
import { hasBookingClash, isBookingOverlapError, isSlotAvailable, slotRuleForOrder } from "@/lib/booking";
import { notifyRescheduled, releaseBookingEmails } from "@/lib/booking-changes";
import { getBuyerSession, requireBuyerFor, requireBuyerFull } from "@/lib/buyer-access";
import { hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { scopeCoversProduct } from "@/lib/membership-access";
import { syncBookingToCalendar } from "@/lib/orders";
import { cancelSubscription, resumeSubscription } from "@/lib/subscriptions";
import { SESSION_CHANGE_NOTICE_HOURS } from "@/lib/legal";
import { canonicalTimezone } from "@/lib/timezones";
import { Prisma } from "@prisma/client";
import { asksIntake, parseIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { intakeLocked } from "@/lib/intake-lock";

export async function toggleLessonComplete(lessonId: string, complete: boolean) {
  const b = await getBuyerSession();
  if (!b) return { ok: false };
  const user = b.user;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || !(await hasAccess(user.id, lesson.productId))) return { ok: false };
  // Una sesión limitada solo avanza el curso de su pedido; una de cuenta, si está verificada.
  // (o un curso incluido en la membresía de su pedido).
  if (b.scope ? !(scopeAllows(b.scope, { productId: lesson.productId }) || (await scopeCoversProduct(b.scope, lesson.productId))) : !b.verified) return { ok: false };
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

export async function scheduleBooking(bookingId: string, slotStart: string, clientTz?: string | null) {
  // Elegir hora es justo lo que hace quien acaba de comprar: vale la sesión limitada a su pedido.
  const { user } = await requireBuyerFor({ bookingId }, `/cuenta/sesiones/${bookingId}`);
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId: user.id },
    include: { product: true, order: { select: { paymentProvider: true, paidAt: true, createdAt: true } } },
  });
  if (!booking) return { ok: false as const, error: "Reserva no encontrada" };
  if (booking.groupSeat) return { ok: false as const, error: "Es una plaza de un taller con fecha fija. Escribe a la creadora." };
  const canReschedule = booking.status === "PENDING_SCHEDULE" || (booking.status === "CONFIRMED" && booking.startAt && booking.startAt.getTime() - Date.now() > SESSION_CHANGE_NOTICE_HOURS * 3600_000);
  if (!canReschedule) return { ok: false as const, error: "Esta reserva ya no se puede cambiar. Escribe a la creadora." };
  // Sesión pagada en la web: nada antes del día 15 desde el pago de su pedido (lib/withdrawal.ts),
  // también al cambiarla o al elegir tras una propuesta de la dueña. Dada a mano: sin esa regla.
  if (!z.string().datetime().safeParse(slotStart).success || !(await isSlotAvailable(booking.product, slotStart, slotRuleForOrder(booking.order))))
    return { ok: false as const, error: "Ese horario ya no está disponible" };
  const tz = canonicalTimezone(clientTz);
  const start = new Date(slotStart);
  const end = new Date(start.getTime() + (booking.product.durationMin ?? 60) * 60000);
  const outcome = await prisma
    .$transaction(async (tx) => {
      if (await hasBookingClash(tx, booking.creatorId, start, end, booking.product.bufferMin ?? 15, booking.id)) return "taken" as const;
      // Condicionado al estado leído: si la creadora la acaba de cancelar, no se resucita.
      const c = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: {
          status: "CONFIRMED",
          startAt: start,
          endAt: end,
          externalEventId: null,
          // La fecha que deja (para el aviso a la dueña «antes …»).
          ...(booking.status === "CONFIRMED" && booking.startAt ? { previousStartAt: booking.startAt } : {}),
          ...(tz ? { customerTimezone: tz } : {}),
        },
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
  const change = booking.rescheduleRequestedAt ? "proposal_answered" : booking.status === "CONFIRMED" ? "rescheduled" : "scheduled";
  await emit({ type: "booking.confirmed", bookingId: booking.id, change });
  // Si la creadora había propuesto otra fecha, le avisamos de la que ha elegido.
  await notifyRescheduled(booking.id);
  revalidatePath(`/cuenta/sesiones/${booking.id}`);
  return { ok: true as const };
}

export type IntakeSaveState = { ok?: string; error?: string; field?: string } | undefined;

/**
 * La clienta completa o corrige sus datos para la lectura desde su área, hasta que empieza la sesión o
 * hasta que recibe la lectura. La dueña recibe un aviso (agrupado si corrige varias veces seguidas).
 */
export async function saveIntake(_: IntakeSaveState, form: FormData): Promise<IntakeSaveState> {
  const orderId = String(form.get("orderId") ?? "");
  const { user } = await requireBuyerFor({ orderId }, `/cuenta/pedidos/${orderId}`);
  const order = await prisma.order.findFirst({
    where: { id: orderId, customer: { userId: user.id } },
    include: { product: { select: { intake: true, type: true, deliveryMode: true } }, bookings: { select: { startAt: true, groupSeat: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order || order.status !== "PAID") return { error: "Esta compra no está disponible" };
  if (intakeLocked(order)) return { error: "Ya no se pueden cambiar. Si algo no está bien, escribe a la creadora." };
  const cfg = readIntakeConfig(order.product.intake);
  if (!asksIntake(order.product.type, order.product.deliveryMode, cfg)) return { error: "Esta compra no pide datos" };
  const parsed = parseIntakeAnswers(cfg, Object.fromEntries(form));
  if (!parsed.ok) return { error: parsed.error, field: parsed.field };
  const first = !order.intake;
  await prisma.order.update({
    where: { id: order.id },
    data: { intake: parsed.value ? (parsed.value as unknown as Prisma.InputJsonObject) : Prisma.DbNull, intakeUpdatedAt: new Date() },
  });
  await emit({ type: "intake.updated", orderId: order.id, first });
  revalidatePath("/cuenta", "layout");
  return { ok: "Datos guardados. Se los hemos enviado." };
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
  // Sesión verificada (como todo el perfil). La contraseña, la foto y el email tienen su propia
  // tarjeta (app/cuenta/perfil/actions.ts).
  const user = await requireBuyerFull("/cuenta/perfil");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Escribe tu nombre" };
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  await prisma.customer.updateMany({ where: { userId: user.id }, data: { name } });
  revalidatePath("/cuenta", "layout");
  return { ok: "Perfil actualizado" };
}
