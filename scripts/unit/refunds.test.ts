import { bookingCancelledEmail, refundIssuedEmail, rescheduleProposalEmail } from "../../lib/email/refund-templates";
import {
  computeRefundSplit,
  orderFigures,
  orderStatusLabel,
  parseRefundAmount,
  refundableCents,
  stripeReason,
  toWithdrawalInput,
  withdrawalEligibility,
  type WithdrawalInput,
} from "../../lib/refund-math";
import { eq, ok, test } from "./harness";

const DAY = 86_400_000;

// Reparto de la comisión: 79 € con 1,58 € de comisión
const order = { amountCents: 7900, platformFeeCents: 158 };
test("computeRefundSplit: un parcial devuelve la comisión en proporción", () =>
  eq(computeRefundSplit({ ...order, reservedCents: 0, reservedFeeCents: 0 }, 2000), { feeCents: 40, netCents: 1960 }));
test("computeRefundSplit: el último parcial se lleva el resto exacto de la comisión", () => {
  const second = computeRefundSplit({ ...order, reservedCents: 2000, reservedFeeCents: 40 }, 5900);
  eq(second, { feeCents: 118, netCents: 5782 });
  eq(40 + second.feeCents, 158);
});
test("computeRefundSplit: un reembolso total devuelve toda la comisión", () =>
  eq(computeRefundSplit({ ...order, reservedCents: 0, reservedFeeCents: 0 }, 7900), { feeCents: 158, netCents: 7742 }));
test("computeRefundSplit: nunca devuelve más comisión de la que queda", () =>
  eq(computeRefundSplit({ ...order, reservedCents: 100, reservedFeeCents: 158 }, 1000).feeCents, 0));

test("refundableCents: lo reservado agota el pedido → 0", () => eq(refundableCents({ amountCents: 7900, reservedCents: 8000 }), 0));
test("refundableCents: resto pendiente", () => eq(refundableCents({ amountCents: 7900, reservedCents: 2000 }), 5900));

// Importe que pide la creadora
test("parseRefundAmount: «20,00» de 79 € → 2000", () => eq(parseRefundAmount("partial", "20,00", 7900), { ok: true, cents: 2000 }));
test("parseRefundAmount: «5» → 500", () => eq(parseRefundAmount("partial", "5", 7900), { ok: true, cents: 500 }));
test("parseRefundAmount: «0» → error", () => eq(parseRefundAmount("partial", "0", 7900).ok, false));
test("parseRefundAmount: texto → error", () => eq(parseRefundAmount("partial", "mucho", 7900).ok, false));
test("parseRefundAmount: más de lo que queda → error con el máximo", () => {
  const r = parseRefundAmount("partial", "80", 7900);
  ok(!r.ok && /79,00\s€/.test(r.error), JSON.stringify(r));
});
test("parseRefundAmount: «todo» → lo que queda", () => eq(parseRefundAmount("full", "", 5900), { ok: true, cents: 5900 }));
test("parseRefundAmount: nada que devolver", () => eq(parseRefundAmount("full", "", 0), { ok: false, error: "Este pedido ya está reembolsado" }));
test("stripeReason: duplicado y el resto", () => eq([stripeReason("DUPLICATE"), stripeReason("WITHDRAWAL")], ["duplicate", "requested_by_customer"]));

// Desistimiento (14 días)
const paidAt = new Date("2026-10-01T10:00:00Z");
const base: WithdrawalInput = { status: "PAID", paidAt, productType: "DIGITAL", amountCents: 5900, refundedCents: 0, withdrawalWaived: false, hasPendingRefund: false, booking: null };
const at = (days: number) => new Date(paidAt.getTime() + days * DAY);
test("desistimiento: digital sin renuncia el día 13 → se puede, plazo hasta el día 14", () =>
  eq(withdrawalEligibility(base, at(13)), { eligible: true, deadline: at(14), amountCents: 5900 }));
test("desistimiento: día 15 → EXPIRED", () => eq(withdrawalEligibility(base, at(15)), { eligible: false, reason: "EXPIRED" }));
test("desistimiento: digital con renuncia → WAIVED", () => eq(withdrawalEligibility({ ...base, withdrawalWaived: true }, at(1)), { eligible: false, reason: "WAIVED" }));
test("desistimiento: sesión futura → se puede", () =>
  eq(withdrawalEligibility({ ...base, productType: "SESSION", withdrawalWaived: true, booking: { status: "CONFIRMED", startAt: at(5) } }, at(2)).eligible, true));
test("desistimiento: sesión ya empezada → SESSION_HELD", () =>
  eq(withdrawalEligibility({ ...base, productType: "SESSION", booking: { status: "CONFIRMED", startAt: at(1) } }, at(2)), { eligible: false, reason: "SESSION_HELD" }));
test("desistimiento: sesión completada → SESSION_HELD", () =>
  eq(withdrawalEligibility({ ...base, productType: "SESSION", booking: { status: "COMPLETED", startAt: null } }, at(2)), { eligible: false, reason: "SESSION_HELD" }));
test("desistimiento: ya reembolsado → ALREADY_REFUNDED", () =>
  eq(withdrawalEligibility({ ...base, status: "REFUNDED", refundedCents: 5900 }, at(1)), { eligible: false, reason: "ALREADY_REFUNDED" }));
test("desistimiento: reembolso en curso → PENDING", () => eq(withdrawalEligibility({ ...base, hasPendingRefund: true }, at(1)), { eligible: false, reason: "PENDING" }));
test("desistimiento: sin pagar → NOT_PAID", () => eq(withdrawalEligibility({ ...base, status: "PENDING", paidAt: null }, at(1)), { eligible: false, reason: "NOT_PAID" }));
test("desistimiento: reembolsado en parte → devuelve el resto", () => {
  const r = withdrawalEligibility({ ...base, refundedCents: 2000 }, at(3));
  ok(r.eligible && r.amountCents === 3900, JSON.stringify(r));
});
test("toWithdrawalInput: renuncia, reembolso pendiente y reserva", () =>
  eq(
    toWithdrawalInput({
      status: "PAID", paidAt, productType: "SESSION", amountCents: 5900, refundedCents: 0, waiverAcceptedAt: paidAt,
      bookings: [{ status: "CONFIRMED", startAt: at(3) }], refunds: [{ status: "FAILED" }, { status: "PENDING" }],
    }),
    { ...base, productType: "SESSION", withdrawalWaived: true, hasPendingRefund: true, booking: { status: "CONFIRMED", startAt: at(3) } },
  ));

// Cifras netas y etiquetas
const fig = { status: "PAID", amountCents: 7900, platformFeeCents: 158, refundedCents: 2000, refundedFeeCents: 40 };
test("orderFigures: parcial", () => eq(orderFigures(fig), { gross: 5900, fee: 118, net: 5782, refunded: 2000, partial: true, counts: true }));
test("orderStatusLabel: parcial", () => eq(orderStatusLabel(fig), "Reembolsado parcialmente"));
test("orderFigures: reembolsado del todo no cuenta", () => {
  const f = orderFigures({ ...fig, status: "REFUNDED", refundedCents: 7900, refundedFeeCents: 158 });
  eq([f.gross, f.fee, f.counts, f.partial], [0, 0, false, false]);
});
test("orderStatusLabel: reembolsado", () => eq(orderStatusLabel({ status: "REFUNDED", refundedCents: 7900 }), "Reembolsado"));
test("orderFigures: pedido abandonado no suma", () => eq(orderFigures({ ...fig, status: "ABANDONED", refundedCents: 0, refundedFeeCents: 0 }).gross, 0));

// Emails: el texto de las personas se escapa
test("bookingCancelledEmail escapa el motivo y lleva el producto en el asunto", () => {
  const m = bookingCancelledEmail({ creatorName: "Ana", productTitle: "Sesión 1:1", when: null, reason: "<script>alert(1)</script>", refundAmount: "79,00 €", url: "https://x" });
  ok(!m.html.includes("<script>"), "el html contiene <script>");
  ok(m.html.includes("&lt;script&gt;"), "falta el motivo escapado");
  ok(m.subject.includes("Sesión 1:1"), m.subject);
});
test("rescheduleProposalEmail escapa el mensaje", () =>
  ok(!rescheduleProposalEmail({ creatorName: "Ana", productTitle: "X", previousWhen: "lunes", note: '<img src=x onerror="a">', url: "https://x" }).html.includes("<img")));
test("refundIssuedEmail: parcial y sin acceso", () => {
  const m = refundIssuedEmail({ creatorName: "Ana", productTitle: "Guía", amount: "5,00 €", partial: true, accessRevoked: true, note: null, url: "https://x" });
  ok(m.html.includes("de tu compra") && m.html.includes("Ya no tendrás acceso"), m.html);
  eq(m.subject, "Te hemos devuelto 5,00 € de «Guía»");
});
