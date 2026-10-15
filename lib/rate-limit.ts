import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { appSecret } from "./env";

/**
 * Limitador de intentos en Postgres (tabla RateLimit), compartido entre todas las instancias.
 * Ventana fija: cada clave cuenta hasta `limit` dentro de `windowSec` segundos desde el primer
 * intento; al vencer, el siguiente intento vuelve a empezar en 1. En el borde de la ventana caben
 * hasta el doble de intentos: se acepta por simplicidad.
 *
 * Las políticas (cuántos intentos y de qué) están en lib/limits.ts. Sin `server-only`: lo usan
 * las pruebas de BD con tsx.
 */

export type Rule = { limit: number; windowSec: number };
export type HitResult = { ok: boolean; count: number; retryAfterSec: number };

/** Cliente con el que contar: el global o el de una transacción (para que el contador vaya con ella). */
type Db = Pick<Prisma.TransactionClient, "$queryRaw">;

/**
 * HMAC de un valor para usarlo en una clave. Nunca guardamos IP ni emails en claro en las claves.
 * `secret` solo se pasa en las pruebas.
 */
export function keyHash(value: string, secret = appSecret()): string {
  return createHmac("sha256", secret).update(`rate-limit|${value}`).digest("hex").slice(0, 32);
}

/** Clave «<ámbito>:<hmac>» de unas partes (emails, IP con hash, ids…). No distingue mayúsculas. */
export function rlKey(scope: string, ...parts: string[]): string {
  return `${scope}:${keyHash(parts.map((p) => p.toLowerCase()).join("|"))}`;
}

/** Limpieza oportunista: 1 de cada 100 intentos borra las filas vencidas (sin tocar el cron). */
const PURGE_PROBABILITY = 0.01;

/**
 * Cuenta un intento y dice si cabe en la regla. Es un único INSERT … ON CONFLICT atómico: veinte
 * peticiones a la vez con límite 5 dejan pasar exactamente 5.
 */
export async function hit(key: string, rule: Rule, now = new Date(), db: Db = prisma): Promise<HitResult> {
  const resetAt = new Date(now.getTime() + rule.windowSec * 1000);
  const [row] = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  if (Math.random() < PURGE_PROBABILITY) void purgeExpiredRateLimits().catch(() => {});
  const count = Number(row.count);
  return { ok: count <= rule.limit, count, retryAfterSec: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)) };
}

/** Intentos ya contados en la ventana actual, sin sumar uno. */
export async function peek(key: string, now = new Date()): Promise<{ count: number; retryAfterSec: number }> {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  if (!row || row.resetAt <= now) return { count: 0, retryAfterSec: 0 };
  return { count: row.count, retryAfterSec: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)) };
}

export async function resetKey(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/** Borra los contadores vencidos hace más de una hora. Devuelve cuántos. */
export async function purgeExpiredRateLimits(now = new Date()): Promise<number> {
  const r = await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 3600_000) } } });
  return r.count;
}

/** «1 minuto», «15 minutos», «1 hora», «2 horas»: cuánto falta para poder volver a intentarlo. */
export function retryAfterText(sec: number): string {
  if (sec <= 60) return "1 minuto";
  if (sec < 3600) return `${Math.ceil(sec / 60)} minutos`;
  const hours = Math.ceil(sec / 3600);
  return hours === 1 ? "1 hora" : `${hours} horas`;
}
