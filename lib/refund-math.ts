import { formatMoney, parseMoneyToCents } from "./money";
import { ORDER_STATUS_LABEL } from "./types";

/**
 * Cuentas de reembolsos y desistimientos. Puro (sin BD): lo usan el servicio de reembolsos
 * (lib/refunds.ts), las páginas y las estadísticas, y se prueba en scripts/unit/refunds.test.ts.
 *
 * Convenciones:
 *   · «reservado» = suma de los reembolsos PENDING y SUCCEEDED de un pedido. Lo FAILED no cuenta,
 *     así que tras un fallo se puede volver a intentar.
 *   · Order.refundedCents / refundedFeeCents = solo lo SUCCEEDED (el dinero que ya ha vuelto).
 *   · Un reembolso parcial deja el pedido en PAID; el total lo pasa a REFUNDED.
 */

export const WITHDRAWAL_DAYS = 14;

export type RefundReason = "CUSTOMER_REQUEST" | "WITHDRAWAL" | "SESSION_CANCELLED" | "DUPLICATE" | "DISPUTE_LOST" | "OTHER";

export const REFUND_REASONS: Record<RefundReason, string> = {
  CUSTOMER_REQUEST: "La clienta lo ha pedido",
  WITHDRAWAL: "Desistimiento (14 días)",
  SESSION_CANCELLED: "Sesión cancelada",
  DUPLICATE: "Cobro duplicado o por error",
  DISPUTE_LOST: "Contracargo perdido",
  OTHER: "Otro motivo",
};

/** Motivos que la creadora puede elegir en «Reembolsar» (el resto los pone el sistema). */
export const CREATOR_REFUND_REASONS = ["DUPLICATE", "CUSTOMER_REQUEST", "WITHDRAWAL", "OTHER"] as const satisfies readonly RefundReason[];

export const REFUND_STATUS_LABEL: Record<string, string> = {
  PENDING: "En curso",
  SUCCEEDED: "Completado",
  FAILED: "Fallido",
};

/** Motivo que se envía a la pasarela. */
export function stripeReason(r: RefundReason): "duplicate" | "requested_by_customer" {
  return r === "DUPLICATE" ? "duplicate" : "requested_by_customer";
}

/** Lo que aún se puede devolver de un pedido. */
export function refundableCents(o: { amountCents: number; reservedCents: number }) {
  return Math.max(0, o.amountCents - o.reservedCents);
}

/**
 * Parte de la comisión de Cirella que se devuelve con un reembolso (en proporción) y lo que sale
 * de la creadora. El último reembolso se lleva el resto exacto de la comisión, para que varios
 * parciales sumen la comisión completa sin errores de redondeo.
 */
export function computeRefundSplit(
  o: { amountCents: number; platformFeeCents: number; reservedCents: number; reservedFeeCents: number },
  refundCents: number,
) {
  const feeLeft = Math.max(0, o.platformFeeCents - o.reservedFeeCents);
  const feeCents =
    o.reservedCents + refundCents >= o.amountCents
      ? feeLeft
      : Math.min(o.amountCents ? Math.round((o.platformFeeCents * refundCents) / o.amountCents) : 0, feeLeft);
  return { feeCents, netCents: refundCents - feeCents };
}

export type WithdrawalInput = {
  status: string;
  paidAt: Date | null;
  productType: string;
  amountCents: number;
  refundedCents: number;
  /** La compradora renunció expresamente al desistimiento en el checkout (acceso inmediato). */
  withdrawalWaived: boolean;
  hasPendingRefund: boolean;
  booking?: { status: string; startAt: Date | null } | null;
};

export type WithdrawalBlock = "NOT_PAID" | "EXPIRED" | "WAIVED" | "SESSION_HELD" | "ALREADY_REFUNDED" | "PENDING";

/** Datos de un pedido (con sus reservas y reembolsos) → lo que mira withdrawalEligibility. */
export function toWithdrawalInput(o: {
  status: string;
  paidAt: Date | null;
  productType: string;
  amountCents: number;
  refundedCents: number;
  waiverAcceptedAt: Date | null;
  bookings: { status: string; startAt: Date | null }[];
  refunds: { status: string }[];
}): WithdrawalInput {
  return {
    status: o.status,
    paidAt: o.paidAt,
    productType: o.productType,
    amountCents: o.amountCents,
    refundedCents: o.refundedCents,
    withdrawalWaived: !!o.waiverAcceptedAt,
    hasPendingRefund: o.refunds.some((r) => r.status === "PENDING"),
    booking: o.bookings[0] ?? null,
  };
}

/**
 * ¿Puede la compradora desistir? (TRLGDCU arts. 102-108; pendiente de validar con la abogada)
 *   · 14 días naturales desde el pago;
 *   · una sesión ya empezada o realizada no admite desistimiento;
 *   · el contenido digital, los cursos y las membresías tampoco si renunció expresamente al
 *     desistimiento para tener acceso inmediato;
 *   · si se puede, se devuelve todo lo que queda por devolver.
 */
export function withdrawalEligibility(
  o: WithdrawalInput,
  now: Date,
): { eligible: true; deadline: Date; amountCents: number } | { eligible: false; reason: WithdrawalBlock } {
  if (o.status === "REFUNDED") return { eligible: false, reason: "ALREADY_REFUNDED" };
  if (o.status !== "PAID" || !o.paidAt) return { eligible: false, reason: "NOT_PAID" };
  if (o.hasPendingRefund) return { eligible: false, reason: "PENDING" };
  const deadline = new Date(o.paidAt.getTime() + WITHDRAWAL_DAYS * 86_400_000);
  if (now > deadline) return { eligible: false, reason: "EXPIRED" };
  if (o.productType === "SESSION" && o.booking && (o.booking.status === "COMPLETED" || (o.booking.startAt && o.booking.startAt <= now)))
    return { eligible: false, reason: "SESSION_HELD" };
  if (["DIGITAL", "COURSE", "MEMBERSHIP"].includes(o.productType) && o.withdrawalWaived) return { eligible: false, reason: "WAIVED" };
  const amountCents = o.amountCents - o.refundedCents;
  if (amountCents <= 0) return { eligible: false, reason: "ALREADY_REFUNDED" };
  return { eligible: true, deadline, amountCents };
}

/**
 * Cifras de un pedido descontando lo reembolsado. `counts` = cuenta como venta en las estadísticas
 * (pagado y no devuelto del todo). Lo usan el panel, el admin y los informes (DAC7, facturas).
 */
export function orderFigures(o: {
  status: string;
  amountCents: number;
  platformFeeCents: number;
  refundedCents: number;
  refundedFeeCents: number;
  /** IVA incluido en el precio y quién lo declara (lib/tax). Si vende Cirella, no es de la creadora. */
  taxCents?: number;
  taxSeller?: string | null;
}) {
  const settled = o.status === "PAID" || o.status === "REFUNDED";
  const gross = settled ? o.amountCents - o.refundedCents : 0;
  const fee = settled ? o.platformFeeCents - o.refundedFeeCents : 0;
  // IVA de lo que queda tras los reembolsos (se devuelve en proporción).
  const tax = o.taxCents && o.amountCents ? Math.round((o.taxCents * gross) / o.amountCents) : 0;
  const platformTax = o.taxSeller === "PLATFORM" ? tax : 0;
  return {
    gross,
    fee,
    tax,
    platformTax,
    net: gross - fee - platformTax,
    refunded: o.refundedCents,
    partial: o.status === "PAID" && o.refundedCents > 0,
    counts: settled && gross > 0,
  };
}

export function orderStatusLabel(o: { status: string; refundedCents: number }) {
  if (o.status === "PAID" && o.refundedCents > 0) return "Reembolsado parcialmente";
  return ORDER_STATUS_LABEL[o.status] ?? o.status;
}

/** Importe que la creadora pide devolver: todo lo que queda o una parte (formato español). */
export function parseRefundAmount(mode: "full" | "partial", raw: string, refundable: number): { ok: true; cents: number } | { ok: false; error: string } {
  if (refundable <= 0) return { ok: false, error: "Este pedido ya está reembolsado" };
  if (mode === "full") return { ok: true, cents: refundable };
  const cents = parseMoneyToCents(raw ?? "");
  if (!Number.isInteger(cents) || cents < 1 || cents > refundable)
    return { ok: false, error: `Escribe un importe entre 0,01 € y ${formatMoney(refundable, "EUR", { decimals: true })}` };
  return { ok: true, cents };
}
