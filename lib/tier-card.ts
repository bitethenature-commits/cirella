/**
 * La carta de un nivel de la comunidad (/comunidad) tal como la deja la dueña en su panel
 * (Comunidad → Cartas): la frase de debajo del nombre y lo que incluye, cada cosa con su título, su
 * explicación y su icono. Se guarda en Product.pageTexts; sin guardar, sale lo de su descripción
 * (lib/tier-features.ts). Puro.
 */
import type { TierFeature, TierIcon } from "./tier-features";

export const TIER_ICON_KEYS: TierIcon[] = ["text", "page", "calendar", "save", "moon", "chat", "podcast", "meditation", "weather", "masterclass", "ceremony", "circle", "live", "filter", "heart", "star"];
export const TIER_FEATURES_MAX = 12;
export const TIER_INTRO_MAX = 240;
export const TIER_CTA_MAX = 40;
export const TIER_CTA_DEFAULT = "Escríbeme para unirte";

/** `intro`: la frase en la web; `area`: la frase del portal en el área de alumno. */
export type TierCard = { intro: string; area: string; features: TierFeature[]; cta: string };

const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

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
  return { intro: str(t.intro, TIER_INTRO_MAX), area: str(t.area, TIER_INTRO_MAX), features, cta: str(t.cta, TIER_CTA_MAX) || TIER_CTA_DEFAULT };
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
