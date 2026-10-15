import { emailAttemptLabel } from "../../lib/email-status";
import { sellerStatement } from "../../lib/legal";
import { orderBreakdown } from "../../lib/order-breakdown";
import { orderRef } from "../../lib/order-ref";
import { eq, ok, test } from "./harness";

// Venta de 49 € que vende Cirella (IVA 21 %: 8,50 €) con 0,81 € de comisión.
const sale = { status: "PAID", amountCents: 4900, taxCents: 850, taxSeller: "PLATFORM", platformFeeCents: 81, refundedCents: 0, refundedFeeCents: 0 };

test("orderBreakdown: sin reembolsos, importe − IVA de Cirella − comisión = recibes", () => {
  const f = orderBreakdown(sale);
  eq([f.amount, f.platformTax, f.fee, f.net], [4900, 850, 81, 3969]);
  eq(f.amount - f.refunded - f.platformTax - f.fee, f.net);
});

test("orderBreakdown: tras un reembolso parcial de 10 € cuadra con el IVA devuelto del libro", () => {
  const f = orderBreakdown({ ...sale, refundedCents: 1000, refundedFeeCents: 17 }, [{ amountCents: -1000, taxCents: -173 }]);
  eq([f.refunded, f.refundedTax, f.platformTax, f.refundedFee, f.fee, f.net], [1000, 173, 677, 17, 64, 3159]);
  eq(f.amount - f.refunded - f.platformTax - f.fee, f.net);
});

test("orderBreakdown: varios parciales suman el IVA guardado en cada fila, sin redondear de nuevo", () => {
  const f = orderBreakdown({ ...sale, refundedCents: 1500, refundedFeeCents: 25 }, [
    { amountCents: -1000, taxCents: -173 },
    { amountCents: -500, taxCents: -87 },
  ]);
  eq(f.refundedTax, 260);
  eq(f.platformTax, 590);
  eq(f.amount - f.refunded - f.platformTax - f.fee, f.net);
});

test("orderBreakdown: un pedido antiguo sin filas en el libro reparte el IVA en proporción", () => {
  const f = orderBreakdown({ ...sale, refundedCents: 1000, refundedFeeCents: 17 });
  eq(f.refundedTax, 173);
  eq(f.net, 3159);
});

test("orderBreakdown: si vende la creadora, el IVA es suyo y no se resta", () => {
  const f = orderBreakdown({ ...sale, taxSeller: "CREATOR" });
  eq([f.tax, f.platformTax, f.net], [850, 0, 4819]);
});

test("orderBreakdown: reembolsado del todo, recibes 0", () => {
  const f = orderBreakdown({ ...sale, status: "REFUNDED", refundedCents: 4900, refundedFeeCents: 81 }, [{ amountCents: -4900, taxCents: -850 }]);
  eq([f.platformTax, f.fee, f.net], [0, 0, 0]);
});

test("orderBreakdown: un pedido sin pagar no reparte nada", () => {
  const f = orderBreakdown({ ...sale, status: "PENDING" });
  ok(!f.settled);
  eq([f.fee, f.platformTax, f.net], [0, 0, 0]);
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

const ana = { displayName: "Ana Luna", legalEntityType: "INDIVIDUAL", legalName: "Ana Luna Pérez", legalTaxId: "12345678Z" };
const platform = { name: "Cirella Demo S.L.", taxId: "B12345674" };

test("sellerStatement: si vende Cirella, lo dice en nombre propio y por cuenta de la creadora", () => {
  const s = sellerStatement("PLATFORM", ana, platform);
  eq(s.name, "Cirella Demo S.L., por cuenta de Ana Luna Pérez");
  eq(s.line, "Cirella Demo S.L. · NIF B12345674, por cuenta de Ana Luna Pérez");
  ok(s.platformSells);
});

test("sellerStatement: si vende la creadora, su identidad legal", () => {
  eq(sellerStatement("CREATOR", ana, null), { name: "Ana Luna Pérez", line: "Ana Luna Pérez · NIF 12345678Z", platformSells: false });
  eq(sellerStatement("CREATOR", { displayName: "Ana Luna" }, null).line, "Ana Luna");
});
