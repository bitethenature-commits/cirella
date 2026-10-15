/**
 * Publicaciones con fecha de la página pública («Novedades»): validación del formulario del panel,
 * estado público y textos derivados. Puro (sin BD): lo usan las acciones del panel, las páginas
 * públicas (lib/public.ts) y las pruebas unitarias.
 *
 *   · Borrador (DRAFT): solo lo ve la creadora en la vista previa del panel.
 *   · Publicada (PUBLISHED): se ve desde su fecha de publicación (si se pone una fecha futura,
 *     queda «programada» y aparece sola ese día).
 */
import { z } from "zod";
import { plainText, truncateWords } from "./rich-text";
import { slugify } from "./slug";
import { dateKeyInTz, zonedTimeToUtc } from "./tz";

export const POST_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_TITLE_MAX = 140;
export const POST_EXCERPT_MAX = 300;
export const POST_BODY_MAX = 20_000;
/** Publicaciones en la sección «Novedades» de la página. */
export const POSTS_ON_PAGE = 3;
/** Publicaciones por página en /<usuaria>/novedades. */
export const POSTS_PER_PAGE = 12;

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
  imageUrl: z.string().max(500).optional(),
  status: z.enum(POST_STATUSES, { errorMap: () => ({ message: "Elige si es un borrador o se publica" }) }),
  publishedOn: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "La fecha no es válida")
    .optional(),
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
export function postExcerpt(p: { excerpt: string | null; body: string }, max = 180): string {
  return p.excerpt?.trim() ? truncateWords(p.excerpt, max) : truncateWords(plainText(p.body), max);
}

/** Minutos de lectura (≈ 200 palabras por minuto; mínimo 1). */
export function readingMinutes(body: string): number {
  const words = plainText(body).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function postPath(username: string, slug: string): string {
  return `/${username}/novedades/${slug}`;
}
