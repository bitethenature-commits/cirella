"use server";

import { redirect } from "next/navigation";
import { confirmByToken } from "@/lib/newsletter";

/** «Sí, quiero recibirla»: el enlace firmado identifica a la suscriptora. Idempotente. */
export async function confirmNewsletterSignup(form: FormData) {
  const t = String(form.get("t") ?? "");
  const r = await confirmByToken(t);
  redirect(`/novedades/confirmar?t=${encodeURIComponent(t)}${r ? "&hecho=1" : ""}`);
}
