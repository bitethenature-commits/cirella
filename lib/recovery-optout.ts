import { createHash } from "node:crypto";
import { prisma } from "./db";
import { appSecret, appUrl } from "./env";
import { signToken, verifyToken } from "./storage/signing";

/**
 * Baja de los emails de compra abandonada (LSSI art. 21.2: cada comunicación comercial lleva un
 * medio sencillo y gratuito para oponerse). Cada email de recuperación lleva un enlace firmado a
 * /baja/recordatorios y las cabeceras List-Unsubscribe de la baja en un clic; la baja vale para
 * todos los recordatorios de esa creadora a ese email.
 *
 * El enlace solo lleva el id del pedido (no el email) y está firmado con APP_SECRET, así que no se
 * puede dar de baja a otra persona. Guardamos el sha256 del email, no el email.
 */

const PURPOSE = "baja-recordatorios";
/** Un año: el enlace tiene que seguir funcionando cuando la clienta encuentre el email antiguo. */
const TTL_SEC = 365 * 24 * 3600;

export function optOutEmailHash(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function optOutToken(orderId: string, now = Date.now()) {
  return signToken({ p: PURPOSE, o: orderId }, appSecret(), TTL_SEC, now);
}

export function optOutUrl(orderId: string) {
  return `${appUrl()}/baja/recordatorios?t=${encodeURIComponent(optOutToken(orderId))}`;
}

/** Dirección de la baja «en un clic» (RFC 8058): el gestor de correo hace un POST, sin abrir la página. */
export function optOutOneClickUrl(orderId: string) {
  return `${appUrl()}/baja/recordatorios/un-clic?t=${encodeURIComponent(optOutToken(orderId))}`;
}

/**
 * Cabeceras List-Unsubscribe y List-Unsubscribe-Post (RFC 2369 y 8058): Gmail, Outlook o Apple Mail
 * enseñan su propio botón «Cancelar suscripción», que da de baja sin salir del buzón.
 */
export function optOutHeaders(orderId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${optOutOneClickUrl(orderId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** El id del pedido del enlace, o null si el token está manipulado, caducado o es de otro uso. */
export function readOptOutToken(token: string | null | undefined, now = Date.now()): string | null {
  const t = verifyToken<{ p?: unknown; o?: unknown }>(token, appSecret(), now);
  return t && t.p === PURPOSE && typeof t.o === "string" && t.o ? t.o : null;
}

/** Pedido del enlace con lo que necesita la página (creadora y email), o null. */
export async function optOutTarget(token: string | null | undefined) {
  const orderId = readOptOutToken(token);
  if (!orderId) return null;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { creatorId: true, buyerEmail: true, creator: { select: { displayName: true, username: true } } },
  });
  return order ? { creatorId: order.creatorId, email: order.buyerEmail, creatorName: order.creator.displayName, username: order.creator.username } : null;
}

/** Registra la baja (idempotente: repetirla solo actualiza updatedAt). */
export async function recordOptOut(creatorId: string, email: string) {
  const emailHash = optOutEmailHash(email);
  await prisma.recoveryOptOut.upsert({
    where: { creatorId_emailHash: { creatorId, emailHash } },
    create: { creatorId, emailHash },
    update: { updatedAt: new Date() },
  });
}

/** ¿Se dio de baja de los recordatorios de esta creadora? Corre en el cron (cliente global). */
export async function hasOptedOut(creatorId: string, email: string) {
  const row = await prisma.recoveryOptOut.findUnique({
    where: { creatorId_emailHash: { creatorId, emailHash: optOutEmailHash(email) } },
    select: { id: true },
  });
  return !!row;
}
