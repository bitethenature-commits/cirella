import { NextResponse } from "next/server";
import sharp from "sharp";
import { cornerSvg, parseCornerFile, parsePatternFile, patternSvg } from "@/lib/email-patterns";

export const runtime = "nodejs";

/**
 * Fondo con geometría de un email, en PNG (los buzones no enseñan SVG): /media/fondo/flor-0d0b24-d9bf8c-m.png
 * (el que se repite: fondo y burbujas) o /media/fondo/esquina-flor-17143a-d9bf8c-m-tr.png (el adorno de la esquina).
 * Todo lo que lo dibuja va en el nombre, así que nunca cambia: se guarda en caché para siempre.
 * Público (lo pide el buzón de quien lee). Se dibuja al doble de tamaño para pantallas retina.
 */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const corner = parseCornerFile(file);
  const look = corner ? null : parsePatternFile(file);
  const svg = corner ? cornerSvg(corner, 2) : look ? patternSvg(look, 2) : null;
  if (!svg) return new NextResponse("No encontrado", { status: 404 });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
