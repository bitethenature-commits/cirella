/**
 * Única puerta de entrada a la configuración. Ningún módulo lee process.env directamente:
 * se usa env(), appUrl(), isDemoMode() o isProductionLike().
 *
 * Entornos (APP_ENV): development | test | staging | production. Sin APP_ENV, NODE_ENV=production
 * cuenta como production (lo más estricto) y cualquier otra cosa como development.
 * staging y production son «de producción»: se exigen https, Stripe, Resend, R2/S3 y secretos
 * largos, y el modo demo está prohibido.
 *
 *   validateEnv(raw)  → todas las reglas, con todos los errores a la vez (función pura).
 *   assertEnv()       → la llama instrumentation.ts al arrancar: si algo falla, Next no arranca.
 *   env()             → lectura tolerante (tipos y valores por defecto) para que `next build`
 *                       funcione sin los secretos de producción.
 *
 * Sin `server-only`: también lo importan los scripts de tsx (seed, bootstrap, check-env…).
 */
import { z } from "zod";

const APP_ENVS = ["development", "test", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

type RawEnv = Record<string, string | undefined>;

/** Secreto fijo para desarrollo y pruebas. Nunca vale fuera de ahí (ver PLACEHOLDER_SECRET). */
const DEV_APP_SECRET = "dev-only-insecure-secret-change-me-0000000000";
/** Valores de ejemplo (.env.example, documentación) que no pueden usarse como secreto real. */
const PLACEHOLDER_SECRET = /cambia-esto|change-?me|no-usar-en-produccion|dev-only/i;

const blankToUndefined = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : v);
const text = z.preprocess(blankToUndefined, z.string().optional());
const oneOf = <const T extends readonly [string, ...string[]]>(name: string, values: T) =>
  z.preprocess(
    blankToUndefined,
    z.enum(values, { errorMap: () => ({ message: `${name} solo admite ${values.map((v) => `"${v}"`).join(" o ")}.` }) }).optional(),
  );

const schema = z.object({
  APP_URL: text,
  DATABASE_URL: text,
  DIRECT_URL: text,
  DEMO_MODE: oneOf("DEMO_MODE", ["true", "false"]),
  APP_SECRET: text,
  CRON_SECRET: text,
  PAYMENT_PROVIDER: oneOf("PAYMENT_PROVIDER", ["simulated", "stripe"]),
  STRIPE_SECRET_KEY: text,
  STRIPE_PUBLISHABLE_KEY: text,
  STRIPE_WEBHOOK_SECRET: text,
  STRIPE_CONNECT_WEBHOOK_SECRET: text,
  STRIPE_ON_BEHALF_OF: oneOf("STRIPE_ON_BEHALF_OF", ["true", "false"]),
  EMAIL_PROVIDER: oneOf("EMAIL_PROVIDER", ["log", "resend"]),
  RESEND_API_KEY: text,
  EMAIL_FROM: text,
  STORAGE_DRIVER: oneOf("STORAGE_DRIVER", ["local", "s3"]),
  STORAGE_DIR: text,
  S3_ENDPOINT: text,
  S3_REGION: text,
  S3_BUCKET: text,
  S3_ACCESS_KEY_ID: text,
  S3_SECRET_ACCESS_KEY: text,
  S3_PUBLIC_URL: text,
  SENTRY_DSN: z.preprocess(blankToUndefined, z.string().url({ message: "SENTRY_DSN debe ser una URL." }).optional()),
  TURNSTILE_SITE_KEY: text,
  TURNSTILE_SECRET_KEY: text,
});
type Parsed = z.output<typeof schema>;

export type Env = Omit<Parsed, "EMAIL_PROVIDER" | "STORAGE_DRIVER" | "STORAGE_DIR" | "S3_REGION" | "APP_SECRET"> & {
  APP_ENV: AppEnv;
  APP_SECRET: string;
  EMAIL_PROVIDER: "log" | "resend";
  STORAGE_DRIVER: "local" | "s3";
  STORAGE_DIR: string;
  S3_REGION: string;
};

export type EnvValidation = { ok: true; env: Env } | { ok: false; appEnv: AppEnv; errors: string[] };

/** APP_ENV si es válido; si no, production con NODE_ENV=production y development en cualquier otro caso. */
export function resolveAppEnv(raw: RawEnv): AppEnv {
  const value = raw.APP_ENV?.trim();
  if (value && (APP_ENVS as readonly string[]).includes(value)) return value as AppEnv;
  return raw.NODE_ENV === "production" ? "production" : "development";
}

const productionLike = (e: AppEnv) => e === "staging" || e === "production";

/** Lee cada variable por separado para poder informar de todos los errores de una vez. */
function parseFields(raw: RawEnv) {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const [key, field] of Object.entries(schema.shape)) {
    const r = field.safeParse(raw[key]);
    if (r.success) data[key] = r.data;
    else errors.push(r.error.issues[0].message);
  }
  return { parsed: data as Parsed, errors };
}

function withDefaults(p: Parsed, appEnv: AppEnv): Env {
  return {
    ...p,
    APP_ENV: appEnv,
    APP_URL: p.APP_URL?.replace(/\/+$/, ""),
    // En producción assertEnv garantiza el secreto al arrancar; durante `next build` puede faltar (ver appSecret()).
    APP_SECRET: p.APP_SECRET ?? (productionLike(appEnv) ? "" : DEV_APP_SECRET),
    EMAIL_PROVIDER: p.EMAIL_PROVIDER ?? "log",
    STORAGE_DRIVER: p.STORAGE_DRIVER ?? "local",
    STORAGE_DIR: p.STORAGE_DIR ?? "./storage",
    S3_REGION: p.S3_REGION ?? "auto",
  };
}

/** Todas las reglas de configuración. Pura: recibe las variables y devuelve todos los errores, en español. */
export function validateEnv(raw: RawEnv): EnvValidation {
  const appEnv = resolveAppEnv(raw);
  const prod = productionLike(appEnv);
  const { parsed: p, errors } = parseFields(raw);

  if (raw.APP_ENV?.trim() && !(APP_ENVS as readonly string[]).includes(raw.APP_ENV.trim()))
    errors.unshift("APP_ENV debe ser development, test, staging o production.");

  // ── En todos los entornos ──
  if (!p.DATABASE_URL) errors.push("Falta DATABASE_URL (postgresql://…).");
  else if (!isPostgresUrl(p.DATABASE_URL)) errors.push("DATABASE_URL debe ser una conexión de PostgreSQL (postgresql://…).");
  if (!p.DIRECT_URL) errors.push("Falta DIRECT_URL: la conexión directa que usan las migraciones (en local, la misma que DATABASE_URL).");
  else if (!isPostgresUrl(p.DIRECT_URL)) errors.push("DIRECT_URL debe ser una conexión de PostgreSQL (postgresql://…).");

  if (!p.PAYMENT_PROVIDER && !raw.PAYMENT_PROVIDER?.trim())
    errors.push("Falta PAYMENT_PROVIDER («simulated» en local, «stripe» en producción).");
  if (p.PAYMENT_PROVIDER === "stripe") {
    if (!p.STRIPE_SECRET_KEY) errors.push("Falta STRIPE_SECRET_KEY.");
    else if (!/^(sk|rk)_(test|live)_/.test(p.STRIPE_SECRET_KEY)) errors.push("STRIPE_SECRET_KEY no parece una clave secreta de Stripe (sk_… o rk_…).");
    if (!p.STRIPE_PUBLISHABLE_KEY) errors.push("Falta STRIPE_PUBLISHABLE_KEY.");
    else if (!/^pk_(test|live)_/.test(p.STRIPE_PUBLISHABLE_KEY)) errors.push("STRIPE_PUBLISHABLE_KEY no parece una clave publicable de Stripe (pk_…).");
    if (!p.STRIPE_WEBHOOK_SECRET) errors.push("Falta STRIPE_WEBHOOK_SECRET.");
    else if (!p.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) errors.push("STRIPE_WEBHOOK_SECRET no parece un secreto de webhook de Stripe (whsec_…).");
    // Segundo endpoint (eventos de las cuentas conectadas: account.updated). Obligatorio en producción.
    if (p.STRIPE_CONNECT_WEBHOOK_SECRET && !p.STRIPE_CONNECT_WEBHOOK_SECRET.startsWith("whsec_"))
      errors.push("STRIPE_CONNECT_WEBHOOK_SECRET no parece un secreto de webhook de Stripe (whsec_…).");
    else if (!p.STRIPE_CONNECT_WEBHOOK_SECRET && prod)
      errors.push("Falta STRIPE_CONNECT_WEBHOOK_SECRET: sin el webhook de cuentas conectadas no sabremos cuándo Stripe verifica a una creadora.");
  }

  if (p.EMAIL_PROVIDER === "resend") {
    if (!p.RESEND_API_KEY) errors.push("Falta RESEND_API_KEY (EMAIL_PROVIDER=resend).");
    if (!p.EMAIL_FROM) errors.push("Falta EMAIL_FROM, el remitente de los emails (p. ej. Cirella <hola@cirella.app>).");
  }

  if (p.STORAGE_DRIVER === "s3") {
    if (!p.S3_ENDPOINT) errors.push("Falta S3_ENDPOINT (STORAGE_DRIVER=s3).");
    else if (!p.S3_ENDPOINT.startsWith("https://") && !(p.S3_ENDPOINT.startsWith("http://") && isLocalUrl(p.S3_ENDPOINT)))
      errors.push("S3_ENDPOINT debe empezar por https://.");
    for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const)
      if (!p[key]) errors.push(`Falta ${key} (STORAGE_DRIVER=s3).`);
  }

  if (!p.TURNSTILE_SITE_KEY !== !p.TURNSTILE_SECRET_KEY) errors.push("Configura las dos claves de Turnstile o ninguna.");

  if (prod) {
    // ── staging y production ──
    if (!p.APP_URL) {
      errors.push("Falta APP_URL: la dirección pública de la web (p. ej. https://cirella.app). Sin ella los emails llevarían enlaces a localhost.");
    } else {
      const url = parseUrl(p.APP_URL);
      if (!url) errors.push("APP_URL no es una dirección válida (p. ej. https://cirella.app).");
      else {
        if (url.protocol !== "https:") errors.push("APP_URL debe empezar por https://.");
        if (isLocalUrl(p.APP_URL)) errors.push("APP_URL no puede apuntar a localhost ni a una IP privada.");
        if (url.pathname !== "/" || url.search || url.hash) errors.push("APP_URL debe ser solo el dominio, sin ruta (p. ej. https://cirella.app).");
      }
    }
    if (p.DEMO_MODE === "true")
      errors.push(
        "DEMO_MODE=true está prohibido en producción: abriría el buzón /dev/correo con los enlaces de acceso de todo el mundo y los botones para entrar como administradora. Quita la variable.",
      );
    if (p.PAYMENT_PROVIDER === "simulated")
      errors.push("PAYMENT_PROVIDER=simulated está prohibido en producción: los pagos no se cobrarían y el contenido se entregaría gratis. Usa PAYMENT_PROVIDER=stripe.");
    if (appEnv === "production" && p.PAYMENT_PROVIDER === "stripe") {
      if (p.STRIPE_SECRET_KEY && !/^(sk|rk)_live_/.test(p.STRIPE_SECRET_KEY))
        errors.push("En producción STRIPE_SECRET_KEY debe ser una clave live (sk_live_… o rk_live_…).");
      if (p.STRIPE_PUBLISHABLE_KEY && !p.STRIPE_PUBLISHABLE_KEY.startsWith("pk_live_"))
        errors.push("En producción STRIPE_PUBLISHABLE_KEY debe ser una clave live (pk_live_…).");
    }
    for (const key of ["CRON_SECRET", "APP_SECRET"] as const) {
      const secret = p[key];
      if (!secret || secret.length < 32 || PLACEHOLDER_SECRET.test(secret))
        errors.push(`${key} debe tener al menos 32 caracteres aleatorios (genera uno con: openssl rand -hex 32).`);
    }
    if (p.EMAIL_PROVIDER !== "resend")
      errors.push("En producción los emails deben enviarse de verdad: pon EMAIL_PROVIDER=resend con RESEND_API_KEY y EMAIL_FROM.");
    if (p.STORAGE_DRIVER !== "s3")
      errors.push("En producción los archivos deben guardarse en R2/S3: pon STORAGE_DRIVER=s3 y las variables S3_*.");
  } else {
    // ── development y test ──
    if (p.APP_URL && !isLocalUrl(p.APP_URL))
      errors.push(
        `APP_ENV=${appEnv} solo puede usarse con una APP_URL local (localhost o red privada). Si esta es la web publicada, pon APP_ENV=production.`,
      );
    if ((p.STRIPE_SECRET_KEY && /^(sk|rk)_live_/.test(p.STRIPE_SECRET_KEY)) || p.STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_"))
      errors.push("Fuera de producción usa las claves de prueba de Stripe (sk_test_…, pk_test_…).");
  }

  return errors.length ? { ok: false, appEnv, errors } : { ok: true, env: withDefaults(p, appEnv) };
}

let cached: Env | undefined;

/**
 * Configuración actual, tolerante: solo tipos, valores permitidos y valores por defecto. No exige
 * las variables de producción (eso lo hace assertEnv al arrancar), así que `next build` funciona sin secretos.
 */
export function env(): Env {
  if (cached) return cached;
  const { parsed, errors } = parseFields(process.env);
  if (errors.length) throw new Error(`Configuración no válida:\n${errors.map((e) => `  · ${e}`).join("\n")}`);
  cached = withDefaults(parsed, resolveAppEnv(process.env));
  return cached;
}

/** Valida toda la configuración y lanza un error con la lista completa si algo falla. */
export function assertEnv(): Env {
  const r = validateEnv(process.env);
  if (!r.ok)
    throw new Error(
      `Cirella no puede arrancar: la configuración no es válida para APP_ENV=${r.appEnv}.\n${r.errors.map((e) => `  · ${e}`).join("\n")}\nRevisa las variables de entorno (ver .env.example y README «Configuración»).`,
    );
  return r.env;
}

export function appEnv(): AppEnv {
  return env().APP_ENV;
}

/** staging y production: reglas de producción y nada de demo ni pagos simulados. */
export function isProductionLike() {
  return productionLike(appEnv());
}

/** Modo demo (accesos rápidos, buzón /dev/correo): solo si se activa explícitamente y nunca en producción. */
export function isDemoMode() {
  return env().DEMO_MODE === "true" && !isProductionLike();
}

/** Dirección pública sin barra final. En producción no hay valor por defecto: sin APP_URL, error. */
export function appUrl() {
  const url = env().APP_URL;
  if (!url) {
    if (isProductionLike()) throw new Error("Falta APP_URL: la dirección pública de la web.");
    return "http://localhost:3000";
  }
  return url;
}

/** Clave HMAC general (URLs firmadas, enlaces firmados). Fuera de producción hay una fija de desarrollo. */
export function appSecret() {
  const secret = env().APP_SECRET;
  if (!secret) throw new Error("Falta APP_SECRET.");
  return secret;
}

export function appHost() {
  return appUrl().replace(/^https?:\/\//, "");
}

export function storageDir() {
  return env().STORAGE_DIR;
}

/** localhost, *.localhost, loopback (127.0.0.0/8, ::1) o red privada (10/8, 172.16/12, 192.168/16). */
export function isLocalUrl(url: string) {
  const host = parseUrl(url)?.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || host === "::1") return true;
  const ip = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** Base de datos en esta máquina o en el contenedor `db` de docker-compose. */
export function isLocalDatabaseUrl(url: string) {
  const host = parseUrl(url)?.hostname.toLowerCase();
  return !!host && ["localhost", "127.0.0.1", "::1", "[::1]", "db"].includes(host);
}

function isPostgresUrl(url: string) {
  return /^postgres(ql)?:\/\//.test(url);
}

function parseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
