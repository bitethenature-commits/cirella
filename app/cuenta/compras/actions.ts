"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBuyerFull } from "@/lib/buyer-access";
import { withdrawOrder } from "@/lib/refunds";

/**
 * «Desistir» de una compra (14 días). Hace falta una sesión verificada (requireBuyerFull): una
 * sesión limitada a un pedido o sin confirmar el email va antes al login con un enlace.
 */
export async function withdrawPurchase(form: FormData) {
  const user = await requireBuyerFull("/cuenta/compras");
  const r = await withdrawOrder({ orderId: String(form.get("orderId") ?? ""), userId: user.id, email: user.email });
  revalidatePath("/cuenta", "layout");
  // Solo códigos conocidos en la URL: el texto se elige en la página, nunca se refleja.
  redirect(`/cuenta/compras?${r.ok ? "ok=desistido" : `error=${r.code === "NOT_FOUND" ? "no-encontrado" : r.code === "PROVIDER" ? "pasarela" : "no-desistible"}`}`);
}
