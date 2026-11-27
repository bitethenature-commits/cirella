import { READINGS_DEFAULTS, SECTION_META, type PageConfig } from "@/lib/page-config";
import { SITE_TEXTS, type SiteTextKey, type SiteTexts } from "@/lib/site-texts";
import type { Locale } from "./config";
import { mapTexts, walkTexts } from "./content-walk";
import { SECTION_TITLES_I18N, SITE_TEXTS_DE, SITE_TEXTS_EN } from "./site-texts-i18n";

/**
 * La portada en un idioma:
 *   · los textos fijos de la web y los títulos de las secciones que no ha cambiado → los nuestros en ese idioma;
 *   · lo que ella escribió (también un texto fijo o un título que cambió en el Canva) → su traducción (`tx`,
 *     lib/i18n/content.ts), en el idioma en que lo escribiera.
 * Solo para la web pública: el Canva trabaja siempre con su borrador tal cual.
 */

const KEYS = Object.keys(SITE_TEXTS) as SiteTextKey[];

/** Lo que es suyo en los textos fijos (lo que no es el de siempre). */
function ownSiteText(cfg: PageConfig, k: SiteTextKey): string | null {
  const own = cfg.texts?.[k]?.trim();
  return own && own !== SITE_TEXTS[k] ? own : null;
}

function ownSectionTitle(s: PageConfig["sections"][number]): string | null {
  const own = s.title?.trim();
  return own && own !== SECTION_META[s.key].defaultTitle ? own : null;
}

/** «Lecturas y sesiones» tal cual se ven: lo vacío es el texto de siempre (así también se traduce). */
function withReadingDefaults(r: PageConfig["readings"]): PageConfig["readings"] {
  if (!r) return r;
  const card = (k: "reading" | "session") => {
    const d = READINGS_DEFAULTS[k];
    const c = r[k];
    return { eyebrow: c.eyebrow || d.eyebrow, title: c.title || d.title, text: c.text || d.text, steps: c.steps.length ? c.steps : [...d.steps] };
  };
  return { ...r, reading: card("reading"), session: card("session"), circlesTitle: r.circlesTitle || READINGS_DEFAULTS.circlesTitle };
}

/** El resto de la portada (sin los textos fijos ni las secciones, que van aparte). */
function rest(cfg: PageConfig) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { texts, sections, readings, ...other } = cfg;
  return { ...other, readings: withReadingDefaults(readings) };
}

/** Sus textos de la portada, para traducirlos (lib/i18n/content.ts). */
export function configSourceTexts(cfg: PageConfig): string[] {
  const out: string[] = [];
  for (const k of KEYS) {
    const own = ownSiteText(cfg, k);
    if (own) out.push(own);
  }
  for (const s of cfg.sections) {
    const own = ownSectionTitle(s);
    if (own) out.push(own);
  }
  walkTexts(rest(cfg), (s) => out.push(s));
  return out;
}

export function localizeConfig(cfg: PageConfig, locale: Locale, tx: (s: string) => string = (s) => s): PageConfig {
  const fixed = locale === "de" ? SITE_TEXTS_DE : locale === "en" ? SITE_TEXTS_EN : SITE_TEXTS;
  const texts: SiteTexts = {};
  for (const k of KEYS) {
    const own = ownSiteText(cfg, k);
    texts[k] = own ? tx(own) : fixed[k];
  }
  const sections = cfg.sections.map((s) => {
    const own = ownSectionTitle(s);
    if (own) return { ...s, title: tx(own) };
    const t = locale === "es" ? undefined : SECTION_TITLES_I18N[s.key]?.[locale];
    return t ? { ...s, title: t } : s;
  });
  return { ...cfg, ...mapTexts(rest(cfg), tx), texts, sections };
}
