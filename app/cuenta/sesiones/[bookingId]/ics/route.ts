import { NextResponse } from "next/server";
import { scopeAllows } from "@/lib/auth-utils";
import { buyerLoginPath, getBuyerSession } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** Archivo .ics para añadir la sesión a Google Calendar, Apple Calendar u Outlook. */
export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const s = await getBuyerSession();
  if (!s) return NextResponse.redirect(new URL(await buyerLoginPath(`/cuenta/sesiones/${bookingId}`), req.url));
  const b = await prisma.booking.findFirst({ where: { id: bookingId, userId: s.user.id }, include: { product: true, creator: true } });
  // Sesión de cuenta: verificada; limitada: solo la reserva de su pedido.
  const allowed = b && (s.scope ? scopeAllows(s.scope, { bookingOrderId: b.orderId }) : s.verified);
  if (!allowed || !b.startAt || !b.endAt) return new NextResponse("No encontrado", { status: 404 });
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cirella//Reservas//ES",
    "BEGIN:VEVENT",
    `UID:${b.id}@cirella`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(b.startAt)}`,
    `DTEND:${fmt(b.endAt)}`,
    `SUMMARY:${esc(`${b.product.title} · ${b.creator.displayName}`)}`,
    `DESCRIPTION:${esc(b.meetingUrl ? `Videollamada: ${b.meetingUrl}` : "Sesión reservada en Cirella")}`,
    b.meetingUrl ? `URL:${b.meetingUrl}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="sesion.ics"` } });
}
