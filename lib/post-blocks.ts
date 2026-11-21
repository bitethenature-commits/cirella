/**
 * Una publicación de la comunidad hecha por partes, en el orden que quiera la autora: texto, fotos y
 * archivos (audio, vídeo, PDF) mezclados. Se guarda en el texto (Markdown) con una línea
 * «[[archivo:<id>]]» donde va cada archivo; las fotos son imágenes del propio texto. Puro.
 */

export type BodyPart = { t: "text"; text: string } | { t: "file"; id: string };

const MARKER = /^\[\[archivo:([\w-]+)\]\][ \t]*$/;

export const fileMarker = (id: string) => `[[archivo:${id}]]`;

/** El texto troceado: lo de entre archivos y cada archivo en su sitio. */
export function splitBody(body: string): BodyPart[] {
  const out: BodyPart[] = [];
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) out.push({ t: "text", text });
    buf = [];
  };
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const m = line.trim().match(MARKER);
    if (m) {
      flush();
      out.push({ t: "file", id: m[1] });
    } else buf.push(line);
  }
  flush();
  return out;
}
