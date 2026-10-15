/**
 * Integración con calendarios externos.
 *
 * El cálculo de huecos (lib/booking.ts) consulta `getBusyIntervals` y, al
 * confirmar una reserva, se llama a `pushBookingEvent`. Hoy no hay ningún
 * proveedor conectado; para Google Calendar basta con implementar
 * `CalendarProvider` (OAuth → freebusy.query / events.insert) y registrarlo.
 */

export type BusyInterval = { start: Date; end: Date };

export interface CalendarProvider {
  key: string;
  getBusy(accountId: string, from: Date, to: Date): Promise<BusyInterval[]>;
  createEvent(
    accountId: string,
    event: { title: string; start: Date; end: Date; description?: string; attendeeEmail?: string },
  ): Promise<string>;
}

const providers: Record<string, CalendarProvider> = {
  // google: googleCalendarProvider,
};

type CreatorCalendar = { calendarProvider: string | null; calendarAccountId: string | null };

export async function getBusyIntervals(creator: CreatorCalendar, from: Date, to: Date) {
  const p = creator.calendarProvider ? providers[creator.calendarProvider] : undefined;
  if (!p || !creator.calendarAccountId) return [];
  return p.getBusy(creator.calendarAccountId, from, to);
}

export async function pushBookingEvent(
  creator: CreatorCalendar,
  event: { title: string; start: Date; end: Date; description?: string; attendeeEmail?: string },
) {
  const p = creator.calendarProvider ? providers[creator.calendarProvider] : undefined;
  if (!p || !creator.calendarAccountId) return null;
  return p.createEvent(creator.calendarAccountId, event);
}
