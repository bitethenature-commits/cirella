/**
 * Modo del sitio (SITE_MODE, lo valida lib/env.ts):
 *   · platform (por defecto): Cirella como plataforma para muchas creadoras, igual que siempre.
 *   · personal: la web de una sola dueña (OWNER_USERNAME). Su página es la portada y no hay registro
 *     de otras creadoras. Cobra con su propia cuenta de Stripe y/o PayPal (PAYMENT_PROVIDER=stripe,paypal)
 *     o no cobra nada en la web (PAYMENT_PROVIDER=none): entonces lo de pago se cobra fuera.
 *
 * Es el único sitio que decide el modo: el resto del código pregunta con isPersonalMode() y, si
 * necesita a la dueña, con getOwnerCreator().
 *
 * Las funciones puras (resolveSiteMode, resolveOwnerUsername) no tocan process.env ni la BD, así
 * que se prueban sin servidor. La BD se importa solo dentro de getOwnerCreator, para que este
 * módulo se pueda usar desde cualquier sitio (también scripts de tsx).
 */
import { cache } from "react";
import { env } from "./env";
import { normalizeUsername } from "./slug";

export const SITE_MODES = ["platform", "personal"] as const;
export type SiteMode = (typeof SITE_MODES)[number];

/** «personal» solo si se pide expresamente; sin valor (o con cualquier otro) es la plataforma. */
export function resolveSiteMode(value: string | null | undefined): SiteMode {
  return value?.trim() === "personal" ? "personal" : "platform";
}

/** Usuario de la dueña normalizado (minúsculas, sin @ ni espacios). null en la plataforma o si falta. */
export function resolveOwnerUsername(mode: SiteMode, value: string | null | undefined): string | null {
  if (mode !== "personal") return null;
  const username = normalizeUsername(value ?? "");
  return username || null;
}

export function siteMode(): SiteMode {
  return resolveSiteMode(env().SITE_MODE);
}

export function isPersonalMode() {
  return siteMode() === "personal";
}

/** El nombre de la sección de la gente (/panel/clientes): «Personas» en la web personal, «Clientes» en la plataforma. */
export function peopleLabel() {
  return isPersonalMode() ? "Personas" : "Clientes";
}

/**
 * Usuario de la dueña de la web. null en modo plataforma. En modo personal es obligatorio (assertEnv
 * no deja arrancar sin él): si aun así falta, se lanza en vez de enseñar la web de otra persona.
 */
export function ownerUsername(): string | null {
  const mode = siteMode();
  if (mode !== "personal") return null;
  const username = resolveOwnerUsername(mode, env().OWNER_USERNAME);
  if (!username) throw new Error("Falta OWNER_USERNAME: el usuario de la dueña de la web (SITE_MODE=personal).");
  return username;
}

/**
 * La creadora dueña de la web (una consulta por petición gracias a cache). null en modo plataforma
 * o si todavía no existe su cuenta.
 */
export const getOwnerCreator = cache(async () => {
  const username = ownerUsername();
  if (!username) return null;
  const { prisma } = await import("./db");
  return prisma.creator.findUnique({
    where: { username },
    include: { user: { select: { id: true, email: true, name: true, status: true } } },
  });
});
