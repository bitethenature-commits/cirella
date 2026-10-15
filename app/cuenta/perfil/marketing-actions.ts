"use server";

import { revalidatePath } from "next/cache";
import { requireBuyerFull } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";

/** «Dejar de recibir»: retira el consentimiento de novedades de una creadora (RGPD art. 7.3). */
export async function withdrawMarketing(form: FormData) {
  const user = await requireBuyerFull("/cuenta/perfil");
  const creatorId = String(form.get("creatorId") ?? "");
  // Solo la ficha de clienta de esta persona con esa creadora.
  await prisma.customer.updateMany({ where: { userId: user.id, creatorId }, data: { marketingOptIn: false, marketingOptInAt: null } });
  revalidatePath("/cuenta/perfil");
}
