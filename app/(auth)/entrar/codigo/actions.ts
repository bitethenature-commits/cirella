"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TRUSTED_DEVICE_COOKIE, TWO_FACTOR_COOKIE, finishLogin } from "@/lib/auth";
import { deviceLabel } from "@/lib/auth-utils";
import { requestClient } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { clearTwoFactorLimit, limitTwoFactor } from "@/lib/limits";
import {
  CHALLENGE_MAX_ATTEMPTS,
  FAILURE_ALERT_AT,
  WRONG_CODE,
  deleteChallenge,
  noteChallengeFailure,
  readChallenge,
  remainingRecoveryCodes,
  spendChallenge,
  trustDevice,
  verifySecondFactor,
} from "@/lib/two-factor";
import { notifyTwoFactorChange, notifyTwoFactorFailures, securityPath } from "@/lib/two-factor-notify";

export type CodeState = { error?: string } | undefined;

/**
 * «Entrar» de /entrar/codigo: el código de la app (o uno de recuperación) convierte el paso del
 * login en una sesión con el segundo factor. Nunca dice si falló la contraseña en el paso anterior.
 */
export async function verifyLoginCode(_: CodeState, form: FormData): Promise<CodeState> {
  const jar = await cookies();
  const token = jar.get(TWO_FACTOR_COOKIE)?.value;
  const ch = await readChallenge(token);
  if (!ch) redirect("/entrar?error=codigo");
  const code = String(form.get("code") ?? "").slice(0, 40);
  if (!code.trim()) return { error: "Escribe el código." };
  const { ipHash, ua } = await requestClient();
  const limit = await limitTwoFactor(ch.userId, ipHash);
  if (!limit.ok) return { error: limit.message };

  const kind = await verifySecondFactor(ch.userId, code);
  if (!kind) {
    const attempts = await noteChallengeFailure(ch.id);
    if (attempts === FAILURE_ALERT_AT) await notifyTwoFactorFailures(ch.userId, { challengeId: ch.id, device: deviceLabel(ua) });
    if (attempts >= CHALLENGE_MAX_ATTEMPTS) {
      jar.delete(TWO_FACTOR_COOKIE);
      redirect("/entrar?error=codigo");
    }
    return { error: WRONG_CODE };
  }
  // Atómico: dos pestañas con el mismo paso no abren dos sesiones.
  if (!(await spendChallenge(ch.id))) redirect("/entrar?error=codigo");
  await clearTwoFactorLimit(ch.userId);
  jar.delete(TWO_FACTOR_COOKIE);
  if (form.get("remember") === "on") {
    const d = await trustDevice(ch.userId, deviceLabel(ua));
    jar.set(TRUSTED_DEVICE_COOKIE, d.cookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: d.expiresAt });
  }
  let next = ch.redirectTo;
  if (kind === "recovery") {
    const remaining = await remainingRecoveryCodes(ch.userId);
    await notifyTwoFactorChange(ch.userId, "recovery_used", { remaining });
    // Sin destino pedido (o el genérico del enlace), a su pantalla de seguridad: si ha cambiado de
    // móvil, que la configure de nuevo.
    if (!next || next === "/auth/continuar") {
      const u = await prisma.user.findUniqueOrThrow({ where: { id: ch.userId }, select: { creator: { select: { id: true } }, isAdmin: true } });
      if (u.creator || u.isAdmin) next = `${securityPath(u)}?aviso=recuperacion`;
    }
  }
  return finishLogin(ch.userId, { verified: ch.verified, next, mfa: true, alert: ch.method !== "DEMO" });
}

/** «Volver a empezar»: olvida el paso y vuelve a /entrar. */
export async function cancelChallenge(): Promise<never> {
  const jar = await cookies();
  await deleteChallenge(jar.get(TWO_FACTOR_COOKIE)?.value);
  jar.delete(TWO_FACTOR_COOKIE);
  redirect("/entrar");
}
