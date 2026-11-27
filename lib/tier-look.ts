/**
 * El diseño de cada tarjeta de miembro (cada nivel de la comunidad), propio de ese nivel: se elige en Mi página ›
 * Hacerte miembro con el pincel de la tarjeta y se ve igual en la web, en el área de alumna y en el panel.
 *   · el paisaje: un fondo de ensueño dibujado (bosque con camino de luz, mar de nubes, lago de luna…) o su foto;
 *   · lo que se mueve encima: uno de los fondos con movimiento de la web (dientes de león, plumas, luciérnagas…);
 *   · el marco del arco: línea fina, puerta tallada, aro de luna, columnas o enredadera;
 *   · sus colores (cielo, fondo, dorado y texto) y el velo que lo oscurece para leer mejor.
 * Lo que no elige sale de su paisaje. Se guarda en Product.pageTexts.tierLook (aparte de su carta). Puro.
 */
import { mixHex, normalizeHex, rgba, visibleOn, luminance } from "./colors";
import { DECOR_TINTS, DECORS, type Decor } from "./templates";

export const TIER_SCENES = ["night", "forest", "clouds", "lake", "aurora", "cosmos", "sakura", "meadow", "dunes", "sea", "temple", "photo"] as const;
export type TierScene = (typeof TIER_SCENES)[number];

export const TIER_FRAMES = ["fine", "carved", "moon", "columns", "vine"] as const;
export type TierFrame = (typeof TIER_FRAMES)[number];

/** Lo que se mueve encima: los fondos con movimiento de la web (sin los quietos ni la lluvia) o nada. */
export const TIER_FX = ["none", ...DECORS.filter((d) => d.moves && d.key !== "rain").map((d) => d.key)] as ["none", ...Decor[]];
export type TierFx = (typeof TIER_FX)[number];

type SceneInfo = { label: string; hint: string; bg: string; sky: string; fx: TierFx; frame: TierFrame };
export const TIER_SCENE_INFO: Record<TierScene, SceneInfo> = {
  night: { label: "Noche y oro", hint: "El de siempre: noche con un brillo arriba", bg: "#0D0C22", sky: "#8462CC", fx: "none", frame: "fine" },
  forest: { label: "Bosque de ensueño", hint: "Un camino de luz entre árboles y niebla", bg: "#0A1521", sky: "#F2DCAA", fx: "dandelion", frame: "carved" },
  clouds: { label: "Mar de nubes", hint: "Escalones que flotan hacia el sol", bg: "#1C1940", sky: "#F6B79C", fx: "feathers", frame: "fine" },
  lake: { label: "Lago de luna", hint: "La luna, montañas y su reflejo en el agua", bg: "#070D26", sky: "#AFC6FF", fx: "fireflies", frame: "moon" },
  aurora: { label: "Aurora", hint: "Luces del norte sobre montañas nevadas", bg: "#061722", sky: "#59E3B5", fx: "snow", frame: "fine" },
  cosmos: { label: "Cosmos", hint: "Nebulosas, estrellas y un planeta que brilla", bg: "#0A0720", sky: "#C38BFF", fx: "shooting", frame: "fine" },
  sakura: { label: "Cerezos", hint: "Ramas en flor y colinas rosadas", bg: "#22132A", sky: "#F5A7C7", fx: "sakura", frame: "fine" },
  meadow: { label: "Jardín encantado", hint: "Colinas con flores que brillan", bg: "#0C1A1B", sky: "#A9E2A4", fx: "butterflies", frame: "vine" },
  dunes: { label: "Dunas", hint: "Dunas de arena bajo una luna grande", bg: "#1B1230", sky: "#F2C48D", fx: "sparkles", frame: "fine" },
  sea: { label: "Fondo del mar", hint: "Rayos de luz bajo el agua y algas", bg: "#031726", sky: "#67D5E8", fx: "bubbles", frame: "fine" },
  temple: { label: "Templo de luz", hint: "Columnas y escalones hacia la luz", bg: "#15102A", sky: "#F7E2B0", fx: "golddust", frame: "columns" },
  photo: { label: "Tu foto", hint: "Una foto tuya con un velo encima", bg: "#0D0C22", sky: "#8462CC", fx: "none", frame: "fine" },
};

export const TIER_FRAME_INFO: Record<TierFrame, { label: string; hint: string }> = {
  fine: { label: "Línea fina", hint: "Un borde dorado fino" },
  carved: { label: "Puerta tallada", hint: "Un marco grueso con relieve" },
  moon: { label: "Aro de luna", hint: "Un aro redondo, como una puerta de luna" },
  columns: { label: "Columnas", hint: "Dos columnas y una piedra arriba" },
  vine: { label: "Enredadera", hint: "Hojas y flores por el arco" },
};

/** Los colores que no dependen del paisaje (los de siempre). */
export const TIER_GOLD = "#D4B57A";
export const TIER_TEXT = "#F1EBDF";

export type TierLook = {
  scene: TierScene;
  frame?: TierFrame;
  fx?: TierFx;
  sky?: string;
  bg?: string;
  gold?: string;
  text?: string;
  /** Cuánto se ve la foto (0–100; solo con «Tu foto») y cuánto oscurece el velo (0–100). */
  photo?: number;
  veil?: number;
};
export type TierColorKey = "sky" | "bg" | "gold" | "text";

const pct = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : undefined);

/** Lo que llega (del navegador o guardado) → un diseño válido, o null. */
export function parseTierLook(v: unknown): TierLook | null {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  if (!o || !TIER_SCENES.includes(o.scene as TierScene)) return null;
  const look: TierLook = { scene: o.scene as TierScene };
  if (TIER_FRAMES.includes(o.frame as TierFrame)) look.frame = o.frame as TierFrame;
  if (TIER_FX.includes(o.fx as TierFx)) look.fx = o.fx as TierFx;
  for (const k of ["sky", "bg", "gold", "text"] as const) {
    const c = normalizeHex(o[k]);
    if (c) look[k] = c;
  }
  const photo = pct(o.photo);
  const veil = pct(o.veil);
  if (photo != null) look.photo = photo;
  if (veil != null) look.veil = veil;
  return look;
}

/** El diseño guardado de un nivel (Product.pageTexts.tierLook), o undefined si nunca lo ha tocado. */
export function readTierLook(pageTexts: unknown): TierLook | undefined {
  const o = pageTexts && typeof pageTexts === "object" && !Array.isArray(pageTexts) ? (pageTexts as Record<string, unknown>) : null;
  return parseTierLook(o?.tierLook) ?? undefined;
}

export type ResolvedTierLook = { scene: TierScene; frame: TierFrame; fx: TierFx; sky: string; bg: string; gold: string; text: string; photo: number; veil: number; image: string | null };

/**
 * Lo que se ve: lo elegido y, lo demás, lo de su paisaje. Sin diseño guardado, como siempre: su foto (si tiene) o
 * la noche y el oro. «Tu foto» sin foto se ve como la noche.
 */
export function resolveTierLook(look: TierLook | undefined, image: string | null): ResolvedTierLook {
  const scene = look?.scene ?? (image ? "photo" : "night");
  const info = TIER_SCENE_INFO[scene];
  return {
    scene,
    frame: look?.frame ?? info.frame,
    fx: look?.fx ?? info.fx,
    sky: look?.sky ?? info.sky,
    bg: look?.bg ?? info.bg,
    gold: look?.gold ?? TIER_GOLD,
    text: look?.text ?? TIER_TEXT,
    photo: look?.photo ?? 55,
    veil: look?.veil ?? 100,
    image: scene === "photo" ? image : null,
  };
}

/**
 * Las variables de la tarjeta (globals.css → .tier-portal): sus colores, el brillo del cielo, la foto y el velo.
 * Los colores del movimiento (--fx-*) van aparte, en la escena (tierFxVars).
 */
export function tierLookVars(r: ResolvedTierLook): Record<string, string> {
  return {
    "--tp-bg": r.bg,
    "--tp-sky": r.sky,
    "--tp-glow": rgba(r.sky, 45),
    "--tp-gold": r.gold,
    "--tp-gold-hi": mixHex(r.gold, "#FFFFFF", 0.45),
    "--tp-gold-lo": mixHex(r.gold, "#000000", 0.18),
    "--tp-on-gold": luminance(r.gold) > 0.35 ? "#2A1E0C" : "#FFFAF0",
    "--tp-text": r.text,
    "--tp-muted": mixHex(r.text, r.bg, 0.36),
    "--tp-photo": String(r.photo / 100),
    "--tp-veil": String(r.veil / 100),
  };
}

/** Los colores de lo que se mueve (components/decor-fx lee --fx-*): los del cielo y el dorado, o los suyos propios. */
export function tierFxVars(r: ResolvedTierLook): Record<string, string> {
  const tint = r.fx !== "none" ? DECOR_TINTS[r.fx] : undefined;
  const bgs = [r.bg];
  const a = visibleOn(tint?.[0] ?? r.sky, bgs, 3.2);
  const b = visibleOn(tint?.[1] ?? r.gold, bgs, 3.2);
  return {
    "--fx-a": a,
    "--fx-b": b,
    "--fx-a2": mixHex(a, "#FFFFFF", 0.55),
    "--fx-b2": mixHex(b, "#FFFFFF", 0.55),
    "--fx-soft": mixHex("#FFFFFF", r.sky, 0.12),
    "--fx-bg": r.bg,
    "--fx-moon": "#FBF7EC",
    "--fx-moon-edge": mixHex("#FBF7EC", "#8F8672", 0.6),
    "--fx-own": "0",
  };
}

/** El nombre de lo que se mueve. */
export function tierFxLabel(fx: TierFx): string {
  return fx === "none" ? "Nada" : (DECORS.find((d) => d.key === fx)?.name ?? fx);
}
