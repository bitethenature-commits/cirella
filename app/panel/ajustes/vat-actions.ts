"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPaymentProvider } from "@/lib/payments";
import { VAT_STATUSES } from "@/lib/tax";
import { isPersonalMode } from "@/lib/site-mode";

const schema = z
  .object({
    vatStatus: z.enum(VAT_STATUSES as [string, ...string[]], { message: "Elige tu situación de IVA" }),
    vatExemptionNote: z.string().trim().max(200, "El motivo de la exención es demasiado largo").optional(),
  })
  .refine((d) => d.vatStatus !== "EXEMPT" || (d.vatExemptionNote ?? "").length >= 3, { message: "Escribe el motivo de la exención" });

/** Situación de IVA de la creadora (decide el IVA de las ventas en las que vende ella). */
export async function saveVatStatus(form: FormData) {
  // Web personal que no cobra: no hay ventas a las que poner IVA.
  if (isPersonalMode() && !hasPaymentProvider()) redirect("/panel/ajustes");
  const { creator } = await requireCreator();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/panel/ajustes?error=${encodeURIComponent(parsed.error.issues[0].message)}#iva`);
  const d = parsed.data;
  // La ventanilla única «no Unión» solo existe en la web personal (en la plataforma vende Cirella).
  if (d.vatStatus === "OSS_NON_UNION" && !isPersonalMode()) redirect(`/panel/ajustes?error=${encodeURIComponent("Elige tu situación de IVA")}#iva`);
  await prisma.creator.update({
    where: { id: creator.id },
    data: { vatStatus: d.vatStatus, vatExemptionNote: d.vatStatus === "EXEMPT" ? d.vatExemptionNote! : null },
  });
  // Cambian las etiquetas «IVA incluido» de su página y el checkout.
  revalidatePath("/", "layout");
  redirect(`/panel/ajustes?ok=${encodeURIComponent("Datos de IVA guardados")}#iva`);
}
