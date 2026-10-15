/**
 * Procesado de imágenes con sharp: endereza según el EXIF, quita TODOS los metadatos (EXIF con
 * GPS, XMP, IPTC: una foto del móvil puede llevar la ubicación de casa), limita a 1600 px y
 * convierte a WebP con tres variantes más pequeñas para el srcset.
 *
 * Sin `server-only`: también lo usan el seed y las pruebas (tsx).
 */
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { MEDIA_MAX_WIDTH, MEDIA_VARIANT_WIDTHS, type MediaVariantWidth, mediaUrl } from "./media-url";
import { publicKey, storage } from "./storage";

const READ_ERROR = "No hemos podido leer la imagen. Prueba con una foto JPG o PNG.";
const WEBP = { quality: 78, effort: 4 } as const;

export type ProcessedImage = {
  main: Buffer;
  width: number;
  height: number;
  variants: { width: MediaVariantWidth; data: Buffer }[];
};

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  try {
    // limitInputPixels: una imagen de 80 Mpx ya es enorme; más que eso solo sirve para agotar la memoria.
    // rotate() sin argumentos aplica la orientación del EXIF. sharp no copia metadatos al resultado
    // salvo que se pida (withMetadata/keepExif), y aquí nunca se pide.
    const base = sharp(input, { animated: true, limitInputPixels: 80_000_000, failOn: "error" }).rotate();
    const main = await base
      .clone()
      .resize({ width: MEDIA_MAX_WIDTH, height: MEDIA_MAX_WIDTH, fit: "inside", withoutEnlargement: true })
      .webp(WEBP)
      .toBuffer({ resolveWithObject: true });
    const variants = await Promise.all(
      MEDIA_VARIANT_WIDTHS.map(async (width) => ({
        width,
        data: await base.clone().resize({ width, withoutEnlargement: true }).webp(WEBP).toBuffer(),
      })),
    );
    // En los GIF animados, height es la de todas las páginas apiladas.
    const height = main.info.pageHeight ?? main.info.height;
    return { main: main.data, width: main.info.width, height, variants };
  } catch {
    throw new Error(READ_ERROR);
  }
}

const IMMUTABLE = "public, max-age=31536000, immutable";

/** Procesa la imagen, guarda el original optimizado y sus variantes, y devuelve su URL /media/…. */
export async function storeProcessedImage(creatorId: string, input: Buffer): Promise<string> {
  const img = await processImage(input);
  const id = randomBytes(10).toString("hex");
  const s = storage();
  await Promise.all([
    s.put(publicKey(`${creatorId}/${id}.webp`), img.main, { contentType: "image/webp", cacheControl: IMMUTABLE }),
    ...img.variants.map((v) =>
      s.put(publicKey(`${creatorId}/${id}-w${v.width}.webp`), v.data, { contentType: "image/webp", cacheControl: IMMUTABLE }),
    ),
  ]);
  return mediaUrl(creatorId, id);
}
