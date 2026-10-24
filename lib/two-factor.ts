import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { verifyPassword } from "./auth-password";
import { hashToken } from "./auth-tokens";
import { safeNext } from "./auth-utils";
import { prisma } from "./db";
import { appHost } from "./env";
import { captureAlert } from "./monitoring";
import { qrSvg } from "./qr-svg";
import { newRecoveryCode, normalizeRecoveryCode, openSecret, recoveryCodeHash, sealSecret } from "./two-factor-codes";

export { newRecoveryCode, normalizeRecoveryCode, openSecret, recoveryCodeHash, sealSecret };
import { base32Decode, base32Encode, cleanTotpInput, formatSecret, generateSecret, otpauthUri, verifyTotp } from "./totp";

/**
 * Verificación en dos pasos (código de una app). Sin cookies ni Next: las cookies las pone
 * lib/auth.ts (completeLogin) y las acciones; aquí solo la BD. Las tablas de autenticación no van
 * por creadora (como Session y LoginToken).
 *
 *   · el secreto se guarda cifrado (AES-256-GCM, clave HKDF de APP_SECRET): una copia de la BD
 *     sola no da los códigos;
 *   · 10 códigos de recuperación de un solo uso, guardados como HMAC con APP_SECRET;
 *   · el paso de login (TwoFactorChallenge) nunca es una sesión: dura 10 min y admite 5 intentos;
 *   · «Recordar este dispositivo» (30 días) solo se salta el código.
 */

export const CHALLENGE_MINUTES = 10;
export const CHALLENGE_MAX_ATTEMPTS = 5;
export const TRUSTED_DEVICE_DAYS = 30;
export const RECOVERY_CODE_COUNT = 10;
/** Al 3.er código fallado tras un primer factor correcto se avisa a la dueña de la cuenta. */
export const FAILURE_ALERT_AT = 3;

/** «Ahora no» del aviso del panel para activarla (30 días). */
export const TWO_FACTOR_BANNER_COOKIE = "cirella_2fa_aviso";

export type LoginMethod = "PASSWORD" | "MAGIC_LINK" | "DEMO";

/** Secreto de la usuaria en bytes, o null si no se puede leer (p. ej. tras cambiar APP_SECRET: falla cerrado). */
function readSecret(user: { id: string; totpSecret: string | null }): Buffer | null {
  if (!user.totpSecret) return null;
  try {
    return base32Decode(openSecret(user.totpSecret));
  } catch {
    captureAlert("2FA: secreto ilegible (¿ha cambiado APP_SECRET?). Hay que reiniciarla con npm run auth:reset-2fa", {
      area: "auth",
      level: "error",
      fingerprint: ["2fa-secret-unreadable"],
      extra: { userId: user.id },
    });
    return null;
  }
}

// ── Configuración ──

export type SetupView = { uri: string; qrSvg: string; secretFormatted: string; secretB32: string };

function setupView(email: string, secretB32: string): SetupView {
  const uri = otpauthUri({ issuer: appHost(), account: email, secretB32 });
  return { uri, qrSvg: qrSvg(uri), secretFormatted: formatSecret(secretB32), secretB32 };
}

/** «Empezar»: guarda un secreto nuevo (cifrado) mientras la verificación sigue sin activar. */
export async function beginSetup(userId: string): Promise<SetupView | null> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, totpEnabledAt: true } });
  if (user.totpEnabledAt) return null;
  const secretB32 = base32Encode(generateSecret());
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: sealSecret(secretB32), totpLastStep: null } });
  return setupView(user.email, secretB32);
}

/** La configuración a medias (para volver a pintar la pantalla). null si no hay ninguna. */
export async function pendingSetup(userId: string): Promise<SetupView | null> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, totpEnabledAt: true, totpSecret: true } });
  if (user.totpEnabledAt || !user.totpSecret) return null;
  try {
    return setupView(user.email, openSecret(user.totpSecret));
  } catch {
    return null;
  }
}

/**
 * «Activar» con el primer código. En una transacción: activa, guarda el paso usado, crea los 10
 * códigos, marca la sesión actual como verificada en dos pasos y cierra las demás sesiones y los
 * dispositivos recordados (una sesión abierta por otra persona no sobrevive).
 */
export async function confirmSetup(
  userId: string,
  code: string,
  currentSessionId: string | null,
): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, totpSecret: true, totpEnabledAt: true } });
  if (user.totpEnabledAt) return { ok: false, error: "La verificación en dos pasos ya está activada." };
  const secret = readSecret(user);
  if (!secret) return { ok: false, error: "Vuelve a empezar la configuración." };
  const step = verifyTotp(secret, code);
  if (step === null) return { ok: false, error: WRONG_CODE };
  const codes = await prisma.$transaction(async (tx) => {
    const done = await tx.user.updateMany({ where: { id: userId, totpEnabledAt: null }, data: { totpEnabledAt: new Date(), totpLastStep: step } });
    if (done.count !== 1) return null;
    const list = await replaceRecoveryCodes(tx, userId);
    await tx.trustedDevice.deleteMany({ where: { userId } });
    await tx.twoFactorChallenge.deleteMany({ where: { userId } });
    if (currentSessionId) {
      await tx.session.updateMany({ where: { id: currentSessionId, userId }, data: { mfa: true } });
      await tx.session.deleteMany({ where: { userId, orderId: null, NOT: { id: currentSessionId } } });
    } else await tx.session.deleteMany({ where: { userId, orderId: null } });
    return list;
  });
  if (!codes) return { ok: false, error: "La verificación en dos pasos ya está activada." };
  return { ok: true, codes };
}

export const WRONG_CODE = "Código incorrecto. Comprueba que la hora del móvil es automática.";

// ── Códigos de recuperación ──

async function replaceRecoveryCodes(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
  await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
  await tx.twoFactorRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: recoveryCodeHash(c) })) });
  return codes;
}

/** «Generar códigos nuevos»: los anteriores dejan de valer y se olvidan los dispositivos. */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const list = await replaceRecoveryCodes(tx, userId);
    await tx.trustedDevice.deleteMany({ where: { userId } });
    return list;
  });
}

/** Gasta un código de recuperación (atómico: dos peticiones a la vez no pueden usar el mismo). */
export async function consumeRecoveryCode(userId: string, raw: string): Promise<boolean> {
  const code = normalizeRecoveryCode(raw);
  if (!/^[0-9a-hjkmnp-tv-z]{10}$/.test(code)) return false;
  const r = await prisma.twoFactorRecoveryCode.updateMany({ where: { userId, codeHash: recoveryCodeHash(code), usedAt: null }, data: { usedAt: new Date() } });
  return r.count === 1;
}

export async function remainingRecoveryCodes(userId: string): Promise<number> {
  return prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } });
}

// ── Segundo factor ──

/**
 * Comprueba un código: 6 cifras → la app (el paso se guarda de forma atómica, así el mismo código
 * no vale dos veces aunque lleguen dos peticiones a la vez); otra cosa → código de recuperación.
 */
export async function verifySecondFactor(userId: string, raw: string): Promise<"totp" | "recovery" | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true } });
  if (!user?.totpEnabledAt) return null;
  if (cleanTotpInput(raw)) {
    const secret = readSecret(user);
    if (!secret) return null;
    const step = verifyTotp(secret, raw, { lastStep: user.totpLastStep });
    if (step === null) return null;
    const r = await prisma.user.updateMany({
      where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return r.count === 1 ? "totp" : null;
  }
  return (await consumeRecoveryCode(userId, raw)) ? "recovery" : null;
}

/**
 * Volver a demostrar que es ella (desactivar, códigos nuevos, olvidar todos los dispositivos): un
 * código de la app o de recuperación y, si tiene contraseña, también la contraseña. La contraseña
 * se comprueba primero para no gastar un código de recuperación con una contraseña equivocada.
 */
export async function reauthenticate(user: { id: string; passwordHash: string | null }, i: { code: string; password?: string | null }) {
  if (user.passwordHash && !(await verifyPassword(i.password ?? "", user.passwordHash))) return false;
  return (await verifySecondFactor(user.id, i.code)) !== null;
}

/**
 * Desactiva la verificación: fuera el secreto, los códigos, los dispositivos y los pasos de login.
 * Desde el servidor (npm run auth:reset-2fa) se cierran además TODAS las sesiones.
 */
export async function disableTwoFactor(userId: string, o: { by: "user" | "server" }) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.trustedDevice.deleteMany({ where: { userId } }),
    prisma.twoFactorChallenge.deleteMany({ where: { userId } }),
    ...(o.by === "server" ? [prisma.session.deleteMany({ where: { userId } })] : []),
  ]);
}

// ── Paso de login ──

/** Crea el paso «falta el código» y devuelve el token de su cookie. */
export async function createChallenge(userId: string, o: { verified: boolean; redirectTo: string | null; method: LoginMethod }): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.twoFactorChallenge.create({
    data: {
      id: hashToken(token),
      userId,
      verified: o.verified,
      redirectTo: o.redirectTo ? safeNext(o.redirectTo, "") || null : null,
      method: o.method,
      expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000),
    },
  });
  return token;
}

export type Challenge = { id: string; userId: string; verified: boolean; redirectTo: string | null; attempts: number; method: string; email: string };

/** Paso vigente (sin usar, sin caducar y con intentos). null si no vale. */
export async function readChallenge(token: string | null | undefined): Promise<Challenge | null> {
  if (!token) return null;
  const ch = await prisma.twoFactorChallenge.findUnique({ where: { id: hashToken(token) }, include: { user: { select: { email: true, status: true, totpEnabledAt: true } } } });
  if (!ch || ch.usedAt || ch.expiresAt < new Date() || ch.attempts >= CHALLENGE_MAX_ATTEMPTS) return null;
  if (ch.user.status === "BLOCKED" || !ch.user.totpEnabledAt) return null;
  return { id: ch.id, userId: ch.userId, verified: ch.verified, redirectTo: ch.redirectTo, attempts: ch.attempts, method: ch.method, email: ch.user.email };
}

/** Gasta el paso (atómico: dos pestañas no pueden abrir dos sesiones con el mismo). */
export async function spendChallenge(id: string): Promise<boolean> {
  const r = await prisma.twoFactorChallenge.updateMany({ where: { id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  return r.count === 1;
}

/** Suma un intento fallado; devuelve cuántos lleva. */
export async function noteChallengeFailure(id: string): Promise<number> {
  const r = await prisma.twoFactorChallenge.update({ where: { id }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
  return r.attempts;
}

export async function deleteChallenge(token: string | null | undefined) {
  if (token) await prisma.twoFactorChallenge.deleteMany({ where: { id: hashToken(token) } });
}

// ── Dispositivos recordados ──

/** Recuerda este dispositivo 30 días. Devuelve el valor de la cookie («<id>.<token>»). */
export async function trustDevice(userId: string, label: string): Promise<{ cookie: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 86_400_000);
  const d = await prisma.trustedDevice.create({ data: { userId, tokenHash: hashToken(token), label: label.slice(0, 60), expiresAt } });
  return { cookie: `${d.id}.${token}`, expiresAt };
}

/** ¿La cookie es un dispositivo recordado vigente de esta usuaria? Anota el último uso. */
export async function isTrustedDevice(userId: string, cookie: string | null | undefined): Promise<boolean> {
  const dot = cookie ? cookie.indexOf(".") : -1;
  if (!cookie || dot < 1) return false;
  const token = cookie.slice(dot + 1);
  const d = await prisma.trustedDevice.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!d || d.id !== cookie.slice(0, dot) || d.userId !== userId || d.expiresAt < new Date()) return false;
  await prisma.trustedDevice.update({ where: { id: d.id }, data: { lastUsedAt: new Date() } });
  return true;
}

/** Olvida un dispositivo (`id`) o todos. Devuelve cuántos. */
export async function forgetDevices(userId: string, o: { id?: string } = {}): Promise<number> {
  const r = await prisma.trustedDevice.deleteMany({ where: { userId, ...(o.id ? { id: o.id } : {}) } });
  return r.count;
}

export async function listDevices(userId: string) {
  return prisma.trustedDevice.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true, label: true, lastUsedAt: true, expiresAt: true },
    orderBy: { lastUsedAt: "desc" },
  });
}

