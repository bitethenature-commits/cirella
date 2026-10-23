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

// Tablas de tipos (sin dependencias de servidor, también las usa el panel): lib/file-types.ts.
export { DOWNLOAD_TTL_SEC, IMAGE_TYPES, INLINE_MEDIA_TTL_SEC, mimeFromExt, PRIVATE_TYPES, privateFileType } from "../file-types";


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

export { contentDisposition, isSafeKey, parseRange, signToken, verifyToken } from "./signing";
export type { LocalDriver, LocalToken } from "./local";
