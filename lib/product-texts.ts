/**
 * Textos de la ficha de una lectura, sesión o círculo que la dueña puede cambiar desde su estudio
 * (Product.pageTexts): las frases de la lista con su icono, los tres pasos (I, II, III) y el texto del
 * botón de la carta. Sin guardar, salen los de siempre. Puro: lo usan el estudio, el guardado, la
 * ficha pública y la carta (los iconos se pintan con components/creator-page/perk-icons.tsx).
 */
export type StudioKind = "reading" | "session" | "circle";
/** La luna de un círculo elegida a mano: nueva, llena o eclipse, su signo y su frase (lib/moon-circle-sky.ts). */
export type MoonChoice = { phase: "new" | "full" | "eclipse"; sign: string; phrase: string };
export type PageTexts = { perks: string[]; icons: string[]; steps: string[]; cardCta: string; moon?: MoonChoice | null };

const ZODIAC = ["Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo", "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis"];

/** La luna elegida para un círculo, si la hay. */
export function readMoonChoice(v: unknown): MoonChoice | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const m = o.moon && typeof o.moon === "object" ? (o.moon as Record<string, unknown>) : null;
  if (!m || (m.phase !== "new" && m.phase !== "full" && m.phase !== "eclipse") || typeof m.sign !== "string" || !ZODIAC.includes(m.sign)) return null;
  return { phase: m.phase, sign: m.sign, phrase: typeof m.phrase === "string" ? m.phrase.trim().slice(0, 240) : "" };
}

const MAX = 80;
export const CARD_CTA_MAX = 30;

/** Los iconos que se pueden elegir para cada frase (sus dibujos, en perk-icons.tsx). */
export const PERK_ICON_KEYS = [
  "mail",
  "sparkles",
  "heart",
  "video",
  "calendar",
  "clock",
  "star",
  "moon",
  "sun",
  "gift",
  "book",
  "headphones",
  "file",
  "flower",
  "gem",
  "feather",
  "eye",
  "compass",
  "leaf",
  "flame",
  "infinity",
  "users",
  "message",
  "shield",
] as const;
export type PerkIconKey = (typeof PERK_ICON_KEYS)[number];
const isIcon = (v: unknown): v is PerkIconKey => typeof v === "string" && (PERK_ICON_KEYS as readonly string[]).includes(v);

/** Cuántas frases de la lista se escriben a mano (la duración y las plazas van aparte). */
export const PERK_COUNT: Record<StudioKind, number> = { reading: 3, session: 3, circle: 1 };

export function defaultPageTexts(kind: StudioKind, videoText = "Por Zoom"): PageTexts {
  const perks =
    kind === "reading"
      ? ["Te la envío por email", "Preparada personalmente para ti", "Antes lo hablamos con calma"]
      : kind === "session"
        ? [videoText, "Eliges día y hora en la solicitud", "Lo cerramos por email"]
        : [`${videoText}, en directo`];
  const icons = kind === "reading" ? ["mail", "sparkles", "heart"] : kind === "session" ? ["video", "calendar", "mail"] : ["video"];
  const steps = ["Me escribes", "Te respondo por email", kind === "reading" ? "Lo cerramos y te lo envío" : "Lo cerramos y te envío el enlace"];
  return { perks, icons, steps, cardCta: "Escríbeme" };
}

const clean = (v: unknown, n: number): string[] | null => {
  if (!Array.isArray(v)) return null;
  const out = v.slice(0, n).map((x) => (typeof x === "string" ? x.trim().slice(0, MAX) : ""));
  return out.length === n && out.every(Boolean) ? out : null;
};

/** Lo guardado, solo si está completo para ese tipo (si no, null y salen los de siempre). */
export function readPageTexts(v: unknown, kind: StudioKind): { perks: string[] | null; icons: string[] | null; steps: string[] | null; cardCta: string | null } {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const n = PERK_COUNT[kind];
  const icons = Array.isArray(o.icons) && o.icons.length >= n && o.icons.slice(0, n).every(isIcon) ? (o.icons.slice(0, n) as string[]) : null;
  return { perks: clean(o.perks, n), icons, steps: clean(o.steps, 3), cardCta: readCardCta(v) };
}

/** El texto del botón de la carta («Escríbeme»), si lo ha cambiado. */
export function readCardCta(v: unknown): string | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return typeof o.cardCta === "string" && o.cardCta.trim() ? o.cardCta.trim().slice(0, CARD_CTA_MAX) : null;
}

/** Lo que llega del estudio (JSON) → lo que se guarda. */
export function parsePageTexts(raw: FormDataEntryValue | null, kind: StudioKind): PageTexts | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const v = JSON.parse(raw);
    const r = readPageTexts(v, kind);
    const d = defaultPageTexts(kind);
    return { perks: r.perks ?? d.perks, icons: r.icons ?? d.icons, steps: r.steps ?? d.steps, cardCta: r.cardCta ?? d.cardCta, moon: kind === "circle" ? readMoonChoice(v) : null };
  } catch {
    return null;
  }
}

/** El tipo de estudio de un producto (lectura, sesión 1:1 o círculo/taller). */
export function studioKindOf(p: { type: string; groupSession?: boolean | null }): StudioKind | null {
  if (p.type === "DIGITAL") return "reading";
  if (p.type === "SESSION") return p.groupSession ? "circle" : "session";
  return null;
}
