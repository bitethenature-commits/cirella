import { hashIp, parseClientIp } from "../../lib/client-ip";
import { validateEnv } from "../../lib/env";
import { captchaRequired } from "../../lib/limits";
import { keyHash, retryAfterText, rlKey } from "../../lib/rate-limit";
import { recoveryDecision, type RecoveryFacts } from "../../lib/recovery-guard";
import { verifyTurnstile } from "../../lib/turnstile";
import { eq, ok, test } from "./harness";

// ── Texto de espera ──
for (const [sec, want] of [[30, "1 minuto"], [60, "1 minuto"], [61, "2 minutos"], [900, "15 minutos"], [3600, "1 hora"], [5400, "2 horas"]] as const)
  test(`retryAfterText(${sec}) → «${want}»`, () => eq(retryAfterText(sec), want));

// ── IP del cliente ──
const headersOf = (h: Record<string, string>) => (name: string) => h[name] ?? null;
test("parseClientIp: con CLIENT_IP_HEADER usa esa cabecera", () =>
  eq(parseClientIp(headersOf({ "cf-connecting-ip": "5.6.7.8", "x-forwarded-for": "1.1.1.1" }), "cf-connecting-ip"), "5.6.7.8"));
test("parseClientIp: el nombre de la cabecera no distingue mayúsculas", () =>
  eq(parseClientIp(headersOf({ "cf-connecting-ip": "5.6.7.8" }), "CF-Connecting-IP"), "5.6.7.8"));
test("parseClientIp: sin cabecera, el valor más a la derecha de X-Forwarded-For", () =>
  eq(parseClientIp(headersOf({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }), null), "2.2.2.2"));
test("parseClientIp: CLIENT_IP_HEADER=x-forwarded-for también toma el último", () =>
  eq(parseClientIp(headersOf({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }), "x-forwarded-for"), "2.2.2.2"));
test("parseClientIp: recorta espacios", () => eq(parseClientIp(headersOf({ "x-forwarded-for": " 9.9.9.9 " }), null), "9.9.9.9"));
test("parseClientIp: ignora valores vacíos al final", () => eq(parseClientIp(headersOf({ "x-forwarded-for": "3.3.3.3, " }), null), "3.3.3.3"));
test("parseClientIp: conserva IPv6", () => eq(parseClientIp(headersOf({ "x-forwarded-for": "2001:db8::1" }), null), "2001:db8::1"));
test("parseClientIp: sin cabeceras → unknown", () => eq(parseClientIp(headersOf({}), null), "unknown"));
test("parseClientIp: la cabecera configurada vacía → unknown (no cae a X-Forwarded-For)", () =>
  eq(parseClientIp(headersOf({ "x-forwarded-for": "1.1.1.1" }), "cf-connecting-ip"), "unknown"));
test("parseClientIp: recorta a 64 caracteres", () => eq(parseClientIp(headersOf({ "x-forwarded-for": "a".repeat(500) }), null).length, 64));

// ── Claves sin datos personales ──
test("keyHash: determinista y de 32 hex", () => {
  const a = keyHash("ana@example.com", "secreto-a");
  eq(a, keyHash("ana@example.com", "secreto-a"));
  ok(/^[0-9a-f]{32}$/.test(a), a);
});
test("keyHash: con otro APP_SECRET el resultado cambia", () => ok(keyHash("1.2.3.4", "secreto-a") !== keyHash("1.2.3.4", "secreto-b")));
test("rlKey: «ámbito:hmac» sin el email ni la IP en claro", () => {
  const k = rlKey("login-email", "ana@example.com");
  ok(/^login-email:[0-9a-f]{32}$/.test(k), k);
  ok(!k.includes("ana") && !k.includes("example"), k);
  const ip = hashIp("203.0.113.9");
  ok(/^[0-9a-f]{32}$/.test(ip) && !ip.includes("203"), ip);
});
test("rlKey no distingue mayúsculas", () => eq(rlKey("login-email", "Cirella@X.com"), rlKey("login-email", "ana@x.com")));
test("rlKey: ámbitos distintos, claves distintas", () => ok(rlKey("login-email", "a@x.com") !== rlKey("magic-email", "a@x.com")));

// ── Captcha ──
test("captchaRequired(1, true) → no", () => eq(captchaRequired(1, true), false));
test("captchaRequired(2, true) → sí", () => eq(captchaRequired(2, true), true));
test("captchaRequired(5, false) → no (sin claves de Turnstile)", () => eq(captchaRequired(5, false), false));

// ── Email de compra abandonada ──
const real: RecoveryFacts = { hasVisitor: true, startedCheckout: true, distinctEmailsFromVisitor: 1, distinctEmailsFromIp: 1 };
test("recoveryDecision: sin visitante → sin-visita", () => eq(recoveryDecision({ ...real, hasVisitor: false }), { send: false, reason: "sin-visita" }));
test("recoveryDecision: sin CHECKOUT_STARTED → sin-checkout", () => eq(recoveryDecision({ ...real, startedCheckout: false }), { send: false, reason: "sin-checkout" }));
test("recoveryDecision: 3 emails desde la misma visitante → muchos-emails", () =>
  eq(recoveryDecision({ ...real, distinctEmailsFromVisitor: 3 }), { send: false, reason: "muchos-emails" }));
test("recoveryDecision: 6 emails desde la misma IP → muchos-emails", () =>
  eq(recoveryDecision({ ...real, distinctEmailsFromIp: 6 }), { send: false, reason: "muchos-emails" }));
test("recoveryDecision: 2 y 5 → se envía", () => eq(recoveryDecision({ ...real, distinctEmailsFromVisitor: 2, distinctEmailsFromIp: 5 }), { send: true }));

// ── Turnstile ──
function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: { body: string }[] = [];
  const impl = (async (_url: unknown, init?: RequestInit) => {
    calls.push({ body: String(init?.body ?? "") });
    return respond();
  }) as typeof fetch;
  return { impl, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const quiet = async <T>(fn: () => Promise<T>) => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = warn;
  }
};

test("verifyTurnstile: success=true → ok (manda token e IP)", async () => {
  const f = fakeFetch(() => json({ success: true }));
  eq(await verifyTurnstile("tok", "1.2.3.4", f.impl), "ok");
  ok(f.calls[0].body.includes("response=tok") && f.calls[0].body.includes("remoteip=1.2.3.4"), f.calls[0].body);
});
test("verifyTurnstile: success=false → invalid", async () => eq(await verifyTurnstile("tok", "1.2.3.4", fakeFetch(() => json({ success: false })).impl), "invalid"));
test("verifyTurnstile: fetch lanza → unavailable", async () =>
  eq(await quiet(() => verifyTurnstile("tok", "1.2.3.4", fakeFetch(() => Promise.reject(new Error("caída"))).impl)), "unavailable"));
test("verifyTurnstile: HTTP 500 → unavailable", async () =>
  eq(await quiet(() => verifyTurnstile("tok", "1.2.3.4", fakeFetch(() => json({}, 500)).impl)), "unavailable"));
test("verifyTurnstile: token vacío → invalid sin llamar a Cloudflare", async () => {
  const f = fakeFetch(() => json({ success: true }));
  eq(await verifyTurnstile("", "1.2.3.4", f.impl), "invalid");
  eq(await verifyTurnstile(null, "1.2.3.4", f.impl), "invalid");
  eq(f.calls.length, 0);
});

// ── Configuración ──
const PROD: Record<string, string> = {
  APP_ENV: "production",
  APP_URL: "https://cirella.app",
  DATABASE_URL: "postgresql://u:p@db.example.com:5432/c",
  DIRECT_URL: "postgresql://u:p@db.example.com:5432/c",
  PAYMENT_PROVIDER: "stripe",
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_PUBLISHABLE_KEY: "pk_live_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_y",
  CRON_SECRET: "a".repeat(64),
  APP_SECRET: "b".repeat(64),
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_x",
  EMAIL_FROM: "Cirella <hola@cirella.app>",
  STORAGE_DRIVER: "s3",
  S3_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com",
  S3_BUCKET: "cirella",
  S3_ACCESS_KEY_ID: "id",
  S3_SECRET_ACCESS_KEY: "secret",
  CLIENT_IP_HEADER: "cf-connecting-ip",
};
const errorsOf = (raw: Record<string, string | undefined>) => {
  const r = validateEnv(raw);
  return r.ok ? [] : r.errors;
};
test("producción con CLIENT_IP_HEADER → válida", () => eq(errorsOf(PROD), []));
test("producción sin CLIENT_IP_HEADER → error", () => ok(errorsOf({ ...PROD, CLIENT_IP_HEADER: undefined }).some((e) => e.includes("Falta CLIENT_IP_HEADER"))));
test("CLIENT_IP_HEADER con un valor que no es una cabecera → error", () =>
  ok(errorsOf({ ...PROD, CLIENT_IP_HEADER: "x-real-ip, cf" }).some((e) => e.includes("CLIENT_IP_HEADER debe ser"))));
test("en desarrollo CLIENT_IP_HEADER es opcional", () =>
  eq(errorsOf({ APP_ENV: "development", DATABASE_URL: PROD.DATABASE_URL, DIRECT_URL: PROD.DIRECT_URL, PAYMENT_PROVIDER: "simulated" }), []));
