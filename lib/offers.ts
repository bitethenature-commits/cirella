/**
 * Ofertas: cualquier producto (digital, sesión, curso, membresía o taller) puede ponerse en oferta con
 * un precio rebajado, unas fechas opcionales de inicio y de fin y una etiqueta («Early Bird»). Puro (sin
 * BD): lo usan la página pública, la ficha, el checkout, el pedido (lib/orders.ts) y las pruebas.
 *
 *   · Está activa si hay precio de oferta, es menor que el precio normal (y al menos 1 €), ya ha
 *     empezado (o no tiene inicio) y no ha terminado (o no tiene fin). Se mira con la hora de cada
 *     consulta: no hace falta ningún cron para que empiece o termine.
 *   · El importe del pedido lo calcula SIEMPRE el servidor con effectivePriceCents al crear el pedido
 *     (nunca llega del navegador). El pedido guarda el precio normal en Order.metadata.sale para el
 *     recibo y para las membresías: las renovaciones se cobran al precio normal (la oferta es solo
 *     para el primer cobro).
 */
import { z } from "zod";
import { formatInTz } from "./tz";

export const SALE_LABEL_MAX = 30;
/** Precio mínimo de una oferta (como el de publicar un producto de pago). */
export const SALE_MIN_CENTS = 100;

export type SaleFields = {
  priceCents: number;
  salePriceCents: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  saleLabel?: string | null;
};

export type SaleState = {
  /** La oferta vale ahora mismo. */
  active: boolean;
  /** Lo que se cobra ahora (el de oferta si está activa; si no, el normal). */
  priceCents: number;
  /** El precio normal (el que sale tachado). */
  regularCents: number;
  /** Rebaja redondeada («−20 %»), solo con la oferta activa. */
  percentOff: number | null;
  label: string | null;
  endsAt: Date | null;
  /** Programada: tiene precio de oferta pero aún no ha empezado. */
  upcoming: boolean;
};

/** ¿La oferta está configurada con un precio válido (menor que el normal)? */
export function hasValidSalePrice(p: Pick<SaleFields, "priceCents" | "salePriceCents">): boolean {
  return p.salePriceCents != null && p.salePriceCents >= SALE_MIN_CENTS && p.salePriceCents < p.priceCents;
}

export function saleState(p: SaleFields, now = new Date()): SaleState {
  const valid = hasValidSalePrice(p);
  const started = !p.saleStartsAt || p.saleStartsAt <= now;
  const notEnded = !p.saleEndsAt || p.saleEndsAt > now;
  const active = valid && started && notEnded;
  return {
    active,
    priceCents: active ? p.salePriceCents! : p.priceCents,
    regularCents: p.priceCents,
    percentOff: active ? Math.round((1 - p.salePriceCents! / p.priceCents) * 100) : null,
    label: active ? p.saleLabel?.trim() || null : null,
    endsAt: active ? p.saleEndsAt : null,
    upcoming: valid && !started && notEnded,
  };
}

/** Importe que se cobra ahora por el producto (con la oferta si está activa). */
export function effectivePriceCents(p: SaleFields, now = new Date()): number {
  return saleState(p, now).priceCents;
}

/** Lo que el pedido guarda de la oferta (Order.metadata.sale) para el recibo y las renovaciones. */
export type OrderSaleMeta = { regularCents: number; label: string | null };

export function orderSaleMeta(p: SaleFields, now = new Date()): OrderSaleMeta | null {
  const s = saleState(p, now);
  return s.active ? { regularCents: s.regularCents, label: s.label } : null;
}

/** Lee Order.metadata.sale (tolerante: un dato raro es «sin oferta»). */
export function readOrderSale(metadata: unknown): OrderSaleMeta | null {
  const sale = metadata && typeof metadata === "object" ? (metadata as { sale?: unknown }).sale : null;
  if (!sale || typeof sale !== "object") return null;
  const r = sale as { regularCents?: unknown; label?: unknown };
  if (typeof r.regularCents !== "number" || !Number.isInteger(r.regularCents) || r.regularCents <= 0) return null;
  return { regularCents: r.regularCents, label: typeof r.label === "string" ? r.label : null };
}

/**
 * Precio de las renovaciones de una membresía comprada en oferta: el normal del momento de la compra
 * (el pedido lo guarda). Sin oferta, lo que se pagó.
 */
export function renewalPriceCents(order: { amountCents: number; metadata: unknown }): number {
  return readOrderSale(order.metadata)?.regularCents ?? order.amountCents;
}

/** «hasta el 10 de noviembre» (en la zona de la creadora); null sin fecha de fin. */
export function saleEndsLabel(endsAt: Date | null, timeZone: string): string | null {
  if (!endsAt) return null;
  // El fin es exclusivo: una oferta que termina a las 00:00 del día 11 dura «hasta el 10».
  const last = new Date(endsAt.getTime() - 1);
  return `hasta el ${formatInTz(last, timeZone, { day: "numeric", month: "long" })}`;
}

/** Formulario del panel (campos de texto). Fechas «AAAA-MM-DD» (día entero en la zona de la creadora). */
export const saleFormSchema = z.object({
  saleOn: z.preprocess((v) => v === "on" || v === "1" || v === true, z.boolean()).default(false),
  salePrice: z.string().max(20).optional(),
  saleStart: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "La fecha de inicio de la oferta no es válida")
    .optional(),
  saleEnd: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "La fecha de fin de la oferta no es válida")
    .optional(),
  saleLabel: z.string().trim().max(SALE_LABEL_MAX, `La etiqueta de la oferta admite ${SALE_LABEL_MAX} caracteres`).optional(),
});

/**
 * Comprueba la oferta escrita en el panel. `starts`/`ends` ya convertidos a fechas (inicio del día de
 * inicio y fin del día de fin en la zona de la creadora). null = sin oferta.
 */
export function checkSaleInput(i: { on: boolean; priceCents: number; salePriceCents: number | null; starts: Date | null; ends: Date | null }):
  | { ok: true; value: { salePriceCents: number; saleStartsAt: Date | null; saleEndsAt: Date | null } | null }
  | { ok: false; error: string } {
  if (!i.on) return { ok: true, value: null };
  if (i.salePriceCents == null || !Number.isFinite(i.salePriceCents)) return { ok: false, error: "Escribe el precio de la oferta" };
  if (i.salePriceCents < SALE_MIN_CENTS) return { ok: false, error: "El precio de la oferta debe ser de al menos 1 €" };
  if (i.salePriceCents >= i.priceCents) return { ok: false, error: "El precio de la oferta tiene que ser menor que el precio normal" };
  if (i.starts && i.ends && i.ends <= i.starts) return { ok: false, error: "La oferta tiene que terminar después de empezar" };
  return { ok: true, value: { salePriceCents: i.salePriceCents, saleStartsAt: i.starts, saleEndsAt: i.ends } };
}
