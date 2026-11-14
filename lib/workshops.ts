import "server-only";
import { prisma } from "./db";
import { lockCreatorBookings, SESSION_DEFAULTS, workshopIntervals } from "./booking";
import { releaseBookingEmails } from "./booking-changes";
import { emit } from "./events";
import { tenantDb } from "./tenant";
import { formatSessionDate } from "./tz";

/**
 * Talleres en directo: una sesión con fecha fija para varias personas (Product.groupSession). Cada
 * plaza es una Booking con groupSeat. La hora del taller ocupa la agenda 1:1 de la dueña (lib/booking.ts).
 */

/** ¿Choca [start, end) con una sesión 1:1 confirmada o con otro taller de la dueña? */
export async function workshopClash(creatorId: string, start: Date, end: Date, excludeProductId?: string): Promise<{ label: string } | null> {
  const tz = (await prisma.creator.findUniqueOrThrow({ where: { id: creatorId }, select: { timezone: true } })).timezone;
  const one = await prisma.booking.findFirst({
    where: { creatorId, status: "CONFIRMED", groupSeat: false, startAt: { lt: end }, endAt: { gt: start } },
    include: { customer: { select: { name: true, email: true } } },
  });
  if (one?.startAt) return { label: `la sesión de ${one.customer.name ?? one.customer.email} del ${formatSessionDate(one.startAt, tz)}` };
  const other = await workshopIntervals(prisma, creatorId, start, end, excludeProductId);
  if (other.some((w) => w.start < end.getTime() && w.end > start.getTime())) return { label: "otro de tus talleres" };
  return null;
}

/**
 * «Cambiar fecha del taller»: mueve el taller y todas sus plazas (bajo el cerrojo de reservas), cancela
 * sus recordatorios y avisa a cada asistente con «Tu taller cambia de fecha». No se mueve encima de
 * una sesión 1:1.
 */
export async function moveWorkshop(i: { creatorId: string; productId: string; startAt: Date }): Promise<{ ok: true; moved: number } | { ok: false; error: string }> {
  const p = await tenantDb(i.creatorId).product.findFirst({ where: { id: i.productId, groupSession: true } });
  if (!p) return { ok: false, error: "Taller no encontrado" };
  const end = new Date(i.startAt.getTime() + (p.durationMin ?? SESSION_DEFAULTS.durationMin) * 60000);
  const clash = await workshopClash(i.creatorId, i.startAt, end, p.id);
  if (clash) return { ok: false, error: `Esa hora choca con ${clash.label}` };
  const ids = await prisma.$transaction(async (tx) => {
    await lockCreatorBookings(tx, i.creatorId);
    await tx.product.updateMany({ where: { id: p.id, creatorId: i.creatorId }, data: { eventStartAt: i.startAt } });
    const seats = await tx.booking.findMany({ where: { productId: p.id, creatorId: i.creatorId, groupSeat: true, status: "CONFIRMED" }, select: { id: true, startAt: true } });
    for (const s of seats) {
      await tx.booking.update({ where: { id: s.id }, data: { previousStartAt: s.startAt, startAt: i.startAt, endAt: end } });
      await releaseBookingEmails(s.id, tx);
    }
    return seats.map((s) => s.id);
  });
  for (const id of ids) await emit({ type: "booking.confirmed", bookingId: id, change: "moved" });
  return { ok: true, moved: ids.length };
}

