import { NextResponse } from "next/server";
import { getBuyerSession } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { readPostMedia } from "@/lib/posts";
import { getPublicPost } from "@/lib/public";

/**
 * El vídeo o el audio de una publicación de «Actualidades», solo para quien tiene cuenta (y ha entrado con
 * ella, no con el enlace de un email). La página está en caché para todo el mundo y no lleva la dirección del
 * archivo: la pide aquí el navegador (components/creator-page/post-media-gate.tsx).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const username = u.searchParams.get("u") ?? "";
  const slug = u.searchParams.get("slug") ?? "";
  const s = await getBuyerSession();
  if (!s || s.scope) return NextResponse.json({ account: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const creator = await prisma.creator.findUnique({ where: { username }, select: { id: true } });
  const post = creator ? await getPublicPost(creator.id, slug) : null;
  const media = post ? readPostMedia(post.mediaKind, post.media) : null;
  if (!media) return NextResponse.json({ account: true, media: null }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ account: true, media }, { headers: { "Cache-Control": "private, no-store" } });
}
