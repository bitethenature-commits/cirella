import { redirect } from "next/navigation";
import { checkoutReturnPath } from "@/lib/payments/return";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/return?via=…&ref=…: la compradora vuelve de la página de pago de Stripe
 * (success_url) o de PayPal (que añade «&token=<pedido de PayPal>»). Si el aviso de la pasarela aún
 * no ha llegado, la entrega ocurre aquí (lib/payments/return.ts).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const ref = params.get("ref") || params.get("token");
  redirect(ref ? await checkoutReturnPath(ref, params.get("via")) : "/");
}
