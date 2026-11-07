/**
 * Las vistas de «Mi energía» y sus direcciones: /cuenta/mi-energia/<vista>?perfil=<id>. El perfil va
 * por su id (nunca la fecha ni el lugar en la dirección).
 */
export const ENERGY_SYSTEMS = [
  { slug: "astrologia", label: "Astrología", blurb: "Tu carta natal y los tránsitos de hoy" },
  { slug: "diseno-humano", label: "Human Design", blurb: "Tu bodygraph y las puertas del día" },
  { slug: "gene-keys", label: "Gene Keys", blurb: "Tu perfil y la llave del día" },
  { slug: "luna", label: "Luna", blurb: "Tu luna natal y la de hoy" },
] as const;
export type EnergySystemSlug = (typeof ENERGY_SYSTEMS)[number]["slug"];

export const ENERGY_TOOLS = [
  { slug: "oraculo", label: "Oráculo" },
  { slug: "runas", label: "Runas" },
] as const;
export type EnergyToolSlug = (typeof ENERGY_TOOLS)[number]["slug"];

export type EnergyView = "inicio" | EnergySystemSlug | EnergyToolSlug;

export function asEnergyView(slug: string): EnergyView | null {
  return ENERGY_SYSTEMS.some((s) => s.slug === slug) || ENERGY_TOOLS.some((t) => t.slug === slug) ? (slug as EnergyView) : null;
}

/** /cuenta/mi-energia[/vista][?perfil=id] */
export function energyHref(view: EnergyView, profileId?: string | null): string {
  const base = view === "inicio" ? "/cuenta/mi-energia" : `/cuenta/mi-energia/${view}`;
  return profileId ? `${base}?perfil=${encodeURIComponent(profileId)}` : base;
}
