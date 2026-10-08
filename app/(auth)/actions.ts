"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, hashPassword, safeNext, sendMagicLink, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
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
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) return { error: "Ya existe una cuenta con este email. Entra con tu contraseña." };
  const passwordHash = await hashPassword(password);
  // Si ya compró antes (cuenta creada en un checkout), le añadimos contraseña.
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, name: existing.name ?? name } })
    : await prisma.user.create({ data: { email, passwordHash, name } });
  await createSession(user.id);
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
  redirect("/onboarding");
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return { error: "Email o contraseña incorrectos.", email };
  if (user.status === "BLOCKED") return { error: "Esta cuenta está bloqueada. Escríbenos si crees que es un error.", email };
  await createSession(user.id);
  const next = form.get("next") ? safeNext(String(form.get("next")), "") : "";
  redirect(next || (await homeFor(user.id)));
}

export async function requestMagicLink(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "Introduce un email válido." };
  const next = safeNext(String(form.get("next") ?? ""), "");
  // Respuesta idéntica exista o no la cuenta (no revelamos qué emails están registrados).
  await sendMagicLink(parsed.data, next || "/auth/continuar");
  return { ok: "Te hemos enviado un enlace de acceso. Revisa tu bandeja de entrada.", email: parsed.data };
}

export async function demoSignIn(form: FormData) {
  if (!isDemoMode()) redirect("/entrar");
  const email = String(form.get("email"));
  const allowed = ["ana@cirella.app", "laura@example.com", "admin@cirella.app", "maria@cirella.app"];
  if (!allowed.includes(email)) redirect("/entrar");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) redirect("/entrar?error=demo");
  await createSession(user.id);
  redirect(await homeFor(user.id));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
