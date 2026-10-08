import { NextResponse } from "next/server";
import { mimeFromExt, readStored } from "@/lib/storage";

/** Imágenes públicas subidas por las creadoras (avatar, portada, productos). */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.join("/");
  if (!/^[a-z0-9]+\/[a-f0-9]+\.(jpg|png|webp|gif)$/i.test(rel)) return new NextResponse("No encontrado", { status: 404 });
  try {
    const { data } = await readStored("public", rel);
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": mimeFromExt(rel), "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
