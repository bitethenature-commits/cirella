/** Secciones plegables de la portada con aviso de novedades (puro: lo usan el navegador y el servidor). */
export const SEEN_SECTIONS = ["posts", "portal", "offers"] as const;
export type SeenSection = (typeof SEEN_SECTIONS)[number];

/** «2 novedades sin ver» (el texto del diccionario, con `n`: se traduce donde se pinta). */
export function unseenLabel(n: number): string {
  return n === 1 ? "1 novedad sin ver" : "{n} novedades sin ver";
}
