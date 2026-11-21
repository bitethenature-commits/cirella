"use server";

import { z } from "zod";
import { maskEmail } from "@/lib/auth-utils";
import { requestClient } from "@/lib/client-ip";
import { limitNewsletterSignup } from "@/lib/limits";
import { brandName, sendConfirmation, subscribe } from "@/lib/newsletter";
import { newsletterConsentText } from "@/lib/newsletter-rules";
import { getOwnerCreator, isPersonalMode } from "@/lib/site-mode";

export type NewsletterSignupState = { ok?: true; email?: string; error?: string } | undefined;

const schema = z.object({
  email: z.string().trim().toLowerCase().max(200).email("Revisa tu email"),
  name: z.string().trim().max(80, "El nombre es demasiado largo").optional(),
  where: z.enum(["section", "footer"]).catch("section"),
  // Campo trampa invisible: una persona lo deja vacío.
  website: z.string().max(200).optional(),
});

/**
 * «Apuntarme» del formulario de la newsletter (sección de la portada o pie de la web personal).
 * Doble opt-in: queda pendiente y le llega «Confirma que quieres recibir la newsletter». La
 * respuesta es la misma si ya estaba apuntada, confirmada o dada de baja: el formulario no dice qué
 * emails hay en la lista.
 */
export async function subscribeFromPage(_: NewsletterSignupState, form: FormData): Promise<NewsletterSignupState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const owner = isPersonalMode() ? await getOwnerCreator() : null;
  if (!owner) return { error: "La newsletter no está disponible." };
  if (input.website) return { ok: true, email: maskEmail(input.email) };
  const client = await requestClient();
  const gate = await limitNewsletterSignup(input.email, client.ipHash);
  if (!gate.ok) return { error: gate.message };
  const r = await subscribe(owner.id, {
    email: input.email,
    name: input.name || null,
    source: "FORM",
    confirmed: false,
    consentText: newsletterConsentText(brandName(owner)),
    consentMeta: { form: input.where === "footer" ? "pie" : "portada", ipHash: client.ipHash },
  });
  if (r.needsConfirmation) await sendConfirmation(r.subscriberId);
  return { ok: true, email: maskEmail(input.email) };
}
