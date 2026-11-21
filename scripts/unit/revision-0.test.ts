/**
 * Revisión 0 · regresiones de la revisión de «Antes de lanzar» (pagos, acceso, legal, IVA, despliegue).
 * Pruebas puras: ni BD ni red (Stripe con un cliente falso).
 */
import Stripe from "stripe";
import { checkoutDeliveryBadge } from "../../lib/delivery";
import { csvCell, toCsv } from "../../lib/csv";
import { redactLoginTokens } from "../../lib/email/outbox";
import { magicLinkEmail } from "../../lib/email/templates";
import { validateEnv } from "../../lib/env";
import { parseCheckoutConsents } from "../../lib/checkout-consents";
import { WAIVER_TEXT, waiverKindFor } from "../../lib/legal";
import { renderCreatorLegalTemplates } from "../../lib/legal-templates";
import { scrubEvent } from "../../lib/monitoring";
import { createStripeProvider, type StripeLike } from "../../lib/payments/stripe";
import { accessStartedAt, toWithdrawalInput, withdrawalEligibility } from "../../lib/refund-math";
import { eq, ok, test } from "./harness";

// ── Stripe con un cliente falso ──

type Call = { method: string; params: unknown; opts?: unknown };
const realStripe = new Stripe("sk_test_sin_red");
const WHSEC = "whsec_revision_cero";
const cfg = { webhookSecrets: [WHSEC], onBehalfOf: false, connect: true };

function fakeStripe(over: Partial<Record<string, (params: unknown, opts?: unknown) => unknown>> = {}) {
  const calls: Call[] = [];
  const rec =
    (method: string, result: (params: unknown, opts?: unknown) => unknown) =>
    async (params: unknown, opts?: unknown) => {
      calls.push({ method, params, opts });
      return (over[method] ?? result)(params, opts);
    };
  const client = {
    checkout: {
      sessions: {
        create: rec("checkout.sessions.create", () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" })),
        retrieve: rec("checkout.sessions.retrieve", () => ({})),
        expire: rec("checkout.sessions.expire", () => ({})),
      },
    },
    paymentIntents: { create: rec("paymentIntents.create", () => ({ id: "pi_1", status: "succeeded" })), retrieve: rec("paymentIntents.retrieve", () => ({})) },
    refunds: { create: rec("refunds.create", () => ({ id: "re_1", status: "succeeded" })) },
    transfers: {
      retrieve: rec("transfers.retrieve", () => ({ id: "tr_1", amount: 5000, amount_reversed: 0 })),
      createReversal: rec("transfers.createReversal", () => ({ id: "trr_1" })),
    },
    accounts: { create: rec("accounts.create", () => ({ id: "acct_1" })), retrieve: rec("accounts.retrieve", () => ({})), createLoginLink: rec("accounts.createLoginLink", () => ({})) },
    accountLinks: { create: rec("accountLinks.create", () => ({})) },
    webhooks: realStripe.webhooks,
  } as unknown as StripeLike;
  return { client, calls };
}

const signed = (payload: string) => new Headers({ "stripe-signature": realStripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC }) });

test("Stripe startPayment: expires_at queda más de 30 min por delante (Stripe rechaza 30 justos)", async () => {
  const { client, calls } = fakeStripe();
  const before = Date.now();
  const r = await createStripeProvider(client, cfg).startPayment({
    orderId: "ord_1",
    amountCents: 2900,
    currency: "EUR",
    description: "Guía",
    customerEmail: "a@example.com",
    platformFeeCents: 58,
    destinationAccount: "acct_ana",
    statementSuffix: "ANA",
    saveForFutureUse: false,
    payment: {},
    returnUrl: "https://x/vuelta?ref={REF}",
    cancelUrl: "https://x/cancelar",
    metadata: { orderId: "ord_1" },
  });
  const p = calls[0].params as Stripe.Checkout.SessionCreateParams;
  const minutes = ((p.expires_at ?? 0) * 1000 - before) / 60_000;
  ok(minutes > 30 && minutes < 32, `expires_at a ${minutes} min`);
  // Lo que se guarda en el pedido (checkoutExpiresAt) es exactamente lo que recibe Stripe.
  ok(r.state === "requires_action" && r.expiresAt.getTime() === (p.expires_at ?? 0) * 1000, JSON.stringify(r));
});

test("Stripe parseWebhook: checkout.session.completed con el PaymentIntent como id → se pide expandido y trae la tarjeta", async () => {
  const session = {
    id: "cs_9",
    object: "checkout.session",
    status: "complete",
    payment_status: "paid",
    payment_intent: "pi_9",
    customer: "cus_9",
    amount_total: 2900,
    currency: "eur",
    metadata: { orderId: "ord_9" },
  };
  const { client, calls } = fakeStripe({
    "checkout.sessions.retrieve": () => ({
      ...session,
      payment_intent: { id: "pi_9", object: "payment_intent", payment_method: "pm_9", customer: "cus_9", transfer_data: { destination: "acct_ana" } },
    }),
  });
  const payload = JSON.stringify({ id: "evt_9", object: "event", type: "checkout.session.completed", data: { object: session } });
  const parsed = await createStripeProvider(client, cfg).parseWebhook(payload, signed(payload));
  const retrieve = calls.find((c) => c.method === "checkout.sessions.retrieve");
  eq(retrieve?.params, "cs_9");
  eq((retrieve?.opts as { expand?: string[] })?.expand, ["payment_intent"]);
  const u = parsed.updates[0];
  ok(u.kind === "payment", JSON.stringify(u));
  if (u.kind !== "payment") return;
  eq([u.status.ref, u.status.paymentMethodRef, u.status.customerRef, u.status.destinationAccount], ["pi_9", "pm_9", "cus_9", "acct_ana"]);
});

test("Stripe parseWebhook: si no se puede pedir la sesión, lanza un error que NO es de firma (→ 500 y Stripe reintenta)", async () => {
  const { client } = fakeStripe({
    "checkout.sessions.retrieve": () => {
      throw new Error("Stripe no responde (simulado)");
    },
  });
  const payload = JSON.stringify({
    id: "evt_10",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_10", object: "checkout.session", status: "complete", payment_status: "paid", payment_intent: "pi_10" } },
  });
  let error: unknown = null;
  await createStripeProvider(client, cfg)
    .parseWebhook(payload, signed(payload))
    .catch((e) => (error = e));
  ok(error instanceof Error && error.constructor.name !== "WebhookSignatureError", String(error));
});

test("Stripe recoverDispute: revierte la parte de la creadora, sin pasar de lo que queda y con clave por contracargo", async () => {
  const seen: unknown[][] = [];
  const { client } = fakeStripe({
    "paymentIntents.retrieve": () => ({ id: "pi_d", latest_charge: { id: "ch_d", transfer: { id: "tr_1" } } }),
    "transfers.retrieve": () => ({ id: "tr_1", amount: 5000, amount_reversed: 1000 }),
  });
  (client.transfers as unknown as { createReversal: (...a: unknown[]) => unknown }).createReversal = async (...a: unknown[]) => {
    seen.push(a);
    return { id: "trr_2" };
  };
  const r = await createStripeProvider(client, cfg).recoverDispute!({ paymentRef: "pi_d", disputeRef: "dp_2", amountCents: 4500 });
  ok(r.ok && r.reversalRef === "trr_2", JSON.stringify(r));
  eq(seen[0][0], "tr_1");
  eq((seen[0][1] as { amount: number }).amount, 4000);
  eq((seen[0][2] as { idempotencyKey: string }).idempotencyKey, "dispute-reversal:dp_2");
});

test("Stripe recoverDispute: sin transferencia → error (se avisa para hacerlo a mano)", async () => {
  const { client } = fakeStripe({ "paymentIntents.retrieve": () => ({ id: "pi_d", latest_charge: { id: "ch_d", transfer: null } }) });
  const r = await createStripeProvider(client, cfg).recoverDispute!({ paymentRef: "pi_d", disputeRef: "dp_3", amountCents: 100 });
  ok(!r.ok, JSON.stringify(r));
});

// ── Factura mensual de comisiones: meses en negativo ──

// ── CSV: el «;» también se entrecomilla (Excel en español) ──

test("csvCell entrecomilla los textos con «;» (fórmula escondida tras el separador)", () => {
  eq(csvCell("Cirella;=1+1;x"), '"Cirella;=1+1;x"');
  eq(csvCell("a;=cmd|' /C calc'!A0"), `"a;=cmd|' /C calc'!A0"`);
  eq(toCsv([["Nombre"], ["Cirella;=1+1"]]), 'Nombre\n"Cirella;=1+1"');
  eq(csvCell("Cirella"), "Cirella");
});

// ── Sentry: sin tokens en las URLs ──

test("scrubEvent: quita la query de la ruta, de la URL y el referer (tokens de los enlaces)", () => {
  const e = scrubEvent({
    request: {
      url: "https://cirella.app/auth/enlace?t=SECRETO",
      query_string: "t=SECRETO",
      cookies: { a: "b" },
      data: "iban=ES00",
      headers: { cookie: "x", authorization: "y", referer: "https://cirella.app/auth/magic?token=SECRETO", "user-agent": "ua" } as Record<string, string>,
    },
    contexts: { nextjs: { request_path: "/auth/magic?token=SECRETO", router_kind: "App Router" } },
  });
  ok(!JSON.stringify(e).includes("SECRETO"), JSON.stringify(e));
  eq(e.contexts?.nextjs?.request_path, "/auth/magic");
  eq(e.request?.url, "https://cirella.app/auth/enlace");
  eq(e.request?.headers, { "user-agent": "ua" });
});

// ── Copia de los emails: sin tokens una vez enviados ──

test("redactLoginTokens tacha los tokens de enlaces personales y mágicos", () => {
  const html = `<a href="https://cirella.app/auth/enlace?t=abc_DEF-123">Ver</a> <a href="https://cirella.app/auth/magic?token=xyz-789">Entrar</a> <a href="https://cirella.app/ana">Cirella</a>`;
  const out = redactLoginTokens(html);
  ok(!out.includes("abc_DEF-123") && !out.includes("xyz-789"), out);
  ok(out.includes("/auth/enlace?t=[redactado]") && out.includes("/auth/magic?token=[redactado]") && out.includes("https://cirella.app/ana"), out);
});

// ── Entorno: VERCEL_ENV=production manda ──

const neon = "postgresql://u:p@ep-xyz.eu-central-1.aws.neon.tech/c?sslmode=require";
const pastedExample = {
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  DEMO_MODE: "true",
  PAYMENT_PROVIDER: "simulated",
  DATABASE_URL: neon,
  DIRECT_URL: neon,
};
test("validateEnv: .env.example pegado en la producción de Vercel (VERCEL_ENV=production) → no arranca", () => {
  const r = validateEnv({ ...pastedExample, VERCEL_ENV: "production", NODE_ENV: "production" });
  ok(!r.ok && r.errors.some((e) => e.includes("VERCEL_ENV=production")), JSON.stringify(r));
});
test("validateEnv: el mismo desarrollo con una BD alojada y sin Vercel sigue valiendo", () => ok(validateEnv(pastedExample).ok));
test("validateEnv: en una previsualización de Vercel (VERCEL_ENV=preview) no se aplica", () => ok(validateEnv({ ...pastedExample, VERCEL_ENV: "preview" }).ok));

// ── «Lo preparo yo»: su propia renuncia (se prepara en cuanto paga) y lo vende la creadora ──

test("waiverKindFor: digital preparado a mano → se prepara ya; automático → acceso inmediato", () => {
  eq(waiverKindFor("DIGITAL", "PERSONAL"), "DIGITAL_PREPARED");
  eq(waiverKindFor("DIGITAL", "AUTOMATIC"), "DIGITAL_IMMEDIATE");
  eq(waiverKindFor("DIGITAL"), "DIGITAL_IMMEDIATE");
  eq(waiverKindFor("COURSE", "PERSONAL"), "DIGITAL_IMMEDIATE");
  eq(waiverKindFor("SESSION"), null);
});
test("parseCheckoutConsents: un digital preparado a mano no se paga sin su casilla y la guarda literal", () => {
  ok(!parseCheckoutConsents({ acceptTerms: "on" }, "DIGITAL", "PERSONAL").ok);
  const r = parseCheckoutConsents({ acceptTerms: "on", waiver: "on" }, "DIGITAL", "PERSONAL");
  ok(r.ok && r.consents.waiverKind === "DIGITAL_PREPARED" && r.consents.waiverText === WAIVER_TEXT.DIGITAL_PREPARED && !!r.consents.waiverVersion, JSON.stringify(r));
  ok(!parseCheckoutConsents({ acceptTerms: "on" }, "DIGITAL", "AUTOMATIC").ok);
});
test("la insignia del checkout de un digital personal no promete acceso inmediato", () => ok(!/inmediat/i.test(JSON.stringify(checkoutDeliveryBadge("DIGITAL", "PERSONAL") ?? ""))));
// ── Desistimiento: una renuncia de antes (sin versión) solo vale desde el primer acceso ──

const paidAt = new Date("2026-10-01T10:00:00Z");
const order = (o: Partial<Parameters<typeof toWithdrawalInput>[0]> = {}) =>
  toWithdrawalInput({
    status: "PAID",
    paidAt,
    productType: "COURSE",
    amountCents: 5900,
    refundedCents: 0,
    waiverAcceptedAt: paidAt,
    metadata: null,
    bookings: [],
    refunds: [],
    ...o,
  });
const day2 = new Date("2026-10-03T10:00:00Z");
test("desistimiento: curso con una renuncia de antes, sin abrir → puede desistir", () => ok(withdrawalEligibility(order(), day2).eligible));
test("desistimiento: curso con la renuncia de ahora (con versión), sin abrir → WAIVED desde el pago", () =>
  eq(withdrawalEligibility(order({ waiverVersion: "2026-10-25#abc" }), day2), { eligible: false, reason: "WAIVED" }));
test("desistimiento: «Lo preparo yo» con su renuncia, aún sin entregar → WAIVED", () =>
  eq(withdrawalEligibility(order({ productType: "DIGITAL", waiverVersion: "2026-10-25#abc" }), day2), { eligible: false, reason: "WAIVED" }));
test("desistimiento: curso con renuncia y ya abierto → WAIVED", () =>
  eq(withdrawalEligibility(order({ metadata: { firstAccessAt: "2026-10-02T09:00:00Z" } }), day2), { eligible: false, reason: "WAIVED" }));
test("accessStartedAt lee Order.metadata.firstAccessAt y tolera basura", () => {
  eq(accessStartedAt({ firstAccessAt: "2026-10-02T09:00:00.000Z" })?.toISOString(), "2026-10-02T09:00:00.000Z");
  eq(accessStartedAt({ firstAccessAt: "no es fecha" }), null);
  eq(accessStartedAt(null), null);
  eq(accessStartedAt("x"), null);
});

// ── Textos ──

test("plantillas de la creadora: sin IVA ni facturas; lo preparado a mano no es acceso inmediato", () => {
  const t = renderCreatorLegalTemplates({
    identity: { legalName: "Cirella", legalTaxId: "12345678Z", legalEntityType: "INDIVIDUAL", legalAddress: "C/ Sol 1", legalPostalCode: "28001", legalCity: "Madrid", legalCountry: "ES", legalEmail: "a@x.es", legalRegistry: null } as never,
    displayName: "Cirella",
    platformName: "Cirella",
    changeNoticeHours: 24,
  });
  ok(!/IVA|factura/i.test(t.terms + t.privacy), t.terms);
  ok(t.terms.includes("prepara para ti"), t.terms);
});
test("email de confirmar la cuenta: pregunta si la creó ella (no solo «confirma tu email»)", () => {
  const m = magicLinkEmail({ url: "https://x/auth/magic?token=t", purpose: "VERIFY_SIGNUP" });
  ok(m.html.includes("¿Has creado tú esta cuenta?") && m.html.includes("contraseña"), m.html);
});
