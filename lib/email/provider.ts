import { env } from "../env";
import { parseFromAddress } from "../reliability";
import { logProvider } from "./providers/log";
import { resendProvider } from "./providers/resend";

/**
 * Proveedor de envío de emails (EMAIL_PROVIDER):
 *   · "log"    → desarrollo y demo: no envía nada (los emails se leen en /dev/correo) y simula
 *                fallos con direcciones +fallo (transitorio) y +rebote (permanente).
 *   · "resend" → producción: API de Resend por fetch, con Idempotency-Key.
 * lib/env.ts impide usar "log" en producción y exige RESEND_API_KEY y EMAIL_FROM con "resend".
 */

export type OutgoingEmail = {
  id: string;
  to: string;
  subject: string;
  html: string;
  /** Nombre visible del remitente (p. ej. la creadora). La dirección es siempre la de la plataforma. */
  fromName?: string | null;
  replyTo?: string | null;
  /** Cabeceras extra (List-Unsubscribe…). Resend las envía tal cual; el registro local las ignora. */
  headers?: Record<string, string>;
  /** Dirección elegida en el panel (dominio propio verificado). Si no, la de la configuración. */
  fromAddress?: string | null;
  /** news = newsletter: sale desde NEWSLETTER_FROM si está configurado. */
  stream?: "tx" | "news";
};

export type SendResult = { ok: true; providerId?: string } | { ok: false; kind: "retry" | "permanent"; error: string };

export interface EmailProvider {
  key: "log" | "resend";
  send(msg: OutgoingEmail): Promise<SendResult>;
}

let cached: EmailProvider | undefined;

export function emailProvider(): EmailProvider {
  if (cached) return cached;
  const e = env();
  if (e.EMAIL_PROVIDER === "resend") {
    // Sin alternativa silenciosa: con Resend mal configurado, el envío falla y se reintenta.
    if (!e.RESEND_API_KEY || !e.EMAIL_FROM) throw new Error("EMAIL_PROVIDER=resend requiere RESEND_API_KEY y EMAIL_FROM");
    const from = parseFromAddress(e.EMAIL_FROM);
    // Newsletter desde otra dirección (o subdominio) si se configura; si no, la de siempre.
    const news = e.NEWSLETTER_FROM ? parseFromAddress(e.NEWSLETTER_FROM) : null;
    cached = resendProvider({
      apiKey: e.RESEND_API_KEY,
      fromAddress: from.address,
      defaultFromName: from.name ?? "Cirella",
      ...(news ? { newsFromAddress: news.address, newsFromName: news.name ?? undefined } : {}),
    });
  } else {
    cached = logProvider;
  }
  return cached;
}
