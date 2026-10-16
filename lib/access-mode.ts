/**
 * Cómo se consigue un producto (Product.accessMode):
 *   · PAID: se paga en la web (Stripe, PayPal o el simulador) y el acceso llega solo. En la
 *     plataforma siempre; en la web personal, solo si tiene pasarela (PAYMENT_PROVIDER≠none).
 *   · FREE_EMAIL: gratis con nombre + email. Crea un pedido de 0 € (paymentProvider «free») y da el
 *     acceso por el mismo camino que una compra (lib/free-access.ts → fulfillOrder).
 *   · EXTERNAL: se paga fuera (Hotmart, PayPal, Calendly…). El botón lleva a externalUrl; si el
 *     contenido está aquí, la dueña da el acceso a mano desde el panel (paymentProvider «manual»).
 *
 * Puro (sin BD ni `server-only`): lo usan el panel, la ficha pública, los componentes de cliente y
 * las pruebas unitarias.
 */
import { safeHref } from "./page-config";
import type { SiteMode } from "./site-mode";

export const ACCESS_MODES = ["PAID", "FREE_EMAIL", "EXTERNAL"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const ACCESS_MODE_LABEL: Record<AccessMode, string> = {
  PAID: "Pago en la web",
  FREE_EMAIL: "Gratis con email",
  EXTERNAL: "Pago en otra web",
};

export const ACCESS_MODE_HINT: Record<AccessMode, string> = {
  PAID: "Se cobra aquí y el acceso (o la reserva) llega solo al pagar.",
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
 * Modos que ofrece el formulario del producto. En la plataforma, lo de siempre (de pago). En la web
 * personal, lo gratuito con email (salvo las sesiones) y lo que se paga fuera y, si la web cobra
 * (`sells`: tiene Stripe y/o PayPal), también el pago en la web, que va primero.
 */
export function accessModesFor(mode: SiteMode, type: string, sells = false): AccessMode[] {
  if (mode !== "personal") return ["PAID"];
  const offSite: AccessMode[] = hostsContent(type) ? ["FREE_EMAIL", "EXTERNAL"] : ["EXTERNAL"];
  return sells ? ["PAID", ...offSite] : offSite;
}

/** Modo de un producto nuevo. */
export function defaultAccessMode(mode: SiteMode, type: string, sells = false): AccessMode {
  return accessModesFor(mode, type, sells)[0];
}

/**
 * Modo que se guarda al editar: el pedido si está permitido o si es el que ya tiene; si no, el
 * actual si lo está; si no, el primero permitido. Nada cambia de modo sin elegirlo: en la plataforma
 * un producto gratis o externo ya existente (p. ej. de la demo) conserva su modo, y en la web
 * personal un producto de pago en la web sigue de pago (y oculto) hasta que la dueña elija otro,
 * en vez de regalarse al guardar cualquier otro cambio.
 */
export function resolveAccessMode(requested: string | null | undefined, current: string | null | undefined, mode: SiteMode, type: string, sells = false): AccessMode {
  const allowed = accessModesFor(mode, type, sells);
  const want = requested ? asAccessMode(requested) : null;
  const now = asAccessMode(current);
  if (want && (allowed.includes(want) || want === now)) return want;
  if (allowed.includes(now) || mode !== "personal" || !want) return now;
  return allowed[0];
}

/** Modos que enseña el formulario: los permitidos y, si no lo está, el que ya tiene (para conservarlo). */
export function accessModeOptions(allowed: readonly AccessMode[], current: AccessMode): AccessMode[] {
  return allowed.includes(current) ? [...allowed] : [current, ...allowed];
}

/** En la web personal sin cobros, lo que se cobraba en la web no se ve: se explica así en el formulario. */
export const HIDDEN_PAID_LABEL = "Oculto: se cobraba en la web";
export const HIDDEN_PAID_HINT = "Tu web no tiene activados los cobros, así que nadie lo ve. Elige otra opción para que aparezca.";

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

/**
 * ¿Lleva este enlace a la ficha de uno de estos productos de la creadora? («/ana/slug»,
 * «/ana/slug/checkout» o, si se conoce la dirección de la web, «https://tudominio.com/ana/slug»,
 * «tudominio.com/ana/slug» o con www). Se lee como lo pintará la página (safeHref). En la web
 * personal así no se enseñan botones que llevan a un producto oculto («no encontrada»).
 */
export function linksToProduct(url: string, username: string, slugs: ReadonlySet<string>, siteOrigin?: string | null): boolean {
  if (!slugs.size) return false;
  const href = safeHref(url);
  let path: string;
  if (href.startsWith("/") && !href.startsWith("//")) path = href;
  else {
    if (!siteOrigin) return false;
    try {
      const origin = new URL(siteOrigin);
      const u = new URL(href, origin);
      const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");
      if (!u.host || bare(u.host) !== bare(origin.host)) return false;
      path = u.pathname;
    } catch {
      return false;
    }
  }
  const [user, slug] = path.split(/[?#]/)[0].split("/").filter(Boolean);
  return !!user && !!slug && user.toLowerCase() === username.toLowerCase() && slugs.has(slug.toLowerCase());
}
