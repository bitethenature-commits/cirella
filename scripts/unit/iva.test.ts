import { purchaseReceiptEmail, monthlyInvoiceEmail } from "../../lib/email/templates";
import { canViewInvoice } from "../../lib/invoices/access";
import { buildFeeInvoiceLines, monthPeriod } from "../../lib/invoices/fees";
import { formatInvoiceNumber, periodLabel } from "../../lib/invoices/format";
import { creatorIssuer } from "../../lib/invoices/issuer";
import { csvCell, toCsv } from "../../lib/csv";
import { orderFigures } from "../../lib/refund-math";
import {
  computeSaleAmounts,
  decidePlatformServiceTax,
  decideTax,
  estimateNet,
  platformRetainedCents,
  refundTaxFields,
  splitInclusive,
  type TaxMode,
} from "../../lib/tax";
import { COUNTRIES, EU_VAT_STANDARD_BPS, countryName, isEuVatCountry } from "../../lib/tax/rates";
import { isPlausibleTaxId, isValidSpanishTaxId, normalizeTaxId } from "../../lib/tax/tax-id";
import { eq, ok, test } from "./harness";

// ── Desglose del IVA incluido ──
for (const [total, rate, base, tax] of [
  [7900, 2100, 6529, 1371], [1200, 2100, 992, 208], [1999, 2000, 1666, 333], [100, 2100, 83, 17], [0, 2100, 0, 0], [5000, 0, 5000, 0],
] as const)
  test(`splitInclusive(${total}, ${rate}) → ${base} + ${tax}`, () => {
    const r = splitInclusive(total, rate);
    eq(r, { baseCents: base, taxCents: tax });
    eq(r.baseCents + r.taxCents, total, "base + IVA = total");
  });

// ── Quién vende y a qué tipo ──
const A: TaxMode = "PLATFORM_DIGITAL";
const none = { country: "ES", vatStatus: "NONE" as const };
test("decideTax A: DIGITAL a España → Cirella, 21 %, sin nota", () => eq(decideTax({ mode: A, productType: "DIGITAL", buyerCountry: "ES", creator: none }), { seller: "PLATFORM", country: "ES", rateBps: 2100, note: null }));
test("decideTax A: COURSE a Francia → 20 % con nota OSS", () => {
  const d = decideTax({ mode: A, productType: "COURSE", buyerCountry: "FR", creator: none });
  eq([d.seller, d.country, d.rateBps], ["PLATFORM", "FR", 2000]);
  ok(d.note?.includes("OSS"), "nota OSS");
});
test("decideTax A: MEMBERSHIP a EE. UU. → 0 % y «no sujeta»", () => {
  const d = decideTax({ mode: A, productType: "MEMBERSHIP", buyerCountry: "US", creator: none });
  eq([d.seller, d.rateBps], ["PLATFORM", 0]);
  ok(d.note?.includes("no sujeta"));
});
test("decideTax A: Canarias → 0 %", () => eq(decideTax({ mode: A, productType: "DIGITAL", buyerCountry: "ES-CN", creator: none }).rateBps, 0));
test("decideTax A: sin país → España 21 %", () => eq(decideTax({ mode: A, productType: "DIGITAL", buyerCountry: null, creator: none }), { seller: "PLATFORM", country: "ES", rateBps: 2100, note: null }));
test("decideTax A: SESSION de creadora sin IVA → la creadora, 0 %", () => eq(decideTax({ mode: A, productType: "SESSION", buyerCountry: "FR", creator: none }), { seller: "CREATOR", country: "ES", rateBps: 0, note: null }));
test("decideTax A: SESSION de creadora con IVA en España → 21 %", () =>
  eq(decideTax({ mode: A, productType: "SESSION", buyerCountry: "FR", creator: { country: "ES", vatStatus: "STANDARD" } }), { seller: "CREATOR", country: "ES", rateBps: 2100, note: null }));
test("decideTax A: SESSION de creadora exenta → 0 % con su nota", () =>
  eq(decideTax({ mode: A, productType: "SESSION", buyerCountry: "ES", creator: { country: "ES", vatStatus: "EXEMPT", vatExemptionNote: "Exenta art. 20" } }).note, "Exenta art. 20"));
test("decideTax CREATOR: DIGITAL de creadora con IVA, compradora FR → la creadora, ES, 21 %", () =>
  eq(decideTax({ mode: "CREATOR", productType: "DIGITAL", buyerCountry: "FR", creator: { country: "ES", vatStatus: "STANDARD" } }), { seller: "CREATOR", country: "ES", rateBps: 2100, note: null }));
test("decideTax: creadora con IVA fuera de la UE → 0 %", () => eq(decideTax({ mode: "CREATOR", productType: "DIGITAL", buyerCountry: "ES", creator: { country: "MX", vatStatus: "STANDARD" } }).rateBps, 0));

// ── Importes de la venta ──
test("computeSaleAmounts vende Cirella: IVA 1371, comisión 326, neto 6203, retiene 1697", () =>
  eq(computeSaleAmounts(7900, 500, { seller: "PLATFORM", rateBps: 2100 }), { taxCents: 1371, taxRateBps: 2100, platformFeeCents: 326, netCents: 6203, platformRetainedCents: 1697 }));
test("computeSaleAmounts vende la creadora con IVA: comisión 326, neto 7574", () =>
  eq(computeSaleAmounts(7900, 500, { seller: "CREATOR", rateBps: 2100 }), { taxCents: 1371, taxRateBps: 2100, platformFeeCents: 326, netCents: 7574, platformRetainedCents: 326 }));
test("computeSaleAmounts sin IVA: igual que la comisión sobre el bruto de antes", () =>
  eq(computeSaleAmounts(7900, 500, { seller: "CREATOR", rateBps: 0 }), { taxCents: 0, taxRateBps: 0, platformFeeCents: 395, netCents: 7505, platformRetainedCents: 395 }));
test("platformRetainedCents: comisión + IVA solo si vende Cirella", () => {
  eq(platformRetainedCents({ platformFeeCents: 326, taxCents: 1371, taxSeller: "PLATFORM" }), 1697);
  eq(platformRetainedCents({ platformFeeCents: 326, taxCents: 1371, taxSeller: "CREATOR" }), 326);
});
test("refundTaxFields: devolución total → IVA −1371", () =>
  eq(refundTaxFields({ amountCents: 7900, taxCents: 1371, taxRateBps: 2100, taxCountry: "ES", taxSeller: "PLATFORM" }, 7900), { taxCents: -1371, taxRateBps: 2100, taxCountry: "ES", taxSeller: "PLATFORM" }));
test("refundTaxFields: devolución parcial en proporción", () =>
  eq(refundTaxFields({ amountCents: 7900, taxCents: 1371, taxRateBps: 2100, taxCountry: "ES", taxSeller: "PLATFORM" }, 3950).taxCents, -686));
test("estimateNet: «Recibirás» con una compradora de España", () =>
  eq(estimateNet({ priceCents: 7900, commissionBps: 500, productType: "DIGITAL", mode: A, creator: none }), { taxCents: 1371, feeCents: 326, netCents: 6203, rateBps: 2100, seller: "PLATFORM" }));
test("orderFigures: el IVA que declara Cirella no es de la creadora", () => {
  const f = orderFigures({ status: "PAID", amountCents: 7900, platformFeeCents: 326, refundedCents: 0, refundedFeeCents: 0, taxCents: 1371, taxSeller: "PLATFORM" });
  eq([f.gross, f.fee, f.tax, f.platformTax, f.net], [7900, 326, 1371, 1371, 6203]);
  eq(orderFigures({ status: "PAID", amountCents: 7900, platformFeeCents: 326, refundedCents: 0, refundedFeeCents: 0, taxCents: 1371, taxSeller: "CREATOR" }).net, 7574);
});

// ── IVA de la cuota y la comisión (Cirella → creadora) ──
test("decidePlatformServiceTax: España → 21 %", () => eq(decidePlatformServiceTax({ country: "ES", vatStatus: "NONE", taxId: null }).rateBps, 2100));
test("decidePlatformServiceTax: Francia con NIF-IVA → inversión del sujeto pasivo", () => {
  const d = decidePlatformServiceTax({ country: "FR", vatStatus: "STANDARD", taxId: "FR12345678901" });
  eq(d.rateBps, 0);
  ok(d.note?.includes("Inversión del sujeto pasivo"));
});
test("decidePlatformServiceTax: Francia particular → 20 %", () => eq(decidePlatformServiceTax({ country: "FR", vatStatus: "NONE", taxId: null }).rateBps, 2000));
test("decidePlatformServiceTax: EE. UU. → 0 % (art. 69)", () => {
  const d = decidePlatformServiceTax({ country: "US", vatStatus: "NONE", taxId: null });
  eq(d.rateBps, 0);
  ok(d.note?.includes("art. 69"));
});
test("decidePlatformServiceTax: Canarias → 0 %", () => eq(decidePlatformServiceTax({ country: "ES-CN", vatStatus: "NONE", taxId: null }).rateBps, 0));

// ── Tabla de tipos y países ──
test("tabla de la UE: 27 países, tipos plausibles (revisar cada enero)", () => {
  eq(Object.keys(EU_VAT_STANDARD_BPS).length, 27);
  ok(Object.values(EU_VAT_STANDARD_BPS).every((b) => b >= 1700 && b <= 2700));
  ok(!isEuVatCountry("GB") && !isEuVatCountry("ES-CN") && isEuVatCountry("DE"));
});
test("COUNTRIES: España primero, sin duplicados y con «Otro país»", () => {
  eq(COUNTRIES[0].code, "ES");
  eq(new Set(COUNTRIES.map((c) => c.code)).size, COUNTRIES.length);
  eq(countryName("ES-CN"), "España – Canarias");
  eq(countryName("XX"), "Otro país");
});

// ── NIF ──
for (const [v, want] of [
  ["12345678Z", true], ["12.345.678-z", true], ["12345678A", false], ["X1234567L", true], ["X1234567A", false], ["B12345674", true], ["B12345675", false], ["ES12345678Z", true],
] as const)
  test(`isValidSpanishTaxId(${JSON.stringify(v)}) = ${want}`, () => eq(isValidSpanishTaxId(v), want));
test("normalizeTaxId quita el prefijo ES del NIF-IVA", () => eq(normalizeTaxId("es 12.345.678-z"), "12345678Z"));
test("isPlausibleTaxId fuera de España: solo el formato", () => {
  ok(isPlausibleTaxId("FR12345678901", "FR"));
  ok(!isPlausibleTaxId("ab", "FR"));
  ok(!isPlausibleTaxId("12345678A", "ES"));
});

// ── Facturas ──
test("formatInvoiceNumber('V', 2026, 7) → V2026-000007", () => eq(formatInvoiceNumber("V", 2026, 7), "V2026-000007"));
test("periodLabel('2026-09') → septiembre de 2026", () => eq(periodLabel("2026-09"), "septiembre de 2026"));
test("monthPeriod: mes anterior en España (cambio de año incluido)", () => {
  const p = monthPeriod(new Date("2027-01-01T00:30:00Z"), -1); // 01:30 del 1 de enero en Madrid
  eq(p.period, "2026-12");
  eq(p.from.toISOString(), "2026-11-30T23:00:00.000Z");
  eq(p.to.toISOString(), "2026-12-31T23:00:00.000Z");
});
test("buildFeeInvoiceLines: cuota + comisión de las ventas de la creadora (las de Cirella no)", () =>
  eq(
    buildFeeInvoiceLines([
      { type: "PLAN_FEE", description: "Plan Pro · mensual", amountCents: 2900, platformFeeCents: 2900, taxSeller: null },
      { type: "CHARGE", description: "Sesión", amountCents: 7900, platformFeeCents: 395, taxSeller: "CREATOR" },
      { type: "CHARGE", description: "PDF", amountCents: 7900, platformFeeCents: 300, taxSeller: "PLATFORM" },
      { type: "REFUND", description: "Reembolso", amountCents: -2000, platformFeeCents: -100, taxSeller: "CREATOR" },
    ]),
    [
      { description: "Plan Pro · mensual", totalCents: 2900 },
      { description: "Comisión del servicio sobre 1 venta (descontadas las devoluciones)", totalCents: 295 },
    ],
  ));
test("buildFeeInvoiceLines: sin ventas de la creadora solo la cuota", () =>
  eq(buildFeeInvoiceLines([{ type: "PLAN_FEE", description: "Plan Creator · mensual", amountCents: 1200, platformFeeCents: 1200, taxSeller: null }]), [
    { description: "Plan Creator · mensual", totalCents: 1200 },
  ]));
test("creatorIssuer: sin IVA o sin datos fiscales no hay factura", () => {
  const c = { vatStatus: "STANDARD", legalName: "Ana Luna", legalTaxId: "12345678Z", legalAddress: "Calle Luna 3", legalPostalCode: "08001", legalCity: "Barcelona", legalCountry: "ES" };
  eq(creatorIssuer(c)?.address, "Calle Luna 3, 08001 Barcelona (España)");
  eq(creatorIssuer({ ...c, vatStatus: "NONE" }), null);
  eq(creatorIssuer({ ...c, legalTaxId: null }), null);
});

// ── Quién ve cada factura ──
const sale = { kind: "SALE", creatorId: "ana", buyerUserId: "u1", recipientEmail: "paula@example.com" };
const fees = { kind: "FEES", creatorId: "maria", buyerUserId: null, recipientEmail: "maria@cirella.app" };
const viewer = (o: Partial<Parameters<typeof canViewInvoice>[0]>) => ({ userId: "", isAdmin: false, creatorId: null, email: "", ...o });
test("canViewInvoice: la administración ve todas", () => ok(canViewInvoice(viewer({ isAdmin: true }), fees)));
test("canViewInvoice: una factura de cuotas solo la ve su creadora", () => {
  ok(canViewInvoice(viewer({ creatorId: "maria" }), fees));
  ok(!canViewInvoice(viewer({ creatorId: "ana" }), fees));
  ok(!canViewInvoice(viewer({ userId: "u1", email: "maria@cirella.app" }), fees), "ni con el email de la destinataria");
});
test("canViewInvoice: una venta la ven la creadora y la compradora", () => {
  ok(canViewInvoice(viewer({ creatorId: "ana" }), sale));
  ok(canViewInvoice(viewer({ userId: "u1" }), sale));
  ok(!canViewInvoice(viewer({ userId: "u2", email: "paula@example.com" }), sale), "con usuaria, cuenta la usuaria y no el email");
  ok(canViewInvoice(viewer({ userId: "u2", email: "Paula@example.com" }), { ...sale, buyerUserId: null }), "sin usuaria, por el email");
  ok(!canViewInvoice(viewer({ creatorId: "maria", userId: "u3" }), sale));
});

// ── Emails y CSV ──
test("purchaseReceiptEmail: IVA, número de factura y enlace al recibo", () => {
  const m = purchaseReceiptEmail({
    creatorName: "Ana", productTitle: "Guía", amount: "79 €", orderId: "ord_1234567890", accountUrl: "https://x/a",
    taxLine: "IVA incluido (21 %): 13,71 €", invoiceNumber: "V2026-000001", taxSellerLine: "Cobro y factura: Cirella <SL>", receiptUrl: "https://x/r",
  });
  ok(m.html.includes("IVA incluido (21 %): 13,71 €") && m.html.includes("V2026-000001") && m.html.includes("Ver tu factura o justificante"));
  ok(m.html.includes("Cirella &lt;SL&gt;"), "escapa el texto");
});
test("monthlyInvoiceEmail: asunto con el mes", () =>
  eq(monthlyInvoiceEmail({ creatorName: "Ana", periodLabel: "septiembre de 2026", number: "S2026-000001", total: "29,00 €", url: "https://x" }).subject, "Tu factura de Cirella · septiembre de 2026"));
test("toCsv: comillas, comas y fórmulas", () => {
  eq(toCsv([["a,b", 'di "hola"', 12.5, null]]), '"a,b","di ""hola""",12.5,');
  eq(csvCell("=SUMA(A1)"), "'=SUMA(A1)");
});
