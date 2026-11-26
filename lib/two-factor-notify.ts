import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";
import { enqueueEmail } from "./email/outbox";
import { loginAlertEmail, twoFactorChangedEmail, twoFactorFailuresEmail, type TwoFactorEvent } from "./email/templates";
import { appUrl } from "./env";
import { isPersonalMode } from "./site-mode";
import { disableTwoFactor } from "./two-factor";
import { formatDate } from "./tz";
import { inMail } from "@/lib/i18n/email";

/**
 * Avisos por email de la verificación en dos pasos (bandeja de salida, con dedupeKey). Sin cookies:
 * reciben lo que necesitan. Nunca lanzan: un aviso que no sale no debe impedir entrar.
 */

type Who = { id: string; email: string; isAdmin: boolean; totpEnabledAt: Date | null; creator: { id: string; timezone: string | null } | null };

async function who(userId: string): Promise<Who | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isAdmin: true, totpEnabledAt: true, creator: { select: { id: true, timezone: true } } },
  });
}

/** Dónde se gestiona: el panel para las creadoras, la administración para las admins sin página. */
export function securityPath(u: { creator: unknown | null }) {
  return u.creator ? "/panel/ajustes/seguridad" : "/admin/seguridad";
}

const when = (u: Who, d = new Date()) =>
  formatDate(d, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }, u.creator?.timezone ?? "Europe/Madrid");

/**
 * «Nuevo acceso a tu panel»: sesión de cuenta nueva de una creadora o admin desde un dispositivo no
 * recordado. En la web personal siempre; en la plataforma, solo con la verificación activada.
 */
export async function notifyNewLogin(userId: string, o: { device: string; sessionId: string }) {
  try {
    const u = await who(userId);
    if (!u || !(u.creator || u.isAdmin) || !(isPersonalMode() || u.totpEnabledAt)) return;
    const key = createHash("sha256").update(o.sessionId).digest("hex").slice(0, 24);
    await enqueueEmail({
      to: u.email,
      template: "LOGIN_ALERT",
      userId: u.id,
      dedupeKey: `login:${key}`,
      ...(await inMail(u.email, () => loginAlertEmail({ when: when(u), device: o.device, settingsUrl: `${appUrl()}${u.creator ? "/panel/ajustes#contrasena" : securityPath(u)}` }))),
    });
  } catch (e) {
    console.error("Aviso de acceso no enviado", e);
  }
}

/** Cambio en la verificación (activada, desactivada, códigos nuevos…). */
export async function notifyTwoFactorChange(userId: string, event: TwoFactorEvent, o: { remaining?: number } = {}) {
  try {
    const u = await who(userId);
    if (!u) return;
    const minute = new Date().toISOString().slice(0, 16);
    await enqueueEmail({
      to: u.email,
      template: "TWO_FACTOR_CHANGED",
      userId: u.id,
      dedupeKey: `2fa:${u.id}:${event}:${minute}:${o.remaining ?? ""}`,
      ...(await inMail(u.email, () => twoFactorChangedEmail({ event, remaining: o.remaining, settingsUrl: `${appUrl()}${securityPath(u)}` }))),
    });
  } catch (e) {
    console.error("Aviso de la verificación en dos pasos no enviado", e);
  }
}

/** 3.er código fallado en un mismo paso de login (el primer factor era correcto). */
export async function notifyTwoFactorFailures(userId: string, o: { challengeId: string; device: string }) {
  try {
    const u = await who(userId);
    if (!u) return;
    await enqueueEmail({
      to: u.email,
      template: "TWO_FACTOR_FAILURES",
      userId: u.id,
      dedupeKey: `2fa-fail:${o.challengeId.slice(0, 24)}`,
      ...(await inMail(u.email, () => twoFactorFailuresEmail({ when: when(u), device: o.device, settingsUrl: `${appUrl()}${u.creator ? "/panel/ajustes#contrasena" : securityPath(u)}` }))),
    });
  } catch (e) {
    console.error("Aviso de intentos fallidos no enviado", e);
  }
}

/**
 * Reinicio de emergencia desde el servidor (npm run auth:reset-2fa): la dueña ha perdido el móvil y
 * los códigos. Quita la verificación, cierra TODAS sus sesiones y se lo cuenta por email.
 * null si no existe la cuenta; false si no la tenía activada (no hace nada).
 */
export async function resetTwoFactorFromServer(email: string): Promise<boolean | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, totpEnabledAt: true, totpSecret: true } });
  if (!user) return null;
  if (!user.totpEnabledAt && !user.totpSecret) return false;
  await disableTwoFactor(user.id, { by: "server" });
  await notifyTwoFactorChange(user.id, "reset");
  return true;
}
