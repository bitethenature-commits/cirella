"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, completeLogin, consumeMagicLink, hashToken } from "@/lib/auth";

/**
 * «Entrar» de la pantalla del enlace mágico. Solo aquí (un POST) se gasta el enlace: los antivirus
 * del correo abren los enlaces con GET y ya no pueden gastarlo.
 */
export async function confirmMagicLink(form: FormData) {
  const token = String(form.get("token") ?? "");
  const raw = form.get("choice");
  const choice = raw === "no" ? "no" : raw === "yes" ? "yes" : undefined;
  // «Sí, he sido yo» conserva la contraseña solo desde el navegador donde se creó la cuenta.
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const r = await consumeMagicLink(token, choice, { currentSessionId: session ? hashToken(session) : null });
  if (!r) redirect("/entrar?error=enlace");
  // El enlace ya está gastado: con la verificación en dos pasos se pide después el código, así un
  // email reenviado o robado no basta para abrir el panel.
  return completeLogin(r.user.id, { verified: true, next: r.redirectTo, method: "MAGIC_LINK" });
}
