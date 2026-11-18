/**
 * La marca de la dueña para el editor de emails: su paleta (los colores de «Mi página») para los
 * selectores de color y sus redes para el bloque «Redes sociales». Puro: navegador y servidor.
 */
import { normalizeHex } from "./colors";
import { SOCIAL_NETWORKS, type SocialNetwork } from "./email-blocks";
import { readPageConfig } from "./page-config";
import { resolveTheme } from "./templates";

/** Colores neutros que siempre están a mano además de los de la marca. */
const NEUTRALS = ["#FFFFFF", "#F6F1E7", "#0E1024", "#3B3950", "#8A8698"];

/**
 * Paleta de la marca: los colores de su página (plantilla y personalización de «Mi página») y los
 * neutros. Sin repetir, siempre #RRGGBB.
 */
export function brandPalette(pageDraft: unknown, displayName = "Mi página"): string[] {
  const cfg = readPageConfig(pageDraft, displayName);
  const t = resolveTheme(cfg.template, cfg.theme ?? {});
  const brand = [t.colors.accent, t.colors.gold, t.colors.bg, t.colors.bg2, t.colors.text];
  return [...new Set([...brand, ...NEUTRALS].map((c) => normalizeHex(c)).filter((c): c is string => !!c))].slice(0, 10);
}

/** Sus redes de «Mi página», para rellenar el bloque «Redes sociales». */
export function brandSocials(pageDraft: unknown, displayName = "Mi página"): Partial<Record<SocialNetwork, string>> {
  const cfg = readPageConfig(pageDraft, displayName);
  const out: Partial<Record<SocialNetwork, string>> = {};
  for (const [k, v] of Object.entries(cfg.socials ?? {})) {
    if (!v?.trim()) continue;
    const n = (k === "website" ? "web" : k) as SocialNetwork;
    if (SOCIAL_NETWORKS.includes(n)) out[n] = v.trim();
  }
  return out;
}
