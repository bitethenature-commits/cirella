/**
 * Publicaciones con fecha de la página pública («Actualidades»; antes «Novedades», el modelo sigue
 * siendo Post): validación del formulario del panel,
 * estado público y textos derivados. Puro (sin BD): lo usan las acciones del panel, las páginas
 * públicas (lib/public.ts) y las pruebas unitarias.
 *
 *   · Borrador (DRAFT): solo lo ve la creadora en la vista previa del panel.
 *   · Publicada (PUBLISHED): se ve desde su fecha de publicación (si se pone una fecha futura,
 *     queda «programada» y aparece sola ese día).
 */
import { z } from "zod";
import { parseTextFormat, plainText, richToPlain, truncateWords } from "./rich-text";
import { slugify } from "./slug";
import { dateKeyInTz, formatInTz, zonedTimeToUtc } from "./tz";

export const POST_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_TITLE_MAX = 140;
export const POST_EXCERPT_MAX = 300;
export const POST_BODY_MAX = 20_000;
/** Publicaciones en la sección «Actualidades» de la portada (tarjetas verticales). */
export const POSTS_ON_PAGE = 2;
/** Publicaciones por página en /<usuaria>/news (agrupadas por mes). */
export const POSTS_PER_PAGE = 24;
/** Texto del botón de una publicación (llamada a la acción) y su código de descuento. */
export const POST_CTA_LABEL_MAX = 40;
export const POST_CTA_CODE_MAX = 30;

/** Vídeo o audio de una publicación (Post.mediaKind + Post.media). */
export const POST_MEDIA_KINDS = ["VIDEO", "AUDIO"] as const;
export type PostMediaKind = (typeof POST_MEDIA_KINDS)[number];

const optionalText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .optional()
    .transform((v) => v || null);

/** Formulario del panel (FormData → objeto). La fecha llega como «AAAA-MM-DD» (input date). */
export const postFormSchema = z.object({
  id: z.string().max(40).optional(),
  title: z.string().trim().min(3, "Escribe un título (mínimo 3 caracteres)").max(POST_TITLE_MAX, `El título admite ${POST_TITLE_MAX} caracteres`),
  slug: z.string().trim().max(80).optional(),
  excerpt: optionalText(POST_EXCERPT_MAX, `El extracto admite ${POST_EXCERPT_MAX} caracteres`),
  body: z.string().trim().min(1, "Escribe el texto de la publicación").max(POST_BODY_MAX, `El texto admite ${POST_BODY_MAX.toLocaleString("es-ES")} caracteres`),
  // Formato del texto (lib/rich-text.ts): tolerante, "" o desconocido = texto de antes; ausente = el guardado.
  bodyFormat: z.string().max(8).optional().transform(parseTextFormat),
  imageUrl: z.string().max(500).optional(),
  status: z.enum(POST_STATUSES, { error: "Elige si es un borrador o se publica" }),
  publishedOn: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "La fecha no es válida")
    .optional(),
  // Vídeo o audio (subido a la web personal o un enlace de YouTube/Vimeo): JSON de lib/posts.ts → readPostMedia.
  media: z.string().max(4000).optional(),
  // Llamada a la acción: texto, enlace (producto, página o web) y código de descuento opcional.
  ctaLabel: optionalText(POST_CTA_LABEL_MAX, `El texto del botón admite ${POST_CTA_LABEL_MAX} caracteres`),
  ctaUrl: z
    .string()
    .trim()
    .max(500, "El enlace es demasiado largo")
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v) || /^\/[^\s/][^\s]*$/.test(v) || v === "/", "El enlace del botón debe empezar por https:// o ser una página de tu web (/…)"),
  ctaCode: optionalText(POST_CTA_CODE_MAX, `El código admite ${POST_CTA_CODE_MAX} caracteres`).transform((v) => (v ? v.replace(/\s+/g, "").toUpperCase() : null)),
});
export type PostForm = z.infer<typeof postFormSchema>;

/** Solo imágenes subidas aquí (o las de la demo): nunca una URL de fuera en la página. */
export function ownImageUrl(u: string | null | undefined): string | null {
  return u && (u.startsWith("/media/") || u.startsWith("/demo/")) && !u.includes("..") ? u : null;
}

/** Slug base de una publicación: el escrito a mano o el del título. */
export function postSlugBase(title: string, slug?: string | null): string {
  return slugify(slug || "") || slugify(title) || "publicacion";
}

/**
 * Fecha de publicación que se guarda:
 *   · borrador: la elegida (o null) — no se ve hasta publicarla;
 *   · publicada: la elegida (a las 9:00 en la zona de la creadora; hoy → ahora mismo), o la que ya
 *     tenía, o ahora.
 * Si la fecha llega vacía del formulario (`publishedOn: ""`), solo se conserva la que ya tenía si es
 * pasada; una futura se descarta. Sin `publishedOn` (botón de la lista) se conserva tal cual.
 */
export function resolvePublishedAt(input: {
  status: PostStatus;
  publishedOn?: string | null;
  current: Date | null;
  timeZone: string;
  now?: Date;
}): Date | null {
  const now = input.now ?? new Date();
  const day = input.publishedOn?.trim();
  if (day) {
    if (day === dateKeyInTz(now, input.timeZone)) {
      // Hoy: si ya estaba publicada hoy, conserva la hora; si no, ahora.
      return input.current && dateKeyInTz(input.current, input.timeZone) === day ? input.current : now;
    }
    if (input.current && dateKeyInTz(input.current, input.timeZone) === day) return input.current;
    return zonedTimeToUtc(day, 9 * 60, input.timeZone);
  }
  // Fecha vaciada en el formulario: no se conserva una fecha futura (sería programarla sin querer).
  const keep = input.publishedOn === "" ? (input.current && input.current <= now ? input.current : null) : input.current;
  if (input.status === "DRAFT") return keep;
  return keep ?? now;
}

/** ¿Se ve en la página pública? */
export function isPostPublic(p: { status: string; publishedAt: Date | null }, now = new Date()): boolean {
  return p.status === "PUBLISHED" && !!p.publishedAt && p.publishedAt <= now;
}

/** Filtro de Prisma de las publicaciones visibles (combínalo con el creatorId o tenantDb). */
export function publicPostWhere(now = new Date()) {
  return { status: "PUBLISHED", publishedAt: { lte: now } } as const;
}

export type PostState = "DRAFT" | "SCHEDULED" | "PUBLISHED";

export function postState(p: { status: string; publishedAt: Date | null }, now = new Date()): PostState {
  if (p.status !== "PUBLISHED") return "DRAFT";
  return isPostPublic(p, now) ? "PUBLISHED" : "SCHEDULED";
}

export const POST_STATE_LABEL: Record<PostState, string> = {
  DRAFT: "Borrador",
  SCHEDULED: "Programada",
  PUBLISHED: "Publicada",
};

/** Extracto para tarjetas y SEO: el escrito o el principio del texto. */
export function postExcerpt(p: { excerpt: string | null; body: string; bodyFormat?: string | null }, max = 180): string {
  return p.excerpt?.trim() ? truncateWords(p.excerpt, max) : truncateWords(plainText(richToPlain(p.body, p.bodyFormat)), max);
}

/** Minutos de lectura (≈ 200 palabras por minuto; mínimo 1). */
export function readingMinutes(body: string, format?: string | null): number {
  const words = plainText(richToPlain(body, format)).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Una publicación: /news/<publicación> en la web personal (sin el usuario delante), /<usuaria>/news/<publicación> en la plataforma. */
export function postPath(username: string, slug: string): string {
  return process.env.NEXT_PUBLIC_SITE_MODE?.trim() === "personal" ? `/news/${slug}` : `/${username}/news/${slug}`;
}

/** Lista pública de publicaciones (la página «Actualidades»). */
export function postsListPath(username: string, personal = false): string {
  return personal ? "/news" : `/${username}/news`;
}

/** Vídeo o audio de una publicación: un archivo subido (/media/video/…) o un enlace de YouTube/Vimeo. */
export type PostMedia =
  | { kind: "VIDEO"; src: string; poster?: string | null; width?: number | null; height?: number | null; durationSec?: number | null }
  | { kind: "VIDEO"; embedUrl: string }
  | { kind: "AUDIO"; src: string; durationSec?: number | null };

const OWN_MEDIA = /^\/media\/video\/[a-z0-9]{10,40}\/[a-f0-9]{24}\.(mp4|mov|m4v|m4a|mp3|wav)$/;
const EMBED = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\/[^\s]+$/i;

/** Lee Post.media (o el JSON del formulario) sin fallar: lo que no es de aquí o no se entiende es «sin vídeo ni audio». */
export function readPostMedia(kind: string | null | undefined, raw: unknown, creatorId?: string): PostMedia | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const own = (src: unknown) => typeof src === "string" && OWN_MEDIA.test(src) && (!creatorId || src.split("/")[3] === creatorId);
  const k = kind ?? (typeof o.kind === "string" ? o.kind : null);
  if (k === "VIDEO") {
    if (typeof o.embedUrl === "string" && EMBED.test(o.embedUrl.trim())) return { kind: "VIDEO", embedUrl: o.embedUrl.trim() };
    if (own(o.src) && /\.(mp4|mov|m4v)$/.test(o.src as string))
      return { kind: "VIDEO", src: o.src as string, poster: typeof o.poster === "string" && o.poster.startsWith("/media/") ? o.poster : null, width: num(o.width), height: num(o.height), durationSec: num(o.durationSec) };
    return null;
  }
  if (k === "AUDIO" && own(o.src) && /\.(m4a|mp3|wav)$/.test(o.src as string)) return { kind: "AUDIO", src: o.src as string, durationSec: num(o.durationSec) };
  return null;
}

/** Fecha grande de las tarjetas («05» y «nov»), en la zona de la creadora. */
export function postDateBadge(d: Date, timeZone: string): { day: string; month: string } {
  return {
    day: formatInTz(d, timeZone, { day: "2-digit" }),
    month: formatInTz(d, timeZone, { month: "short" }).replace(/\./g, ""),
  };
}

/**
 * Publicaciones agrupadas por mes y año («Noviembre de 2026»), de la más nueva a la más antigua, en la
 * zona de la creadora. Respeta el orden recibido dentro de cada mes.
 */
export function groupPostsByMonth<T extends { publishedAt: Date }>(posts: T[], timeZone: string): { key: string; label: string; posts: T[] }[] {
  const groups: { key: string; label: string; posts: T[] }[] = [];
  for (const p of posts) {
    const key = dateKeyInTz(p.publishedAt, timeZone).slice(0, 7);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const label = formatInTz(p.publishedAt, timeZone, { month: "long", year: "numeric" });
      g = { key, label: label.charAt(0).toUpperCase() + label.slice(1), posts: [] };
      groups.push(g);
    }
    g.posts.push(p);
  }
  return groups.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}
