import "server-only";
import { prisma } from "./db";
import { enqueueEmail } from "./email/outbox";
import { readingDeliveredEmail } from "./email/booking-templates";
import { createOrderLink, orderLinkNote } from "./order-links";
import { cleanRichInput, formatToStore, normalizeNewlines } from "./rich-text";
import { privateKey, storage } from "./storage";
import { tenantDb } from "./tenant";

/**
 * Entregas de UN pedido: la lectura que la dueña prepara («Lo preparo yo») o la grabación de una
 * sesión 1:1. Archivos (subidos con /api/upload, propósito «delivery») o enlaces, con un mensaje.
 * Nunca son contenido del producto: solo los ven la clienta de ese pedido (cuando se han enviado y
 * mientras su acceso siga activo: un reembolso lo corta) y la dueña.
 */

export { deliverableOrder } from "./deliverable";
import { deliverableOrder } from "./deliverable";

export async function findOrderFile(id: string) {
  return prisma.orderFile.findUnique({
    where: { id },
    include: { order: { select: { id: true, creatorId: true, productId: true, productTitle: true, status: true, deliveredAt: true, customer: { select: { userId: true } } } } },
  });
}

/** Archivos de un pedido (los de la clienta: solo los enviados). */
export function listOrderFiles(orderId: string, o: { sentOnly?: boolean } = {}) {
  return prisma.orderFile.findMany({ where: { orderId, ...(o.sentOnly ? { sentAt: { not: null } } : {}) }, orderBy: { createdAt: "asc" } });
}

async function ownedDeliverable(creatorId: string, orderId: string) {
  const o = await tenantDb(creatorId).order.findFirst({ where: { id: orderId }, include: { product: { select: { deliveryMode: true, groupSession: true } } } });
  return o && deliverableOrder(o) ? o : null;
}

export async function addOrderLink(i: { creatorId: string; orderId: string; name: string; url: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await ownedDeliverable(i.creatorId, i.orderId))) return { ok: false, error: "Pedido no encontrado" };
  let url: URL;
  try {
    url = new URL(i.url.trim());
  } catch {
    return { ok: false, error: "Pega el enlace completo (https://…)" };
  }
  if (url.protocol !== "https:" || url.username || url.password) return { ok: false, error: "El enlace debe empezar por https://" };
  const name = i.name.trim().slice(0, 120) || url.hostname;
  await tenantDb(i.creatorId).orderFile.create({ data: { creatorId: i.creatorId, orderId: i.orderId, name, kind: "LINK", url: url.toString() } });
  return { ok: true };
}

/** Borra un archivo (primero del almacenamiento). Uno ya enviado también: la clienta deja de verlo. */
export async function deleteOrderFile(i: { creatorId: string; fileId: string }) {
  const db = tenantDb(i.creatorId);
  const f = await db.orderFile.findFirst({ where: { id: i.fileId } });
  if (!f) return false;
  if (f.storageKey) await storage().delete([privateKey(f.storageKey)]).catch(() => {});
  await db.orderFile.deleteMany({ where: { id: f.id } });
  return true;
}

/**
 * «Enviar a Lucía»: marca como enviados los archivos nuevos, guarda el mensaje y manda «Tu lectura está
 * lista» con el enlace personal (al pedido, o a la sesión si es una grabación). Repetir sin nada nuevo
 * no envía nada.
 */
export async function sendOrderDelivery(i: { creatorId: string; orderId: string; message?: string | null; messageFormat?: string | null }): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const order = await ownedDeliverable(i.creatorId, i.orderId);
  if (!order) return { ok: false, error: "Pedido no encontrado" };
  const db = tenantDb(i.creatorId);
  const now = new Date();
  const text = normalizeNewlines(i.message ?? "").trim().slice(0, 5000) || null;
  const format = formatToStore(text, i.messageFormat === "MD" ? "MD" : null, order.deliveryMessageFormat ?? null);
  const message = text && format ? cleanRichInput(text, { creatorId: i.creatorId, images: false }) : text;
  const sent = await prisma.$transaction(async (tx) => {
    const c = await tx.orderFile.updateMany({ where: { orderId: order.id, creatorId: i.creatorId, sentAt: null }, data: { sentAt: now } });
    const total = await tx.orderFile.count({ where: { orderId: order.id, creatorId: i.creatorId } });
    if (!total) return -1;
    await tx.order.updateMany({
      where: { id: order.id, creatorId: i.creatorId },
      data: { deliveredAt: order.deliveredAt ?? now, deliveryMessage: message, deliveryMessageFormat: message ? format : null },
    });
    return c.count;
  });
  if (sent < 0) return { ok: false, error: "Añade al menos un archivo o un enlace" };
  if (sent === 0 && order.deliveredAt) return { ok: true, sent: 0 };
  const [files, creator, booking] = await Promise.all([
    db.orderFile.findMany({ where: { orderId: order.id, sentAt: { not: null } }, orderBy: { createdAt: "asc" }, select: { name: true } }),
    prisma.creator.findUniqueOrThrow({ where: { id: i.creatorId }, select: { displayName: true } }),
    db.booking.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);
  const link = await createOrderLink({ orderId: order.id, path: booking && order.productType === "SESSION" ? `/cuenta/sesiones/${booking.id}#grabacion` : `/cuenta/pedidos/${order.id}#lectura` });
  await enqueueEmail({
    to: order.buyerEmail,
    creatorId: i.creatorId,
    template: "READING_DELIVERED",
    dedupeKey: `delivery:${order.id}:${now.toISOString()}`,
    ...readingDeliveredEmail({
      creatorName: creator.displayName,
      productTitle: order.productTitle,
      message,
      messageFormat: message ? format : null,
      fileNames: files.map((f) => f.name),
      url: link.url,
      linkNote: orderLinkNote(link.expiresAt),
    }),
  });
  return { ok: true, sent };
}
