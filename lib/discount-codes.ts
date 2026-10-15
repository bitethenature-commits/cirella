/**
 * Códigos de descuento de otras marcas que la creadora recomienda en su página («Códigos de
 * descuento»): validación del formulario del panel, caducidad y visibilidad. Puro (sin BD).
 *
 *   · Se ven si están activos y no han caducado. La caducidad es un día (en la zona horaria de la
 *     creadora): el código vale hasta el final de ese día.
 *   · El enlace a la tienda es obligatorio y con https.
 */
import { z } from "zod";
import { addDaysToKey, dateKeyInTz, formatInTz, zonedTimeToUtc } from "./tz";

export const CODE_BRAND_MAX = 60;
export const CODE_CODE_MAX = 40;
export const CODE_DESCRIPTION_MAX = 200;
export const CODE_URL_MAX = 500;

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

/** «Válido hasta el 31 de diciembre» (último día en que vale). null si no caduca. */
export function expiryLabel(expiresAt: Date | null, timeZone: string): string | null {
  if (!expiresAt) return null;
  return `Válido hasta el ${formatInTz(new Date(expiresAt.getTime() - 1), timeZone, { day: "numeric", month: "long" })}`;
}

/** «tienda.com» de «https://www.tienda.com/…». */
export function shopHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
