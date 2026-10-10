"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, getCurrentUser, hashPassword, revokeOtherSessions, safeNext, sendMagicLink, verifyPassword } from "@/lib/auth";
import { sessionSatisfies } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { homeFor } from "@/lib/home";

export type FormState = { error?: string; ok?: string; email?: string } | undefined;

const SIGNUP_COOKIE = "cirella_signup";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100),
  name: z.string().trim().max(80).optional(),
});

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    name: form.get("name") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: String(form.get("email") ?? "") };
  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Nunca se fija contraseña ni se abre sesión sobre una cuenta existente sin probar que el email
    // es de quien lo escribe: se envía un enlace al propio email. Mismo mensaje haya o no contraseña.
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

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.passwordHash) return { error: "Esta cuenta no tiene contraseña. Entra con un enlace por email.", email };
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return { error: "Email o contraseña incorrectos.", email };
  if (user.status === "BLOCKED") return { error: "Esta cuenta está bloqueada. Escríbenos si crees que es un error.", email };
  // La contraseña solo «verifica» la sesión si el email ya está confirmado.
  const verified = !!user.emailVerifiedAt;
  await createSession(user.id, { verified });
  const next = form.get("next") ? safeNext(String(form.get("next")), "") : "";
  const dest = next || (await homeFor(user.id));
  // El área de cliente necesita el email confirmado: se pide con un enlace.
  if (!sessionSatisfies({ verified, scoped: false }, dest)) redirect(`/entrar?next=${encodeURIComponent(dest)}&motivo=confirmar`);
  redirect(dest);
}

const MAGIC_LINK_SENT = "Te hemos enviado un enlace. Ábrelo desde este móvil u ordenador y pulsa «Entrar».";

export async function requestMagicLink(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "Introduce un email válido." };
  const next = safeNext(String(form.get("next") ?? ""), "") || "/auth/continuar";
  // `c` (usuario de la creadora) solo pone su marca al email y a la pantalla «Entrar».
  const username = String(form.get("c") ?? "").trim().toLowerCase().slice(0, 30);
  const creator = username ? await prisma.creator.findUnique({ where: { username }, select: { id: true } }) : null;
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
  redirect(safeNext(String(form.get("next") ?? ""), "") || (await homeFor(user.id)));
}

/** «Reenviarme el enlace» del aviso «Confirma tu email» del panel. */
export async function resendVerification(_: FormState): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (user.emailVerifiedAt) return { ok: "Tu email ya está confirmado." };
  await sendMagicLink(user.email, "/panel", { purpose: "VERIFY_SIGNUP" });
  return { ok: `Te hemos enviado el enlace a ${user.email}.` };
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
