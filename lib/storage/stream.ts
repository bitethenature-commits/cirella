/**
 * Respuesta con los bytes de un objeto del almacenamiento, con Range (200/206/416) y en streaming:
 * la usan /api/storage/local (URLs firmadas del disco) y /api/stream/[fileId] (PDF, imágenes
 * privadas y audio de la web personal desde la misma web).
 *
 * `maxChunk` limita un tramo pedido abierto («bytes=0-») o demasiado grande: se responde 206 con un
 * Content-Range más corto y el reproductor pide el siguiente. Así cada petición acaba rápido.
 */
import { contentDisposition, parseRange, storage } from "./index";

export async function streamObjectResponse(
  req: Request,
  o: { key: string; contentType: string; filename?: string | null; disposition: "inline" | "attachment"; maxChunk?: number; headers?: Record<string, string> },
): Promise<Response> {
  const s = storage();
  const info = await s.head(o.key);
  if (!info) return new Response("No encontrado", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": o.contentType || "application/octet-stream",
    "Content-Disposition": contentDisposition(o.filename, o.disposition === "inline"),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    ...o.headers,
  };
  const header = req.headers.get("range");
  let range = parseRange(header, info.size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${info.size}` } });
  // Solo se recortan los tramos pedidos (sin Range, p. ej. un <img>, va entero).
  if (o.maxChunk && range && range.end - range.start + 1 > o.maxChunk) range = { start: range.start, end: range.start + o.maxChunk - 1 };
  const obj = await s.getStream(o.key, range ?? undefined);
  if (!obj) return new Response("No encontrado", { status: 404 });
  if (range)
    return new Response(obj.body, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${obj.size}`, "Content-Length": String(range.end - range.start + 1) },
    });
  return new Response(obj.body, { headers: { ...headers, "Content-Length": String(obj.size) } });
}
