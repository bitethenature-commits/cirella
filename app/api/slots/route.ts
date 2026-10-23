import { NextResponse } from "next/server";
import { getSession, holdsCheckout } from "@/lib/auth";
import { getBuyerSession } from "@/lib/buyer-access";
import { getAvailableSlots } from "@/lib/booking";
import { requestClient } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { limitSlots } from "@/lib/limits";
import { canonicalTimezone } from "@/lib/timezones";

/**
 * Huecos libres de una sesión (datos públicos: no expone reservas ajenas).
 *   ?tz=Area/City   días y horas en la zona de quien mira (no válida → la de la dueña).
 *   ?pedido=id      el pago en curso de este navegador no le quita su propia hora (cookie del checkout).
 * Si la sesión ya no está publicada, solo responde a quien tiene una reserva pagada pendiente de fecha o
 * confirmada (para que pueda elegir o cambiar su hora) y a la dueña (para dar una sesión a mano).
 */
export async function GET(req: Request) {
  const limit = await limitSlots((await requestClient()).ipHash);
  if (!limit.ok) return NextResponse.json({ error: limit.message }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  const sp = new URL(req.url).searchParams;
  const productId = sp.get("productId") ?? "";
  const product = await prisma.product.findFirst({ where: { id: productId, type: "SESSION" } });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (product.groupSession) return NextResponse.json({ error: "Este taller tiene fecha fija" }, { status: 404 });
  if (product.status !== "PUBLISHED") {
    const s = await getSession();
    const owner = !!s && !s.orderId && s.user.creator?.id === product.creatorId;
    // Vale también la sesión limitada al pedido: es quien acaba de pagar y elige hora.
    const user = owner ? null : (await getBuyerSession())?.user;
    const holder = user
      ? await prisma.booking.findFirst({ where: { productId, userId: user.id, status: { in: ["PENDING_SCHEDULE", "CONFIRMED"] } } })
      : null;
    if (!owner && !holder) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const pedido = sp.get("pedido");
  const own = pedido
    ? await prisma.order.findFirst({ where: { id: pedido, productId }, select: { id: true, claimTokenHash: true } })
    : null;
  const ignoreOrderId = own?.claimTokenHash && (await holdsCheckout(own.id, own.claimTokenHash)) ? own.id : undefined;
  const data = await getAvailableSlots(product, { viewerTz: canonicalTimezone(sp.get("tz")), ignoreOrderId });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
