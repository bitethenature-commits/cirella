/**
 * Reglas de la newsletter, sin dependencias de servidor (las usan el panel, lib/newsletter.ts, el
 * envío y las pruebas unitarias: scripts/unit/newsletter.test.ts).
 */
import { z } from "zod";

export const SUBSCRIBER_STATUSES = ["PENDING", "CONFIRMED", "UNSUBSCRIBED", "BOUNCED", "COMPLAINED"] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export const SUBSCRIBER_SOURCES = ["FORM", "FREEBIE", "CHECKOUT", "SIGNUP", "PROFILE", "IMPORT", "MIGRATED", "MANUAL"] as const;
export type SubscriberSource = (typeof SUBSCRIBER_SOURCES)[number];

export const STATUS_LABEL: Record<SubscriberStatus, string> = {
  PENDING: "Sin confirmar",
  CONFIRMED: "Confirmada",
  UNSUBSCRIBED: "Dada de baja",
  BOUNCED: "Rebotado",
  COMPLAINED: "Marcó como spam",
};

export const SOURCE_LABEL: Record<SubscriberSource, string> = {
  FORM: "Formulario de tu página",
  FREEBIE: "Contenido gratis",
  CHECKOUT: "Compra",
  SIGNUP: "Al crear su cuenta",
  PROFILE: "Desde su perfil",
  IMPORT: "Importada",
  MIGRATED: "Casilla de antes",
  MANUAL: "Añadida a mano",
};

export type UnsubscribeVia = "LINK" | "ONE_CLICK" | "PROFILE" | "OWNER" | "BOUNCE" | "COMPLAINT" | "BLOCK";

/** Solo a las confirmadas (doble opt-in): nunca a las pendientes, dadas de baja o con rebote/queja. */
export function canSend(status: string): boolean {
  return status === "CONFIRMED";
}

/**
 * Texto exacto que se guarda como prueba del consentimiento (RGPD art. 7.1) en cada alta desde un
 * formulario. Si cambia, cambia para las altas nuevas: las de antes conservan el suyo.
 */
export function newsletterConsentText(creatorName: string): string {
  return `Quiero recibir por email la newsletter de ${creatorName} (novedades, lecturas y ofertas). Puedo darme de baja cuando quiera con el enlace de cada email.`;
}

// ── A quién va una newsletter ──

export type Segment = { kind: "all" } | { kind: "product"; productId: string } | { kind: "member" };

const segmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("product"), productId: z.string().min(1).max(40) }),
  z.object({ kind: z.literal("member") }),
]);

/** A quién va una newsletter (tolerante: lo que no se entiende es «todas»). */
export function parseSegment(raw: unknown): Segment {
  const r = segmentSchema.safeParse(raw);
  return r.success ? r.data : { kind: "all" };
}

// ── Ritmo de envío ──

/**
 * Cuántos emails masivos pueden salir ahora: el límite diario menos la reserva para los
 * transaccionales y lo ya enviado en las últimas 24 h. cap 0 = sin límite.
 */
export function dailyBudget(o: { cap: number; reserve: number; sentLast24h: number }): number {
  if (o.cap <= 0) return Infinity;
  return Math.max(0, o.cap - Math.max(0, o.reserve) - o.sentLast24h);
}

/** Días que tardará en salir lo que queda con `perDay` al día (1 = hoy). */
export function etaDays(remaining: number, perDay: number): number {
  if (remaining <= 0) return 0;
  if (!Number.isFinite(perDay)) return 1;
  if (perDay <= 0) return Infinity;
  return Math.ceil(remaining / perDay);
}

/** «Se enviará a 1 persona» / «a 214 personas». */
export function peopleCount(n: number): string {
  return `${n.toLocaleString("es-ES")} ${n === 1 ? "persona" : "personas"}`;
}
