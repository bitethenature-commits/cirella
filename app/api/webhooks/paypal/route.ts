import { NextResponse } from "next/server";
import { isPaymentProviderEnabled } from "@/lib/payments";
import { processWebhook } from "@/lib/payments/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/paypal: avisos de PayPal (pago aprobado, cobrado o rechazado, reembolsos y
 * disputas). Sin sesión ni CSRF: lo que da fe es la comprobación de la firma con PayPal
 * (PAYPAL_WEBHOOK_ID) sobre el cuerpo tal cual llega. Ver docs/modo-personal.md para los eventos.
 */
export async function POST(req: Request) {
  if (!isPaymentProviderEnabled("paypal")) return new NextResponse("No encontrado", { status: 404 });
  const raw = await req.text();
  const r = await processWebhook("paypal", raw, req.headers);
  return new NextResponse(r.body, { status: r.status });
}
