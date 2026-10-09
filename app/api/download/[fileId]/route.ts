import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DOWNLOAD_TTL_SEC, INLINE_MEDIA_TTL_SEC, privateKey, storage } from "@/lib/storage";

/**
 * Entrega protegida de contenido de pago. Solo responde si:
 *   · quien lo pide es la creadora propietaria, o
 *   · tiene un Access activo (y no caducado) al producto del archivo.
 * Comprueba el acceso y redirige a un enlace temporal del almacenamiento (10 min; 3 h para
 * reproducir vídeo/audio del curso). El servidor nunca carga el archivo en memoria.
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

  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const media = file.kind === "VIDEO" || file.kind === "AUDIO";
  const url = await storage().presignGet(privateKey(file.storageKey), {
    expiresInSec: inline && media ? INLINE_MEDIA_TTL_SEC : DOWNLOAD_TTL_SEC,
    filename: file.name,
    inline,
    contentType: file.mimeType,
  });
  return NextResponse.redirect(new URL(url, req.url), { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
