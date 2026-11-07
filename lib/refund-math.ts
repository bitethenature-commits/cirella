import { formatMoney, parseMoneyToCents } from "./money";
import { ORDER_STATUS_LABEL } from "./types";
import { DEFAULT_OWNER_TZ, membershipWithdrawalRefund, WITHDRAWAL_DAYS, withdrawalDeadline, type MembershipRefund } from "./withdrawal";

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

export { WITHDRAWAL_DAYS };

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
  /** La compradora renunció expresamente al desistimiento en el checkout y ya ha empezado a acceder. */
  withdrawalWaived: boolean;
  hasPendingRefund: boolean;
  booking?: { status: string; startAt: Date | null } | null;
  /** La dueña ya le ha entregado la lectura preparada para ella (Order.deliveredAt). */
  delivered?: boolean;
  /** Zona de la dueña: los 14 días se cuentan en ella (lib/withdrawal.ts). Por defecto, Madrid. */
  timezone?: string | null;
  /** Casilla marcada en el checkout (Order.waiverKind): un taller comprado con WORKSHOP_FIXED_DATE no se desiste. */
  waiverKind?: string | null;
  /**
   * Membresía: la suscripción que creó este pedido (Subscription.orderId). Sin ella (o ya terminada)
   * no hay nada que desistir; si ya se ha renovado, el pedido inicial no da derecho (las renovaciones no lo tienen).
   */
  membership?: MembershipTerms | null;
};

/** Estado de la suscripción de un pedido de membresía, para su desistimiento. */
export type MembershipTerms = { periodStart: Date; periodEnd: Date; live: boolean; renewed: boolean };

export type WithdrawalBlock =
  | "NOT_PAID"
  | "EXPIRED"
  | "WAIVED"
  | "SESSION_HELD"
  | "ALREADY_REFUNDED"
  | "PENDING"
  | "DELIVERED"
  | "WORKSHOP"
  | "MEMBERSHIP_ENDED"
  | "RENEWED";

/**
 * Primer acceso de la compradora al contenido (descarga, reproducción o publicaciones), anotado en
 * Order.metadata.firstAccessAt por markFirstAccess (lib/buyer-access.ts). null si aún no ha entrado.
 */
export function accessStartedAt(metadata: unknown): Date | null {
  const raw = metadata && typeof metadata === "object" ? (metadata as { firstAccessAt?: unknown }).firstAccessAt : null;
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Datos de un pedido (con sus reservas y reembolsos) → lo que mira withdrawalEligibility. */
export function toWithdrawalInput(o: {
  status: string;
  paidAt: Date | null;
  productType: string;
  amountCents: number;
  refundedCents: number;
  waiverAcceptedAt: Date | null;
  /** Versión del texto aceptado: sin ella, es una renuncia de antes de 2026-10-25 (ver abajo). */
  waiverVersion?: string | null;
  metadata?: unknown;
  deliveredAt?: Date | null;
  bookings: { status: string; startAt: Date | null }[];
  refunds: { status: string }[];
  /** Zona de la dueña (Creator.timezone). */
  timezone?: string | null;
  waiverKind?: string | null;
  /** Membresía: su suscripción (lib/refunds.ts → membershipTermsFor). */
  membership?: MembershipTerms | null;
}): WithdrawalInput {
  // Renuncia del checkout actual (con versión): «quiero acceder ya / que se prepare ya y pierdo el
  // derecho», que cuenta desde el pago porque el acceso (o la preparación) empieza al pagar.
  // Las de antes decían «al empezar el acceso o la descarga» (art. 103.m): solo cuentan desde que
  // abrió algo. En las sesiones manda la reserva.
  const waived =
    !!o.waiverAcceptedAt && (o.productType === "SESSION" || !!o.waiverVersion || accessStartedAt(o.metadata) !== null);
  return {
    status: o.status,
    paidAt: o.paidAt,
    productType: o.productType,
    amountCents: o.amountCents,
    refundedCents: o.refundedCents,
    withdrawalWaived: waived,
    hasPendingRefund: o.refunds.some((r) => r.status === "PENDING"),
    booking: o.bookings[0] ?? null,
    ...(o.deliveredAt ? { delivered: true } : {}),
    ...(o.timezone ? { timezone: o.timezone } : {}),
    ...(o.waiverKind ? { waiverKind: o.waiverKind } : {}),
    ...(o.productType === "MEMBERSHIP" ? { membership: o.membership ?? null } : {}),
  };
}

/**
 * ¿Puede la compradora desistir? (TRLGDCU arts. 102-108; pendiente de validar con la asesoría)
 *   · 14 días naturales desde el pago: hasta las 23:59 del día 14 (el del pago es el día 0) en la
 *     zona de la dueña (lib/withdrawal.ts → withdrawalDeadline);
 *   · los talleres comprados con su casilla (fecha fija, art. 103.l) nunca;
 *   · una sesión ya empezada o realizada no admite desistimiento;
 *   · el contenido digital (también «Lo preparo yo») y los cursos tampoco si renunció expresamente
 *     al desistimiento en el checkout (obligatorio para pagarlos);
 *   · las membresías sí, solo desde el pedido inicial y mientras no se haya renovado: se devuelve la
 *     parte de los días no disfrutados del periodo (art. 108.3, membershipWithdrawalRefund) y la
 *     suscripción termina en ese momento;
 *   · en lo demás se devuelve todo lo que queda por devolver.
 */
export function withdrawalEligibility(
  o: WithdrawalInput,
  now: Date,
): { eligible: true; deadline: Date; amountCents: number; proportional?: MembershipRefund } | { eligible: false; reason: WithdrawalBlock } {
  if (o.status === "REFUNDED") return { eligible: false, reason: "ALREADY_REFUNDED" };
  if (o.status !== "PAID" || !o.paidAt) return { eligible: false, reason: "NOT_PAID" };
  if (o.hasPendingRefund) return { eligible: false, reason: "PENDING" };
  if (o.productType === "SESSION" && o.waiverKind === "WORKSHOP_FIXED_DATE") return { eligible: false, reason: "WORKSHOP" };
  const deadline = withdrawalDeadline(o.paidAt, o.timezone || DEFAULT_OWNER_TZ);
  if (now > deadline) return { eligible: false, reason: "EXPIRED" };
  if (o.productType === "SESSION" && o.booking && (o.booking.status === "COMPLETED" || (o.booking.startAt && o.booking.startAt <= now)))
    return { eligible: false, reason: "SESSION_HELD" };
  // Lectura preparada para ella y ya entregada: sus condiciones dicen «mientras no la recibas».
  if (o.productType === "DIGITAL" && o.delivered) return { eligible: false, reason: "DELIVERED" };
  const remaining = o.amountCents - o.refundedCents;
  if (o.productType === "MEMBERSHIP") {
    const m = o.membership;
    if (!m || !m.live || m.periodEnd <= now) return { eligible: false, reason: "MEMBERSHIP_ENDED" };
    if (m.renewed) return { eligible: false, reason: "RENEWED" };
    const proportional = membershipWithdrawalRefund({ amountCents: o.amountCents, periodStart: m.periodStart, periodEnd: m.periodEnd, now, timezone: o.timezone });
    const amountCents = Math.min(remaining, proportional.refundCents);
    if (amountCents <= 0) return { eligible: false, reason: "ALREADY_REFUNDED" };
    return { eligible: true, deadline, amountCents, proportional };
  }
  if (["DIGITAL", "COURSE"].includes(o.productType) && o.withdrawalWaived) return { eligible: false, reason: "WAIVED" };
  if (remaining <= 0) return { eligible: false, reason: "ALREADY_REFUNDED" };
  return { eligible: true, deadline, amountCents: remaining };
}

/**
 * Cifras de un pedido descontando lo reembolsado. `counts` = cuenta como venta en las estadísticas
 * (pagado y no devuelto del todo). Lo usan el panel, el admin y los informes.
 */
export function orderFigures(o: {
  status: string;
  amountCents: number;
  platformFeeCents: number;
  refundedCents: number;
  refundedFeeCents: number;
}) {
  const settled = o.status === "PAID" || o.status === "REFUNDED";
  const gross = settled ? o.amountCents - o.refundedCents : 0;
  const fee = settled ? o.platformFeeCents - o.refundedFeeCents : 0;
  return {
    gross,
    fee,
    net: gross - fee,
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
