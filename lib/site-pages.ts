import { z } from "zod";
import { contentBlockSchema, newBlock, PAGE_BLOCKS_MAX, PAGE_TEXT_MAX, pageImageSchema, readBlocks, type ContentBlock, type PageImage } from "./page-blocks";
import { RESERVED_USERNAMES, SITE_PAGE_SLUG_RE, slugify } from "./slug";

/**
 * Páginas extra de la web de una creadora («Sobre mí», «Preguntas frecuentes»…). Puro y seguro en el
 * cliente. Cada página (modelo SitePage) guarda su contenido en JSON, en un borrador y en la versión
 * publicada, como la portada:
 *   · plataforma:   /<usuaria>/p/<slug>
 *   · web personal: /<slug> (middleware.ts → ownerPageRewrite), que es la dirección canónica.
 */

export const SITE_PAGES_MAX = 30;
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
  const field = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, v: unknown, fallback: T): T => {
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
