import { z } from "zod";
import { FONT_PAIRS, TEMPLATE_KEYS, type FontPairKey, type RadiusKey } from "./templates";

/**
 * Contenido editable de la página pública de una creadora.
 * Se guarda como JSON en Creator.pageDraft (borrador) y Creator.pagePublished.
 * Es independiente de la plantilla: cambiar de diseño no toca el contenido.
 */

export const SECTION_KEYS = [
  "links",
  "products",
  "sessions",
  "courses",
  "memberships",
  "testimonials",
  "faq",
  "contact",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_META: Record<SectionKey, { label: string; defaultTitle: string; hint: string }> = {
  links: { label: "Botones principales", defaultTitle: "", hint: "Enlaces destacados bajo tu presentación" },
  products: { label: "Productos digitales", defaultTitle: "Lecturas y recursos", hint: "PDF, audios, guías…" },
  sessions: { label: "Sesiones y servicios", defaultTitle: "Sesiones", hint: "Reservas 1:1" },
  courses: { label: "Cursos", defaultTitle: "Formación", hint: "Tus programas" },
  memberships: { label: "Membresías", defaultTitle: "Comunidad", hint: "Suscripciones mensuales" },
  testimonials: { label: "Testimonios", defaultTitle: "Lo que dicen", hint: "Opiniones de clientas" },
  faq: { label: "Preguntas frecuentes", defaultTitle: "Preguntas frecuentes", hint: "Resuelve dudas antes de comprar" },
  contact: { label: "Contacto", defaultTitle: "Hablemos", hint: "Email, WhatsApp…" },
};

export const SOCIAL_KEYS = ["instagram", "tiktok", "telegram", "youtube", "whatsapp", "email", "website"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const SOCIAL_LABEL: Record<SocialKey, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  telegram: "Telegram",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  email: "Email",
  website: "Web",
};

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

const shortText = (max: number) => z.string().trim().max(max);

export const pageConfigSchema = z.object({
  displayName: shortText(80).min(1),
  tagline: shortText(120).default(""),
  headline: shortText(140).default(""),
  bio: shortText(600).default(""),
  avatarUrl: z.string().max(500).nullable().default(null),
  coverUrl: z.string().max(500).nullable().default(null),
  template: z.enum(TEMPLATE_KEYS).default("mystical"),
  theme: z
    .object({
      accent: color,
      background: color,
      text: color,
      fontPair: z
        .enum(Object.keys(FONT_PAIRS) as [FontPairKey, ...FontPairKey[]])
        .nullable()
        .optional(),
      radius: z.enum(["sharp", "soft", "round"]).nullable().optional(),
      backgroundImageUrl: z.string().max(500).nullable().optional(),
    })
    .default({}),
  sections: z
    .array(z.object({ key: z.enum(SECTION_KEYS), enabled: z.boolean(), title: shortText(60).optional() }))
    .default([]),
  links: z
    .array(
      z.object({
        id: z.string().max(40),
        label: shortText(60).min(1),
        url: shortText(500).min(1),
        highlight: z.boolean().optional(),
      }),
    )
    .max(12)
    .default([]),
  socials: z.record(z.enum(SOCIAL_KEYS), shortText(200)).default({}),
  testimonials: z
    .array(z.object({ id: z.string().max(40), author: shortText(80), role: shortText(80).optional(), quote: shortText(500) }))
    .max(12)
    .default([]),
  faqs: z
    .array(z.object({ id: z.string().max(40), q: shortText(200), a: shortText(1000) }))
    .max(20)
    .default([]),
  contact: z
    .object({ email: shortText(200).optional(), whatsapp: shortText(40).optional(), message: shortText(300).optional() })
    .default({}),
  hidePoweredBy: z.boolean().default(false),
});

export type PageConfig = z.infer<typeof pageConfigSchema>;
export type ThemeConfig = PageConfig["theme"];
export type RadiusChoice = RadiusKey;

export function defaultSections(): PageConfig["sections"] {
  return SECTION_KEYS.map((key) => ({ key, enabled: true }));
}

export function defaultPageConfig(input: { displayName: string; template?: PageConfig["template"]; tagline?: string; bio?: string }): PageConfig {
  return pageConfigSchema.parse({
    displayName: input.displayName.trim() || "Mi página",
    tagline: input.tagline ?? "",
    bio: input.bio ?? "",
    template: input.template ?? "mystical",
    sections: defaultSections(),
    testimonials: [],
    faqs: [],
    links: [],
    socials: {},
  });
}

/** Lee el JSON guardado tolerando datos antiguos o incompletos. */
export function readPageConfig(raw: unknown, fallbackName = "Mi página"): PageConfig {
  const parsed = pageConfigSchema.safeParse(raw);
  let cfg: PageConfig;
  if (parsed.success) cfg = parsed.data;
  else cfg = defaultPageConfig({ displayName: (raw as { displayName?: string })?.displayName || fallbackName });
  // Asegura que todas las secciones existen (si añadimos una nueva en el futuro).
  const present = new Set(cfg.sections.map((s) => s.key));
  for (const key of SECTION_KEYS) if (!present.has(key)) cfg.sections.push({ key, enabled: false });
  return cfg;
}

export function sectionTitle(cfg: PageConfig, key: SectionKey) {
  const s = cfg.sections.find((x) => x.key === key);
  return s?.title || SECTION_META[key].defaultTitle;
}

export function socialHref(key: SocialKey, value: string) {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  switch (key) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
    case "telegram":
      return `https://t.me/${handle}`;
    case "youtube":
      return `https://youtube.com/@${handle}`;
    case "whatsapp":
      return `https://wa.me/${handle.replace(/[^\d]/g, "")}`;
    case "email":
      return `mailto:${v}`;
    case "website":
      return `https://${v}`;
  }
}

export function safeHref(url: string) {
  const u = url.trim();
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (u.startsWith("/")) return u;
  return `https://${u}`;
}
