import { handleAutomation } from "./automations";
import type { DomainEvent } from "./events";

/**
 * Qué se hace con cada evento de dominio. Lanza si algo falla: lib/events.ts lo reintenta.
 * Todo tiene que ser idempotente, porque un evento puede ejecutarse más de una vez.
 */
export async function runEventHandlers(event: DomainEvent) {
  // Primero los emails (cada uno con su dedupeKey): un fallo del calendario no los retrasa.
  await handleAutomation(event);
  if (event.type === "booking.confirmed") {
    // Import dinámico: orders importa events, y events carga este archivo.
    const { syncBookingToCalendar } = await import("./orders");
    // Idempotente: no hace nada si la reserva ya tiene externalEventId.
    await syncBookingToCalendar(event.bookingId);
  }
}
