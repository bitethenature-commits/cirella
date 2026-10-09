import { classifyHttpFailure, formatFrom, truncateError } from "../../reliability";
import type { EmailProvider, OutgoingEmail } from "../provider";

/**
 * Resend por su API HTTP (sin SDK). La cabecera Idempotency-Key (email-{id}) hace que, si un
 * envío se repite porque el proceso cayó antes de marcarlo como enviado, Resend no lo duplique
 * (la ventana de 24 h cubre todos los reintentos, de 1 min a 12 h).
 */

type ResendConfig = { apiKey: string; fromAddress: string; defaultFromName: string };

const TIMEOUT_MS = 10_000;

/** Petición HTTP para enviar `msg` (pura, para poder probarla). */
export function buildResendRequest(msg: OutgoingEmail, cfg: ResendConfig) {
  return {
    url: "https://api.resend.com/emails",
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `email-${msg.id}`,
      },
      body: JSON.stringify({
        from: formatFrom(msg.fromName || cfg.defaultFromName, cfg.fromAddress),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    } satisfies RequestInit,
  };
}

export function resendProvider(cfg: ResendConfig): EmailProvider {
  return {
    key: "resend",
    async send(msg) {
      const { url, init } = buildResendRequest(msg, cfg);
      try {
        const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.ok) {
          const json = (await res.json().catch(() => ({}))) as { id?: string };
          return { ok: true, providerId: json.id };
        }
        const text = await res.text().catch(() => "");
        return { ok: false, kind: classifyHttpFailure(res.status), error: `Resend ${res.status}: ${truncateError(text, 300)}` };
      } catch (e) {
        // Red caída o timeout: puede ir bien en el siguiente intento.
        return { ok: false, kind: "retry", error: `Resend sin respuesta: ${truncateError(e, 300)}` };
      }
    },
  };
}
