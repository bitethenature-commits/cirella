import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { inlineContentType, mimeFromExt } from "@/lib/file-types";
import { PAGE_VIDEO_URL_TTL_SEC, parsePageVideoPath } from "@/lib/page-blocks";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vídeo de un bloque de la página (/media/video/<creadora>/<24 hex>.mp4|mov|m4v): una dirección
 * estable que se puede guardar en la página cacheada y que responde con una redirección a una URL
 * firmada del almacenamiento (12 h). Así el vídeo sale de R2 (sin pasar por el servidor) y la
 * página nunca lleva una URL que caduque. La redirección se cachea 10 minutos, mucho menos que la
 * firma. Solo se firman claves de public/video/ construidas con una expresión estricta.
 */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const v = parsePageVideoPath(path);
  if (!v) return new NextResponse("No encontrado", { status: 404 });
  const s = storage();
  if (!(await s.head(v.key))) return new NextResponse("No encontrado", { status: 404 });
  const url = await s.presignGet(v.key, { expiresInSec: PAGE_VIDEO_URL_TTL_SEC, inline: true, contentType: inlineContentType(mimeFromExt(v.file)) });
  return new NextResponse(null, {
    status: 302,
    headers: {
      // El driver local da una ruta relativa (/api/storage/local?…).
      Location: new URL(url, appUrl()).toString(),
      "Cache-Control": "public, max-age=600, s-maxage=600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
