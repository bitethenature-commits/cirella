import { prisma } from "./db";
import { appSecret, appUrl } from "./env";
import { signToken, verifyToken } from "./storage/signing";

/**
 * Baja de los avisos por email de la comunidad (publicaciones nuevas y respuestas de la dueña a sus
 * comentarios). Como lib/recovery-optout.ts: cada aviso lleva en el pie un enlace firmado a
 * /baja/comunidad y las cabeceras List-Unsubscribe de la baja «en un clic» (RFC 8058).
 *
 * El enlace solo lleva el id de la clienta (Customer: una persona en la comunidad de UNA creadora),
 * firmado con APP_SECRET y con su propio propósito: un enlace de otra baja no sirve aquí.
 */

const PURPOSE = "baja-comunidad";
/** Un año: el enlace tiene que seguir funcionando cuando encuentre el email antiguo. */
const TTL_SEC = 365 * 24 * 3600;

export function postOptOutToken(customerId: string, now = Date.now()) {
  return signToken({ p: PURPOSE, c: customerId }, appSecret(), TTL_SEC, now);
}

export function postOptOutUrl(customerId: string) {
  return `${appUrl()}/baja/comunidad?t=${encodeURIComponent(postOptOutToken(customerId))}`;
}

export function postOptOutOneClickUrl(customerId: string) {
  return `${appUrl()}/baja/comunidad/un-clic?t=${encodeURIComponent(postOptOutToken(customerId))}`;
}

/** Cabeceras para el botón «Cancelar suscripción» del propio gestor de correo. */
export function postOptOutHeaders(customerId: string): Record<string, string> {
  return { "List-Unsubscribe": `<${postOptOutOneClickUrl(customerId)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

/** El id de la clienta del enlace, o null si está manipulado, caducado o es de otro uso. */
export function readPostOptOutToken(token: string | null | undefined, now = Date.now()): string | null {
  const t = verifyToken<{ p?: unknown; c?: unknown }>(token, appSecret(), now);
  return t && t.p === PURPOSE && typeof t.c === "string" && t.c ? t.c : null;
}

/** Clienta del enlace con lo que necesita la página (creadora, email y si ya se dio de baja), o null. */
export async function postOptOutTarget(token: string | null | undefined) {
  const customerId = readPostOptOutToken(token);
  if (!customerId) return null;
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, creatorId: true, email: true, postEmailsOptOutAt: true, creator: { select: { displayName: true, username: true } } },
  });
  return c ? { customerId: c.id, creatorId: c.creatorId, email: c.email, optedOut: !!c.postEmailsOptOutAt, creatorName: c.creator.displayName, username: c.creator.username } : null;
}

/** Activa (on) o desactiva los avisos de la comunidad de una clienta. Idempotente. */
export async function setPostEmails(customerId: string, on: boolean) {
  await prisma.customer.update({ where: { id: customerId }, data: { postEmailsOptOutAt: on ? null : new Date() } });
}
