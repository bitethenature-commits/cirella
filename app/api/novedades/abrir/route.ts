import { NextResponse } from "next/server";
import { getBuyerSession } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { accessSource } from "@/lib/membership-access";

/**
 * Una novedad de una membresía en «Actualidades» (lib/web-news.ts): a quien es miembro (o la dueña), a la
 * publicación dentro de su área; al resto, a la página para hacerse miembro.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("p") ?? "";
  const post = id ? await prisma.membershipPost.findUnique({ where: { id }, select: { id: true, productId: true, creatorId: true, product: { select: { creator: { select: { username: true } } } } } }) : null;
  if (!post) return NextResponse.redirect(new URL("/", u));
  const s = await getBuyerSession();
  const member = !!s && !s.scope && (s.user.creator?.id === post.creatorId || !!(await accessSource(s.user.id, post.productId)));
  const to = member ? `/area/membership/${post.productId}/${post.id}` : `/${post.product.creator.username}/membership`;
  return NextResponse.redirect(new URL(to, u));
}
