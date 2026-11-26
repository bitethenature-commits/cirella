import { appSecret, appUrl } from "./env";
import { signToken, verifyToken } from "./storage/signing";

/**
 * Enlaces de la newsletter, como lib/community-optout.ts: firmados con APP_SECRET, con su propio
 * propósito (un enlace de otra baja no sirve aquí) y solo con el id de la suscriptora (nunca el
 * email). No dan acceso a ninguna cuenta.
 *   · Confirmar el alta (doble opt-in): /newsletter/confirm?t=…, 7 días.
 *   · Darse de baja: /unsubscribe/newsletter?t=… y la baja «en un clic» (RFC 8058) de la cabecera
 *     List-Unsubscribe, 5 años (tiene que funcionar cuando encuentre un email antiguo). Lleva la
 *     campaña de la que viene para contar las bajas de cada newsletter.
 */

const CONFIRM = "alta-newsletter";
const UNSUB = "baja-newsletter";
const CONFIRM_TTL = 7 * 24 * 3600;
const UNSUB_TTL = 5 * 365 * 24 * 3600;

export function confirmToken(subscriberId: string, now = Date.now()) {
  return signToken({ p: CONFIRM, s: subscriberId }, appSecret(), CONFIRM_TTL, now);
}

export function confirmUrl(subscriberId: string) {
  return `${appUrl()}/newsletter/confirm?t=${encodeURIComponent(confirmToken(subscriberId))}`;
}

export function readConfirmToken(token: string | null | undefined, now = Date.now()): string | null {
  const t = verifyToken<{ p?: unknown; s?: unknown }>(token, appSecret(), now);
  return t && t.p === CONFIRM && typeof t.s === "string" && t.s ? t.s : null;
}

export function unsubscribeToken(subscriberId: string, campaignId?: string | null, now = Date.now()) {
  return signToken({ p: UNSUB, s: subscriberId, ...(campaignId ? { c: campaignId } : {}) }, appSecret(), UNSUB_TTL, now);
}

export function unsubscribeUrl(subscriberId: string, campaignId?: string | null) {
  return `${appUrl()}/unsubscribe/newsletter?t=${encodeURIComponent(unsubscribeToken(subscriberId, campaignId))}`;
}

export function oneClickUrl(subscriberId: string, campaignId?: string | null) {
  return `${appUrl()}/unsubscribe/newsletter/one-click?t=${encodeURIComponent(unsubscribeToken(subscriberId, campaignId))}`;
}

/** Botón «Cancelar suscripción» del propio gestor de correo (Gmail y Yahoo lo exigen a los envíos masivos). */
export function unsubscribeHeaders(subscriberId: string, campaignId?: string | null): Record<string, string> {
  return { "List-Unsubscribe": `<${oneClickUrl(subscriberId, campaignId)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

export function readUnsubscribeToken(token: string | null | undefined, now = Date.now()): { s: string; c?: string } | null {
  const t = verifyToken<{ p?: unknown; s?: unknown; c?: unknown }>(token, appSecret(), now);
  if (!t || t.p !== UNSUB || typeof t.s !== "string" || !t.s) return null;
  return { s: t.s, ...(typeof t.c === "string" && t.c ? { c: t.c } : {}) };
}
