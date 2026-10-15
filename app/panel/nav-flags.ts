import "server-only";
import { cache } from "react";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { PLATFORM_NAV_FLAGS, type PanelNavFlags } from "./nav-items";

/**
 * Qué enseña el menú del panel (una consulta por petición). En modo personal las sesiones se suelen
 * reservar fuera (Calendly…): «Reservas» solo sale si hay alguna sesión que se reserva aquí o
 * quedan reservas por delante.
 */
export const panelNavFlags = cache(async (creatorId: string): Promise<PanelNavFlags> => {
  if (!isPersonalMode()) return PLATFORM_NAV_FLAGS;
  const db = tenantDb(creatorId);
  const [internalSessions, upcoming] = await Promise.all([
    db.product.count({ where: { type: "SESSION", status: { not: "ARCHIVED" }, accessMode: { not: "EXTERNAL" } } }),
    db.booking.count({ where: { OR: [{ status: "PENDING_SCHEDULE" }, { status: "CONFIRMED", startAt: { gte: new Date() } }] } }),
  ]);
  return { personal: true, showBookings: internalSessions + upcoming > 0 };
});
