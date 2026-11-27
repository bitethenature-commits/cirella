import type { CSSProperties } from "react";
import { contrastRatio, mixHex, rgba, visibleOn } from "./colors";
import { buttonFrameKind, buttonFrameMask, cardFrameMask, CARD_FRAMES, type ButtonFrameKey, type CardFrameKey } from "./frames";
import type { GeometryFigure } from "./page-blocks";
import { figurePlacement, figureUrl, type FigurePos } from "./sacred-figures";

/**
 * Sistema de diseño de las páginas públicas.
 *
 * No hay plantillas de fábrica: el diseño (`Design`) lo hace la dueña al detalle en Panel › Mi página › Diseño
 * (colores, fondo, movimiento, letras, tarjetas, botones y fotos), para toda la web y, encima, con cambios por
 * página (PageConfig.pageThemes). Lo que no toca sale del diseño de base (BASE). El contenido vive aparte
 * (PageConfig), así que cambiar el diseño nunca pierde productos ni textos.
 */

/* ───────────── Letras ───────────── */

export type FontCategory = "serif" | "sans" | "script" | "deco";
export const FONT_CATEGORIES: Record<FontCategory, string> = { serif: "Con remate", sans: "Sin remate", script: "Manuscritas", deco: "Decorativas" };

type FontDef = { name: string; cat: FontCategory; css: string; /** Familia de Google Fonts (las demás ya vienen con la web). */ g?: string; w: number[]; i?: boolean };

const g = (name: string, cat: FontCategory, w: number[], i = false, fallback = cat === "sans" ? "sans-serif" : cat === "script" ? "cursive" : "serif"): FontDef => ({ name, cat, css: `"${name}", ${fallback}`, g: name, w, i });

export const FONTS = {
  cormorant: { name: "Cormorant Garamond", cat: "serif", css: "var(--font-cormorant)", w: [400, 500, 600], i: true },
  fraunces: { name: "Fraunces", cat: "serif", css: "var(--font-fraunces)", w: [300, 400, 500, 600, 700], i: true },
  bodoni: { name: "Bodoni Moda", cat: "serif", css: "var(--font-bodoni)", w: [400, 500, 600, 700], i: true },
  instrument: { name: "Instrument Serif", cat: "serif", css: "var(--font-instrument)", w: [400], i: true },
  playfair: g("Playfair Display", "serif", [400, 500, 600, 700, 800], true),
  lora: g("Lora", "serif", [400, 500, 600, 700], true),
  baskerville: g("Libre Baskerville", "serif", [400, 700], true),
  garamond: g("EB Garamond", "serif", [400, 500, 600, 700], true),
  cinzel: g("Cinzel", "serif", [400, 500, 600, 700]),
  cinzeldeco: g("Cinzel Decorative", "serif", [400, 700]),
  marcellus: g("Marcellus", "serif", [400]),
  prata: g("Prata", "serif", [400]),
  gilda: g("Gilda Display", "serif", [400]),
  dmserif: g("DM Serif Display", "serif", [400], true),
  italiana: g("Italiana", "serif", [400]),
  bellefair: g("Bellefair", "serif", [400]),
  spectral: g("Spectral", "serif", [300, 400, 500, 600, 700], true),
  crimson: g("Crimson Pro", "serif", [300, 400, 500, 600, 700], true),
  philosopher: g("Philosopher", "sans", [400, 700], true),
  inter: { name: "Inter", cat: "sans", css: "var(--font-inter)", w: [300, 400, 500, 600, 700] },
  manrope: { name: "Manrope", cat: "sans", css: "var(--font-manrope)", w: [300, 400, 500, 600, 700] },
  dmsans: { name: "DM Sans", cat: "sans", css: "var(--font-dmsans)", w: [300, 400, 500, 600, 700] },
  syne: { name: "Syne", cat: "sans", css: "var(--font-syne)", w: [400, 500, 600, 700] },
  montserrat: g("Montserrat", "sans", [300, 400, 500, 600, 700], true),
  poppins: g("Poppins", "sans", [300, 400, 500, 600, 700], true),
  raleway: g("Raleway", "sans", [300, 400, 500, 600, 700], true),
  jost: g("Jost", "sans", [300, 400, 500, 600, 700], true),
  josefin: g("Josefin Sans", "sans", [300, 400, 500, 600, 700], true),
  outfit: g("Outfit", "sans", [300, 400, 500, 600, 700]),
  worksans: g("Work Sans", "sans", [300, 400, 500, 600, 700], true),
  nunito: g("Nunito", "sans", [300, 400, 500, 600, 700], true),
  lato: g("Lato", "sans", [300, 400, 700], true),
  karla: g("Karla", "sans", [300, 400, 500, 600, 700], true),
  quicksand: g("Quicksand", "sans", [300, 400, 500, 600, 700]),
  tenor: g("Tenor Sans", "sans", [400]),
  spacegrotesk: g("Space Grotesk", "sans", [300, 400, 500, 600, 700]),
  figtree: g("Figtree", "sans", [300, 400, 500, 600, 700], true),
  greatvibes: g("Great Vibes", "script", [400]),
  parisienne: g("Parisienne", "script", [400]),
  allura: g("Allura", "script", [400]),
  dancing: g("Dancing Script", "script", [400, 500, 600, 700]),
  sacramento: g("Sacramento", "script", [400]),
  pinyon: g("Pinyon Script", "script", [400]),
  caveat: g("Caveat", "script", [400, 500, 600, 700]),
  tangerine: g("Tangerine", "script", [400, 700]),
  abril: g("Abril Fatface", "deco", [400]),
  poiret: g("Poiret One", "deco", [400], false, "sans-serif"),
  federo: g("Federo", "deco", [400], false, "sans-serif"),
  forum: g("Forum", "deco", [400]),
  uncial: g("Uncial Antiqua", "deco", [400]),
  medieval: g("MedievalSharp", "deco", [400]),
} satisfies Record<string, FontDef>;
export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as [FontKey, ...FontKey[]];

/** Las parejas de antes (solo para leer diseños guardados con ellas). */
const LEGACY_FONT_PAIRS: Record<string, [FontKey, FontKey, number]> = {
  classic: ["cormorant", "inter", 500],
  editorial: ["fraunces", "inter", 400],
  luxury: ["bodoni", "manrope", 500],
  modern: ["syne", "inter", 600],
  serene: ["instrument", "dmsans", 400],
};

/** La hoja de Google Fonts con las letras elegidas que no vienen con la web (null si no hace falta). */
export function fontsHref(keys: (FontKey | undefined | null)[]): string | null {
  const fams = [...new Set(keys.filter((k): k is FontKey => !!k && k in FONTS))]
    .map((k) => FONTS[k] as FontDef)
    .filter((f) => f.g)
    .map((f) => {
      const name = f.g!.replace(/ /g, "+");
      const tuples = [...f.w.map((w) => `0,${w}`), ...(f.i ? ["1,400"] : [])];
      return `family=${name}:ital,wght@${tuples.join(";")}`;
    });
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.join("&")}&display=swap` : null;
}

/* ───────────── Fondos con movimiento ───────────── */

/** Los fondos (components/template-decor.tsx y globals.css, «Fondos con movimiento»). */
export type DecorGroup = "basic" | "sky" | "nature" | "light" | "magic";
export const DECOR_GROUPS: Record<DecorGroup, string> = { basic: "Sencillos", sky: "Cielo", nature: "Naturaleza", light: "Agua y luz", magic: "Mágicos" };
export const DECORS = [
  { key: "none", name: "Nada", group: "basic", moves: false },
  { key: "stars", name: "Estrellas", group: "basic", moves: true },
  { key: "lines", name: "Líneas", group: "basic", moves: false },
  { key: "grain", name: "Grano de papel", group: "basic", moves: false },
  { key: "aurora", name: "Aurora", group: "sky", moves: true },
  { key: "shooting", name: "Estrellas fugaces", group: "sky", moves: true },
  { key: "meteors", name: "Lluvia de meteoros", group: "sky", moves: true },
  { key: "moon", name: "Luna", group: "sky", moves: true },
  { key: "nebula", name: "Nebulosa", group: "sky", moves: true },
  { key: "constellation", name: "Constelaciones", group: "sky", moves: true },
  { key: "galaxy", name: "Galaxia", group: "sky", moves: true },
  { key: "borealis", name: "Aurora boreal", group: "sky", moves: true },
  { key: "planets", name: "Planetas", group: "sky", moves: true },
  { key: "petals", name: "Pétalos", group: "nature", moves: true },
  { key: "sakura", name: "Flores de cerezo", group: "nature", moves: true },
  { key: "leaves", name: "Hojas de otoño", group: "nature", moves: true },
  { key: "butterflies", name: "Mariposas", group: "nature", moves: true },
  { key: "feathers", name: "Plumas", group: "nature", moves: true },
  { key: "dandelion", name: "Diente de león", group: "nature", moves: true },
  { key: "fireflies", name: "Luciérnagas", group: "nature", moves: true },
  { key: "snow", name: "Nieve", group: "nature", moves: true },
  { key: "mist", name: "Niebla", group: "nature", moves: true },
  { key: "waves", name: "Olas", group: "light", moves: true },
  { key: "rain", name: "Lluvia", group: "light", moves: true },
  { key: "caustics", name: "Reflejos de agua", group: "light", moves: true },
  { key: "bubbles", name: "Burbujas", group: "light", moves: true },
  { key: "bokeh", name: "Luces desenfocadas", group: "light", moves: true },
  { key: "sparkles", name: "Destellos", group: "light", moves: true },
  { key: "sunrays", name: "Rayos de sol", group: "light", moves: true },
  { key: "smoke", name: "Humo de incienso", group: "light", moves: true },
  { key: "haze", name: "Calima", group: "light", moves: true },
  { key: "golddust", name: "Polvo de oro", group: "magic", moves: true },
  { key: "candles", name: "Velas", group: "magic", moves: true },
  { key: "mandala", name: "Mandala", group: "magic", moves: true },
  { key: "flowerlife", name: "Flor de la vida", group: "magic", moves: true },
  { key: "cards", name: "Cartas que flotan", group: "magic", moves: true },
  { key: "crystals", name: "Cristales", group: "magic", moves: true },
  { key: "runes", name: "Runas", group: "magic", moves: true },
] as const satisfies readonly { key: string; name: string; group: DecorGroup; moves: boolean }[];
export type Decor = (typeof DECORS)[number]["key"];
export const DECOR_KEYS = DECORS.map((d) => d.key) as [Decor, ...Decor[]];

/* ───────────── El diseño ───────────── */

export type CardStyle = "glass" | "solid" | "outline" | "editorial";
export const CARD_STYLES: Record<CardStyle, string> = { glass: "Cristal", solid: "Lisa", outline: "Solo borde", editorial: "Papel" };
export type Shadow = "none" | "soft" | "strong" | "glow";
export const SHADOWS: Record<Shadow, string> = { none: "Sin sombra", soft: "Suave", strong: "Marcada", glow: "Brillo" };
export type ButtonStyle = "filled" | "outline" | "soft";
export const BUTTON_STYLES: Record<ButtonStyle, string> = { filled: "Relleno", outline: "Solo borde", soft: "Suave" };
export type BgType = "solid" | "gradient" | "radial";
export const BG_TYPES: Record<BgType, string> = { solid: "Color liso", gradient: "Degradado", radial: "Degradado circular" };
export type AvatarShape = "circle" | "rounded" | "square";
export const AVATAR_SHAPES: Record<AvatarShape, string> = { circle: "Redonda", rounded: "Esquinas suaves", square: "Cuadrada" };
/** Las fotos con marco («Sobre mí», fichas, cabeceras de las páginas…): su forma y su marco. */
export type PhotoShape = "rounded" | "arch" | "oval" | "circle";
export const PHOTO_SHAPES: Record<PhotoShape, string> = { rounded: "Esquinas redondas", arch: "Arco", oval: "Óvalo", circle: "Círculo" };
export type PhotoFrame = "double" | "single" | "none" | "card";
export const PHOTO_FRAMES: Record<PhotoFrame, string> = { double: "Doble línea dorada", single: "Una línea", none: "Sin marco", card: "Como tus tarjetas" };
/**
 * Los paneles dorados (doble borde dorado y estrellitas ✦: «Qué incluye» de las fichas, los textos de las páginas
 * de los métodos, las cartas de las lecturas, el panel de cada ficha…): la geometría de su fondo. «Como siempre»:
 * unos llevan la flor de la vida y otros no.
 */
export type PanelGeo = "keep" | "none" | GeometryFigure;
export const PANEL_GEOS: Record<PanelGeo, string> = {
  keep: "Como siempre",
  none: "Ninguna",
  flower: "Flor de la vida",
  enneagram: "Eneagrama",
  metatron: "Cubo de Metatrón",
  vesica: "Vesica piscis",
  torus: "Toro",
};

/**
 * Todo lo que se puede diseñar. Todo es opcional: lo que falta sale de BASE. Las tarjetas, los botones y las
 * fotos solo mandan con su interruptor encendido (`cardCustom`, `btnCustom`, `imgCustom`): apagado, cada página
 * lleva su estilo de siempre (la portada, el de doble línea dorada).
 */
export type Design = {
  // Colores
  background?: string | null;
  bg2?: string | null;
  text?: string | null;
  muted?: string | null;
  accent?: string | null;
  accentText?: string | null;
  gold?: string | null;
  // Fondo
  bgType?: BgType | null;
  bgAngle?: number | null;
  backgroundImageUrl?: string | null;
  bgImageOpacity?: number | null;
  // Movimiento
  decor?: Decor | null;
  decorOpacity?: number | null;
  /** Color del efecto (vacío: el suyo de siempre). */
  decorColor?: string | null;
  /** Que se mueva también si el móvil u ordenador pide menos movimiento. */
  decorAlways?: boolean | null;
  // Letras
  fontDisplay?: FontKey | null;
  fontBody?: FontKey | null;
  displayWeight?: number | null;
  displayItalic?: boolean | null;
  displayUpper?: boolean | null;
  displaySpacing?: number | null;
  displaySize?: number | null;
  // Tarjetas
  cardStyle?: CardStyle | null;
  cardCustom?: boolean | null;
  cardBg?: string | null;
  cardBgOpacity?: number | null;
  cardBorder?: string | null;
  cardBorderWidth?: number | null;
  cardRadius?: number | null;
  cardShadow?: Shadow | null;
  cardDouble?: boolean | null;
  cardBlur?: boolean | null;
  cardFrame?: CardFrameKey | null;
  cardFrameColor?: string | null;
  cardFrameSize?: number | null;
  // Botones
  btnCustom?: boolean | null;
  btnStyle?: ButtonStyle | null;
  btnBg?: string | null;
  btnText?: string | null;
  btnBorder?: string | null;
  btnBorderWidth?: number | null;
  btnRadius?: number | null;
  btnFont?: "body" | "display" | null;
  btnWeight?: number | null;
  btnItalic?: boolean | null;
  btnUpper?: boolean | null;
  btnShadow?: Shadow | null;
  btnDouble?: boolean | null;
  btnFrame?: ButtonFrameKey | null;
  btnFrameColor?: string | null;
  // Fotos
  imgCustom?: boolean | null;
  imgRadius?: number | null;
  avatarShape?: AvatarShape | null;
  photoShape?: PhotoShape | null;
  photoFrame?: PhotoFrame | null;
  // Paneles dorados
  panelCustom?: boolean | null;
  panelBg?: string | null;
  panelBgOpacity?: number | null;
  panelBorder?: string | null;
  panelBorderWidth?: number | null;
  panelRadius?: number | null;
  panelShadow?: Shadow | null;
  panelDouble?: boolean | null;
  panelStars?: boolean | null;
  panelGeo?: PanelGeo | null;
  panelGeoPos?: FigurePos | null;
  panelGeoOpacity?: number | null;
  panelGeoColor?: string | null;
  // De antes (se leen, ya no se editan)
  fontPair?: string | null;
  radius?: string | null;
};
export type DesignKey = keyof Design;

/** El diseño de base: noche azul, crema, lavanda y oro. */
export const BASE = {
  background: "#0B0E1F",
  bg2: "#1A1D3D",
  text: "#F3ECDD",
  accent: "#C9BBF2",
  accentText: "#0B0E1F",
  gold: "#D9BF8C",
  bgType: "solid" as BgType,
  bgAngle: 160,
  bgImageOpacity: 30,
  decor: "stars" as Decor,
  decorOpacity: 100,
  fontDisplay: "cormorant" as FontKey,
  fontBody: "inter" as FontKey,
  displayWeight: 500,
  displaySpacing: -1,
  displaySize: 100,
  cardStyle: "glass" as CardStyle,
  cardBgOpacity: 8,
  cardBorderWidth: 1,
  cardRadius: 24,
  cardShadow: "soft" as Shadow,
  cardFrame: "none" as CardFrameKey,
  cardFrameSize: 56,
  btnFrame: "none" as ButtonFrameKey,
  btnStyle: "filled" as ButtonStyle,
  btnBorderWidth: 1,
  btnRadius: 999,
  btnWeight: 600,
  btnShadow: "soft" as Shadow,
  imgRadius: 18,
  avatarShape: "circle" as AvatarShape,
  photoShape: "rounded" as PhotoShape,
  photoFrame: "double" as PhotoFrame,
  panelBgOpacity: 100,
  panelBorderWidth: 1,
  panelRadius: 26,
  panelShadow: "strong" as Shadow,
  panelDouble: true,
  panelStars: true,
  panelGeo: "keep" as PanelGeo,
  panelGeoPos: "corner" as FigurePos,
  panelGeoOpacity: 16,
};

/** Luminancia aproximada de un color hex para decidir modo claro/oscuro. */
export function isDark(hex: string) {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const gg = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * gg + 0.0722 * b < 128;
}

export type ResolvedTheme = {
  mode: "dark" | "light";
  colors: { bg: string; bg2: string; text: string; muted: string | null; accent: string; accentText: string; gold: string };
  card: CardStyle;
  decor: Decor;
  backgroundImageUrl: string | null;
  design: Design;
};

/** Cada valor del diseño con lo de base para lo que falta (lo que ve el editor como «valor actual»). */
export function designValue<K extends DesignKey>(d: Design, key: K): NonNullable<Design[K]> {
  const v = d[key];
  if (v !== undefined && v !== null) return v as NonNullable<Design[K]>;
  const legacy = LEGACY_FONT_PAIRS[d.fontPair ?? ""];
  if (legacy && key === "fontDisplay") return legacy[0] as NonNullable<Design[K]>;
  if (legacy && key === "fontBody") return legacy[1] as NonNullable<Design[K]>;
  if (legacy && key === "displayWeight") return legacy[2] as NonNullable<Design[K]>;
  if (key === "bg2") return designValue(d, "background") as NonNullable<Design[K]>;
  if (key === "muted") return "" as NonNullable<Design[K]>;
  if (key === "accentText") return (isDark(designValue(d, "accent")) ? "#FFFFFF" : "#111111") as NonNullable<Design[K]>;
  if (key === "cardBg") return designValue(d, "text") as NonNullable<Design[K]>;
  if (key === "cardBorder") return designValue(d, "gold") as NonNullable<Design[K]>;
  if (key === "btnBg") return designValue(d, "accent") as NonNullable<Design[K]>;
  if (key === "btnText") return designValue(d, "accentText") as NonNullable<Design[K]>;
  if (key === "btnBorder") return designValue(d, "gold") as NonNullable<Design[K]>;
  if (key === "cardFrameColor" || key === "btnFrameColor") return designValue(d, "gold") as NonNullable<Design[K]>;
  if (key === "decorColor" || key === "panelGeoColor") return "" as NonNullable<Design[K]>;
  // Los paneles dorados: un poco más oscuros que el fondo, con el borde de los detalles.
  if (key === "panelBg") return mixHex(designValue(d, "background"), "#000000", 0.14) as NonNullable<Design[K]>;
  if (key === "panelBorder") return designValue(d, "gold") as NonNullable<Design[K]>;
  if (key === "cardRadius" && d.radius) return ({ sharp: 2, soft: 14, round: 24 }[d.radius] ?? 24) as NonNullable<Design[K]>;
  if (key === "btnRadius" && d.radius) return ({ sharp: 2, soft: 10, round: 999 }[d.radius] ?? 999) as NonNullable<Design[K]>;
  if (key === "btnFont") return "body" as NonNullable<Design[K]>;
  if (typeof (BASE as Record<string, unknown>)[key] !== "undefined") return (BASE as Record<string, unknown>)[key] as NonNullable<Design[K]>;
  return false as NonNullable<Design[K]>;
}

/**
 * El tema de una página. `_legacy` era la clave de plantilla: ya no cuenta (los diseños antiguos se pasaron
 * a `Design` al leerlos, lib/page-config.ts). Sin diseño propio en su plan, sale el de base.
 */
export function resolveTheme(_legacy: string | null | undefined, design: Design = {}, allowCustom = true): ResolvedTheme {
  const d = allowCustom ? design : {};
  const v = <K extends DesignKey>(k: K) => designValue(d, k);
  const bg = v("background");
  return {
    mode: isDark(bg) ? "dark" : "light",
    colors: { bg, bg2: v("bg2"), text: v("text"), muted: d.muted || null, accent: v("accent"), accentText: v("accentText"), gold: v("gold") },
    card: v("cardStyle"),
    decor: v("decor"),
    backgroundImageUrl: d.backgroundImageUrl ?? null,
    design: d,
  };
}

const px = (n: number) => `${n}px`;
const radiusCss = (n: number) => (n >= 60 ? "999px" : px(n));
function shadowCss(s: Shadow, color: string) {
  if (s === "soft") return "0 18px 40px -28px rgb(0 0 0 / .45)";
  if (s === "strong") return "0 28px 60px -24px rgb(0 0 0 / .7)";
  if (s === "glow") return `0 0 34px -8px color-mix(in oklab, ${color} 70%, transparent)`;
  return "none";
}

/** Los colores propios de algunos fondos (sin «Color del efecto»): el rosa del cerezo, el otoño, la aurora… */
export const DECOR_TINTS: Partial<Record<Decor, [string, string]>> = {
  sakura: ["#F29BBE", "#FFD1E1"],
  leaves: ["#D9772B", "#B23F22"],
  borealis: ["#3FE0B0", "#8F6BFF"],
  fireflies: ["#F7DD6A", "#B8F06A"],
  candles: ["#F3A445", "#FFD27A"],
};

/**
 * Los colores de los fondos con movimiento (globals.css, «Fondos con movimiento»), siempre visibles sobre el fondo
 * (y sus dos colores, si es un degradado): el suyo («Color del efecto») o el del fondo, aclarado sobre fondos
 * oscuros u oscurecido sobre los claros lo justo para que se vea, con su mismo tono.
 *   --fx-a, --fx-b: los dos colores · --fx-a2, --fx-b2: su versión más marcada (el brillo en lo oscuro, la sombra
 *   en lo claro) · --fx-soft: el neutro (nieve, niebla, plumas…) · --fx-glow-*: el halo · --fx-edge: un filo que
 *   separa del fondo · --fx-moon-*: la luna.
 */
function decorVars(theme: ResolvedTheme): Record<string, string> {
  const c = theme.colors;
  const dark = theme.mode === "dark";
  const bgs = [c.bg, c.bg2];
  const far = dark ? "#FFFFFF" : "#000000";
  const own = theme.design.decorColor || null;
  const tint = DECOR_TINTS[theme.decor];
  const a = visibleOn(own ?? tint?.[0] ?? c.accent, bgs, 3.2);
  const b = visibleOn(own ? mixHex(own, far, 0.2) : (tint?.[1] ?? c.gold), bgs, 3.2);
  const soft = own ? a : visibleOn(dark ? mixHex("#FFFFFF", c.accent, 0.08) : mixHex(c.text, c.bg, 0.45), bgs, 3);
  const moon = dark ? "#FBF7EC" : visibleOn(mixHex("#D9D6CC", b, 0.2), bgs, 1.9);
  return {
    "--fx-a": a,
    "--fx-b": b,
    "--fx-a2": mixHex(a, far, dark ? 0.55 : 0.3),
    "--fx-b2": mixHex(b, far, dark ? 0.55 : 0.3),
    "--fx-soft": soft,
    "--fx-glow-a": rgba(a, dark ? 60 : 32),
    "--fx-glow-b": rgba(b, dark ? 60 : 32),
    "--fx-edge": dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.28)",
    "--fx-moon": moon,
    "--fx-moon-edge": mixHex(moon, dark ? "#8F8672" : "#000000", dark ? 0.6 : 0.35),
    // Para los fondos dibujados (components/decor-fx): sobre qué color se pintan y si mandan los colores propios.
    "--fx-bg": c.bg,
    "--fx-own": own ? "1" : "0",
  };
}

/** Variables CSS consumidas por los componentes de la página pública (y las de las piezas que se diseñan). */
export function themeStyle(theme: ResolvedTheme): CSSProperties {
  const c = theme.colors;
  const d = theme.design;
  const v = <K extends DesignKey>(k: K) => designValue(d, k);
  const font = (k: FontKey) => (FONTS[k] ?? FONTS.inter).css;
  const bgType = v("bgType");
  const angle = v("bgAngle");
  const s: Record<string, string> = {
    "--c-bg": c.bg,
    "--c-bg2": c.bg2,
    "--c-text": c.text,
    "--c-muted": c.muted || `color-mix(in oklab, ${c.text} 66%, ${c.bg})`,
    "--c-faint": `color-mix(in oklab, ${c.muted || c.text} 60%, ${c.bg})`,
    "--c-line": `color-mix(in oklab, ${c.text} 14%, transparent)`,
    "--c-surface":
      theme.card === "glass"
        ? `color-mix(in oklab, ${c.text} 6%, transparent)`
        : theme.card === "solid"
          ? `color-mix(in oklab, ${c.bg} 55%, #ffffff)`
          : "transparent",
    "--c-surface-strong": `color-mix(in oklab, ${c.text} 10%, ${c.bg})`,
    "--c-accent": c.accent,
    "--c-accent-text": c.accentText,
    "--c-gold": c.gold,
    "--c-paint": bgType === "gradient" ? `linear-gradient(${angle}deg, ${c.bg}, ${c.bg2})` : bgType === "radial" ? `radial-gradient(120% 90% at 50% 0%, ${c.bg2}, ${c.bg} 70%)` : c.bg,
    "--bg-img-o": String(v("bgImageOpacity") / 100),
    "--decor-o": String(v("decorOpacity") / 100),
    "--font-display": font(v("fontDisplay")),
    "--font-body": font(v("fontBody")),
    "--display-weight": String(v("displayWeight")),
    "--r-card": radiusCss(v("cardRadius")),
    "--r-btn": radiusCss(v("btnRadius")),
    ...decorVars(theme),
    colorScheme: theme.mode,
  };
  const frame = v("cardFrame");
  if (frame !== "none") {
    s["--frame-c"] = v("cardFrameColor");
    const mask = cardFrameMask(frame, v("cardFrameSize"));
    if (mask) s["--frame-mask"] = mask;
  }
  const bframe = v("btnFrame");
  if (bframe !== "none") {
    s["--bframe-c"] = v("btnFrameColor");
    const mask = buttonFrameMask(bframe);
    if (mask) s["--bframe-mask"] = mask;
  }
  if (d.displaySpacing != null) s["--display-spacing"] = `${d.displaySpacing / 100}em`;
  if (d.displaySize != null) s["--display-zoom"] = String(d.displaySize / 100);
  if (d.cardCustom) {
    const style = v("cardStyle");
    const bgc = v("cardBg");
    s["--k-bg"] = style === "outline" ? "transparent" : `color-mix(in oklab, ${bgc} ${v("cardBgOpacity")}%, transparent)`;
    s["--k-border"] = v("cardBorder");
    s["--k-bw"] = px(v("cardBorderWidth"));
    s["--k-shadow"] = shadowCss(v("cardShadow"), c.gold);
    s["--k-blur"] = v("cardBlur") || style === "glass" ? "blur(16px) saturate(130%)" : "none";
    s["--k-double"] = v("cardDouble") ? `inset 0 0 0 4px color-mix(in oklab, ${c.bg} 85%, transparent), inset 0 0 0 5px color-mix(in oklab, ${v("cardBorder")} 45%, transparent)` : "none";
  }
  if (d.btnCustom) {
    const style = v("btnStyle");
    const b = v("btnBg");
    s["--b-bg"] = style === "filled" ? b : style === "soft" ? `color-mix(in oklab, ${b} 18%, transparent)` : "transparent";
    // Sin relleno (contorno o suave), el texto va sobre la página: si su color no se ve ahí (un texto oscuro pensado
    // para un botón dorado relleno, sobre la noche), va del color del borde, que sí se ve.
    const txt = v("btnText");
    const onPage = style !== "filled";
    const hidden = onPage && Math.min(contrastRatio(txt, c.bg), contrastRatio(txt, c.bg2)) < 3;
    s["--b-text"] = hidden ? visibleOn(v("btnBorder"), [c.bg, c.bg2], 3) : txt;
    s["--b-border"] = v("btnBorder");
    s["--b-bw"] = px(v("btnBorderWidth"));
    s["--b-font"] = v("btnFont") === "display" ? "var(--font-display)" : "var(--font-body)";
    s["--b-weight"] = String(v("btnWeight"));
    s["--b-style"] = v("btnItalic") ? "italic" : "normal";
    s["--b-case"] = v("btnUpper") ? "uppercase" : "none";
    s["--b-spacing"] = v("btnUpper") ? ".12em" : ".01em";
    const glow = shadowCss(v("btnShadow"), b);
    const dbl = v("btnDouble") ? `inset 0 0 0 3px color-mix(in oklab, ${c.bg} 80%, transparent), inset 0 0 0 4px color-mix(in oklab, ${v("btnBorder")} 45%, transparent)` : "";
    s["--b-shadow"] = [dbl, glow === "none" ? "" : glow].filter(Boolean).join(", ") || "none";
  }
  if (d.panelCustom) {
    const pb = v("panelBorder");
    s["--pk-bg"] = `color-mix(in oklab, ${v("panelBg")} ${v("panelBgOpacity")}%, transparent)`;
    s["--pk-border"] = pb;
    s["--pk-bw"] = px(v("panelBorderWidth"));
    s["--r-panel"] = px(v("panelRadius"));
    const dbl = v("panelDouble") ? `inset 0 0 0 5px color-mix(in oklab, ${c.bg} 90%, transparent), inset 0 0 0 6px color-mix(in oklab, ${pb} 22%, transparent)` : "";
    const sh = shadowCss(v("panelShadow"), pb);
    s["--pk-shadow"] = [dbl, sh === "none" ? "" : sh].filter(Boolean).join(", ") || "none";
  }
  // La geometría de los paneles: la figura elegida, dibujada en su color (globals.css, «Paneles dorados»).
  const geo = v("panelGeo");
  if (geo !== "keep" && geo !== "none") {
    const place = figurePlacement(v("panelGeoPos"));
    s["--pg-img"] = figureUrl(geo, v("panelGeoColor") || c.gold, v("panelGeoOpacity"));
    s["--pg-pos"] = place.position;
    s["--pg-size"] = place.size;
  }
  if (d.imgCustom) {
    s["--img-r"] = radiusCss(v("imgRadius"));
    const shape = v("avatarShape");
    s["--avatar-r"] = shape === "circle" ? "999px" : shape === "rounded" ? "22%" : "4px";
  }
  return s as CSSProperties;
}

/** Los interruptores del CSS (globals.css, «Diseño a medida»): solo lo que la dueña ha cambiado. */
export function themeAttrs(theme: ResolvedTheme): Record<string, string | undefined> {
  const d = theme.design;
  const on = (b: unknown) => (b ? "" : undefined);
  return {
    "data-card": theme.card,
    "data-k": on(d.cardCustom),
    "data-b": on(d.btnCustom),
    "data-img": on(d.imgCustom),
    // Las fotos con marco (globals.css, «Fotos con marco»): solo lo que no es lo de siempre.
    "data-photo-shape": d.imgCustom && d.photoShape && d.photoShape !== "rounded" ? d.photoShape : undefined,
    "data-photo-frame": d.imgCustom && d.photoFrame && d.photoFrame !== "double" ? d.photoFrame : undefined,
    "data-d-italic": on(d.displayItalic),
    "data-d-upper": on(d.displayUpper),
    "data-d-spacing": on(d.displaySpacing != null),
    "data-d-size": on(d.displaySize != null && d.displaySize !== 100),
    "data-paint": on(d.bgType && d.bgType !== "solid"),
    "data-fx-always": on(d.decorAlways),
    "data-frame": d.cardFrame && d.cardFrame !== "none" && d.cardFrame in CARD_FRAMES ? (d.cardFrame === "neon" ? "neon" : "mask") : undefined,
    "data-bframe": d.btnFrame && d.btnFrame !== "none" ? (buttonFrameKind(d.btnFrame) ?? undefined) : undefined,
    // Los paneles dorados (globals.css, «Paneles dorados»).
    "data-pk": on(d.panelCustom),
    "data-pstars": d.panelStars === false ? "off" : undefined,
    "data-pgeo": d.panelGeo && d.panelGeo !== "keep" ? d.panelGeo : undefined,
  };
}

/** Las letras del diseño que hay que pedir a Google Fonts. */
export function themeFontsHref(theme: ResolvedTheme): string | null {
  const v = <K extends DesignKey>(k: K) => designValue(theme.design, k);
  return fontsHref([v("fontDisplay"), v("fontBody")]);
}
