/**
 * Páginas de la portada nueva de una creadora, cada una con su dirección (en inglés y sencilla):
 *   · plataforma:   /<usuaria>/<dirección>
 *   · web personal: /<dirección> (middleware.ts → ownerPageRewrite), que es la dirección canónica.
 * Puro y seguro en el cliente. Las direcciones están reservadas (lib/slug.ts): ninguna usuaria, producto
 * ni página extra puede llamarse así.
 *
 * Cada página tiene su nombre interno (SectionPage, el de siempre: lo guardan los diseños y los textos) y su
 * dirección (SECTION_PATH), que es lo que se ve.
 */

export const SECTION_PAGES = ["actualidades", "portal", "ofertas", "comunidad", "cursos", "lecturas", "sesiones", "uno-a-uno", "gifts"] as const;
export type SectionPage = (typeof SECTION_PAGES)[number];

/** La dirección de cada página (la carpeta de app/[username]). */
export const SECTION_PATH: Record<SectionPage, string> = {
  actualidades: "news",
  portal: "portal",
  ofertas: "offers",
  comunidad: "membership",
  cursos: "courses",
  lecturas: "readings",
  sesiones: "sessions",
  "uno-a-uno": "1on1",
  gifts: "gifts",
};
export const SECTION_SEGMENTS: readonly string[] = Object.values(SECTION_PATH);

/** Las direcciones de antes (en español): llevan a la nueva para siempre (middleware.ts). */
export const LEGACY_SECTION_PATH: Record<string, string> = {
  actualidades: "news",
  novedades: "news",
  ofertas: "offers",
  comunidad: "membership",
  cursos: "courses",
  lecturas: "readings",
  sesiones: "sessions",
  "uno-a-uno": "1on1",
};

/** ¿Es la dirección de una de estas páginas? (news, courses, 1on1…) */
export function isSectionSegment(seg: string): boolean {
  return SECTION_SEGMENTS.includes(seg);
}

/** El nombre interno de una página por su nombre o por su dirección (news → actualidades). */
export function asSectionPage(seg: string): SectionPage | null {
  if ((SECTION_PAGES as readonly string[]).includes(seg)) return seg as SectionPage;
  return SECTION_PAGES.find((p) => SECTION_PATH[p] === seg) ?? null;
}

/**
 * Secciones que solo viven en su desplegable de la portada, sin página propia: su dirección es la portada con el
 * ancla del desplegable («/#actualidades»), que se abre solo al llegar. El ancla es su nombre interno. Lo de
 * dentro sí tiene página: cada noticia del portal (/portal/<noticia>), cada regalo (/gifts/<regalo>) y cada
 * publicación (/news/<publicación>); las actualidades y las ofertas llevan a lo suyo.
 */
export const FOLD_ONLY_PAGES: readonly SectionPage[] = ["actualidades", "portal", "ofertas", "gifts"];

/** Las direcciones de esas secciones (también las de antes, en español) → el ancla de su desplegable. */
export const FOLD_SEGMENT: Record<string, SectionPage> = {
  news: "actualidades",
  actualidades: "actualidades",
  novedades: "actualidades",
  portal: "portal",
  offers: "ofertas",
  ofertas: "ofertas",
  gifts: "gifts",
};

/** La dirección de una sección: su página o, si solo vive en la portada, su desplegable. */
export function sectionPagePath(username: string, page: SectionPage, personal: boolean): string {
  if (FOLD_ONLY_PAGES.includes(page)) return homeFoldPath(username, page, personal);
  return sectionBasePath(username, page, personal);
}

/** La carpeta de una sección (/news, /portal…), aunque no tenga página: la base de lo de dentro. */
function sectionBasePath(username: string, page: SectionPage, personal: boolean): string {
  return personal ? `/${SECTION_PATH[page]}` : `/${username}/${SECTION_PATH[page]}`;
}

/** El desplegable de una sección en la portada (se abre solo al llegar con el ancla). */
export function homeFoldPath(username: string, fold: string, personal: boolean): string {
  return `${personal ? "/" : `/${username}`}#${fold}`;
}

/** La página de una noticia del Portal de Noticias. */
export function portalItemPath(username: string, id: string, personal: boolean): string {
  return `${sectionBasePath(username, "portal", personal)}/${id}`;
}

/** La página de un regalo de «Gifts» (su dirección sale del título: lib/site-pages.ts → giftCards). */
export function giftPath(username: string, slug: string, personal: boolean): string {
  return `${sectionBasePath(username, "gifts", personal)}/${slug}`;
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
