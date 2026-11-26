import type { SitePageState } from "@/lib/site-pages";
import type { SectionPage } from "@/lib/site-sections";

/**
 * Las páginas de «Mis páginas» (Mi página, arriba a la izquierda del editor), en su orden y con el nombre que se ve
 * en el panel. La 1:1 y Gifts son páginas de las suyas (se escriben encima como la portada); las demás se crean
 * solas con lo que publica y en Mi página se ven de verdad: se les cambia el diseño y sus textos fijos.
 */
export const WEB_PAGES: { key: SectionPage; label: string; personalOnly?: boolean }[] = [
  { key: "uno-a-uno", label: "1:1" },
  { key: "cursos", label: "Cursos" },
  { key: "comunidad", label: "Hacerte miembro" },
  { key: "gifts", label: "Gifts" },
  { key: "sesiones", label: "Sesiones" },
  { key: "lecturas", label: "Lecturas" },
];

/** Las tres partes de la página legal (una sola página, cada una con su ancla). */
export const LEGAL_PAGES = [
  { key: "aviso-legal", label: "Aviso legal", anchor: "aviso" },
  { key: "privacidad", label: "Privacidad", anchor: "privacidad" },
  { key: "cookies", label: "Cookies", anchor: "cookies" },
] as const;
export type LegalPageKey = (typeof LEGAL_PAGES)[number]["key"];

/**
 * Lo de dentro, para todas sus alumnas (app/panel/canva/area-canva.tsx): los colores del área (solo la web personal:
 * en la plataforma el área es de todas las creadoras), la base de los cursos y la de las membresías. Empiezan por «_»:
 * ninguna página suya puede llamarse así.
 */
export const AREA_PAGES = [
  { key: "_area", label: "Área de alumna", personalOnly: true },
  { key: "_cursos", label: "Cursos por dentro", personalOnly: false },
  { key: "_membresias", label: "Membresías por dentro", personalOnly: false },
] as const;
export type AreaPageKey = (typeof AREA_PAGES)[number]["key"];

/** Una página suya (las que crea ella, la 1:1 y Gifts) tal cual sale en «Mis páginas». */
export type PanelPage = {
  id: string;
  title: string;
  slug: string;
  state: SitePageState;
  /** Su dirección en la web. */
  path: string;
  /** Sale en el pie de la web. */
  inNav: boolean;
  /** «1:1» o «Gifts»: páginas fijas de la web. */
  fixed: boolean;
};

/** El nombre de una página de «Mis páginas» por su clave («» es la portada). */
export function pageLabel(key: string, pages: PanelPage[]): string {
  if (!key) return "Portada";
  return WEB_PAGES.find((w) => w.key === key)?.label ?? LEGAL_PAGES.find((l) => l.key === key)?.label ?? AREA_PAGES.find((a) => a.key === key)?.label ?? pages.find((p) => p.slug === key)?.title ?? key;
}
