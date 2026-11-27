/**
 * ¿Puede la clienta cambiar todavía sus datos para la lectura? Hasta que empieza su sesión 1:1 o hasta
 * que recibe la lectura preparada. Puro.
 */
export function intakeLocked(o: { deliveredAt: Date | null; bookings: { startAt: Date | null; groupSeat?: boolean }[] }, now: Date = new Date()) {
  if (o.deliveredAt) return true;
  const b = o.bookings[0];
  return !!b?.startAt && b.startAt <= now;
}
