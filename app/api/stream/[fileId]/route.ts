import { checkFileAccess, markFirstAccess } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { checkOrderFileAccess } from "@/lib/order-file-access";
import { findOrderFile } from "@/lib/order-files";
import { deliveryFor, PRIVATE_TYPES } from "@/lib/file-types";
import { isPersonalMode } from "@/lib/site-mode";
import { privateKey } from "@/lib/storage";
import { streamObjectResponse } from "@/lib/storage/stream";

/**
 * Bytes de un archivo privado desde la misma web, comprobando el acceso en CADA petición (también
 * en cada tramo con Range): PDF (pdf.js), imágenes privadas (<img>) y el audio de la web personal
 * (el ▶ de la pantalla bloqueada horas después sigue funcionando y, si se quita el acceso, deja de
 * hacerlo al momento). Sin URLs firmadas que renovar ni que se puedan compartir.
 *
 * Cabeceras: tipo solo de la lista de tipos admitidos (nunca HTML ni SVG), nosniff, CORP
 * same-origin y CSP «sandbox» (abrir la URL a mano nunca ejecuta nada); los PDF, como adjunto.
 * Cada respuesta va como mucho de 8 MiB (el reproductor pide el siguiente tramo).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CHUNK = 8 * 1024 * 1024;
const text = (body: string, status: number) => new Response(body, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const productFile = await prisma.productFile.findUnique({ where: { id: fileId } });
  // Entrega de un pedido (lectura, grabación): cada tabla con su propia comprobación de acceso.
  const orderFile = productFile ? null : await findOrderFile(fileId);
  const file = productFile ?? orderFile;
  if (!file || file.kind === "LINK" || !file.storageKey) return text("No encontrado", 404);
  const access = productFile ? await checkFileAccess(productFile) : await checkOrderFileAccess(orderFile!);
  if (!access.ok) return text(access.reason === "login" ? "Inicia sesión para ver este contenido" : "No tienes acceso a este contenido", access.reason === "login" ? 401 : 403);
  if (deliveryFor(file.kind, isPersonalMode()) !== "stream") return text("No encontrado", 404);
  const contentType = file.mimeType && PRIVATE_TYPES[file.mimeType] ? file.mimeType : null;
  if (!contentType) return text("No encontrado", 404);

  // Desde el primer acceso vale su renuncia al desistimiento; solo al empezar, no en cada tramo.
  const range = req.headers.get("range");
  if (productFile && !access.isOwner && (!range || /^bytes=0-/.test(range.trim()))) await markFirstAccess(access.userId, ("accessProductId" in access ? String(access.accessProductId) : productFile.productId));

  return streamObjectResponse(req, {
    key: privateKey(file.storageKey),
    contentType,
    filename: file.name,
    disposition: file.kind === "PDF" ? "attachment" : "inline",
    maxChunk: MAX_CHUNK,
    headers: {
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
