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
 * Imagen de un email (newsletter y emails automáticos): JPEG (o PNG si tiene transparencia y pesa
 * poco), máx. 1200 px de ancho, sin metadatos. Outlook y algunos buzones no enseñan WebP. En
 * /media/{creadora}/{hex}.jpg|png, pública e inmutable.
 */
export async function storeEmailImage(creatorId: string, input: Buffer): Promise<{ url: string; width: number; height: number }> {
  let out: { data: Buffer; ext: "jpg" | "png"; width: number; height: number };
  try {
    const base = sharp(input, { limitInputPixels: 80_000_000, failOn: "error" }).rotate().resize({ width: 1200, withoutEnlargement: true });
    const meta = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
    const png = meta.hasAlpha ? await base.clone().png({ compressionLevel: 9, palette: true }).toBuffer({ resolveWithObject: true }) : null;
    if (png && png.data.length <= 1_500_000) out = { data: png.data, ext: "png", width: png.info.width, height: png.info.height };
    else {
      const jpg = await base.clone().flatten({ background: "#ffffff" }).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      out = { data: jpg.data, ext: "jpg", width: jpg.info.width, height: jpg.info.height };
    }
  } catch {
    throw new Error(READ_ERROR);
  }
  const id = randomBytes(10).toString("hex");
  await storage().put(publicKey(`${creatorId}/${id}.${out.ext}`), out.data, { contentType: out.ext === "png" ? "image/png" : "image/jpeg", cacheControl: IMMUTABLE });
  return { url: `/media/${creatorId}/${id}.${out.ext}`, width: out.width, height: out.height };
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

/** Botón ▶ (círculo oscuro translúcido y triángulo blanco) del tamaño pedido, en SVG. */
function playButtonSvg(size: number): Buffer {
  const r = size / 2;
  const t = size * 0.2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<circle cx="${r}" cy="${r}" r="${r - 2}" fill="#0E1024" fill-opacity="0.62" stroke="#FFFFFF" stroke-opacity="0.9" stroke-width="${Math.max(2, size / 40)}"/>` +
      `<path d="M ${r - t * 0.75} ${r - t} L ${r + t * 1.05} ${r} L ${r - t * 0.75} ${r + t} Z" fill="#FFFFFF"/>` +
      `</svg>`,
  );
}

/**
 * Portada de un vídeo en un email (bloque «Vídeo» del editor visual): los buzones no reproducen
 * vídeo, así que la portada lleva el ▶ dibujado en la propia imagen (sale igual en Gmail, Outlook y
 * el iPhone, sin trucos de CSS). JPEG de hasta 1200 px, sin metadatos, en /media/{creadora}/{hex}.jpg.
 */
export async function storeVideoCover(creatorId: string, input: Buffer): Promise<{ url: string; width: number; height: number }> {
  let out: { data: Buffer; width: number; height: number };
  try {
    const base = await sharp(input, { limitInputPixels: 80_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#0E1024" })
      .toBuffer({ resolveWithObject: true });
    const { width, height } = base.info;
    const size = Math.max(48, Math.round(Math.min(width, height) * 0.26));
    const jpg = await sharp(base.data)
      .composite([{ input: playButtonSvg(size), left: Math.round((width - size) / 2), top: Math.round((height - size) / 2) }])
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    out = { data: jpg.data, width: jpg.info.width, height: jpg.info.height };
  } catch {
    throw new Error(READ_ERROR);
  }
  const id = randomBytes(10).toString("hex");
  await storage().put(publicKey(`${creatorId}/${id}.jpg`), out.data, { contentType: "image/jpeg", cacheControl: IMMUTABLE });
  return { url: `/media/${creatorId}/${id}.jpg`, width: out.width, height: out.height };
}
