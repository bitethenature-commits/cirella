import "server-only";
import { randomBytes } from "node:crypto";
import { hashToken } from "./auth-tokens";
import { safeNext } from "./auth-utils";
import { prisma } from "./db";
import { enqueueEmail } from "./email/outbox";
import { magicLinkEmail } from "./email/templates";
import { appUrl } from "./env";

/**
 * Enlaces mágicos (sin cookies ni Next: los usan lib/auth.ts y las pruebas de BD). La sesión la
 * abre quien los consume (app/auth/magic/actions.ts).
 */

const MAGIC_LINK_MINUTES = 60;
const VERIFY_LINK_HOURS = 72;

export type MagicPurpose = "LOGIN" | "VERIFY_SIGNUP";

/**
 * Genera un enlace mágico y lo envía por email (bandeja de salida).
 *   · LOGIN: entrar (1 hora, un solo uso).
 *   · VERIFY_SIGNUP: «Confirma tu email» tras un alta con contraseña (72 horas), con los botones
 *     «Sí, he sido yo» / «No he sido yo».
 * creatorId solo pone la marca de la creadora en el email y en la pantalla «Entrar»; no da permisos.
 */
export async function sendMagicLink(
  email: string,
  redirectTo = "/auth/continuar",
  ctx: { creatorId?: string | null; purpose?: MagicPurpose } = {},
) {
  const purpose = ctx.purpose ?? "LOGIN";
  const token = randomBytes(32).toString("base64url");
  const ttlMs = purpose === "VERIFY_SIGNUP" ? VERIFY_LINK_HOURS * 3600_000 : MAGIC_LINK_MINUTES * 60_000;
  const creator = ctx.creatorId ? await prisma.creator.findUnique({ where: { id: ctx.creatorId }, select: { id: true, displayName: true } }) : null;
  await prisma.loginToken.create({
    data: {
      email: email.toLowerCase(),
      tokenHash: hashToken(token),
      purpose,
      creatorId: creator?.id ?? null,
      redirectTo: safeNext(redirectTo, "/auth/continuar"),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  const url = `${appUrl()}/auth/magic?token=${token}`;
  const mail = magicLinkEmail({ url, creatorName: creator?.displayName, purpose });
  await enqueueEmail({
    to: email,
    template: purpose === "VERIFY_SIGNUP" ? "VERIFY_EMAIL" : "MAGIC_LINK",
    creatorId: creator?.id ?? null,
    ...mail,
    sendNow: true,
  });
}

/** Lee un enlace mágico sin gastarlo (pantalla «Entrar»). null si no existe, ya se usó o caducó. */
export async function peekMagicLink(token: string): Promise<{ purpose: MagicPurpose; email: string; creatorId: string | null } | null> {
  if (!token) return null;
  const record = await prisma.loginToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  return { purpose: record.purpose === "VERIFY_SIGNUP" ? "VERIFY_SIGNUP" : "LOGIN", email: record.email, creatorId: record.creatorId };
}

/** Creadora del enlace (aunque ya se haya usado o caducado): para mandar al login con su marca. */
export async function magicLinkCreatorId(token: string) {
  if (!token) return null;
  const record = await prisma.loginToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { creatorId: true } });
  return record?.creatorId ?? null;
}

/**
 * Gasta un enlace mágico (solo desde el POST de «Entrar»: los antivirus del correo hacen GET).
 * Es atómico: dos peticiones a la vez no pueden usar el mismo enlace. Devuelve la usuaria
 * (creándola si no existe) y adónde ir, o null si el enlace no vale.
 *
 * La primera prueba de que el email es suyo anula lo que se hizo antes sin esa prueba (contraseña
 * y sesiones de quien registró el email). Con «No he sido yo» se anula siempre.
 */
export async function consumeMagicLink(
  token: string,
  choice?: "yes" | "no",
  /** sha256 de la cookie de sesión del navegador que confirma (Session.id), si tiene. */
  ctx: { currentSessionId?: string | null } = {},
): Promise<{ user: { id: string; email: string }; redirectTo: string } | null> {
  if (!token) return null;
  const now = new Date();
  const tokenHash = hashToken(token);
  const used = await prisma.loginToken.updateMany({ where: { tokenHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
  if (used.count !== 1) return null;
  const record = await prisma.loginToken.findUniqueOrThrow({ where: { tokenHash } });
  let user = await prisma.user.upsert({
    where: { email: record.email },
    update: {},
    create: { email: record.email, emailVerifiedAt: now },
  });
  if (user.status === "BLOCKED") return null;

  let resetPassword = false;
  // «Sí, he sido yo» solo conserva la contraseña si se confirma desde el navegador donde se creó la
  // cuenta (su sesión). Si no, nada prueba que quien la puso sea quien abre el email (alguien pudo
  // registrar este email antes que su dueña): se trata como una recuperación.
  const ownSession =
    record.purpose === "VERIFY_SIGNUP" && choice === "yes" && !user.emailVerifiedAt && ctx.currentSessionId
      ? await prisma.session.findFirst({ where: { id: ctx.currentSessionId, userId: user.id, orderId: null, expiresAt: { gt: now } }, select: { id: true } })
      : null;
  if (ownSession) {
    // Solo esa sesión pasa a estar confirmada; cualquier otra sin confirmar deja de valer.
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
    await prisma.session.update({ where: { id: ownSession.id }, data: { verified: true } });
    await prisma.session.deleteMany({ where: { userId: user.id, verified: false } });
  } else if (choice === "no" || !user.emailVerifiedAt) {
    // Recuperación: fuera la contraseña creada sin probar el email y todas las sesiones previas.
    resetPassword = !!user.passwordHash;
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? now, passwordHash: null } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
  } else {
    // Las sesiones no verificadas (p. ej. de un checkout hecho por otra persona con este email) dejan de valer.
    await prisma.session.deleteMany({ where: { userId: user.id, verified: false } });
  }

  const redirectTo = safeNext(record.redirectTo, "/auth/continuar");
  return {
    user: { id: user.id, email: user.email },
    redirectTo: resetPassword ? `/contrasena?motivo=seguridad&next=${encodeURIComponent(redirectTo)}` : redirectTo,
  };
}
