"use server";

import { revalidatePath } from "next/cache";
import { requireBuyerFull } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { syncConsent } from "@/lib/newsletter";

/** «Dejar de recibir»: retira el consentimiento de novedades de una creadora (RGPD art. 7.3). */
export async function withdrawMarketing(form: FormData) {
  const user = await requireBuyerFull("/cuenta/perfil");
  const creatorId = String(form.get("creatorId") ?? "");
  // Solo la ficha de clienta de esta persona con esa creadora.
  await prisma.customer.updateMany({ where: { userId: user.id, creatorId }, data: { marketingOptIn: false, marketingOptInAt: null } });
  // También de su newsletter (si estaba apuntada con este email).
  if (creatorId) await syncConsent(prisma, { creatorId, email: user.email, on: false, source: "PROFILE", form: "perfil" });
  revalidatePath("/cuenta/soporte");
}
