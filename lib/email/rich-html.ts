/**
 * Texto de la creadora con formato («MD», lib/rich-text.ts) como HTML de email: estilos en línea
 * a juego con layout() de templates.ts, todo escapado con esc() y enlaces solo de safeLinkHref.
 * El texto «de antes» (formato null) sale exactamente como siempre: p(esc(texto)).
 *
 * Antiphishing: un enlace de fuera siempre enseña su dominio real («mi Instagram (instagram.com)»)
 * y un texto que parece otro dominio («cirella.com» apuntando a evil.io) se cambia por la URL real.
 * Así nadie puede disfrazar un enlace en un correo que sale con la marca de la web.
 *
 * Las imágenes se omiten salvo que se pase `image` (la newsletter dará su propia versión para email).
 * Puro.
 */
import { appUrl } from "../env";
import { isRich, parseRich, safeLinkHref, type RichBlock, type RichInline } from "../rich-text";
import { esc, p } from "./html";

const LINK_STYLE = "color:#0E1024;text-decoration:underline";
const HOST_STYLE = "color:#8A8698";

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

function hostOf(url: string): string | null {
  try {
    return bareHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

/** Dominio que «parece» un texto (cirella.com, www.x.es/ruta, https://x.es); null si no lo parece. */
function textDomain(text: string): string | null {
  const m = text.trim().match(/^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/?#:]\S*)?$/i);
  return m ? bareHost(m[1]) : null;
}

/** Texto visible (ya escapado) de un enlace en un email. */
export function emailLinkText(text: string, href: string, siteHost: string): string {
  const label = text.trim() || href;
  if (href.startsWith("/")) return esc(label);
  const lower = href.toLowerCase();
  if (lower.startsWith("mailto:") || lower.startsWith("tel:")) {
    const addr = href.slice(href.indexOf(":") + 1);
    return label === addr ? esc(label) : `${esc(label)} (${esc(addr)})`;
  }
  const host = hostOf(href);
  if (!host) return esc(href);
  if (host === bareHost(siteHost)) return esc(label);
  const plainHref = href.replace(/\/$/, "");
  if (label === href || label === plainHref || label.replace(/^https?:\/\//i, "").replace(/\/$/, "") === plainHref.replace(/^https?:\/\//i, "")) return esc(label);
  const looks = textDomain(label);
  if (looks === host) return esc(label);
  if (looks) return esc(href);
  return `${esc(label)} <span style="${HOST_STYLE}">(${esc(host)})</span>`;
}

function plain(nodes: RichInline[]): string {
  return nodes.map((n) => (n.t === "text" ? n.v : n.t === "br" ? " " : plain(n.c))).join("");
}

export function richToEmailHtml(
  text: string,
  format: string | null | undefined,
  o: { baseUrl?: string; image?: (src: string) => string | null } = {},
): string {
  if (!isRich(format)) return p(esc(text));
  const base = (o.baseUrl ?? appUrl()).replace(/\/$/, "");
  const siteHost = hostOf(base) ?? "";

  const inline = (nodes: RichInline[]): string =>
    nodes
      .map((n) => {
        switch (n.t) {
          case "text":
            return esc(n.v);
          case "br":
            return "<br>";
          case "b":
            return `<strong style="font-weight:600">${inline(n.c)}</strong>`;
          case "i":
            return `<em>${inline(n.c)}</em>`;
          case "a": {
            const safe = safeLinkHref(n.href);
            if (!safe) return esc(plain(n.c));
            const href = safe.href.startsWith("/") ? `${base}${safe.href}` : safe.href;
            return `<a href="${esc(href)}" style="${LINK_STYLE}">${emailLinkText(plain(n.c), safe.href.startsWith("/") ? safe.href : href, siteHost)}</a>`;
          }
        }
      })
      .join("");

  const block = (b: RichBlock): string => {
    switch (b.t) {
      case "p":
        return p(inline(b.c));
      case "h":
        return b.level === 2
          ? `<h2 style="font-family:Georgia,serif;font-weight:400;font-size:20px;line-height:1.3;margin:20px 0 10px;color:#0E1024">${inline(b.c)}</h2>`
          : `<h3 style="font-family:Georgia,serif;font-weight:400;font-size:17px;line-height:1.35;margin:16px 0 8px;color:#0E1024">${inline(b.c)}</h3>`;
      case "ul":
      case "ol": {
        const tag = b.t;
        const start = b.t === "ol" && b.start !== 1 ? ` start="${b.start}"` : "";
        return `<${tag}${start} style="margin:0 0 12px;padding-left:20px">${b.items.map((it) => `<li style="margin:0 0 6px">${inline(it)}</li>`).join("")}</${tag}>`;
      }
      case "quote":
        return `<blockquote style="margin:0 0 12px;padding:0 0 0 14px;border-left:3px solid #E9E2D3;color:#5B5870">${inline(b.c)}</blockquote>`;
      case "hr":
        return `<hr style="border:0;border-top:1px solid #E9E2D3;margin:20px 0">`;
      case "img": {
        const src = o.image?.(b.src);
        return src ? `<p style="margin:0 0 12px"><img src="${esc(src)}" alt="${esc(b.alt)}" style="display:block;max-width:100%;height:auto;border-radius:12px"></p>` : "";
      }
    }
  };

  return parseRich(text).map(block).join("");
}
