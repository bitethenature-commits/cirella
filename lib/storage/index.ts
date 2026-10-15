/**
 * Almacenamiento de archivos: un único espacio con tres prefijos.
 *   public/{creadora}/…    → imágenes de las páginas ya procesadas (WebP). Se sirven en /media/… con caché larga.
 *   private/{creadora}/…   → contenido de pago. Solo se entrega con un enlace temporal tras
 *                            comprobar el acceso (/api/download/[fileId]).
 *   incoming/{creadora}/…  → imágenes recién subidas, sin procesar. Se borran al procesarlas
 *                            (y en R2 una regla de ciclo de vida limpia las abandonadas en 1 día).
 *
 * Drivers (STORAGE_DRIVER): "local" (carpeta STORAGE_DIR, desarrollo y pruebas) o "s3"
 * (Cloudflare R2 en producción). El navegador sube y descarga directamente del almacenamiento con
 * URLs firmadas: el servidor nunca recibe ni carga en memoria los archivos grandes.
 *
 * Sin `server-only`: también lo usan el seed y las pruebas (tsx). Solo lo importa código de servidor.
 */
import path from "node:path";
import { appSecret, env } from "../env";
import { createLocalDriver } from "./local";
import { createS3Driver } from "./s3";

export interface StorageDriver {
  name: "local" | "s3";
  /** URL firmada para que el navegador suba el archivo con PUT (y las cabeceras que debe enviar). */
  presignPut(key: string, o: { contentType: string; contentLength: number; expiresInSec: number }): Promise<{ url: string; headers: Record<string, string> }>;
  /** URL temporal de descarga. `inline` lo abre en el navegador (vídeo, audio, PDF) en vez de descargarlo. */
  presignGet(key: string, o: { expiresInSec: number; filename?: string; inline?: boolean; contentType?: string | null }): Promise<string>;
  head(key: string): Promise<{ size: number; contentType?: string } | null>;
  /** Lee el objeto entero en memoria; falla si supera maxBytes. Solo para imágenes a procesar. */
  getBuffer(key: string, maxBytes: number): Promise<Buffer>;
  /** `size` es el tamaño total del objeto, aunque se pida un tramo. null si no existe. */
  getStream(key: string, range?: { start: number; end: number }): Promise<{ body: ReadableStream<Uint8Array>; size: number; contentType?: string } | null>;
  put(key: string, body: Buffer, o: { contentType: string; cacheControl?: string }): Promise<void>;
  /** Borra los objetos que existan; los que no, se ignoran. */
  delete(keys: string[]): Promise<void>;
}

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
  "image/jpeg": { ext: "jpg", kind: "IMAGE" },
  "image/png": { ext: "png", kind: "IMAGE" },
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
};

/**
 * Tipo canónico (clave de PRIVATE_TYPES) de un archivo de producto, o null si no se admite.
 * Si el navegador no sabe el tipo (vacío o «application/octet-stream», p. ej. un EPUB en un
 * Windows sin lector), lo deduce de la extensión del nombre.
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

/** Enlace de descarga: 10 minutos. */
export const DOWNLOAD_TTL_SEC = 600;
/** Vídeo y audio de un curso reproducidos en la página: 3 horas, para poder pausar y adelantar. */
export const INLINE_MEDIA_TTL_SEC = 10800;

/** ProductFile.storageKey es relativo a «private/». */
export const privateKey = (storageKey: string) => `private/${storageKey}`;
/** Ruta de /media/… → clave del objeto. */
export const publicKey = (rel: string) => `public/${rel}`;

/** Clave HMAC de los billetes de subida y de las URLs firmadas del driver local. */
export function storageSecret() {
  return appSecret();
}

let driver: StorageDriver | undefined;

/** Driver configurado (STORAGE_DRIVER). Se crea una sola vez por proceso. */
export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  if (e.STORAGE_DRIVER === "s3") {
    const missing = (["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const).find((k) => !e[k]);
    if (missing) throw new Error(`Falta ${missing}: es obligatoria con STORAGE_DRIVER=s3.`);
    driver = createS3Driver({
      endpoint: e.S3_ENDPOINT!,
      region: e.S3_REGION,
      bucket: e.S3_BUCKET!,
      accessKeyId: e.S3_ACCESS_KEY_ID!,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY!,
    });
  } else {
    driver = createLocalDriver(path.resolve(process.cwd(), e.STORAGE_DIR), storageSecret);
  }
  return driver;
}

export function mimeFromExt(rel: string) {
  const ext = rel.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
    pdf: "application/pdf", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", mp4: "video/mp4",
    epub: "application/epub+zip", zip: "application/zip",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

export { contentDisposition, isSafeKey, parseRange, signToken, verifyToken } from "./signing";
export type { LocalDriver, LocalToken } from "./local";
