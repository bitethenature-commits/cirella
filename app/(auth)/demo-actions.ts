"use server";

import { redirect } from "next/navigation";
import { completeLogin, safeNext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

/** Cuentas de la demo a las que se puede entrar con un clic (solo con DEMO_MODE, nunca en producción). */
const DEMO_ACCOUNTS = ["ana@cirella.app", "laura@example.com", "admin@cirella.app", "maria@cirella.app"];

export async function demoSignIn(form: FormData): Promise<never> {
  if (!isDemoMode()) redirect("/login");
  const email = String(form.get("email"));
  if (!DEMO_ACCOUNTS.includes(email)) redirect("/login");
  const next = safeNext(String(form.get("next") ?? ""), "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) redirect("/login?error=demo");
  // Las cuentas de la demo no tienen la verificación en dos pasos (prisma/seed.ts): entra directa.
  // Si alguien la activa en la demo, también se le pide el código.
  return completeLogin(user.id, { verified: true, next, method: "DEMO" });
}
