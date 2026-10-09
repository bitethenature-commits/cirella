import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { captureAlert, captureError } from "./monitoring";
import { nextAttemptAt, truncateError } from "./reliability";

/**
 * Eventos de dominio con outbox transaccional.
 *
 *   1. El código de negocio guarda el evento con `recordEvents(tx, …)` DENTRO de la misma
 *      transacción que el cambio (pedido pagado, suscripción cancelada…): o se guardan los dos o
 *      ninguno. Así un «pago completado» nunca se queda sin su recibo.
 *   2. Tras el commit, `dispatchEvents(ids)` ejecuta los handlers al momento (lib/event-handlers.ts:
 *      emails y calendario), para que la compradora vea su recibo enseguida.
 *   3. Si un handler falla o el proceso cae entre medias, /api/cron (`processEvents`) lo reintenta
 *      a 1 min, 5 min, 30 min, 2 h y 12 h. Tras 6 intentos queda DEAD y se avisa (Sentry y
 *      /admin/envios, desde donde se puede reprocesar).
 *
 * Los handlers deben ser idempotentes (los emails llevan dedupeKey; el calendario, externalEventId):
 * un evento puede ejecutarse más de una vez.
 */

export type DomainEvent =
  | { type: "order.paid"; orderId: string }
  | { type: "customer.created"; customerId: string }
  | { type: "booking.confirmed"; bookingId: string }
  | { type: "subscription.created"; subscriptionId: string }
  | { type: "subscription.canceled"; subscriptionId: string }
  | { type: "checkout.abandoned"; orderId: string }
  // Reembolsos y cambios de reserva (lib/refunds.ts, lib/booking-changes.ts). Sus emails se envían
  // directamente; los eventos quedan para quien tenga que reaccionar (p. ej. la factura rectificativa).
  | { type: "order.refunded"; orderId: string; refundId: string }
  | { type: "booking.cancelled"; bookingId: string }
  | { type: "booking.reschedule_requested"; bookingId: string };

/** Cuánto puede tardar un intento antes de que otro proceso lo dé por caído y lo retome. */
const LEASE_MS = 5 * 60_000;
/** Los eventos ya procesados se borran pasado este tiempo. */
const KEEP_DONE_DAYS = 30;

/** Guarda los eventos en la transacción de negocio. Devuelve sus ids para despacharlos tras el commit. */
export async function recordEvents(tx: Prisma.TransactionClient, events: DomainEvent[]): Promise<string[]> {
  if (!events.length) return [];
  const rows = await tx.outboxEvent.createManyAndReturn({
    data: events.map((e) => ({ type: e.type, payload: e as Prisma.InputJsonObject })),
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Ejecuta ya los eventos recién guardados. Nunca lanza: lo que falle lo reintenta el cron. */
export async function dispatchEvents(ids: string[]) {
  for (const id of ids) {
    try {
      await runOne(id);
    } catch (e) {
      captureError(e, { area: "events", extra: { eventId: id } });
    }
  }
}

/**
 * Evento fuera de una transacción (cuando el cambio de negocio ya está guardado o no lo hay):
 * lo graba y lo despacha. Nunca lanza.
 */
export async function emit(event: DomainEvent) {
  let id: string;
  try {
    id = (await prisma.outboxEvent.create({ data: { type: event.type, payload: event as Prisma.InputJsonObject }, select: { id: true } })).id;
  } catch (e) {
    captureError(e, { area: "events", tags: { type: event.type }, extra: { ...event } });
    return;
  }
  await dispatchEvents([id]);
}

/** Reclama el evento (si nadie lo tiene y le toca), ejecuta los handlers y anota el resultado. */
async function runOne(id: string, now = new Date()) {
  const claim = await prisma.outboxEvent.updateMany({
    where: { id, status: "PENDING", runAt: { lte: now } },
    data: { status: "PROCESSING", attempts: { increment: 1 }, lockedUntil: new Date(now.getTime() + LEASE_MS) },
  });
  if (!claim.count) return;
  const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
  const event = row.payload as DomainEvent;
  try {
    // Import dinámico: rompe el ciclo orders → events → event-handlers → orders.
    const { runEventHandlers } = await import("./event-handlers");
    await runEventHandlers(event);
    await prisma.outboxEvent.update({
      where: { id },
      data: { status: "DONE", processedAt: new Date(), lockedUntil: null, lastError: null },
    });
  } catch (e) {
    const next = nextAttemptAt(row.attempts, now);
    if (next) {
      await prisma.outboxEvent.update({ where: { id }, data: { status: "PENDING", runAt: next, lockedUntil: null, lastError: truncateError(e) } });
      console.warn(`[events] ${row.type} ${id}: intento ${row.attempts} fallido, se reintenta`, truncateError(e));
      return;
    }
    await prisma.outboxEvent.update({
      where: { id },
      data: { status: "DEAD", processedAt: new Date(), lockedUntil: null, lastError: truncateError(e) },
    });
    captureError(e, { area: "events", tags: { type: row.type }, extra: { eventId: id, ...event } });
    captureAlert("Evento de dominio descartado tras 6 intentos", {
      area: "events",
      level: "error",
      fingerprint: ["evento-dead", row.type],
      extra: { eventId: id, ...event },
    });
  }
}

/** Lo llama /api/cron: retoma los caducados, purga los antiguos y procesa lo pendiente. */
export async function processEvents(limit = 50, now = new Date()) {
  await prisma.outboxEvent.updateMany({
    where: { status: "PROCESSING", lockedUntil: { lt: now } },
    data: { status: "PENDING", lockedUntil: null },
  });
  await prisma.outboxEvent.deleteMany({
    where: { status: "DONE", processedAt: { lt: new Date(now.getTime() - KEEP_DONE_DAYS * 24 * 3600_000) } },
  });
  const due = await prisma.outboxEvent.findMany({
    where: { status: "PENDING", runAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const { id } of due) {
    try {
      await runOne(id, now);
    } catch (e) {
      captureError(e, { area: "events", extra: { eventId: id } });
    }
  }
  return due.length;
}

/** Reprocesar desde /admin/envios: vuelve a empezar la cuenta de intentos. */
export async function retryEvent(id: string) {
  const r = await prisma.outboxEvent.updateMany({
    where: { id, status: { in: ["DEAD", "PENDING"] } },
    data: { status: "PENDING", attempts: 0, runAt: new Date(), lastError: null, processedAt: null },
  });
  if (r.count) await dispatchEvents([id]);
  return r.count > 0;
}
