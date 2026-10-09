/**
 * Driver de disco (desarrollo y pruebas): guarda cada objeto en {raíz}/{clave}.
 * Imita a R2: las subidas y descargas van por URLs firmadas con caducidad que atiende
 * /api/storage/local, y la lectura es siempre en streaming (nunca el archivo entero en memoria).
 */
import { randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import type { StorageDriver } from "./index";
import { isSafeKey, signToken, verifyToken } from "./signing";

/** Contenido de las URLs firmadas del driver local. */
export type LocalToken =
  | { op: "put"; k: string; ct: string; max: number }
  | { op: "get"; k: string; ct?: string | null; fn?: string; inl?: boolean };

export type LocalDriver = StorageDriver & {
  name: "local";
  /** Comprueba una URL firmada de /api/storage/local. null si está manipulada, caducada o la clave no es válida. */
  verify(token: string | null): (LocalToken & { exp: number }) | null;
  /**
   * Guarda el cuerpo de una subida en streaming. Si pasa de maxBytes se corta, se borra lo
   * escrito y devuelve "too-large"; si no, mueve el archivo a su sitio de una vez.
   */
  receive(key: string, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<"ok" | "too-large">;
};

const ENDPOINT = "/api/storage/local";

class TooLarge extends Error {}

export function createLocalDriver(rootDir: string, secret: () => string): LocalDriver {
  const root = path.resolve(rootDir);

  /** Ruta en disco de una clave, sin poder salir de la carpeta raíz. */
  function fullPath(key: string) {
    if (!isSafeKey(key)) throw new Error("Clave de almacenamiento no válida");
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Clave de almacenamiento no válida");
    return full;
  }

  async function sizeOf(full: string) {
    try {
      const info = await stat(full);
      return info.isFile() ? info.size : null;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  const tempPath = (full: string) => `${full}.${randomBytes(6).toString("hex")}.part`;

  return {
    name: "local",

    async presignPut(key, o) {
      fullPath(key);
      const t = signToken({ op: "put", k: key, ct: o.contentType, max: o.contentLength } satisfies LocalToken, secret(), o.expiresInSec);
      return { url: `${ENDPOINT}?t=${t}`, headers: { "Content-Type": o.contentType } };
    },

    async presignGet(key, o) {
      fullPath(key);
      const payload: LocalToken = { op: "get", k: key, ct: o.contentType ?? null, fn: o.filename, inl: o.inline || undefined };
      return `${ENDPOINT}?t=${signToken(payload, secret(), o.expiresInSec)}`;
    },

    async head(key) {
      const size = await sizeOf(fullPath(key));
      return size === null ? null : { size };
    },

    async getBuffer(key, maxBytes) {
      const full = fullPath(key);
      const size = await sizeOf(full);
      if (size === null) throw new Error("El archivo no existe");
      if (size > maxBytes) throw new Error("El archivo es demasiado grande");
      return readFile(full);
    },

    async getStream(key, range) {
      const full = fullPath(key);
      const size = await sizeOf(full);
      if (size === null) return null;
      const node = createReadStream(full, range ? { start: range.start, end: range.end } : undefined);
      return { body: Readable.toWeb(node) as ReadableStream<Uint8Array>, size };
    },

    async put(key, body) {
      const full = fullPath(key);
      await mkdir(path.dirname(full), { recursive: true });
      const tmp = tempPath(full);
      await writeFile(tmp, body);
      await rename(tmp, full);
    },

    async delete(keys) {
      await Promise.all(keys.map((k) => rm(fullPath(k), { force: true })));
    },

    verify(token) {
      const t = verifyToken<LocalToken>(token, secret());
      return t && typeof t.k === "string" && isSafeKey(t.k) ? t : null;
    },

    async receive(key, body, maxBytes) {
      const full = fullPath(key);
      await mkdir(path.dirname(full), { recursive: true });
      const tmp = tempPath(full);
      let bytes = 0;
      const limit = new Transform({
        transform(chunk: Buffer, _enc, done) {
          bytes += chunk.length;
          done(bytes > maxBytes ? new TooLarge() : null, chunk);
        },
      });
      try {
        await pipeline(Readable.fromWeb(body as NodeWebReadableStream<Uint8Array>), limit, createWriteStream(tmp));
      } catch (e) {
        await rm(tmp, { force: true });
        if (e instanceof TooLarge) return "too-large";
        throw e;
      }
      await rename(tmp, full);
      return "ok";
    },
  };
}
