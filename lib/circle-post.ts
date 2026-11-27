/**
 * Un círculo de la luna vive en dos sitios: su página de venta (Product, para quien no es miembro) y su
 * publicación «Círculo de la luna» en la membresía más completa (MembershipPost.circleProductId), que
 * es la que da derecho a ir. Se edita una vez, en su estudio, y aquí se copia a la publicación.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { readMoonChoice } from "./product-texts";
import { orderTiers } from "./tiers";

export const JOIN_LABEL_MAX = 40;
export const CIRCLE_JOIN_DEFAULT = "Enlace a Zoom";

/** La membresía más completa de la creadora (la de arriba del todo), o null si no tiene ninguna. */
export async function topTier(creatorId: string): Promise<{ id: string; title: string } | null> {
  const [tiers, edges] = await Promise.all([
    prisma.product.findMany({ where: { creatorId, type: "MEMBERSHIP", status: { not: "ARCHIVED" } }, select: { id: true, title: true, priceCents: true } }),
    prisma.productInclusion.findMany({ where: { creatorId }, select: { productId: true, includedProductId: true } }),
  ]);
  const top = orderTiers(tiers, edges).at(-1)?.tier;
  return top ? { id: top.id, title: top.title } : null;
}

/** Crea o actualiza la publicación del círculo con lo guardado en su estudio. */
export async function syncCirclePost(i: {
  creatorId: string;
  productId: string;
  title: string;
  published: boolean;
  eventAt: Date | null;
  meetingUrl: string | null;
  body: string;
  joinLabel: string;
  pageTexts: FormDataEntryValue | null;
}) {
  let moon: Prisma.InputJsonValue | undefined;
  try {
    const m = typeof i.pageTexts === "string" ? readMoonChoice(JSON.parse(i.pageTexts)) : null;
    if (m) moon = m;
  } catch {
    moon = undefined;
  }
  const data = {
    title: i.title,
    body: i.body.trim().slice(0, 20000),
    bodyFormat: null,
    kind: "CIRCULO_LUNAR",
    eventAt: i.eventAt,
    mediaUrl: i.meetingUrl,
    joinLabel: i.joinLabel.trim().slice(0, JOIN_LABEL_MAX) || null,
    moon,
    status: i.published ? "PUBLISHED" : "DRAFT",
  };
  const existing = await prisma.membershipPost.findUnique({ where: { circleProductId: i.productId }, select: { id: true, status: true } });
  if (existing) {
    await prisma.membershipPost.update({
      where: { id: existing.id },
      // Al publicarse por primera vez, sale arriba del feed con la fecha de hoy.
      data: { ...data, ...(existing.status !== "PUBLISHED" && i.published ? { publishedAt: new Date() } : {}) },
    });
    return;
  }
  const tier = await topTier(i.creatorId);
  if (!tier) return;
  await prisma.membershipPost.create({ data: { ...data, creatorId: i.creatorId, productId: tier.id, circleProductId: i.productId, publishedAt: new Date() } });
}

/** Al borrar el círculo, se borra también su publicación (con sus comentarios y «me gusta»). */
export async function deleteCirclePost(creatorId: string, productId: string) {
  await prisma.membershipPost.deleteMany({ where: { creatorId, circleProductId: productId } });
}
