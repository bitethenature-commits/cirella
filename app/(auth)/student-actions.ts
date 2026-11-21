"use server";

import { z } from "zod";
import { sendMagicLink } from "@/lib/auth";
import { maskEmail } from "@/lib/auth-utils";
import { requestClient } from "@/lib/client-ip";
import { limitMagicLink, limitSignup } from "@/lib/limits";
import { getOwnerCreator, isPersonalMode } from "@/lib/site-mode";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";

export type StudentSignupState = { error?: string; sent?: string; name?: string; email?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(80, "El nombre es demasiado largo"),
  email: z.string().trim().toLowerCase().email("Introduce un email válido"),
});

/**
 * «Crear mi cuenta» de la web personal (pestaña de /{dueña}/entrar). No crea nada: envía un enlace
 * (LoginToken REGISTER con el nombre y la casilla de novedades) y la cuenta se crea o se abre al
 * confirmarlo (lib/magic-links.ts → applyRegistration). La respuesta es la misma exista o no el
 * email (nadie puede averiguar quién tiene cuenta). En la plataforma no existe.
 */
export async function registerStudent(_: StudentSignupState, form: FormData): Promise<StudentSignupState> {
  if (!isPersonalMode()) return { error: "Aquí no se pueden crear cuentas. Entra con tu email." };
  const parsed = schema.safeParse({ name: form.get("name"), email: form.get("email") });
  const echo = { name: String(form.get("name") ?? "").slice(0, 80), email: String(form.get("email") ?? "").slice(0, 120) };
  if (!parsed.success) return { error: parsed.error.issues[0].message, ...echo };
  const { name, email } = parsed.data;
  const owner = await getOwnerCreator();
  if (!owner) return { error: "Esta web aún no está lista. Vuelve a intentarlo más tarde.", ...echo };
  const { ip, ipHash } = await requestClient();
  if (turnstileEnabled() && (await verifyTurnstile(String(form.get("turnstile") ?? ""), ip)) === "invalid")
    return { error: "No hemos podido comprobar que eres una persona. Vuelve a intentarlo.", ...echo };
  const signup = await limitSignup(ipHash);
  if (!signup.ok) return { error: signup.message, ...echo };
  const link = await limitMagicLink(email, ipHash);
  if (!link.ok) return { error: link.message, ...echo };
  await sendMagicLink(email, "/cuenta?bienvenida=1", {
    creatorId: owner.id,
    purpose: "REGISTER",
    name,
    data: { name, newsletter: form.get("newsletter") === "on", creatorId: owner.id },
  });
  return { sent: maskEmail(email) };
}
