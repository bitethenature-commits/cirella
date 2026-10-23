import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildIcs, verifyIcsToken } from "@/lib/ics";

/** .ics de una sesión desde el enlace firmado de sus emails (no necesita sesión). */
export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  if (!verifyIcsToken(bookingId, new URL(req.url).searchParams.get("t"))) return new NextResponse("No encontrado", { status: 404 });
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { product: true, creator: true } });
  if (!b || b.status !== "CONFIRMED" || !b.startAt || !b.endAt) return new NextResponse("Esta sesión ya no tiene fecha", { status: 404 });
  const ics = buildIcs({ id: b.id, startAt: b.startAt, endAt: b.endAt, meetingUrl: b.meetingUrl, productTitle: b.product.title, creatorName: b.creator.displayName });
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="sesion.ics"`, "Cache-Control": "private, no-store" },
  });
}
