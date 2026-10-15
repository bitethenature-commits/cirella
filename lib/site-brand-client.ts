/**
 * Marca del sitio para los componentes del navegador (páginas de error), en funciones puras.
 *
 * Los error.tsx son componentes cliente y no reciben datos del servidor: el layout raíz les pasa,
 * solo en modo personal, el nombre y la foto de la dueña (components/site-brand-context.tsx).
 * En la plataforma no se pasa nada y se pinta el logo de siempre.
 */
import type { SiteBrand } from "./site-brand";

/** null = plataforma (logo de siempre). En modo personal, nunca la marca de la plataforma. */
export type ClientSiteBrand = { name: string; avatarUrl: string | null } | null;

/**
 * Lo que necesita el navegador. En modo personal, si la dueña aún no tiene cuenta (o falla la BD),
 * nombre vacío: sin símbolo, antes que el de la plataforma (resolveSiteBrand cae en su nombre).
 */
export function toClientSiteBrand(personal: boolean, brand: SiteBrand | null): ClientSiteBrand {
  if (!personal) return null;
  if (!brand?.personal || !brand.ownerUsername) return { name: "", avatarUrl: null };
  return { name: brand.name, avatarUrl: brand.avatarUrl };
}

/**
 * Modo del sitio visto desde el navegador, donde no hay process.env del servidor: Next solo
 * incrusta las variables NEXT_PUBLIC_* al compilar (next.config.ts la copia de SITE_MODE).
 * Lo usa app/global-error.tsx, que sustituye al layout raíz y no tiene otra forma de saberlo.
 */
export function isPersonalModeInBrowser(value: string | undefined = process.env.NEXT_PUBLIC_SITE_MODE): boolean {
  return value?.trim() === "personal";
}

/** Título del error de último recurso: sin «Cirella» en la web personal. */
export function globalErrorTitle(personal: boolean): string {
  return personal ? "Esta web no está disponible en este momento" : "Cirella no está disponible en este momento";
}
