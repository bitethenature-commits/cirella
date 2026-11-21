"use client";

import { AArrowDown, AArrowUp, Baseline, Bold, Check, Italic, Link2, List, ListOrdered, RemoveFormatting, Unlink, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EMPTY_PIECE_LOOK, hasPieceLook, type PieceLook, type PieceSize } from "@/lib/course-design";
import { normalizeHex } from "@/lib/colors";
import { LESSON_TEXT_MAX } from "@/lib/lesson-parts";
import { parseRich, safeLinkHref, type RichBlock, type RichInline } from "@/lib/rich-text";
import { ALIGN_OPTIONS, SIZE_LABEL } from "./design-panel";

/*
 * El texto de una lección escrito encima, como en Canva: lo que se ve es lo que verá la alumna. Por dentro se guarda
 * en el formato de siempre (lib/rich-text.ts, «MD»): al abrirlo se pinta como HTML y al escribir se vuelve a pasar a
 * MD. Solo lo que el MD sabe guardar: títulos («## »/«### »), citas, listas, negrita, cursiva, enlaces seguros y
 * colores hex («[texto]{#RRGGBB}»). Al pegar, solo el texto.
 */

// ───────────── MD → HTML (para empezar a escribir) ─────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inlineHtml(nodes: RichInline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
          return esc(n.v);
        case "br":
          return "<br>";
        case "b":
          return `<b>${inlineHtml(n.c)}</b>`;
        case "i":
          return `<i>${inlineHtml(n.c)}</i>`;
        case "c":
          return `<font color="${n.color}">${inlineHtml(n.c)}</font>`;
        case "a":
          return `<a href="${esc(n.href)}">${inlineHtml(n.c)}</a>`;
      }
    })
    .join("");
}

function blockHtml(b: RichBlock): string {
  switch (b.t) {
    case "p":
      return `<p>${inlineHtml(b.c)}</p>`;
    case "h":
      return b.level === 2 ? `<h3>${inlineHtml(b.c)}</h3>` : `<h4>${inlineHtml(b.c)}</h4>`;
    case "ul":
      return `<ul>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join("")}</ul>`;
    case "ol":
      return `<ol${b.start === 1 ? "" : ` start="${b.start}"`}>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join("")}</ol>`;
    case "quote":
      return `<blockquote>${inlineHtml(b.c)}</blockquote>`;
    case "hr":
      return "<hr>";
    case "img":
      return "";
  }
}

/** El texto guardado como HTML para escribir encima. Sin formato (textos de antes): párrafos y saltos de línea. */
export function mdToHtml(text: string, format: "MD" | null): string {
  if (format === "MD") return parseRich(text).map(blockHtml).join("");
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.split("\n").map(esc).join("<br>")}</p>`)
    .join("");
}

// ───────────── HTML → MD (al escribir) ─────────────

type Style = { b: boolean; i: boolean; color: string | null; href: string | null };
type TextRun = Style & { t: string };
type Run = TextRun | { br: true };

const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "UL", "OL", "LI", "HR", "FIGURE", "PRE", "SECTION", "ARTICLE", "TABLE", "TR"]);
const isBlockEl = (n: Node): n is HTMLElement => n.nodeType === 1 && BLOCK_TAGS.has((n as Element).tagName);
const isList = (n: Node) => n.nodeType === 1 && ((n as Element).tagName === "UL" || (n as Element).tagName === "OL");
const NO_STYLE: Style = { b: false, i: false, color: null, href: null };

function toHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (m) return `#${[m[1], m[2], m[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  return normalizeHex(s);
}

/** Los trozos de texto (con su negrita, cursiva, color y enlace) y los saltos de línea de unos nodos. */
function collect(nodes: Node[], st: Style, out: Run[], skipLists = false) {
  for (const child of nodes) {
    if (child.nodeType === 3) {
      const t = (child.nodeValue ?? "").replace(/[\n\r\t]+/g, " ").replace(/ /g, " ");
      if (t) out.push({ ...st, t });
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as HTMLElement;
    const tag = el.tagName;
    if (tag === "BR") {
      out.push({ br: true });
      continue;
    }
    if (el.hasAttribute("data-canva-ui") || tag === "IMG" || tag === "SCRIPT" || tag === "STYLE" || tag === "HR" || (skipLists && isList(el))) continue;
    const ns: Style = { ...st };
    if (tag === "B" || tag === "STRONG") ns.b = true;
    if (tag === "I" || tag === "EM") ns.i = true;
    const fw = el.style?.fontWeight;
    if (fw === "bold" || Number(fw) >= 600) ns.b = true;
    else if (fw === "normal" || (Number(fw) > 0 && Number(fw) < 600)) ns.b = false;
    if (el.style?.fontStyle === "italic") ns.i = true;
    const color = (tag === "FONT" ? toHex(el.getAttribute("color")) : null) ?? toHex(el.style?.color);
    if (color) ns.color = color;
    if (tag === "A") ns.href = safeLinkHref(el.getAttribute("href") ?? "")?.href ?? null;
    const block = BLOCK_TAGS.has(tag);
    const last = out[out.length - 1];
    if (block && last && !("br" in last)) out.push({ br: true });
    collect(Array.from(el.childNodes), ns, out, skipLists);
    if (block) out.push({ br: true });
  }
}

const URLISH = /(?<![A-Za-z0-9])(?:https?:\/\/|www\.)[^\s<>"]+|(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi;
const escPlain = (s: string) => s.replace(/[\\*_[\]]/g, "\\$&");
/** Escapa las marcas; las direcciones web, tal cual (el MD las convierte en enlace antes de mirar las marcas). */
function escText(s: string, inLink: boolean) {
  if (inLink) return escPlain(s);
  let out = "";
  let last = 0;
  for (const m of s.matchAll(URLISH)) {
    const at = m.index ?? 0;
    out += escPlain(s.slice(last, at)) + m[0];
    last = at + m[0].length;
  }
  return out + escPlain(s.slice(last));
}

const isEdge = (c: string | undefined) => c === undefined || /\s/.test(c) || /[\p{P}\p{S}]/u.test(c);

/**
 * Pone `mark` alrededor de `md` (el trozo [s, e) de `plain`), con los espacios de los bordes fuera. Si la marca no se
 * leería así (pegada a una letra: «pal**abra**»), el trozo va sin ella: nunca salen asteriscos sueltos.
 */
function wrap(md: string, plain: string, s: number, e: number, mark: string) {
  if (!mark) return md;
  const lead = md.match(/^\s*/)![0];
  const trail = md.slice(lead.length).match(/\s*$/)![0];
  const core = md.slice(lead.length, md.length - trail.length);
  if (!core) return md;
  const ps = s + lead.length;
  const pe = e - trail.length;
  if (!isEdge(plain[ps - 1]) || !isEdge(plain[pe])) return md;
  return `${lead}${mark}${core}${mark}${trail}`;
}

function segments<T>(items: T[], key: (x: T) => string): { key: string; items: T[] }[] {
  const out: { key: string; items: T[] }[] = [];
  for (const it of items) {
    const k = key(it);
    const last = out[out.length - 1];
    if (last && last.key === k) last.items.push(it);
    else out.push({ key: k, items: [it] });
  }
  return out;
}

const plainOf = (runs: TextRun[]) => runs.map((r) => r.t).join("");

/** Negrita (fuera) y cursiva (dentro) de un trozo con el mismo color y enlace. */
function fmt(items: TextRun[], inLink: boolean) {
  const plain = plainOf(items);
  let pos = 0;
  let out = "";
  for (const bs of segments(items, (r) => (r.b ? "b" : ""))) {
    const bPlain = plainOf(bs.items);
    let ipos = pos;
    let inner = "";
    for (const is of segments(bs.items, (r) => (r.i ? "i" : ""))) {
      const iPlain = plainOf(is.items);
      inner += wrap(escText(iPlain, inLink), plain, ipos, ipos + iPlain.length, is.key ? "_" : "");
      ipos += iPlain.length;
    }
    out += wrap(inner, plain, pos, pos + bPlain.length, bs.key ? "**" : "");
    pos += bPlain.length;
  }
  return out;
}

/** Una línea: los colores por fuera («[…]{#hex}»), los enlaces dentro y la negrita y la cursiva en cada trozo. */
function lineMd(runs: TextRun[]): string {
  const md = segments(runs, (r) => r.color ?? "")
    .map((g) => {
      const inner = segments(g.items, (r) => r.href ?? "")
        .map((h) => (h.key && plainOf(h.items).trim() ? `[${fmt(h.items, true)}](${h.key})` : fmt(h.items, false)))
        .join("");
      return g.key && plainOf(g.items).trim() ? `[${inner}]{${g.key}}` : inner;
    })
    .join("")
    .trim();
  // Una línea que empieza por «#», «-» o «>» sería un título, una lista o una cita.
  return /^[#>-]/.test(md) ? `\\${md}` : md;
}

function linesOf(runs: Run[]): string[] {
  const lines: TextRun[][] = [[]];
  for (const r of runs) {
    if ("br" in r) lines.push([]);
    else lines[lines.length - 1].push(r);
  }
  return lines.map(lineMd);
}

const runsOf = (nodes: Node[], skipLists = false) => {
  const out: Run[] = [];
  collect(nodes, NO_STYLE, out, skipLists);
  return out;
};

function paraMd(runs: Run[]) {
  return linesOf(runs).join("\n").replace(/\n{2,}/g, "\n\n").trim();
}

function listMd(list: HTMLElement, ordered: boolean, start: number, items: string[]) {
  for (const li of Array.from(list.childNodes)) {
    if (li.nodeType === 1 && (li as Element).tagName === "LI") {
      const lines = linesOf(runsOf(Array.from(li.childNodes), true)).filter(Boolean);
      if (lines.length) items.push(`${ordered ? `${start + items.length}.` : "-"} ${lines.join("\n")}`);
      for (const sub of Array.from(li.childNodes)) if (isList(sub)) listMd(sub as HTMLElement, ordered, start, items);
    } else if (isList(li)) listMd(li as HTMLElement, ordered, start, items);
    else {
      const lines = linesOf(runsOf([li])).filter(Boolean);
      if (lines.length) items.push(`${ordered ? `${start + items.length}.` : "-"} ${lines.join("\n")}`);
    }
  }
}

function blockMd(el: HTMLElement, out: string[]) {
  const tag = el.tagName;
  if (el.hasAttribute("data-canva-ui")) return;
  if (/^H[1-6]$/.test(tag)) {
    const t = linesOf(runsOf(Array.from(el.childNodes)))
      .filter(Boolean)
      .join(" ")
      .replace(/^\\(?=[#>-])/, "");
    if (t) out.push(`${Number(tag[1]) <= 3 ? "##" : "###"} ${t}`);
    return;
  }
  if (tag === "HR") return void out.push("---");
  if (tag === "UL" || tag === "OL") {
    const items: string[] = [];
    listMd(el, tag === "OL", Math.max(1, Number(el.getAttribute("start")) || 1), items);
    if (items.length) out.push(items.join("\n"));
    return;
  }
  if (tag === "BLOCKQUOTE") {
    const lines = linesOf(runsOf(Array.from(el.childNodes))).filter(Boolean);
    if (lines.length) out.push(lines.map((l) => `> ${l.replace(/^\\(?=[#>-])/, "")}`).join("\n"));
    return;
  }
  if (Array.from(el.childNodes).some(isBlockEl)) return blocksIn(el, out);
  const md = paraMd(runsOf(Array.from(el.childNodes)));
  if (md) out.push(md);
}

function blocksIn(container: HTMLElement, out: string[]) {
  let pending: Node[] = [];
  const flush = () => {
    if (!pending.length) return;
    const md = paraMd(runsOf(pending));
    if (md) out.push(md);
    pending = [];
  };
  for (const n of Array.from(container.childNodes)) {
    if (isBlockEl(n)) {
      flush();
      blockMd(n, out);
    } else pending.push(n);
  }
  flush();
}

/** Lo escrito encima, en el formato que se guarda. */
export function htmlToMd(root: HTMLElement): string {
  const out: string[] = [];
  blocksIn(root, out);
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ───────────── El texto que se escribe encima y su barra ─────────────

const SIZES: PieceSize[] = ["s", "m", "l", "xl"];
const TEXT_COLORS = ["#D4B57A", "#E2A99B", "#B8A5F0", "#9CC3A0", "#8FB8DE", "#F3EEE4", "#B8653F", "#2A2238"];

type Fmt = { b: boolean; i: boolean; block: string; ul: boolean; ol: boolean; link: string | null };
const NO_FMT: Fmt = { b: false, i: false, block: "p", ul: false, ol: false, link: null };

const tb =
  "inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-lg px-1.5 text-[0.75rem] font-semibold transition hover:bg-white/10 disabled:opacity-35 aria-pressed:bg-[#e9cc8e]/20 aria-pressed:text-[#f7e7bd]";

function Sep() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-[#e9cc8e]/25" aria-hidden />;
}

/** Un botón de la barra: no se lleva el cursor del texto (así lo que está seleccionado sigue seleccionado). */
function Tb({ on, onClick, title, children, disabled }: { on?: boolean; onClick: () => void; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={tb} aria-pressed={on} title={title} aria-label={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Un texto de la lección que se escribe encima. `active`: la pieza está elegida → su barra (estilo del párrafo,
 * listas, negrita, cursiva, color, enlace, quitar formato, alineación y tamaño) encima de ella, que la sigue al
 * bajar. La alineación y el tamaño son del diseño de la pieza (`look`). `startAs`: un texto nuevo empieza como
 * título, subtítulo o cita.
 */
export function InlineRich({
  value,
  format,
  active,
  onChange,
  look,
  onLook,
  startAs,
  autoFocus,
  onFocus,
  placeholder = "Escribe aquí…",
}: {
  value: string;
  format: "MD" | null;
  active: boolean;
  onChange: (md: string) => void;
  look: PieceLook | null | undefined;
  onLook: (l: PieceLook | null) => void;
  startAs?: "h3" | "h4" | "p" | "blockquote";
  autoFocus?: boolean;
  /** Al entrar a escribir (el editor elige la pieza). */
  onFocus?: () => void;
  placeholder?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const emitted = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef<Range | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [fmt, setFmt] = useState<Fmt>(NO_FMT);
  const [pop, setPop] = useState<"color" | "link" | null>(null);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [tooLong, setTooLong] = useState(false);

  const markEmpty = () => {
    const n = el.current;
    if (n) n.toggleAttribute("data-empty", !n.textContent?.trim() && !n.querySelector("hr"));
  };

  const emit = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const n = el.current;
    if (!n) return;
    const md = htmlToMd(n);
    setTooLong(md.length > LESSON_TEXT_MAX);
    if (md === emitted.current) return;
    emitted.current = md;
    onChangeRef.current(md);
  }, []);
  const changed = () => {
    markEmpty();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(emit, 250);
  };

  // Al empezar (y si el texto cambia desde fuera), se pinta lo guardado.
  useLayoutEffect(() => {
    const n = el.current;
    if (!n || (value === emitted.current && n.dataset.ready)) return;
    emitted.current = value;
    n.dataset.ready = "1";
    n.innerHTML = value.trim() ? mdToHtml(value, format) : startAs ? `<${startAs}><br></${startAs}>` : "<p><br></p>";
    markEmpty();
  }, [value, format]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un texto nuevo: el cursor dentro.
  useEffect(() => {
    const n = el.current;
    if (!autoFocus || !n) return;
    requestAnimationFrame(() => {
      n.focus({ preventScroll: false });
      const doc = n.ownerDocument;
      const r = doc.createRange();
      r.selectNodeContents(n.lastElementChild ?? n);
      r.collapse(false);
      const s = doc.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    });
  }, [autoFocus]);

  // Lo seleccionado se recuerda (para la barra) y la barra marca lo que lleva.
  useEffect(() => {
    const n = el.current;
    if (!n) return;
    const doc = n.ownerDocument;
    const onSel = () => {
      const s = doc.getSelection();
      if (!s || !s.rangeCount || !n.contains(s.anchorNode)) return;
      saved.current = s.getRangeAt(0).cloneRange();
      try {
        const a = (s.anchorNode?.nodeType === 1 ? (s.anchorNode as Element) : s.anchorNode?.parentElement)?.closest("a");
        setFmt({
          b: doc.queryCommandState("bold"),
          i: doc.queryCommandState("italic"),
          block: String(doc.queryCommandValue("formatBlock") || "p").toLowerCase(),
          ul: doc.queryCommandState("insertUnorderedList"),
          ol: doc.queryCommandState("insertOrderedList"),
          link: a && n.contains(a) ? (a.getAttribute("href") ?? "") : null,
        });
      } catch {}
    };
    doc.addEventListener("selectionchange", onSel);
    return () => doc.removeEventListener("selectionchange", onSel);
  }, []);

  // Al irse (se quita la pieza, otra lección), lo último escrito se guarda.
  useEffect(() => {
    const node = el.current;
    return () => {
      if (!timer.current || !node) return;
      clearTimeout(timer.current);
      const md = htmlToMd(node);
      if (md === emitted.current) return;
      emitted.current = md;
      onChangeRef.current(md);
    };
  }, []);
  useEffect(() => {
    if (!active) setPop(null);
  }, [active]);

  const restore = () => {
    const n = el.current;
    if (!n) return null;
    const doc = n.ownerDocument;
    n.focus({ preventScroll: true });
    const s = doc.getSelection();
    if (saved.current && s && n.contains(saved.current.startContainer)) {
      s.removeAllRanges();
      s.addRange(saved.current);
    }
    return doc;
  };
  const exec = (cmd: string, arg?: string) => {
    const doc = restore();
    if (!doc) return;
    try {
      doc.execCommand("styleWithCSS", false, "false");
      doc.execCommand(cmd, false, arg);
    } catch {}
    changed();
    doc.dispatchEvent(new Event("selectionchange"));
  };
  const block = (tag: "h3" | "h4" | "p" | "blockquote") => exec("formatBlock", `<${fmt.block === tag && tag !== "p" ? "p" : tag}>`);

  const setLook = (patch: Partial<PieceLook>) => {
    const next = { ...(look ?? EMPTY_PIECE_LOOK), ...patch };
    onLook(hasPieceLook(next) ? next : null);
  };
  const align = ALIGN_OPTIONS.find((a) => a.value === look?.align) ?? ALIGN_OPTIONS[0];
  const size = look?.size ?? "m";
  const step = (d: -1 | 1) => {
    const next = SIZES[Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(size) + d))];
    setLook({ size: next === "m" ? null : next });
  };

  const openLink = () => {
    setLinkError(null);
    setHref(fmt.link ?? "");
    setPop(pop === "link" ? null : "link");
  };
  const applyLink = () => {
    const raw = href.trim();
    const l = safeLinkHref(raw) ?? (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(raw) ? safeLinkHref(`https://${raw}`) : null) ?? (/^\S+@\S+\.\S+$/.test(raw) ? safeLinkHref(`mailto:${raw}`) : null);
    if (!l) return setLinkError("Ese enlace no vale. Prueba con https://…");
    const doc = restore();
    if (!doc) return;
    const s = doc.getSelection();
    try {
      doc.execCommand("styleWithCSS", false, "false");
      if (!s || s.isCollapsed) doc.execCommand("insertHTML", false, `<a href="${esc(l.href)}">${esc(raw)}</a>`);
      else doc.execCommand("createLink", false, l.href);
    } catch {}
    changed();
    setPop(null);
  };

  return (
    <>
      {active && (
        // La barra va encima del texto y, al bajar, se queda arriba mientras el texto se ve.
        <div data-canva-ui className="sticky top-[6.75rem] z-[35] h-0">
          <div className="absolute bottom-2 left-0 max-w-full">
            <div
              role="toolbar"
              aria-label="Formato del texto"
              className="flex flex-wrap items-center gap-0.5 rounded-2xl border border-[#e9cc8e]/45 bg-[#0e0e10]/95 p-1 text-[#f3e2b3] shadow-[0_12px_30px_-10px_rgb(0_0_0/.7)] backdrop-blur"
            >
              <Tb on={fmt.block === "h3"} onClick={() => block("h3")} title="Título">
                Título
              </Tb>
              <Tb on={fmt.block === "h4"} onClick={() => block("h4")} title="Subtítulo">
                Subtítulo
              </Tb>
              <Tb on={fmt.block === "p" || fmt.block === "div"} onClick={() => block("p")} title="Texto">
                Texto
              </Tb>
              <Tb on={fmt.block === "blockquote"} onClick={() => block("blockquote")} title="Cita">
                Cita
              </Tb>
              <Sep />
              <Tb on={fmt.ul} onClick={() => exec("insertUnorderedList")} title="Lista">
                <List className="h-4 w-4" />
              </Tb>
              <Tb on={fmt.ol} onClick={() => exec("insertOrderedList")} title="Lista numerada">
                <ListOrdered className="h-4 w-4" />
              </Tb>
              <Sep />
              <Tb on={fmt.b} onClick={() => exec("bold")} title="Negrita">
                <Bold className="h-4 w-4" />
              </Tb>
              <Tb on={fmt.i} onClick={() => exec("italic")} title="Cursiva">
                <Italic className="h-4 w-4" />
              </Tb>
              <Tb on={pop === "color"} onClick={() => setPop(pop === "color" ? null : "color")} title="Color de las letras">
                <Baseline className="h-4 w-4" />
              </Tb>
              <Tb on={pop === "link" || !!fmt.link} onClick={openLink} title="Enlace">
                <Link2 className="h-4 w-4" />
              </Tb>
              <Tb onClick={() => exec("removeFormat")} title="Quitar el formato">
                <RemoveFormatting className="h-4 w-4" />
              </Tb>
              <Sep />
              <Tb
                onClick={() => {
                  const i = ALIGN_OPTIONS.indexOf(align);
                  const next = ALIGN_OPTIONS[(i + 1) % ALIGN_OPTIONS.length];
                  setLook({ align: next.value === "left" ? null : next.value });
                }}
                title={`Alineación: ${align.label.toLowerCase()}`}
              >
                <align.icon className="h-4 w-4" />
              </Tb>
              <Tb onClick={() => step(-1)} disabled={size === "s"} title="Letra más pequeña">
                <AArrowDown className="h-4 w-4" />
              </Tb>
              <span className="min-w-[4.5rem] text-center text-[0.7rem] font-semibold text-[#f3e2b3]/80" aria-live="polite">
                {SIZE_LABEL[size]}
              </span>
              <Tb onClick={() => step(1)} disabled={size === "xl"} title="Letra más grande">
                <AArrowUp className="h-4 w-4" />
              </Tb>
            </div>

            {pop === "color" && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#e9cc8e]/45 bg-[#0e0e10]/95 p-2 shadow-lg">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`Color ${c}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec("foreColor", c)}
                    className="h-7 w-7 rounded-full border border-white/25 transition hover:scale-110"
                    style={{ background: c }}
                  />
                ))}
                <label
                  title="Otro color"
                  className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-white/25"
                  style={{ background: "conic-gradient(#f87171, #facc15, #4ade80, #22d3ee, #818cf8, #e879f9, #f87171)" }}
                >
                  <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Otro color" onChange={(e) => exec("foreColor", e.target.value)} />
                </label>
              </div>
            )}

            {pop === "link" && (
              <form
                className="mt-1.5 flex w-[min(24rem,100%)] flex-wrap items-center gap-1.5 rounded-2xl border border-[#e9cc8e]/45 bg-[#0e0e10]/95 p-2 shadow-lg"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyLink();
                }}
              >
                <input
                  autoFocus
                  value={href}
                  onChange={(e) => {
                    setHref(e.target.value);
                    setLinkError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setPop(null);
                      restore();
                    }
                  }}
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="https://… o /mi-pagina"
                  aria-label="Adónde lleva el enlace"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-[#e9cc8e]/35 bg-black/30 px-2.5 text-sm text-[#f3ecdd] outline-none placeholder:text-[#f3ecdd]/40 focus:border-[#e9cc8e]"
                />
                <button type="submit" className={tb} title="Poner el enlace" aria-label="Poner el enlace">
                  <Check className="h-4 w-4" />
                </button>
                {fmt.link !== null && (
                  <button
                    type="button"
                    className={tb}
                    title="Quitar el enlace"
                    aria-label="Quitar el enlace"
                    onClick={() => {
                      exec("unlink");
                      setPop(null);
                    }}
                  >
                    <Unlink className="h-4 w-4" />
                  </button>
                )}
                <button type="button" className={tb} title="Cerrar" aria-label="Cerrar" onClick={() => setPop(null)}>
                  <X className="h-4 w-4" />
                </button>
                {linkError && <p className="w-full px-1 text-xs text-[#f2a99f]">{linkError}</p>}
              </form>
            )}
          </div>
        </div>
      )}
      <div
        ref={el}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        role="textbox"
        aria-multiline="true"
        aria-label="Texto de la lección"
        data-rich="md"
        data-inline-rich
        data-placeholder={placeholder}
        className="space-y-4 text-[1.02rem] leading-relaxed text-ink/85 outline-none"
        onFocus={(e) => {
          try {
            e.currentTarget.ownerDocument.execCommand("defaultParagraphSeparator", false, "p");
          } catch {}
          onFocus?.();
        }}
        onInput={changed}
        onBlur={() => emit()}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          if (text) e.currentTarget.ownerDocument.execCommand("insertText", false, text);
        }}
        onDrop={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          const mod = e.metaKey || e.ctrlKey;
          if (mod && e.key.toLowerCase() === "u") e.preventDefault();
          if (mod && e.key.toLowerCase() === "k") {
            e.preventDefault();
            openLink();
          }
          if (e.key === "Escape") e.currentTarget.blur();
        }}
      />
      {tooLong && <p className="mt-2 text-xs font-semibold text-[#f2a99f]">Este texto es demasiado largo para guardarlo: pártelo en dos.</p>}
    </>
  );
}
