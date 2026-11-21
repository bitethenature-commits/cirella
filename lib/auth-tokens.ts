import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";

/**
 * Lo de autenticación que no depende de Next (cookies, redirect): lo usan lib/auth.ts, los enlaces
 * personales (lib/order-links.ts), el cron y los scripts de prueba.
 */

/** Los tokens (sesión, enlace mágico, enlace personal, permiso de compra) se guardan solo como sha256. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Los enlaces personales caducados se guardan un mes para que el login diga «ha caducado» con la marca. */
const EXPIRED_ORDER_LINK_DAYS = 30;

/**
 * Borra sesiones caducadas, enlaces mágicos y pasos de la verificación en dos pasos caducados hace
 * más de un día, dispositivos recordados caducados y enlaces personales viejos (cron).
 */
export async function purgeExpiredAuth(now = new Date()) {
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [sessions, tokens, links, challenges, devices] = await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.loginToken.deleteMany({ where: { expiresAt: { lt: dayAgo } } }),
    prisma.orderLink.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - EXPIRED_ORDER_LINK_DAYS * 86_400_000) } } }),
    prisma.twoFactorChallenge.deleteMany({ where: { expiresAt: { lt: dayAgo } } }),
    prisma.trustedDevice.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return sessions.count + tokens.count + links.count + challenges.count + devices.count;
}
