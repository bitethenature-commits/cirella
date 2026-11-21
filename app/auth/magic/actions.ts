"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, completeLogin, consumeMagicLink, hashToken, peekMagicLink } from "@/lib/auth";
import { maskEmail } from "@/lib/auth-utils";
import { enqueueEmail } from "@/lib/email/outbox";
import { emailChangedEmail } from "@/lib/email/templates";
import { consumeEmailChange } from "@/lib/magic-links";

/**
 * «Entrar» de la pantalla del enlace mágico. Solo aquí (un POST) se gasta el enlace: los antivirus
 * del correo abren los enlaces con GET y ya no pueden gastarlo.
 */
export async function confirmMagicLink(form: FormData) {
  const token = String(form.get("token") ?? "");
  // Cambio de email: se confirma desde el buzón nuevo; se avisa al de antes y se entra de nuevo
  // (todas las sesiones se han cerrado; con la verificación en dos pasos se pide el código).
  if ((await peekMagicLink(token))?.purpose === "CHANGE_EMAIL") {
    const change = await consumeEmailChange(token);
    if (change === "taken") redirect("/cuenta/soporte?error=email-ocupado#perfil");
    if (!change) redirect("/entrar?error=enlace");
    await enqueueEmail({
      to: change.fromEmail,
      template: "EMAIL_CHANGED",
      userId: change.user.id,
      dedupeKey: `email-changed:${change.user.id}:${change.tokenId}`,
      ...emailChangedEmail({ newEmailMasked: maskEmail(change.user.email) }),
    });
    return completeLogin(change.user.id, { verified: true, next: "/cuenta/soporte?ok=email#perfil", method: "MAGIC_LINK" });
  }
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
