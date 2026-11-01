import "server-only";
import { portalViewer, type PortalViewer } from "./portal";
import { sortProfiles, toSavedProfile, type SavedBirthProfile } from "./birth-profiles-rules";
import { getOwnerCreator, isPersonalMode } from "./site-mode";
import { tenantDb } from "./tenant";

/**
 * Perfiles de nacimiento guardados en el servidor. Quién puede calcular con sus datos y guardarlos es
 * la misma regla que desbloquea el Portal de Noticias (lib/portal-rules.ts → unlockReason): sesión de
 * cuenta y suscriptora CONFIRMADA de la newsletter de la dueña (la dueña, siempre). Solo en la web
 * personal: la newsletter es suya.
 *
 * Toda lectura va por tenantDb(creatorId) Y por el userId de la sesión: un id que llegue de otra
 * persona simplemente no se encuentra.
 */

const SELECT = {
  id: true,
  name: true,
  relation: true,
  isOwn: true,
  birthDate: true,
  birthTime: true,
  placeName: true,
  placeDetail: true,
  lat: true,
  lon: true,
  tz: true,
} as const;

/** Los perfiles de esta alumna en la web de esta creadora (el propio primero). */
export async function listBirthProfiles(creatorId: string, userId: string): Promise<SavedBirthProfile[]> {
  const rows = await tenantDb(creatorId).birthProfile.findMany({
    where: { userId },
    select: SELECT,
    // Si alguna vez quedaran dos «propios» (doble envío), vale el último que se tocó.
    orderBy: { updatedAt: "desc" },
  });
  let ownSeen = false;
  const list = rows.map((r) => {
    const own = r.isOwn && !ownSeen;
    if (r.isOwn) ownSeen = true;
    return toSavedProfile({ ...r, isOwn: own });
  });
  return sortProfiles(list);
}

export type EnergyAccess = {
  owner: { id: string; userId: string; username: string; displayName: string };
  viewer: PortalViewer;
};

/** La dueña y quién mira (con la regla del portal). null fuera de la web personal. */
export async function energyAccess(): Promise<EnergyAccess | null> {
  if (!isPersonalMode()) return null;
  const owner = await getOwnerCreator();
  if (!owner || owner.status !== "ACTIVE") return null;
  const viewer = await portalViewer(owner);
  return {
    owner: {
      id: owner.id,
      userId: owner.userId,
      username: owner.username,
      displayName: owner.displayName,
    },
    viewer,
  };
}
