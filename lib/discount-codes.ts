/**
 * Códigos de descuento de otras marcas que la creadora recomienda en su página («Códigos de
 * descuento»): validación del formulario del panel, caducidad y visibilidad. Puro (sin BD).
 *
 *   · Se ven si están activos y no han caducado. La caducidad es un día (en la zona horaria de la
 *     creadora): el código vale hasta el final de ese día.
 *   · El enlace a la tienda es obligatorio y con https.
 */
import { z } from "zod";
import { isOwnImageSrc, pageImageSchema } from "./page-blocks";
import { addDaysToKey, dateKeyInTz, formatInTz, zonedParts, zonedTimeToUtc } from "./tz";

export const CODE_BRAND_MAX = 60;
export const CODE_CODE_MAX = 40;
export const CODE_DESCRIPTION_MAX = 200;
export const CODE_URL_MAX = 500;
/** Fotos de lo que recomienda de la marca (se ven al desplegar el código). */
export const CODE_PHOTOS_MAX = 8;

/** Foto de un código: subida aquí (o de la demo), con su texto alternativo y sus medidas. */
export type CodePhoto = { src: string; alt: string; width: number; height: number };

/** Lee DiscountCode.images sin fallar: lo que no vale se descarta. */
export function readCodePhotos(raw: unknown): CodePhoto[] {
  if (!Array.isArray(raw)) return [];
  const out: CodePhoto[] = [];
  for (const x of raw) {
    const r = pageImageSchema.safeParse(x);
    if (r.success) out.push({ src: r.data.src, alt: r.data.alt, width: r.data.width, height: r.data.height });
  }
  return out.slice(0, CODE_PHOTOS_MAX);
}

/** Las fotos que llegan del formulario (JSON): solo imágenes de esta creadora, como mucho CODE_PHOTOS_MAX. */
export function parseCodePhotos(json: string | null | undefined, creatorId: string): { ok: true; photos: CodePhoto[] } | { ok: false; error: string } {
  let raw: unknown = [];
  try {
    raw = json ? JSON.parse(json) : [];
  } catch {
    return { ok: false, error: "No se han podido leer las fotos: vuelve a intentarlo" };
  }
  const r = z.array(pageImageSchema).max(CODE_PHOTOS_MAX, `Como mucho ${CODE_PHOTOS_MAX} fotos por código`).safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  if (r.data.some((p) => !isOwnImageSrc(p.src, creatorId))) return { ok: false, error: "Una foto no es tuya o ya no existe: vuelve a subirla" };
  return { ok: true, photos: r.data.map((p) => ({ src: p.src, alt: p.alt, width: p.width, height: p.height })) };
}

/** «Recomendaciones» de un código: como mucho CODE_RECS_MAX, cada una con su texto y su enlace opcional. */
export const CODE_RECS_MAX = 12;
export const CODE_REC_TEXT_MAX = 120;

/** Una recomendación: lo que se recomienda de la marca y, si hay, el enlace a ese producto (https). */
export type CodeRecommendation = { text: string; url: string | null };

/** Lee DiscountCode.recommendations sin fallar: lo que no vale se descarta. */
export function readCodeRecommendations(raw: unknown): CodeRecommendation[] {
  if (!Array.isArray(raw)) return [];
  const out: CodeRecommendation[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const text = typeof (x as { text?: unknown }).text === "string" ? (x as { text: string }).text.trim().slice(0, CODE_REC_TEXT_MAX) : "";
    if (!text) continue;
    const rawUrl = (x as { url?: unknown }).url;
    const url = typeof rawUrl === "string" && rawUrl ? parseShopUrl(rawUrl) : null;
    out.push({ text, url: url?.ok ? url.url : null });
  }
  return out.slice(0, CODE_RECS_MAX);
}

/** Las recomendaciones que llegan del formulario (JSON): sin filas vacías y con enlaces https válidos. */
export function parseCodeRecommendations(json: string | null | undefined): { ok: true; recommendations: CodeRecommendation[] } | { ok: false; error: string } {
  let raw: unknown = [];
  try {
    raw = json ? JSON.parse(json) : [];
  } catch {
    return { ok: false, error: "No se han podido leer las recomendaciones: vuelve a intentarlo" };
  }
  if (!Array.isArray(raw)) return { ok: false, error: "No se han podido leer las recomendaciones: vuelve a intentarlo" };
  const out: CodeRecommendation[] = [];
  for (const [i, x] of raw.entries()) {
    const text = typeof x?.text === "string" ? x.text.trim() : "";
    const link = typeof x?.url === "string" ? x.url.trim() : "";
    if (!text && !link) continue;
    if (!text) return { ok: false, error: `Escribe el texto de la recomendación ${i + 1} (o quítala)` };
    if (text.length > CODE_REC_TEXT_MAX) return { ok: false, error: `Cada recomendación admite ${CODE_REC_TEXT_MAX} caracteres` };
    let url: string | null = null;
    if (link) {
      const u = parseShopUrl(link);
      if (!u.ok) return { ok: false, error: `Recomendación ${i + 1}: ${u.error.replace("de la tienda", "del producto")}` };
      url = u.url;
    }
    out.push({ text, url });
  }
  if (out.length > CODE_RECS_MAX) return { ok: false, error: `Como mucho ${CODE_RECS_MAX} recomendaciones por código` };
  return { ok: true, recommendations: out };
}

/** Formulario del panel (FormData → objeto). La caducidad llega como «AAAA-MM-DD» (input date) o vacía. */
export const discountCodeFormSchema = z.object({
  id: z.string().max(40).optional(),
  brand: z.string().trim().min(1, "Escribe el nombre de la marca").max(CODE_BRAND_MAX, `La marca admite ${CODE_BRAND_MAX} caracteres`),
  code: z
    .string()
    .trim()
    .min(2, "Escribe el código")
    .max(CODE_CODE_MAX, `El código admite ${CODE_CODE_MAX} caracteres`)
    .regex(/^\S+$/, "El código no puede llevar espacios"),
  description: z
    .string()
    .trim()
    .max(CODE_DESCRIPTION_MAX, `La descripción admite ${CODE_DESCRIPTION_MAX} caracteres`)
    .optional()
    .transform((v) => v || null),
  url: z.string().trim().max(CODE_URL_MAX + 100).optional(),
  imageUrl: z.string().max(500).optional(),
  images: z.string().max(20000).optional(),
  recommendations: z.string().max(20000).optional(),
  expiresOn: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "La fecha de caducidad no es válida")
    .optional(),
  active: z.string().optional(),
});
export type DiscountCodeForm = z.infer<typeof discountCodeFormSchema>;

/** Enlace a la tienda: https obligatoria y un dominio de verdad. */
export function parseShopUrl(raw: string | null | undefined): { ok: true; url: string } | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "Pega el enlace de la tienda (https://…)" };
  if (value.length > CODE_URL_MAX) return { ok: false, error: "El enlace de la tienda es demasiado largo" };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  } catch {
    return { ok: false, error: "El enlace de la tienda no es válido: cópialo entero (https://…)" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "El enlace de la tienda debe empezar por https://" };
  if (!url.hostname.includes(".") || url.username || url.password) return { ok: false, error: "El enlace de la tienda no es válido: cópialo entero (https://…)" };
  return { ok: true, url: url.toString() };
}

/**
 * Caducidad que se guarda: el comienzo del día SIGUIENTE al elegido en la zona de la creadora (el
 * código vale todo el día elegido). null = no caduca.
 */
export function expiryFromDateKey(dateKey: string | null | undefined, timeZone: string): Date | null {
  const day = dateKey?.trim();
  if (!day) return null;
  return zonedTimeToUtc(addDaysToKey(day, 1), 0, timeZone);
}

/** Día elegido («AAAA-MM-DD») a partir de la caducidad guardada (para el formulario). */
export function dateKeyFromExpiry(expiresAt: Date | null, timeZone: string): string {
  if (!expiresAt) return "";
  return dateKeyInTz(new Date(expiresAt.getTime() - 1), timeZone);
}

export function isCodeExpired(c: { expiresAt: Date | null }, now = new Date()): boolean {
  return !!c.expiresAt && c.expiresAt <= now;
}

/** ¿Se ve en la página pública? Activo y sin caducar. */
export function isCodeVisible(c: { active: boolean; expiresAt: Date | null }, now = new Date()): boolean {
  return c.active && !isCodeExpired(c, now);
}

/** Filtro de Prisma de los códigos visibles (combínalo con el creatorId o tenantDb). */
export function visibleCodeWhere(now = new Date()) {
  return { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

export type CodeState = "ACTIVE" | "INACTIVE" | "EXPIRED";

export function codeState(c: { active: boolean; expiresAt: Date | null }, now = new Date()): CodeState {
  if (isCodeExpired(c, now)) return "EXPIRED";
  return c.active ? "ACTIVE" : "INACTIVE";
}

export const CODE_STATE_LABEL: Record<CodeState, string> = {
  ACTIVE: "Visible",
  INACTIVE: "Oculto",
  EXPIRED: "Caducado",
};

/** «Válido hasta el 31 de diciembre» (último día en que vale; con el año si no es el actual). null si no caduca. */
export function expiryLabel(expiresAt: Date | null, timeZone: string, now = new Date()): string | null {
  if (!expiresAt) return null;
  const last = new Date(expiresAt.getTime() - 1);
  const sameYear = zonedParts(last, timeZone).year === zonedParts(now, timeZone).year;
  return `Válido hasta el ${formatInTz(last, timeZone, { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) })}`;
}
