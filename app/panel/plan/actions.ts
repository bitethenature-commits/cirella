"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant";
import { isPersonalMode } from "@/lib/site-mode";

/** Cambio de plan con cobro simulado (aplica primero el crédito de referidos). */
export async function changePlan(form: FormData) {
  if (isPersonalMode()) redirect("/panel");
  const { creator } = await requireCreator();
  const plan = await prisma.plan.findFirst({ where: { key: String(form.get("plan")), active: true } });
  if (!plan || plan.id === creator.planId) redirect("/panel/plan");
  const db = tenantDb(creator.id);
  const products = await db.product.count({ where: { status: { not: "ARCHIVED" } } });
  if (plan.maxProducts != null && products > plan.maxProducts)
    redirect(`/panel/plan?error=${encodeURIComponent(`Tienes ${products} productos y el plan ${plan.name} permite ${plan.maxProducts}. Archiva algunos antes de cambiar.`)}`);
  const credit = Math.min(creator.creditCents, plan.priceMonthlyCents);
  const charged = plan.priceMonthlyCents - credit;
  const renews = new Date();
  renews.setMonth(renews.getMonth() + 1);
  await prisma.$transaction([
    prisma.creator.update({ where: { id: creator.id }, data: { planId: plan.id, planRenewsAt: plan.priceMonthlyCents ? renews : null, creditCents: { decrement: credit } } }),
    ...(plan.priceMonthlyCents
      ? [
          prisma.transaction.create({
            data: {
              creatorId: creator.id,
              type: "PLAN_FEE",
              description: `Plan ${plan.name} · mensual${credit ? ` (crédito aplicado ${(credit / 100).toFixed(2)} €)` : ""}`,
              amountCents: charged,
              platformFeeCents: charged,
              netCents: 0,
              provider: "simulated",
            },
          }),
        ]
      : []),
  ]);
  // Los productos de tipos no incluidos en el nuevo plan dejan de mostrarse automáticamente
  // (lib/public.ts filtra por plan), pero nunca se borran.
  revalidatePath("/panel", "layout");
  redirect(`/panel/plan?ok=${encodeURIComponent(`¡Listo! Ahora estás en el plan ${plan.name}.`)}`);
}
