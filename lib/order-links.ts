import "server-only";
import { randomBytes } from "node:crypto";
import type { Creator, Customer, Order, OrderLink } from "@prisma/client";
import { hashToken } from "./auth-tokens";
import { addDays, safeNext } from "./auth-utils";
import { prisma } from "./db";
import { appUrl } from "./env";
import { formatDate } from "./tz";

/**
 * Enlaces personales de los emails (recibo, acceso al curso, reserva, recordatorio).
 *
 * Abren una sesión limitada a ESE pedido (7 días) sin contraseña: nunca la cuenta completa ni
 * confirman el email, así que un enlace reenviado o guardado por un antivirus solo deja ver esa
 * compra. Sirven varias veces hasta que caducan (14 días desde el envío) y se revocan al
 * reembolsar (revokeOrderAccess). En la BD solo se guarda el hash del token.
 */
export const ORDER_LINK_DAYS = 14;
export const ORDER_LINK_SESSION_DAYS = 7;

/** Crea un enlace personal. `validFrom`: para emails programados (recordatorio), cuenta desde el envío. */
export async function createOrderLink(input: { orderId: string; path: string; validFrom?: Date }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = addDays(input.validFrom ?? new Date(), ORDER_LINK_DAYS);
  await prisma.orderLink.create({
    data: { tokenHash: hashToken(token), orderId: input.orderId, path: safeNext(input.path, `/cuenta/pedidos/${input.orderId}`), expiresAt },
  });
  return { url: `${appUrl()}/auth/enlace?t=${token}`, expiresAt };
}

export type ResolvedOrderLink =
  | { status: "ok"; link: OrderLink; order: Order & { customer: Customer | null; creator: Creator } }
  | { status: "expired"; path: string; username: string }
  | null;

/** Comprueba un enlace personal (y anota su uso). null si no existe o el pedido ya no está pagado. */
export async function resolveOrderLink(token: string, opts: { touch?: boolean } = {}): Promise<ResolvedOrderLink> {
  if (!token) return null;
  const link = await prisma.orderLink.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { order: { include: { customer: true, creator: true } } },
  });
  if (!link) return null;
  if (link.expiresAt < new Date()) return { status: "expired", path: link.path, username: link.order.creator.username };
  if (link.order.status !== "PAID") return null;
  if (opts.touch !== false) await prisma.orderLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
  const { order, ...row } = link;
  return { status: "ok", link: row, order };
}

/** Corta el acceso sin contraseña a un pedido: sus enlaces personales y sus sesiones limitadas (reembolsos). */
export async function revokeOrderAccess(orderId: string) {
  await prisma.$transaction([prisma.orderLink.deleteMany({ where: { orderId } }), prisma.session.deleteMany({ where: { orderId } })]);
}

/** Texto bajo el botón de los emails con enlace personal. */
export function orderLinkNote(expiresAt: Date) {
  return `Este enlace es personal y funciona hasta el ${formatDate(expiresAt, { day: "numeric", month: "long" })}. No lo reenvíes.`;
}

/** ¿Ya existe (y no está descartado) el email con esta clave? Evita crear enlaces que nadie recibirá. */
export async function emailAlreadyQueued(dedupeKey: string) {
  const m = await prisma.emailMessage.findUnique({ where: { dedupeKey }, select: { status: true } });
  return !!m && m.status !== "CANCELED";
}
