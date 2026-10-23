import { NextResponse } from "next/server";
import { buyerLoginPath, checkProductAccess, markFirstAccess } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { inlineContentType } from "@/lib/file-types";
import { checkOrderFileAccess } from "@/lib/order-file-access";
import { findOrderFile } from "@/lib/order-files";
import { DOWNLOAD_TTL_SEC, INLINE_MEDIA_TTL_SEC, privateKey, storage } from "@/lib/storage";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Entrega protegida de contenido de pago. Solo responde si:
 *   · quien lo pide es la creadora propietaria, o
 *   · tiene un Access activo (y no caducado) al producto del archivo, con una sesión verificada o
 *     limitada a un pedido de ese producto (lib/buyer-access.ts).
 * Comprueba el acceso y redirige a un enlace temporal del almacenamiento (10 min; 3 h para
 * reproducir vídeo/audio del curso). El servidor nunca carga el archivo en memoria.
 * Con &format=json devuelve { url, expiresAt } (o 401 { error: "login" } / 403 { error: "forbidden" })
 * en lugar de redirigir: así los reproductores renuevan la URL (components/media/use-signed-media.ts).
 */
export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const sp = new URL(req.url).searchParams;
  // ?format=json: lo usan los reproductores para renovar la URL firmada sin recargar la página.
  const json = sp.get("format") === "json";
  const productFile = await prisma.productFile.findUnique({ where: { id: fileId } });
  // Si no es de un producto, puede ser la entrega de un pedido (con su propia comprobación, sin mezclar).
  const orderFile = productFile ? null : await findOrderFile(fileId);
  const file = productFile ?? orderFile;
  if (!file) return json ? NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE }) : new NextResponse("No encontrado", { status: 404 });
  const access = productFile ? await checkProductAccess(productFile.productId, productFile.creatorId) : await checkOrderFileAccess(orderFile!);
  if (!access.ok && json) return NextResponse.json({ error: access.reason }, { status: access.reason === "login" ? 401 : 403, headers: NO_STORE });
  if (!access.ok && access.reason === "login")
    return NextResponse.redirect(new URL(await buyerLoginPath(orderFile ? `/cuenta/pedidos/${orderFile.orderId}` : "/cuenta/archivos", { creatorId: file.creatorId }), req.url));
  if (!access.ok) return new NextResponse("No tienes acceso a este contenido", { status: 403 });
  // Desde la primera descarga o reproducción vale su renuncia al desistimiento (acceso inmediato).
  if (!access.isOwner && productFile) await markFirstAccess(access.userId, productFile.productId);
  if (file.kind === "LINK" && file.url) return NextResponse.redirect(file.url);
  if (!file.storageKey) return new NextResponse("No encontrado", { status: 404 });

  const inline = sp.get("inline") === "1";
  const media = file.kind === "VIDEO" || file.kind === "AUDIO";
  const ttl = inline && media ? INLINE_MEDIA_TTL_SEC : DOWNLOAD_TTL_SEC;
  const url = await storage().presignGet(privateKey(file.storageKey), {
    expiresInSec: ttl,
    filename: file.name,
    inline,
    // Reproducir en la página: un MOV se firma como MP4 (los navegadores lo reproducen así).
    // La descarga conserva su tipo y su nombre.
    contentType: inline && media ? inlineContentType(file.mimeType) : file.mimeType,
  });
  if (json) return NextResponse.json({ url: new URL(url, req.url).toString(), expiresAt: new Date(Date.now() + ttl * 1000).toISOString() }, { headers: NO_STORE });
  return NextResponse.redirect(new URL(url, req.url), { status: 302, headers: NO_STORE });
}
