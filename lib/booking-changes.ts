import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import { bookingCancelledEmail, rescheduledCreatorEmail, rescheduleProposalEmail } from "./email/refund-templates";
import { emit, recordEvents } from "./events";
import { createOrderLink } from "./order-links";
import { ownerWhen, sessionWhen } from "./tz";

/**
 * Cambios de una reserva después de pagarla: cancelarla (la creadora, la clienta al desistir o el
 * sistema al reembolsar), proponer otra fecha y avisar cuando la clienta elige la nueva.
 *
 * Todas las operaciones filtran por creatorId (aislamiento entre creadoras) y son UPDATE
 * condicionales: un doble toque o dos pestañas no cancelan ni avisan dos veces.
 *
 * Calendario: sin Google Calendar (la web personal trabaja con Zoom y avisos por email; lib/calendar.ts
 * está dormido). Si algún día lo hay, cancelar y proponer otra fecha tendrán que borrar el evento
 * (externalEventId).
 */

type Client = Prisma.TransactionClient | typeof prisma;

export type BookingCanceller = "CREATOR" | "CUSTOMER" | "SYSTEM";

/**
 * Libera los emails de una reserva que cambia: los recordatorios pendientes se cancelan y las
 * confirmaciones sueltan su clave, para que una fecha nueva (o volver a la anterior) avise de nuevo.
 */
export async function releaseBookingEmails(bookingId: string, client: Client = prisma) {
  await client.emailMessage.updateMany({
    where: { template: "SESSION_REMINDER", status: "QUEUED", dedupeKey: { startsWith: `reminder:${bookingId}:` } },
    data: { status: "CANCELED", dedupeKey: null },
  });
  await client.emailMessage.updateMany({ where: { dedupeKey: { startsWith: `booking:${bookingId}:` } }, data: { dedupeKey: null } });
  await client.emailMessage.updateMany({ where: { dedupeKey: { startsWith: `owner-booking:${bookingId}:` } }, data: { dedupeKey: null } });
}

/**
 * Cancela los recordatorios pendientes de una reserva (también el segundo, «:soon»), p. ej. porque
 * cambió el enlace de la videollamada y hay que volver a programarlos con el nuevo.
 */
export async function cancelQueuedReminders(bookingId: string, client: Client = prisma) {
  await client.emailMessage.updateMany({
    where: { template: "SESSION_REMINDER", status: "QUEUED", dedupeKey: { startsWith: `reminder:${bookingId}:` } },
    data: { status: "CANCELED", dedupeKey: null },
  });
}

/**
 * Enlace de la videollamada de UNA reserva (vacío = el de la sesión). Con `notify`, si la sesión está
 * confirmada y todavía no ha empezado, la clienta recibe «Nuevo enlace» y los recordatorios se rehacen.
 */
export async function setBookingMeetingUrl(i: { creatorId: string; bookingId: string; url: string | null; notify: boolean }): Promise<{ ok: true; notified: boolean } | { ok: false; error: string }> {
  const b = await prisma.booking.findFirst({ where: { id: i.bookingId, creatorId: i.creatorId }, include: { product: { select: { meetingUrl: true } } } });
  if (!b) return { ok: false, error: "Reserva no encontrada" };
  const url = i.url ?? b.product.meetingUrl ?? null;
  await prisma.booking.updateMany({ where: { id: b.id, creatorId: i.creatorId }, data: { meetingUrl: url } });
  const live = b.status === "CONFIRMED" && !!b.startAt && b.startAt > new Date();
  if (live && url !== b.meetingUrl) {
    if (i.notify) await emit({ type: "booking.updated", bookingId: b.id, what: "meeting_url" });
    else {
      // Sin aviso, los recordatorios igualmente deben llevar el enlace bueno.
      await cancelQueuedReminders(b.id);
      const { scheduleSessionReminders } = await import("./automations");
      await scheduleSessionReminders(b.id);
    }
  }
  return { ok: true, notified: live && i.notify && url !== b.meetingUrl };
}

/**
 * La dueña cambia el enlace de una sesión: las reservas futuras que usaban el anterior (o ninguno)
 * pasan al nuevo y las confirmadas reciben «Nuevo enlace». Las que tienen un enlace propio no se tocan.
 */
export async function applyProductMeetingUrl(i: { creatorId: string; productId: string; previous: string | null; next: string | null }) {
  if (i.previous === i.next) return 0;
  const now = new Date();
  const rows = await prisma.booking.findMany({
    where: {
      creatorId: i.creatorId,
      productId: i.productId,
      OR: [{ status: "PENDING_SCHEDULE" }, { status: "CONFIRMED", startAt: { gt: now } }],
      AND: [{ OR: [{ meetingUrl: null }, ...(i.previous ? [{ meetingUrl: i.previous }] : [])] }],
    },
    select: { id: true, status: true },
  });
  if (!rows.length) return 0;
  await prisma.booking.updateMany({ where: { id: { in: rows.map((r) => r.id) }, creatorId: i.creatorId }, data: { meetingUrl: i.next } });
  const confirmed = rows.filter((r) => r.status === "CONFIRMED");
  for (const r of confirmed) await emit({ type: "booking.updated", bookingId: r.id, what: "meeting_url" });
  return confirmed.length;
}

/**
 * Cancela una reserva confirmada o pendiente de fecha y libera el hueco (solo las CONFIRMED
 * ocupan agenda). Con `tx` se ejecuta dentro de la transacción de quien llama (reembolsos):
 * devuelve los eventos para despacharlos tras el commit y no avisa a la clienta (lo hace quien
 * llama, con el importe devuelto). Sin `tx`, despacha ya y avisa si `notify`.
 */
export async function cancelBooking(
  i: { creatorId: string; bookingId: string; by: BookingCanceller; reason: string | null; notify: boolean },
  tx?: Prisma.TransactionClient,
): Promise<{ ok: true; eventIds: string[] } | { ok: false; error: string }> {
  const client = tx ?? prisma;
  const reason = i.reason?.trim().slice(0, 500) || null;
  const c = await client.booking.updateMany({
    where: { id: i.bookingId, creatorId: i.creatorId, status: { in: ["CONFIRMED", "PENDING_SCHEDULE"] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: i.by, cancelReason: reason, rescheduleRequestedAt: null },
  });
  if (!c.count) return { ok: false, error: "Esta sesión ya no se puede cancelar" };
  await releaseBookingEmails(i.bookingId, client);
  if (i.notify && !tx) {
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: i.bookingId }, include: { product: true, customer: true, creator: true } });
    await enqueueEmail({
      to: b.customer.email,
      userId: b.userId,
      creatorId: b.creatorId,
      template: "BOOKING_CANCELLED",
      dedupeKey: `booking-cancel:${b.id}`,
      ...bookingCancelledEmail({
        creatorName: b.creator.displayName,
        productTitle: b.product.title,
        when: b.startAt ? sessionWhen(b.startAt, b.customerTimezone, b.creator.timezone) : null,
        reason,
        refundAmount: null,
        url: `${appUrl()}/cuenta/compras`,
      }),
    });
  }
  const event = { type: "booking.cancelled" as const, bookingId: i.bookingId };
  if (tx) return { ok: true, eventIds: await recordEvents(tx, [event]) };
  await emit(event);
  return { ok: true, eventIds: [] };
}

/**
 * La creadora propone otra fecha: libera el hueco, la reserva vuelve a «pendiente de fecha» (el
 * pago se mantiene) y la clienta recibe un enlace para elegir otro día de la agenda.
 */
export async function requestReschedule(i: { creatorId: string; bookingId: string; note: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  const b = await prisma.booking.findFirst({ where: { id: i.bookingId, creatorId: i.creatorId }, include: { product: true, customer: true, creator: true } });
  if (!b || b.status !== "CONFIRMED" || !b.startAt) return { ok: false, error: "Esta sesión ya no se puede cambiar" };
  if (b.groupSeat) return { ok: false, error: "Es una plaza de un taller con fecha fija" };
  const now = new Date();
  const note = i.note?.trim().slice(0, 500) || null;
  // Condicionado a la fecha leída: si la clienta la cambia a la vez, no se pisa su elección.
  const c = await prisma.booking.updateMany({
    where: { id: b.id, creatorId: i.creatorId, status: "CONFIRMED", startAt: b.startAt },
    data: {
      status: "PENDING_SCHEDULE",
      previousStartAt: b.startAt,
      startAt: null,
      endAt: null,
      externalEventId: null,
      rescheduleRequestedAt: now,
      rescheduleNote: note,
    },
  });
  if (!c.count) return { ok: false, error: "Esta sesión ya no se puede cambiar" };
  await releaseBookingEmails(b.id);
  await enqueueEmail({
    to: b.customer.email,
    userId: b.userId,
    creatorId: b.creatorId,
    template: "BOOKING_RESCHEDULE",
    dedupeKey: `reschedule:${b.id}:${now.toISOString()}`,
    ...rescheduleProposalEmail({
      creatorName: b.creator.displayName,
      productTitle: b.product.title,
      previousWhen: sessionWhen(b.startAt, b.customerTimezone, b.creator.timezone),
      note,
      // Enlace personal (solo abre este pedido) para que pueda elegir sin contraseña.
      url: b.orderId ? (await createOrderLink({ orderId: b.orderId, path: `/cuenta/sesiones/${b.id}` })).url : `${appUrl()}/cuenta/sesiones/${b.id}`,
    }),
  });
  await emit({ type: "booking.reschedule_requested", bookingId: b.id });
  return { ok: true };
}

/** La clienta ha elegido fecha tras una propuesta de la creadora: se avisa a la creadora. */
export async function notifyRescheduled(bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { product: true, customer: true, creator: { include: { user: true } } } });
  if (!b?.rescheduleRequestedAt || b.status !== "CONFIRMED" || !b.startAt) return;
  const c = await prisma.booking.updateMany({
    where: { id: b.id, rescheduleRequestedAt: b.rescheduleRequestedAt },
    data: { rescheduleRequestedAt: null, rescheduleNote: null },
  });
  if (!c.count) return;
  await enqueueEmail({
    to: b.creator.contactEmail || b.creator.user.email,
    userId: b.creator.userId,
    creatorId: b.creatorId,
    template: "BOOKING_RESCHEDULED",
    dedupeKey: `rescheduled:${b.id}:${b.startAt.toISOString()}`,
    ...rescheduledCreatorEmail({
      buyer: b.customer.name || b.customer.email,
      productTitle: b.product.title,
      when: ownerWhen(b.startAt, b.creator.timezone, b.customerTimezone),
      url: `${appUrl()}/panel/reservas/${b.id}`,
    }),
  });
}
