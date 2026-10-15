import { MAX_ATTEMPTS } from "./reliability";

/**
 * Texto del estado de reintentos de un email en /admin/envios. Puro; se prueba en
 * scripts/unit/envios.test.ts.
 *
 * Un FAILED con intentos de sobra es un fallo permanente (rebote, dirección rechazada): la bandeja
 * (lib/email/outbox.ts) no lo vuelve a intentar, así que no tiene sentido mostrar «Intento 1 de 6».
 * Solo lo que sigue en cola lleva el contador.
 */
export function emailAttemptLabel(m: { status: string; attempts: number }, max: number = MAX_ATTEMPTS): { text: string; retryable: boolean } {
  if (m.status === "FAILED")
    return m.attempts < max
      ? { text: "Rebote definitivo · no se reintenta", retryable: false }
      : { text: `Sin más reintentos · ${m.attempts} intentos`, retryable: false };
  return { text: `Intento ${m.attempts} de ${max}`, retryable: true };
}
