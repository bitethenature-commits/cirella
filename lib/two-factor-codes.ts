import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { appSecret } from "./env";

/**
 * Lo puro de la verificación en dos pasos (sin BD ni `server-only`, para las pruebas unitarias):
 * el cifrado del secreto de la app y los códigos de recuperación. Lo usa lib/two-factor.ts.
 */

// ── Secreto cifrado ──

function sealKey(secret: string) {
  return Buffer.from(hkdfSync("sha256", secret, "cirella", "totp-v1", 32));
}

/** «v1:<iv>:<tag>:<cifrado>» en base64url. `secret` solo se pasa en las pruebas. */
export function sealSecret(plain: string, secret = appSecret()): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", sealKey(secret), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

/** Descifra; lanza si se ha manipulado o si APP_SECRET ha cambiado. */
export function openSecret(sealed: string, secret = appSecret()): string {
  const [v, iv, tag, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Secreto con formato desconocido");
  const d = createDecipheriv("aes-256-gcm", sealKey(secret), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** Base32 de Crockford (sin i, l, o, u): fácil de copiar a mano. */
const RECOVERY_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/** «ABCDE-12345», « abcde 12345 » y «abcde12345» son el mismo código (o→0, i/l→1). */
export function normalizeRecoveryCode(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s-]/g, "")
    .replace(/o/g, "0")
    .replace(/[il]/g, "1");
}

/** Un código nuevo «xxxxx-xxxxx» (50 bits). */
export function newRecoveryCode(): string {
  const bytes = randomBytes(10);
  const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b & 31]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

export function recoveryCodeHash(code: string, secret = appSecret()): string {
  return createHmac("sha256", secret).update(`recovery|${normalizeRecoveryCode(code)}`).digest("hex");
}

