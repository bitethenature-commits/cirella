import { buildCsp, securityHeaderOptionsFromEnv, securityHeaders } from "../../lib/security-headers";
import { eq, ok, test } from "./harness";

const header = (list: { key: string; value: string }[], key: string) => list.find((h) => h.key === key)?.value;

test("CSP en producción con todas las integraciones", () => {
  const o = securityHeaderOptionsFromEnv({
    NODE_ENV: "production",
    APP_URL: "https://cirella.app",
    PAYMENT_PROVIDER: "stripe",
    TURNSTILE_SITE_KEY: "0x4AAA",
    SENTRY_DSN: "https://abc@o123.ingest.de.sentry.io/456",
    STORAGE_DRIVER: "s3",
    S3_ENDPOINT: "https://acc.eu.r2.cloudflarestorage.com",
  } as NodeJS.ProcessEnv);
  const list = securityHeaders(o);
  const csp = header(list, "Content-Security-Policy")!;
  ok(csp.includes("frame-ancestors 'self'"));
  ok(csp.includes("object-src 'none'"));
  ok(/connect-src [^;]*https:\/\/acc\.eu\.r2\.cloudflarestorage\.com/.test(csp), "falta R2 en connect-src");
  ok(/connect-src [^;]*https:\/\/o123\.ingest\.de\.sentry\.io/.test(csp), "falta Sentry en connect-src");
  ok(!csp.includes("abc@"), "la clave del DSN no debe aparecer");
  ok(/script-src [^;]*https:\/\/js\.stripe\.com/.test(csp));
  ok(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/.test(csp));
  ok(/form-action [^;]*https:\/\/checkout\.stripe\.com/.test(csp));
  ok(csp.includes("upgrade-insecure-requests"));
  ok(!csp.includes("'unsafe-eval'"));
  eq(header(list, "Strict-Transport-Security"), "max-age=63072000; includeSubDomains");
  eq(header(list, "Permissions-Policy"), "camera=(), microphone=(), geolocation=(), browsing-topics=()");
  eq(header(list, "X-Content-Type-Options"), "nosniff");
});

test("CSP en local sin integraciones: sin HSTS ni orígenes externos", () => {
  const list = securityHeaders({ appUrl: "http://localhost:3100", isDev: false });
  const csp = header(list, "Content-Security-Policy")!;
  eq(header(list, "Strict-Transport-Security"), undefined);
  ok(!csp.includes("upgrade-insecure-requests"));
  ok(!csp.includes("stripe") && !csp.includes("cloudflare"));
  ok(!csp.includes("'unsafe-eval'") && !csp.includes("ws:"));
});

test("CSP en desarrollo permite eval y websockets (recarga en caliente)", () => {
  const csp = buildCsp({ appUrl: "http://localhost:3000", isDev: true });
  ok(/script-src [^;]*'unsafe-eval'/.test(csp));
  ok(/connect-src [^;]*ws:/.test(csp));
});

test("securityHeaderOptionsFromEnv: el disco local no añade orígenes de almacenamiento", () => {
  const o = securityHeaderOptionsFromEnv({ NODE_ENV: "production", STORAGE_DRIVER: "local", S3_ENDPOINT: "https://x.r2.cloudflarestorage.com" } as NodeJS.ProcessEnv);
  eq(o.storageOrigin, null);
  eq(o.stripe, false);
  eq(o.turnstile, false);
  eq(o.sentryOrigin, null);
  eq(o.appUrl, "http://localhost:3000");
});
