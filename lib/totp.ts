import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Códigos de una app (RFC 6238, TOTP): HMAC-SHA1, 6 cifras y pasos de 30 s, lo que entienden todas
 * las apps de códigos (Contraseñas de iPhone, Google Authenticator, Authy, 1Password…).
 *
 * Puro (solo node:crypto, sin BD ni `server-only`): lo usan lib/two-factor.ts, las pruebas y la
 * prueba e2e, que calcula el código a partir de la clave que enseña la pantalla.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SEC = 30;
export const TOTP_DIGITS = 6;

/** Base32 (RFC 4648) sin relleno. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Base32 → bytes. No distingue mayúsculas e ignora espacios, guiones y el relleno «=». */
export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Clave no válida");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Secreto nuevo: 20 bytes aleatorios (160 bits, lo que recomienda el RFC 4226). */
export function generateSecret(): Buffer {
  return randomBytes(20);
}

/** HOTP (RFC 4226) con truncado dinámico. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/** Paso de 30 s de un instante. */
export function totpStep(now = new Date()): number {
  return Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SEC);
}

/** «287 082» → «287082». null si no son 6 cifras. */
export function cleanTotpInput(code: string): string | null {
  const c = code.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(c) ? c : null;
}

/**
 * Comprueba un código con ±`window` pasos de margen (reloj del móvil algo adelantado o atrasado).
 * Devuelve el paso aceptado, o null. Un paso igual o anterior a `lastStep` (ya usado) no vale.
 */
export function verifyTotp(secret: Buffer, code: string, o: { now?: Date; lastStep?: number | null; window?: number } = {}): number | null {
  const clean = cleanTotpInput(code);
  if (!clean) return null;
  const current = totpStep(o.now);
  const win = o.window ?? 1;
  const given = Buffer.from(clean);
  for (let d = -win; d <= win; d++) {
    const step = current + d;
    if (o.lastStep != null && step <= o.lastStep) continue;
    if (timingSafeEqual(Buffer.from(hotp(secret, step)), given)) return step;
  }
  return null;
}

/** Dirección otpauth:// que abren las apps de códigos (botón «Abrir en mi app de códigos» y QR). */
export function otpauthUri(o: { issuer: string; account: string; secretB32: string }): string {
  const label = `${encodeURIComponent(o.issuer)}:${encodeURIComponent(o.account)}`;
  const q = `secret=${o.secretB32}&issuer=${encodeURIComponent(o.issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SEC}`;
  return `otpauth://totp/${label}?${q}`;
}

/** «ABCDEFGH…» → «ABCD EFGH …» (para escribirla a mano). */
export function formatSecret(b32: string): string {
  return b32.replace(/(.{4})/g, "$1 ").trim();
}
