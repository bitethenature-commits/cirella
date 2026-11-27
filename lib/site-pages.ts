import { z } from "zod";
import { contentBlockSchema, newBlock, PAGE_BLOCKS_MAX, PAGE_TEXT_MAX, pageImageSchema, readBlocks, type ContentBlock, type PageImage } from "./page-blocks";
import { FOLD_ONLY_PAGES, homeFoldPath, SECTION_PATH, type SectionPage } from "./site-sections";
import { RESERVED_USERNAMES, SITE_PAGE_SLUG_RE, slugify } from "./slug";

/**
 * Páginas extra de la web de una creadora («Sobre mí», «Preguntas frecuentes»…). Puro y seguro en el
 * cliente. Cada página (modelo SitePage) guarda su contenido en JSON, en un borrador y en la versión
 * publicada, como la portada:
 *   · plataforma:   /<usuaria>/p/<slug>
 *   · web personal: /<slug> (middleware.ts → ownerPageRewrite), que es la dirección canónica.
 */

export const SITE_PAGES_MAX = 30;

/**
 * La página «1:1» (/1on1): una página más de Páginas, con su dirección fija (no se cambia ni se
 * borra). Mientras no se publique, la web enseña la 1:1 de siempre (app/[username]/1on1).
 */
export const ONE_TO_ONE_SLUG = "uno-a-uno";

/**
 * «Gifts» (/gifts): lo que hace Cirella para regalar (calendarios, manualidades, detalles para amigos
 * o familia). Una página más de Páginas con su dirección fija; mientras no se publique, la web enseña
 * la de partida (giftsContent). La portada la enseña en su desplegable «Gifts».
 */
export const GIFTS_SLUG = "gifts";

/**
 * «Hacerte miembro» (/membership): los niveles de la comunidad. Una página más de Páginas con su dirección fija, que
 * se escribe en Mi página como la 1:1: su título, su entradilla, sus secciones y, en la sección «Niveles de la
 * comunidad», cada nivel (nombre, precio, icono, lo que incluye, botón) y su diseño (colores y arco).
 */
export const COMMUNITY_SLUG = "comunidad";

/** Páginas con dirección fija: no se cambia ni se borran. */
export const FIXED_PAGE_SLUGS: readonly string[] = [ONE_TO_ONE_SLUG, GIFTS_SLUG, COMMUNITY_SLUG];
export const isFixedPageSlug = (slug: string) => FIXED_PAGE_SLUGS.includes(slug);

/**
 * El contenido de partida de «Hacerte miembro»: lo que enseñaba la página de siempre (su título, su entradilla y la
 * etiqueta del nivel más completo, con sus textos si los había cambiado) y la sección de los niveles.
 */
export function communityContent(t: { title: string; text: string; more: string; badge: string }): SitePageContent {
  const blocks: ContentBlock[] = [{ id: "comunidad-niveles", kind: "tiers", enabled: true, title: "", badge: t.badge }];
  return { title: t.title, subtitle: [t.text, t.more].filter(Boolean).join(" "), cover: null, blocks, seoTitle: "Comunidad", seoDescription: "" };
}

/** Una tarjeta de regalo de partida: su foto y «Pedirlo» por email (con el asunto ya escrito). */
function gift(title: string, text: string, src: string, email: string | null) {
  return {
    image: { src, alt: title, width: 800, height: 1000 },
    title,
    text,
    price: "",
    ...(email ? { href: `mailto:${email}?subject=${encodeURIComponent("Gifts: " + title)}` } : {}),
  };
}

/** El contenido de partida de «Gifts»: los regalos en tarjetas y cómo pedirlos. */
export function giftsContent(email: string | null): SitePageContent {
  const blocks: ContentBlock[] = [
    {
      id: "gifts-intro",
      kind: "text",
      enabled: true,
      look: "bare",
      title: "",
      body: "Pequeñas cosas hechas por mí, con calma y con intención: para ti o para alguien a quien quieres.",
      format: "MD",
    },
    {
      id: "gifts-lista",
      kind: "cards",
      enabled: true,
      look: "bare",
      goldTitle: true,
      title: "Lo que hago para regalar",
      cards: [
        gift("Calendarios lunares", "El año luna a luna: lunas nuevas, llenas y eclipses, para colgar en casa y seguir tu ritmo.", "/demo/gift-calendario.webp", email),
        gift("Manualidades", "Velas, bolsitas de ritual y piezas hechas a mano, una a una.", "/demo/gift-manualidades.webp", email),
        gift("Para regalar", "Detalles para amigos o familia, con su carta y una dedicatoria escrita por mí.", "/demo/gift-regalo.webp", email),
      ],
    },
    {
      id: "gifts-pedir",
      kind: "text",
      enabled: true,
      look: "panel",
      title: "¿Quieres uno?",
      body: "Escríbeme y cuéntame qué te gusta o para quién es. Te respondo yo y lo preparamos juntas.",
      format: "MD",
      ...(email ? { buttonLabel: "Escríbeme", buttonUrl: "mailto:" + email } : {}),
    },
  ];
  return { title: "Gifts", subtitle: "Calendarios, manualidades y regalos para los tuyos, hechos por mí.", cover: null, blocks, seoTitle: "Gifts", seoDescription: "" };
}

/** Lo que enseña el desplegable «Gifts» de la portada: las tarjetas de la página con título (se ven 3 y «Ver más»). */
export type GiftsPreview = { title: string; subtitle: string; items: { title: string; text: string; image: string | null; slug: string }[]; total: number };
export function giftsPreview(content: SitePageContent): GiftsPreview {
  const cards = giftCards(content);
  return {
    title: content.title,
    subtitle: content.subtitle,
    items: cards.map((c) => ({ title: c.title, text: c.text, image: c.image?.src ?? null, slug: c.slug })),
    total: cards.length,
  };
}

/**
 * Los regalos de la página «Gifts» (las tarjetas con título), cada uno con su dirección sacada del título
 * (/gifts/calendarios-lunares): la de su página propia. Si dos se llaman igual, el segundo lleva «-2».
 */
export function giftCards(content: SitePageContent) {
  const cards = content.blocks.flatMap((b) => (b.enabled && b.kind === "cards" ? b.cards : [])).filter((c) => c.title.trim());
  const used = new Map<string, number>();
  return cards.map((c) => {
    const base = slugify(c.title) || "regalo";
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return { ...c, slug: n > 1 ? `${base}-${n}` : base };
  });
}

/** El contenido de partida de la 1:1: lo mismo que la 1:1 de siempre, en bloques que se pueden editar. */
export function oneToOneContent(displayName: string, email: string | null): SitePageContent {
  const first = (displayName.trim().split(" ")[0] || displayName).toUpperCase();
  const blocks: ContentBlock[] = [
    {
      id: "uno-intro",
      kind: "text",
      enabled: true,
      look: "bare",
      title: "",
      body: "Durante un tiempo caminamos juntas, tú y yo. Partimos de dónde estás hoy y, paso a paso, vamos leyendo tu mapa hasta que vuelves a reconocerte en él.",
      format: "MD",
    },
    {
      id: "uno-camino",
      kind: "timeline",
      enabled: true,
      look: "panel",
      title: "Cómo es el camino",
      items: [
        { label: "I", title: "Nos conocemos", text: "Una primera conversación tranquila. Me cuentas en qué momento estás, qué te inquieta y qué te gustaría que cambiara. Sin prisa y sin juicio." },
        { label: "II", title: "Leemos tu mapa", text: "Con tu fecha, hora y lugar de nacimiento abrimos tu carta natal, tu Diseño Humano y tus Gene Keys. Es tu mapa: no te dice quién debes ser, te recuerda quién eres." },
        { label: "III", title: "Te comprendes", text: "Poco a poco, lo que antes te pesaba empieza a tener sentido: tus ritmos, tu forma de decidir, lo que te da energía y lo que te la quita." },
        { label: "IV", title: "Lo llevas a tu vida", text: "Bajamos lo descubierto a tu día a día, luna a luna: pequeños gestos, rituales sencillos y decisiones concretas que puedes sostener." },
        { label: "V", title: "Eliges desde ti", text: "Llega un momento en que ya no necesitas que nadie te lo explique. Te escuchas, confías en tu manera de hacer y caminas a tu ritmo." },
      ],
    },
    {
      id: "uno-llevas",
      kind: "cards",
      enabled: true,
      look: "bare",
      goldTitle: true,
      title: "Lo que te llevas",
      cards: [
        { image: null, title: "Claridad", text: "Entiendes por qué sientes y actúas como lo haces." },
        { image: null, title: "Calma", text: "Dejas de luchar contra tu propia naturaleza." },
        { image: null, title: "Dirección", text: "Sabes hacia dónde ir y cómo dar el siguiente paso." },
      ],
    },
    {
      id: "uno-para-ti",
      kind: "text",
      enabled: true,
      look: "panel",
      title: "Es para ti si…",
      body: [
        "- Sientes que vives con el piloto automático y quieres volver a escucharte.",
        "- Estás ante una decisión importante y quieres tomarla desde ti.",
        "- Te interesa la astrología, el Diseño Humano o las Gene Keys, pero no sabes por dónde empezar.",
        "- Buscas un espacio solo para ti, con tiempo y con alguien que te acompañe.",
      ].join(String.fromCharCode(10)),
      format: "MD",
    },
    { id: "uno-frase", kind: "quote", enabled: true, look: "bare", text: "No vengo a decirte quién eres. Vengo a acompañarte mientras lo recuerdas.", author: first },
    {
      id: "uno-empezamos",
      kind: "text",
      enabled: true,
      look: "panel",
      title: "¿Empezamos tu camino?",
      body: "Escríbeme y cuéntame en qué momento estás. Te respondo yo, personalmente, y vemos juntas si este camino es para ti.",
      format: "MD",
      ...(email ? { buttonLabel: "Escríbeme", buttonUrl: "mailto:" + email } : {}),
    },
  ];
  return { title: "Un camino para descubrirte", subtitle: "No es una sesión suelta: es un viaje contigo.", cover: null, blocks, seoTitle: "1:1", seoDescription: "" };
}
/** Minúsculas, números y guiones; sin puntos ni guiones bajos (nunca parece un archivo ni una ruta interna). */
export { SITE_PAGE_SLUG_RE };
export const SITE_PAGE_TITLE_MAX = 120;

const pageBlockSchema = contentBlockSchema({ bodyMax: PAGE_TEXT_MAX });
const shortText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

export const sitePageContentSchema = z.object({
  title: shortText(SITE_PAGE_TITLE_MAX).min(1, "Escribe el título de la página"),
  subtitle: shortText(600).default(""),
  /** Imagen de cabecera (también la de redes si la hay). */
  cover: pageImageSchema.nullable().default(null),
  blocks: z.array(pageBlockSchema).max(PAGE_BLOCKS_MAX, `Máximo ${PAGE_BLOCKS_MAX} bloques`).default([]),
  /** Cómo se ve al compartir y en Google (vacío = el título y el subtítulo). */
  seoTitle: shortText(70).default(""),
  seoDescription: shortText(160).default(""),
});
export type SitePageContent = {
  title: string;
  subtitle: string;
  cover: PageImage | null;
  blocks: ContentBlock[];
  seoTitle: string;
  seoDescription: string;
};

/** Lee el JSON guardado sin fallar: los bloques que no valen se descartan uno a uno. */
export function readSitePageContent(raw: unknown, fallbackTitle: string): SitePageContent {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const field = <T>(schema: z.ZodType<T, unknown>, v: unknown, fallback: T): T => {
    const r = schema.safeParse(v);
    return r.success ? r.data : fallback;
  };
  return {
    title: field(sitePageContentSchema.shape.title, obj.title, "") || fallbackTitle.slice(0, SITE_PAGE_TITLE_MAX) || "Página",
    subtitle: field(sitePageContentSchema.shape.subtitle, obj.subtitle, ""),
    cover: field(sitePageContentSchema.shape.cover, obj.cover, null),
    blocks: readBlocks(obj.blocks, pageBlockSchema, PAGE_BLOCKS_MAX),
    seoTitle: field(sitePageContentSchema.shape.seoTitle, obj.seoTitle, ""),
    seoDescription: field(sitePageContentSchema.shape.seoDescription, obj.seoDescription, ""),
  };
}

/** Dirección de una página extra (la canónica). */
export function sitePagePath(username: string, slug: string, personal: boolean): string {
  // Las fijas (1:1, Hacerte miembro, Gifts) viven en su sección (/1on1, /membership, /gifts), no en /p/.
  if (isFixedPageSlug(slug)) {
    // Gifts no tiene página: su desplegable de la portada (cada regalo sí tiene la suya).
    if ((FOLD_ONLY_PAGES as readonly string[]).includes(slug)) return homeFoldPath(username, slug, personal);
    const seg = SECTION_PATH[slug as SectionPage] ?? slug;
    return personal ? `/${seg}` : `/${username}/${seg}`;
  }
  return personal ? `/${slug}` : `/${username}/p/${slug}`;
}

/** Slug base: el escrito a mano o el del título. */
export function sitePageSlugBase(title: string, slug?: string | null): string {
  return slugify(slug || "") || slugify(title) || "pagina";
}

/**
 * ¿Por qué no vale esta dirección? null si vale. Nunca una ruta de la web (RESERVED_USERNAMES:
 * panel, cuenta, entrar, legal, novedades…) ni el usuario de la dueña: en la web personal la página
 * vive en la raíz y taparía esa ruta.
 */
export function sitePageSlugProblem(slug: string, username: string): string | null {
  if (!slug) return "Escribe la dirección de la página";
  if (!SITE_PAGE_SLUG_RE.test(slug)) return "La dirección solo puede llevar letras minúsculas, números y guiones (hasta 60)";
  if (RESERVED_USERNAMES.has(slug) || slug === username.toLowerCase()) return "Esa dirección la usa la web: elige otra";
  return null;
}

export type SitePageState = "DRAFT" | "PUBLISHED" | "CHANGES";

/** Borrador (no se ve), publicada o publicada con cambios en el borrador. */
export function sitePageState(p: { status: string; draft: unknown; published: unknown }): SitePageState {
  if (p.status !== "PUBLISHED" || !p.published) return "DRAFT";
  return JSON.stringify(p.draft) === JSON.stringify(p.published) ? "PUBLISHED" : "CHANGES";
}

export const SITE_PAGE_STATE_LABEL: Record<SitePageState, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  CHANGES: "Cambios sin publicar",
};

// ── Plantillas ──

export const SITE_PAGE_TEMPLATES = ["about", "faq", "blank"] as const;
export type SitePageTemplate = (typeof SITE_PAGE_TEMPLATES)[number];

export const SITE_PAGE_TEMPLATE_META: Record<SitePageTemplate, { label: string; hint: string; title: string }> = {
  about: { label: "Sobre mí", hint: "Tu historia, cómo trabajas y tu formación", title: "Sobre mí" },
  faq: { label: "Preguntas frecuentes", hint: "Las dudas que te hacen antes de comprar o reservar", title: "Preguntas frecuentes" },
  blank: { label: "En blanco", hint: "Empieza desde cero con tus propios bloques", title: "Nueva página" },
};

const text = (id: string, title: string, body: string): ContentBlock => ({ ...(newBlock("text", id) as Extract<ContentBlock, { kind: "text" }>), title, body });

/** Contenido de una página nueva según la plantilla (textos de ejemplo para reescribir). */
export function starterContent(template: SitePageTemplate, title?: string): SitePageContent {
  const t = (title?.trim() || SITE_PAGE_TEMPLATE_META[template].title).slice(0, SITE_PAGE_TITLE_MAX);
  const blocks: ContentBlock[] =
    template === "about"
      ? [
          text("historia", "Mi historia", "Cuenta aquí cómo llegaste a lo que haces y **por qué** te importa."),
          text("como-trabajo", "Cómo trabajo", "- Qué ofreces\n- A quién acompañas\n- Cómo es una sesión contigo"),
          text("formacion", "Mi formación", "Tus estudios, certificaciones y años de experiencia."),
        ]
      : template === "faq"
        ? [
            text("pregunta-1", "¿Cómo funciona una sesión?", "Explica paso a paso qué pasa antes, durante y después."),
            text("pregunta-2", "¿Qué necesito para empezar?", "Lo que tiene que preparar quien te reserva o compra."),
            text("pregunta-3", "¿Puedo cambiar la fecha?", "Tu política de cambios y cancelaciones."),
          ]
        : [];
  return { title: t, subtitle: "", cover: null, blocks, seoTitle: "", seoDescription: "" };
}
