/**
 * Enlaces de YouTube y Vimeo → URL para incrustar el reproductor. Puro (lo usan el curso y el
 * aviso en vivo del panel).
 *
 *   · YouTube: watch?v=, youtu.be/, shorts/, live/, embed/ (y m.youtube.com), con el minuto de
 *     inicio (t=90, t=1m30s, start=90) → youtube-nocookie.com, sin vídeos relacionados de otros.
 *   · Vimeo: /ID, /ID/HASH (enlace oculto), ?h=HASH, canales, grupos, álbum, showcase,
 *     manage/videos/ID/HASH y player.vimeo.com/video/ID → conserva el código de privacidad y añade
 *     dnt=1 (sin cookies de seguimiento).
 * El host se compara exacto o como subdominio: «vimeo.com.evil.io» o «youtube.com@evil.io» no valen.
 */
export type VideoEmbedInfo = { provider: "youtube" | "vimeo"; id: string; src: string };

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

function seconds(raw: string | null): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function videoEmbed(raw: string): VideoEmbedInfo | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);

  if (hostIs(host, "youtube.com") || hostIs(host, "youtube-nocookie.com") || host === "youtu.be") {
    let id: string | null = null;
    if (host === "youtu.be") id = parts[0] ?? null;
    else if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (["shorts", "live", "embed", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const start = seconds(u.searchParams.get("t") ?? u.searchParams.get("start"));
    return { provider: "youtube", id, src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1${start ? `&start=${start}` : ""}` };
  }

  if (hostIs(host, "vimeo.com")) {
    let id: string | null = null;
    let hash: string | null = null;
    const isId = (s?: string) => !!s && /^\d{6,12}$/.test(s);
    if (host === "player.vimeo.com") {
      if (parts[0] === "video" && isId(parts[1])) id = parts[1];
    } else {
      // El id es el primer número de 6–12 cifras de la ruta; el segmento siguiente, si es hex, el código.
      // En álbumes y showcases el primer número es el del álbum: el vídeo va tras «video(s)».
      const v = parts.findIndex((p) => p === "video" || p === "videos");
      const i = v >= 0 ? (isId(parts[v + 1]) ? v + 1 : -1) : ["showcase", "album"].includes(parts[0] ?? "") ? -1 : parts.findIndex((p) => isId(p));
      if (i >= 0) {
        id = parts[i];
        const next = parts[i + 1];
        if (next && /^[0-9a-f]{6,20}$/i.test(next)) hash = next;
      }
    }
    if (!id) return null;
    const h = u.searchParams.get("h");
    if (!hash && h && /^[0-9a-f]{6,20}$/i.test(h)) hash = h;
    const q = new URLSearchParams();
    if (hash) q.set("h", hash);
    q.set("dnt", "1");
    q.set("title", "0");
    q.set("byline", "0");
    q.set("portrait", "0");
    return { provider: "vimeo", id, src: `https://player.vimeo.com/video/${id}?${q.toString()}` };
  }
  return null;
}
