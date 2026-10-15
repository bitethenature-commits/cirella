"use server";

import { redirect } from "next/navigation";
import { requireBuyerFor } from "@/lib/buyer-access";
import { confirmNewsletter } from "@/lib/free-access";
import { newsletterConfirmPath } from "@/lib/free-access-rules";

/**
 * «Sí, quiero recibir novedades». Un POST y no el enlace del email: los antivirus y los
 * previsualizadores de correo abren los enlaces solos y no deben confirmar nada por nadie. Solo
 * la sesión de ese pedido (abierta con el enlace de su email) o la cuenta verificada de esa persona.
 */
export async function confirmNewsletterAction(form: FormData) {
  const orderId = String(form.get("pedido") ?? "").slice(0, 40);
  const back = newsletterConfirmPath(orderId);
  const { user } = await requireBuyerFor({ orderId }, back);
  await confirmNewsletter({ orderId, userId: user.id });
  redirect(back);
}
