/**
 * Reintentos de las renovaciones de membresía que fallan (pura, sin BD).
 * Tras el primer fallo la suscripción pasa a PAST_DUE y se reintenta al día siguiente; tras el
 * segundo, a los 3 días; si el tercero también falla, se cancela. La clienta mantiene el acceso
 * mientras tanto y recibe un email con «Pagar ahora».
 */
export const RENEWAL_RETRY_DAYS = [1, 3] as const;

const DAY_MS = 86_400_000;

/**
 * Cuándo reintentar tras un fallo, sabiendo cuántos fallos hubo antes (`attemptsSoFar`: 0 en el
 * primero). null = no hay más intentos: se cancela.
 */
export function nextRenewalAttempt(attemptsSoFar: number, now: Date): Date | null {
  if (attemptsSoFar < 0 || attemptsSoFar >= RENEWAL_RETRY_DAYS.length) return null;
  return new Date(now.getTime() + RENEWAL_RETRY_DAYS[attemptsSoFar] * DAY_MS);
}

/** Identifica el periodo que se cobra (metadatos de la pasarela y claves de idempotencia). */
export function renewalPeriodKey(currentPeriodEnd: Date): string {
  return currentPeriodEnd.toISOString();
}
