import { z } from "zod";

/**
 * Datos de los enlaces de alta y de cambio de email (LoginToken.data). Puro: lo usan
 * lib/magic-links.ts y las pruebas unitarias.
 */

/** «Crear mi cuenta» (web personal): lo que se aplica al confirmar el email. */
export type RegisterData = { name: string; newsletter: boolean; creatorId: string };
/** Cambio de email: de qué cuenta y desde qué dirección (para no aplicar un cambio viejo). */
export type EmailChangeData = { userId: string; fromEmail: string };

// Se leen con .catch(): un dato estropeado nunca rompe el enlace (se trata como si no hubiera datos).
const registerSchema = z
  .object({ name: z.string().trim().max(80), newsletter: z.boolean(), creatorId: z.string().min(1) })
  .nullable()
  .catch(null);
const emailChangeSchema = z
  .object({ userId: z.string().min(1), fromEmail: z.string().email() })
  .nullable()
  .catch(null);

export function readRegisterData(raw: unknown): RegisterData | null {
  return registerSchema.parse(raw ?? null);
}
export function readEmailChangeData(raw: unknown): EmailChangeData | null {
  return emailChangeSchema.parse(raw ?? null);
}

