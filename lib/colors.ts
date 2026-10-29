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

/** ¿Se lee bien este texto sobre este fondo? (WCAG AA: 4,5:1; 3:1 para títulos grandes). */
export function readable(text: string, bg: string, large = false): boolean {
  return contrastRatio(text, bg) >= (large ? 3 : MIN_CONTRAST);
}

export const isDarkColor = (hex: string) => luminance(hex) < 0.18;

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

/** «#RRGGBB» + opacidad (0–100) → rgba() para CSS. */
export function rgba(hex: string, opacityPct: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${Math.min(100, Math.max(0, Math.round(opacityPct))) / 100})`;
}
