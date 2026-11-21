/**
 * Grupos del cielo del calendario («Qué mostrar») y las marcas de cada día según lo que se ve. Sin
 * dependencias: lo usan el servidor (lib/astro-calendar.ts, lib/owner-calendar.ts) y el calendario
 * en el navegador, que así no se lleva astronomy-engine.
 */
export const ASTRO_GROUPS = ["planets", "moon", "asteroids", "points"] as const;
export type AstroGroup = (typeof ASTRO_GROUPS)[number];

export type Visible = Record<AstroGroup, boolean>;
export const ALL_VISIBLE: Visible = { planets: true, moon: true, asteroids: true, points: true };

/** Lo mínimo de una línea del cielo para decidir si se ve y si marca el día. */
type Line = { kind: string; detail?: string; groups: AstroGroup[]; mark: boolean };

/** Una línea se ve si se ven todos los grupos de sus cuerpos. */
export const lineVisible = (l: { groups: AstroGroup[] }, v: Visible) => l.groups.every((g) => v[g]);

/** Las marcas de un día en la rejilla del mes con lo que se ve. */
export function dayMarks(lines: Line[], v: Visible) {
  const shown = lines.filter((l) => l.mark && lineVisible(l, v));
  return {
    newMoon: shown.some((l) => l.kind === "moon" && l.detail === "new"),
    fullMoon: shown.some((l) => l.kind === "moon" && l.detail === "full"),
    eclipse: shown.some((l) => l.kind === "eclipse"),
    conjunctions: shown.filter((l) => l.kind === "conjunction").length,
    stations: shown.filter((l) => l.kind === "station").length,
  };
}

/** «planets,moon» (lo guardado en el navegador) → qué se ve; vacío o raro → todo. */
export function parseVisible(raw: string | null | undefined): Visible {
  if (raw == null) return ALL_VISIBLE;
  const on = new Set(raw.split(","));
  const v = Object.fromEntries(ASTRO_GROUPS.map((g) => [g, on.has(g)])) as Visible;
  return raw.split(",").every((x) => x === "" || (ASTRO_GROUPS as readonly string[]).includes(x)) ? v : ALL_VISIBLE;
}

export const serializeVisible = (v: Visible) => ASTRO_GROUPS.filter((g) => v[g]).join(",");
