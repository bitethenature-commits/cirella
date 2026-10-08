import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { storageDir } from "./env";

/**
 * Almacenamiento de archivos.
 *   public/  → imágenes de páginas (avatar, portada, productos). Servidas en /media/...
 *   private/ → contenido de pago. Solo se sirve vía /api/download tras comprobar el acceso.
 * Para producción, sustituir por S3/R2 manteniendo estas funciones.
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
  "image/jpeg": { ext: "jpg", kind: "IMAGE" },
  "image/png": { ext: "png", kind: "IMAGE" },
  "application/epub+zip": { ext: "epub", kind: "OTHER" },
  "application/zip": { ext: "zip", kind: "OTHER" },
};

const MAX_IMAGE = 6 * 1024 * 1024;
const MAX_PRIVATE = 200 * 1024 * 1024;

function root(...parts: string[]) {
  return path.resolve(process.cwd(), storageDir(), ...parts);
}

/** Resuelve una ruta relativa impidiendo salir de la carpeta base. */
export function safeResolve(base: "public" | "private", rel: string) {
  const baseDir = root(base);
  const full = path.resolve(baseDir, rel);
  if (!full.startsWith(baseDir + path.sep)) throw new Error("Ruta no válida");
  return full;
}

export async function savePublicImage(creatorId: string, file: File) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Formato no admitido (usa JPG, PNG, WebP o GIF)");
  if (file.size > MAX_IMAGE) throw new Error("La imagen supera 6 MB");
  const rel = `${creatorId}/${randomBytes(10).toString("hex")}.${ext}`;
  const full = safeResolve("public", rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return `/media/${rel}`;
}

export async function savePrivateFile(creatorId: string, file: File) {
  const type = PRIVATE_TYPES[file.type];
  if (!type) throw new Error("Formato no admitido (PDF, MP3, M4A, WAV, MP4, JPG, PNG, EPUB, ZIP)");
  if (file.size > MAX_PRIVATE) throw new Error("El archivo supera 200 MB");
  const rel = `${creatorId}/${randomBytes(12).toString("hex")}.${type.ext}`;
  const full = safeResolve("private", rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return { storageKey: rel, kind: type.kind, mimeType: file.type, sizeBytes: file.size };
}

export async function readStored(base: "public" | "private", rel: string) {
  const full = safeResolve(base, rel);
  const info = await stat(full);
  return { data: await readFile(full), size: info.size };
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
