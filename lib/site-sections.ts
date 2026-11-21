/**
 * Páginas de la portada nueva de una creadora, cada una con su dirección:
 *   · plataforma:   /<usuaria>/<página>
 *   · web personal: /<página> (middleware.ts → ownerPageRewrite), que es la dirección canónica.
 * Puro y seguro en el cliente. Los nombres están reservados (lib/slug.ts): ninguna usuaria, producto
 * ni página extra puede llamarse así.
 */

export const SECTION_PAGES = ["actualidades", "portal", "ofertas", "comunidad", "cursos", "lecturas", "sesiones", "uno-a-uno", "gifts"] as const;
export type SectionPage = (typeof SECTION_PAGES)[number];

export function isSectionPage(seg: string): seg is SectionPage {
  return (SECTION_PAGES as readonly string[]).includes(seg);
}

export function sectionPagePath(username: string, page: SectionPage, personal: boolean): string {
  return personal ? `/${page}` : `/${username}/${page}`;
}

/** Títulos de las páginas (sugerencias de enlaces del panel y migas). */
export const SECTION_PAGE_TITLE: Record<SectionPage, string> = {
  actualidades: "Actualidades",
  portal: "Portal de Noticias",
  ofertas: "Ofertas",
  comunidad: "Comunidad",
  cursos: "Cursos",
  lecturas: "Lecturas",
  sesiones: "Sesiones",
  "uno-a-uno": "1:1",
  gifts: "Gifts",
};
