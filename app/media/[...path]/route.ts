import { NextResponse } from "next/server";
import { isMediaPath } from "@/lib/media-url";
import { mimeFromExt, publicKey, storage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Imágenes públicas subidas por las creadoras (avatar, portada, productos), en streaming desde el
 * almacenamiento. Cada URL es inmutable (un nombre nuevo por imagen), así que la CDN de Vercel
 * (s-maxage) y el navegador la guardan un año y la función solo se ejecuta la primera vez.
 */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.join("/");
  if (!isMediaPath(rel)) return new NextResponse("No encontrado", { status: 404 });
  const obj = await storage().getStream(publicKey(rel));
  if (!obj) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(obj.body, {
    headers: {
      "Content-Type": mimeFromExt(rel),
      "Content-Length": String(obj.size),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
