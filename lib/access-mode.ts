/**
 * Cómo se consigue un producto (Product.accessMode):
 *   · PAID: se paga en la web (Stripe o el simulador). Solo en modo plataforma.
 *   · FREE_EMAIL: gratis con nombre + email. Crea un pedido de 0 € (paymentProvider «free») y da el
 *     acceso por el mismo camino que una compra (lib/free-access.ts → fulfillOrder).
 *   · EXTERNAL: se paga fuera (Hotmart, PayPal, Calendly…). El botón lleva a externalUrl; si el
 *     contenido está aquí, la dueña da el acceso a mano desde el panel (paymentProvider «manual»).
 *
 * Puro (sin BD ni `server-only`): lo usan el panel, la ficha pública, los componentes de cliente y
 * las pruebas unitarias.
 */
import type { SiteMode } from "./site-mode";

export const ACCESS_MODES = ["PAID", "FREE_EMAIL", "EXTERNAL"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const ACCESS_MODE_LABEL: Record<AccessMode, string> = {
  PAID: "Pago en la web",
  FREE_EMAIL: "Gratis con email",
  EXTERNAL: "Pago en otra web",
};

export const ACCESS_MODE_HINT: Record<AccessMode, string> = {
  PAID: "Se cobra aquí con tarjeta.",
  FREE_EMAIL: "Nombre y email → acceso al momento y un email con el enlace.",
  EXTERNAL: "El botón lleva a la web donde se paga o se reserva (Hotmart, PayPal, Calendly…).",
};

/** Lo que no es PAID (o un valor desconocido) se trata como PAID: nunca se regala por error. */
export function asAccessMode(v: string | null | undefined): AccessMode {
  return v === "FREE_EMAIL" || v === "EXTERNAL" ? v : "PAID";
}

/** Pedidos sin cobro: «free» (formulario de la ficha) y «manual» (acceso dado desde el panel). */
export const NO_CHARGE_PROVIDERS = ["free", "manual"] as const;
export type NoChargeProvider = (typeof NO_CHARGE_PROVIDERS)[number];

/** Pedido de 0 € sin cobro: sin IVA, comisión, factura, transacción ni reembolso. */
export function isNoChargeOrder(o: { paymentProvider: string }): boolean {
  return (NO_CHARGE_PROVIDERS as readonly string[]).includes(o.paymentProvider);
}

export const NO_CHARGE_LABEL: Record<NoChargeProvider, string> = { free: "Formulario", manual: "Dado por ti" };

/** Se puede dar acceso aquí (gratis o a mano): todo menos las sesiones, que se reservan fuera. */
export function hostsContent(type: string): boolean {
  return type !== "SESSION";
}

/**
 * Modos que ofrece el formulario del producto. En la web personal nada se cobra aquí: lo gratuito
 * con email (salvo las sesiones) o lo que se paga fuera. En la plataforma, lo de siempre.
 */
export function accessModesFor(mode: SiteMode, type: string): AccessMode[] {
  if (mode !== "personal") return ["PAID"];
  return hostsContent(type) ? ["FREE_EMAIL", "EXTERNAL"] : ["EXTERNAL"];
}

/** Modo de un producto nuevo. */
export function defaultAccessMode(mode: SiteMode, type: string): AccessMode {
  return accessModesFor(mode, type)[0];
}

/**
 * Modo que se guarda al editar: el pedido si está permitido; si no, el actual si lo está; si no,
 * el primero permitido. En la plataforma un producto gratis o externo ya existente (p. ej. de la
 * demo) conserva su modo: el formulario no lo enseña y no se cambia sin querer.
 */
export function resolveAccessMode(requested: string | null | undefined, current: string | null | undefined, mode: SiteMode, type: string): AccessMode {
  const allowed = accessModesFor(mode, type);
  const want = requested ? asAccessMode(requested) : null;
  if (want && allowed.includes(want)) return want;
  const now = asAccessMode(current);
  if (allowed.includes(now) || mode !== "personal") return now;
  return allowed[0];
}

/** Error al publicar por el precio (null si vale). Gratis y externo no exigen precio. */
export function publishPriceError(accessMode: AccessMode, priceCents: number): string | null {
  if (accessMode === "PAID" && priceCents < 100) return "Pon un precio de al menos 1 € para publicarlo";
  if (priceCents < 0) return "El precio no puede ser negativo";
  return null;
}

/** Precio que se guarda: lo gratuito siempre a 0 (el precio de un externo es informativo). */
export function storedPriceCents(accessMode: AccessMode, priceCents: number): number {
  return accessMode === "FREE_EMAIL" ? 0 : Math.max(0, priceCents);
}

export const EXTERNAL_URL_MAX = 500;

/** Enlace de la web externa: https obligatoria y un dominio de verdad. */
export function parseExternalUrl(raw: string | null | undefined): { ok: true; url: string } | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "Pega el enlace de la web donde se paga o se reserva" };
  if (value.length > EXTERNAL_URL_MAX) return { ok: false, error: "El enlace es demasiado largo" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "El enlace no es válido: cópialo entero desde la otra web (https://…)" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "El enlace de la web externa debe empezar por https://" };
  if (!url.hostname.includes(".") || url.username || url.password) return { ok: false, error: "El enlace no es válido: cópialo entero desde la otra web (https://…)" };
  return { ok: true, url: url.toString() };
}

/** «hotmart.com» de «https://www.hotmart.com/…». null si no es un enlace válido. */
export function externalHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export const EXTERNAL_LABEL_MAX = 40;

/** Texto del botón si la dueña no escribe otro: «Reservar en calendly.com», «Comprar en hotmart.com». */
export function defaultExternalLabel(type: string, url: string | null | undefined): string {
  const verb = type === "SESSION" ? "Reservar" : "Comprar";
  const host = externalHost(url);
  return host ? `${verb} en ${host}` : verb;
}

export function externalButtonLabel(p: { type: string; externalLabel: string | null; externalUrl: string | null }): string {
  return p.externalLabel?.trim() || defaultExternalLabel(p.type, p.externalUrl);
}

/** Reenvío del enlace de acceso: como mucho uno por minuto y pedido (dos clics seguidos no mandan dos). */
export function resendDedupeKey(orderId: string, now = new Date()): string {
  return `access:${orderId}:reenvio:${Math.floor(now.getTime() / 60_000)}`;
}
