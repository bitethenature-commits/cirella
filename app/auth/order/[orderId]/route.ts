import { thanksPath } from "@/lib/public-paths";
import { NextResponse } from "next/server";
import { claimOrderSession } from "@/lib/auth";
import { orderTargetPath } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * «Acceder a mi contenido» desde la página de gracias cuando el navegador que pagó aún no tiene la
 * sesión del pedido (p. ej. el pago se confirmó después): la abre y va a la compra. Si no se puede
 * (otro navegador, otra cuenta abierta…), vuelve a gracias, que explica lo del email.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { creator: { select: { username: true } }, bookings: { select: { id: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order) return NextResponse.redirect(new URL("/", req.url));
  const access = await claimOrderSession(order.id);
  const to = access === "email" ? `${thanksPath(order.creator.username)}?pedido=${order.id}` : orderTargetPath(order, order.bookings[0]?.id);
  return NextResponse.redirect(new URL(to, req.url));
}
