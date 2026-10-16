import { isLocalDatabaseUrl, isLocalUrl, resolveAppEnv, validateEnv } from "../../lib/env";
import { selectPaymentProviderKey } from "../../lib/payments";
import { seedGuardErrors } from "../../prisma/seed-guard";
import { eq, ok, test, throws } from "./harness";

type Raw = Record<string, string | undefined>;

const SECRET = "a".repeat(64);
/** Una configuración de producción completa y válida; cada caso cambia un solo campo. */
const PROD_OK: Raw = {
  APP_ENV: "production",
  APP_URL: "https://cirella.app",
  DATABASE_URL: "postgresql://u:p@db.example.com:5432/c",
  DIRECT_URL: "postgresql://u:p@db.example.com:5432/c",
  PAYMENT_PROVIDER: "stripe",
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_PUBLISHABLE_KEY: "pk_live_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_y",
  CRON_SECRET: SECRET,
  APP_SECRET: SECRET,
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
/** Configuración local como la de .env.example. */
const DEV_OK: Raw = {
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://cirella:cirella@localhost:5432/cirella",
  DIRECT_URL: "postgresql://cirella:cirella@localhost:5432/cirella",
  DEMO_MODE: "true",
  PAYMENT_PROVIDER: "simulated",
};

function errorsOf(raw: Raw) {
  const r = validateEnv(raw);
  return r.ok ? [] : r.errors;
}
function hasError(raw: Raw, fragment: string) {
  const errors = errorsOf(raw);
  ok(errors.some((e) => e.includes(fragment)), `se esperaba un error con «${fragment}»; errores: ${JSON.stringify(errors)}`);
}
function isValid(raw: Raw) {
  eq(errorsOf(raw), []);
}

// ── Entorno ──
for (const [raw, want] of [
  [{}, "development"],
  [{ NODE_ENV: "production" }, "production"],
  [{ NODE_ENV: "production", APP_ENV: "test" }, "test"],
  [{ APP_ENV: "staging" }, "staging"],
  [{ NODE_ENV: "production", APP_ENV: "" }, "production"],
  [{ NODE_ENV: "production", APP_ENV: "prod" }, "production"],
] as const)
  test(`resolveAppEnv(${JSON.stringify(raw)}) → ${want}`, () => eq(resolveAppEnv(raw), want));

test("APP_ENV desconocido es un error", () => hasError({ ...PROD_OK, APP_ENV: "prod" }, "APP_ENV debe ser"));

// ── Producción completa ──
test("validateEnv acepta una producción completa", () => isValid(PROD_OK));
test("validateEnv normaliza APP_URL sin barra final", () => {
  const r = validateEnv({ ...PROD_OK, APP_URL: "https://cirella.app/" });
  ok(r.ok, JSON.stringify(r));
  eq(r.env.APP_URL, "https://cirella.app");
});
test("validateEnv aplica los valores por defecto", () => {
  const r = validateEnv(DEV_OK);
  ok(r.ok, JSON.stringify(r));
  eq([r.env.EMAIL_PROVIDER, r.env.STORAGE_DRIVER, r.env.STORAGE_DIR, r.env.S3_REGION], ["log", "local", "./storage", "auto"]);
  ok(r.env.APP_SECRET.length >= 32, "fuera de producción hay un APP_SECRET de desarrollo");
});
test("validateEnv sin nada en producción informa de todo a la vez", () => {
  const errors = errorsOf({ NODE_ENV: "production" });
  for (const v of ["APP_URL", "DATABASE_URL", "PAYMENT_PROVIDER", "CRON_SECRET", "APP_SECRET", "EMAIL_PROVIDER", "STORAGE_DRIVER"])
    ok(errors.some((e) => e.includes(v)), `falta un error sobre ${v}: ${JSON.stringify(errors)}`);
});

// ── Modo demo y pagos simulados ──
test("producción con DEMO_MODE=true → prohibido", () => hasError({ ...PROD_OK, DEMO_MODE: "true" }, "DEMO_MODE=true está prohibido"));
test("staging con DEMO_MODE=true → prohibido", () => hasError({ ...PROD_OK, APP_ENV: "staging", DEMO_MODE: "true" }, "DEMO_MODE=true está prohibido"));
test("producción con DEMO_MODE=false → válido", () => isValid({ ...PROD_OK, DEMO_MODE: "false" }));
test("producción con PAYMENT_PROVIDER=simulated → prohibido", () =>
  hasError({ ...PROD_OK, PAYMENT_PROVIDER: "simulated" }, "PAYMENT_PROVIDER=simulated está prohibido"));
test("sin PAYMENT_PROVIDER → error", () => hasError({ ...PROD_OK, PAYMENT_PROVIDER: undefined }, "Falta PAYMENT_PROVIDER"));
test("sin PAYMENT_PROVIDER también en local", () => hasError({ ...DEV_OK, PAYMENT_PROVIDER: "" }, "Falta PAYMENT_PROVIDER"));
test("PAYMENT_PROVIDER desconocido → error", () => hasError({ ...DEV_OK, PAYMENT_PROVIDER: "bizum" }, "PAYMENT_PROVIDER solo admite"));

// ── APP_URL en producción ──
for (const [url, fragment] of [
  ["http://cirella.app", "debe empezar por https://"],
  ["https://localhost:3000", "no puede apuntar a localhost"],
  ["https://192.168.1.5", "no puede apuntar a localhost"],
  ["https://cirella.app/app", "sin ruta"],
  ["https://cirella.app/?a=1", "sin ruta"],
] as const)
  test(`APP_URL=${url} en producción → error`, () => hasError({ ...PROD_OK, APP_URL: url }, fragment));
test("sin APP_URL en producción → error", () => hasError({ ...PROD_OK, APP_URL: undefined }, "Falta APP_URL"));

// ── Secretos ──
for (const key of ["CRON_SECRET", "APP_SECRET"] as const) {
  test(`${key}=cambia-esto en producción → error`, () => hasError({ ...PROD_OK, [key]: "cambia-esto" }, `${key} debe tener al menos 32`));
  test(`${key} de 31 caracteres en producción → error`, () => hasError({ ...PROD_OK, [key]: "b".repeat(31) }, `${key} debe tener al menos 32`));
  test(`${key} de ejemplo (.env.example) en producción → error`, () =>
    hasError({ ...PROD_OK, [key]: "local-cron-secret-no-usar-en-produccion-000" }, `${key} debe tener al menos 32`));
  test(`${key} de 64 caracteres hexadecimales → válido`, () => isValid({ ...PROD_OK, [key]: "0123456789abcdef".repeat(4) }));
}

// ── Stripe ──
test("producción con sk_test_ → error de clave live", () => hasError({ ...PROD_OK, STRIPE_SECRET_KEY: "sk_test_x" }, "clave live"));
test("producción con pk_test_ → error de clave live", () => hasError({ ...PROD_OK, STRIPE_PUBLISHABLE_KEY: "pk_test_x" }, "clave live"));
test("staging con claves de prueba → válido", () =>
  isValid({ ...PROD_OK, APP_ENV: "staging", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PUBLISHABLE_KEY: "pk_test_x" }));
test("desarrollo con sk_live_ → error", () => hasError({ ...DEV_OK, STRIPE_SECRET_KEY: "sk_live_x" }, "claves de prueba"));
test("desarrollo con Stripe sin STRIPE_WEBHOOK_SECRET → error", () =>
  hasError({ ...DEV_OK, PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PUBLISHABLE_KEY: "pk_test_x" }, "Falta STRIPE_WEBHOOK_SECRET"));
test("STRIPE_SECRET_KEY que no es de Stripe → error", () => hasError({ ...PROD_OK, STRIPE_SECRET_KEY: "abc" }, "no parece una clave secreta"));

// ── Fuera de producción, solo URLs locales ──
test("desarrollo con APP_URL pública → error", () =>
  hasError({ ...DEV_OK, APP_URL: "https://cirella.app" }, "solo puede usarse con una APP_URL local"));
test("desarrollo en la red local → válido", () => isValid({ ...DEV_OK, APP_URL: "http://192.168.1.20:3000" }));
test("test en localhost:3100 → válido", () => isValid({ ...DEV_OK, APP_ENV: "test", APP_URL: "http://localhost:3100" }));
test("desarrollo sin APP_URL → válido (localhost por defecto)", () => isValid({ ...DEV_OK, APP_URL: undefined }));

// ── Formatos y parejas ──
for (const demo of ["1", "TRUE", "yes"])
  test(`DEMO_MODE=${demo} → error`, () => hasError({ ...DEV_OK, DEMO_MODE: demo }, "DEMO_MODE solo admite"));
test("solo TURNSTILE_SITE_KEY → error", () => hasError({ ...DEV_OK, TURNSTILE_SITE_KEY: "x" }, "las dos claves de Turnstile"));
test("las dos claves de Turnstile → válido", () => isValid({ ...DEV_OK, TURNSTILE_SITE_KEY: "x", TURNSTILE_SECRET_KEY: "y" }));
test("Resend sin RESEND_API_KEY en desarrollo → error", () =>
  hasError({ ...DEV_OK, EMAIL_PROVIDER: "resend", EMAIL_FROM: "a@b.c" }, "Falta RESEND_API_KEY"));
test("DATABASE_URL de SQLite → error", () => hasError({ ...DEV_OK, DATABASE_URL: "file:./dev.db" }, "PostgreSQL"));
test("sin DIRECT_URL → error", () => hasError({ ...DEV_OK, DIRECT_URL: undefined }, "Falta DIRECT_URL"));
test("S3 sin https en producción → error", () => hasError({ ...PROD_OK, S3_ENDPOINT: "http://r2.example.com" }, "S3_ENDPOINT debe empezar por https://"));
test("S3 local por http en desarrollo → válido", () =>
  isValid({ ...DEV_OK, STORAGE_DRIVER: "s3", S3_ENDPOINT: "http://localhost:9000", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "i", S3_SECRET_ACCESS_KEY: "s" }));
test("S3 sin bucket → error", () => hasError({ ...PROD_OK, S3_BUCKET: undefined }, "Falta S3_BUCKET"));
test("SENTRY_DSN que no es una URL → error", () => hasError({ ...PROD_OK, SENTRY_DSN: "nada" }, "SENTRY_DSN"));
test("los valores en blanco cuentan como ausentes", () => hasError({ ...PROD_OK, CRON_SECRET: "   " }, "CRON_SECRET debe tener"));

// ── Direcciones locales ──
for (const [url, want] of [
  ["http://localhost:3000", true], ["http://app.localhost", true], ["http://127.0.0.1:3000", true], ["http://[::1]:3000", true],
  ["http://10.0.0.2", true], ["http://172.20.1.1", true], ["http://192.168.0.9", true],
  ["https://cirella.app", false], ["http://172.32.0.1", false], ["http://8.8.8.8", false], ["no es una url", false], ["https://localhost.cirella.app", false],
] as const)
  test(`isLocalUrl(${url}) → ${want}`, () => eq(isLocalUrl(url), want));

for (const [url, want] of [
  ["postgresql://cirella:cirella@localhost:5432/cirella", true],
  ["postgresql://cirella:cirella@127.0.0.1:5432/cirella", true],
  ["postgresql://cirella:cirella@db:5432/cirella", true],
  ["postgresql://u:p@[::1]:5432/c", true],
  ["postgresql://u:p@ep-xyz.eu-central-1.aws.neon.tech/c", false],
  ["basura", false],
] as const)
  test(`isLocalDatabaseUrl(${url}) → ${want}`, () => eq(isLocalDatabaseUrl(url), want));

// ── Protección del seed ──
const LOCAL_DB = "postgresql://cirella:cirella@localhost:5432/cirella";
test("seedGuardErrors: producción → 1 error", () =>
  eq(seedGuardErrors({ appEnv: "production", databaseUrl: LOCAL_DB, userCount: 0, hasMarker: false }).length, 1));
test("seedGuardErrors: staging → error", () =>
  ok(seedGuardErrors({ appEnv: "staging", databaseUrl: LOCAL_DB, userCount: 0, hasMarker: false })[0]?.includes("nunca en producción")));
test("seedGuardErrors: BD remota → error", () =>
  ok(seedGuardErrors({ appEnv: "development", databaseUrl: "postgresql://u:p@ep-xyz.neon.tech/c", userCount: 0, hasMarker: false })[0]?.includes("no es una base de datos local")));
test("seedGuardErrors: DIRECT_URL remota → error", () =>
  ok(seedGuardErrors({ appEnv: "development", databaseUrl: LOCAL_DB, directUrl: "postgresql://u:p@ep-xyz.neon.tech/c", userCount: 0, hasMarker: false })[0]?.includes("DIRECT_URL")));
test("seedGuardErrors: sin DATABASE_URL → error", () =>
  eq(seedGuardErrors({ appEnv: "development", databaseUrl: undefined, userCount: 0, hasMarker: false }), ["Falta DATABASE_URL."]));
test("seedGuardErrors: BD local con cuentas ajenas → error", () =>
  ok(seedGuardErrors({ appEnv: "development", databaseUrl: LOCAL_DB, userCount: 3, hasMarker: false })[0]?.includes("no la creó el script")));
test("seedGuardErrors: BD local con solo cuentas de ejemplo (seed antiguo) → sin errores", () =>
  eq(seedGuardErrors({ appEnv: "development", databaseUrl: LOCAL_DB, userCount: 7, hasMarker: false, onlyDemoAccounts: true }), []));
test("seedGuardErrors: BD remota aunque solo tenga cuentas de ejemplo → error", () =>
  eq(seedGuardErrors({ appEnv: "development", databaseUrl: "postgresql://u:p@db.example.com/c", userCount: 7, hasMarker: false, onlyDemoAccounts: true }).length, 1));
test("seedGuardErrors: BD local vacía → sin errores", () =>
  eq(seedGuardErrors({ appEnv: "development", databaseUrl: LOCAL_DB, userCount: 0, hasMarker: false }), []));
test("seedGuardErrors: BD local de la demo → sin errores", () =>
  eq(seedGuardErrors({ appEnv: "test", databaseUrl: LOCAL_DB, userCount: 10, hasMarker: true }), []));

// ── Pasarela de pago ──
test("selectPaymentProviderKey sin valor → lanza", () => throws(() => selectPaymentProviderKey(undefined, "development"), /Falta PAYMENT_PROVIDER/));
test("selectPaymentProviderKey desconocida → lanza", () => throws(() => selectPaymentProviderKey("bizum", "development"), /no existe/));
test("selectPaymentProviderKey simulated en producción → lanza", () => throws(() => selectPaymentProviderKey("simulated", "production"), /prohibido/));
test("selectPaymentProviderKey simulated en staging → lanza", () => throws(() => selectPaymentProviderKey("simulated", "staging"), /prohibido/));
test("selectPaymentProviderKey simulated en test", () => eq(selectPaymentProviderKey("simulated", "test"), "simulated"));
test("selectPaymentProviderKey stripe en producción", () => eq(selectPaymentProviderKey("stripe", "production"), "stripe"));
test("selectPaymentProviderKey none en desarrollo", () => eq(selectPaymentProviderKey("none", "development"), "none"));
test("selectPaymentProviderKey none en test (plataforma)", () => eq(selectPaymentProviderKey("none", "test", "platform"), "none"));
test("selectPaymentProviderKey none en producción (plataforma) → lanza", () => throws(() => selectPaymentProviderKey("none", "production"), /modo personal/));
test("selectPaymentProviderKey none en staging (plataforma) → lanza", () => throws(() => selectPaymentProviderKey("none", "staging", "platform"), /modo personal/));
test("selectPaymentProviderKey none en producción (personal)", () => eq(selectPaymentProviderKey("none", "production", "personal"), "none"));
test("selectPaymentProviderKey simulated en producción (personal) → lanza", () => throws(() => selectPaymentProviderKey("simulated", "production", "personal"), /prohibido/));

// ── Modo personal (SITE_MODE=personal) ──
/** Producción de la web personal: sin Stripe ni Turnstile, todo lo demás igual de estricto. */
const PERSONAL_OK: Raw = {
  ...Object.fromEntries(Object.entries(PROD_OK).filter(([k]) => !k.startsWith("STRIPE_"))),
  SITE_MODE: "personal",
  OWNER_USERNAME: "ana",
  PAYMENT_PROVIDER: "none",
};
test("modo personal en producción sin Stripe ni Turnstile → válido", () => isValid(PERSONAL_OK));
test("modo personal en staging → válido", () => isValid({ ...PERSONAL_OK, APP_ENV: "staging" }));
test("modo personal con Stripe completo → válido", () => isValid({ ...PROD_OK, SITE_MODE: "personal", OWNER_USERNAME: "ana" }));
test("modo personal en local con none → válido", () => isValid({ ...DEV_OK, SITE_MODE: "personal", OWNER_USERNAME: "ana", PAYMENT_PROVIDER: "none" }));
test("modo personal en local con pagos simulados → válido", () => isValid({ ...DEV_OK, SITE_MODE: "personal", OWNER_USERNAME: "ana" }));
test("OWNER_USERNAME con @ y mayúsculas se normaliza → válido", () => isValid({ ...PERSONAL_OK, OWNER_USERNAME: "@Ana" }));
test("modo personal sin OWNER_USERNAME → error", () => hasError({ ...PERSONAL_OK, OWNER_USERNAME: undefined }, "Falta OWNER_USERNAME"));
test("modo personal con OWNER_USERNAME en blanco → error", () => hasError({ ...PERSONAL_OK, OWNER_USERNAME: "  " }, "Falta OWNER_USERNAME"));
test("modo personal en local sin OWNER_USERNAME → error", () =>
  hasError({ ...DEV_OK, SITE_MODE: "personal", PAYMENT_PROVIDER: "none" }, "Falta OWNER_USERNAME"));
for (const [user, fragment] of [["ab", "mínimo 3"], ["ana luna!", "solo letras"], ["admin", "reservado"]] as const)
  test(`OWNER_USERNAME=${user} → error`, () => hasError({ ...PERSONAL_OK, OWNER_USERNAME: user }, fragment));
test("modo personal sin PAYMENT_PROVIDER → error que sugiere none", () =>
  hasError({ ...PERSONAL_OK, PAYMENT_PROVIDER: undefined }, "«none» si esta web no cobra"));
test("modo personal en producción con pagos simulados → prohibido", () =>
  hasError({ ...PERSONAL_OK, PAYMENT_PROVIDER: "simulated" }, "PAYMENT_PROVIDER=simulated está prohibido"));
test("modo personal en producción con DEMO_MODE=true → prohibido", () => hasError({ ...PERSONAL_OK, DEMO_MODE: "true" }, "DEMO_MODE=true está prohibido"));
test("modo personal en producción con email de log → error", () => hasError({ ...PERSONAL_OK, EMAIL_PROVIDER: "log" }, "EMAIL_PROVIDER=resend"));
test("modo personal en producción sin S3 → error", () => hasError({ ...PERSONAL_OK, STORAGE_DRIVER: undefined }, "STORAGE_DRIVER=s3"));
test("modo personal en producción sin CLIENT_IP_HEADER → error", () => hasError({ ...PERSONAL_OK, CLIENT_IP_HEADER: undefined }, "Falta CLIENT_IP_HEADER"));
test("modo personal en producción con secretos cortos → error", () => hasError({ ...PERSONAL_OK, APP_SECRET: "corto" }, "APP_SECRET debe tener"));
test("modo personal en producción con APP_URL http → error", () => hasError({ ...PERSONAL_OK, APP_URL: "http://analuna.es" }, "https://"));
test("modo personal: solo una clave de Turnstile → error", () => hasError({ ...PERSONAL_OK, TURNSTILE_SITE_KEY: "x" }, "las dos claves de Turnstile"));
test("modo personal con Stripe a medias → error", () =>
  hasError({ ...PERSONAL_OK, PAYMENT_PROVIDER: "stripe" }, "Falta STRIPE_SECRET_KEY"));

// ── Plataforma con PAYMENT_PROVIDER=none ──
test("plataforma en producción con none → error", () =>
  hasError({ ...PROD_OK, PAYMENT_PROVIDER: "none" }, "PAYMENT_PROVIDER=none (sin cobros) solo se admite en modo personal"));
test("plataforma explícita en producción con none → error", () =>
  hasError({ ...PROD_OK, SITE_MODE: "platform", PAYMENT_PROVIDER: "none" }, "solo se admite en modo personal"));
test("plataforma en staging con none → error", () => hasError({ ...PROD_OK, APP_ENV: "staging", PAYMENT_PROVIDER: "none" }, "solo se admite en modo personal"));
test("plataforma en local con none → válido", () => isValid({ ...DEV_OK, PAYMENT_PROVIDER: "none" }));
test("plataforma no exige OWNER_USERNAME", () => isValid({ ...PROD_OK, SITE_MODE: "platform" }));
// OWNER_EMAIL / OWNER_NAME (opcionales): con ellos, `npm run deploy` crea la cuenta de la dueña.
test("modo personal con OWNER_EMAIL y OWNER_NAME → válido", () => isValid({ ...PERSONAL_OK, OWNER_EMAIL: "ana@example.com", OWNER_NAME: "Ana Luna" }));
test("modo personal con OWNER_EMAIL mal escrito → error", () => hasError({ ...PERSONAL_OK, OWNER_EMAIL: "ana@" }, "OWNER_EMAIL no es un email válido"));
test("modo personal con OWNER_NAME de más de 80 caracteres → error", () => hasError({ ...PERSONAL_OK, OWNER_NAME: "a".repeat(81) }, "OWNER_NAME es demasiado largo"));
test("SITE_MODE desconocido → error", () => hasError({ ...DEV_OK, SITE_MODE: "solo" }, "SITE_MODE solo admite"));
test("validateEnv guarda SITE_MODE y OWNER_USERNAME", () => {
  const r = validateEnv(PERSONAL_OK);
  ok(r.ok, JSON.stringify(r));
  eq([r.env.SITE_MODE, r.env.OWNER_USERNAME, r.env.PAYMENT_PROVIDER], ["personal", "ana", "none"]);
});
