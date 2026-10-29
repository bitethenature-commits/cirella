/**
 * Operaciones del editor de texto con formato (components/rich-text/rich-text-editor.tsx) sobre el
 * valor de un <textarea>. Puras: reciben el texto y la selección y devuelven el cambio (Splice) que
 * el editor aplica con execCommand("insertText") para que «Deshacer» siga funcionando.
 */
import { safeLinkHref } from "./rich-text";

export type Splice = { from: number; to: number; insert: string; selStart: number; selEnd: number };

/** Aplica un Splice a un texto (las pruebas y el modo sin execCommand). */
export function applySplice(v: string, sp: Splice): string {
  return v.slice(0, sp.from) + sp.insert + v.slice(sp.to);
}

/** Pone o quita «**» (negrita) o «_» (cursiva) alrededor de la selección. */
export function toggleInline(v: string, s: number, e: number, mark: "**" | "_" | "==", placeholder: string): Splice {
  const m = mark.length;
  const sel = v.slice(s, e);
  if (!sel) {
    // Sin selección: la marca justo alrededor del cursor se quita; si no, se escribe con un texto de ejemplo.
    if (v.slice(s - m, s) === mark && v.slice(s, s + m) === mark) return { from: s - m, to: s + m, insert: "", selStart: s - m, selEnd: s - m };
    return { from: s, to: e, insert: mark + placeholder + mark, selStart: s + m, selEnd: s + m + placeholder.length };
  }
  if (v.slice(s - m, s) === mark && v.slice(e, e + m) === mark) return { from: s - m, to: e + m, insert: sel, selStart: s - m, selEnd: e - m };
  if (sel.length >= 2 * m + 1 && sel.startsWith(mark) && sel.endsWith(mark)) {
    const inner = sel.slice(m, -m);
    return { from: s, to: e, insert: inner, selStart: s, selEnd: s + inner.length };
  }
  // Los espacios de los bordes quedan fuera de la marca («** hola**» no sería negrita).
  const lead = sel.match(/^\s*/)![0];
  const trail = sel.slice(lead.length).match(/\s*$/)![0];
  const core = sel.slice(lead.length, sel.length - trail.length);
  if (!core) return { from: s, to: e, insert: sel + mark + placeholder + mark, selStart: e + m, selEnd: e + m + placeholder.length };
  const insert = lead + mark + core + mark + trail;
  const start = s + lead.length + m;
  return { from: s, to: e, insert, selStart: start, selEnd: start + core.length };
}

export type LineTool = "h2" | "h3" | "ul" | "ol" | "quote";

const PREFIX: Record<LineTool, RegExp> = {
  h2: /^#{1,2}[ \t]+/,
  h3: /^###[ \t]+/,
  ul: /^(?:[-*][ \t]+|•[ \t]*)/,
  ol: /^\d{1,3}[.)][ \t]+/,
  quote: /^>[ \t]?/,
};
const ANY_PREFIX = /^(?:#{1,3}[ \t]+|[-*][ \t]+|•[ \t]*|\d{1,3}[.)][ \t]+|>[ \t]?)/;

function lineBounds(v: string, s: number, e: number) {
  const start = v.lastIndexOf("\n", s - 1) + 1;
  let endFrom = e;
  if (e > s && v[e - 1] === "\n") endFrom = e - 1;
  const nl = v.indexOf("\n", endFrom);
  return { start, end: nl === -1 ? v.length : nl };
}

/** Encabezado, subencabezado, lista, lista numerada o cita en las líneas seleccionadas (o las quita). */
export function toggleLinePrefix(v: string, s: number, e: number, tool: LineTool): Splice {
  const { start, end } = lineBounds(v, s, e);
  const lines = v.slice(start, end).split("\n");
  const filled = lines.filter((l) => l.trim());
  const has = (l: string) => PREFIX[tool].test(l) && !(tool === "h2" && PREFIX.h3.test(l));
  const allHave = filled.length > 0 && filled.every(has);
  let n = 0;
  const out = lines.map((l) => {
    if (!l.trim() && lines.length > 1) return l;
    if (allHave) return l.replace(PREFIX[tool], "");
    const body = l.replace(ANY_PREFIX, "");
    const prefix = tool === "h2" ? "## " : tool === "h3" ? "### " : tool === "ul" ? "- " : tool === "ol" ? `${++n}. ` : "> ";
    return prefix + body;
  });
  const insert = out.join("\n");
  if (lines.length === 1 && s === e) {
    const caret = Math.max(start, Math.min(start + insert.length, s + (insert.length - (end - start))));
    return { from: start, to: end, insert, selStart: caret, selEnd: caret };
  }
  return { from: start, to: end, insert, selStart: start, selEnd: start + insert.length };
}

/** Inserta un bloque en su propia línea, con una línea en blanco antes y después. */
function insertBlock(v: string, s: number, block: string): Splice {
  const before = v.slice(0, s);
  const after = v.slice(s);
  const pre = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const post = after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const insert = pre + block + post;
  const caret = s + insert.length;
  return { from: s, to: s, insert, selStart: caret, selEnd: caret };
}

export function insertDivider(v: string, s: number): Splice {
  return insertBlock(v, s, "---");
}

export function insertImage(v: string, s: number, src: string, alt: string): Splice {
  const cleanAlt = alt.replace(/[[\]\n\r]/g, " ").trim().slice(0, 300);
  return insertBlock(v, s, `![${cleanAlt}](${src})`);
}

/** Enlace [texto](dirección) en lugar de la selección. */
export function insertLink(v: string, s: number, e: number, text: string, href: string): Splice {
  const safeHref = href.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/ /g, "%20");
  const label = (text.trim() || href).replace(/\n/g, " ").replace(/([[\]])/g, "\\$1");
  const insert = `[${label}](${safeHref})`;
  const caret = s + insert.length;
  return { from: s, to: e, insert, selStart: caret, selEnd: caret };
}

/**
 * Intro dentro de una lista: sigue con «- » (o «4. »). En un punto vacío, termina la lista (quita
 * la marca). null = Intro normal.
 */
export function continueListOnEnter(v: string, caret: number): Splice | null {
  const start = v.lastIndexOf("\n", caret - 1) + 1;
  const nl = v.indexOf("\n", caret);
  const end = nl === -1 ? v.length : nl;
  const line = v.slice(start, end);
  const m = line.match(/^([ \t]*)(?:([-*•])[ \t]*|(\d{1,3})([.)])[ \t]+)(.*)$/);
  if (!m) return null;
  // «*negrita*» al principio de una línea no es una lista.
  if (m[2] === "*" && !/^[ \t]*\*[ \t]+/.test(line)) return null;
  if (m[2] === "-" && !/^[ \t]*-[ \t]+/.test(line)) return null;
  if (caret - start < line.length - m[5].length) return null;
  if (!m[5].trim()) return { from: start, to: end, insert: "", selStart: start, selEnd: start };
  const marker = m[3] ? `${Number(m[3]) + 1}${m[4]} ` : `${m[2]} `;
  const insert = `\n${m[1]}${marker}`;
  return { from: caret, to: caret, insert, selStart: caret + insert.length, selEnd: caret + insert.length };
}

export const LINK_INPUT_ERROR = "Revisa la dirección: por ejemplo https://instagram.com/tu_usuario, tu email o un teléfono";

/** Lo que escribe en «Dirección»: dominio suelto → https://, email → mailto:, teléfono → tel:. */
export function normalizeLinkInput(raw: string): { href: string } | { error: string } {
  const t = raw.trim();
  if (!t) return { error: "Escribe la dirección del enlace" };
  let candidate = t;
  const email = t.replace(/^mailto:/i, "");
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) candidate = `mailto:${email}`;
  else if (/^\+?[\d\s().-]+$/.test(t)) {
    const digits = t.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) return { error: LINK_INPUT_ERROR };
    candidate = `tel:${t.trim().startsWith("+") ? "+" : ""}${digits}`;
  } else if (!t.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(t) && t.includes(".")) candidate = `https://${t}`;
  const safe = safeLinkHref(candidate);
  return safe ? { href: safe.href } : { error: LINK_INPUT_ERROR };
}
