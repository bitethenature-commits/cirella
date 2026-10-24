"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, requireAdmin, requireCreator } from "@/lib/auth";
import { requestClient } from "@/lib/client-ip";
import { clearTwoFactorLimit, limitTwoFactor } from "@/lib/limits";
import {
  TWO_FACTOR_BANNER_COOKIE,
  WRONG_CODE,
  beginSetup,
  confirmSetup,
  disableTwoFactor,
  forgetDevices,
  reauthenticate,
  regenerateRecoveryCodes,
} from "@/lib/two-factor";
import { notifyTwoFactorChange } from "@/lib/two-factor-notify";

/**
 * Verificación en dos pasos de la cuenta: desde el panel (/panel/ajustes/seguridad) o, para las
 * admins sin página, desde /admin/seguridad (campo `scope`). Desactivar, generar códigos nuevos y
 * olvidar todos los dispositivos piden volver a demostrar que es ella (código + contraseña si tiene).
 */

export type SecurityState = { error?: string; codes?: string[] } | undefined;

type Scope = "panel" | "admin";
const scopeOf = (form: FormData): Scope => (form.get("scope") === "admin" ? "admin" : "panel");
const basePath = (scope: Scope) => (scope === "admin" ? "/admin/seguridad" : "/panel/ajustes/seguridad");

async function account(scope: Scope) {
  const user = scope === "admin" ? await requireAdmin() : (await requireCreator()).user;
  const session = await getSession();
  return { user, sessionId: session && !session.orderId ? session.id : null };
}

/** Límite de intentos de código también aquí: una sesión robada no sirve para adivinar. */
async function limited(userId: string) {
  const v = await limitTwoFactor(userId, (await requestClient()).ipHash);
  return v.ok ? null : v.message;
}

async function reauth(user: { id: string; passwordHash: string | null }, form: FormData): Promise<string | null> {
  const blocked = await limited(user.id);
  if (blocked) return blocked;
  const ok = await reauthenticate(user, { code: String(form.get("code") ?? ""), password: String(form.get("password") ?? "") });
  if (!ok) return user.passwordHash ? "El código o la contraseña no son correctos." : WRONG_CODE;
  await clearTwoFactorLimit(user.id);
  return null;
}

/** «Empezar»: secreto nuevo y a la pantalla de configuración. */
export async function startTwoFactorSetup(form: FormData) {
  const scope = scopeOf(form);
  const { user } = await account(scope);
  if (!(await beginSetup(user.id))) redirect(basePath(scope));
  redirect(`${basePath(scope)}?paso=configurar`);
}

/** «Activar» con el primer código: devuelve los 10 códigos de recuperación (una sola vez). */
export async function confirmTwoFactorSetup(_: SecurityState, form: FormData): Promise<SecurityState> {
  const { user, sessionId } = await account(scopeOf(form));
  const blocked = await limited(user.id);
  if (blocked) return { error: blocked };
  const r = await confirmSetup(user.id, String(form.get("code") ?? ""), sessionId);
  if (!r.ok) return { error: r.error };
  await clearTwoFactorLimit(user.id);
  await notifyTwoFactorChange(user.id, "enabled");
  // Sin revalidatePath: la pantalla sigue enseñando los códigos hasta que pulse «Terminar».
  return { codes: r.codes };
}

export async function regenerateCodes(_: SecurityState, form: FormData): Promise<SecurityState> {
  const { user } = await account(scopeOf(form));
  if (!user.totpEnabledAt) return { error: "La verificación en dos pasos no está activada." };
  const err = await reauth(user, form);
  if (err) return { error: err };
  const codes = await regenerateRecoveryCodes(user.id);
  await notifyTwoFactorChange(user.id, "codes");
  return { codes };
}

/** «Desactivar» o, con then=configurar, «Configurar de nuevo» (móvil nuevo: siempre con códigos nuevos). */
export async function disableTwoFactorAction(_: SecurityState, form: FormData): Promise<SecurityState> {
  const scope = scopeOf(form);
  const { user } = await account(scope);
  if (!user.totpEnabledAt) redirect(basePath(scope));
  const err = await reauth(user, form);
  if (err) return { error: err };
  await disableTwoFactor(user.id, { by: "user" });
  await notifyTwoFactorChange(user.id, "disabled");
  if (form.get("then") === "configurar") {
    await beginSetup(user.id);
    redirect(`${basePath(scope)}?paso=configurar`);
  }
  redirect(`${basePath(scope)}?ok=desactivada`);
}

export async function forgetDevice(form: FormData) {
  const scope = scopeOf(form);
  const { user } = await account(scope);
  // Olvidar uno solo quita confianza: no hace falta volver a confirmar.
  await forgetDevices(user.id, { id: String(form.get("id") ?? "") || "-" });
  redirect(`${basePath(scope)}?ok=olvidado`);
}

export async function forgetAllDevices(_: SecurityState, form: FormData): Promise<SecurityState> {
  const scope = scopeOf(form);
  const { user } = await account(scope);
  const err = await reauth(user, form);
  if (err) return { error: err };
  await forgetDevices(user.id);
  await notifyTwoFactorChange(user.id, "devices");
  redirect(`${basePath(scope)}?ok=olvidados`);
}

/** «Ahora no» del aviso del panel: no vuelve a salir en 30 días. */
export async function dismissTwoFactorBanner() {
  await requireCreator();
  (await cookies()).set(TWO_FACTOR_BANNER_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
}
