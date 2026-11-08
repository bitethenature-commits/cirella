import type { ComputedProfile } from "@/lib/birth-profile";
import type { FocusBody } from "@/lib/lesson-blocks";

/** Lo común a las capas del modelo por partes que no son la rueda de la carta (components/course/system-layers.tsx). */

export type SystemPiece = { glyph: string; name: string; kicker: string; meaning: string; personal: string | null };

/** Lo que cada capa sabe de la lección y de la alumna: la configuración elegida, su carta y el planeta de la lección. */
export type LayerCtx = {
  option: string | null;
  c: ComputedProfile | null;
  focus: FocusBody | null;
  /** Sinastría: las otras personas guardadas en «Mi energía», la elegida y su carta ya calculada. */
  others?: { name: string }[];
  otherIndex?: number;
  pickOther?: (i: number) => void;
  other?: ComputedProfile | null;
  /** Los textos de la dueña para cada pieza (planeta + signo + casa los combina). */
  notes?: Record<string, string>;
};

/** Los atributos para que una pieza del dibujo se pueda tocar (o elegir con el teclado). */
export type Tap = (k: string, label: string) => Record<string, unknown>;

export type DiagramProps = { selected: string; mine: string[]; keys: string[]; tap: Tap; ctx: LayerCtx };

export const INK = "#1E1A2E";
export const GOLD = "#B08D4F";
export const CREAM = "#F6F1E7";
export const SAND = "#F3ECDD";
export const LINE = "#E5DDCD";
export const MUTED = "#8A8698";
/** El diseño (inconsciente) en rojo, como en las cartas de Human Design. */
export const DESIGN_RED = "#C8453B";
export const VS = "︎"; // los símbolos como texto, no como emoji

export const norm = (x: number) => ((x % 360) + 360) % 360;
export const signIndex = (lon: number) => Math.floor(norm(lon) / 30) % 12;
export const degIn = (lon: number) => `${Math.floor(norm(lon) % 30)}°`;

/** Ruedas de 340 × 340 como una carta impresa: Aries a la izquierda, en sentido contrario a las agujas. */
export const C = 170;
export function pt(lambda: number, r: number) {
  const a = ((180 + lambda) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
}
export function sector(l1: number, l2: number, r1: number, r2: number) {
  const a = pt(l1, r2);
  const b = pt(l2, r2);
  const c = pt(l2, r1);
  const d = pt(l1, r1);
  const large = l2 - l1 > 180 ? 1 : 0;
  return `M${a.x} ${a.y}A${r2} ${r2} 0 ${large} 0 ${b.x} ${b.y}L${c.x} ${c.y}A${r1} ${r1} 0 ${large} 1 ${d.x} ${d.y}Z`;
}

/** La parte iluminada del disco para una fase (0 = nueva, 0.5 = llena), como se ve desde el hemisferio norte. */
export function moonLit(cx: number, cy: number, r: number, p: number) {
  if (p === 0) return "";
  if (p === 0.5) return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  const rx = Math.abs(r * Math.cos(2 * Math.PI * p));
  const top = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;
  if (p < 0.5) return `M${top}A${r} ${r} 0 0 1 ${bottom}A${rx} ${r} 0 0 ${p < 0.25 ? 0 : 1} ${top}Z`;
  return `M${top}A${r} ${r} 0 0 0 ${bottom}A${rx} ${r} 0 0 ${p < 0.75 ? 1 : 0} ${top}Z`;
}

/** «Sol, Luna y Venus». */
export function listEs(xs: string[]) {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
