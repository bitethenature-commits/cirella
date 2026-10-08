import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** Archivo .ics para añadir la sesión a Google Calendar, Apple Calendar u Outlook. */
export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/entrar", req.url));
  const b = await prisma.booking.findFirst({ where: { id: bookingId, userId: user.id }, include: { product: true, creator: true } });
  if (!b?.startAt || !b.endAt) return new NextResponse("No encontrado", { status: 404 });
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
