import { NextResponse } from "next/server";
import { getBuyerSession } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { accessSource } from "@/lib/membership-access";
import { areaProductPath, productPath } from "@/lib/public-paths";

/**
 * Una membresía en oferta (portada y «Ofertas», components/creator-page/offer-rows.tsx): a quien ya es miembro
 * (o a la dueña), a su membresía dentro del área; al resto, a la página para hacerse miembro (con el precio de
 * oferta). Lo que no es una membresía publicada vuelve a la portada.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("p") ?? "";
  const product = id
    ? await prisma.product.findUnique({ where: { id }, select: { id: true, slug: true, type: true, status: true, creatorId: true, creator: { select: { username: true } } } })
    : null;
  if (!product || product.type !== "MEMBERSHIP" || product.status !== "PUBLISHED") return NextResponse.redirect(new URL("/", u));
  const s = await getBuyerSession();
  const member = !!s && !s.scope && (s.user.creator?.id === product.creatorId || !!(await accessSource(s.user.id, product.id)));
  const to = member ? areaProductPath(product) : productPath(product.creator.username, product);
  return NextResponse.redirect(new URL(to, u));
}
