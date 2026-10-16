/**
 * Cobros de la web personal: Stripe directo (sin Connect) y PayPal con la cuenta de la dueña, varias
 * pasarelas a la vez (PAYMENT_PROVIDER=stripe,paypal), los productos de pago en la web personal y el
 * IVA de una empresa de fuera de la UE (ventanilla única «no Unión»). Sin red: PayPal y Stripe falsos.
 */
import type Stripe from "stripe";
import { accessModesFor, defaultAccessMode, resolveAccessMode } from "../../lib/access-mode";
import { parsePaymentProviders, validateEnv } from "../../lib/env";
import {
  currentPersonalSalesDocs,
  legalKind,
  personalPaymentMethodsText,
  renderPersonalSalesTemplates,
} from "../../lib/legal-templates";
import { selectPaymentProviders } from "../../lib/payments";
import { createPaypalApi, createPaypalProvider, PaypalApiError, type PaypalHttp } from "../../lib/payments/paypal";
import {
  approvalLink,
  decodeCustomId,
  encodeCustomId,
  fromPaypalValue,
  mapDispute,
  mapEvent,
  mapOrder,
  mapRefund,
  toPaypalValue,
} from "../../lib/payments/paypal-map";
import { WebhookSignatureError, type StartPaymentInput } from "../../lib/payments/provider";
import { createStripeProvider, type StripeLike } from "../../lib/payments/stripe";
import { canAcceptPayments, chargeDestination } from "../../lib/payouts";
import { creatorSaleNote, decideTax, NOTE_NON_UNION_SELLER, NOTE_OUTSIDE_EU, ossNote, splitInclusive } from "../../lib/tax";
import { mobileNav, panelNav } from "../../app/panel/nav-items";
import { eq, ok, test, throws } from "./harness";

type Raw = Record<string, string | undefined>;
const SECRET = "b".repeat(64);

// ── Configuración ──

test("parsePaymentProviders: una, varias (la tarjeta primero), none y errores", () => {
  eq(parsePaymentProviders("stripe"), { ok: true, keys: ["stripe"] });
  eq(parsePaymentProviders(" PayPal , stripe "), { ok: true, keys: ["stripe", "paypal"] });
  eq(parsePaymentProviders("stripe,stripe,paypal"), { ok: true, keys: ["stripe", "paypal"] });
  eq(parsePaymentProviders("none"), { ok: true, keys: [] });
  eq(parsePaymentProviders("none,stripe").ok, false);
  eq(parsePaymentProviders("stripe,simulated").ok, false);
  eq(parsePaymentProviders("bizum").ok, false);
});

test("selectPaymentProviders: PayPal solo en la web personal; simulated nunca en producción", async () => {
  eq(selectPaymentProviders("stripe,paypal", "production", "personal"), ["stripe", "paypal"]);
  eq(selectPaymentProviders("paypal", "production", "personal"), ["paypal"]);
  await throws(() => selectPaymentProviders("stripe,paypal", "production", "platform"), /modo personal/);
  await throws(() => selectPaymentProviders("simulated,paypal", "production", "personal"), /prohibido/);
  eq(selectPaymentProviders("simulated,paypal", "development", "personal"), ["simulated", "paypal"]);
});

/** Producción de una web personal que cobra con Stripe y PayPal: lo que pone docs/modo-personal.md. */
const PERSONAL_SALES: Raw = {
  APP_ENV: "production",
  APP_URL: "https://cirellaschafer.com",
  DATABASE_URL: "postgresql://u:p@db.example.com:5432/c",
  DIRECT_URL: "postgresql://u:p@db.example.com:5432/c",
  SITE_MODE: "personal",
  OWNER_USERNAME: "cirella",
  PAYMENT_PROVIDER: "stripe,paypal",
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  PAYPAL_CLIENT_ID: "client",
  PAYPAL_CLIENT_SECRET: "secret",
  PAYPAL_WEBHOOK_ID: "WH-1",
  PAYPAL_ENV: "live",
  CRON_SECRET: SECRET,
  APP_SECRET: SECRET,
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_x",
  EMAIL_FROM: "Cirella <hola@cirellaschafer.com>",
  STORAGE_DRIVER: "s3",
  S3_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com",
  S3_BUCKET: "web",
  S3_ACCESS_KEY_ID: "id",
  S3_SECRET_ACCESS_KEY: "secret",
  CLIENT_IP_HEADER: "cf-connecting-ip",
};
const errorsOf = (raw: Raw) => {
  const r = validateEnv(raw);
  return r.ok ? [] : r.errors;
};
const hasError = (raw: Raw, fragment: string) => {
  const errors = errorsOf(raw);
  ok(errors.some((e) => e.includes(fragment)), `se esperaba «${fragment}»; errores: ${JSON.stringify(errors)}`);
};

test("web personal con Stripe y PayPal en producción → válida, sin clave publicable ni webhook de Connect", () => eq(errorsOf(PERSONAL_SALES), []));
test("PAYMENT_PROVIDER se normaliza: «paypal, stripe» → «stripe,paypal»", () => {
  const r = validateEnv({ ...PERSONAL_SALES, PAYMENT_PROVIDER: "paypal, stripe" });
  ok(r.ok);
  if (r.ok) eq(r.env.PAYMENT_PROVIDER, "stripe,paypal");
});
test("PayPal sin claves → error que dice dónde están", () => hasError({ ...PERSONAL_SALES, PAYPAL_CLIENT_ID: undefined }, "Falta PAYPAL_CLIENT_ID"));
test("PayPal sin el id del webhook en producción → error", () => hasError({ ...PERSONAL_SALES, PAYPAL_WEBHOOK_ID: undefined }, "Falta PAYPAL_WEBHOOK_ID"));
test("PayPal en sandbox en producción → error", () => hasError({ ...PERSONAL_SALES, PAYPAL_ENV: "sandbox" }, "PAYPAL_ENV=live"));
test("PayPal en la plataforma → error", () => hasError({ ...PERSONAL_SALES, SITE_MODE: "platform" }, "PayPal solo se admite en modo personal"));
test("PAYPAL_API_URL (PayPal falso) prohibida en producción", () => hasError({ ...PERSONAL_SALES, PAYPAL_API_URL: "http://localhost:4010" }, "PAYPAL_API_URL"));
test("PayPal live fuera de producción → error", () =>
  hasError({ ...PERSONAL_SALES, APP_ENV: "development", APP_URL: "http://localhost:3000", STRIPE_SECRET_KEY: "sk_test_x" }, "PAYPAL_ENV=sandbox"));
test("la plataforma sigue exigiendo el webhook de Connect y la clave publicable", () => {
  hasError({ ...PERSONAL_SALES, SITE_MODE: "platform", PAYMENT_PROVIDER: "stripe" }, "STRIPE_CONNECT_WEBHOOK_SECRET");
  hasError({ ...PERSONAL_SALES, SITE_MODE: "platform", PAYMENT_PROVIDER: "stripe" }, "Falta STRIPE_PUBLISHABLE_KEY");
});

// ── Productos de pago en la web personal ──

test("accessModesFor: la web personal que cobra ofrece el pago en la web primero (también sesiones)", () => {
  eq(accessModesFor("personal", "COURSE", true), ["PAID", "FREE_EMAIL", "EXTERNAL"]);
  eq(accessModesFor("personal", "SESSION", true), ["PAID", "EXTERNAL"]);
  eq(accessModesFor("personal", "COURSE", false), ["FREE_EMAIL", "EXTERNAL"]);
  eq(defaultAccessMode("personal", "MEMBERSHIP", true), "PAID");
  eq(resolveAccessMode("PAID", "FREE_EMAIL", "personal", "COURSE", true), "PAID");
  eq(resolveAccessMode(undefined, "PAID", "personal", "SESSION", true), "PAID");
});

test("canAcceptPayments en la web personal: basta con estar activa y que la pasarela esté activa (sin cuenta Express)", () => {
  const owner = { status: "ACTIVE", payoutChargesEnabled: false, payoutProvider: null, payoutAccountId: null };
  // El proceso de pruebas no tiene PAYMENT_PROVIDER de PayPal: «paypal» no está activa.
  eq(canAcceptPayments(owner, "paypal", "personal"), false);
  eq(canAcceptPayments({ ...owner, status: "BLOCKED" }, "simulated", "personal"), false);
  eq(canAcceptPayments(owner, "none", "personal"), false);
  eq(chargeDestination({ ...owner, payoutAccountId: "acct_x", payoutChargesEnabled: true, payoutProvider: "simulated" }, "simulated", "platform"), { destination: "acct_x" });
});

// ── IVA de una empresa de fuera de la UE (OSS «no Unión») ──

const LLC = { country: "US", vatStatus: "OSS_NON_UNION" };
test("OSS no Unión: un curso a una clienta de Alemania lleva el IVA alemán (19 %)", () =>
  eq(decideTax({ mode: "CREATOR", productType: "COURSE", buyerCountry: "DE", creator: LLC }), { seller: "CREATOR", country: "DE", rateBps: 1900, note: ossNote("DE") }));
test("OSS no Unión: una membresía a España, el 21 %", () => eq(decideTax({ mode: "CREATOR", productType: "MEMBERSHIP", buyerCountry: "ES", creator: LLC }).rateBps, 2100));
test("OSS no Unión: fuera de la UE (México, EE. UU., «otro país»), sin IVA", () => {
  for (const c of ["MX", "US", "XX", null]) eq(decideTax({ mode: "CREATOR", productType: "DIGITAL", buyerCountry: c, creator: LLC }).rateBps, 0, String(c));
  eq(decideTax({ mode: "CREATOR", productType: "DIGITAL", buyerCountry: "MX", creator: LLC }).note, NOTE_OUTSIDE_EU);
});
test("OSS no Unión: una lectura en directo o preparada a mano no es servicio electrónico → sin IVA de la UE", () => {
  eq(decideTax({ mode: "CREATOR", productType: "SESSION", buyerCountry: "FR", creator: LLC }), { seller: "CREATOR", country: "FR", rateBps: 0, note: NOTE_NON_UNION_SELLER });
  eq(decideTax({ mode: "CREATOR", productType: "DIGITAL", deliveryMode: "PERSONAL", buyerCountry: "FR", creator: LLC }).rateBps, 0);
});
test("OSS no Unión: precio con IVA incluido (50 € a Alemania → 42,02 + 7,98)", () => eq(splitInclusive(5000, 1900), { baseCents: 4202, taxCents: 798 }));
test("LLC sin alta en el IVA europeo (NONE): nunca lleva IVA", () =>
  eq(decideTax({ mode: "CREATOR", productType: "COURSE", buyerCountry: "DE", creator: { country: "US", vatStatus: "NONE" } }).rateBps, 0));
test("creatorSaleNote: la factura repite la nota del checkout", () => {
  eq(creatorSaleNote(LLC, "DE", 1900), ossNote("DE"));
  eq(creatorSaleNote(LLC, "FR", 0), NOTE_NON_UNION_SELLER);
  eq(creatorSaleNote(LLC, "MX", 0), NOTE_OUTSIDE_EU);
  eq(creatorSaleNote({ vatStatus: "EXEMPT", vatExemptionNote: "Exenta art. 20" }, "ES", 0), "Exenta art. 20");
});

// ── Textos legales de la web personal que cobra ──

test("legalKind: plataforma, personal sin cobros y personal que cobra", () => {
  eq(legalKind(false, ["stripe"]), "platform");
  eq(legalKind(true, []), "personal");
  eq(legalKind(true, ["stripe", "paypal"]), "personal-sales");
});
test("condiciones de la web personal que cobra: sin plataforma, con tarjeta y PayPal y desistimiento", () => {
  const docs = renderPersonalSalesTemplates({ displayName: "Cirella Schäfer", changeNoticeHours: 24, paymentKeys: ["stripe", "paypal"] });
  ok(!/Cirella\b(?! Schäfer)/.test(docs.terms) && !docs.privacy.includes("por encargo de la vendedora"), "no nombra a la plataforma");
  ok(docs.terms.includes("con tarjeta (también Apple Pay y Google Pay) a través de Stripe o con PayPal"), docs.terms);
  ok(docs.privacy.includes("Los pagos los procesan Stripe y PayPal"), docs.privacy);
  ok(docs.refunds.includes("14 días"), "derecho de desistimiento");
  eq(personalPaymentMethodsText(["paypal"]), "con PayPal");
});
test("currentPersonalSalesDocs: lo personalizado por la dueña manda", () =>
  eq(currentPersonalSalesDocs({ displayName: "Ana", legalTerms: "Mías", legalRefunds: null, legalPrivacy: null }, ["stripe"]).terms, "Mías"));

test("menú del panel: en la web personal que cobra, «Ventas» (no «Inscripciones»)", () => {
  const flags = { personal: true, sales: true, showBookings: true };
  ok(panelNav(flags).some((i) => i.href === "/panel/ventas" && i.label === "Ventas"));
  ok(mobileNav(flags).some((i) => i.href === "/panel/ventas" && i.label === "Ventas"));
  ok(panelNav({ ...flags, sales: false }).some((i) => i.href === "/panel/ventas" && i.label === "Inscripciones"));
});

// ── PayPal: traducción pura ──

test("PayPal: importes en el formato de su API, ida y vuelta", () => {
  eq([toPaypalValue(5000, "EUR"), toPaypalValue(1999, "usd"), toPaypalValue(50000, "JPY")], ["50.00", "19.99", "500"]);
  eq([fromPaypalValue("50.00", "EUR"), fromPaypalValue("19.9", "EUR"), fromPaypalValue("7", "EUR")], [5000, 1990, 700]);
  ok(Number.isNaN(fromPaypalValue("abc", "EUR")) && Number.isNaN(fromPaypalValue(undefined, "EUR")));
});
test("PayPal: custom_id lleva el pedido o la renovación (≤127 caracteres) y vuelve igual", () => {
  eq(decodeCustomId(encodeCustomId({ orderId: "ord_1", creatorId: "cr_1" })), { orderId: "ord_1" });
  const m = { subscriptionId: "sub_1", periodKey: "2026-11-16T10:00:00.000Z", attempt: "1", kind: "renewal" };
  const enc = encodeCustomId(m);
  ok(enc.length <= 127, enc);
  eq(decodeCustomId(enc), m);
  eq(decodeCustomId(encodeCustomId({ subscriptionId: "sub_1", periodKey: "2026-11-16T10:00:00.000Z" })), { subscriptionId: "sub_1", periodKey: "2026-11-16T10:00:00.000Z" });
  eq(decodeCustomId("cualquier cosa"), {});
});

const approvedOrder = {
  id: "PP-ORDER-1",
  status: "APPROVED",
  purchase_units: [{ custom_id: "o|ord_1", amount: { currency_code: "EUR", value: "50.00" } }],
};
const completedOrder = {
  id: "PP-ORDER-1",
  status: "COMPLETED",
  payment_source: { paypal: { email_address: "laura@example.com", attributes: { vault: { id: "VAULT-1", status: "VAULTED", customer: { id: "CUS-1" } } } } },
  purchase_units: [{ custom_id: "o|ord_1", amount: { currency_code: "EUR", value: "50.00" }, payments: { captures: [{ id: "CAP-1", status: "COMPLETED", amount: { currency_code: "EUR", value: "50.00" }, custom_id: "o|ord_1" }] } }],
};

test("PayPal mapOrder: aprobado sin cobrar → requires_action con approved (no se entrega)", () => {
  const s = mapOrder(approvedOrder);
  eq([s.state, s.approved, s.checkoutRef, s.amountCents, s.currency, s.metadata], ["requires_action", true, "PP-ORDER-1", 5000, "EUR", { orderId: "ord_1" }]);
});
test("PayPal mapOrder: cobrado → succeeded con el cobro, el pedido y la cuenta guardada", () => {
  const s = mapOrder(completedOrder);
  eq([s.state, s.ref, s.checkoutRef, s.amountCents, s.destinationAccount, s.paymentMethodRef, s.customerRef], ["succeeded", "CAP-1", "PP-ORDER-1", 5000, null, "VAULT-1", "CUS-1"]);
});
test("PayPal mapOrder: cobro rechazado → failed con mensaje para la compradora", () => {
  const s = mapOrder({ ...completedOrder, purchase_units: [{ ...completedOrder.purchase_units[0], payments: { captures: [{ id: "CAP-2", status: "DECLINED", amount: { currency_code: "EUR", value: "50.00" } }] } }] });
  eq(s.state, "failed");
  ok(s.error?.includes("PayPal"), s.error);
});
test("PayPal approvalLink: payer-action (o approve)", () => {
  eq(approvalLink({ id: "x", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "self", href: "a" }, { rel: "payer-action", href: "https://www.paypal.com/checkoutnow?token=x" }] }), "https://www.paypal.com/checkoutnow?token=x");
  eq(approvalLink({ id: "x", status: "CREATED", links: [{ rel: "approve", href: "b" }] }), "b");
});
test("PayPal mapRefund: el cobro sale del enlace «up» y nuestro Refund del custom_id", () =>
  eq(
    mapRefund({ id: "RF-1", status: "COMPLETED", amount: { currency_code: "EUR", value: "10.00" }, custom_id: "re|ref_1", links: [{ rel: "up", href: "https://api-m.paypal.com/v2/payments/captures/CAP-1" }] }),
    { kind: "refund", paymentRef: "CAP-1", refundRef: "RF-1", refundId: "ref_1", amountCents: 1000, status: "succeeded" },
  ));
test("PayPal mapDispute: abierta, perdida (a favor de la compradora) y ganada", () => {
  const d = { dispute_id: "PP-D-1", disputed_transactions: [{ seller_transaction_id: "CAP-1" }], dispute_amount: { currency_code: "EUR", value: "50.00" }, reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" };
  eq(mapDispute(d, "CUSTOMER.DISPUTE.CREATED"), { kind: "dispute", paymentRef: "CAP-1", disputeRef: "PP-D-1", status: "OPEN", amountCents: 5000, reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" });
  eq((mapDispute({ ...d, dispute_outcome: { outcome_code: "RESOLVED_BUYER_FAVOUR" } }, "CUSTOMER.DISPUTE.RESOLVED") as { status: string }).status, "LOST");
  eq((mapDispute({ ...d, dispute_outcome: { outcome_code: "RESOLVED_SELLER_FAVOUR" } }, "CUSTOMER.DISPUTE.RESOLVED") as { status: string }).status, "WON");
});
test("PayPal mapEvent: cobro completado, pendiente y rechazado; el revertido se ignora (lo cuenta la disputa)", () => {
  const cap = { id: "CAP-1", status: "COMPLETED", amount: { currency_code: "EUR", value: "50.00" }, custom_id: "o|ord_1", supplementary_data: { related_ids: { order_id: "PP-ORDER-1" } } };
  const done = mapEvent({ id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: cap })[0];
  eq(done.kind === "payment" ? [done.status.state, done.status.ref, done.status.checkoutRef, done.status.metadata.orderId] : null, ["succeeded", "CAP-1", "PP-ORDER-1", "ord_1"]);
  const pending = mapEvent({ id: "WH-2", event_type: "PAYMENT.CAPTURE.PENDING", resource: { ...cap, status: "PENDING" } })[0];
  eq(pending.kind === "payment" && pending.status.state, "processing");
  const denied = mapEvent({ id: "WH-3", event_type: "PAYMENT.CAPTURE.DENIED", resource: { ...cap, status: "DECLINED" } })[0];
  eq(denied.kind === "payment" && denied.status.state, "failed");
  eq(mapEvent({ id: "WH-4", event_type: "PAYMENT.CAPTURE.REVERSED", resource: {} }), [{ kind: "ignored" }]);
  const approved = mapEvent({ id: "WH-5", event_type: "CHECKOUT.ORDER.APPROVED", resource: approvedOrder })[0];
  eq(approved.kind === "payment" && approved.status.approved, true);
});

// ── PayPal: el proveedor con una API falsa ──

type Call = { method: string; path: string; headers: Record<string, string>; body: unknown; raw?: string };
/** PayPal falso: cada ruta responde lo que diga `routes` (o 404). */
function fakePaypal(routes: Record<string, (body: unknown, call: Call) => { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const http: PaypalHttp = async (url, init) => {
    const path = url.replace("https://api.test", "");
    let body: unknown = init.body;
    try {
      body = init.body && init.headers["Content-Type"] === "application/json" ? JSON.parse(init.body) : init.body;
    } catch {}
    const call = { method: init.method, path, headers: init.headers, body, raw: init.body };
    calls.push(call);
    if (path === "/v1/oauth2/token") return { status: 200, text: async () => JSON.stringify({ access_token: "TOKEN", expires_in: 32400 }) };
    const route = routes[`${init.method} ${path}`];
    const r = route ? route(body, call) : { status: 404, body: { name: "RESOURCE_NOT_FOUND", details: [{ issue: "INVALID_RESOURCE_ID" }] } };
    return { status: r.status, text: async () => JSON.stringify(r.body) };
  };
  const api = createPaypalApi({ baseUrl: "https://api.test", clientId: "id", clientSecret: "secret", webhookId: "WH-ID" }, http);
  return { api, calls, provider: createPaypalProvider(api, { webhookId: "WH-ID" }) };
}

const payment: StartPaymentInput = {
  orderId: "ord_1",
  amountCents: 5000,
  currency: "EUR",
  description: "Curso de Human Design",
  customerEmail: "laura@example.com",
  platformFeeCents: 0,
  destinationAccount: null,
  statementSuffix: "CIRELLA",
  saveForFutureUse: false,
  payment: {},
  returnUrl: "https://cirellaschafer.com/api/payments/return?via=paypal&ref={REF}",
  cancelUrl: "https://cirellaschafer.com/cirella/curso/checkout?pedido=ord_1&cancelado=1",
  metadata: { orderId: "ord_1", creatorId: "cr_1" },
};
const created = { id: "PP-ORDER-1", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=PP-ORDER-1" }] };

test("PayPal startPayment: pedido con el importe, el custom_id, vuelta sin {REF} y sin guardar la cuenta", async () => {
  const { provider, calls } = fakePaypal({ "POST /v2/checkout/orders": () => ({ status: 200, body: created }) });
  const r = await provider.startPayment(payment);
  eq(r.state === "requires_action" ? [r.checkoutRef, r.redirectUrl] : r, ["PP-ORDER-1", "https://www.sandbox.paypal.com/checkoutnow?token=PP-ORDER-1"]);
  const call = calls.find((c) => c.path === "/v2/checkout/orders")!;
  eq(call.headers.Authorization, "Bearer TOKEN");
  ok(call.headers["PayPal-Request-Id"].startsWith("checkout:ord_1:"));
  const b = call.body as { intent: string; purchase_units: { custom_id: string; amount: unknown }[]; payment_source: { paypal: { experience_context: { return_url: string; locale: string }; attributes?: unknown } } };
  eq([b.intent, b.purchase_units[0].custom_id, b.purchase_units[0].amount], ["CAPTURE", "o|ord_1", { currency_code: "EUR", value: "50.00" }]);
  eq(b.payment_source.paypal.experience_context.return_url, "https://cirellaschafer.com/api/payments/return?via=paypal&ref=");
  eq(b.payment_source.paypal.experience_context.locale, "es-ES");
  eq(b.payment_source.paypal.attributes, undefined);
});

test("PayPal startPayment (membresía): pide guardar la cuenta; si la cuenta de PayPal no lo permite, cobra igual sin guardarla", async () => {
  let n = 0;
  const { provider, calls } = fakePaypal({
    "POST /v2/checkout/orders": (body) => {
      n++;
      const vault = (body as { payment_source: { paypal: { attributes?: unknown } } }).payment_source.paypal.attributes;
      return vault ? { status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "PAYEE_NOT_ENABLED_FOR_VAULTING" }] } } : { status: 200, body: created };
    },
  });
  const r = await provider.startPayment({ ...payment, saveForFutureUse: true });
  eq([r.state, n], ["requires_action", 2]);
  const first = calls.filter((c) => c.path === "/v2/checkout/orders")[0].body as { payment_source: { paypal: { attributes: { vault: unknown } } } };
  eq(first.payment_source.paypal.attributes.vault, { store_in_vault: "ON_SUCCESS", usage_type: "MERCHANT", customer_type: "CONSUMER" });
});

test("PayPal startPayment: nunca cobra hacia una cuenta de Connect", async () => {
  const { provider, calls } = fakePaypal({});
  eq((await provider.startPayment({ ...payment, destinationAccount: "acct_x" })).state, "failed");
  eq(calls.length, 0);
});

test("PayPal getPaymentStatus no cobra; completeCheckout sí, con la misma PayPal-Request-Id (cobro único)", async () => {
  const { provider, calls } = fakePaypal({
    "GET /v2/checkout/orders/PP-ORDER-1": () => ({ status: 200, body: approvedOrder }),
    "POST /v2/checkout/orders/PP-ORDER-1/capture": () => ({ status: 201, body: completedOrder }),
  });
  const status = await provider.getPaymentStatus("PP-ORDER-1");
  eq([status.state, status.approved], ["requires_action", true]);
  ok(!calls.some((c) => c.path.endsWith("/capture")), "consultar no cobra");
  const done = await provider.completeCheckout!("PP-ORDER-1");
  eq([done.state, done.ref, done.paymentMethodRef], ["succeeded", "CAP-1", "VAULT-1"]);
  eq(calls.find((c) => c.path.endsWith("/capture"))!.headers["PayPal-Request-Id"], "capture:PP-ORDER-1");
});

test("PayPal completeCheckout: ya cobrado (la vuelta y el aviso a la vez) → lee el pedido", async () => {
  const { provider } = fakePaypal({
    "POST /v2/checkout/orders/PP-ORDER-1/capture": () => ({ status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] } }),
    "GET /v2/checkout/orders/PP-ORDER-1": () => ({ status: 200, body: completedOrder }),
  });
  eq((await provider.completeCheckout!("PP-ORDER-1")).state, "succeeded");
});

test("PayPal completeCheckout: forma de pago rechazada → failed (la compradora vuelve al checkout)", async () => {
  const { provider } = fakePaypal({
    "POST /v2/checkout/orders/PP-ORDER-1/capture": () => ({ status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] } }),
    "GET /v2/checkout/orders/PP-ORDER-1": () => ({ status: 200, body: approvedOrder }),
  });
  const s = await provider.completeCheckout!("PP-ORDER-1");
  eq([s.state, s.metadata.orderId], ["failed", "ord_1"]);
});

test("PayPal getPaymentStatus con la referencia del cobro (no del pedido): lee el cobro", async () => {
  const { provider } = fakePaypal({
    "GET /v2/payments/captures/CAP-1": () => ({ status: 200, body: { id: "CAP-1", status: "COMPLETED", amount: { currency_code: "EUR", value: "50.00" }, custom_id: "o|ord_1" } }),
  });
  const s = await provider.getPaymentStatus("CAP-1");
  eq([s.state, s.ref, s.metadata.orderId], ["succeeded", "CAP-1", "ord_1"]);
});

const renewal = {
  subscriptionId: "sub_1",
  periodKey: "2026-11-16T10:00:00.000Z",
  amountCents: 1500,
  currency: "EUR",
  description: "Renovación · Comunidad",
  customerEmail: "laura@example.com",
  platformFeeCents: 0,
  destinationAccount: null,
  statementSuffix: "CIRELLA",
  customerRef: "CUS-1",
  paymentMethodRef: "VAULT-1",
  metadata: { subscriptionId: "sub_1", periodKey: "2026-11-16T10:00:00.000Z", attempt: "0", kind: "renewal" },
  idempotencyKey: "renewal:sub_1:2026-11-16T10:00:00.000Z:0",
};

test("PayPal chargeSaved: renovación con la cuenta guardada, sin la clienta delante y con su clave de idempotencia", async () => {
  const renewed = {
    id: "PP-ORDER-2",
    status: "COMPLETED",
    purchase_units: [{ custom_id: "s|sub_1|2026-11-16T10:00:00.000Z|0|r", payments: { captures: [{ id: "CAP-9", status: "COMPLETED", amount: { currency_code: "EUR", value: "15.00" } }] } }],
  };
  const { provider, calls } = fakePaypal({ "POST /v2/checkout/orders": () => ({ status: 201, body: renewed }) });
  const r = await provider.chargeSaved(renewal);
  eq(r.state === "succeeded" ? [r.ref, r.paymentMethodRef] : r, ["CAP-9", "VAULT-1"]);
  const call = calls.find((c) => c.path === "/v2/checkout/orders")!;
  eq(call.headers["PayPal-Request-Id"], renewal.idempotencyKey);
  eq((call.body as { payment_source: unknown }).payment_source, { paypal: { vault_id: "VAULT-1" } });
  eq((call.body as { purchase_units: { custom_id: string }[] }).purchase_units[0].custom_id, "s|sub_1|2026-11-16T10:00:00.000Z|0|r");
});

test("PayPal chargeSaved: sin cuenta guardada → fallo que pide «Pagar ahora»; rechazo de PayPal → fallo", async () => {
  const { provider } = fakePaypal({ "POST /v2/checkout/orders": () => ({ status: 422, body: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] } }) });
  const none = await provider.chargeSaved({ ...renewal, paymentMethodRef: null });
  ok(none.state === "failed" && none.error.includes("Pagar ahora"), JSON.stringify(none));
  eq((await provider.chargeSaved(renewal)).state, "failed");
});

test("PayPal refund: parcial con importe y moneda, el Refund en custom_id y la idempotencia", async () => {
  const { provider, calls } = fakePaypal({ "POST /v2/payments/captures/CAP-1/refund": () => ({ status: 201, body: { id: "RF-1", status: "COMPLETED" } }) });
  const r = await provider.refund({ paymentRef: "CAP-1", amountCents: 1000, currency: "EUR", refundApplicationFee: true, idempotencyKey: "refund_ref_1", metadata: { refundId: "ref_1" } });
  eq(r, { ok: true, refundRef: "RF-1", status: "succeeded" });
  const call = calls.find((c) => c.path.endsWith("/refund"))!;
  eq(call.body, { amount: { currency_code: "EUR", value: "10.00" }, custom_id: "re|ref_1" });
  eq(call.headers["PayPal-Request-Id"], "refund_ref_1");
});

test("PayPal refund total: sin importe (todo lo que queda)", async () => {
  const { provider, calls } = fakePaypal({ "POST /v2/payments/captures/CAP-1/refund": () => ({ status: 201, body: { id: "RF-2", status: "PENDING" } }) });
  eq(await provider.refund({ paymentRef: "CAP-1", refundApplicationFee: true, idempotencyKey: "dup:CAP-1" }), { ok: true, refundRef: "RF-2", status: "pending" });
  eq(calls.find((c) => c.path.endsWith("/refund"))!.body, {});
});

test("PayPal parseWebhook: se verifica con PayPal enviando el cuerpo tal cual llegó", async () => {
  const raw = `{"id":"WH-9","event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"id":"CAP-1","status":"COMPLETED","amount":{"currency_code":"EUR","value":"50.00"},"custom_id":"o|ord_1"}}`;
  let sent = "";
  const { provider } = fakePaypal({
    "POST /v1/notifications/verify-webhook-signature": (_b, call) => {
      sent = call.raw ?? "";
      return { status: 200, body: { verification_status: "SUCCESS" } };
    },
  });
  const headers = new Headers({
    "paypal-transmission-id": "t-1",
    "paypal-transmission-time": "2026-10-16T10:00:00Z",
    "paypal-transmission-sig": "sig",
    "paypal-cert-url": "https://api.paypal.com/cert",
    "paypal-auth-algo": "SHA256withRSA",
  });
  const parsed = await provider.parseWebhook(raw, headers);
  eq([parsed.eventId, parsed.type], ["WH-9", "PAYMENT.CAPTURE.COMPLETED"]);
  ok(sent.endsWith(`"webhook_id":"WH-ID","webhook_event":${raw}}`), sent);
  eq((JSON.parse(sent) as { transmission_sig: string }).transmission_sig, "sig");
});

test("PayPal parseWebhook: firma rechazada por PayPal o sin cabeceras → WebhookSignatureError", async () => {
  const { provider } = fakePaypal({ "POST /v1/notifications/verify-webhook-signature": () => ({ status: 200, body: { verification_status: "FAILURE" } }) });
  const headers = new Headers({ "paypal-transmission-sig": "sig" });
  await throws(async () => {
    try {
      await provider.parseWebhook(`{"id":"x","event_type":"y","resource":{}}`, headers);
    } catch (e) {
      if (e instanceof WebhookSignatureError) throw new Error("firma");
      throw e;
    }
  }, /firma/);
  const { provider: p2 } = fakePaypal({});
  await throws(async () => {
    try {
      await p2.parseWebhook("{}", new Headers());
    } catch (e) {
      if (e instanceof WebhookSignatureError) throw new Error("firma");
      throw e;
    }
  }, /firma/);
});

test("PayPal API: unas claves rechazadas dan un error claro", async () => {
  const http: PaypalHttp = async () => ({ status: 401, text: async () => JSON.stringify({ error: "invalid_client", error_description: "Client Authentication failed" }) });
  const api = createPaypalApi({ baseUrl: "https://api.test", clientId: "x", clientSecret: "y", webhookId: null }, http);
  await throws(() => api.getOrder("x"), /Client Authentication failed/);
  ok(new PaypalApiError(422, "X", null, "m") instanceof Error);
});

// ── Stripe: cobro directo de la web personal ──

function fakeStripeDirect() {
  const calls: { method: string; params: unknown }[] = [];
  const client = {
    checkout: {
      sessions: {
        create: async (params: unknown) => {
          calls.push({ method: "checkout.sessions.create", params });
          return { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" };
        },
        retrieve: async () => ({}),
        expire: async () => ({}),
      },
    },
    paymentIntents: {
      create: async (params: unknown) => {
        calls.push({ method: "paymentIntents.create", params });
        return { id: "pi_1", status: "succeeded" };
      },
      retrieve: async () => ({}),
    },
    refunds: {
      create: async (params: unknown) => {
        calls.push({ method: "refunds.create", params });
        return { id: "re_1", status: "succeeded" };
      },
    },
    accounts: { create: async () => ({}), retrieve: async () => ({}), createLoginLink: async () => ({}) },
    accountLinks: { create: async () => ({}) },
    webhooks: { constructEvent: () => ({}) },
  } as unknown as StripeLike;
  return { client, calls };
}
const direct = { webhookSecrets: ["whsec_x"], onBehalfOf: false, connect: false };

test("Stripe directo: Checkout sin comisión, transferencia ni on_behalf_of (el cobro es de la dueña)", async () => {
  const { client, calls } = fakeStripeDirect();
  const r = await createStripeProvider(client, direct).startPayment({ ...payment, saveForFutureUse: true, returnUrl: "https://cirellaschafer.com/api/payments/return?via=stripe&ref={REF}" });
  eq(r.state, "requires_action");
  const p = calls[0].params as Stripe.Checkout.SessionCreateParams;
  eq([p.payment_intent_data?.application_fee_amount, p.payment_intent_data?.transfer_data, p.payment_intent_data?.on_behalf_of], [undefined, undefined, undefined]);
  eq(p.payment_intent_data?.setup_future_usage, "off_session");
  ok(p.success_url?.endsWith("via=stripe&ref={CHECKOUT_SESSION_ID}"), p.success_url);
});

test("Stripe directo: renovación sin campos de Connect; reembolso sin revertir transferencias", async () => {
  const { client, calls } = fakeStripeDirect();
  const provider = createStripeProvider(client, direct);
  eq((await provider.chargeSaved({ ...renewal, paymentMethodRef: "pm_1", customerRef: "cus_1" })).state, "succeeded");
  const pi = calls[0].params as Stripe.PaymentIntentCreateParams;
  eq([pi.application_fee_amount, pi.transfer_data, pi.off_session], [undefined, undefined, true]);
  await provider.refund({ paymentRef: "pi_1", amountCents: 500, refundApplicationFee: true, idempotencyKey: "r1" });
  const re = calls[1].params as Stripe.RefundCreateParams;
  eq([re.reverse_transfer, re.refund_application_fee, re.amount], [undefined, undefined, 500]);
  eq(await provider.recoverDispute!({ paymentRef: "pi_1", disputeRef: "dp_1", amountCents: 500 }), { ok: true, reversalRef: null });
});

test("Stripe: un cobro que no encaja con el modo no se intenta (sin cuenta en la plataforma, con cuenta en la personal)", async () => {
  const { client, calls } = fakeStripeDirect();
  eq((await createStripeProvider(client, direct).startPayment({ ...payment, destinationAccount: "acct_x" })).state, "failed");
  eq((await createStripeProvider(client, { ...direct, connect: true }).startPayment(payment)).state, "failed");
  eq(calls.length, 0);
});

// ── Cabeceras de seguridad ──

test("CSP: con PayPal y Stripe activos se puede ir a sus páginas de pago", async () => {
  const { buildCsp, securityHeaderOptionsFromEnv } = await import("../../lib/security-headers");
  const o = securityHeaderOptionsFromEnv({ PAYMENT_PROVIDER: "stripe,paypal", STRIPE_SECRET_KEY: "sk_test_x", APP_URL: "https://cirellaschafer.com" } as unknown as NodeJS.ProcessEnv);
  eq([o.stripe, o.paypal], [true, true]);
  const formAction = buildCsp(o).split("; ").find((d) => d.startsWith("form-action"));
  eq(formAction, "form-action 'self' https://checkout.stripe.com https://www.paypal.com https://www.sandbox.paypal.com");
  const none = securityHeaderOptionsFromEnv({ PAYMENT_PROVIDER: "none" } as unknown as NodeJS.ProcessEnv);
  eq([none.stripe, none.paypal], [false, false]);
});

// ── Rutas de la web personal ──

test("isForeignCreatorPath: otra usuaria (y sus productos) sí; la dueña, las rutas de la web y los archivos no", async () => {
  const { isForeignCreatorPath } = await import("../../lib/personal-routing");
  for (const p of ["/maria", "/maria/", "/maria/yoga", "/Maria/legal", "/sofia/opengraph-image"]) eq(isForeignCreatorPath(p, "ana"), true, p);
  for (const p of ["/", "/ana", "/ANA/gene-keys", "/panel", "/api/webhooks/paypal", "/entrar", "/cuenta/compras", "/demo/ana.webp", "/robots.txt", "/.well-known/x", "/_no-existe"])
    eq(isForeignCreatorPath(p, "ana"), false, p);
  eq(isForeignCreatorPath("/maria", null), false, "en la plataforma nunca");
  eq(isForeignCreatorPath("/cirella", "cirella"), false, "la dueña puede llamarse como la marca");
});
