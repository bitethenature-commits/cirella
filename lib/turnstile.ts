import { env } from "./env";

/**
 * Cloudflare Turnstile (captcha invisible), opcional: solo con TURNSTILE_SITE_KEY y
 * TURNSTILE_SECRET_KEY. El checkout lo pide a partir del segundo pago rechazado (lib/limits.ts).
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  const e = env();
  return !!(e.TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY);
}

export function turnstileSiteKey(): string | null {
  return turnstileEnabled() ? env().TURNSTILE_SITE_KEY! : null;
}

/**
 * Comprueba el token del navegador con Cloudflare.
 *   · ok: es una persona.
 *   · invalid: sin token, caducado, reutilizado o no superado.
 *   · unavailable: Cloudflare no responde. Quien llama decide (el checkout deja pasar el pago:
 *     siguen los límites duros y no perdemos ventas por una caída ajena).
 */
export async function verifyTurnstile(token: string | null | undefined, ip: string, fetchImpl: typeof fetch = fetch): Promise<"ok" | "invalid" | "unavailable"> {
  if (!token) return "invalid";
  try {
    const body = new URLSearchParams({ secret: env().TURNSTILE_SECRET_KEY ?? "", response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetchImpl(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      console.warn(`Turnstile no disponible (HTTP ${res.status}): se deja pasar el pago.`);
      return "unavailable";
    }
    const json = (await res.json()) as { success?: boolean };
    return json.success === true ? "ok" : "invalid";
  } catch (e) {
    console.warn("Turnstile no disponible: se deja pasar el pago.", e instanceof Error ? e.message : e);
    return "unavailable";
  }
}
