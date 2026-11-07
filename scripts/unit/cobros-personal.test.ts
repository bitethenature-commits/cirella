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

