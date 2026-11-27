import { NEWSLETTER_FORM_DEFAULTS, READINGS_DEFAULTS, SECTION_META, type PageConfig, type SectionKey } from "@/lib/page-config";
import { isSiteTextKey, withSiteText } from "@/lib/site-texts";

/**
 * Qué campo de la portada cambia cada `path` del modo Canva (components/creator-page/home-edit.ts):
 *   displayName · tagline · headline · bio · avatarUrl · coverUrl · contact.message · newsletter.button
 *   section:<clave>                      → el título de esa sección
 *   text:<clave>                         → un texto fijo de la web (lib/site-texts.ts), para todas las páginas
 *   about.eyebrow|title|text|linkLabel|url|image
 *   readings.session|reading.eyebrow|title|text · readings.circlesTitle
 *   link:<id>:label|url · bubble:<id>:label|url|image · system:<id>:title|url · faq:<id>:q|a
 *   testimonial:<id>:quote|author|role
 * Devuelve la configuración nueva (sin tocar la de entrada).
 */
export function setPath(cfg: PageConfig, path: string, value: string | null): PageConfig {
  const v = value ?? "";
  switch (path) {
    case "displayName":
    case "tagline":
    case "headline":
    case "bio":
      return { ...cfg, [path]: v };
    case "avatarUrl":
    case "coverUrl":
      return { ...cfg, [path]: value || null };
    case "contact.message":
      return { ...cfg, contact: { ...cfg.contact, message: v } };
    case "newsletter.button":
      return { ...cfg, newsletter: { ...NEWSLETTER_FORM_DEFAULTS, footer: false, ...cfg.newsletter, button: v.slice(0, 30) || NEWSLETTER_FORM_DEFAULTS.button } };
  }
  if (path.startsWith("text:")) {
    const key = path.slice("text:".length);
    return isSiteTextKey(key) ? { ...cfg, texts: withSiteText(cfg.texts, key, v) } : cfg;
  }
  if (path.startsWith("section:")) {
    const key = path.slice("section:".length) as SectionKey;
    // Vacío o igual al de siempre: sin título propio.
    const title = v && v !== SECTION_META[key]?.defaultTitle ? v : undefined;
    return { ...cfg, sections: cfg.sections.map((s) => (s.key === key ? { ...s, title } : s)) };
  }
  if (path.startsWith("about.")) {
    const field = path.slice("about.".length);
    const base = cfg.about ?? { eyebrow: "Sobre mí", title: "", text: "", url: "", image: null, linkLabel: "" };
    return { ...cfg, about: { ...base, [field]: field === "image" ? value || null : v } };
  }
  if (path === "readings.circlesTitle") {
    const base = cfg.readings ?? READINGS_DEFAULTS_CONFIG();
    return { ...cfg, readings: { ...base, circlesTitle: v } };
  }
  if (path.startsWith("readings.")) {
    const [, kind, field] = path.split(".") as [string, "session" | "reading", "eyebrow" | "title" | "text"];
    const base = cfg.readings ?? READINGS_DEFAULTS_CONFIG();
    return { ...cfg, readings: { ...base, [kind]: { ...base[kind], [field]: v } } };
  }
  const [kind, id, field] = path.split(":");
  switch (kind) {
    case "link":
      return { ...cfg, links: cfg.links.map((l) => (l.id === id ? { ...l, [field]: v } : l)) };
    case "bubble":
      return { ...cfg, bubbles: (cfg.bubbles ?? []).map((b) => (b.id === id ? { ...b, [field]: field === "image" ? value || null : v } : b)) };
    case "system":
      return { ...cfg, systems: (cfg.systems ?? []).map((s) => (s.id === id ? { ...s, [field]: v } : s)) };
    case "faq":
      return { ...cfg, faqs: cfg.faqs.map((f) => (f.id === id ? { ...f, [field]: v } : f)) };
    case "testimonial": {
      // Sin nombre no se puede quedar (lo pide la web): se deja el que tenía.
      if (field === "author" && !v.trim()) return cfg;
      const text = v.slice(0, field === "quote" ? 500 : 80);
      return { ...cfg, testimonials: cfg.testimonials.map((t) => (t.id === id ? { ...t, [field]: field === "role" ? text || undefined : text } : t)) };
    }
  }
  return cfg;
}

/** La tarjeta «Lecturas, sesiones y círculos» con sus textos de siempre (si aún no existía). */
function READINGS_DEFAULTS_CONFIG(): NonNullable<PageConfig["readings"]> {
  const card = (d: { eyebrow: string; title: string; text: string }) => ({ eyebrow: d.eyebrow, title: d.title, text: d.text, steps: [] as string[] });
  return { reading: card(READINGS_DEFAULTS.reading), session: card(READINGS_DEFAULTS.session), circlesTitle: READINGS_DEFAULTS.circlesTitle };
}
