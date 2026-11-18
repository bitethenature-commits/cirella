import type { CSSProperties } from "react";

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

/** Las cinco últimas de la primera fila y las siguientes se mueven (components/template-decor.tsx y globals.css). */
export type Decor =
  | "stars" | "none" | "lines" | "aurora" | "grain"
  | "shooting" | "golddust" | "fireflies" | "waves" | "petals"
  | "moon" | "nebula" | "constellation" | "leaves" | "mist" | "snow"
  | "bubbles" | "candles" | "mandala" | "rain" | "caustics" | "haze";

export const DECORS: { key: Decor; name: string; moves: boolean }[] = [
  { key: "none", name: "Nada", moves: false },
  { key: "stars", name: "Estrellas", moves: false },
  { key: "lines", name: "Líneas", moves: false },
  { key: "aurora", name: "Aurora", moves: false },
  { key: "grain", name: "Grano", moves: false },
  { key: "shooting", name: "Estrellas fugaces", moves: true },
  { key: "golddust", name: "Polvo de oro", moves: true },
  { key: "fireflies", name: "Luciérnagas", moves: true },
  { key: "waves", name: "Olas", moves: true },
  { key: "petals", name: "Pétalos", moves: true },
  { key: "moon", name: "Luna", moves: true },
  { key: "nebula", name: "Nebulosa", moves: true },
  { key: "constellation", name: "Constelaciones", moves: true },
  { key: "leaves", name: "Hojas", moves: true },
  { key: "mist", name: "Niebla", moves: true },
  { key: "snow", name: "Nieve", moves: true },
  { key: "bubbles", name: "Burbujas", moves: true },
  { key: "candles", name: "Velas", moves: true },
  { key: "mandala", name: "Mandala", moves: true },
  { key: "rain", name: "Lluvia", moves: true },
  { key: "caustics", name: "Reflejos de agua", moves: true },
  { key: "haze", name: "Bruma", moves: true },
];
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
  // Fotos
  imgCustom?: boolean | null;
  imgRadius?: number | null;
  avatarShape?: AvatarShape | null;
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
  btnStyle: "filled" as ButtonStyle,
  btnBorderWidth: 1,
  btnRadius: 999,
  btnWeight: 600,
  btnShadow: "soft" as Shadow,
  imgRadius: 18,
  avatarShape: "circle" as AvatarShape,
};

/** El diseño que manda: el de la web y, encima, los cambios de esa página. */
export function mergeDesign(general: Design | undefined | null, page?: Design | null): Design {
  return { ...(general ?? {}), ...(page ?? {}) };
}

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
    colorScheme: theme.mode,
  };
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
    s["--b-text"] = v("btnText");
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
    "data-d-italic": on(d.displayItalic),
    "data-d-upper": on(d.displayUpper),
    "data-d-spacing": on(d.displaySpacing != null),
    "data-d-size": on(d.displaySize != null && d.displaySize !== 100),
    "data-paint": on(d.bgType && d.bgType !== "solid"),
  };
}

/** Las letras del diseño que hay que pedir a Google Fonts. */
export function themeFontsHref(theme: ResolvedTheme): string | null {
  const v = <K extends DesignKey>(k: K) => designValue(theme.design, k);
  return fontsHref([v("fontDisplay"), v("fontBody")]);
}
