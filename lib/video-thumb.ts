import "server-only";
import { videoEmbed } from "./video-embed";

/**
 * Miniatura de un vídeo de YouTube o Vimeo (para la portada del bloque «Vídeo» de los emails). Se
 * descarga en el servidor y se guarda como imagen propia: así el email no carga nada de YouTube ni
 * de Vimeo (ni les cuenta quién lo abre) y la portada lleva el ▶ dibujado.
 *
 *   · YouTube: i.ytimg.com/vi/<id>/maxresdefault.jpg (o hqdefault si no hay de alta resolución).
 *   · Vimeo: su oEmbed público (thumbnail_url, siempre en i.vimeocdn.com).
 * Solo esos dos dominios, por https, con 8 s de tiempo y 6 MB como mucho. null si no se puede.
 */
const MAX_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 8000;

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !["i.ytimg.com", "i.vimeocdn.com"].includes(u.hostname)) return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 1000 && buf.length <= MAX_BYTES ? buf : null;
  } catch {
    return null;
  }
}

export async function fetchVideoThumbnail(link: string): Promise<Buffer | null> {
  const v = videoEmbed(link);
  if (!v) return null;
  if (v.provider === "youtube") return (await fetchImage(`https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`)) ?? (await fetchImage(`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`));
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(link.trim())}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: unknown };
    return typeof data.thumbnail_url === "string" ? await fetchImage(data.thumbnail_url) : null;
  } catch {
    return null;
  }
}
