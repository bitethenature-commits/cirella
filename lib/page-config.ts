import { z } from "zod";
import { contentBlockSchema, GEOMETRY_FIGURES, HOME_BLOCKS_MAX, HOME_TEXT_MAX, readBlocks, visibleBlocks, type ContentBlock } from "./page-blocks";
import { readPieces, piecesSchema } from "./pieces";
import { legacyDesign } from "./legacy-looks";
import { BUTTON_FRAME_KEYS, CARD_FRAME_KEYS } from "./frames";
import { DECOR_KEYS, FONT_KEYS, type Design } from "./templates";
import { readSiteTexts, SITE_TEXT_MAX } from "./site-texts";
import { FIGURE_POS_KEYS } from "./sacred-figures";

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
  "gifts",
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
  posts: { label: "Actualidades", defaultTitle: "Actualidades", hint: "Se llena sola con lo nuevo del último mes (cursos, lecturas, sesiones, membresías, códigos y el círculo de la luna): salen 3 y el resto en su página" },
  portal: { label: "Portal de Noticias", defaultTitle: "Portal de Noticias", hint: "Para quien se suscribe a tu newsletter: el audio de arriba y 1 noticia, con «Ver más noticias»" },
  gifts: { label: "Gifts", defaultTitle: "Gifts", hint: "Lo que haces para regalar (calendarios, manualidades…): se edita en Páginas → Gifts" },
  offers: { label: "Ofertas", defaultTitle: "Ofertas", hint: "1 oferta y «Ver más ofertas»; cuando una oferta termina, desaparece sola" },
  about: { label: "Sobre mí", defaultTitle: "", hint: "Tarjeta con tu foto que lleva a tu página «Sobre mí»" },
  systems: { label: "Sistemas", defaultTitle: "Sistemas con los que trabajo", hint: "Tarjetas que llevan a la página de cada método" },
  readings: { label: "Lecturas, sesiones y círculos", defaultTitle: "Lecturas, sesiones y círculos", hint: "Cómo se reserva cada cosa y los 2 próximos círculos de la luna (nueva, llena o eclipse)" },
  blocks: { label: "Bloques", defaultTitle: "", hint: "Textos, imágenes, galerías y vídeos" },
  products: { label: "Productos digitales", defaultTitle: "Lecturas y recursos", hint: "PDF, audios, guías…" },
  sessions: { label: "Sesiones y servicios", defaultTitle: "Sesiones", hint: "Reservas 1:1 y talleres" },
  courses: { label: "Cursos", defaultTitle: "Cursos", hint: "Hasta 3 cursos; si hay más, «Ver todos los cursos» los agrupa por método" },
  memberships: { label: "Comunidad", defaultTitle: "Comunidad", hint: "Tus membresías" },
  codes: { label: "Códigos de descuento", defaultTitle: "Códigos de descuento", hint: "Descuentos en marcas que recomiendas" },
  testimonials: { label: "Testimonios", defaultTitle: "Voces del camino", hint: "Opiniones de clientas, que van pasando una a una" },
  faq: { label: "Preguntas frecuentes", defaultTitle: "Preguntas frecuentes", hint: "Resuelve dudas antes de comprar" },
  newsletter: { label: "Newsletter", defaultTitle: "Recibe mi newsletter", hint: "Ya no se usa: el formulario sale debajo de «Hablemos» y en el pie" },
  contact: { label: "Contacto", defaultTitle: "Hablemos", hint: "Tu email y, debajo, el formulario de la newsletter" },
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
    text: "Me das tus datos y te la envío por email, grabada o en PDF.",
    steps: [
      "Elige la lectura que te llama.",
      "Escríbeme desde su ficha: tu mensaje me llega a mí.",
      "Te respondo por email, me das tus datos y cerramos el pago.",
      "Te la preparo con calma y te la envío por email.",
    ],
  },
  session: {
    eyebrow: "Sesión",
    title: "En directo por Zoom",
    text: "Eliges día y hora y hablamos de tu carta.",
    steps: [
      "Elige la sesión.",
      "Escríbeme y elige el día y la hora que te vayan bien.",
      "Te respondo por email, cerramos el pago y te envío el enlace de Zoom.",
      "Nos vemos en directo por Zoom.",
    ],
  },
  circlesTitle: "Círculos de la luna · sin ser miembro",
};

/** Bloques de la portada (lib/page-blocks.ts): textos, imágenes, galerías, vídeos, foto y texto, tarjetas, citas y trayectorias. */
export const TEXT_BLOCKS_MAX = HOME_BLOCKS_MAX;
export const TEXT_BLOCK_BODY_MAX = HOME_TEXT_MAX;
const homeBlockSchema = contentBlockSchema({ bodyMax: TEXT_BLOCK_BODY_MAX });

export const SOCIAL_KEYS = ["instagram", "tiktok", "telegram", "youtube", "email", "website"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const SOCIAL_LABEL: Record<SocialKey, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  telegram: "Telegram",
  youtube: "YouTube",
  email: "Email",
  website: "Web",
};

/** Solo las redes que existen (las de antes, como WhatsApp, se quitan al leer). */
const onlySocialKeys = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => (SOCIAL_KEYS as readonly string[]).includes(k))) : v;

/** Las redes que tiene, en su orden (el que eligió en Mi página y, después, las demás). */
export function socialList(c: { socials: Partial<Record<SocialKey, string>>; socialOrder?: SocialKey[] }): SocialKey[] {
  return [...new Set([...(c.socialOrder ?? []), ...SOCIAL_KEYS])].filter((k) => c.socials[k]?.trim());
}

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

/* El diseño (lib/templates.ts, Design): cada pieza opcional; lo que falta sale del diseño de base. */
const num = (min: number, max: number) => z.number().int().min(min).max(max).nullable().optional();
const flag = z.boolean().nullable().optional();
const shadow = z.enum(["none", "soft", "strong", "glow"]).nullable().optional();
export const designSchema = z.object({
  background: color,
  bg2: color,
  text: color,
  muted: color,
  accent: color,
  accentText: color,
  gold: color,
  bgType: z.enum(["solid", "gradient", "radial"]).nullable().optional(),
  bgAngle: num(0, 360),
  backgroundImageUrl: z.string().max(500).nullable().optional(),
  bgImageOpacity: num(0, 100),
  decor: z.enum(DECOR_KEYS).nullable().optional(),
  decorOpacity: num(0, 100),
  decorColor: color,
  decorAlways: flag,
  fontDisplay: z.enum(FONT_KEYS).nullable().optional(),
  fontBody: z.enum(FONT_KEYS).nullable().optional(),
  displayWeight: num(100, 900),
  displayItalic: flag,
  displayUpper: flag,
  displaySpacing: num(-10, 40),
  displaySize: num(60, 160),
  cardStyle: z.enum(["glass", "solid", "outline", "editorial"]).nullable().optional(),
  cardCustom: flag,
  cardBg: color,
  cardBgOpacity: num(0, 100),
  cardBorder: color,
  cardBorderWidth: num(0, 6),
  cardRadius: num(0, 60),
  cardShadow: shadow,
  cardDouble: flag,
  cardBlur: flag,
  cardFrame: z.enum(CARD_FRAME_KEYS).nullable().optional(),
  cardFrameColor: color,
  cardFrameSize: num(20, 140),
  btnCustom: flag,
  btnStyle: z.enum(["filled", "outline", "soft"]).nullable().optional(),
  btnBg: color,
  btnText: color,
  btnBorder: color,
  btnBorderWidth: num(0, 6),
  btnRadius: num(0, 60),
  btnFont: z.enum(["body", "display"]).nullable().optional(),
  btnWeight: num(100, 900),
  btnItalic: flag,
  btnUpper: flag,
  btnShadow: shadow,
  btnDouble: flag,
  btnFrame: z.enum(BUTTON_FRAME_KEYS).nullable().optional(),
  btnFrameColor: color,
  imgCustom: flag,
  imgRadius: num(0, 60),
  avatarShape: z.enum(["circle", "rounded", "square"]).nullable().optional(),
  photoShape: z.enum(["rounded", "arch", "oval", "circle"]).nullable().optional(),
  photoFrame: z.enum(["double", "single", "none", "card"]).nullable().optional(),
  panelCustom: flag,
  panelBg: color,
  panelBgOpacity: num(0, 100),
  panelBorder: color,
  panelBorderWidth: num(0, 6),
  panelRadius: num(0, 60),
  panelShadow: shadow,
  panelDouble: flag,
  panelStars: flag,
  panelGeo: z.enum(["keep", "none", ...GEOMETRY_FIGURES]).nullable().optional(),
  panelGeoPos: z.enum(FIGURE_POS_KEYS).nullable().optional(),
  panelGeoOpacity: num(0, 100),
  panelGeoColor: color,
  fontPair: z.string().max(20).nullable().optional(),
  radius: z.string().max(10).nullable().optional(),
}) satisfies z.ZodType<Design, unknown>;
/** Una plantilla de la dueña: su nombre y su diseño completo. */
const savedDesignSchema = z.object({ id: z.string().max(40), name: shortText(60).min(1, "Ponle un nombre"), theme: designSchema });
export const SAVED_DESIGNS_MAX = 40;

/** Un diseño guardado, pieza a pieza: lo que esté estropeado (o sea de otra versión) se ignora. */
export function readDesign(raw: unknown): Design {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, schema] of Object.entries(designSchema.shape)) {
    const v = (raw as Record<string, unknown>)[k];
    if (v === undefined || v === null) continue;
    const r = (schema as z.ZodTypeAny).safeParse(v);
    if (r.success && r.data !== undefined && r.data !== null) out[k] = r.data;
  }
  return out as Design;
}

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
  /** La foto: alta (9:16, la de siempre), retrato (3:4) o cuadrada; a la derecha (la de siempre) o a la izquierda. */
  imageSize: z.enum(["tall", "portrait", "square"]).optional(),
  imageSide: z.enum(["right", "left"]).optional(),
});
const readingsSchema = z.object({ reading: readingCardSchema, session: readingCardSchema, circlesTitle: shortText(80).default("") });

export const pageConfigSchema = z.object({
  displayName: shortText(80).min(1, "Escribe tu nombre"),
  tagline: shortText(120).default(""),
  headline: shortText(140).default(""),
  bio: shortText(600).default(""),
  avatarUrl: z.string().max(500).nullable().default(null),
  coverUrl: z.string().max(500).nullable().default(null),
  /** De antes (la plantilla de fábrica): ya no cuenta, todo el diseño va en `theme`. */
  template: z.string().max(40).default("custom"),
  /** El diseño de toda la web (Panel › Mi página › Diseño). */
  theme: designSchema.default({}),
  /** Los cambios de diseño de cada página, encima del de la web: «home» (portada), «cursos», «uno-a-uno», el slug de una página… */
  pageThemes: z.record(z.string().max(80), designSchema).default({}),
  /** Piezas sueltas con su propio aspecto (una tarjeta, un panel o un botón), página a página (lib/pieces.ts). */
  pieces: piecesSchema.default({}),
  /** El diseño propio de cada sección de la portada («header», la cabecera, o su clave), encima del de la portada. */
  sectionThemes: z.record(z.string().max(80), designSchema).optional(),
  /** Las plantillas que ha creado la dueña. */
  designs: z.array(savedDesignSchema).max(SAVED_DESIGNS_MAX).default([]),
  sections: z
    .array(z.object({ key: z.enum(SECTION_KEYS), enabled: z.boolean(), title: shortText(60).optional(), /** Quitada en Mi página (vuelve con el +, con lo que tenía). */ removed: z.boolean().optional() }))
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
  socials: z.preprocess(onlySocialKeys, z.partialRecord(z.enum(SOCIAL_KEYS), shortText(200))).default({}),
  /** El orden de las redes bajo su presentación (las que no están, detrás). */
  socialOrder: z.preprocess((v) => (Array.isArray(v) ? v.filter((k) => (SOCIAL_KEYS as readonly string[]).includes(k)) : v), z.array(z.enum(SOCIAL_KEYS)).max(SOCIAL_KEYS.length)).optional(),
  testimonials: z
    .array(z.object({ id: z.string().max(40), author: shortText(80), role: shortText(80).optional(), quote: shortText(500) }))
    .max(12)
    .default([]),
  faqs: z
    .array(z.object({ id: z.string().max(40), q: shortText(200), a: shortText(1000) }))
    .max(20)
    .default([]),
  contact: z
    .object({ email: shortText(200).optional(), message: shortText(300).optional() })
    .default({}),
  // Bloques de la portada: texto con formato, imagen, galería, vídeo, foto y texto, tarjetas, cita y
  // trayectoria (lib/page-blocks.ts). Los de antes (sin `kind`) son de texto.
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
  // Los textos fijos de la web que ha cambiado en el Canva (lib/site-texts.ts): valen para todas sus páginas.
  texts: z.record(z.string().max(40), shortText(SITE_TEXT_MAX)).optional(),
});

export type PageConfig = z.infer<typeof pageConfigSchema>;
/** Alias de antes: los bloques de la portada ya no son solo de texto. */
export type TextBlock = ContentBlock;
export type ThemeConfig = PageConfig["theme"];

export function defaultSections(): PageConfig["sections"] {
  return SECTION_KEYS.map((key) => ({ key, enabled: !DEFAULT_OFF_SECTIONS.has(key) }));
}

export function defaultPageConfig(input: { displayName: string; tagline?: string; bio?: string; personal?: boolean }): PageConfig {
  return pageConfigSchema.parse({
    displayName: input.displayName.trim() || "Mi página",
    tagline: input.tagline ?? "",
    bio: input.bio ?? "",
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
      { id: "b-sobre-mi", label: "Sobre mí", url: "/aboutme", image: null },
      { id: "b-cursos", label: "Cursos", url: "/courses", image: null },
      { id: "b-comunidad", label: "Hacerte miembro", url: "/membership", image: null },
    ],
    about: { eyebrow: "Sobre mí", title: first ? `Hola, soy ${first}` : "Sobre mí", text: "", url: "/aboutme", image: null, linkLabel: "Conoce mi historia" },
    readings: { reading: { ...READINGS_DEFAULTS.reading }, session: { ...READINGS_DEFAULTS.session }, circlesTitle: READINGS_DEFAULTS.circlesTitle },
  };
}

function readPageThemes(raw: unknown): Record<string, Design> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, Design> = {};
  for (const [k, v] of Object.entries(raw)) if (k.length <= 80) out[k] = readDesign(v);
  return out;
}

/** El diseño de una página: el de la web con los cambios de esa página encima. */
export function designFor(cfg: Pick<PageConfig, "theme"> & Partial<Pick<PageConfig, "pageThemes">>, page?: string | null): Design {
  const extra = page ? cfg.pageThemes?.[page] : undefined;
  if (!extra) return cfg.theme;
  const own = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== null));
  return { ...cfg.theme, ...own };
}

/** Lista guardada leída elemento a elemento: uno estropeado se descarta sin tumbar la página. */
function readList<T>(raw: unknown, schema: z.ZodType<T, unknown>, max: number): T[] | undefined {
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

function readObject<T>(raw: unknown, schema: z.ZodType<T, unknown>): T | null | undefined {
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
      // El diseño, pieza a pieza; una página guardada con una plantilla de antes pasa a su diseño propio.
      template: "custom",
      theme: legacyDesign(r.template, r.theme) ?? readDesign(r.theme),
      pageThemes: readPageThemes(r.pageThemes),
      sectionThemes: readPageThemes(r.sectionThemes),
      pieces: readPieces(r.pieces),
      texts: readSiteTexts(r.texts),
      ...("designs" in r ? { designs: readList(r.designs, savedDesignSchema, SAVED_DESIGNS_MAX) } : {}),
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

/** Lo que va en la portada, en su orden: sus secciones y, entre ellas, sus bloques (Texto, Tarjetas, Cita…). */
export type HomeItem = { kind: "section"; key: SectionKey } | { kind: "block"; block: ContentBlock };

/**
 * La portada en su orden (sin «links», que va siempre arriba, ni la antigua sección «Bloques»): cada bloque va
 * delante de la sección que dice su `at` («end», al final). Los de antes (sin `at`) van donde estaba «Bloques» y,
 * si esa sección estaba oculta, ocultos. Las secciones quitadas no salen, pero sus bloques siguen en su sitio.
 */
export function homeLayout(cfg: Pick<PageConfig, "sections" | "blocks">): HomeItem[] {
  const keys = cfg.sections.map((s) => s.key);
  const bi = keys.indexOf("blocks");
  const legacyAt = (bi >= 0 ? keys.slice(bi + 1).find((k) => k !== "links") : undefined) ?? "end";
  const legacyOn = cfg.sections.find((s) => s.key === "blocks")?.enabled !== false;
  const anchor = (b: ContentBlock) => (b.at && (b.at === "end" || (keys as string[]).includes(b.at)) && b.at !== "blocks" && b.at !== "links" ? b.at : legacyAt);
  const blocks = (cfg.blocks ?? []).map((b) => (b.at || legacyOn ? b : { ...b, enabled: false }));
  const out: HomeItem[] = [];
  const blocksAt = (at: string) => blocks.filter((b) => anchor(b) === at).forEach((block) => out.push({ kind: "block", block }));
  for (const s of cfg.sections) {
    if (s.key === "links" || s.key === "blocks") continue;
    blocksAt(s.key);
    if (!s.removed) out.push({ kind: "section", key: s.key });
  }
  blocksAt("end");
  return out;
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
