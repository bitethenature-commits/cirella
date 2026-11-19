import "server-only";
import { cache } from "react";
import { hasPaymentProvider } from "@/lib/payments";
import { REQUESTED } from "@/lib/requests";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { PLATFORM_NAV_FLAGS, type PanelNavFlags } from "./nav-items";

/**
 * Qué enseña el menú del panel (una consulta por petición). En modo personal, si la web cobra, la
 * dueña tiene su propio calendario: «Reservas» sale siempre. Sin cobros, solo si hay alguna sesión que
 * se reserva aquí o quedan reservas por delante. En los dos, el número de solicitudes por contestar.
 */
export const panelNavFlags = cache(async (creatorId: string): Promise<PanelNavFlags> => {
  const db = tenantDb(creatorId);
  const pending = await db.order.count({ where: { status: REQUESTED } });
  const badges = pending ? { "/panel/solicitudes": pending } : undefined;
  if (!isPersonalMode()) return { ...PLATFORM_NAV_FLAGS, badges };
  if (hasPaymentProvider()) return { personal: true, sales: true, showBookings: true, badges };
  // Sin cobros, las sesiones «con solicitud» también se reservan aquí (lib/requests.ts).
  const [internalSessions, upcoming] = await Promise.all([
    db.product.count({ where: { type: "SESSION", status: { not: "ARCHIVED" }, accessMode: { not: "EXTERNAL" } } }),
    db.booking.count({ where: { OR: [{ status: "PENDING_SCHEDULE" }, { status: "CONFIRMED", startAt: { gte: new Date() } }] } }),
  ]);
  return { personal: true, sales: hasPaymentProvider(), showBookings: internalSessions + upcoming > 0, badges };
});
