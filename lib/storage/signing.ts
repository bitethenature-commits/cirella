/**
 * Firmas y utilidades HTTP del almacenamiento. Funciones puras (solo node:crypto), probadas en
 * scripts/unit/storage.test.ts.
 *
 *   signToken / verifyToken → tokens HMAC con caducidad: billetes de subida y URLs firmadas del
 *                             driver local (/api/storage/local?t=…).
 *   isSafeKey               → solo claves con forma conocida (public|private|incoming/{creadora}/{archivo}).
 *   parseRange              → cabecera Range de un único tramo (vídeo y audio que se adelantan).
 *   contentDisposition      → nombre del archivo en UTF-8 para la descarga.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const hmac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest();

/** Token `base64url(JSON).base64url(HMAC-SHA256)`. El contenido no es secreto, solo infalsificable. */
export function signToken(payload: object, secret: string, ttlSec: number, now = Date.now()) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + ttlSec }));
  return `${body}.${b64(hmac(body, secret))}`;
}

/** Devuelve el contenido del token o null si está manipulado, firmado con otra clave o caducado. */
export function verifyToken<T extends object>(token: string | null | undefined, secret: string, now = Date.now()): (T & { exp: number }) | null {
  if (!token) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = hmac(body, secret);
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}

const KEY_RE = /^(?:(?:public|private|incoming)|public\/video)\/[a-z0-9]+\/[A-Za-z0-9._-]+$/;

/**
 * Clave de objeto válida: prefijo conocido, carpeta de la creadora y un nombre sin rutas. Los
 * vídeos de los bloques de la página van en public/video/<creadora>/ (lib/uploads.ts).
 */
export function isSafeKey(key: string) {
  return KEY_RE.test(key) && !key.includes("..");
}

/**
 * Cabecera Range (un solo tramo): `bytes=a-b`, `bytes=a-` o `bytes=-n`.
 * null = sin Range (se sirve entero) · 'invalid' = fuera del archivo (416).
 */
export function parseRange(header: string | null | undefined, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const m = header.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) return "invalid";
  let start: number;
  let end: number;
  if (!m[1]) {
    // Los últimos n bytes
    const n = Number(m[2]);
    if (n === 0) return "invalid";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}

/** `inline` para verlo en el navegador o `attachment` para descargarlo, con el nombre en UTF-8. */
export function contentDisposition(filename: string | null | undefined, inline: boolean) {
  const type = inline ? "inline" : "attachment";
  if (!filename) return type;
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename*=UTF-8''${encoded}`;
}
