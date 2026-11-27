/**
 * El diseño de un curso (su editor de lecciones, como un Canva): cómo se ven sus lecciones para sus alumnas.
 *
 *   · CourseLook, el de todo el curso (Product.courseDesign): la página (color o degradado), los detalles, el fondo
 *     con movimiento, una figura de geometría, una foto de fondo y las letras (títulos y texto, y su tamaño). Sin
 *     nada elegido, cada alumna ve su área con sus colores.
 *   · Una lección puede llevar el suyo (Lesson.design): solo lo que cambia, encima del del curso.
 *   · Cada pieza de la lección (un texto, un vídeo, un PDF…) puede llevar el suyo (LessonPart.design → PieceLook):
 *     su fondo, su borde, sus esquinas, su sombra y su texto (color, tamaño, alineación y letra).
 *
 * Los colores salen por las mismas variables que el área de alumna (lib/account-look.ts): todo lo que ya usa
 * ink, paper, gold… se adapta solo. Puro (sin servidor ni React): lo usan el editor, el reproductor y los guardados.
 */
import type { CSSProperties } from "react";
import { z } from "zod";
import type { AccountLook } from "./account-look";
import { normalizeHex } from "./colors";
import { GEOMETRY_FIGURES, type GeometryFigure } from "./page-blocks";
import { richImageSrc } from "./rich-text";
import { FIGURE_POS_KEYS, type FigurePos } from "./sacred-figures";
import { DECOR_KEYS, FONT_KEYS, FONTS, fontsHref, type Decor, type FontKey } from "./templates";

// ───────────── El del curso (y el de cada lección) ─────────────

export type TextSize = "s" | "m" | "l";

export type CourseLook = {
  /** La página; null = la de cada alumna (si no hay nada más elegido) o la noche de siempre. */
  page: string | null;
  /** Segundo color de la página (degradado); null = un solo color. */
  page2: string | null;
  /** Los detalles (líneas, botones, iconos, la palabra de arriba de cada título); null = el oro de siempre. */
  accent: string | null;
  decor: Decor | null;
  geo: GeometryFigure | null;
  geoPos: FigurePos;
  geoOpacity: number;
  geoSpin: boolean;
  /** Foto de fondo (una subida aquí: /media/…webp) y cuánto se ve (10–100). */
  image: string | null;
  imageOpacity: number;
  /** Letra de los títulos y del texto; null = las de siempre. */
  fontTitle: FontKey | null;
  fontText: FontKey | null;
  /** Tamaño del texto de las lecciones. */
  textSize: TextSize;
};

export const EMPTY_COURSE_LOOK: CourseLook = {
  page: null,
  page2: null,
  accent: null,
  decor: null,
  geo: null,
  geoPos: "corner",
  geoOpacity: 18,
  geoSpin: false,
  image: null,
  imageOpacity: 40,
  fontTitle: null,
  fontText: null,
  textSize: "m",
};

export const COURSE_LOOK_KEYS = Object.keys(EMPTY_COURSE_LOOK) as (keyof CourseLook)[];

const hex = z.unknown().transform((v) => normalizeHex(v));
const photo = z.unknown().transform((v) => (typeof v === "string" ? richImageSrc(v) : null));
const font = z.enum(FONT_KEYS).nullable().catch(null);
const lookShape = {
  page: hex,
  page2: hex,
  accent: hex,
  decor: z.enum(DECOR_KEYS).nullable().catch(null),
  geo: z.enum(GEOMETRY_FIGURES).nullable().catch(null),
  geoPos: z.enum(FIGURE_POS_KEYS).catch("corner"),
  geoOpacity: z.number().int().min(6).max(50).catch(18),
  geoSpin: z.boolean().catch(false),
  image: photo,
  imageOpacity: z.number().int().min(10).max(100).catch(40),
  fontTitle: font,
  fontText: font,
  textSize: z.enum(["s", "m", "l"]).catch("m"),
};
const lookSchema = z.object(lookShape);

/** El del curso, tolerante: lo que no se entiende vuelve a lo de siempre. */
export function readCourseLook(raw: unknown): CourseLook {
  const r = lookSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  return r.success ? r.data : { ...EMPTY_COURSE_LOOK };
}

/** El propio de una lección: solo lo que trae (lo demás, como el curso). */
export function readLookPatch(raw: unknown): Partial<CourseLook> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const full = readCourseLook(src);
  const out: Partial<CourseLook> = {};
  for (const k of COURSE_LOOK_KEYS) if (k in src) (out as Record<string, unknown>)[k] = full[k];
  return out;
}

export const hasLookPatch = (p: Partial<CourseLook> | null | undefined) => !!p && Object.keys(p).length > 0;

/** Lo que ve la alumna en una lección: el del curso con lo propio de la lección encima. */
export function mergeLook(course: CourseLook, patch: Partial<CourseLook> | null | undefined): CourseLook {
  return patch ? { ...course, ...patch } : course;
}

/** ¿Tiene colores, fondo o foto? (si no, cada alumna ve su área con sus colores). */
export function hasLookColors(l: CourseLook): boolean {
  return !!(l.page || l.page2 || l.accent || l.decor || l.geo || l.image);
}

/** Los colores, el fondo y la foto como colores del área de alumna (lib/account-look.ts); null = los de cada alumna. */
export function lookAsAccount(l: CourseLook): AccountLook | null {
  if (!hasLookColors(l)) return null;
  return {
    bar: null,
    page: l.page,
    page2: l.page2,
    accent: l.accent,
    decor: l.decor,
    geo: l.geo,
    geoPos: l.geoPos,
    geoOpacity: l.geoOpacity,
    geoSpin: l.geoSpin,
    image: l.image,
    imageOpacity: l.imageOpacity,
  };
}

/** Las letras de las lecciones: sus variables, sus atributos (globals.css, «El diseño de los cursos») y la hoja de Google Fonts. */
export function lookType(l: CourseLook): { style: CSSProperties; attrs: Record<string, string | undefined>; fontsHref: string | null } {
  const style: Record<string, string> = {};
  if (l.fontTitle) style["--font-display"] = FONTS[l.fontTitle].css;
  if (l.fontText) style["--course-font"] = FONTS[l.fontText].css;
  return {
    style: style as CSSProperties,
    attrs: { "data-course-type": "", "data-course-font": l.fontText ? "" : undefined, "data-course-text": l.textSize === "m" ? undefined : l.textSize },
    fontsHref: fontsHref([l.fontTitle, l.fontText]),
  };
}

/** Diseños listos para elegir con un toque (y después cambiar cada cosa). El primero, el de cada alumna. */
export type CourseTemplate = { key: string; name: string; look: CourseLook };

const T = (key: string, name: string, look: Partial<CourseLook>): CourseTemplate => ({ key, name, look: { ...EMPTY_COURSE_LOOK, ...look } });

export const COURSE_TEMPLATES: CourseTemplate[] = [
  T("area", "Como su área", {}),
  T("noche", "Noche dorada", { page: "#0D0C22", page2: "#1E1340", accent: "#D4B57A", decor: "stars", fontTitle: "cormorant" }),
  T("aurora", "Aurora violeta", { page: "#1E1340", page2: "#0B1A33", accent: "#B8A5F0", decor: "aurora", fontTitle: "cinzel" }),
  T("luna", "Luna de plata", { page: "#0B1A33", accent: "#C8CCD6", decor: "moon", fontTitle: "italiana" }),
  T("bosque", "Bosque sagrado", { page: "#0F2420", page2: "#0D0C22", accent: "#9CC3A0", decor: "fireflies", fontTitle: "marcellus" }),
  T("velas", "Vino y velas", { page: "#2A0F1E", accent: "#E2A99B", decor: "candles", fontTitle: "playfair" }),
  T("polvo", "Polvo de oro", { page: "#18181B", accent: "#D4B57A", decor: "golddust", geo: "flower", geoPos: "center", geoOpacity: 10, geoSpin: true, fontTitle: "cinzeldeco" }),
  T("crema", "Crema y oro", { page: "#F6EFE3", accent: "#B8653F", decor: "grain", fontTitle: "cormorant", fontText: "lora" }),
  T("rosa", "Rosa empolvado", { page: "#F8E8EA", page2: "#F6EFE3", accent: "#8E4A7E", decor: "petals", fontTitle: "dmserif" }),
  T("salvia", "Salvia", { page: "#E7EFE6", accent: "#6F8766", decor: "leaves", fontTitle: "marcellus", fontText: "nunito" }),
  T("cielo", "Cielo claro", { page: "#E6EEF7", page2: "#EEE9F7", accent: "#4A6FD1", decor: "sunrays", fontTitle: "prata" }),
  T("papel", "Papel blanco", { page: "#FFFFFF", accent: "#B8653F", fontTitle: "fraunces", fontText: "inter" }),
];

/** El diseño listo que coincide con este (para marcarlo); null si se ha cambiado algo. */
export function templateOf(l: CourseLook): string | null {
  const key = JSON.stringify(l);
  return COURSE_TEMPLATES.find((t) => JSON.stringify(t.look) === key)?.key ?? null;
}

// ───────────── El de cada pieza ─────────────

export type PieceBg = "none" | "card" | "color";
export type PieceBorder = "none" | "line" | "double";
export type PieceRadius = "none" | "soft" | "round";
export type PieceSize = "s" | "m" | "l" | "xl";
export type PieceAlign = "left" | "center" | "right" | "justify";

export type PieceLook = {
  bg: PieceBg;
  /** Con bg «color»: su color y cuánto se ve (10–100). */
  bgColor: string | null;
  bgOpacity: number;
  border: PieceBorder;
  radius: PieceRadius;
  /** Espacio por dentro (con fondo o borde). */
  pad: TextSize;
  shadow: boolean;
  /** El texto: su color, su tamaño, su alineación y su letra (null = como la lección). */
  color: string | null;
  size: PieceSize | null;
  align: PieceAlign | null;
  font: FontKey | null;
};

export const EMPTY_PIECE_LOOK: PieceLook = {
  bg: "none",
  bgColor: null,
  bgOpacity: 100,
  border: "none",
  radius: "soft",
  pad: "m",
  shadow: false,
  color: null,
  size: null,
  align: null,
  font: null,
};

const pieceSchema = z.object({
  bg: z.enum(["none", "card", "color"]).catch("none"),
  bgColor: hex,
  bgOpacity: z.number().int().min(10).max(100).catch(100),
  border: z.enum(["none", "line", "double"]).catch("none"),
  radius: z.enum(["none", "soft", "round"]).catch("soft"),
  pad: z.enum(["s", "m", "l"]).catch("m"),
  shadow: z.boolean().catch(false),
  color: hex,
  size: z.enum(["s", "m", "l", "xl"]).nullable().catch(null),
  align: z.enum(["left", "center", "right", "justify"]).nullable().catch(null),
  font: font,
});

/** ¿Cambia algo? (una pieza sin nada se guarda como null). */
export function hasPieceLook(l: PieceLook | null | undefined): l is PieceLook {
  return !!l && JSON.stringify(l) !== JSON.stringify(EMPTY_PIECE_LOOK);
}

/** El de una pieza, tolerante; null si no tiene (o no cambia nada). */
export function readPieceLook(raw: unknown): PieceLook | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = pieceSchema.safeParse(raw);
  if (!r.success) return null;
  const l = { ...r.data, bgColor: r.data.bg === "color" ? (r.data.bgColor ?? "#FFFFFF") : null };
  return hasPieceLook(l) ? l : null;
}

/** Sus atributos y variables (globals.css, «El diseño de cada pieza»); null si no tiene. */
export function pieceView(l: PieceLook | null | undefined): { attrs: Record<string, string | undefined>; style: CSSProperties } | null {
  if (!hasPieceLook(l)) return null;
  const framed = l.bg !== "none" || l.border !== "none";
  const style: Record<string, string> = {};
  if (l.bg === "color" && l.bgColor) style["--piece-bg"] = `color-mix(in oklab, ${l.bgColor} ${l.bgOpacity}%, transparent)`;
  if (l.color) style["--piece-color"] = l.color;
  if (l.font) style["--piece-font"] = FONTS[l.font].css;
  return {
    attrs: {
      "data-piece-look": "",
      "data-bg": l.bg === "none" ? undefined : l.bg,
      "data-border": l.border === "none" ? undefined : l.border,
      "data-radius": l.radius,
      "data-pad": framed ? l.pad : undefined,
      "data-shadow": l.shadow ? "" : undefined,
      "data-color": l.color ? "" : undefined,
      "data-size": l.size ?? undefined,
      "data-align": l.align ?? undefined,
      "data-font": l.font ? "" : undefined,
    },
    style: style as CSSProperties,
  };
}

/** Las letras de las piezas (para su hoja de Google Fonts). */
export const pieceFonts = (looks: (PieceLook | null | undefined)[]) => looks.map((l) => l?.font ?? null);
