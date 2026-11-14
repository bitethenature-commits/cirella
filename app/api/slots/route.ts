import { NextResponse } from "next/server";
import { getSession, holdsCheckout } from "@/lib/auth";
import { getBuyerSession } from "@/lib/buyer-access";
import { getAvailableSlots, slotRuleForOrder, type SlotRule } from "@/lib/booking";
import { requestClient } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { limitSlots } from "@/lib/limits";
import { paidCheckoutOpen } from "@/lib/payments";
import { canonicalTimezone } from "@/lib/timezones";

/**
 * Huecos libres de una sesión (datos públicos: no expone reservas ajenas).
 *   ?tz=Area/City   días y horas en la zona de quien mira (no válida → la de la dueña).
 *   ?pedido=id      el pago en curso de este navegador no le quita su propia hora (cookie del checkout).
 *   ?reserva=id     la clienta elige o cambia la fecha de SU reserva: el día 15 cuenta desde el pago de
 *                   su pedido (lib/withdrawal.ts); una sesión dada a mano no sigue esa regla.
 *   ?manual=1       la dueña da una sesión a mano («Dar una sesión o lectura»): sin regla del día 15.
 * Sin nada de eso, la regla de quien compra ahora: en una sesión de pago, nada antes del día 15.
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
  const isOwner = async () => {
    const s = await getSession();
    return !!s && !s.orderId && s.user.creator?.id === product.creatorId;
  };
  // La regla de los huecos: la de la reserva de quien mira, la de la dueña a mano o la de comprar ahora.
  const reservaId = sp.get("reserva");
  let rule: SlotRule = {};
  if (reservaId) {
    const user = (await getBuyerSession())?.user;
    const booking = user
      ? await prisma.booking.findFirst({
          where: { id: reservaId, productId, userId: user.id },
          select: { order: { select: { paymentProvider: true, paidAt: true, createdAt: true } } },
        })
      : null;
    rule = slotRuleForOrder(booking?.order);
  } else if (sp.get("manual") === "1" && (await isOwner())) rule = { manual: true };
  // La web no cobra (solicitudes, lib/requests.ts): sin compra online no hay regla del día 15.
  else if (!paidCheckoutOpen()) rule = { manual: true };
  if (product.status !== "PUBLISHED") {
    const owner = await isOwner();
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
  const data = await getAvailableSlots(product, { viewerTz: canonicalTimezone(sp.get("tz")), ignoreOrderId, ...rule });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
