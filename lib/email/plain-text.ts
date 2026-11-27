/**
 * Versión en texto plano de un email HTML (la parte text/plain que acompaña al HTML): mejora la
 * entrega (los filtros de spam desconfían de los emails solo HTML) y es lo que leen los relojes y
 * algunos lectores de pantalla. Los enlaces salen como «texto (dirección)». Puro.
 */
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", zwnj: "", "#847": "" };

function decode(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k in ENTITIES) return ENTITIES[k];
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith("#")) return String.fromCodePoint(Number(k.slice(1)));
    return m;
  });
}

export function htmlToText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(head|style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, "")
    // El texto de vista previa (oculto) y otros textos ocultos no van en la versión de texto.
    .replace(/<(div|span)[^>]*display:none[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (_, alt: string) => (alt.trim() ? `[${alt}]` : ""))
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
      const label = decode(inner.replace(/<[^>]+>/g, "")).trim();
      const url = decode(href);
      if (!label) return url;
      return label === url || label.replace(/^https?:\/\//, "") === url.replace(/^https?:\/\//, "") ? url : `${label} (${url})`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<hr[^>]*>/gi, "\n———\n")
    .replace(/<\/(p|h[1-6]|tr|div|ul|ol|blockquote|table)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  s = decode(s)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
