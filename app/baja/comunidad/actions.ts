"use server";

import { redirect } from "next/navigation";
import { postOptOutTarget, setPostEmails } from "@/lib/community-optout";

/** «Darme de baja»: el enlace firmado identifica a la clienta (y con ella, la comunidad). */
export async function confirmCommunityOptOut(form: FormData) {
  const t = String(form.get("t") ?? "");
  const target = await postOptOutTarget(t);
  if (!target) redirect(`/baja/comunidad?t=${encodeURIComponent(t)}`);
  await setPostEmails(target.customerId, false);
  redirect(`/baja/comunidad?t=${encodeURIComponent(t)}&hecho=1`);
}
