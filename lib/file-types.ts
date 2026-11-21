/**
 * Tipos de archivo que se aceptan, límites de subida y cómo se entrega cada uno. Sin dependencias
 * de servidor: lo usan el panel (accept de los <input type=file>, avisos), las rutas de subida y
 * los visores. lib/storage/index.ts reexporta las tablas para los imports de siempre.
 */

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const PRIVATE_TYPES: Record<string, { ext: string; kind: string }> = {
  "application/pdf": { ext: "pdf", kind: "PDF" },
  "audio/mpeg": { ext: "mp3", kind: "AUDIO" },
  "audio/mp4": { ext: "m4a", kind: "AUDIO" },
  "audio/x-m4a": { ext: "m4a", kind: "AUDIO" },
  "audio/wav": { ext: "wav", kind: "AUDIO" },
  "audio/x-wav": { ext: "wav", kind: "AUDIO" },
  "video/mp4": { ext: "mp4", kind: "VIDEO" },
  // Vídeos del iPhone y del Mac (QuickTime). Se reproducen como MP4 (inlineContentType).
  "video/quicktime": { ext: "mov", kind: "VIDEO" },
  "image/jpeg": { ext: "jpg", kind: "IMAGE" },
  "image/png": { ext: "png", kind: "IMAGE" },
  // Fichas de trabajo exportadas de Canva u otras apps.
  "image/webp": { ext: "webp", kind: "IMAGE" },
  "image/gif": { ext: "gif", kind: "IMAGE" },
  "application/epub+zip": { ext: "epub", kind: "OTHER" },
  "application/zip": { ext: "zip", kind: "OTHER" },
};

/**
 * Tipos que algunos navegadores y sistemas dan a los mismos formatos (Chrome y Edge en Windows
 * llaman «application/x-zip-compressed» al ZIP, otros «audio/wave» al WAV…).
 */
const PRIVATE_TYPE_ALIASES: Record<string, string> = {
  "application/x-zip-compressed": "application/zip",
  "application/x-zip": "application/zip",
  "audio/wave": "audio/wav",
  "audio/vnd.wave": "audio/wav",
  "audio/mp3": "audio/mpeg",
  "audio/x-mpeg": "audio/mpeg",
  "audio/m4a": "audio/mp4",
  "video/x-m4v": "video/mp4",
  "image/jpg": "image/jpeg",
};

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  epub: "application/epub+zip",
  zip: "application/zip",
};

export function mimeFromExt(rel: string) {
  const ext = rel.split(".").pop()?.toLowerCase();
  return EXT_TYPES[ext ?? ""] ?? "application/octet-stream";
}

/**
 * Tipo canónico (clave de PRIVATE_TYPES) de un archivo de producto, o null si no se admite.
 * Si el navegador no sabe el tipo (vacío o «application/octet-stream», p. ej. un EPUB en un
 * Windows sin lector o un .mov en algunos Android), lo deduce de la extensión del nombre.
 */
export function privateFileType(contentType: string, name: string): string | null {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  if (PRIVATE_TYPES[ct]) return ct;
  if (PRIVATE_TYPE_ALIASES[ct]) return PRIVATE_TYPE_ALIASES[ct];
  if (ct === "" || ct === "application/octet-stream") {
    const guess = mimeFromExt(name);
    if (PRIVATE_TYPES[guess]) return guess;
  }
  return null;
}

/** Fotos HEIC/HEIF del iPhone: no se ven en todos los navegadores, se piden en JPG. */
export function isHeic(contentType: string, name: string): boolean {
  return /^image\/hei[cf](-sequence)?$/i.test(contentType.split(";")[0].trim()) || /\.(heic|heif)$/i.test(name);
}

export const HEIC_ERROR =
  "Las fotos HEIC no se ven en todos los navegadores. Súbela desde «Fotos» (el iPhone la convierte a JPG) o expórtala como JPG";

/** accept de «Subir archivos». Empieza por «.pdf» (e2e/infra.spec.ts lo busca así). */
export const PRIVATE_ACCEPT =
  ".pdf,.mp3,.m4a,.wav,.mp4,.m4v,.mov,.jpg,.jpeg,.png,.webp,.gif,.epub,.zip,application/pdf,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,video/mp4,video/quicktime,image/jpeg,image/png,image/webp,image/gif";

/** accept del botón «Imagen» del editor de texto. Empieza por «.jpg» a propósito: así el primer
 *  input[accept^="image/"] de la ficha sigue siendo el de la imagen del producto (e2e/infra.spec.ts). */
export const RICH_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";

const MB = 1024 * 1024;
const GB = 1024 * MB;

export type UploadPolicy = { imageMax: number; fileMax: number; videoMax: number; multipart: boolean; label: string };

/**
 * Límites de subida según el modo. La plataforma no cambia (1 GB por archivo, un solo PUT); la web
 * personal admite vídeos de hasta 4 GB, que se suben por partes (la dueña paga su propio R2).
 */
export function uploadPolicy(personal: boolean): UploadPolicy {
  return personal
    ? {
        imageMax: 25 * MB,
        fileMax: GB,
        videoMax: 4 * GB,
        multipart: true,
        label: "Vídeo MP4 o MOV hasta 4 GB · audio MP3, M4A o WAV · PDF · imágenes JPG, PNG, WebP o GIF · EPUB o ZIP (hasta 1 GB)",
      }
    : { imageMax: 25 * MB, fileMax: GB, videoMax: GB, multipart: false, label: "Hasta 1 GB por archivo." };
}

/** Por encima de este tamaño la web personal sube por partes. */
export const MULTIPART_THRESHOLD = 64 * MB;
/** Todas las partes miden lo mismo salvo la última (lo exige S3/R2). */
export const PART_SIZE = 16 * MB;

export function planParts(size: number, partSize = PART_SIZE) {
  const partCount = Math.max(1, Math.ceil(size / partSize));
  return {
    partSize,
    partCount,
    /** Tamaño de la parte n (empieza en 1). */
    sizeOf: (n: number) => (n < partCount ? partSize : size - partSize * (partCount - 1)),
  };
}

/** Tipo con el que se firma la reproducción en la página: un MOV se reproduce como MP4. */
export function inlineContentType(mime: string | null | undefined): string | null {
  if (!mime) return null;
  return mime === "video/quicktime" ? "video/mp4" : mime;
}

/** Más de 12 Mbps: se corta con datos en el móvil (aviso «Muy pesado para el móvil»). */
export const HEAVY_BITRATE_BPS = 12_000_000;

export function videoWeight(sizeBytes: number | null | undefined, durationSec: number | null | undefined): "ok" | "heavy" {
  if (!sizeBytes || !durationSec || durationSec <= 0) return "ok";
  return (sizeBytes * 8) / durationSec > HEAVY_BITRATE_BPS ? "heavy" : "ok";
}

export type Delivery = "signed" | "stream" | "download";

/**
 * Cómo se entrega cada tipo en los visores:
 *   · VIDEO → URL firmada del almacenamiento (3 h), que se renueva (/api/download/…?format=json);
 *   · AUDIO → en la web personal, /api/stream (misma web, se comprueba el acceso en cada tramo: el
 *     ▶ de la pantalla bloqueada horas después funciona); en la plataforma, como el vídeo;
 *   · PDF e IMAGE → /api/stream (pdf.js y <img> desde la misma web, sin tocar la CSP);
 *   · el resto → solo descarga.
 */
export function deliveryFor(kind: string, personal: boolean): Delivery {
  if (kind === "VIDEO") return "signed";
  if (kind === "AUDIO") return personal ? "stream" : "signed";
  if (kind === "PDF" || kind === "IMAGE") return "stream";
  return "download";
}

/** Enlace de descarga: 10 minutos. */
export const DOWNLOAD_TTL_SEC = 600;
/** Vídeo y audio de un curso reproducidos en la página: 3 horas, para poder pausar y adelantar. */
export const INLINE_MEDIA_TTL_SEC = 10800;
