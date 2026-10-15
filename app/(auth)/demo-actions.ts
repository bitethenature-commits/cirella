"use server";

import { redirect } from "next/navigation";
import { createSession, safeNext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { homeFor } from "@/lib/home";

/** Cuentas de la demo a las que se puede entrar con un clic (solo con DEMO_MODE, nunca en producción). */
const DEMO_ACCOUNTS = ["ana@cirella.app", "laura@example.com", "admin@cirella.app", "maria@cirella.app"];

export async function demoSignIn(form: FormData): Promise<never> {
  if (!isDemoMode()) redirect("/entrar");
  const email = String(form.get("email"));
  if (!DEMO_ACCOUNTS.includes(email)) redirect("/entrar");
  const next = safeNext(String(form.get("next") ?? ""), "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) redirect("/entrar?error=demo");
  await createSession(user.id, { verified: true });
  redirect(next || (await homeFor(user.id)));
}
