"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, sendMagicLink } from "@/lib/auth";
import { withdrawOrder } from "@/lib/refunds";

/**
 * «Desistir» de una compra (14 días). Hace falta una sesión verificada: una sesión abierta en un
 * checkout (sin demostrar que el email es suyo) recibe antes un enlace de acceso por email.
 */
export async function withdrawPurchase(form: FormData) {
  const user = await requireUser("/cuenta/compras");
  if (!user.sessionVerified) {
    await sendMagicLink(user.email, "/cuenta/compras");
    redirect("/cuenta/compras?error=verificar");
  }
  const r = await withdrawOrder({ orderId: String(form.get("orderId") ?? ""), userId: user.id, email: user.email });
  revalidatePath("/cuenta", "layout");
  // Solo códigos conocidos en la URL: el texto se elige en la página, nunca se refleja.
  redirect(`/cuenta/compras?${r.ok ? "ok=desistido" : `error=${r.code === "NOT_FOUND" ? "no-encontrado" : r.code === "PROVIDER" ? "pasarela" : "no-desistible"}`}`);
}
