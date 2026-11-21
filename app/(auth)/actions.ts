"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { completeLogin, createSession, destroySession, getCurrentUser, hashPassword, revokeOtherSessions, safeNext, sendMagicLink, verifyPassword } from "@/lib/auth";
import { requestClient } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { homeFor } from "@/lib/home";
import { clearLoginLimit, limitLogin, limitMagicLink, limitSignup } from "@/lib/limits";
import { isPersonalMode } from "@/lib/site-mode";
import { forgetDevices } from "@/lib/two-factor";
import { notifyTwoFactorChange } from "@/lib/two-factor-notify";

export type FormState = { error?: string; ok?: string; email?: string } | undefined;

const SIGNUP_COOKIE = "cirella_signup";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100),
  name: z.string().trim().max(80).optional(),
});

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  // Modo personal: registro cerrado (el formulario ni se muestra; esto cubre llamadas directas).
  if (isPersonalMode()) redirect("/entrar");
  const parsed = signupSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    name: form.get("name") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: String(form.get("email") ?? "") };
  const { email, password, name } = parsed.data;
  const { ipHash } = await requestClient();
  const signupLimit = await limitSignup(ipHash);
  if (!signupLimit.ok) return { error: signupLimit.message, email };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Nunca se fija contraseña ni se abre sesión sobre una cuenta existente sin probar que el email
    // es de quien lo escribe: se envía un enlace al propio email. Mismo mensaje haya o no contraseña.
    const linkLimit = await limitMagicLink(email, ipHash);
    if (!linkLimit.ok) return { error: linkLimit.message, email };
    await setSignupCookie(form);
    await sendMagicLink(email, existing.passwordHash ? "/auth/continuar" : "/contrasena?next=%2Fonboarding");
    return { ok: "Ya tienes una cuenta con este email. Te hemos enviado un enlace para entrar (y crear tu contraseña si aún no la tienes).", email };
  }
  // Alta nueva: entra ya en el onboarding (no frenamos la conversión), pero con una sesión sin
  // verificar hasta que confirme el email («Sí, he sido yo» / «No he sido yo»).
  const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), name } });
  await createSession(user.id, { verified: false });
  await sendMagicLink(email, "/auth/continuar", { purpose: "VERIFY_SIGNUP" });
  await setSignupCookie(form);
  redirect("/onboarding");
}

async function setSignupCookie(form: FormData) {
  const jar = await cookies();
  jar.set(
    SIGNUP_COOKIE,
    JSON.stringify({
      ref: String(form.get("ref") ?? "").slice(0, 20),
      username: String(form.get("username") ?? "").slice(0, 30),
      plan: String(form.get("plan") ?? "").slice(0, 20),
    }),
    { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 },
  );
}

/** Hash ficticio: igualamos el tiempo de respuesta exista o no la cuenta (bcrypt siempre se ejecuta). */
const DUMMY_HASH = "$2b$10$Sgz8oEVRljB0oWxR6NRZveN43Onq8qYgAaggGdjJ8Bn0NRni4UERO";

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!z.string().email().safeParse(email).success) return { error: "Email o contraseña incorrectos.", email };
  const { ipHash } = await requestClient();
  const limit = await limitLogin(email, ipHash);
  if (!limit.ok) return { error: limit.message, email };
  const user = await prisma.user.findUnique({ where: { email } });
  // Mismo mensaje y mismo tiempo exista o no la cuenta, y tenga o no contraseña: si no, cualquiera
  // podría comprobar en silencio si un email ha comprado en Cirella. La pista para quien compró
  // sin contraseña está siempre visible en el formulario.
  const valid = await verifyPassword(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !user.passwordHash || !valid) return { error: "Email o contraseña incorrectos.", email };
  await clearLoginLimit(email);
  if (user.status === "BLOCKED") return { error: "Esta cuenta está bloqueada. Escríbenos si crees que es un error.", email };
  // La contraseña solo «verifica» la sesión si el email ya está confirmado. Con la verificación en
  // dos pasos, completeLogin pide antes el código; el área de cliente sin el email confirmado pide
  // un enlace (finishLogin).
  const verified = !!user.emailVerifiedAt;
  const next = form.get("next") ? safeNext(String(form.get("next")), "") : "";
  return completeLogin(user.id, { verified, next, method: "PASSWORD" });
}

const MAGIC_LINK_SENT = "Te hemos enviado un enlace. Ábrelo desde este móvil u ordenador y pulsa «Entrar».";

export async function requestMagicLink(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "Introduce un email válido." };
  const next = safeNext(String(form.get("next") ?? ""), "") || "/auth/continuar";
  // `c` (usuario de la creadora) solo pone su marca al email y a la pantalla «Entrar».
  const username = String(form.get("c") ?? "").trim().toLowerCase().slice(0, 30);
  const creator = username ? await prisma.creator.findUnique({ where: { username }, select: { id: true } }) : null;
  const { ipHash } = await requestClient();
  const limit = await limitMagicLink(parsed.data, ipHash);
  if (!limit.ok) return { error: limit.message, email: parsed.data };
  // Respuesta idéntica exista o no la cuenta (no revelamos qué emails están registrados).
  await sendMagicLink(parsed.data, next, { creatorId: creator?.id });
  return { ok: MAGIC_LINK_SENT, email: parsed.data };
}

const passwordSchema = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100, "La contraseña es demasiado larga");

/** «Crea tu contraseña» (tras un enlace mágico): solo con una sesión de cuenta verificada. */
export async function setPassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.sessionVerified) redirect("/entrar?motivo=confirmar");
  const parsed = passwordSchema.safeParse(form.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data) } });
  await revokeOtherSessions(user.id);
  // Una contraseña nueva olvida los dispositivos recordados de la verificación en dos pasos.
  if ((await forgetDevices(user.id)) > 0 || user.totpEnabledAt) await notifyTwoFactorChange(user.id, "password");
  redirect(safeNext(String(form.get("next") ?? ""), "") || (await homeFor(user.id)));
}

/** «Reenviarme el enlace» del aviso «Confirma tu email» del panel. */
export async function resendVerification(_: FormState): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (user.emailVerifiedAt) return { ok: "Tu email ya está confirmado." };
  const limit = await limitMagicLink(user.email, (await requestClient()).ipHash);
  if (!limit.ok) return { error: limit.message };
  await sendMagicLink(user.email, "/panel", { purpose: "VERIFY_SIGNUP" });
  return { ok: `Te hemos enviado el enlace a ${user.email}.` };
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
