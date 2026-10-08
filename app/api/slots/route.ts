import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/booking";
import { prisma } from "@/lib/db";

/** Huecos libres de una sesión publicada (datos públicos: no expone reservas ajenas). */
export async function GET(req: Request) {
  const productId = new URL(req.url).searchParams.get("productId") ?? "";
  const product = await prisma.product.findFirst({ where: { id: productId, type: "SESSION", status: "PUBLISHED" } });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const data = await getAvailableSlots(product, { days: 28 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
