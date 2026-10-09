"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { PRODUCT_TYPES } from "@/lib/types";

/** Qué tipos de producto cuentan como «servicios personales» para DAC7 (criterio de la asesoría). */
export async function saveDac7Types(form: FormData) {
  await requireAdmin();
  const types = PRODUCT_TYPES.filter((t) => form.getAll("types").includes(t));
  const year = String(form.get("anio") ?? "");
  await setSetting("dac7ReportableTypes", types);
  revalidatePath("/admin/reportes/dac7");
  revalidatePath("/panel", "layout");
  redirect(`/admin/reportes/dac7?${/^\d{4}$/.test(year) ? `anio=${year}&` : ""}ok=${encodeURIComponent("Tipos declarables guardados")}`);
}
