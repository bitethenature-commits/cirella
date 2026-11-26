/**
 * Pagos sin red: estado de la cuenta de cobro, textos de los requisitos, el proveedor de Stripe con
 * un cliente falso (parámetros que se envían, errores y firmas de webhooks generadas en local) y
 * las tarjetas de prueba del simulador.
 */
import Stripe from "stripe";
import { createStripeProvider, type StripeLike } from "../../lib/payments/stripe";
import { mapEvent, mapSession } from "../../lib/payments/stripe-map";
import { WebhookSignatureError, type PayoutAccountSnapshot, type StartPaymentInput } from "../../lib/payments/provider";
import { nextRenewalAttempt, renewalPeriodKey } from "../../lib/payments/renewal";
import { simulatedProvider } from "../../lib/payments/simulated";
import { canAcceptPayments, derivePayoutStatus, describeRequirements, payoutView } from "../../lib/payouts";
import { eq, ok, test, throws } from "./harness";

// ── Estado de la cuenta de cobro ──

const snap = (o: Partial<PayoutAccountSnapshot> = {}): PayoutAccountSnapshot => ({
  accountId: "acct_1",
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  currentlyDue: [],
  pastDue: [],
  eventuallyDue: [],
  pendingVerification: [],
  disabledReason: null,
  currentDeadline: null,
  ...o,
});

const DOC = "individual.verification.document";
for (const [name, s, want] of [
  ["sin cuenta", null, "NONE"],
  ["formulario sin terminar", snap(), "PENDING"],
  ["datos enviados y documento en revisión", snap({ detailsSubmitted: true, pendingVerification: [DOC] }), "VERIFYING"],
  ["falta el IBAN", snap({ detailsSubmitted: true, currentlyDue: ["external_account"] }), "ACTION_REQUIRED"],
  ["falta un documento (vencido)", snap({ detailsSubmitted: true, currentlyDue: [DOC], disabledReason: "requirements.past_due" }), "ACTION_REQUIRED"],
  ["puede cobrar aunque Stripe pida algo con plazo", snap({ chargesEnabled: true, detailsSubmitted: true, currentlyDue: ["individual.dob.day"] }), "ACTIVE"],
  ["rechazada por Stripe", snap({ disabledReason: "rejected.fraud" }), "REJECTED"],
] as const)
  test(`derivePayoutStatus: ${name} → ${want}`, () => eq(derivePayoutStatus(s), want));

test("describeRequirements traduce, quita repetidos y mantiene el orden", () =>
  eq(describeRequirements([DOC, "external_account", "individual.address.city", "individual.address.line1", "foo.bar"]), [
    "una foto de tu DNI, NIE o pasaporte",
    "tu cuenta bancaria (IBAN)",
    "tu dirección",
    "un dato más que pide Stripe",
  ]));

const active = { status: "ACTIVE", payoutChargesEnabled: true, payoutProvider: "stripe" };
test("canAcceptPayments: activa, Stripe permite cobrar y cuenta de la pasarela actual", () => ok(canAcceptPayments(active, "stripe")));
test("canAcceptPayments: una cuenta del simulador nunca vende con Stripe", () =>
  eq(canAcceptPayments({ ...active, payoutProvider: "simulated" }, "stripe"), false));
test("canAcceptPayments: sin cobros activados → no", () => eq(canAcceptPayments({ ...active, payoutChargesEnabled: false }, "stripe"), false));
test("canAcceptPayments: creadora bloqueada → no", () => eq(canAcceptPayments({ ...active, status: "BLOCKED" }, "stripe"), false));

test("payoutView: con un documento pendiente explica qué falta y ofrece completar", () => {
  const v = payoutView(
    {
      status: "ACTIVE",
      payoutProvider: "simulated",
      payoutStatus: "ACTION_REQUIRED",
      payoutChargesEnabled: false,
      payoutPayoutsEnabled: false,
      payoutRequirements: { detailsSubmitted: true, currentlyDue: [DOC], disabledReason: "requirements.past_due" },
    },
    { providerKey: "simulated" },
  );
  ok(v.body.startsWith("Te falta subir una foto de tu DNI, NIE o pasaporte"), v.body);
  eq([v.cta, v.canSell, v.tone], ["Completar en Stripe", false, "danger"]);
});

// ── Stripe con un cliente falso ──

type Call = { method: string; params: unknown; opts?: unknown };

const realStripe = new Stripe("sk_test_sin_red");
const WHSEC = "whsec_plataforma_prueba";
const WHSEC_CONNECT = "whsec_connect_prueba";

function fakeStripe(over: { paymentIntentsCreate?: () => unknown } = {}) {
  const calls: Call[] = [];
  const rec =
    (method: string, result: (params: unknown) => unknown) =>
    async (params: unknown, opts?: unknown) => {
      calls.push({ method, params, opts });
      return result(params);
    };
  const client = {
    checkout: {
      sessions: {
        create: rec("checkout.sessions.create", () => ({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" })),
        retrieve: rec("checkout.sessions.retrieve", () => ({})),
        expire: rec("checkout.sessions.expire", () => ({})),
      },
    },
    paymentIntents: {
      create: over.paymentIntentsCreate
        ? async (params: unknown, opts?: unknown) => {
            calls.push({ method: "paymentIntents.create", params, opts });
            return over.paymentIntentsCreate!();
          }
        : rec("paymentIntents.create", () => ({ id: "pi_1", status: "succeeded" })),
      retrieve: rec("paymentIntents.retrieve", () => ({})),
    },
    refunds: { create: rec("refunds.create", () => ({ id: "re_1", status: "succeeded" })) },
    accounts: {
      create: rec("accounts.create", () => ({ id: "acct_new" })),
      retrieve: rec("accounts.retrieve", () => ({})),
      createLoginLink: rec("accounts.createLoginLink", () => ({ url: "https://connect.stripe.com/express/x" })),
    },
    accountLinks: { create: rec("accountLinks.create", () => ({ url: "https://connect.stripe.com/setup/x" })) },
    webhooks: realStripe.webhooks,
  } as unknown as StripeLike;
  return { client, calls };
}

const cfg = { webhookSecrets: [WHSEC, WHSEC_CONNECT], onBehalfOf: false, connect: true };

const membershipPayment: StartPaymentInput = {
  orderId: "ord_1",
  amountCents: 2900,
  currency: "EUR",
  description: "Comunidad privada",
  customerEmail: "laura@example.com",
  platformFeeCents: 58,
  destinationAccount: "acct_ana",
  statementSuffix: "ANA",
  saveForFutureUse: true,
  payment: {},
  returnUrl: "https://cirella.app/api/payments/return?ref={REF}",
  cancelUrl: "https://cirella.app/ana/comunidad-privada/checkout?pedido=ord_1&cancelado=1",
  metadata: { orderId: "ord_1", creatorId: "cr_ana" },
};

test("Stripe startPayment (membresía): Checkout alojado con cargo de destino y tarjeta guardada", async () => {
  const { client, calls } = fakeStripe();
  const before = Date.now();
  const r = await createStripeProvider(client, cfg).startPayment(membershipPayment);
  eq(r.state, "requires_action");
  if (r.state !== "requires_action") return;
  eq([r.checkoutRef, r.redirectUrl], ["cs_test_1", "https://checkout.stripe.com/c/pay/cs_test_1"]);
  eq(calls.length, 1);
  const p = calls[0].params as Stripe.Checkout.SessionCreateParams;
  eq([p.mode, p.locale, p.payment_method_types, p.customer_creation], ["payment", "es", ["card"], "always"]);
  eq(p.payment_intent_data?.application_fee_amount, 58);
  eq(p.payment_intent_data?.transfer_data?.destination, "acct_ana");
  eq(p.payment_intent_data?.setup_future_usage, "off_session");
  eq(p.payment_intent_data?.on_behalf_of, undefined);
  eq(p.line_items?.[0].price_data?.unit_amount, 2900);
  eq(p.line_items?.[0].price_data?.currency, "eur");
  ok(p.success_url?.includes("ref={CHECKOUT_SESSION_ID}"), p.success_url);
  const minutes = ((p.expires_at ?? 0) * 1000 - before) / 60_000;
  ok(minutes > 30 && minutes < 32, `expires_at a ${minutes} min (Stripe exige más de 30)`);
  ok(String((calls[0].opts as { idempotencyKey?: string }).idempotencyKey).startsWith("checkout:ord_1:"));
});

test("Stripe startPayment: on_behalf_of solo con STRIPE_ON_BEHALF_OF=true; sin guardar tarjeta en compras sueltas", async () => {
  const { client, calls } = fakeStripe();
  await createStripeProvider(client, { ...cfg, onBehalfOf: true }).startPayment({ ...membershipPayment, saveForFutureUse: false });
  const p = calls[0].params as Stripe.Checkout.SessionCreateParams;
  eq(p.payment_intent_data?.on_behalf_of, "acct_ana");
  eq([p.payment_intent_data?.setup_future_usage, p.customer_creation], [undefined, undefined]);
});

test("Stripe startPayment: un error de Stripe se traduce a un mensaje para la compradora", async () => {
  const { client } = fakeStripe();
  (client.checkout.sessions as { create: unknown }).create = async () => {
    throw Object.assign(new Error("Stripe no responde (error simulado por la prueba)"), { type: "StripeAPIError" });
  };
  const r = await createStripeProvider(client, cfg).startPayment(membershipPayment);
  eq(r.state, "failed");
  if (r.state === "failed") ok(r.error.startsWith("No hemos podido conectar con la pasarela"), r.error);
});

const renewal = {
  subscriptionId: "sub_1",
  periodKey: "2026-11-01T00:00:00.000Z",
  amountCents: 2900,
  currency: "EUR",
  description: "Renovación · Comunidad privada",
  customerEmail: "laura@example.com",
  platformFeeCents: 58,
  destinationAccount: "acct_ana",
  customerRef: "cus_1",
  paymentMethodRef: "pm_1",
  metadata: { subscriptionId: "sub_1", periodKey: "2026-11-01T00:00:00.000Z", kind: "renewal" },
  idempotencyKey: "renewal:sub_1:2026-11-01T00:00:00.000Z:0",
};

test("Stripe chargeSaved: cobro sin la clienta delante con la tarjeta guardada", async () => {
  const { client, calls } = fakeStripe();
  const r = await createStripeProvider(client, cfg).chargeSaved(renewal);
  eq(r.state, "succeeded");
  const p = calls[0].params as Stripe.PaymentIntentCreateParams;
  eq([p.off_session, p.confirm, p.customer, p.payment_method, p.application_fee_amount], [true, true, "cus_1", "pm_1", 58]);
  eq(p.transfer_data?.destination, "acct_ana");
  eq(p.metadata?.kind, "renewal");
  eq((calls[0].opts as { idempotencyKey: string }).idempotencyKey, renewal.idempotencyKey);
});

test("Stripe chargeSaved: el banco pide autenticación (SCA) → requires_action", async () => {
  const { client } = fakeStripe({ paymentIntentsCreate: () => Promise.reject(Object.assign(new Error("auth"), { type: "StripeCardError", code: "authentication_required" })) });
  eq((await createStripeProvider(client, cfg).chargeSaved(renewal)).state, "requires_action");
});

test("Stripe chargeSaved: tarjeta rechazada → failed con el mensaje en español", async () => {
  const { client } = fakeStripe({
    paymentIntentsCreate: () => Promise.reject(Object.assign(new Error("declined"), { type: "StripeCardError", code: "card_declined", payment_intent: { id: "pi_x" } })),
  });
  const r = await createStripeProvider(client, cfg).chargeSaved(renewal);
  eq(r, { state: "failed", ref: "pi_x", error: "Tu banco ha rechazado la renovación." });
});

test("Stripe refund: recupera la transferencia y respeta refund_application_fee y la idempotencia", async () => {
  const { client, calls } = fakeStripe();
  const r = await createStripeProvider(client, cfg).refund({ paymentRef: "pi_1", amountCents: 1000, refundApplicationFee: false, idempotencyKey: "refund:ord_1:1" });
  eq(r, { ok: true, refundRef: "re_1", status: "succeeded" });
  const p = calls[0].params as Stripe.RefundCreateParams;
  eq([p.payment_intent, p.amount, p.reverse_transfer, p.refund_application_fee], ["pi_1", 1000, true, false]);
  eq((calls[0].opts as { idempotencyKey: string }).idempotencyKey, "refund:ord_1:1");
});

test("Stripe Connect: cuenta Express y enlace al formulario con todos los datos que pedirá", async () => {
  const { client, calls } = fakeStripe();
  const provider = createStripeProvider(client, cfg);
  const { accountId } = await provider.createPayoutAccount({ creatorId: "cr_ana", email: "ana@cirella.app", country: "ES", pageUrl: "https://cirella.app/ana" });
  const url = await provider.payoutOnboardingUrl({ accountId, returnUrl: "https://cirella.app/r", refreshUrl: "https://cirella.app/f" });
  eq([accountId, url], ["acct_new", "https://connect.stripe.com/setup/x"]);
  const acct = calls[0].params as Stripe.AccountCreateParams;
  eq([acct.type, acct.country, acct.capabilities?.transfers?.requested], ["express", "ES", true]);
  eq((calls[0].opts as { idempotencyKey: string }).idempotencyKey, "acct:cr_ana");
  eq((calls[1].params as Stripe.AccountLinkCreateParams).collection_options, { fields: "eventually_due" });
});

// ── Webhooks: firma comprobada sin red ──

function stripeEvent(type: string, object: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { id: `evt_${type.replace(/\W/g, "_")}`, object: "event", type, data: { object }, ...extra } as unknown as Stripe.Event;
}

const succeededPayload = JSON.stringify(
  stripeEvent("payment_intent.succeeded", {
    id: "pi_123",
    object: "payment_intent",
    status: "succeeded",
    amount: 4500,
    currency: "eur",
    transfer_data: { destination: "acct_ana" },
    customer: null,
    payment_method: "pm_9",
    metadata: { orderId: "ord_1", creatorId: "cr_ana" },
    last_payment_error: null,
  }),
);
const headersFor = (payload: string, secret: string) =>
  new Headers({ "stripe-signature": realStripe.webhooks.generateTestHeaderString({ payload, secret }) });

test("Webhook firmado con el secreto de plataforma → un pago completado del pedido", async () => {
  const { client } = fakeStripe();
  const parsed = await createStripeProvider(client, cfg).parseWebhook(succeededPayload, headersFor(succeededPayload, WHSEC));
  eq([parsed.eventId, parsed.type, parsed.accountId, parsed.updates.length], ["evt_payment_intent_succeeded", "payment_intent.succeeded", null, 1]);
  const u = parsed.updates[0];
  ok(u.kind === "payment");
  eq([u.status.state, u.status.ref, u.status.metadata.orderId, u.status.destinationAccount, u.status.amountCents, u.status.currency], [
    "succeeded",
    "pi_123",
    "ord_1",
    "acct_ana",
    4500,
    "EUR",
  ]);
});

test("Webhook firmado con el secreto de Connect también se acepta", async () => {
  const { client } = fakeStripe();
  const parsed = await createStripeProvider(client, cfg).parseWebhook(succeededPayload, headersFor(succeededPayload, WHSEC_CONNECT));
  eq(parsed.updates.length, 1);
});

test("Webhook con el cuerpo manipulado → WebhookSignatureError", async () => {
  const { client } = fakeStripe();
  const headers = headersFor(succeededPayload, WHSEC);
  await throws(async () => {
    try {
      await createStripeProvider(client, cfg).parseWebhook(succeededPayload.replace("4500", "1"), headers);
    } catch (e) {
      ok(e instanceof WebhookSignatureError, "tipo de error");
      throw e;
    }
  });
});

test("Webhook con otro secreto o sin firma → WebhookSignatureError", async () => {
  const { client } = fakeStripe();
  const provider = createStripeProvider(client, cfg);
  for (const headers of [headersFor(succeededPayload, "whsec_otro"), new Headers()]) {
    let error: unknown = null;
    await provider.parseWebhook(succeededPayload, headers).catch((e) => (error = e));
    ok(error instanceof WebhookSignatureError, "se esperaba WebhookSignatureError");
  }
});

// ── Traducción de eventos ──

const session = (o: Record<string, unknown>) => ({
  id: "cs_1",
  object: "checkout.session",
  status: "complete",
  payment_status: "paid",
  payment_intent: "pi_1",
  amount_total: 4500,
  currency: "eur",
  customer: null,
  metadata: { orderId: "ord_1" },
  ...o,
});
const onlyUpdate = (evt: Stripe.Event) => {
  const u = mapEvent(evt);
  eq(u.length, 1);
  return u[0];
};
const paymentState = (evt: Stripe.Event) => {
  const u = onlyUpdate(evt);
  return u.kind === "payment" ? u.status.state : u.kind;
};

test("checkout.session.completed sin pagar todavía → processing", () =>
  eq(paymentState(stripeEvent("checkout.session.completed", session({ payment_status: "unpaid" }))), "processing"));
test("checkout.session.completed pagada → succeeded", () => eq(paymentState(stripeEvent("checkout.session.completed", session({}))), "succeeded"));
test("checkout.session.async_payment_failed → failed", () => eq(paymentState(stripeEvent("checkout.session.async_payment_failed", session({}))), "failed"));
test("checkout.session.expired → canceled", () => eq(paymentState(stripeEvent("checkout.session.expired", session({ status: "expired" }))), "canceled"));
test("payment_intent.payment_failed dentro del Checkout (puede reintentar) → ignored", () =>
  eq(paymentState(stripeEvent("payment_intent.payment_failed", { id: "pi_1", status: "requires_payment_method", amount: 1, currency: "eur", metadata: {} })), "ignored"));
test("payment_intent.payment_failed de una renovación → failed", () =>
  eq(paymentState(stripeEvent("payment_intent.payment_failed", { id: "pi_1", status: "requires_payment_method", amount: 1, currency: "eur", metadata: { kind: "renewal", subscriptionId: "sub_1" } })), "failed"));
test("refund.updated completado → reembolso del pago", () =>
  eq(onlyUpdate(stripeEvent("refund.updated", { id: "re_1", payment_intent: "pi_1", amount: 1000, status: "succeeded" })), {
    kind: "refund",
    paymentRef: "pi_1",
    refundRef: "re_1",
    amountCents: 1000,
    status: "succeeded",
  }));
test("charge.dispute.closed perdido → contracargo LOST", () => {
  const u = onlyUpdate(stripeEvent("charge.dispute.closed", { id: "dp_1", payment_intent: "pi_1", amount: 4500, status: "lost", reason: "fraudulent" }));
  ok(u.kind === "dispute");
  eq([u.status, u.paymentRef, u.disputeRef], ["LOST", "pi_1", "dp_1"]);
});
test("charge.dispute.created → contracargo OPEN", () => {
  const u = onlyUpdate(stripeEvent("charge.dispute.created", { id: "dp_1", payment_intent: "pi_1", amount: 4500, status: "needs_response" }));
  eq(u.kind === "dispute" && u.status, "OPEN");
});
test("account.updated (endpoint de Connect) → sincronizar esa cuenta", () =>
  eq(onlyUpdate(stripeEvent("account.updated", { id: "acct_ana", object: "account" }, { account: "acct_ana" })), { kind: "account", accountId: "acct_ana" }));
test("Un evento que no usamos → ignored", () => eq(onlyUpdate(stripeEvent("customer.created", { id: "cus_1" })), { kind: "ignored" }));
test("mapSession con el PaymentIntent expandido: cuenta de destino y tarjeta guardada", () => {
  const s = mapSession(
    session({ customer: "cus_1", payment_intent: { id: "pi_1", payment_method: "pm_1", transfer_data: { destination: "acct_ana" }, last_payment_error: null } }) as unknown as Stripe.Checkout.Session,
  );
  eq([s.state, s.ref, s.destinationAccount, s.customerRef, s.paymentMethodRef], ["succeeded", "pi_1", "acct_ana", "cus_1", "pm_1"]);
});

// ── Simulador ──

const simInput = (cardNumber: string, o: Partial<StartPaymentInput> = {}): StartPaymentInput => ({
  ...membershipPayment,
  saveForFutureUse: false,
  payment: { method: "card", cardNumber },
  ...o,
});

test("Simulador: 4242… se aprueba al momento", async () => {
  const r = await simulatedProvider.startPayment(simInput("4242 4242 4242 4242"));
  ok(r.state === "succeeded" && r.ref.startsWith("sim_ch_"), JSON.stringify(r));
});
test("Simulador: membresía con 4000 0000 0000 0341 guarda la tarjeta que fallará al renovar", async () => {
  const r = await simulatedProvider.startPayment(simInput("4000 0000 0000 0341", { saveForFutureUse: true }));
  ok(r.state === "succeeded");
  eq(r.paymentMethodRef, "sim_pm_0341");
  ok(r.customerRef?.startsWith("sim_cus_"));
});
test("Simulador: 4000 0000 0000 0002 → rechazada", async () => {
  const r = await simulatedProvider.startPayment(simInput("4000000000000002"));
  ok(r.state === "failed" && r.error.includes("rechazado"), JSON.stringify(r));
});
test("Simulador: 4000 0027 6000 3184 → confirmar en el banco (/test-payment/sim_cs_…)", async () => {
  const r = await simulatedProvider.startPayment(simInput("4000 0027 6000 3184"));
  ok(r.state === "requires_action", JSON.stringify(r));
  ok(r.checkoutRef.startsWith("sim_cs_") && r.redirectUrl.endsWith(`/test-payment/${r.checkoutRef}`), r.redirectUrl);
  const minutes = (r.expiresAt.getTime() - Date.now()) / 60_000;
  ok(minutes > 29 && minutes <= 30);
});
test("Simulador: número demasiado corto → failed", async () => eq((await simulatedProvider.startPayment(simInput("42424242424"))).state, "failed"));
test("Simulador: Apple / Google Pay → aprobado", async () =>
  eq((await simulatedProvider.startPayment(simInput("", { payment: { method: "wallet" } }))).state, "succeeded"));
test("Simulador chargeSaved: tarjeta …0341 → la renovación falla", async () =>
  eq((await simulatedProvider.chargeSaved({ ...renewal, paymentMethodRef: "sim_pm_0341" })).state, "failed"));
test("Simulador chargeSaved: sin tarjeta guardada (membresías del seed) → se renueva", async () => {
  const r = await simulatedProvider.chargeSaved({ ...renewal, customerRef: null, paymentMethodRef: null });
  ok(r.state === "succeeded" && r.ref.startsWith("sim_ch_"));
});

// ── Reintentos de las renovaciones ──

const t = new Date("2026-10-01T08:00:00.000Z");
const days = (n: number) => new Date(t.getTime() + n * 86_400_000);
test("nextRenewalAttempt(0) → +1 día", () => eq(nextRenewalAttempt(0, t), days(1)));
test("nextRenewalAttempt(1) → +3 días", () => eq(nextRenewalAttempt(1, t), days(3)));
test("nextRenewalAttempt(2) → null (se cancela)", () => eq(nextRenewalAttempt(2, t), null));
test("renewalPeriodKey es la fecha ISO del fin del periodo", () => eq(renewalPeriodKey(t), "2026-10-01T08:00:00.000Z"));
