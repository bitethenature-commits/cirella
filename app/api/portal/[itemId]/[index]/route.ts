import { PRIVATE_TYPES } from "@/lib/file-types";
import { portalMediaFor } from "@/lib/portal";
import { privateKey } from "@/lib/storage";
import { streamObjectResponse } from "@/lib/storage/stream";

/**
 * Archivo privado de un elemento del Portal de Noticias (vídeo, audio o foto), comprobando en CADA
 * petición (también en cada tramo con Range) que quien lo pide lo tiene desbloqueado: sesión de su
 * cuenta y suscriptora confirmada de la newsletter (o la dueña). Como /api/stream: sin URLs firmadas
 * que se puedan compartir, tipo de la lista admitida, nosniff y CSP «sandbox».
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CHUNK = 8 * 1024 * 1024;
const text = (body: string, status: number) => new Response(body, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request, { params }: { params: Promise<{ itemId: string; index: string }> }) {
  const { itemId, index } = await params;
  const n = Number.parseInt(index, 10);
  if (!/^\d{1,2}$/.test(index) || !Number.isInteger(n)) return text("No encontrado", 404);
  const media = await portalMediaFor(itemId, n);
  if (media === "login") return text("Suscríbete y entra en tu cuenta para verlo", 401);
  if (media === "forbidden") return text("Suscríbete a la newsletter para verlo", 403);
  if (!media) return text("No encontrado", 404);
  const contentType = PRIVATE_TYPES[media.mime] ? media.mime : null;
  if (!contentType) return text("No encontrado", 404);
  return streamObjectResponse(req, {
    key: privateKey(media.key),
    contentType,
    filename: media.name,
    disposition: "inline",
    maxChunk: MAX_CHUNK,
    headers: {
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
