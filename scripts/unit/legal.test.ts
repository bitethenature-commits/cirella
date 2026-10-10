/**
 * Cumplimiento legal sin BD: NIF/NIE/CIF, identidad de quien vende, casillas del checkout,
 * plantillas de los textos legales, recibo con las condiciones y medición de visitas sin cookies.
 */
import { isLandingReferrer, visitorHash } from "../../lib/analytics";
import { parseCheckoutConsents, TERMS_REQUIRED_ERROR } from "../../lib/checkout-consents";
import { purchaseReceiptEmail } from "../../lib/email/templates";
import {
  creatorLegalHref,
  formatLegalAddress,
  legalIdentityComplete,
  legalIdentityMissing,
  normalizeTaxId,
  sellerLine,
  sessionChangePolicyText,
  termsCheckboxText,
  validatePostalCode,
  validateTaxId,
  WAIVER_TEXT,
  waiverKindFor,
  type LegalIdentity,
} from "../../lib/legal";
import { currentLegalDocs, legalTextToPlain, parseLegalText, privacyResponsibleLine, renderCreatorLegalTemplates } from "../../lib/legal-templates";
import { clientIp } from "../../lib/request-ip";
import { eq, ok, test } from "./harness";

const ana: LegalIdentity = {
  legalEntityType: "INDIVIDUAL",
  legalName: "Ana Luna Pérez",
  legalTaxId: "12345678Z",
  legalAddress: "Calle de la Luna 7, 2.º B",
  legalPostalCode: "28004",
  legalCity: "Madrid",
  legalCountry: "ES",
  legalEmail: "hola@analuna.es",
  legalRegistry: null,
};

// ── NIF / NIE / CIF ──

for (const [country, type, value, want] of [
  ["ES", "INDIVIDUAL", "12345678Z", null],
  ["ES", "INDIVIDUAL", "12345678A", "Revisa el NIF: la letra no coincide"],
  ["ES", "INDIVIDUAL", "X1234567L", null], // X → 0: 01234567 % 23 = 19 → L
  ["ES", "INDIVIDUAL", "Y1234567X", null],
  ["ES", "INDIVIDUAL", "X1234567A", "Revisa el NIE"],
  ["ES", "COMPANY", "B12345674", null],
  ["ES", "COMPANY", "B12345675", "Revisa el CIF"],
  ["ES", "COMPANY", "12345678Z", null], // una empresa también puede tener NIF
  ["ES", "INDIVIDUAL", "B12345674", "Identificación fiscal no válida"],
  ["ES", "INDIVIDUAL", "", "Escribe tu NIF, NIE o CIF"],
  ["ES", "INDIVIDUAL", " 12.345.678-z ", null],
  ["DE", "INDIVIDUAL", "DE123456789", null],
  ["DE", "INDIVIDUAL", "D€", "Identificación fiscal no válida"],
] as const)
  test(`validateTaxId(${country}, ${type}, ${JSON.stringify(value)})`, () => eq(validateTaxId(country, type, value), want));

test("normalizeTaxId quita espacios, puntos y guiones y pasa a mayúsculas", () => eq(normalizeTaxId(" 12.345.678-z "), "12345678Z"));

test("validatePostalCode: España pide 5 cifras", () => {
  ok(validatePostalCode("ES", "2800") !== null);
  eq(validatePostalCode("ES", "28001"), null);
  eq(validatePostalCode("PT", "1000-001"), null);
});

// ── Identidad de quien vende ──

test("legalIdentityMissing: lista los datos obligatorios que faltan", () =>
  eq(legalIdentityMissing({ legalName: "Ana", legalCountry: "ES" }), ["legalTaxId", "legalAddress", "legalPostalCode", "legalCity", "legalEmail"]));
test("legalIdentityComplete: Ana (seed) está completa; sin email, no", () => {
  ok(legalIdentityComplete(ana));
  ok(!legalIdentityComplete({ ...ana, legalEmail: "  " }));
});
test("formatLegalAddress y sellerLine", () => {
  eq(formatLegalAddress(ana), "Calle de la Luna 7, 2.º B, 28004 Madrid (España)");
  eq(sellerLine(ana), "Ana Luna Pérez · NIF 12345678Z");
  eq(sellerLine({ ...ana, legalEntityType: "COMPANY", legalName: "Luna S.L.", legalTaxId: "B12345674" }), "Luna S.L. · CIF B12345674");
});
test("creatorLegalHref", () => {
  eq(creatorLegalHref("ana"), "/ana/legal");
  eq(creatorLegalHref("ana", "condiciones"), "/ana/legal#condiciones");
});

// ── Casillas del checkout ──

test("waiverKindFor: digital, curso y membresía → acceso inmediato; sesión → servicio en plazo", () => {
  for (const t of ["DIGITAL", "COURSE", "MEMBERSHIP"]) eq(waiverKindFor(t), "DIGITAL_IMMEDIATE");
  eq(waiverKindFor("SESSION"), "SERVICE_IN_PERIOD");
  eq(waiverKindFor("OTRO"), null);
});
test("termsCheckboxText: renovación anual con «cada año» y sin «mensual»", () => {
  const t = termsCheckboxText({ sellerName: "Ana Luna Pérez", billingInterval: "year", price: "290 €/año" });
  ok(t.includes("cada año por 290 €"), t);
  ok(!t.includes("mensual") && !t.includes("/año"), t);
});
test("termsCheckboxText: mensual y sin suscripción", () => {
  ok(termsCheckboxText({ sellerName: "Ana", billingInterval: "month", price: "29 €/mes" }).includes("cada mes por 29 €"));
  eq(
    termsCheckboxText({ sellerName: "Ana", billingInterval: null, price: "29 €" }),
    "He leído y acepto las condiciones de venta y la política de cambios y reembolsos de Ana.",
  );
});
test("sessionChangePolicyText", () => eq(sessionChangePolicyText(), "Cambios gratis hasta 24 h antes de la sesión"));

test("parseCheckoutConsents: sin condiciones → error", () => eq(parseCheckoutConsents({}, "DIGITAL"), { ok: false, error: TERMS_REQUIRED_ERROR }));
test("parseCheckoutConsents: digital sin la renuncia → error de acceso inmediato", () => {
  const r = parseCheckoutConsents({ acceptTerms: "on" }, "DIGITAL");
  ok(!r.ok && r.error.includes("acceso inmediato"), JSON.stringify(r));
});
test("parseCheckoutConsents: sesión con todo → SERVICE_IN_PERIOD con su texto literal", () =>
  eq(parseCheckoutConsents({ acceptTerms: "on", waiver: "on" }, "SESSION"), {
    ok: true,
    consents: { waiverKind: "SERVICE_IN_PERIOD", waiverText: WAIVER_TEXT.SERVICE_IN_PERIOD, marketingOptIn: false },
  }));
test("parseCheckoutConsents: la casilla de novedades es opcional", () => {
  const r = parseCheckoutConsents({ acceptTerms: "on", waiver: "on", newsletter: "on" }, "COURSE");
  ok(r.ok && r.consents.marketingOptIn && r.consents.waiverKind === "DIGITAL_IMMEDIATE");
});

// ── Plantillas ──

const templates = renderCreatorLegalTemplates({ identity: ana, displayName: "Ana Luna", platformName: "Cirella", changeNoticeHours: 24 });
test("plantillas: la plataforma no es parte del contrato", () => ok(templates.terms.includes("Cirella") && templates.terms.includes("no es parte del contrato")));
test("plantillas: reembolsos con 24 h y 14 días", () => ok(templates.refunds.includes("24 h") && templates.refunds.includes("14 días")));
test("plantillas: ningún texto lleva el NIF (la identidad va aparte)", () => {
  for (const text of Object.values(templates)) ok(!text.includes("12345678Z"));
});
test("currentLegalDocs: el texto personalizado manda; si es null, la plantilla", () => {
  const docs = currentLegalDocs({ ...ana, displayName: "Ana Luna", legalTerms: "Mis condiciones", legalRefunds: null, legalPrivacy: null }, "Cirella");
  eq(docs.terms, "Mis condiciones");
  eq(docs.refunds, templates.refunds);
});
test("privacyResponsibleLine se genera con la identidad", () => ok(privacyResponsibleLine(ana).includes("Ana Luna Pérez · 12345678Z")));
test("parseLegalText: apartados, párrafos y viñetas", () =>
  eq(parseLegalText("## Uno\nlínea a\nlínea b\n\n• x\n• y\nfinal"), [
    { kind: "heading", text: "Uno" },
    { kind: "paragraph", text: "línea a línea b" },
    { kind: "list", items: ["x", "y"] },
    { kind: "paragraph", text: "final" },
  ]));
test("legalTextToPlain: los apartados en mayúsculas, sin «## »", () => eq(legalTextToPlain("## Pago\nCon tarjeta."), "PAGO\nCon tarjeta."));

// ── Recibo ──

test("recibo: quién vende, la renuncia con su fecha, la versión aceptada y las condiciones (escapadas)", () => {
  const { html } = purchaseReceiptEmail({
    creatorName: "Ana Luna",
    productTitle: "Guía",
    amount: "29 €",
    orderId: "ord_123",
    accountUrl: "https://x.test/acceso",
    seller: { line: sellerLine(ana), address: formatLegalAddress(ana), email: "hola@analuna.es" },
    waiver: { text: WAIVER_TEXT.DIGITAL_IMMEDIATE, at: "10 de octubre de 2026, 12:00" },
    legalUrl: "https://x.test/ana/legal?v=abc",
    conditions: { terms: "## Pago\n<b>Tarjeta</b>", refunds: templates.refunds },
  });
  for (const s of ["Ana Luna Pérez · NIF 12345678Z", "Quiero acceder ya al contenido", "/ana/legal?v=abc", "CONDICIONES DE VENTA", "PAGO", "&lt;b&gt;Tarjeta"])
    ok(html.includes(s), `falta ${s}`);
  ok(!html.includes("<b>Tarjeta"));
});
test("recibo sin datos legales: igual que antes", () => ok(!purchaseReceiptEmail({ creatorName: "A", productTitle: "G", amount: "1 €", orderId: "o", accountUrl: "u" }).html.includes("Vende")));

// ── Visitas sin cookies ──

test("visitorHash: determinista, 32 hex y cambia con cada dato", () => {
  const h = visitorHash("sal", "c1", "1.2.3.4", "UA");
  eq(h, visitorHash("sal", "c1", "1.2.3.4", "UA"));
  ok(/^[0-9a-f]{32}$/.test(h), h);
  for (const other of [visitorHash("sal2", "c1", "1.2.3.4", "UA"), visitorHash("sal", "c2", "1.2.3.4", "UA"), visitorHash("sal", "c1", "1.2.3.5", "UA"), visitorHash("sal", "c1", "1.2.3.4", "UA2")])
    ok(other !== h);
});
test("isLandingReferrer: desde la propia web no; directa o desde fuera, sí", () => {
  eq(isLandingReferrer("cirella.app", "cirella.app"), false);
  eq(isLandingReferrer(null, "cirella.app"), true);
  eq(isLandingReferrer("instagram.com", "cirella.app"), true);
});
test("clientIp: primera de X-Forwarded-For, si no X-Real-IP, si no 0.0.0.0", () => {
  eq(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })), "9.9.9.9");
  eq(clientIp(new Headers({ "x-real-ip": "8.8.8.8" })), "8.8.8.8");
  eq(clientIp(new Headers()), "0.0.0.0");
});
