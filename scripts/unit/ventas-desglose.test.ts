import { emailAttemptLabel } from "../../lib/email-status";
import { sellerStatement } from "../../lib/legal";
import { orderBreakdown } from "../../lib/order-breakdown";
import { orderRef } from "../../lib/order-ref";
import { eq, ok, test } from "./harness";

// Venta de 49 € con 0,98 € de comisión (2 %).
const sale = { status: "PAID", amountCents: 4900, platformFeeCents: 98, refundedCents: 0, refundedFeeCents: 0 };

test("orderBreakdown: sin reembolsos, importe − comisión = recibes", () => {
  const f = orderBreakdown(sale);
  eq([f.amount, f.fee, f.net], [4900, 98, 4802]);
  eq(f.amount - f.refunded - f.fee, f.net);
});

test("orderBreakdown: tras un reembolso parcial de 10 € cuadra con la comisión devuelta", () => {
  const f = orderBreakdown({ ...sale, refundedCents: 1000, refundedFeeCents: 20 });
  eq([f.refunded, f.refundedFee, f.fee, f.net], [1000, 20, 78, 3822]);
  eq(f.amount - f.refunded - f.fee, f.net);
});

test("orderBreakdown: reembolsado del todo, recibes 0", () => {
  const f = orderBreakdown({ ...sale, status: "REFUNDED", refundedCents: 4900, refundedFeeCents: 98 });
  eq([f.fee, f.net], [0, 0]);
});

test("orderBreakdown: un pedido sin pagar no reparte nada", () => {
  const f = orderBreakdown({ ...sale, status: "PENDING" });
  ok(!f.settled);
  eq([f.fee, f.net], [0, 0]);
});
test("orderRef: últimos 10 caracteres en mayúsculas (igual que el recibo y el CSV)", () => {
  eq(orderRef("cmg1abc2def3ghi4jkl"), "EF3GHI4JKL");
  eq(orderRef("abc"), "ABC");
});

test("emailAttemptLabel: un rebote definitivo no muestra «Intento 1 de 6»", () => {
  eq(emailAttemptLabel({ status: "FAILED", attempts: 1 }), { text: "Rebote definitivo · no se reintenta", retryable: false });
  eq(emailAttemptLabel({ status: "FAILED", attempts: 6 }).retryable, false);
  eq(emailAttemptLabel({ status: "QUEUED", attempts: 2 }), { text: "Intento 2 de 6", retryable: true });
});

const ana = { displayName: "Cirella", legalEntityType: "INDIVIDUAL", legalName: "Cirella", legalTaxId: "12345678Z" };

test("sellerStatement: vende la creadora, con su identidad legal", () => {
  eq(sellerStatement(ana), { name: "Cirella", line: "Cirella · NIF 12345678Z" });
  eq(sellerStatement({ displayName: "Cirella" }).line, "Cirella");
});