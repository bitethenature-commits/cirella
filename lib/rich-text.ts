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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Texto con formato («MD»): un Markdown pequeño, al estilo de WhatsApp, guardado como texto plano.
//
//   *x* o **x** → negrita · _x_ → cursiva · «# » o «## » → encabezado · «### » → subencabezado
//   «- », «* », «•» → lista · «1.» → lista numerada · «> » → cita · «---» (o «—-» del iPhone) → línea
//   [texto](https://…|/ruta|mailto:|tel:) → enlace · ![alt](/media/…) sola en su línea → imagen
//
// Cada campo lleva al lado su columna «…Format»: null = texto de antes (se pinta exactamente como
// siempre, components/rich-text/legacy-text.tsx); "MD" = texto con formato. El analizador no deja
// pasar HTML: «<» es texto. Es lineal (sin expresiones regulares con retroceso sobre todo el texto).
// ─────────────────────────────────────────────────────────────────────────────────────────────

export const RICH_TEXT_FORMAT = "MD" as const;
export type TextFormat = typeof RICH_TEXT_FORMAT | null;

export function isRich(format: string | null | undefined): boolean {
  return format === RICH_TEXT_FORMAT;
}

/**
 * Campo de formato que llega de un formulario, tolerante: "MD" → "MD"; "", null o un valor
 * desconocido → null (texto de antes); ausente (undefined) → undefined = «conserva el guardado».
 * Nunca falla: un texto antiguo sin tocar se guarda igual que antes.
 */
export function parseTextFormat(v: unknown): "MD" | null | undefined {
  if (v === undefined) return undefined;
  return v === RICH_TEXT_FORMAT ? RICH_TEXT_FORMAT : null;
}

/** Formato que se guarda: sin texto → null; sin campo → el que ya tenía; si no, el recibido. */
/** Saltos de línea como \n (un <textarea> los envía como \r\n y el texto de antes los separa por \n). */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function formatToStore(text: string | null | undefined, parsed: "MD" | null | undefined, current: string | null): "MD" | null {
  if (!text || !text.trim()) return null;
  if (parsed === undefined) return isRich(current) ? RICH_TEXT_FORMAT : null;
  return parsed;
}

export type RichInline =
  | { t: "text"; v: string }
  | { t: "b" | "i"; c: RichInline[] }
  | { t: "a"; href: string; external: boolean; c: RichInline[] }
  | { t: "br" };

export type RichBlock =
  | { t: "p"; c: RichInline[] }
  | { t: "h"; level: 2 | 3; c: RichInline[] }
  | { t: "ul"; items: RichInline[][] }
  | { t: "ol"; start: number; items: RichInline[][] }
  | { t: "quote"; c: RichInline[] }
  | { t: "hr" }
  | { t: "img"; src: string; alt: string };

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const UNSAFE_HREF_CHARS = /[\s\u0000-\u001f\u007f"'<>\\`]/;

/**
 * Enlace que se puede pintar: http/https (o www.) con dominio de verdad, mailto con un email,
 * tel con 6–15 cifras o una ruta de esta web («/mi-curso», nunca «//otra.web»). Cualquier otra
 * cosa (javascript:, data:, espacios, comillas, «<»…) → null y se queda como texto.
 */
export function safeLinkHref(raw: string): { href: string; external: boolean } | null {
  if (!raw || raw.length > 2048 || UNSAFE_HREF_CHARS.test(raw)) return null;
  if (raw.startsWith("/")) return raw.startsWith("//") ? null : { href: raw, external: false };
  const lower = raw.toLowerCase();
  if (lower.startsWith("mailto:")) {
    const addr = raw.slice(7);
    return EMAIL_RE.test(addr) ? { href: `mailto:${addr}`, external: false } : null;
  }
  if (lower.startsWith("tel:")) {
    const num = raw.slice(4);
    return /^\+?\d{6,15}$/.test(num) ? { href: `tel:${num}`, external: false } : null;
  }
  if (/^(?:https?:\/\/|www\.)/i.test(raw)) {
    const url = safeUrl(raw);
    return url ? { href: url, external: true } : null;
  }
  return null;
}

/** Imagen dentro del texto: solo las subidas aquí (/media/<creadora>/<id>.webp) o las de la demo. */
export function richImageSrc(raw: string): string | null {
  return /^\/media\/[a-z0-9]+\/[a-f0-9]{20}\.webp$/.test(raw) || /^\/demo\/[\w-]+\.(?:webp|jpg|png)$/.test(raw) ? raw : null;
}

const IMAGE_LINE = /^!\[([^\]\n]{0,300})\]\(([^\s()]{1,300})\)$/;
const BIDI_AND_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g;

/**
 * Limpieza al guardar un texto MD: saltos de línea normales, sin caracteres de control ni de
 * dirección (que permiten disfrazar un enlace) y sin imágenes de otra creadora (o ninguna si el
 * campo no admite imágenes, como los correos o los bloques de la página).
 */
export function cleanRichInput(text: string, o: { creatorId: string; images: boolean }): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(BIDI_AND_CONTROLS, "")
    .split("\n")
    .filter((line) => {
      const m = line.trim().match(/^!\[[^\]\n]*\]\(([^)\s]*)\)$/);
      if (!m) return true;
      if (!o.images) return false;
      return m[1].startsWith(`/media/${o.creatorId}/`) || m[1].startsWith("/demo/");
    })
    .join("\n");
}

// ── Bloques ──

const MAX_BLOCKS = 2000;
const MAX_LIST_ITEMS = 500;

type LineKind =
  | { k: "blank" }
  | { k: "h"; level: 2 | 3; text: string }
  | { k: "hr" }
  | { k: "img"; src: string; alt: string }
  | { k: "ul"; text: string }
  | { k: "ol"; n: number; text: string }
  | { k: "quote"; text: string }
  | { k: "text"; text: string };

function isDivider(l: string): boolean {
  const s = l.replace(/[ \t]/g, "");
  if (s.length < 3 && !/[—–]/.test(s)) return false;
  if (/^\*{3,}$/.test(s) || /^_{3,}$/.test(s)) return true;
  if (!/^[-—–]+$/.test(s)) return false;
  let weight = 0;
  for (const ch of s) weight += ch === "-" ? 1 : 2;
  return weight >= 3;
}

function classify(raw: string): LineKind {
  const l = raw.trim();
  if (!l) return { k: "blank" };
  let m = l.match(/^###[ \t]+(.*)$/);
  if (m) return { k: "h", level: 3, text: m[1] };
  m = l.match(/^#{1,2}[ \t]+(.*)$/);
  if (m) return { k: "h", level: 2, text: m[1] };
  if (isDivider(l)) return { k: "hr" };
  m = l.match(IMAGE_LINE);
  if (m) {
    const src = richImageSrc(m[2]);
    if (src) return { k: "img", src, alt: m[1] };
  }
  m = l.match(/^(?:[-*][ \t]+|•[ \t]*)(.*)$/);
  if (m) return { k: "ul", text: m[1] };
  m = l.match(/^(\d{1,3})[.)][ \t]+(.*)$/);
  if (m) return { k: "ol", n: Number(m[1]), text: m[2] };
  m = l.match(/^>[ \t]?(.*)$/);
  if (m) return { k: "quote", text: m[1] };
  return { k: "text", text: l };
}

/** Árbol del texto MD: bloques y, dentro, texto, negrita, cursiva, enlaces y saltos de línea. */
export function parseRich(text: string): RichBlock[] {
  const lines = (text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: RichBlock[] = [];
  // Bloque abierto que admite más líneas (párrafo, cita o lista).
  let open: RichBlock | null = null;
  const close = () => {
    open = null;
  };
  const withBreak = (c: RichInline[], more: RichInline[]) => {
    if (c.length) c.push({ t: "br" });
    c.push(...more);
  };
  for (let i = 0; i < lines.length; i++) {
    if (blocks.length >= MAX_BLOCKS) {
      // Más bloques de los razonables: el resto va como un párrafo de texto, sin formato.
      const rest = lines.slice(i).join("\n").trim();
      if (rest) blocks.push({ t: "p", c: [{ t: "text", v: rest }] });
      break;
    }
    const line = classify(lines[i]);
    const cur = open as RichBlock | null;
    switch (line.k) {
      case "blank":
        close();
        break;
      case "h":
        close();
        blocks.push({ t: "h", level: line.level, c: parseInline(line.text) });
        break;
      case "hr":
        close();
        blocks.push({ t: "hr" });
        break;
      case "img":
        close();
        blocks.push({ t: "img", src: line.src, alt: line.alt });
        break;
      case "ul":
        if (cur?.t === "ul" && cur.items.length < MAX_LIST_ITEMS) cur.items.push(parseInline(line.text));
        else {
          const b: RichBlock = { t: "ul", items: [parseInline(line.text)] };
          blocks.push(b);
          open = b;
        }
        break;
      case "ol":
        if (cur?.t === "ol" && cur.items.length < MAX_LIST_ITEMS) cur.items.push(parseInline(line.text));
        else {
          const b: RichBlock = { t: "ol", start: line.n, items: [parseInline(line.text)] };
          blocks.push(b);
          open = b;
        }
        break;
      case "quote":
        if (cur?.t === "quote") withBreak(cur.c, parseInline(line.text));
        else {
          const b: RichBlock = { t: "quote", c: parseInline(line.text) };
          blocks.push(b);
          open = b;
        }
        break;
      case "text":
        if (cur?.t === "p") withBreak(cur.c, parseInline(line.text));
        else if (cur?.t === "ul" || cur?.t === "ol") {
          // Continuación perezosa: la línea sigue el último punto de la lista.
          withBreak(cur.items[cur.items.length - 1], parseInline(line.text));
        } else {
          const b: RichBlock = { t: "p", c: parseInline(line.text) };
          blocks.push(b);
          open = b;
        }
        break;
    }
  }
  return blocks;
}

// ── Línea: escapes → [texto](enlace) → enlaces automáticos → negrita y cursiva ──

const ESCAPABLE = new Set(["\\", "*", "_", "#", "-", ">", "[", "]", "(", ")", "!"]);
const LINK_TEXT_MAX = 300;
const LINK_HREF_MAX = 2048;
// Como TOKEN, pero una URL puede empezar justo después de «*» o «_» (p. ej. «_www.x.es_»).
const TOKEN_MD = /(?<![A-Za-z0-9])(?:https?:\/\/|www\.)[^\s<>"]+|(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi;

type Piece = { k: "text"; v: string; literal?: boolean } | { k: "atom"; node: RichInline };

/** Intenta leer «[texto](enlace)» empezando en `i` (un «[»). Devuelve el final y el enlace. */
function readLink(line: string, i: number): { end: number; text: string; href: string; external: boolean } | null {
  let j = i + 1;
  const textEnd = Math.min(line.length, i + 1 + LINK_TEXT_MAX + 1);
  while (j < textEnd && line[j] !== "]" && line[j] !== "[") {
    if (line[j] === "\\") j++;
    j++;
  }
  if (j >= line.length || line[j] !== "]" || line[j + 1] !== "(") return null;
  const text = line.slice(i + 1, j);
  if (!text.trim()) return null;
  let k = j + 2;
  let depth = 1;
  const hrefEnd = Math.min(line.length, k + LINK_HREF_MAX + 1);
  for (; k < hrefEnd; k++) {
    const ch = line[k];
    if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) break;
    else if (ch === " " || ch === "\t" || ch === "[" || ch === "]") return null;
  }
  if (depth !== 0 || k >= line.length) return null;
  const link = safeLinkHref(line.slice(j + 2, k));
  return link ? { end: k + 1, text, ...link } : null;
}

/** Recorta un enlace automático: puntuación final (como trimUrl) y marcas «*»/«_» del final. */
function trimMdUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const before = url;
    url = trimUrl(url).replace(/[*_]+$/, "");
    if (url === before) return url;
  }
}

function autolinkPieces(text: string, out: Piece[]) {
  let last = 0;
  for (const m of text.matchAll(TOKEN_MD)) {
    const start = m.index ?? 0;
    if (start < last) continue;
    const raw = m[0];
    const isEmail = !/^(https?:\/\/|www\.)/i.test(raw);
    let shift = 0;
    let candidate = raw;
    if (isEmail) {
      // «_hola@x.es_»: las marcas del principio no son parte del email.
      const lead = raw.match(/^[._%+-]*/)![0].length;
      shift = lead;
      candidate = raw.slice(lead).replace(/\.+$/, "");
    } else candidate = trimMdUrl(raw);
    const href = !candidate ? null : isEmail ? (/^[A-Za-z0-9]/.test(candidate) && EMAIL_RE.test(candidate) ? `mailto:${candidate}` : null) : safeUrl(candidate);
    if (!href) continue;
    if (start + shift > last) out.push({ k: "text", v: text.slice(last, start + shift) });
    out.push({ k: "atom", node: { t: "a", href, external: !isEmail, c: [{ t: "text", v: candidate }] } });
    last = start + shift + candidate.length;
  }
  if (last < text.length) out.push({ k: "text", v: text.slice(last) });
}

/** Trozos de una línea: texto (con marcas), caracteres escapados (literales) y enlaces (atómicos). */
function scanPieces(line: string, links: boolean): Piece[] {
  const out: Piece[] = [];
  let buf = "";
  const flush = () => {
    if (!buf) return;
    if (links) autolinkPieces(buf, out);
    else out.push({ k: "text", v: buf });
    buf = "";
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length && ESCAPABLE.has(line[i + 1])) {
      flush();
      out.push({ k: "text", v: line[i + 1], literal: true });
      i++;
      continue;
    }
    if (links && ch === "[") {
      const link = readLink(line, i);
      if (link) {
        flush();
        out.push({ k: "atom", node: { t: "a", href: link.href, external: link.external, c: parseInlineWith(link.text, false) } });
        i = link.end - 1;
        continue;
      }
    }
    buf += ch;
  }
  flush();
  return out;
}

type Item = { k: "text"; v: string } | { k: "atom"; node: RichInline } | { k: "delim"; ch: "*" | "_"; len: number; raw: string; open: boolean; close: boolean };

const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c);
const isPunct = (c: string | undefined) => c !== undefined && /[\p{P}\p{S}]/u.test(c);

function pushText(target: RichInline[], v: string) {
  if (!v) return;
  const prev = target[target.length - 1];
  if (prev?.t === "text") prev.v += v;
  else target.push({ t: "text", v });
}

function parseInlineWith(line: string, links: boolean): RichInline[] {
  // 1) trozos; 2) separa las tiradas de «*» y «_» del texto normal.
  const flat: ({ k: "text"; v: string } | { k: "atom"; node: RichInline } | { k: "run"; ch: "*" | "_"; raw: string })[] = [];
  for (const p of scanPieces(line, links)) {
    if (p.k === "atom" || (p.k === "text" && p.literal)) {
      flat.push(p.k === "atom" ? p : { k: "text", v: p.v });
      continue;
    }
    const re = /\*+|_+|[^*_]+/g;
    for (const m of p.v.matchAll(re)) {
      const s = m[0];
      if (s[0] === "*" || s[0] === "_") flat.push({ k: "run", ch: s[0] as "*" | "_", raw: s });
      else flat.push({ k: "text", v: s });
    }
  }
  // 3) ¿Puede abrir o cerrar? Como en WhatsApp: abre tras inicio, espacio, puntuación o un enlace y
  //    antes de algo que no sea espacio; cierra al revés.
  const charBefore = (idx: number): string | "atom" | undefined => {
    const prev = flat[idx - 1];
    if (!prev) return undefined;
    if (prev.k === "atom") return "atom";
    return prev.k === "text" ? prev.v[prev.v.length - 1] : prev.raw[prev.raw.length - 1];
  };
  const charAfter = (idx: number): string | "atom" | undefined => {
    const next = flat[idx + 1];
    if (!next) return undefined;
    if (next.k === "atom") return "atom";
    return next.k === "text" ? next.v[0] : next.raw[0];
  };
  const items: Item[] = flat.map((f, idx) => {
    if (f.k !== "run") return f;
    if (f.raw.length > 2) return { k: "text", v: f.raw };
    const before = charBefore(idx);
    const after = charAfter(idx);
    const open = (before === undefined || before === "atom" || isSpace(before) || isPunct(before)) && after !== undefined && !isSpace(after);
    const close = before !== undefined && !isSpace(before) && (after === undefined || after === "atom" || isSpace(after) || isPunct(after));
    return { k: "delim", ch: f.ch, len: f.raw.length, raw: f.raw, open, close };
  });
  // 4) Pila de marcas (como mucho dos niveles): cada marca entra y sale una vez.
  type Frame = { ch: "*" | "_"; len: number; raw: string; c: RichInline[] };
  const root: RichInline[] = [];
  const stack: Frame[] = [];
  const cur = () => (stack.length ? stack[stack.length - 1].c : root);
  const append = (target: RichInline[], nodes: RichInline[]) => {
    for (const n of nodes) {
      if (n.t === "text") pushText(target, n.v);
      else target.push(n);
    }
  };
  const unwind = (frame: Frame) => {
    const target = cur();
    pushText(target, frame.raw);
    append(target, frame.c);
  };
  for (const it of items) {
    if (it.k === "text") pushText(cur(), it.v);
    else if (it.k === "atom") cur().push(it.node);
    else {
      let match = -1;
      if (it.close) for (let j = stack.length - 1; j >= 0; j--) if (stack[j].ch === it.ch && stack[j].len === it.len) { match = j; break; }
      if (match >= 0) {
        while (stack.length - 1 > match) unwind(stack.pop()!);
        const f = stack.pop()!;
        if (f.c.length) cur().push({ t: it.ch === "*" ? "b" : "i", c: f.c });
        else pushText(cur(), f.raw + it.raw);
      } else if (it.open && stack.length < 2) stack.push({ ch: it.ch, len: it.len, raw: it.raw, c: [] });
      else pushText(cur(), it.raw);
    }
  }
  while (stack.length) unwind(stack.pop()!);
  return root;
}

function parseInline(line: string): RichInline[] {
  return parseInlineWith(line, true);
}

// ── Texto plano ──

function inlinePlain(nodes: RichInline[]): string {
  return nodes.map((n) => (n.t === "text" ? n.v : n.t === "br" ? "\n" : inlinePlain(n.c))).join("");
}

/** Texto sin marcas (extractos, descripción para buscadores). El de antes se devuelve tal cual. */
export function richToPlain(text: string, format: string | null | undefined): string {
  if (!isRich(format)) return text;
  return parseRich(text)
    .map((b) => {
      switch (b.t) {
        case "p":
        case "h":
        case "quote":
          return inlinePlain(b.c);
        case "ul":
        case "ol":
          return b.items.map((it) => `• ${inlinePlain(it)}`).join("\n");
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
