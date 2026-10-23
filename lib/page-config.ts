import { z } from "zod";
import { FONT_PAIRS, TEMPLATE_KEYS, type FontPairKey, type RadiusKey } from "./templates";

/**
 * Contenido editable de la página pública de una creadora.
 * Se guarda como JSON en Creator.pageDraft (borrador) y Creator.pagePublished.
 * Es independiente de la plantilla: cambiar de diseño no toca el contenido.
 */

/** Orden por defecto de las secciones de una página nueva (y sitio donde entra una sección nueva). */
export const SECTION_KEYS = [
  "links",
  "blocks",
  "products",
  "sessions",
  "courses",
  "memberships",
  "posts",
  "codes",
  "testimonials",
  "faq",
  "contact",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_META: Record<SectionKey, { label: string; defaultTitle: string; hint: string }> = {
  links: { label: "Botones principales", defaultTitle: "", hint: "Enlaces destacados bajo tu presentación" },
  blocks: { label: "Bloques de texto", defaultTitle: "", hint: "Sobre mí, servicios, cómo trabajo…" },
  products: { label: "Productos digitales", defaultTitle: "Lecturas y recursos", hint: "PDF, audios, guías…" },
  sessions: { label: "Sesiones y servicios", defaultTitle: "Sesiones", hint: "Reservas 1:1" },
  courses: { label: "Cursos", defaultTitle: "Formación", hint: "Tus programas" },
  memberships: { label: "Membresías", defaultTitle: "Comunidad", hint: "Suscripciones mensuales" },
  posts: { label: "Novedades", defaultTitle: "Novedades", hint: "Tus 3 últimas publicaciones" },
  codes: { label: "Códigos de descuento", defaultTitle: "Códigos de descuento", hint: "Descuentos en marcas que recomiendas" },
  testimonials: { label: "Testimonios", defaultTitle: "Lo que dicen", hint: "Opiniones de clientas" },
  faq: { label: "Preguntas frecuentes", defaultTitle: "Preguntas frecuentes", hint: "Resuelve dudas antes de comprar" },
  contact: { label: "Contacto", defaultTitle: "Hablemos", hint: "Email, WhatsApp…" },
};

/** Secciones que se gestionan fuera del editor (tienen su propia pantalla en el panel). */
export const SECTION_MANAGE_HREF: Partial<Record<SectionKey, { href: string; label: string }>> = {
  posts: { href: "/panel/publicaciones", label: "Publicaciones" },
  codes: { href: "/panel/codigos", label: "Códigos" },
};

export const TEXT_BLOCKS_MAX = 12;
export const TEXT_BLOCK_BODY_MAX = 2000;

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

const shortText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

export const pageConfigSchema = z.object({
  displayName: shortText(80).min(1, "Escribe tu nombre"),
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
        label: shortText(60).min(1, "Cada botón necesita un texto"),
        url: shortText(500).min(1, "Cada botón necesita un enlace"),
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
  // Bloques fijos de texto (sobre mí, servicios…): título, texto y un botón opcional.
  blocks: z
    .array(
      z
        .object({
          id: z.string().max(40),
          title: shortText(80).default(""),
          body: shortText(TEXT_BLOCK_BODY_MAX).default(""),
          // Formato del texto (lib/rich-text.ts): ausente o desconocido = bloque de antes (párrafos y
          // enlaces automáticos). Nunca invalida la página entera (readPageConfig volvería a la de por defecto).
          format: z.literal("MD").optional().catch(undefined),
          buttonLabel: shortText(40).optional(),
          buttonUrl: shortText(500).optional(),
          enabled: z.boolean().default(true),
        })
        .superRefine((b, ctx) => {
          if (!b.title && !b.body) ctx.addIssue({ code: "custom", message: "Cada bloque de texto necesita un título o un texto" });
          if (b.buttonLabel && !b.buttonUrl) ctx.addIssue({ code: "custom", message: `Falta el enlace del botón «${b.buttonLabel}»` });
          if (b.buttonUrl && !b.buttonLabel) ctx.addIssue({ code: "custom", message: "Escribe el texto del botón del bloque de texto" });
        }),
    )
    .max(TEXT_BLOCKS_MAX, `Máximo ${TEXT_BLOCKS_MAX} bloques de texto`)
    // Opcional en el tipo para no obligar a reescribir las páginas guardadas antes de existir;
    // readPageConfig siempre lo devuelve (vacío si no hay).
    .optional(),
  hidePoweredBy: z.boolean().default(false),
});

export type PageConfig = z.infer<typeof pageConfigSchema>;
export type TextBlock = NonNullable<PageConfig["blocks"]>[number];
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
  cfg.sections = withAllSections(cfg.sections);
  cfg.blocks ??= [];
  return cfg;
}

/**
 * Asegura que están todas las secciones, sin duplicados. Una sección que no existía cuando se guardó
 * la página (p. ej. Novedades o Bloques de texto) entra visible justo detrás de la que la precede en
 * el orden por defecto: no pinta nada hasta que tenga contenido, y así aparece sola en cuanto se
 * publica la primera novedad o el primer código.
 */
export function withAllSections(sections: PageConfig["sections"]): PageConfig["sections"] {
  const out: PageConfig["sections"] = [];
  const seen = new Set<SectionKey>();
  for (const s of sections) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    out.push(s);
  }
  SECTION_KEYS.forEach((key, i) => {
    if (seen.has(key)) return;
    seen.add(key);
    // Detrás de la sección anterior en el orden por defecto que ya esté; si no hay, al principio.
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const prev = out.findIndex((s) => s.key === SECTION_KEYS[j]);
      if (prev >= 0) {
        at = prev + 1;
        break;
      }
    }
    out.splice(at, 0, { key, enabled: true });
  });
  return out;
}

/** Bloques de texto que se ven en la página (visibles y con algo que mostrar). */
export function visibleTextBlocks(cfg: Pick<PageConfig, "blocks">): TextBlock[] {
  return (cfg.blocks ?? []).filter((b) => b.enabled && (b.title.trim() || b.body.trim()));
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
