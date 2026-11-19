import { z } from "zod";
import { BUTTON_FRAMES, buttonFrameKind, buttonFrameMask, CARD_FRAMES, cardFrameMask, type ButtonFrameKey, type CardFrameKey } from "./frames";
import { GEOMETRY_FIGURES } from "./page-blocks";
import { figurePlacement, figureUrl } from "./sacred-figures";

/**
 * Piezas sueltas con su propio aspecto: una tarjeta, un panel dorado o un botón concretos de una página, elegidos
 * tocándolos en la vista en vivo de Mi página › Diseño (con una página en «Qué diseñas»). Lo que no se toca sigue
 * el diseño de esa página.
 *
 * Cada pieza se encuentra por su sitio en la página (su «dirección»): desde lo más cercano que tenga nombre propio
 * (un bloque, una sección, la carta de una lectura) o desde el principio de la página, contando hijos:
 *   «b:k3x9.2.1»     el bloque k3x9 (data-bid), su 2.º hijo y, dentro, el 1.º;
 *   «i:sobre-mi.1»   la sección #sobre-mi, su 1.er hijo;
 *   «o:carta-natal»  la carta de la lectura carta-natal (data-oracle-card);
 *   «r.3.1.2»        desde la raíz de la página (.cp).
 * En la web van en una hoja de estilos de la cabecera (piecesCss, components/creator-page/piece-styles.tsx); en la
 * vista en vivo, la misma hoja con cada pieza marcada (components/creator-page/live-design-apply.tsx).
 * Puro: sirve en el servidor y en el navegador.
 */

export type PieceKind = "card" | "panel" | "button" | "photo";
export const PIECE_KIND_LABEL: Record<PieceKind, string> = { card: "Tarjeta", panel: "Panel dorado", button: "Botón", photo: "Foto" };
/** Lo que se puede tocar en la vista en vivo, de cada tipo. */
export const PIECE_SELECTORS: Record<PieceKind, string> = {
  button: ".cp-btn, .cp-btn-ghost, .cp-link, .cp-sacred-btn",
  panel: ".cp-include-panel, .cp-oracle-card, .cp-show-panel",
  card: ".cp-card",
  photo: ".cp-luxe-frame, .cp-photo-bubble, .cp-oracle-photo, .cp-show-photo, .cp-bubble-img, [data-avatar]",
};
export const PIECES_MAX = 60;

const ANCHOR = /^[A-Za-z0-9_-]{1,60}$/;
const PIECE_ID = /^(?:r(?:\.\d{1,3}){1,24}|[bio]:[A-Za-z0-9_-]{1,60}(?:\.\d{1,3}){0,24})$/;
export const isPieceId = (s: string) => PIECE_ID.test(s);

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();
const int = (min: number, max: number) => z.number().int().min(min).max(max).optional();
export const pieceSchema = z.object({
  kind: z.enum(["card", "panel", "button", "photo"]),
  /** Cómo se llama en la lista (su título o el texto del botón). */
  label: z.string().trim().max(60).default(""),
  bg: hex,
  bgOpacity: int(0, 100),
  /** Solo botones: el color del texto. */
  text: hex,
  border: hex,
  borderWidth: int(0, 6),
  radius: int(0, 60),
  frame: z
    .string()
    .max(30)
    .refine((k) => k in CARD_FRAMES || k in BUTTON_FRAMES)
    .optional(),
  frameColor: hex,
  /** Solo paneles: sin estrellitas ✦ en las esquinas (false). */
  stars: z.boolean().optional(),
  geo: z.enum(["none", ...GEOMETRY_FIGURES]).optional(),
  geoPos: z.enum(["corner", "center"]).optional(),
  geoOpacity: int(0, 100),
  geoColor: hex,
  /** Solo fotos: su forma y la línea de su marco (la de siempre es doble). */
  shape: z.enum(["rounded", "arch", "oval", "circle"]).optional(),
  line: z.enum(["double", "single", "none"]).optional(),
});
export type Piece = z.infer<typeof pieceSchema>;
/** Las piezas de una página, por su dirección. */
export type PagePieces = Record<string, Piece>;

export const piecesSchema = z.record(
  z.string().max(80),
  z
    .record(z.string().max(200), pieceSchema)
    .refine((o) => Object.keys(o).length <= PIECES_MAX, `Como mucho ${PIECES_MAX} piezas sueltas por página`)
    .refine((o) => Object.keys(o).every(isPieceId), "Una pieza suelta no se encuentra en la página"),
);

/** Las piezas guardadas, una a una: lo que esté estropeado se ignora. */
export function readPieces(raw: unknown): Record<string, PagePieces> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, PagePieces> = {};
  for (const [page, list] of Object.entries(raw)) {
    if (page.length > 80 || !list || typeof list !== "object" || Array.isArray(list)) continue;
    const mine: PagePieces = {};
    for (const [id, p] of Object.entries(list)) {
      if (Object.keys(mine).length >= PIECES_MAX) break;
      if (!isPieceId(id)) continue;
      const r = pieceSchema.safeParse(p);
      if (r.success) mine[id] = r.data;
    }
    if (Object.keys(mine).length) out[page] = mine;
  }
  return out;
}

/** ¿La pieza cambia algo? (una sin nada propio no hace falta guardarla). */
export const pieceHasLook = (p: Piece) => Object.entries(p).some(([k, v]) => k !== "kind" && k !== "label" && v !== undefined);

/* ───────────── Encontrar una pieza (en la página del navegador) ───────────── */

/** Lo que la vista en vivo mete dentro de la página: no cuenta al contar hijos. */
export const LIVE_HOST_ATTR = "data-live-design";
const kids = (el: Element) => Array.from(el.children).filter((c) => !c.hasAttribute(LIVE_HOST_ATTR));

function anchorOf(el: Element, root: Element): string | null {
  const unique = (sel: string) => root.querySelectorAll(sel).length === 1;
  const bid = el.getAttribute("data-bid");
  if (bid && ANCHOR.test(bid) && unique(`[data-bid="${bid}"]`)) return `b:${bid}`;
  const card = el.getAttribute("data-oracle-card");
  if (card && ANCHOR.test(card) && unique(`[data-oracle-card="${card}"]`)) return `o:${card}`;
  const id = el.id;
  if (id && /^[a-z][a-z0-9-]{1,59}$/.test(id) && unique(`[id="${id}"]`)) return `i:${id}`;
  return null;
}

/** La dirección de una pieza dentro de la página (null si no se puede dar). */
export function pieceIdOf(el: Element, root: Element): string | null {
  const path: number[] = [];
  let cur: Element = el;
  for (let depth = 0; depth < 40; depth++) {
    if (cur === root) return path.length ? `r.${path.join(".")}` : null;
    const a = anchorOf(cur, root);
    if (a) {
      const id = path.length ? `${a}.${path.join(".")}` : a;
      return isPieceId(id) ? id : null;
    }
    const parent = cur.parentElement;
    if (!parent) return null;
    path.unshift(kids(parent).indexOf(cur) + 1);
    cur = parent;
  }
  return null;
}

/** La pieza que está en esa dirección (null si ya no está). */
export function findPiece(root: Element, id: string): Element | null {
  if (!isPieceId(id)) return null;
  const [head, ...path] = id.split(".");
  const name = head.slice(2);
  let el: Element | null =
    head === "r" ? root : root.querySelector(head[0] === "b" ? `[data-bid="${name}"]` : head[0] === "o" ? `[data-oracle-card="${name}"]` : `[id="${name}"]`);
  for (const p of path) {
    if (!el) return null;
    el = kids(el)[Number(p) - 1] ?? null;
  }
  return el;
}

/* ───────────── Pintarlas ───────────── */

/** El selector CSS de una pieza en la web (null si la dirección no vale). */
export function pieceSelector(id: string): string | null {
  if (!isPieceId(id)) return null;
  const [head, ...path] = id.split(".");
  const name = head.slice(2);
  const anchor = head === "r" ? ".cp" : `.cp ${head[0] === "b" ? `[data-bid="${name}"]` : head[0] === "o" ? `[data-oracle-card="${name}"]` : `[id="${name}"]`}`;
  return anchor + path.map((p) => ` > :nth-child(${Number(p)})`).join("");
}

const GLOW = "radial-gradient(60% 50% at 0% 0%, color-mix(in oklab, var(--c-gold) 8%, transparent), transparent 70%)";

/** Las reglas CSS de una pieza, para el selector dado. `gold`: el color de los detalles de la página. */
export function pieceCss(sel: string, p: Piece, gold: string): string {
  const rules: string[] = [];
  const add = (s: string, decl: (string | false | undefined)[]) => {
    const d = decl.filter(Boolean) as string[];
    if (d.length) rules.push(`${s}{${d.map((x) => `${x} !important`).join(";")}}`);
  };
  const fc = p.frameColor ?? gold;
  const border = [p.border && `border-color:${p.border}`, p.borderWidth != null && `border-width:${p.borderWidth}px`, (p.border || p.borderWidth != null) && "border-style:solid"];

  if (p.kind === "button") {
    add(sel, [
      p.bg && `background:color-mix(in oklab, ${p.bg} ${p.bgOpacity ?? 100}%, transparent)`,
      p.text && `color:${p.text}`,
      ...border,
      p.radius != null && `border-radius:${p.radius >= 60 ? "999px" : `${p.radius}px`}`,
    ]);
    if (p.frame && p.frame in BUTTON_FRAMES) {
      const kind = p.frame === "none" ? null : buttonFrameKind(p.frame as ButtonFrameKey);
      if (!kind) {
        add(sel, ["outline:none", "animation:none"]);
        add(`${sel}::before`, ["background:none", "-webkit-mask:none", "mask:none"]);
      } else if (kind === "ends") {
        const mask = buttonFrameMask(p.frame as ButtonFrameKey);
        add(sel, ["position:relative"]);
        add(`${sel}:not(.w-full)`, ["margin-inline:1.4em"]);
        if (mask) add(`${sel}::before`, ['content:""', "position:absolute", "inset:-8px -1.5em", "pointer-events:none", `background:${fc}`, `-webkit-mask:${mask}`, `mask:${mask}`]);
      } else if (kind === "neon") {
        add(sel, [`box-shadow:0 0 0 1px ${fc}, 0 0 16px -2px ${fc}, inset 0 0 10px -4px ${fc}`, "animation:cp-neon 2.6s ease-in-out infinite alternate"]);
      } else {
        add(sel, [kind === "double" ? `outline:4px double ${fc}` : kind === "dashed" ? `outline:1.5px dashed ${fc}` : `outline:2px dotted ${fc}`, `outline-offset:${kind === "double" ? 3 : 4}px`]);
      }
    }
    return rules.join("");
  }

  if (p.kind === "photo") {
    // Fotos: su forma, su borde y la línea del marco («Sobre mí», fichas, burbujas…).
    const round = p.shape === "oval" || p.shape === "circle";
    add(sel, [
      p.shape === "arch" ? "border-radius:999px 999px 0 0" : round ? "border-radius:50%" : p.radius != null && `border-radius:${p.radius}px`,
      p.shape === "circle" && "aspect-ratio:1 / 1",
      ...border,
      p.line && p.line !== "double" && "box-shadow:none",
      p.line === "none" && "border-color:transparent",
      p.line === "none" && "padding:0",
      p.line === "none" && "background:none",
    ]);
    if (p.shape === "circle") add(`${sel} > img`, ["height:100%", "object-fit:cover"]);
    if (p.shape || p.radius != null) add(`${sel}::after`, ["border-radius:inherit"]);
    if (p.line && p.line !== "double") add(`${sel}::after`, ["display:none"]);
  } else {
    // Tarjetas y paneles dorados.
    add(sel, [p.bg && `background-color:color-mix(in oklab, ${p.bg} ${p.bgOpacity ?? 100}%, transparent)`, ...border, p.radius != null && `border-radius:${p.radius}px`]);
  }
  const mask = p.frame && p.frame !== "none" && p.frame !== "neon" && p.frame in CARD_FRAMES ? cardFrameMask(p.frame as CardFrameKey, 56) : null;
  if (p.frame && p.frame in CARD_FRAMES) {
    if (p.frame === "none") {
      add(sel, ["animation:none"]);
      add(`${sel}::before`, ["background:none", "-webkit-mask:none", "mask:none"]);
    } else if (p.frame === "neon") {
      add(sel, [`border-color:${fc}`, `box-shadow:0 0 0 1px ${fc}, 0 0 18px -2px ${fc}, inset 0 0 14px -4px ${fc}`, "animation:cp-neon 3.2s ease-in-out infinite alternate"]);
    } else if (mask) {
      add(sel, ["position:relative"]);
      add(`${sel}::before`, [
        'content:""',
        "display:block",
        "position:absolute",
        "inset:5px",
        "z-index:6",
        "pointer-events:none",
        "border-radius:inherit",
        "opacity:1",
        `background:${fc}`,
        `-webkit-mask:${mask}`,
        `mask:${mask}`,
      ]);
    }
  }
  if (p.kind === "photo") return rules.join("");
  if (p.stars === false) {
    add(`${sel}::after`, ["content:none"]);
    if (!mask) add(`${sel}::before`, ["content:none"]);
  }
  if (p.geo) {
    // Su geometría (o ninguna) en lugar de la de siempre o la de la página.
    add(`${sel} > :is(.cp-include-geo, .cp-oracle-geo, .cp-show-geo)`, ["display:none"]);
    if (p.geo === "none") add(sel, ["--pg-img:none"]);
    else {
      const place = figurePlacement(p.geoPos ?? "corner");
      add(sel, [
        `background-image:${figureUrl(p.geo, p.geoColor ?? gold, p.geoOpacity ?? 16)}, ${GLOW}`,
        `background-position:${place.position}, 0 0`,
        `background-size:${place.size}, auto`,
        "background-repeat:no-repeat",
      ]);
    }
  }
  return rules.join("");
}

/** La hoja de estilos de las piezas de una página (vacía si no hay ninguna). */
export function piecesCss(pieces: PagePieces | undefined, gold: string): string {
  if (!pieces) return "";
  let css = "";
  for (const [id, p] of Object.entries(pieces)) {
    const sel = pieceSelector(id);
    if (sel) css += pieceCss(sel, p, gold);
  }
  return css;
}
