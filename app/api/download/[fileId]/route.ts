import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readStored } from "@/lib/storage";

/**
 * Entrega protegida de contenido de pago. Solo responde si:
 *   · quien lo pide es la creadora propietaria, o
 *   · tiene un Access activo (y no caducado) al producto del archivo.
 * Soporta peticiones Range para que audio y vídeo se puedan adelantar.
 */
export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/entrar?next=/cuenta`, req.url));
  const file = await prisma.productFile.findUnique({ where: { id: fileId }, include: { product: { select: { creatorId: true } } } });
  if (!file) return new NextResponse("No encontrado", { status: 404 });

  const isOwner = user.creator?.id === file.creatorId;
  if (!isOwner) {
    const access = await prisma.access.findUnique({ where: { userId_productId: { userId: user.id, productId: file.productId } } });
    const valid = access && access.status === "ACTIVE" && (!access.expiresAt || access.expiresAt > new Date());
    if (!valid) return new NextResponse("No tienes acceso a este contenido", { status: 403 });
  }
  if (file.kind === "LINK" && file.url) return NextResponse.redirect(file.url);
  if (!file.storageKey) return new NextResponse("No encontrado", { status: 404 });

  const { data, size } = await readStored("private", file.storageKey);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const headers: Record<string, string> = {
    "Content-Type": file.mimeType ?? "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  };
  const range = req.headers.get("range");
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new NextResponse(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(size) } });
}
