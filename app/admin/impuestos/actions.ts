"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { TAX_MODES, type TaxMode } from "@/lib/tax";

/** Política de IVA de la plataforma. Los datos fiscales de la empresa se editan en /admin/ajustes. */
export async function saveTaxSettings(form: FormData) {
  await requireAdmin();
  const parsed = z.enum(TAX_MODES as [TaxMode, ...TaxMode[]]).safeParse(form.get("taxMode"));
  if (!parsed.success) redirect(`/admin/impuestos?error=${encodeURIComponent("Elige una política de IVA")}`);
  await setSetting("taxMode", parsed.data);
  revalidatePath("/admin", "layout");
  // Cambian las etiquetas «IVA incluido» de todas las páginas públicas y los checkouts.
  revalidatePath("/", "layout");
  redirect(`/admin/impuestos?ok=${encodeURIComponent("Política de IVA guardada")}`);
}
