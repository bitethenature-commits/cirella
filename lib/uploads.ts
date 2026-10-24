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
import { HEIC_ERROR, isHeic, MULTIPART_THRESHOLD, planParts, uploadPolicy, type UploadPolicy } from "./file-types";
import { storeEmailImage, storeImage } from "./images";
import { PAGE_VIDEO_MAX, pageVideoUrl, type PageVideo } from "./page-blocks";
import { probeStoredFile, type MediaInfo } from "./media-probe";
import { isPersonalMode } from "./site-mode";
import { IMAGE_TYPES, PRIVATE_TYPES, privateFileType, signToken, storage, storageSecret, verifyToken } from "./storage";
import { deliverableOrder } from "./deliverable";
import { tenantDb } from "./tenant";

/**
 * image: imagen pública · file: archivo de un producto · delivery: entrega de un pedido (lib/order-files.ts)
 * · video: vídeo público de la página (bloque «Vídeo»; solo la web personal).
 */
export type UploadPurpose = "image" | "file" | "delivery" | "video";

/** Límites de la plataforma (alias de uploadPolicy(false)); la web personal admite vídeos de 4 GB. */
export const UPLOAD_LIMITS = { image: uploadPolicy(false).imageMax, file: uploadPolicy(false).fileMax } as const;

/** Lectura del vídeo o audio al completar: si tarda más, se guarda sin esos datos. */
const PROBE_TIMEOUT_MS = 5000;

/** Error que se puede enseñar tal cual a la creadora. */
export class UploadError extends Error {}

/** Lo que firma el billete de subida. */
/** `u`/`ps`: id de la subida por partes y tamaño de cada parte (solo en la web personal). */
/** `g`: imagen con el perfil «graphic» (gráficos de Canva, lib/images.ts). `e`: imagen para un email (JPEG/PNG). */
type Ticket = { k: string; c: string; p: UploadPurpose; pid?: string; oid?: string; n: string; ct: string; s: number; u?: string; ps?: number; g?: 1; e?: 1 };

/** Carpeta del almacenamiento de cada tipo de subida (el billete solo vale bajo la de su creadora). */
const PREFIX: Record<UploadPurpose, string> = { image: "incoming", file: "private", delivery: "private", video: "public/video" };

/** Pedido al que se puede entregar algo (de esta creadora: tenantDb). */
async function deliverable(creatorId: string, orderId: string | undefined) {
  if (!orderId) return null;
  const o = await tenantDb(creatorId).order.findFirst({ where: { id: orderId }, include: { product: { select: { deliveryMode: true, groupSession: true } } } });
  return o && deliverableOrder(o) ? o : null;
}

/** La URL firmada de subida vale 15 minutos; el billete, 1 hora (subidas lentas de archivos grandes). */
const PUT_TTL_SEC = 900;
const TICKET_TTL_SEC = 3600;
/** Por partes: el billete vale 6 h (un vídeo de 4 GB por wifi de casa) y cada URL de parte, 1 h. */
const MULTIPART_TICKET_TTL_SEC = 6 * 3600;
const PART_TTL_SEC = 3600;
/** URLs de parte por petición a /api/upload/parts. */
export const MAX_PARTS_PER_REQUEST = 10;

export type SingleUpload = { uploadUrl: string; headers: Record<string, string>; ticket: string };
export type MultipartUpload = { multipart: { partSize: number; partCount: number }; ticket: string };

export async function createUpload(
  creatorId: string,
  input: { purpose: UploadPurpose; productId?: string; orderId?: string; name: string; contentType: string; size: number; graphic?: boolean; email?: boolean },
  policy: UploadPolicy = uploadPolicy(isPersonalMode()),
): Promise<SingleUpload | MultipartUpload> {
  const { purpose, size } = input;
  let { contentType } = input;
  if (!Number.isInteger(size) || size <= 0) throw new UploadError("El archivo está vacío");

  let key: string;
  if (isHeic(contentType, input.name)) throw new UploadError(HEIC_ERROR);
  if (purpose === "image") {
    if (!IMAGE_TYPES[contentType]) throw new UploadError("Formato no admitido (usa JPG, PNG, WebP o GIF)");
    if (size > policy.imageMax) throw new UploadError("La imagen supera 25 MB");
    key = `incoming/${creatorId}/${randomBytes(12).toString("hex")}`;
  } else if (purpose === "video") {
    // Vídeo de la página: público (su dirección /media/video/… lleva 96 bits al azar) y solo en la
    // web personal (en la plataforma, enlace de YouTube o Vimeo: ancho de banda y almacenamiento).
    if (!isPersonalMode()) throw new UploadError("En tu página, los vídeos se añaden con un enlace de YouTube o Vimeo");
    const canonical = privateFileType(contentType, input.name);
    const type = canonical ? PRIVATE_TYPES[canonical] : undefined;
    if (!canonical || type?.kind !== "VIDEO") throw new UploadError("Sube un vídeo MP4 o MOV");
    if (size > PAGE_VIDEO_MAX) throw new UploadError("El vídeo supera 1 GB: expórtalo a 1080p");
    const ext = /\.m4v$/i.test(input.name) ? "m4v" : type.ext;
    key = `public/video/${creatorId}/${randomBytes(12).toString("hex")}.${ext}`;
    contentType = canonical;
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
    if (purpose === "delivery") {
      if (!(await deliverable(creatorId, input.orderId))) throw new UploadError("Pedido no encontrado");
    } else if (!input.productId || !(await tenantDb(creatorId).product.findFirst({ where: { id: input.productId }, select: { id: true } })))
      throw new UploadError("Producto no encontrado");
    key = `private/${creatorId}/${randomBytes(12).toString("hex")}.${type.ext}`;
    contentType = canonical;
  }

  const ticket: Ticket = {
    k: key,
    c: creatorId,
    p: purpose,
    pid: purpose === "file" ? input.productId : undefined,
    oid: purpose === "delivery" ? input.orderId : undefined,
    n: input.name.slice(0, 120),
    ct: contentType,
    s: size,
    g: purpose === "image" && input.graphic ? 1 : undefined,
    e: purpose === "image" && input.email ? 1 : undefined,
  };
  // Web personal: lo grande va por partes (un corte de wifi solo repite la parte que falló).
  if (purpose !== "image" && policy.multipart && size > MULTIPART_THRESHOLD) {
    const plan = planParts(size);
    const { uploadId } = await storage().createMultipart(key, { contentType });
    return {
      multipart: { partSize: plan.partSize, partCount: plan.partCount },
      ticket: signToken({ ...ticket, u: uploadId, ps: plan.partSize } satisfies Ticket, storageSecret(), MULTIPART_TICKET_TTL_SEC),
    };
  }
  const put = await storage().presignPut(key, { contentType, contentLength: size, expiresInSec: PUT_TTL_SEC });
  return { uploadUrl: put.url, headers: put.headers, ticket: signToken(ticket, storageSecret(), TICKET_TTL_SEC) };
}

export type CompletedFile = { id: string; name: string; kind: string; sizeBytes: number | null; durationSec: number | null; videoCodec: string | null };
export type CompletedImage = { url: string; width: number; height: number };
export type CompletedVideo = PageVideo;
export type CompletedUpload = CompletedImage | { file: CompletedFile } | { video: CompletedVideo };

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

/** Billete válido y de esta creadora (la clave, bajo su carpeta). */
function readTicket(creatorId: string, ticket: string): Ticket {
  const t = verifyToken<Ticket>(ticket, storageSecret());
  if (!t || t.c !== creatorId || !PREFIX[t.p] || !t.k.startsWith(`${PREFIX[t.p]}/${creatorId}/`))
    throw new UploadError("La subida ha caducado. Vuelve a intentarlo.");
  return t;
}

/** URLs firmadas de las partes pedidas (como mucho 10 por vez), cada una con su tamaño exacto. */
export async function signUploadParts(creatorId: string, ticket: string, partNumbers: number[]): Promise<{ n: number; url: string; headers: Record<string, string> }[]> {
  const t = readTicket(creatorId, ticket);
  if (!t.u || !t.ps || t.p === "image") throw new UploadError("Esta subida no es por partes");
  const plan = planParts(t.s, t.ps);
  if (!partNumbers.length || partNumbers.length > MAX_PARTS_PER_REQUEST) throw new UploadError("Pide entre 1 y 10 partes");
  if (partNumbers.some((n) => !Number.isInteger(n) || n < 1 || n > plan.partCount)) throw new UploadError("Parte no válida");
  const s = storage();
  return Promise.all(
    [...new Set(partNumbers)].map(async (n) => {
      const r = await s.presignPart(t.k, t.u!, n, { contentLength: plan.sizeOf(n), expiresInSec: PART_TTL_SEC });
      return { n, url: r.url, headers: r.headers };
    }),
  );
}

/** Cancela una subida (por partes: borra lo recibido). Sin errores: es lo último que hace el navegador. */
export async function abortUpload(creatorId: string, ticket: string): Promise<void> {
  const t = readTicket(creatorId, ticket);
  const s = storage();
  if (t.u) await s.abortMultipart(t.k, t.u).catch(() => {});
  // Si ya se registró (se canceló tarde), no se borra un archivo que ya está en el producto.
  if (t.p === "file" && (await tenantDb(creatorId).productFile.findFirst({ where: { storageKey: t.k.slice("private/".length) }, select: { id: true } }))) return;
  if (t.p === "delivery" && (await tenantDb(creatorId).orderFile.findFirst({ where: { storageKey: t.k.slice("private/".length) }, select: { id: true } }))) return;
  await s.delete([t.k]).catch(() => {});
}

export async function completeUpload(creatorId: string, ticket: string): Promise<CompletedUpload> {
  const t = readTicket(creatorId, ticket);
  if (t.p === "delivery") return completeDelivery(creatorId, t);
  if (t.p === "video") return completeVideo(t);

  const s = storage();
  if (t.u) {
    // Repetir el paso 2 de una subida por partes ya completada: el archivo ya está registrado.
    const done = await tenantDb(creatorId).productFile.findFirst({ where: { productId: t.pid ?? "", storageKey: t.k.slice("private/".length) } });
    if (done) return { file: fileOut(done) };
    if (!(await tenantDb(creatorId).product.findFirst({ where: { id: t.pid ?? "" }, select: { id: true } }))) {
      await s.abortMultipart(t.k, t.u).catch(() => {});
      throw new UploadError("Producto no encontrado");
    }
    try {
      await s.completeMultipart(t.k, t.u);
    } catch {
      throw new UploadError("No hemos recibido el archivo completo. Vuelve a intentarlo.");
    }
  }
  const head = await s.head(t.k);
  if (!head || head.size !== t.s) {
    if (head) await s.delete([t.k]);
    throw new UploadError("No hemos recibido el archivo completo. Vuelve a intentarlo.");
  }

  if (t.p === "image") {
    try {
      const buf = await s.getBuffer(t.k, uploadPolicy(false).imageMax);
      if (t.e) return await storeEmailImage(creatorId, buf);
      return await storeImage(creatorId, buf, { profile: t.g ? "graphic" : "photo" });
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

/**
 * Paso 2 del vídeo de la página: el objeto ya está en su sitio (public/video/…); se comprueba que
 * llegó entero y se leen sus medidas, duración y códec para el bloque. Repetirlo con el mismo billete
 * (doble clic, reintento) da lo mismo: el objeto ya existe.
 */
async function completeVideo(t: Ticket): Promise<CompletedUpload> {
  const s = storage();
  let head = await s.head(t.k);
  if (t.u && (!head || head.size !== t.s)) {
    try {
      await s.completeMultipart(t.k, t.u);
    } catch {
      throw new UploadError("No hemos recibido el vídeo completo. Vuelve a intentarlo.");
    }
    head = await s.head(t.k);
  }
  if (!head || head.size !== t.s) {
    if (head) await s.delete([t.k]);
    throw new UploadError("No hemos recibido el vídeo completo. Vuelve a intentarlo.");
  }
  const info = await probeWithTimeout(t.k, t.s, t.ct);
  const [cid, file] = t.k.slice("public/video/".length).split("/");
  return {
    video: {
      src: pageVideoUrl(cid, file),
      width: info?.video?.width ?? null,
      height: info?.video?.height ?? null,
      durationSec: info?.durationSec != null ? Math.round(info.durationSec) : null,
      codec: info?.video?.codec ?? null,
      sizeBytes: t.s,
    },
  };
}

/** Paso 2 de una entrega: el archivo queda en el pedido como borrador (la clienta no lo ve hasta enviarlo). */
async function completeDelivery(creatorId: string, t: Ticket): Promise<CompletedUpload> {
  const s = storage();
  const db = tenantDb(creatorId);
  const orderId = t.oid ?? "";
  const storageKey = t.k.slice("private/".length);
  const done = await db.orderFile.findFirst({ where: { orderId, storageKey } });
  if (done) return { file: fileOut(done) };
  // tenantDb otra vez: el billete es de esta creadora, pero el pedido debe seguir siendo suyo y entregable.
  if (!(await deliverable(creatorId, orderId))) {
    if (t.u) await s.abortMultipart(t.k, t.u).catch(() => {});
    else await s.delete([t.k]).catch(() => {});
    throw new UploadError("Pedido no encontrado");
  }
  if (t.u) {
    try {
      await s.completeMultipart(t.k, t.u);
    } catch {
      throw new UploadError("No hemos recibido el archivo completo. Vuelve a intentarlo.");
    }
  }
  const head = await s.head(t.k);
  if (!head || head.size !== t.s) {
    if (head) await s.delete([t.k]);
    throw new UploadError("No hemos recibido el archivo completo. Vuelve a intentarlo.");
  }
  const kind = PRIVATE_TYPES[t.ct]?.kind ?? "OTHER";
  const info = kind === "VIDEO" || kind === "AUDIO" ? await probeWithTimeout(t.k, t.s, t.ct) : null;
  const record = await db.orderFile.create({
    data: {
      creatorId,
      orderId,
      name: t.n,
      kind,
      mimeType: t.ct,
      sizeBytes: t.s,
      storageKey,
      durationSec: info?.durationSec ?? null,
      videoCodec: kind === "VIDEO" ? (info?.video?.codec ?? null) : null,
      width: kind === "VIDEO" ? (info?.video?.width ?? null) : null,
      height: kind === "VIDEO" ? (info?.video?.height ?? null) : null,
    },
  });
  return { file: fileOut(record) };
}
