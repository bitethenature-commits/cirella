/**
 * La carta de un nivel de la comunidad (/comunidad) tal como la deja la dueña en su panel
 * (Comunidad → Cartas) o en Mi página: la frase de debajo del nombre, lo que incluye (cada cosa con su
 * título, su explicación y su icono), el texto del botón y el icono del nivel (una figura que gira o
 * una imagen suya). Se guarda en Product.pageTexts; sin guardar, sale lo de su descripción
 * (lib/tier-features.ts). Puro.
 */
import { GEOMETRY_FIGURES, isOwnImageSrc, type GeometryFigure } from "./page-blocks";
import type { TierFeature, TierIcon } from "./tier-features";

export const TIER_ICON_KEYS: TierIcon[] = ["text", "page", "calendar", "save", "moon", "chat", "podcast", "meditation", "weather", "masterclass", "ceremony", "circle", "live", "filter", "heart", "star"];
export const TIER_FEATURES_MAX = 12;
export const TIER_INTRO_MAX = 240;
export const TIER_CTA_MAX = 40;
export const TIER_CTA_DEFAULT = "Escríbeme para unirte";

/** Los cinco sólidos platónicos (giran en tres dimensiones). */
export const TIER_SOLIDS = ["tetra", "cube", "octa", "icosa", "dodeca"] as const;
export type TierSolid = (typeof TIER_SOLIDS)[number];
export const TIER_SOLID_LABEL: Record<TierSolid, string> = { tetra: "Tetraedro", cube: "Cubo", octa: "Octaedro", icosa: "Icosaedro", dodeca: "Dodecaedro" };
/** El icono de un nivel: un sólido o una figura de geometría sagrada (giran despacio), o una imagen suya. */
export type TierEmblem = { kind: "solid"; key: TierSolid } | { kind: "figure"; key: GeometryFigure } | { kind: "image"; src: string };

/** El de siempre según el nivel: I tetraedro, II icosaedro, III y más dodecaedro. */
export function defaultEmblem(level: number): TierEmblem {
  return { kind: "solid", key: level <= 0 ? "tetra" : level === 1 ? "icosa" : "dodeca" };
}

function readEmblem(v: unknown): TierEmblem | undefined {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o) return undefined;
  if (o.kind === "solid" && TIER_SOLIDS.includes(o.key as TierSolid)) return { kind: "solid", key: o.key as TierSolid };
  if (o.kind === "figure" && GEOMETRY_FIGURES.includes(o.key as GeometryFigure)) return { kind: "figure", key: o.key as GeometryFigure };
  if (o.kind === "image" && typeof o.src === "string" && isOwnImageSrc(o.src)) return { kind: "image", src: o.src };
  return undefined;
}

/** `intro`: la frase en la web; `area`: la frase del portal en el área de alumno; `emblem`: sin él, el de su nivel. */
export type TierCard = { intro: string; area: string; features: TierFeature[]; cta: string; emblem?: TierEmblem };

const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** El icono guardado de un nivel (aunque aún no tenga carta), o undefined. */
export function readTierEmblem(v: unknown): TierEmblem | undefined {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  const t = o?.tier && typeof o.tier === "object" ? (o.tier as Record<string, unknown>) : null;
  return t ? readEmblem(t.emblem) : undefined;
}

/** La carta guardada, o null si no la ha tocado nunca. */
export function readTierCard(v: unknown): TierCard | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  const t = o?.tier && typeof o.tier === "object" ? (o.tier as Record<string, unknown>) : null;
  if (!t || !Array.isArray(t.features)) return null;
  const features = t.features
    .slice(0, TIER_FEATURES_MAX)
    .map((f) => {
      const x = f && typeof f === "object" ? (f as Record<string, unknown>) : {};
      const icon = TIER_ICON_KEYS.includes(x.icon as TierIcon) ? (x.icon as TierIcon) : "star";
      return { title: str(x.title, 80), detail: str(x.detail, 160) || null, icon };
    })
    .filter((f) => f.title);
  const emblem = readEmblem(t.emblem);
  return { intro: str(t.intro, TIER_INTRO_MAX), area: str(t.area, TIER_INTRO_MAX), features, cta: str(t.cta, TIER_CTA_MAX) || TIER_CTA_DEFAULT, ...(emblem ? { emblem } : {}) };
}

/** Lo que llega del panel (JSON) → lo que se guarda en pageTexts. */
export function parseTierCard(raw: FormDataEntryValue | null): { tier: TierCard } | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const card = readTierCard({ tier: JSON.parse(raw) });
    return card ? { tier: card } : null;
  } catch {
    return null;
  }
}
