/**
 * Cumplimiento legal sin BD: NIF/NIE/CIF, identidad de quien vende, casillas del checkout,
 * plantillas de los textos legales, recibo con las condiciones y medición de visitas sin cookies.
 */
import { isLandingReferrer, visitorHash } from "../../lib/analytics";
import { parseCheckoutConsents, TERMS_REQUIRED_ERROR, waiverVersionOf } from "../../lib/checkout-consents";
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
  WAIVER_TEXT_VERSION,
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

test("waiverKindFor: digital, curso y membresía → acceso inmediato; «Lo preparo yo» → preparado; sesión individual → ninguna", () => {
  for (const t of ["DIGITAL", "COURSE", "MEMBERSHIP"]) eq(waiverKindFor(t), "DIGITAL_IMMEDIATE");
  eq(waiverKindFor("DIGITAL", "PERSONAL"), "DIGITAL_PREPARED");
  eq(waiverKindFor("SESSION"), null);
  eq(waiverKindFor("SESSION", null, { groupSession: false, eventStartAt: null, now: new Date() }), null);
  eq(waiverKindFor("OTRO"), null);
});
test("waiverKindFor: taller a menos de 15 días → servicio en plazo; a 15 o más → ninguna", () => {
  const now = new Date("2026-10-25T10:00:00Z"); // 12:00 en Madrid: día 0 = 25 de octubre
  const ws = (iso: string) => waiverKindFor("SESSION", null, { groupSession: true, eventStartAt: new Date(iso), now, timezone: "Europe/Madrid" });
  eq(ws("2026-11-08T22:59:00Z"), "SERVICE_IN_PERIOD"); // 8 nov 23:59 en Madrid (día 14)
  eq(ws("2026-11-08T23:00:00Z"), null); // 9 nov 00:00 en Madrid (día 15)
  eq(ws("2026-10-26T18:00:00Z"), "SERVICE_IN_PERIOD");
  eq(ws("2026-12-01T18:00:00Z"), null);
});
test("textos de las renuncias: consentimiento expreso y pérdida del derecho", () => {
  for (const k of ["DIGITAL_IMMEDIATE", "DIGITAL_PREPARED"] as const) ok(/consentimiento expreso/.test(WAIVER_TEXT[k]) && /pierdo mi derecho de desistimiento/.test(WAIVER_TEXT[k]), k);
  ok(WAIVER_TEXT.DIGITAL_IMMEDIATE.startsWith("Quiero acceder ya"));
  ok(/Solicito expresamente/.test(WAIVER_TEXT.SERVICE_IN_PERIOD) && /una vez realizado por completo, perderé/.test(WAIVER_TEXT.SERVICE_IN_PERIOD));
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
test("parseCheckoutConsents: «Lo preparo yo» sin la renuncia → error", () => {
  const r = parseCheckoutConsents({ acceptTerms: "on" }, "DIGITAL", "PERSONAL");
  ok(!r.ok && r.error.includes("se prepare ya"), JSON.stringify(r));
});
test("parseCheckoutConsents: sesión individual → sin renuncia (aunque llegue marcada)", () =>
  eq(parseCheckoutConsents({ acceptTerms: "on", waiver: "on" }, "SESSION"), {
    ok: true,
    consents: { waiverKind: null, waiverText: null, waiverVersion: null, marketingOptIn: false },
  }));
test("parseCheckoutConsents: taller a menos de 15 días → la casilla obligatoria, con su texto y versión", () => {
  const now = new Date("2026-10-25T10:00:00Z");
  const workshop = { groupSession: true, eventStartAt: new Date("2026-10-30T18:00:00Z"), now, timezone: "Europe/Madrid" };
  const no = parseCheckoutConsents({ acceptTerms: "on" }, "SESSION", null, workshop);
  ok(!no.ok && no.error.includes("menos de 15 días"), JSON.stringify(no));
  eq(parseCheckoutConsents({ acceptTerms: "on", waiver: "on" }, "SESSION", null, workshop), {
    ok: true,
    consents: { waiverKind: "SERVICE_IN_PERIOD", waiverText: WAIVER_TEXT.SERVICE_IN_PERIOD, waiverVersion: waiverVersionOf(WAIVER_TEXT.SERVICE_IN_PERIOD), marketingOptIn: false },
  });
  const far = parseCheckoutConsents({ acceptTerms: "on" }, "SESSION", null, { ...workshop, eventStartAt: new Date("2026-11-20T18:00:00Z") });
  ok(far.ok && far.consents.waiverKind === null);
});
test("waiverVersionOf: versión de los textos y huella del texto exacto", () => {
  const v = waiverVersionOf(WAIVER_TEXT.DIGITAL_IMMEDIATE);
  ok(new RegExp(`^${WAIVER_TEXT_VERSION}#[0-9a-f]{16}$`).test(v), v);
  ok(v !== waiverVersionOf(WAIVER_TEXT.DIGITAL_IMMEDIATE + " "));
  eq(waiverVersionOf(WAIVER_TEXT.DIGITAL_IMMEDIATE), v);
});
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
    waiver: { text: WAIVER_TEXT.DIGITAL_IMMEDIATE, at: "10 de octubre de 2026, 12:00", version: "2026-10-25#abc" },
    legalUrl: "https://x.test/ana/legal?v=abc",
    conditions: { terms: "## Pago\n<b>Tarjeta</b>", refunds: templates.refunds },
  });
  for (const s of ["Ana Luna Pérez · NIF 12345678Z", "Quiero acceder ya al contenido", "texto 2026-10-25#abc", "Confirmación de tu consentimiento", "/ana/legal?v=abc", "CONDICIONES DE VENTA", "PAGO", "&lt;b&gt;Tarjeta"])
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
test("clientIp: la misma regla que los límites (sin CLIENT_IP_HEADER, la última de X-Forwarded-For)", () => {
  eq(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })), "10.0.0.1");
  eq(clientIp(new Headers()), "unknown");
});
