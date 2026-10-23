import "server-only";
import { getSession } from "./auth";
import { prisma } from "./db";
import type { findOrderFile } from "./order-files";

/**
 * Acceso a un archivo de un pedido: la dueña siempre; la clienta del pedido con su sesión verificada o
 * limitada a ESE pedido, si está pagado, el archivo enviado y su acceso al producto sigue activo.
 */
export async function checkOrderFileAccess(f: NonNullable<Awaited<ReturnType<typeof findOrderFile>>>): Promise<{ ok: true; userId: string; isOwner: boolean } | { ok: false; reason: "login" | "forbidden" }> {
  const s = await getSession();
  if (!s) return { ok: false, reason: "login" };
  if (!s.order && s.user.creator?.id === f.creatorId) return { ok: true, userId: s.user.id, isOwner: true };
  if (f.order.customer?.userId !== s.user.id) return { ok: false, reason: "forbidden" };
  if (s.order ? s.order.id !== f.orderId : !s.verified) return { ok: false, reason: "forbidden" };
  if (f.order.status !== "PAID" || !f.sentAt) return { ok: false, reason: "forbidden" };
  const access = await prisma.access.findUnique({ where: { userId_productId: { userId: s.user.id, productId: f.order.productId } } });
  const valid = access && access.status === "ACTIVE" && (!access.expiresAt || access.expiresAt > new Date());
  return valid ? { ok: true, userId: s.user.id, isOwner: false } : { ok: false, reason: "forbidden" };
}
