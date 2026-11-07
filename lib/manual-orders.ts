import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { hasBookingClash, isGroupSession, lockProductSeats, seatsTaken, SESSION_DEFAULTS } from "./booking";
import type { IntakeAnswers } from "./intake";
import { fulfillOrder, type SessionOrderMeta } from "./orders";
import { tenantDb } from "./tenant";
import { canonicalTimezone } from "./timezones";
import { labelToMinutes, zonedTimeToUtc } from "./tz";

/**
 * «Dar una sesión o lectura» (/panel/reservas/nueva): la dueña regala una sesión, o la apunta porque se
 * la pagaron fuera (Bizum, transferencia), con la fecha que ella elija (un hueco de su agenda, cualquier
 * otra hora o «que la elija ella»).
 *
 * Crea un pedido de 0 € («manual») y lo entrega por el mismo camino que una compra (fulfillOrder):
 * clienta, acceso, reserva, emails, su área y los cambios de fecha hasta 24 h antes, sin código aparte.
 * La hora que pone la dueña se salta su horario (ownerPlaced) pero nunca el cerrojo ni la regla de
 * solapes. Repetir el envío del formulario no duplica nada (requestId).
 *
 * grantManualAccess (lib/free-access.ts) sigue sin dar sesiones a propósito: su «un pedido por email y
 * producto» no sirve para una clienta que reserva muchas sesiones.
 */
export type ManualWhen = { kind: "slot"; start: string } | { kind: "custom"; date: string; time: string } | { kind: "later" };

export type ManualOrderInput = {
  creatorId: string;
  grantedByUserId: string;
  productId: string;
  name: string;
  email: string;
  payment: "gift" | "paid_elsewhere";
  paidNote?: string | null;
  when: ManualWhen;
  clientTimezone?: string | null;
  intake?: IntakeAnswers | null;
  message?: string | null;
  requestId: string;
  allowOverCapacity?: boolean;
};

export type ManualOrderResult =
  | { ok: true; orderId: string; bookingId: string | null; status: "CONFIRMED" | "PENDING_SCHEDULE" | "DELIVERY" }
  | { ok: false; error: string };

export async function createManualOrder(i: ManualOrderInput): Promise<ManualOrderResult> {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(i.requestId)) return { ok: false, error: "Vuelve a cargar la página e inténtalo de nuevo" };
  const email = i.email.trim().toLowerCase();
  const db = tenantDb(i.creatorId);
  const product = await db.product.findFirst({ where: { id: i.productId, status: { not: "ARCHIVED" } }, include: { creator: { select: { timezone: true } } } });
  const isSession = product?.type === "SESSION";
  const isReading = product?.type === "DIGITAL" && product.deliveryMode === "PERSONAL";
  if (!product || (!isSession && !isReading)) return { ok: false, error: "Elige una sesión o una lectura «Lo preparo yo»" };
  const group = isGroupSession(product);
  const tz = product.creator.timezone;

  let start: Date | null = null;
  if (isSession && !group) {
    if (i.when.kind === "slot") start = new Date(i.when.start);
    else if (i.when.kind === "custom") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(i.when.date) || !/^\d{2}:\d{2}$/.test(i.when.time)) return { ok: false, error: "Escribe la fecha y la hora" };
      start = zonedTimeToUtc(i.when.date, labelToMinutes(i.when.time), tz);
    }
    if (start && (Number.isNaN(start.getTime()) || start <= new Date())) return { ok: false, error: "Elige una fecha y hora futuras" };
  }

  const meta: SessionOrderMeta & Record<string, unknown> = {
    grantedByUserId: i.grantedByUserId,
    manual: i.payment,
    ...(i.payment === "paid_elsewhere" && i.paidNote?.trim() ? { paidNote: i.paidNote.trim().slice(0, 120) } : {}),
    ...(i.message?.trim() ? { message: i.message.trim().slice(0, 1000) } : {}),
    requestId: i.requestId,
    ...(start ? { slotStart: start.toISOString(), ownerPlaced: true } : {}),
    ...(canonicalTimezone(i.clientTimezone) ? { buyerTz: canonicalTimezone(i.clientTimezone)! } : {}),
  };

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`manual:${i.creatorId}:${i.requestId}`}, 0))`;
    const existing = await tx.order.findFirst({
      where: { creatorId: i.creatorId, paymentProvider: "manual", metadata: { path: ["requestId"], equals: i.requestId } },
      select: { id: true },
    });
    if (existing) return { orderId: existing.id, fresh: false };
    if (start && (await hasBookingClash(tx, i.creatorId, start, new Date(start.getTime() + (product.durationMin ?? SESSION_DEFAULTS.durationMin) * 60000), product.bufferMin ?? SESSION_DEFAULTS.bufferMin)))
      return { error: "Ya tienes otra sesión a esa hora" };
    if (group) {
      if (!product.eventStartAt) return { error: "Pon primero la fecha del taller" };
      await lockProductSeats(tx, product.id);
      if (!i.allowOverCapacity && product.capacity != null && (await seatsTaken(tx, product.id)) >= product.capacity) return { error: "No quedan plazas en este taller" };
    }
    const order = await tx.order.create({
      data: {
        creatorId: i.creatorId,
        productId: product.id,
        productTitle: product.title,
        productType: product.type,
        buyerEmail: email,
        buyerName: i.name.trim() || null,
        amountCents: 0,
        currency: product.currency,
        commissionBps: 0,
        platformFeeCents: 0,
        netCents: 0,
        paymentProvider: "manual",
        metadata: meta as Prisma.InputJsonObject,
        intake: i.intake ? (i.intake as unknown as Prisma.InputJsonObject) : undefined,
        intakeUpdatedAt: i.intake ? new Date() : null,
        chargedAt: new Date(),
      },
      select: { id: true },
    });
    return { orderId: order.id, fresh: true };
  });
  if ("error" in created) return { ok: false, error: created.error! };
  if (created.fresh) await fulfillOrder(created.orderId, "");
  const booking = await prisma.booking.findFirst({ where: { orderId: created.orderId }, orderBy: { createdAt: "asc" }, select: { id: true, status: true } });
  if (!isSession) return { ok: true, orderId: created.orderId, bookingId: null, status: "DELIVERY" };
  return { ok: true, orderId: created.orderId, bookingId: booking?.id ?? null, status: booking?.status === "CONFIRMED" ? "CONFIRMED" : "PENDING_SCHEDULE" };
}
