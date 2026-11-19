/**
 * Colores: lectura segura (solo #RRGGBB), contraste WCAG y el color de texto legible sobre un fondo.
 * Puro y sin dependencias: lo usan el editor visual de emails, su HTML (lib/email/blocks-html.ts) y
 * los colores del panel (lib/panel-prefs.ts), en el servidor y en el navegador.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/** «#abc», «ABCDEF» o «#AbCdEf» → «#AABBCC»; null si no es un color hex. Nunca pasa otra cosa (ni url(), ni «;»). */
export function normalizeHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let v = raw.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  if (/^#[0-9a-f]{3}$/i.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return HEX.test(v) ? v.toUpperCase() : null;
}

export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

function rgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/** Luminancia relativa (WCAG 2.x). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos colores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

/** Mínimo WCAG AA para texto normal. */
export const MIN_CONTRAST = 4.5;

/** El texto que mejor se lee sobre un fondo: el oscuro o el claro que se den (por defecto, tinta y blanco). */
export function textOn(bg: string, dark = "#0E1024", light = "#FFFFFF"): string {
  return contrastRatio(dark, bg) >= contrastRatio(light, bg) ? dark : light;
}

/** Mezcla dos colores (t = 0 → a, t = 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  const k = Math.min(1, Math.max(0, t));
  return `#${x.map((c, i) => Math.round(c + (y[i] - c) * k).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/* OKLab: aclarar u oscurecer un color sin cambiarle el tono. */
const toLin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLin = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
function toOklab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabRgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
/** OKLab → hex; si se sale de lo que se puede pintar, le quita color (no luz) hasta que cabe. */
function fromOklab(L: number, a: number, b: number): string {
  let k = 1;
  let c = oklabRgb(L, a, b);
  for (let i = 0; i < 24 && c.some((v) => v < -0.001 || v > 1.001); i++) {
    k *= 0.85;
    c = oklabRgb(L, a * k, b * k);
  }
  return `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * El mismo color, aclarado u oscurecido lo justo para que se vea sobre unos fondos (contraste mínimo `min` con
 * todos; con un degradado, sus dos colores). Va hacia donde hay más sitio: a claro sobre fondos oscuros, a oscuro
 * sobre los claros. Si ya se ve, sale tal cual.
 */
export function visibleOn(color: string, bgs: string[], min = 3): string {
  const c = normalizeHex(color) ?? "#FFFFFF";
  const worst = (x: string) => Math.min(...bgs.map((b) => contrastRatio(x, b)));
  if (worst(c) >= min) return c;
  const up = worst("#FFFFFF") >= worst("#000000");
  const [L, a, b] = toOklab(c);
  let best = c;
  for (let l = L; up ? l <= 1 : l >= 0; l += up ? 0.02 : -0.02) {
    const x = fromOklab(l, a, b);
    if (worst(x) > worst(best)) best = x;
    if (worst(x) >= min) return x;
  }
  return best;
}

/** «#RRGGBB» + opacidad (0–100) → rgba() para CSS. */
export function rgba(hex: string, opacityPct: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${Math.min(100, Math.max(0, Math.round(opacityPct))) / 100})`;
}
