import { NextResponse } from "next/server";
import { getBuyerSession } from "@/lib/buyer-access";
import { getAvailableSlots } from "@/lib/booking";
import { prisma } from "@/lib/db";

/**
 * Huecos libres de una sesión (datos públicos: no expone reservas ajenas).
 * Si la sesión ya no está publicada, solo responde a quien tiene una reserva pagada
 * pendiente de fecha o confirmada, para que pueda elegir o cambiar su hora.
 */
export async function GET(req: Request) {
  const productId = new URL(req.url).searchParams.get("productId") ?? "";
  const product = await prisma.product.findFirst({ where: { id: productId, type: "SESSION" } });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (product.status !== "PUBLISHED") {
    // Vale también la sesión limitada al pedido: es quien acaba de pagar y elige hora.
    const user = (await getBuyerSession())?.user;
    const holder = user
      ? await prisma.booking.findFirst({ where: { productId, userId: user.id, status: { in: ["PENDING_SCHEDULE", "CONFIRMED"] } } })
      : null;
    if (!holder) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const data = await getAvailableSlots(product, { days: 28 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
