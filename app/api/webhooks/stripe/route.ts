import { NextResponse } from "next/server";
import { paymentProviderKey } from "@/lib/payments";
import { processWebhook } from "@/lib/payments/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe: avisos de Stripe (pagos, reembolsos, contracargos y, por el endpoint
 * de Connect, cambios en las cuentas de las creadoras). Sin sesión ni CSRF: lo que da fe es la firma
 * (STRIPE_WEBHOOK_SECRET / STRIPE_CONNECT_WEBHOOK_SECRET) sobre el cuerpo tal cual llega.
 * Ver docs/pagos-stripe.md para la lista de eventos.
 */
export async function POST(req: Request) {
  if (paymentProviderKey() !== "stripe") return new NextResponse("No encontrado", { status: 404 });
  const raw = await req.text();
  const r = await processWebhook("stripe", raw, req.headers);
  return new NextResponse(r.body, { status: r.status });
}
