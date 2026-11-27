import "server-only";
import { translatePortalItem } from "./public";
import { getCurrentUser } from "./auth";
import { prisma } from "./db";
import { isUnlocked, publicPortalItem, readPortalMedia, unlockReason, type PortalUnlock, type PublicPortalItem } from "./portal-rules";

/**
 * Portal de Noticias en el servidor: quién lo ve desbloqueado (lib/portal-rules.ts → unlockReason) y
 * lo que se le enseña. Lee la sesión: nunca se llama desde una página cacheada (la portada pide lo
 * desbloqueado a /api/portal desde el navegador).
 */

export type PortalViewer = { reason: PortalUnlock; unlocked: boolean; userId: string | null; email: string | null; name: string | null; sessionVerified: boolean };

/** Quién mira el portal de esta creadora y si lo tiene desbloqueado. */
export async function portalViewer(creator: { id: string; userId: string }): Promise<PortalViewer> {
  const user = await getCurrentUser();
  const isOwner = !!user && user.id === creator.userId;
  const sub = user && !isOwner ? await prisma.subscriber.findUnique({ where: { creatorId_email: { creatorId: creator.id, email: user.email.toLowerCase() } }, select: { status: true } }) : null;
  const input = { user: user ? { id: user.id, email: user.email } : null, subscriberStatus: sub?.status ?? null, isOwner };
  return {
    reason: unlockReason(input),
    unlocked: isUnlocked(input),
    userId: user?.id ?? null,
    email: user?.email ?? null,
    name: user?.name ?? null,
    sessionVerified: !!user?.sessionVerified,
  };
}

/** Elementos publicados, en su orden (el destacado primero), tal y como los puede ver esta persona. */
export async function loadPortalItems(creator: { id: string; timezone: string }, unlocked: boolean): Promise<PublicPortalItem[]> {
  const rows = await prisma.portalItem.findMany({
    where: { creatorId: creator.id, status: "PUBLISHED" },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((r) => publicPortalItem(r, unlocked, creator.timezone));
}

/**
 * Archivo n.º `index` de un elemento si esta persona lo tiene desbloqueado (o es la dueña, también en
 * borrador para su vista previa). null = no existe o no tiene acceso.
 */
export async function portalMediaFor(itemId: string, index: number): Promise<{ key: string; mime: string; name: string; kind: string } | "login" | "forbidden" | null> {
  const item = await prisma.portalItem.findUnique({ where: { id: itemId }, include: { creator: { select: { id: true, userId: true, status: true } } } });
  if (!item || item.creator.status !== "ACTIVE") return null;
  const viewer = await portalViewer(item.creator);
  if (item.status !== "PUBLISHED" && viewer.reason !== "owner") return null;
  if (!viewer.unlocked) return viewer.userId ? "forbidden" : "login";
  const media = readPortalMedia(item.media)[index];
  if (!media) return null;
  return { key: media.key, mime: media.mime, name: media.name, kind: media.kind };
}
