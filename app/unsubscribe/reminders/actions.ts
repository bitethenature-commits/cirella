"use server";

import { redirect } from "next/navigation";
import { optOutTarget, recordOptOut } from "@/lib/recovery-optout";

/** «Darme de baja»: el enlace firmado identifica el pedido, y de él salen la creadora y el email. */
export async function confirmOptOut(form: FormData) {
  const t = String(form.get("t") ?? "");
  const target = await optOutTarget(t);
  if (!target) redirect(`/unsubscribe/reminders?t=${encodeURIComponent(t)}`);
  await recordOptOut(target.creatorId, target.email);
  redirect(`/unsubscribe/reminders?t=${encodeURIComponent(t)}&hecho=1`);
}
