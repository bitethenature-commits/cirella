/**
 * Texto con párrafos y enlaces automáticos, sin HTML: lo que escribe la creadora (publicaciones,
 * bloques de texto) se trocea aquí y los componentes lo pintan como texto de React, así que una
 * etiqueta «<script>» o un «<a href=javascript:…>» se ven tal cual, nunca se ejecutan.
 *
 *   · Una línea en blanco separa párrafos; un salto de línea simple se respeta dentro del párrafo.
 *   · https://…, http://… y www.… se convierten en enlaces (solo http/https). La puntuación final
 *     («.», «,», «)» sin abrir…) se queda fuera del enlace.
 *   · Los emails (hola@ejemplo.es) se convierten en mailto:.
 *
 * Puro (sin React ni servidor): lo usan los componentes y las pruebas unitarias.
 */

export type RichSegment = { kind: "text"; text: string } | { kind: "link"; text: string; href: string; email?: boolean };
/** Un párrafo: líneas, y cada línea, trozos de texto y enlaces. */
export type RichParagraph = RichSegment[][];

const TOKEN = /\b(?:https?:\/\/|www\.)[^\s<>"]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi;
const TRAILING = /[.,;:!?¡¿'»”’…]+$/;

/** Quita la puntuación final y los paréntesis de cierre que no se abrieron dentro del enlace. */
function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const before = url;
    url = url.replace(TRAILING, "");
    if (url.endsWith(")")) {
      const open = (url.match(/\(/g) ?? []).length;
      const close = (url.match(/\)/g) ?? []).length;
      if (close > open) url = url.slice(0, -1);
    }
    if (url === before) return url;
  }
}

/** Enlace seguro para un trozo que parece una URL; null si no lo es de verdad. */
export function safeUrl(raw: string): string | null {
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Trocea una línea en texto y enlaces. */
export function linkifyLine(line: string): RichSegment[] {
  const out: RichSegment[] = [];
  let last = 0;
  const push = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev?.kind === "text") prev.text += text;
    else out.push({ kind: "text", text });
  };
  for (const m of line.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    const raw = m[0];
    const isEmail = !/^(https?:\/\/|www\.)/i.test(raw);
    const text = isEmail ? raw.replace(/\.+$/, "") : trimUrl(raw);
    const href = isEmail ? `mailto:${text}` : safeUrl(text);
    push(line.slice(last, start));
    if (href && text) {
      out.push(isEmail ? { kind: "link", text, href, email: true } : { kind: "link", text, href });
      last = start + text.length;
    } else {
      push(raw);
      last = start + raw.length;
    }
  }
  push(line.slice(last));
  return out;
}

/** Párrafos (separados por líneas en blanco) con sus líneas ya troceadas. Sin párrafos vacíos. */
export function parseRichText(text: string): RichParagraph[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.map(linkifyLine));
}

/** Texto plano de un cuerpo (para extractos y descripciones): una sola línea, sin espacios de más. */
export function plainText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Recorta en una palabra entera y añade «…» si hacía falta. */
export function truncateWords(text: string, max: number): string {
  const t = plainText(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.4 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}
