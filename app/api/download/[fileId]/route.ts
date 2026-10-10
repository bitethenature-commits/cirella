import { NextResponse } from "next/server";
import { buyerLoginPath, checkProductAccess } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { DOWNLOAD_TTL_SEC, INLINE_MEDIA_TTL_SEC, privateKey, storage } from "@/lib/storage";

/**
 * Entrega protegida de contenido de pago. Solo responde si:
 *   · quien lo pide es la creadora propietaria, o
 *   · tiene un Access activo (y no caducado) al producto del archivo, con una sesión verificada o
 *     limitada a un pedido de ese producto (lib/buyer-access.ts).
 * Comprueba el acceso y redirige a un enlace temporal del almacenamiento (10 min; 3 h para
 * reproducir vídeo/audio del curso). El servidor nunca carga el archivo en memoria.
 */
export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const file = await prisma.productFile.findUnique({ where: { id: fileId } });
  if (!file) return new NextResponse("No encontrado", { status: 404 });
  const access = await checkProductAccess(file.productId, file.creatorId);
  if (!access.ok && access.reason === "login")
    return NextResponse.redirect(new URL(await buyerLoginPath("/cuenta/archivos", { creatorId: file.creatorId }), req.url));
  if (!access.ok) return new NextResponse("No tienes acceso a este contenido", { status: 403 });
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
