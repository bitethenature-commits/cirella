import { redirect } from "next/navigation";
import { checkoutReturnPath } from "@/lib/payments/return";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/return?ref=…: la compradora vuelve de la página de pago de Stripe (success_url).
 * Si el aviso de Stripe aún no ha llegado, la entrega ocurre aquí (lib/payments/return.ts).
 */
export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref");
  redirect(ref ? await checkoutReturnPath(ref) : "/");
}
