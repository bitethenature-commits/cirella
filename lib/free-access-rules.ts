/**
 * Reglas puras del acceso sin cobro (lib/free-access.ts) sobre Order.metadata, sin BD ni
 * `server-only`: las usan la entrega, el panel, los emails y las pruebas unitarias.
 *
 *   · revokedAt: la dueña quitó el acceso desde el panel. El formulario público no lo devuelve;
 *     solo ella, dándolo otra vez a mano.
 *   · accessUntil: fin del acceso que puso la dueña al darlo a mano (ISO; el instante en que deja de
 *     tener acceso, lib/access-end.ts) y accessGrantedAt, cuándo lo dio o cambió la fecha. Pasada esa
 *     fecha, el formulario público tampoco lo devuelve.
 *   · newsletterRequested: la persona marcó «Quiero recibir novedades» en el formulario público.
 *     No cuenta como consentimiento hasta que lo confirma desde su email (newsletterConfirmedAt):
 *     cualquiera puede escribir un email ajeno en el formulario (RGPD art. 7.1).
 */

type Meta = Record<string, unknown>;

/** Metadatos de un pedido como objeto (copia): null, arrays o valores sueltos cuentan como vacío. */
export function orderMeta(metadata: unknown): Meta {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...(metadata as Meta) } : {};
}

/** ¿Le quitó la dueña el acceso de este pedido (y no se lo ha vuelto a dar)? */
export function revokedByOwner(metadata: unknown): boolean {
  return typeof orderMeta(metadata).revokedAt === "string";
}

function isoDate(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fin del acceso que puso la dueña (null = sin fecha de fin, o un valor que no es una fecha). */
export function accessUntil(metadata: unknown): Date | null {
  return isoDate(orderMeta(metadata).accessUntil);
}

/** Cuándo dio el acceso (o cambió su fecha) la dueña: cuenta para el aviso de 7 días antes. */
export function accessGrantedAt(metadata: unknown): Date | null {
  return isoDate(orderMeta(metadata).accessGrantedAt);
}

/**
 * ¿Se queda sin efecto una petición del formulario público sobre este pedido? Si la dueña le quitó
 * el acceso o terminó la fecha de fin que ella puso: volver a apuntarse no lo devuelve (la
 * respuesta del formulario es la misma).
 */
export function publicClaimBlocked(existing: { status: string; metadata: unknown }, now = new Date()): boolean {
  if (existing.status !== "PAID") return false;
  if (revokedByOwner(existing.metadata)) return true;
  const until = accessUntil(existing.metadata);
  return !!until && until <= now;
}

export function newsletterRequested(metadata: unknown): boolean {
  return orderMeta(metadata).newsletterRequested === true;
}

/** Pidió las novedades y todavía no lo ha confirmado (ni las recibe ya por otra vía). */
export function newsletterPending(metadata: unknown, optedIn: boolean): boolean {
  const meta = orderMeta(metadata);
  return !optedIn && meta.newsletterRequested === true && typeof meta.newsletterConfirmedAt !== "string";
}

/** Página donde confirma las novedades (se abre con el enlace personal del email de acceso). */
export const NEWSLETTER_CONFIRM_PATH = "/cuenta/novedades/confirmar";

export function newsletterConfirmPath(orderId: string): string {
  return `${NEWSLETTER_CONFIRM_PATH}?pedido=${encodeURIComponent(orderId)}`;
}

/**
 * Nombre del saludo del email de acceso: no el del formulario público gratis, donde cualquiera
 * escribe cualquier cosa como nombre y el email sale del dominio de la dueña. El acceso a mano
 * (lo escribe ella) y una compra sí lo llevan.
 */
export function accessEmailGreetingName(order: { paymentProvider: string; buyerName: string | null }): string | null {
  return order.paymentProvider === "free" ? null : order.buyerName;
}
