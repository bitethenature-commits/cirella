/**
 * Lo que incluye un nivel de la comunidad, para la página /comunidad: las líneas con viñeta («•», «-» o
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
