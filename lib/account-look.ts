/**
 * «Colores de mi área» (Ajustes del área de alumna): cada alumna cambia el color de la barra de arriba, el de la
 * página (claro u oscuro, con degradado si quiere), el de los detalles (líneas, botones, iconos), el fondo con
 * movimiento y una figura de geometría sagrada detrás. Se guarda en User.accountLook (JSON); sin nada elegido,
 * la noche dorada de siempre. Puro: lo usan el servidor (app/area/layout.tsx) y el navegador (el editor y la
 * vista al momento, app/area/look-root.tsx). Las variables las recoge globals.css, «Los colores de cada alumna».
 */
import type { CSSProperties } from "react";
import { z } from "zod";
import { mixHex, normalizeHex, rgba, textOn, visibleOn } from "./colors";
import { GEOMETRY_FIGURES, type GeometryFigure } from "./page-blocks";
import { FIGURE_POS_KEYS, figureUrl, type FigurePos } from "./sacred-figures";
import { DECOR_KEYS, resolveTheme, themeStyle, type Decor } from "./templates";

export type AccountLook = {
  /** Barra de arriba (el menú); null = sale sola de la página. */
  bar: string | null;
  /** La página; null = la noche de siempre. */
  page: string | null;
  /** Segundo color de la página (degradado); null = un solo color. */
  page2: string | null;
  /** Los detalles (líneas, botones, iconos); null = el oro de siempre. */
  accent: string | null;
  /** Fondo con movimiento; null = las estrellas de siempre. */
  decor: Decor | null;
  /** Figura de geometría detrás de todo; null = ninguna. */
  geo: GeometryFigure | null;
  geoPos: FigurePos;
  /** Cuánto se ve la figura (6–50). */
  geoOpacity: number;
  /** La figura gira muy despacio. */
  geoSpin: boolean;
  /** Foto de fondo y cuánto se ve (10–100): solo la del diseño de un curso (lib/course-design.ts); las alumnas no la eligen. */
  image?: string | null;
  imageOpacity?: number;
};

export const EMPTY_ACCOUNT_LOOK: AccountLook = {
  bar: null,
  page: null,
  page2: null,
  accent: null,
  decor: null,
  geo: null,
  geoPos: "corner",
  geoOpacity: 18,
  geoSpin: false,
};

/** La noche dorada de siempre (globals.css, «El área de alumna, de noche»). */
const NIGHT = "#0D0C22";
const GOLD = "#D4B57A";

/** Los colores que se ofrecen (y, además, cualquier otro con el selector). */
export const ACC_PAGE_COLORS: { hex: string; name: string }[] = [
  { hex: NIGHT, name: "Noche" },
  { hex: "#1E1340", name: "Violeta" },
  { hex: "#0B1A33", name: "Azul noche" },
  { hex: "#0F2420", name: "Bosque" },
  { hex: "#2A0F1E", name: "Vino" },
  { hex: "#18181B", name: "Carbón" },
  { hex: "#F6EFE3", name: "Crema" },
  { hex: "#F8E8EA", name: "Rosa" },
  { hex: "#E7EFE6", name: "Salvia" },
  { hex: "#E6EEF7", name: "Cielo" },
  { hex: "#EEE9F7", name: "Lavanda" },
  { hex: "#FFFFFF", name: "Blanco" },
];
export const ACC_ACCENT_COLORS: { hex: string; name: string }[] = [
  { hex: GOLD, name: "Oro" },
  { hex: "#E2A99B", name: "Oro rosa" },
  { hex: "#C8CCD6", name: "Plata" },
  { hex: "#B8A5F0", name: "Lavanda" },
  { hex: "#9CC3A0", name: "Salvia" },
  { hex: "#6FCFCB", name: "Turquesa" },
  { hex: "#EE8A6F", name: "Coral" },
  { hex: "#8E4A7E", name: "Ciruela" },
  { hex: "#4A6FD1", name: "Azul" },
  { hex: "#B8653F", name: "Terracota" },
];

const hex = z.unknown().transform((v) => normalizeHex(v));
const lookSchema = z.object({
  bar: hex,
  page: hex,
  page2: hex,
  accent: hex,
  decor: z.enum(DECOR_KEYS).nullable().catch(null),
  geo: z.enum(GEOMETRY_FIGURES).nullable().catch(null),
  geoPos: z.enum(FIGURE_POS_KEYS).catch("corner"),
  geoOpacity: z.number().int().min(6).max(50).catch(18),
  geoSpin: z.boolean().catch(false),
});

/** Lo guardado (o lo que llega al guardar), tolerante: lo que no se entiende vuelve a lo de siempre. */
export function readAccountLook(raw: unknown): AccountLook {
  const r = lookSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  // Sin figura de geometría: se quitó del área (lo guardado de antes también la pierde).
  return r.success ? { ...r.data, geo: null } : { ...EMPTY_ACCOUNT_LOOK };
}

/** ¿Ha elegido algo? (si no, la noche dorada de siempre). */
export function hasAccountLook(l: AccountLook | null | undefined): l is AccountLook {
  return !!l && !!(l.bar || l.page || l.page2 || l.accent || l.decor || l.geo || l.image);
}

/** Para comparar dos elecciones (lo que se prueba con lo guardado). */
export function accountLookKey(l: AccountLook | null | undefined): string {
  return hasAccountLook(l) ? JSON.stringify(readAccountLook(l)) : "";
}

export type AccountLookView = {
  mode: "dark" | "light";
  style: CSSProperties;
  decor: Decor | null;
  geo: { pos: FigurePos; spin: boolean } | null;
  /** La foto de fondo (sus variables van en `style`). */
  photo: boolean;
};

/**
 * Las variables de su área: las de siempre (--color-ink, --color-paper, --color-gold…, que ya usa todo) con sus
 * colores, y las propias (--acc-*): el fondo, las tarjetas, el filo de las líneas dobles, la barra de arriba con
 * su letra, el fondo con movimiento (--fx-*, como en la web) y la figura. El texto sale solo: oscuro sobre una
 * página clara, claro sobre una oscura; y los detalles, siempre visibles sobre la página.
 */
export function accountLookView(l: AccountLook | null | undefined): AccountLookView | null {
  if (!hasAccountLook(l)) return null;
  const P = l.page ?? NIGHT;
  const P2 = l.page2 && l.page2 !== P ? l.page2 : null;
  const mid = P2 ? mixHex(P, P2, 0.5) : P;
  const bgs = P2 ? [P, P2] : [P];
  const dark = textOn(mid) === "#FFFFFF";

  const ink = dark ? "#F3EEE4" : visibleOn(mixHex(mid, "#000000", 0.84), bgs, 9);
  const gold = visibleOn(l.accent ?? GOLD, bgs, 2.8);
  const surface = dark ? mixHex(mid, "#FFFFFF", 0.05) : mixHex(mid, "#FFFFFF", 0.6);
  const solid = dark ? mixHex(mid, "#FFFFFF", 0.07) : mixHex(mid, "#FFFFFF", 0.75);

  // La barra de arriba: la suya o, sin elegir, la página un poco más honda (o más clara), medio transparente.
  const B = l.bar ?? (dark ? mixHex(mid, "#000000", 0.25) : mixHex(mid, "#FFFFFF", 0.45));
  const barDark = textOn(B) === "#FFFFFF";
  const barInk = barDark ? "#F3EEE4" : visibleOn(mixHex(B, "#000000", 0.84), [B], 9);
  const barGold = visibleOn(gold, [B], 2.8);

  // El cielo: dos brillos suaves (el de los detalles y el del degradado) sobre el color, o el degradado, de la página.
  const glow2 = P2 ?? mixHex(gold, mid, 0.4);
  const base = P2 ? `linear-gradient(160deg, ${P}, ${P2})` : dark ? `linear-gradient(${mixHex(P, "#000000", 0.18)}, ${P} 45%, ${mixHex(P, "#000000", 0.12)})` : P;
  const bg = `radial-gradient(60rem 26rem at 72% -4rem, ${rgba(gold, dark ? 22 : 18)}, transparent 70%), radial-gradient(42rem 24rem at 4% 34rem, ${rgba(glow2, dark ? 16 : 14)}, transparent 70%), ${base}`;

  // El fondo con movimiento, con los mismos colores que en la web (siempre visibles sobre la página).
  const fx = l.decor
    ? Object.fromEntries(
        Object.entries(themeStyle(resolveTheme(null, { background: P, bg2: P2 ?? P, gold, accent: gold, decor: l.decor }))).filter(([k]) => k.startsWith("--fx-")),
      )
    : {};

  const style: Record<string, string> = {
    "--color-ink": ink,
    "--color-ink-2": mixHex(ink, mid, 0.1),
    "--color-ink-3": mixHex(ink, mid, 0.2),
    "--color-muted": visibleOn(mixHex(ink, mid, 0.4), bgs, 4.5),
    "--color-cream": mixHex(mid, ink, 0.04),
    "--color-paper": P,
    "--color-sand": mixHex(mid, ink, 0.1),
    "--color-line": dark ? "rgb(255 255 255 / .11)" : "rgb(0 0 0 / .1)",
    "--color-gold": gold,
    "--color-gold-soft": mixHex(gold, mid, 0.78),
    "--acc-bg": bg,
    "--acc-surface": rgba(surface, 90),
    "--acc-solid": solid,
    "--acc-deep": rgba(dark ? mixHex(mid, "#FFFFFF", 0.03) : surface, 92),
    "--acc-btn": rgba(dark ? mixHex(mid, "#000000", 0.1) : mixHex(mid, "#FFFFFF", 0.7), dark ? 60 : 85),
    "--acc-shadow": dark ? "0 30px 60px -40px rgb(0 0 0 / .9)" : "0 22px 44px -30px rgb(0 0 0 / .22)",
    "--acc-on-gold": textOn(gold, "#1A1408", "#FFFFFF"),
    "--acc-like": dark ? "#F2A097" : "#B8432F",
    "--acc-bar": rgba(B, l.bar ? 94 : 80),
    "--acc-bar-ink": barInk,
    "--acc-bar-muted": visibleOn(mixHex(barInk, B, 0.38), [B], 4.5),
    "--acc-bar-gold": barGold,
    "--acc-bar-line": barDark ? "rgb(255 255 255 / .11)" : "rgb(0 0 0 / .1)",
    "--acc-bar-deep": rgba(B, 95),
    "--acc-bar-on-gold": textOn(barGold, "#1A1408", "#FFFFFF"),
    ...(l.geo ? { "--acc-geo-img": figureUrl(l.geo, gold, l.geoOpacity * 2) } : {}),
    // La ruta ya viene comprobada (lib/course-design.ts → richImageSrc): solo /media/… o /demo/….
    ...(l.image ? { "--acc-photo": `url("${l.image}")`, "--acc-photo-o": String((l.imageOpacity ?? 40) / 100) } : {}),
    ...fx,
  };
  return {
    mode: dark ? "dark" : "light",
    style: style as CSSProperties,
    decor: l.decor,
    geo: l.geo ? { pos: l.geoPos, spin: l.geoSpin } : null,
    photo: !!l.image,
  };
}
