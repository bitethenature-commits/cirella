import { z } from "zod";
import { contentBlockSchema, HOME_BLOCKS_MAX, HOME_TEXT_MAX, readBlocks, visibleBlocks, type ContentBlock } from "./page-blocks";
import { FONT_PAIRS, TEMPLATE_KEYS, type FontPairKey, type RadiusKey } from "./templates";

/**
 * Contenido editable de la página pública de una creadora.
 * Se guarda como JSON en Creator.pageDraft (borrador) y Creator.pagePublished.
 * Es independiente de la plantilla: cambiar de diseño no toca el contenido.
 */

/**
 * Orden por defecto de las secciones de una página nueva (y sitio donde entra una sección nueva en una
 * página guardada antes de existir: detrás de la que la precede aquí, ver withAllSections). La portada
 * de la web personal: presentación, botones, accesos (burbujas), actualidades, portal, ofertas, sobre
 * mí, sistemas, lecturas y sesiones, cursos y códigos; después lo de siempre.
 */
export const SECTION_KEYS = [
  "links",
  "bubbles",
  "posts",
  "portal",
  "offers",
  "about",
  "systems",
  "readings",
  "courses",
  "codes",
  "blocks",
  "products",
  "sessions",
  "memberships",
  "testimonials",
  "faq",
  "newsletter",
  "contact",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_META: Record<SectionKey, { label: string; defaultTitle: string; hint: string }> = {
  links: { label: "Botones principales", defaultTitle: "", hint: "Enlaces destacados bajo tu presentación" },
  bubbles: { label: "Accesos", defaultTitle: "", hint: "Burbujas redondas con foto: Sobre mí, Cursos, Comunidad…" },
  posts: { label: "Actualidades", defaultTitle: "Actualidades", hint: "Tus 2 últimas publicaciones" },
  portal: { label: "Portal de Noticias", defaultTitle: "Portal de Noticias", hint: "Gratis para tus suscriptoras con cuenta" },
  offers: { label: "Ofertas", defaultTitle: "Ofertas", hint: "Los productos en oferta (se oculta si no hay)" },
  about: { label: "Sobre mí", defaultTitle: "", hint: "Tarjeta con tu foto que lleva a tu página «Sobre mí»" },
  systems: { label: "Sistemas", defaultTitle: "Sistemas con los que trabajo", hint: "Tarjetas que llevan a la página de cada método" },
  readings: { label: "Lecturas, sesiones y círculos", defaultTitle: "Lecturas, sesiones y círculos", hint: "Cómo se reserva y los próximos círculos de la luna" },
  blocks: { label: "Bloques", defaultTitle: "", hint: "Textos, imágenes, galerías y vídeos" },
  products: { label: "Productos digitales", defaultTitle: "Lecturas y recursos", hint: "PDF, audios, guías…" },
  sessions: { label: "Sesiones y servicios", defaultTitle: "Sesiones", hint: "Reservas 1:1" },
  courses: { label: "Cursos", defaultTitle: "Cursos", hint: "Tus programas (con página propia si hay más de uno)" },
  memberships: { label: "Comunidad", defaultTitle: "Comunidad", hint: "Tus membresías" },
  codes: { label: "Códigos de descuento", defaultTitle: "Códigos de descuento", hint: "Descuentos en marcas que recomiendas" },
  testimonials: { label: "Testimonios", defaultTitle: "Lo que dicen", hint: "Opiniones de clientas" },
  faq: { label: "Preguntas frecuentes", defaultTitle: "Preguntas frecuentes", hint: "Resuelve dudas antes de comprar" },
  newsletter: { label: "Newsletter", defaultTitle: "Recibe mi newsletter", hint: "Formulario para apuntarse (con confirmación por email)" },
  contact: { label: "Contacto", defaultTitle: "Hablemos", hint: "Email, WhatsApp…" },
};

/**
 * Secciones que entran ocultas (en una página nueva y en las guardadas antes de existir): la de la
 * newsletter solo se enseña cuando la dueña la activa (y solo en la web personal).
 */
export const DEFAULT_OFF_SECTIONS: ReadonlySet<SectionKey> = new Set(["newsletter"]);

/** Textos del formulario de la newsletter (sección «Newsletter» y pie de la web). */
export const NEWSLETTER_FORM_DEFAULTS = {
  text: "Te escribo de vez en cuando con lo que estoy preparando, lecturas y novedades. Sin spam.",
  button: "Apuntarme",
};

/** Secciones que se gestionan fuera del editor (tienen su propia pantalla en el panel). */
export const SECTION_MANAGE_HREF: Partial<Record<SectionKey, { href: string; label: string }>> = {
  posts: { href: "/panel/publicaciones", label: "Actualidades" },
  portal: { href: "/panel/portal", label: "Portal de Noticias" },
  offers: { href: "/panel/productos", label: "Productos (cada uno con su oferta)" },
  codes: { href: "/panel/codigos", label: "Códigos" },
};

/** Burbujas de «Accesos»: de 1 a 4, en una fila (también en el móvil). */
export const BUBBLES_MAX = 4;
/** Tarjetas de «Sistemas con los que trabajo». */
export const SYSTEMS_MAX = 8;
/** Pasos de «Cómo reservar» de las páginas de lecturas y de sesiones. */
export const STEPS_MAX = 6;

/** Textos por defecto de «Lecturas, sesiones y círculos» (y de sus dos páginas con los pasos). */
export const READINGS_DEFAULTS = {
  reading: {
    eyebrow: "Lectura",
    title: "Te la preparo yo",
    text: "Me das tus datos y la recibes grabada o en PDF.",
    steps: [
      "Elige la lectura que te llama.",
      "Págala aquí mismo, con tarjeta o PayPal.",
      "Escribe tu fecha, hora y lugar de nacimiento.",
      "Te la preparo con calma y te llega a tu área: grabada o en PDF.",
    ],
  },
  session: {
    eyebrow: "Sesión",
    title: "En directo por Zoom",
    text: "Eliges día y hora y hablamos de tu carta.",
    steps: [
      "Elige la sesión.",
      "Escoge el día y la hora que te vayan bien.",
      "Paga y recibe la confirmación con el enlace de Zoom.",
      "Nos vemos en directo: te quedas con la grabación.",
    ],
  },
  circlesTitle: "Círculos de la luna · sin ser miembro",
};

/** Bloques de la portada (lib/page-blocks.ts): textos, imágenes, galerías y vídeos. */
export const TEXT_BLOCKS_MAX = HOME_BLOCKS_MAX;
export const TEXT_BLOCK_BODY_MAX = HOME_TEXT_MAX;
const homeBlockSchema = contentBlockSchema({ bodyMax: TEXT_BLOCK_BODY_MAX });

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
/** Imagen subida aquí (o de la demo): nunca una URL de fuera. */
const ownImage = z
  .string()
  .max(500)
  .nullable()
  .default(null)
  .transform((v) => (v && (v.startsWith("/media/") || v.startsWith("/demo/")) && !v.includes("..") ? v : null));
const linkText = shortText(500);

const bubbleSchema = z.object({
  id: z.string().max(40),
  label: shortText(30).min(1, "Cada burbuja necesita un texto"),
  url: linkText.min(1, "Cada burbuja necesita un enlace"),
  image: ownImage,
});
const systemSchema = z.object({
  id: z.string().max(40),
  title: shortText(60).min(1, "Cada sistema necesita un título"),
  text: shortText(200).default(""),
  url: linkText.default(""),
  image: ownImage,
});
const readingCardSchema = z.object({
  eyebrow: shortText(30).default(""),
  title: shortText(60).default(""),
  text: shortText(240).default(""),
  steps: z.array(shortText(200)).max(STEPS_MAX).default([]),
});
const aboutSchema = z.object({
  eyebrow: shortText(30).default("Sobre mí"),
  title: shortText(80).default(""),
  text: shortText(400).default(""),
  url: linkText.default(""),
  image: ownImage,
  linkLabel: shortText(40).default(""),
});
const readingsSchema = z.object({ reading: readingCardSchema, session: readingCardSchema, circlesTitle: shortText(80).default("") });

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
  // Bloques de la portada: texto con formato, imagen, galería y vídeo (lib/page-blocks.ts). Los de
  // antes (sin `kind`) son de texto.
  blocks: z
    .array(homeBlockSchema)
    .max(TEXT_BLOCKS_MAX, `Máximo ${TEXT_BLOCKS_MAX} bloques`)
    // Opcional en el tipo para no obligar a reescribir las páginas guardadas antes de existir;
    // readPageConfig siempre lo devuelve (vacío si no hay).
    .optional(),
  hidePoweredBy: z.boolean().default(false),
  // «Accesos»: burbujas redondas con foto bajo la presentación (1–4, en una fila).
  bubbles: z.array(bubbleSchema).max(BUBBLES_MAX, `Máximo ${BUBBLES_MAX} burbujas`).optional(),
  // Tarjeta «Sobre mí»: foto a la derecha y título y texto a la izquierda; toda la tarjeta es el enlace.
  about: aboutSchema.nullable().optional(),
  // «Sistemas con los que trabajo»: tarjetas horizontales que llevan a la página de cada método.
  systems: z.array(systemSchema).max(SYSTEMS_MAX, `Máximo ${SYSTEMS_MAX} sistemas`).optional(),
  // «Lecturas, sesiones y círculos»: los dos textos (y los pasos de sus páginas) y el título de los círculos.
  readings: readingsSchema.nullable().optional(),
  // Formulario de la newsletter: el texto y el botón de la sección, y si sale también en el pie de la
  // web (todas las páginas). Solo en la web personal.
  newsletter: z
    .object({
      text: shortText(300).default(NEWSLETTER_FORM_DEFAULTS.text),
      button: shortText(30).default(NEWSLETTER_FORM_DEFAULTS.button),
      footer: z.boolean().default(false),
    })
    .optional(),
});

export type PageConfig = z.infer<typeof pageConfigSchema>;
/** Alias de antes: los bloques de la portada ya no son solo de texto. */
export type TextBlock = ContentBlock;
export type ThemeConfig = PageConfig["theme"];
export type RadiusChoice = RadiusKey;

export function defaultSections(): PageConfig["sections"] {
  return SECTION_KEYS.map((key) => ({ key, enabled: !DEFAULT_OFF_SECTIONS.has(key) }));
}

export function defaultPageConfig(input: { displayName: string; template?: PageConfig["template"]; tagline?: string; bio?: string; personal?: boolean }): PageConfig {
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
    // Web personal: la portada nueva ya trae los accesos, la tarjeta «Sobre mí» y las lecturas.
    ...(input.personal ? personalHomeDefaults(input.displayName) : {}),
  });
}

/** Lo que trae de serie la portada de una web personal nueva (todo editable en Mi página). */
export function personalHomeDefaults(displayName: string): Pick<PageConfig, "bubbles" | "about" | "readings"> {
  const first = displayName.trim().split(/\s+/)[0] || "";
  return {
    bubbles: [
      { id: "b-sobre-mi", label: "Sobre mí", url: "/sobre-mi", image: null },
      { id: "b-cursos", label: "Cursos", url: "/cursos", image: null },
      { id: "b-comunidad", label: "Hacerte miembro", url: "/comunidad", image: null },
    ],
    about: { eyebrow: "Sobre mí", title: first ? `Hola, soy ${first}` : "Sobre mí", text: "", url: "/sobre-mi", image: null, linkLabel: "Conoce mi historia" },
    readings: { reading: { ...READINGS_DEFAULTS.reading }, session: { ...READINGS_DEFAULTS.session }, circlesTitle: READINGS_DEFAULTS.circlesTitle },
  };
}

/** Lista guardada leída elemento a elemento: uno estropeado se descarta sin tumbar la página. */
function readList<T>(raw: unknown, schema: z.ZodType<T, z.ZodTypeDef, unknown>, max: number): T[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
    if (out.length >= max) break;
  }
  return out;
}

function readObject<T>(raw: unknown, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T | null | undefined {
  if (raw === undefined) return undefined;
  const r = schema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Lee el JSON guardado tolerando datos antiguos o incompletos. */
export function readPageConfig(raw: unknown, fallbackName = "Mi página"): PageConfig {
  // Bloque a bloque: uno dañado (o de una versión futura) se descarta sin tumbar la página entera. Igual
  // las burbujas, los sistemas, la tarjeta «Sobre mí» y las lecturas.
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    raw = {
      ...r,
      ...("blocks" in r ? { blocks: readBlocks(r.blocks, homeBlockSchema, TEXT_BLOCKS_MAX) } : {}),
      ...("bubbles" in r ? { bubbles: readList(r.bubbles, bubbleSchema, BUBBLES_MAX) } : {}),
      ...("systems" in r ? { systems: readList(r.systems, systemSchema, SYSTEMS_MAX) } : {}),
      ...("about" in r ? { about: readObject(r.about, aboutSchema) } : {}),
      ...("readings" in r ? { readings: readObject(r.readings, readingsSchema) } : {}),
    };
  }
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
 * la página (p. ej. Actualidades, el Portal de Noticias u Ofertas) entra visible justo detrás de la que
 * la precede en el orden por defecto: no pinta nada hasta que tenga contenido, y así aparece sola en
 * cuanto se publica la primera actualidad, el primer elemento del portal o la primera oferta.
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
    out.splice(at, 0, { key, enabled: !DEFAULT_OFF_SECTIONS.has(key) });
  });
  return out;
}

/** Bloques que se ven en la página (visibles y con algo que mostrar). */
export function visibleTextBlocks(cfg: Pick<PageConfig, "blocks">): ContentBlock[] {
  return visibleBlocks(cfg.blocks);
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
