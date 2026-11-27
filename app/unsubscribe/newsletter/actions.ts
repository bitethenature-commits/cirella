"use server";

import { redirect } from "next/navigation";
import { unsubscribeByToken } from "@/lib/newsletter";

/** «Darme de baja»: el enlace firmado identifica a la suscriptora (y la newsletter de la que viene). */
export async function confirmNewsletterOptOut(form: FormData) {
  const t = String(form.get("t") ?? "");
  const r = await unsubscribeByToken(t, "LINK");
  redirect(`/unsubscribe/newsletter?t=${encodeURIComponent(t)}${r ? "&hecho=1" : ""}`);
}
