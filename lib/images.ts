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
/**
 * Perfiles: «photo» (fotos: dentro de 1600×1600) y «graphic» (gráficos de Canva con texto: hasta
 * 1600 de ancho y 4000 de alto, con más calidad, para que una historia de 1080×1920 no se encoja).
 */
export type ImageProfile = "photo" | "graphic";
const PROFILES: Record<ImageProfile, { box: { width: number; height: number }; webp: Record<string, number | boolean> }> = {
  photo: { box: { width: MEDIA_MAX_WIDTH, height: MEDIA_MAX_WIDTH }, webp: WEBP },
  graphic: { box: { width: MEDIA_MAX_WIDTH, height: 4000 }, webp: { quality: 88, smartSubsample: true, effort: 4 } },
};

export type ProcessedImage = {
  main: Buffer;
  width: number;
  height: number;
  variants: { width: MediaVariantWidth; data: Buffer }[];
};

export async function processImage(input: Buffer, o: { profile?: ImageProfile } = {}): Promise<ProcessedImage> {
  const profile = PROFILES[o.profile ?? "photo"];
  try {
    // limitInputPixels: una imagen de 80 Mpx ya es enorme; más que eso solo sirve para agotar la memoria.
    // rotate() sin argumentos aplica la orientación del EXIF. sharp no copia metadatos al resultado
    // salvo que se pida (withMetadata/keepExif), y aquí nunca se pide.
    const base = sharp(input, { animated: true, limitInputPixels: 80_000_000, failOn: "error" }).rotate();
    const main = await base
      .clone()
      .resize({ ...profile.box, fit: "inside", withoutEnlargement: true })
      .webp(profile.webp)
      .toBuffer({ resolveWithObject: true });
    const variants = await Promise.all(
      MEDIA_VARIANT_WIDTHS.map(async (width) => ({
        width,
        data: await base.clone().resize({ width, withoutEnlargement: true }).webp(profile.webp).toBuffer(),
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
  return (await storeImage(creatorId, input)).url;
}

/** Como storeProcessedImage, con las medidas de la imagen guardada (sin saltos al pintarla). */
export async function storeImage(creatorId: string, input: Buffer, o: { profile?: ImageProfile } = {}): Promise<{ url: string; width: number; height: number }> {
  const img = await processImage(input, o);
  const id = randomBytes(10).toString("hex");
  const s = storage();
  await Promise.all([
    s.put(publicKey(`${creatorId}/${id}.webp`), img.main, { contentType: "image/webp", cacheControl: IMMUTABLE }),
    ...img.variants.map((v) =>
      s.put(publicKey(`${creatorId}/${id}-w${v.width}.webp`), v.data, { contentType: "image/webp", cacheControl: IMMUTABLE }),
    ),
  ]);
  return { url: mediaUrl(creatorId, id), width: img.width, height: img.height };
}

/**
 * Foto de perfil de una alumna: cuadrada de 256 px en WebP (sharp quita el EXIF con GPS), en
 * /media/{userId}/{hex}.webp, pública e inmutable como las de las creadoras. Sin variantes.
 */
export async function storeAvatarImage(userId: string, input: Buffer): Promise<string> {
  let data: Buffer;
  try {
    data = await sharp(input, { limitInputPixels: 80_000_000, failOn: "error" }).rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw new Error(READ_ERROR);
  }
  const id = randomBytes(10).toString("hex");
  await storage().put(publicKey(`${userId}/${id}.webp`), data, { contentType: "image/webp", cacheControl: IMMUTABLE });
  return mediaUrl(userId, id);
}

/** Borra una foto de perfil (y sus variantes, si las hubiera). Sin errores: se intenta y ya. */
export async function deleteAvatarImage(url: string | null | undefined): Promise<void> {
  const m = url?.match(/^\/media\/([a-z0-9]+)\/([a-f0-9]{20})\.webp$/);
  if (!m) return;
  await storage().delete([publicKey(`${m[1]}/${m[2]}.webp`)]).catch(() => {});
}
