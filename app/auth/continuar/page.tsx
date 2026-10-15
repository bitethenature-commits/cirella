import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/home";

export const dynamic = "force-dynamic";

/**
 * Destino tras un enlace mágico sin `next`: panel, cuenta u onboarding según el usuario. Es una
 * página (no un route handler) para que también funcione al llegar desde una Server Action.
 * Una sesión limitada a un pedido va a /cuenta, que la lleva a su compra.
 */
export default async function ContinuePage() {
  const s = await getSession();
  if (!s) redirect("/entrar");
  redirect(s.orderId ? "/cuenta" : await homeFor(s.user.id));
}
