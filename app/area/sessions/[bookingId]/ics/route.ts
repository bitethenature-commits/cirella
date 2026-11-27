import { NextResponse } from "next/server";
import { scopeAllows } from "@/lib/auth-utils";
import { buyerLoginPath, getBuyerSession } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { buildIcs } from "@/lib/ics";

/** Archivo .ics para añadir la sesión a Google Calendar, Apple Calendar u Outlook. */
export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const s = await getBuyerSession();
  if (!s) return NextResponse.redirect(new URL(await buyerLoginPath(`/area/sessions/${bookingId}`), req.url));
  const b = await prisma.booking.findFirst({ where: { id: bookingId, userId: s.user.id }, include: { product: true, creator: true } });
  // Sesión de cuenta: verificada; limitada: solo la reserva de su pedido.
  const allowed = b && (s.scope ? scopeAllows(s.scope, { bookingOrderId: b.orderId }) : s.verified);
  if (!allowed || !b.startAt || !b.endAt) return new NextResponse("No encontrado", { status: 404 });
  const ics = buildIcs({ id: b.id, startAt: b.startAt, endAt: b.endAt, meetingUrl: b.meetingUrl, productTitle: b.product.title, creatorName: b.creator.displayName });
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="sesion.ics"` } });
}
