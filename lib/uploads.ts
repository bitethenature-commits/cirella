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
import { storeProcessedImage } from "./images";
import { IMAGE_TYPES, PRIVATE_TYPES, privateFileType, signToken, storage, storageSecret, verifyToken } from "./storage";
import { tenantDb } from "./tenant";

export type UploadPurpose = "image" | "file";

export const UPLOAD_LIMITS = { image: 25 * 1024 * 1024, file: 1024 * 1024 * 1024 } as const;

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
): Promise<{ uploadUrl: string; headers: Record<string, string>; ticket: string }> {
  const { purpose, size } = input;
  let { contentType } = input;
  if (!Number.isInteger(size) || size <= 0) throw new UploadError("El archivo está vacío");

  let key: string;
  if (purpose === "image") {
    if (!IMAGE_TYPES[contentType]) throw new UploadError("Formato no admitido (usa JPG, PNG, WebP o GIF)");
    if (size > UPLOAD_LIMITS.image) throw new UploadError("La imagen supera 25 MB");
    key = `incoming/${creatorId}/${randomBytes(12).toString("hex")}`;
  } else {
    // Tipo canónico: es el que se firma para el PUT, va en el billete y acaba en ProductFile.mimeType.
    const canonical = privateFileType(contentType, input.name);
    const type = canonical ? PRIVATE_TYPES[canonical] : undefined;
    if (!canonical || !type) throw new UploadError("Formato no admitido (PDF, MP3, M4A, WAV, MP4, JPG, PNG, EPUB, ZIP)");
    if (size > UPLOAD_LIMITS.file) throw new UploadError("El archivo supera 1 GB");
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

export type CompletedUpload = { url: string } | { file: { id: string; name: string; kind: string; sizeBytes: number | null } };

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
      const url = await storeProcessedImage(creatorId, await s.getBuffer(t.k, UPLOAD_LIMITS.image));
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
  if (existing) return { file: { id: existing.id, name: existing.name, kind: existing.kind, sizeBytes: existing.sizeBytes } };
  const count = await db.productFile.count({ where: { productId } });
  const record = await db.productFile.create({
    data: {
      productId,
      name: t.n,
      kind: PRIVATE_TYPES[t.ct]?.kind ?? "OTHER",
      mimeType: t.ct,
      sizeBytes: t.s,
      storageKey,
      sortOrder: count,
      creatorId,
    },
  });
  return { file: { id: record.id, name: record.name, kind: record.kind, sizeBytes: record.sizeBytes } };
}
