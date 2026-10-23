/**
 * URLs de las imágenes públicas (avatar, portada, productos). Puro y sin dependencias de Node:
 * lo usan tanto el servidor como los componentes del navegador.
 *
 * Cada imagen subida se guarda como /media/{creadora}/{id}.webp (máx. 1600 px) más tres
 * variantes {id}-w400.webp, -w800 y -w1200 para que el móvil descargue solo lo que necesita.
 * Las imágenes de /demo/ y las subidas antiguas (.jpg, .png…) no tienen variantes.
 */
export const MEDIA_MAX_WIDTH = 1600;
export const MEDIA_VARIANT_WIDTHS = [400, 800, 1200] as const;
export type MediaVariantWidth = (typeof MEDIA_VARIANT_WIDTHS)[number];

const MEDIA_URL_RE = /^\/media\/([a-z0-9]+)\/([a-f0-9]{20})\.webp$/;
const MEDIA_PATH_RE = /^[a-z0-9]+\/[a-f0-9]{20}(?:-w(?:400|800|1200))?\.webp$|^[a-z0-9]+\/[a-f0-9]+\.(?:jpg|png|webp|gif)$/;

export function mediaUrl(creatorId: string, id: string) {
  return `/media/${creatorId}/${id}.webp`;
}

/** srcset con las variantes de una imagen procesada; undefined si la URL no tiene variantes. */
export function imageSrcSet(url: string | null | undefined): string | undefined {
  if (!url || !MEDIA_URL_RE.test(url)) return undefined;
  const base = url.slice(0, -".webp".length);
  return [...MEDIA_VARIANT_WIDTHS.map((w) => `${base}-w${w}.webp ${w}w`), `${url} ${MEDIA_MAX_WIDTH}w`].join(", ");
}

/** Ruta relativa válida bajo /media/ (la que se pide al almacenamiento como public/{ruta}). */
export function isMediaPath(rel: string) {
  return MEDIA_PATH_RE.test(rel);
}

/**
 * ¿Hay que renovar ya una URL firmada de vídeo o audio? Sí cuando le quedan menos de `marginSec`
 * (15 min por defecto). Con el reloj del móvil atrasado respecto a la firma (now < issuedAt), no.
 */
export function needsMediaRefresh(issuedAtMs: number, ttlSec: number, nowMs: number, marginSec = 900): boolean {
  if (nowMs < issuedAtMs) return false;
  return nowMs >= issuedAtMs + (ttlSec - marginSec) * 1000;
}
