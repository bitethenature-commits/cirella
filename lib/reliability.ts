/**
 * Utilidades puras de fiabilidad (sin BD ni servidor): las comparten la bandeja de emails,
 * el outbox de eventos, el cron y los cobros. Se prueban en scripts/unit/reliability.test.ts.
 */

/** Esperas entre intentos, en minutos: 1 min, 5 min, 30 min, 2 h y 12 h. */
export const RETRY_DELAYS_MIN = [1, 5, 30, 120, 720] as const;
/** 1 intento + 5 reintentos. Después, el envío o el evento se da por perdido y se avisa. */
export const MAX_ATTEMPTS = 6;
/** Si el cron (programado cada 5 min) lleva más de esto sin terminar, /api/health y /admin avisan. */
export const CRON_STALE_MINUTES = 20;

/**
 * Cuándo toca el siguiente intento tras `attemptsDone` intentos fallidos (≥ 1).
 * null = agotado: no hay más reintentos.
 */
export function nextAttemptAt(attemptsDone: number, now: Date): Date | null {
  if (attemptsDone >= MAX_ATTEMPTS) return null;
  const delay = RETRY_DELAYS_MIN[Math.max(0, attemptsDone - 1)];
  return new Date(now.getTime() + delay * 60_000);
}

export type FailureKind = "retry" | "permanent";

/**
 * Clasifica un fallo HTTP de un proveedor. 400 y 422 son errores del propio mensaje (dirección
 * inválida, datos rechazados): repetirlo no sirve. Todo lo demás (409, 429, 5xx, red o
 * timeout sin status) puede ir bien en el siguiente intento.
 */
export function classifyHttpFailure(status?: number): FailureKind {
  return status === 400 || status === 422 ? "permanent" : "retry";
}

/** ¿Ha pasado más de `maxMinutes` desde `last`? Sin fecha, se considera parado. */
export function isStale(last: Date | null, now: Date, maxMinutes: number): boolean {
  return last === null || now.getTime() - last.getTime() > maxMinutes * 60_000;
}

// ── Claves de idempotencia: Transaction.idempotencyKey (única) y la de la pasarela ──

export function chargeKey(orderId: string) {
  return `charge:${orderId}`;
}

export function renewalKey(subscriptionId: string, periodEnd: Date) {
  return `renewal:${subscriptionId}:${periodEnd.toISOString()}`;
}

export function planFeeKey(creatorId: string, renewsAt: Date) {
  return `plan:${creatorId}:${renewsAt.toISOString()}`;
}

/**
 * Remitente «Nombre» <dirección>. El nombre lo escribe la creadora, así que se limpian las
 * comillas, los ángulos y los saltos de línea (evita inyectar cabeceras) y se recorta.
 */
export function formatFrom(name: string, address: string) {
  const clean = name
    .replace(/["<>\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  return `"${clean || "Cirella"}" <${address}>`;
}

/**
 * Separa un remitente escrito como `Nombre <dirección>` o solo `dirección`
 * (formato de EMAIL_FROM).
 */
export function parseFromAddress(from: string): { name: string | null; address: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^<>\s]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, address: m[2] };
  return { name: null, address: from.trim() };
}

/** Mensaje de error corto para guardar en la BD. */
export function truncateError(e: unknown, max = 500) {
  return String(e instanceof Error ? e.message : e).slice(0, max);
}
