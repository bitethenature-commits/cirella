/**
 * Lo que incluye un nivel de la comunidad, para la página /membership: las líneas con viñeta («•», «-» o
 * «*») de la descripción de la membresía (el «Incluye:» de siempre). Sin viñetas, el resumen. Puro.
 */
export function tierFeatures(description: string | null, summary: string | null, max = 8): string[] {
  const lines = (description ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[•\-*✦]\s+/.test(l))
    .map((l) => l.replace(/^[•\-*✦]\s+/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);
  if (lines.length) return lines.slice(0, max);
  return summary?.trim() ? [summary.trim()] : [];
}

export type TierFeature = { title: string; detail: string | null; icon: TierIcon };
export type TierIcon = "text" | "page" | "calendar" | "save" | "moon" | "chat" | "podcast" | "meditation" | "weather" | "masterclass" | "ceremony" | "circle" | "live" | "filter" | "heart" | "star";

/** El icono de una línea, por sus palabras. */
function iconOf(t: string): TierIcon {
  const s = t.toLowerCase();
  if (/podcast/.test(s)) return "podcast";
  if (/medita/.test(s)) return "meditation";
  if (/astroweather|clima/.test(s)) return "weather";
  if (/masterclass/.test(s)) return "masterclass";
  if (/ceremon/.test(s)) return "ceremony";
  if (/c[ií]rculo/.test(s) && /directo|zoom|luna nueva|grabaci/.test(s)) return "circle";
  if (/c[ií]rculos y lecturas|directos|entrar/.test(s)) return "live";
  if (/p[aá]gina entera/.test(s)) return "page";
  if (/calendario/.test(s)) return "calendar";
  if (/favorit|guarda/.test(s)) return "save";
  if (/luna de hoy|frase/.test(s)) return "moon";
  if (/coment|comparte/.test(s)) return "chat";
  if (/filtra/.test(s)) return "filter";
  if (/cancela/.test(s)) return "heart";
  if (/texto/.test(s)) return "text";
  if (/ritual|luna/.test(s)) return "moon";
  return "star";
}

/**
 * Como tierFeatures, pero cada línea partida en su título y su explicación («Podcast privado: episodios
 * para…» → título «Podcast privado» y el resto debajo) y con un icono según de qué habla.
 */
export function tierFeatureItems(description: string | null, summary: string | null, max = 12): TierFeature[] {
  return tierFeatures(description, summary, max).map((l) => {
    const i = l.indexOf(":");
    const title = i > 0 && i < 60 ? l.slice(0, i).trim() : l;
    const detail = i > 0 && i < 60 ? l.slice(i + 1).trim() || null : null;
    return { title, detail: detail ? detail.charAt(0).toUpperCase() + detail.slice(1) : null, icon: iconOf(l) };
  });
}
