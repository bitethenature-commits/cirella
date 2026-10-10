"use server";

import { redirect } from "next/navigation";
import { consumeMagicLink, createSession } from "@/lib/auth";

/**
 * «Entrar» de la pantalla del enlace mágico. Solo aquí (un POST) se gasta el enlace: los antivirus
 * del correo abren los enlaces con GET y ya no pueden gastarlo.
 */
export async function confirmMagicLink(form: FormData) {
  const token = String(form.get("token") ?? "");
  const raw = form.get("choice");
  const choice = raw === "no" ? "no" : raw === "yes" ? "yes" : undefined;
  const r = await consumeMagicLink(token, choice);
  if (!r) redirect("/entrar?error=enlace");
  await createSession(r.user.id, { verified: true });
  redirect(r.redirectTo);
}
