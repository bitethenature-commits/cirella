import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook de Resend (firmado con Svix): lo que pasa con cada email después de enviarlo. Puro para
 * poder probarlo (scripts/unit/newsletter.test.ts); lo usa app/api/webhooks/resend/route.ts.
 *
 * Firma: cabeceras svix-id, svix-timestamp y svix-signature («v1,<base64> v1,<base64>…»), HMAC-SHA256
 * de «{id}.{timestamp}.{cuerpo}» con el secreto (lo que va detrás de «whsec_», en base64). Se
 * rechaza lo que tenga más de 5 minutos (un aviso capturado no se puede repetir más tarde).
 */

const TOLERANCE_SEC = 5 * 60;

export function signResendWebhook(secret: string, id: string, timestamp: string, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function verifyResendWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSec - Number(timestamp)) > TOLERANCE_SEC) return false;
  const want = Buffer.from(signResendWebhook(secret, id, timestamp, body));
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig);
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

export type ResendEvent =
  | { kind: "delivered" | "opened" | "complained"; emailId: string }
  | { kind: "clicked"; emailId: string; link: string | null }
  | { kind: "bounced"; emailId: string; permanent: boolean }
  | { kind: "ignored" };

/** Lo que nos importa de un aviso (los demás tipos se ignoran). */
export function readResendEvent(payload: unknown): ResendEvent {
  const p = payload as { type?: unknown; data?: { email_id?: unknown; bounce?: { type?: unknown }; click?: { link?: unknown } } } | null;
  const emailId = typeof p?.data?.email_id === "string" ? p.data.email_id : null;
  if (!p || !emailId) return { kind: "ignored" };
  switch (p.type) {
    case "email.delivered":
      return { kind: "delivered", emailId };
    case "email.opened":
      return { kind: "opened", emailId };
    case "email.clicked":
      return { kind: "clicked", emailId, link: typeof p.data?.click?.link === "string" && /^https?:\/\//i.test(p.data.click.link) ? p.data.click.link.slice(0, 1000) : null };
    case "email.complained":
      return { kind: "complained", emailId };
    case "email.bounced":
      // Solo el rebote permanente (la dirección no existe) da de baja; uno temporal (buzón lleno), no.
      return { kind: "bounced", emailId, permanent: p.data?.bounce?.type !== "Transient" && p.data?.bounce?.type !== "Undetermined" };
    default:
      return { kind: "ignored" };
  }
}
