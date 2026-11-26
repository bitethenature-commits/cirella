"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, sendMagicLink } from "@/lib/auth";
import { maskEmail, safeNext } from "@/lib/auth-utils";
import { requestClient } from "@/lib/client-ip";
import { limitMagicLink, limitNewsletterSignup } from "@/lib/limits";
import { brandName, subscribe } from "@/lib/newsletter";
import { newsletterConsentText } from "@/lib/newsletter-rules";
import { homeFoldPath } from "@/lib/site-sections";
import { getOwnerCreator, isPersonalMode } from "@/lib/site-mode";

export type PortalAccessState = { sent?: string; unlocked?: true; error?: string; name?: string; email?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(80, "El nombre es demasiado largo"),
  email: z.string().trim().toLowerCase().max(200).email("Revisa tu email"),
  consent: z.literal("on", { error: "Marca la casilla para recibir la newsletter" }),
  // Campo trampa invisible: una persona lo deja vacío.
  website: z.string().max(200).optional(),
});

/**
 * «Ver gratis» del candado del Portal de Noticias. Lo desbloquea ser suscriptora CONFIRMADA de la
 * newsletter y haber entrado en la cuenta, así que:
 *   · Sin sesión: se envía el enlace de «Crear mi cuenta» (LoginToken REGISTER, lib/magic-links.ts)
 *     con la newsletter pedida. Su clic es la confirmación (doble opt-in): confirma la suscripción, crea
 *     la cuenta si no la tenía, abre la sesión (completeLogin) y vuelve al portal ya desbloqueado.
 *     La respuesta es la misma tenga cuenta o no (nadie averigua quién está).
 *   · Con su sesión ya verificada (el email es suyo): se suscribe confirmada al momento.
 * Solo en la web personal (la newsletter es de la dueña).
 *
 * También lo usan los modelos de las páginas de los métodos («Calcular con mis datos») y «Mi energía»
 * (/area/energy), con la misma regla: `next` = la página a la que volver (una ruta interna; si no,
 * el portal) y `via=carta` = el email habla de calcular la carta en vez del portal.
 */
export async function requestPortalAccess(_: PortalAccessState, form: FormData): Promise<PortalAccessState> {
  if (!isPersonalMode()) return { error: "El portal no está disponible." };
  const owner = await getOwnerCreator();
  if (!owner) return { error: "El portal no está disponible." };
  const consentText = newsletterConsentText(brandName(owner));
  // Sin página propia: el desplegable del portal en la portada.
  const portal = homeFoldPath(owner.username, "portal", true);
  const next = safeNext(String(form.get("next") ?? ""), "") || portal;
  const via = form.get("via") === "carta" ? "carta" : "portal";
  const user = await getCurrentUser();

  // Ya ha entrado con un email demostrado: solo falta la casilla.
  if (user && user.sessionVerified && form.get("signedIn") === "1") {
    if (form.get("consent") !== "on") return { error: "Marca la casilla para recibir la newsletter" };
    const client = await requestClient();
    await subscribe(owner.id, {
      email: user.email,
      name: user.name,
      source: "FORM",
      confirmed: true,
      consentText,
      consentMeta: { form: via, ipHash: client.ipHash, userId: user.id },
    });
    revalidatePath(next.split(/[?#]/)[0]);
    return { unlocked: true };
  }

  const echo = { name: String(form.get("name") ?? "").slice(0, 80), email: String(form.get("email") ?? "").slice(0, 120) };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, ...echo };
  const { name, email, website } = parsed.data;
  if (website) return { sent: maskEmail(email) };
  const { ipHash } = await requestClient();
  const gate = await limitNewsletterSignup(email, ipHash);
  if (!gate.ok) return { error: gate.message, ...echo };
  const link = await limitMagicLink(email, ipHash);
  if (!link.ok) return { error: link.message, ...echo };
  const [path, hash] = next.split("#");
  await sendMagicLink(email, `${path}${path.includes("?") ? "&" : "?"}bienvenida=1${hash ? `#${hash}` : ""}`, {
    creatorId: owner.id,
    purpose: "REGISTER",
    name,
    data: { name, newsletter: true, creatorId: owner.id, via, consentText },
  });
  return { sent: maskEmail(email) };
}
