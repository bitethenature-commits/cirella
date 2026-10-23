/**
 * Subidas directas al almacenamiento, en dos pasos:
 *
 *   1. createUpload   (POST /api/upload/sign)     → valida tipo y tamaño y devuelve una URL firmada
 *                                                   para que el navegador suba el archivo con PUT,
 *                                                   más un «billete» firmado que describe la subida.
 *   2. completeUpload (POST /api/upload/complete) → comprueba el billete y que el archivo llegó
 *                                                   entero; procesa la imagen o crea el ProductFile.
 *
 * El archivo nunca pasa por el servidor (Vercel limita el cuerpo de una petición a ~4,5 MB).
 * El billete va firmado con la clave de la app: la creadora no puede cambiar la clave del
 * objeto, el producto ni el tamaño entre un paso y otro, ni usar el billete de otra creadora.
 */
import { randomBytes } from "node:crypto";
import { HEIC_ERROR, isHeic, uploadPolicy, type UploadPolicy } from "./file-types";
import { storeProcessedImage } from "./images";
import { probeStoredFile, type MediaInfo } from "./media-probe";
import { isPersonalMode } from "./site-mode";
import { IMAGE_TYPES, PRIVATE_TYPES, privateFileType, signToken, storage, storageSecret, verifyToken } from "./storage";
import { tenantDb } from "./tenant";

export type UploadPurpose = "image" | "file";

/** Límites de la plataforma (alias de uploadPolicy(false)); la web personal admite vídeos de 4 GB. */
export const UPLOAD_LIMITS = { image: uploadPolicy(false).imageMax, file: uploadPolicy(false).fileMax } as const;

/** Lectura del vídeo o audio al completar: si tarda más, se guarda sin esos datos. */
const PROBE_TIMEOUT_MS = 5000;

/** Error que se puede enseñar tal cual a la creadora. */
export class UploadError extends Error {}

/** Lo que firma el billete de subida. */
type Ticket = { k: string; c: string; p: UploadPurpose; pid?: string; n: string; ct: string; s: number };

/** La URL firmada de subida vale 15 minutos; el billete, 1 hora (subidas lentas de archivos grandes). */
const PUT_TTL_SEC = 900;
const TICKET_TTL_SEC = 3600;

export async function createUpload(
  creatorId: string,
  input: { purpose: UploadPurpose; productId?: string; name: string; contentType: string; size: number },
  policy: UploadPolicy = uploadPolicy(isPersonalMode()),
): Promise<{ uploadUrl: string; headers: Record<string, string>; ticket: string }> {
  const { purpose, size } = input;
  let { contentType } = input;
  if (!Number.isInteger(size) || size <= 0) throw new UploadError("El archivo está vacío");

  let key: string;
  if (isHeic(contentType, input.name)) throw new UploadError(HEIC_ERROR);
  if (purpose === "image") {
    if (!IMAGE_TYPES[contentType]) throw new UploadError("Formato no admitido (usa JPG, PNG, WebP o GIF)");
    if (size > policy.imageMax) throw new UploadError("La imagen supera 25 MB");
    key = `incoming/${creatorId}/${randomBytes(12).toString("hex")}`;
  } else {
    // Tipo canónico: es el que se firma para el PUT, va en el billete y acaba en ProductFile.mimeType.
    const canonical = privateFileType(contentType, input.name);
    const type = canonical ? PRIVATE_TYPES[canonical] : undefined;
    if (!canonical || !type) throw new UploadError("Formato no admitido (PDF, MP3, M4A, WAV, MP4, MOV, JPG, PNG, WebP, GIF, EPUB, ZIP)");
    if (type.kind === "VIDEO" && size > policy.videoMax)
      throw new UploadError(
        policy.videoMax > policy.fileMax
          ? "El vídeo supera 4 GB. Expórtalo en 1080p con InShot o súbelo a Vimeo y pega el enlace"
          : "El archivo supera 1 GB",
      );
    if (type.kind !== "VIDEO" && size > policy.fileMax) throw new UploadError("El archivo supera 1 GB");
    if (!input.productId || !(await tenantDb(creatorId).product.findFirst({ where: { id: input.productId }, select: { id: true } })))
      throw new UploadError("Producto no encontrado");
    key = `private/${creatorId}/${randomBytes(12).toString("hex")}.${type.ext}`;
    contentType = canonical;
  }

  const put = await storage().presignPut(key, { contentType, contentLength: size, expiresInSec: PUT_TTL_SEC });
  const ticket: Ticket = {
    k: key,
    c: creatorId,
    p: purpose,
    pid: purpose === "file" ? input.productId : undefined,
    n: input.name.slice(0, 120),
    ct: contentType,
    s: size,
  };
  return { uploadUrl: put.url, headers: put.headers, ticket: signToken(ticket, storageSecret(), TICKET_TTL_SEC) };
}

export type CompletedFile = { id: string; name: string; kind: string; sizeBytes: number | null; durationSec: number | null; videoCodec: string | null };
export type CompletedUpload = { url: string } | { file: CompletedFile };

const fileOut = (f: CompletedFile): CompletedFile => ({ id: f.id, name: f.name, kind: f.kind, sizeBytes: f.sizeBytes, durationSec: f.durationSec, videoCodec: f.videoCodec });

/** Duración, códec y tamaño de un vídeo o audio recién subido (null si no se pudo leer a tiempo). */
async function probeWithTimeout(key: string, size: number, mime: string): Promise<MediaInfo | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), PROBE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([probeStoredFile(key, size, mime), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function completeUpload(creatorId: string, ticket: string): Promise<CompletedUpload> {
  const t = verifyToken<Ticket>(ticket, storageSecret());
  if (!t || t.c !== creatorId || !t.k.startsWith(`${t.p === "image" ? "incoming" : "private"}/${creatorId}/`))
    throw new UploadError("La subida ha caducado. Vuelve a intentarlo.");

  const s = storage();
  const head = await s.head(t.k);
  if (!head || head.size !== t.s) {
    if (head) await s.delete([t.k]);
    throw new UploadError("No hemos recibido el archivo completo. Vuelve a intentarlo.");
  }

  if (t.p === "image") {
    try {
      const url = await storeProcessedImage(creatorId, await s.getBuffer(t.k, uploadPolicy(false).imageMax));
      return { url };
    } catch (e) {
      throw new UploadError(e instanceof Error ? e.message : "No hemos podido procesar la imagen");
    } finally {
      await s.delete([t.k]).catch(() => {});
    }
  }

  // tenantDb otra vez: el billete es de esta creadora, pero el producto debe seguir siendo suyo.
  const db = tenantDb(creatorId);
  const productId = t.pid ?? "";
  if (!(await db.product.findFirst({ where: { id: productId }, select: { id: true } }))) {
    await s.delete([t.k]).catch(() => {});
    throw new UploadError("Producto no encontrado");
  }
  const storageKey = t.k.slice("private/".length);
  // Repetir el paso 2 con el mismo billete (doble clic, reintento) no duplica el archivo.
  const existing = await db.productFile.findFirst({ where: { productId, storageKey } });
  if (existing) return { file: fileOut(existing) };
  const count = await db.productFile.count({ where: { productId } });
  const kind = PRIVATE_TYPES[t.ct]?.kind ?? "OTHER";
  const info = kind === "VIDEO" || kind === "AUDIO" ? await probeWithTimeout(t.k, t.s, t.ct) : null;
  const record = await db.productFile.create({
    data: {
      productId,
      name: t.n,
      kind,
      mimeType: t.ct,
      sizeBytes: t.s,
      storageKey,
      durationSec: info?.durationSec ?? null,
      videoCodec: kind === "VIDEO" ? (info?.video?.codec ?? null) : null,
      width: kind === "VIDEO" ? (info?.video?.width ?? null) : null,
      height: kind === "VIDEO" ? (info?.video?.height ?? null) : null,
      sortOrder: count,
      creatorId,
    },
  });
  return { file: fileOut(record) };
}
