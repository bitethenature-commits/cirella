/**
 * Los idiomas de la web: alemán (el principal, sin nada delante en la dirección), inglés (/en/…) y español (/es/…).
 * Puro y seguro en el middleware y en el navegador.
 *
 *   · middleware.ts quita /en o /es de la dirección, guarda el idioma en una cabecera (LOCALE_HEADER) para el
 *     servidor y en una cookie (LOCALE_COOKIE) para recordar la elección.
 *   · Sin nada delante es alemán; si la cookie dice otro idioma, la dirección pasa a llevarlo delante.
 */

export const LOCALES = ["de", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

/** Cabecera que pone el middleware con el idioma de la petición. */
export const LOCALE_HEADER = "x-site-locale";
/** Cookie con el idioma elegido (un año). */
export const LOCALE_COOKIE = "cirella_lang";
/** Cookie con el idioma del panel y del admin (lo elige la dueña en Ajustes; sin ella, español). */
export const PANEL_LOCALE_COOKIE = "cirella_panel_lang";
/** El panel sin idioma elegido. */
export const PANEL_DEFAULT_LOCALE: Locale = "es";

/** Cómo se llama cada idioma en su propio idioma (el botón de cambiar de idioma). */
export const LOCALE_NAME: Record<Locale, string> = { de: "Deutsch", en: "English", es: "Español" };
/** Para las etiquetas de redes (og:locale). */
export const OG_LOCALE: Record<Locale, string> = { de: "de_DE", en: "en_GB", es: "es_ES" };
/** Para las fechas y los números (Intl). */
export const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB", es: "es-ES" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Los idiomas que van delante en la dirección (todos menos el principal). */
const PREFIXED = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/** Separa el idioma de una dirección: «/en/courses» → en y «/courses»; «/courses» → null y «/courses». */
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const m = /^\/([a-z]{2})(?=\/|$)(.*)$/.exec(pathname);
  if (m && (PREFIXED as readonly string[]).includes(m[1])) return { locale: m[1] as Locale, path: m[2] || "/" };
  return { locale: null, path: pathname };
}

/** Una dirección de la web en un idioma: el alemán sin nada delante; el resto con /en o /es. */
export function localePath(path: string, locale: Locale): string {
  const clean = splitLocale(path).path;
  if (locale === DEFAULT_LOCALE) return clean;
  return `/${locale}${clean === "/" ? "" : clean}`;
}
