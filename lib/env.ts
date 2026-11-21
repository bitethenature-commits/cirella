/**
 * Única puerta de entrada a la configuración. Ningún módulo lee process.env directamente:
 * se usa env(), appUrl(), isDemoMode() o isProductionLike().
 *
 * Entornos (APP_ENV): development | test | staging | production. Sin APP_ENV, NODE_ENV=production
 * cuenta como production (lo más estricto) y cualquier otra cosa como development.
 * staging y production son «de producción»: se exigen https, Stripe, Resend, R2/S3 y secretos
 * largos, y el modo demo está prohibido.
 *
 * Modo del sitio (SITE_MODE, ver lib/site-mode.ts): platform (por defecto) o personal, la web de una
 * sola dueña (OWNER_USERNAME, obligatorio). Solo en modo personal se admite en producción
 * PAYMENT_PROVIDER=none (sin cobros en la web), y entonces no hacen falta las claves de Stripe.
 * También solo en modo personal: PayPal (PAYMENT_PROVIDER=paypal o stripe,paypal), con su propia
 * cuenta y sin Stripe Connect (lib/payments/paypal.ts).
 *
 *   validateEnv(raw)  → todas las reglas, con todos los errores a la vez (función pura).
 *   assertEnv()       → la llama instrumentation.ts al arrancar: si algo falla, Next no arranca.
 *   env()             → lectura tolerante (tipos y valores por defecto) para que `next build`
 *                       funcione sin los secretos de producción.
 *
 * Sin `server-only`: también lo importan los scripts de tsx (seed, bootstrap, check-env…).
 */
import { z } from "zod";
import { normalizeUsername, validateUsername } from "./slug";

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

/** Pasarelas que se pueden combinar en PAYMENT_PROVIDER (separadas por comas). */
export const CHARGE_PROVIDERS = ["simulated", "stripe", "paypal"] as const;
export type ChargeProviderKey = (typeof CHARGE_PROVIDERS)[number];

/**
 * PAYMENT_PROVIDER → lista de pasarelas: «none» (ninguna), una («stripe», «paypal», «simulated»)
 * o una de tarjeta más PayPal («stripe,paypal»). Pura: la usan la validación y lib/payments.
 */
export function parsePaymentProviders(value: string | undefined): { ok: true; keys: ChargeProviderKey[] } | { ok: false; error: string } {
  const parts = (value ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const valid = 'usa stripe, paypal, stripe,paypal o none («simulated» solo en local)';
  if (!parts.length) return { ok: false, error: "Falta PAYMENT_PROVIDER." };
  if (parts.includes("none")) return parts.length === 1 ? { ok: true, keys: [] } : { ok: false, error: "PAYMENT_PROVIDER=none no se combina con otras pasarelas." };
  const unknown = parts.find((p) => !(CHARGE_PROVIDERS as readonly string[]).includes(p));
  if (unknown) return { ok: false, error: `PAYMENT_PROVIDER solo admite pasarelas conocidas: «${unknown}» no existe (${valid}).` };
  const keys = [...new Set(parts)] as ChargeProviderKey[];
  if (keys.includes("stripe") && keys.includes("simulated")) return { ok: false, error: "PAYMENT_PROVIDER: elige stripe o simulated, no las dos." };
  // La tarjeta va primero: es la pasarela principal (cuentas de cobro, simulador…).
  return { ok: true, keys: keys.sort((a, b) => (a === "paypal" ? 1 : 0) - (b === "paypal" ? 1 : 0)) };
}

const paymentProviderField = z.preprocess(
  blankToUndefined,
  z
    .string()
    .optional()
    .superRefine((v, ctx) => {
      if (v === undefined) return;
      const r = parsePaymentProviders(v);
      if (!r.ok) ctx.addIssue({ code: "custom", message: r.error });
    })
    .transform((v) => {
      if (v === undefined) return undefined;
      const r = parsePaymentProviders(v);
      return r.ok ? (r.keys.length ? r.keys.join(",") : "none") : v;
    }),
);

const schema = z.object({
  APP_URL: text,
  DATABASE_URL: text,
  DIRECT_URL: text,
  DEMO_MODE: oneOf("DEMO_MODE", ["true", "false"]),
  APP_SECRET: text,
  CRON_SECRET: text,
  SITE_MODE: oneOf("SITE_MODE", ["platform", "personal"]),
  OWNER_USERNAME: text,
  // Opcionales (modo personal): con OWNER_EMAIL, `npm run deploy` crea la cuenta de la dueña si aún
  // no existe (prisma/bootstrap.ts), sin tener que ejecutar nada desde su ordenador.
  OWNER_EMAIL: text,
  OWNER_NAME: text,
  // Normalizado: «none», «stripe», «paypal», «stripe,paypal»… (ver parsePaymentProviders).
  PAYMENT_PROVIDER: paymentProviderField,
  STRIPE_SECRET_KEY: text,
  STRIPE_PUBLISHABLE_KEY: text,
  STRIPE_WEBHOOK_SECRET: text,
  STRIPE_CONNECT_WEBHOOK_SECRET: text,
  STRIPE_ON_BEHALF_OF: oneOf("STRIPE_ON_BEHALF_OF", ["true", "false"]),
  // PayPal (solo modo personal): app REST de su cuenta Business (developer.paypal.com).
  PAYPAL_CLIENT_ID: text,
  PAYPAL_CLIENT_SECRET: text,
  PAYPAL_WEBHOOK_ID: text,
  PAYPAL_ENV: oneOf("PAYPAL_ENV", ["sandbox", "live"]),
  // Solo pruebas: un PayPal falso en local (e2e). Prohibido en producción.
  PAYPAL_API_URL: text,
  EMAIL_PROVIDER: oneOf("EMAIL_PROVIDER", ["log", "resend"]),
  RESEND_API_KEY: text,
  EMAIL_FROM: text,
  // Opcionales: remitente de la newsletter (si no, EMAIL_FROM) y secreto del webhook de Resend
  // (rebotes y quejas: /api/webhooks/resend). docs/modo-personal.md › «Tu newsletter».
  NEWSLETTER_FROM: text,
  RESEND_WEBHOOK_SECRET: text,
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
  CLIENT_IP_HEADER: text,
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
/**
 * APP_URL vacía en Render: su dirección pública (RENDER_EXTERNAL_URL, https://…onrender.com, que
 * Render pone en el build y al arrancar). Con dominio propio, APP_URL manda.
 */
export function withHostingDefaults(raw: RawEnv): RawEnv {
  if (raw.APP_URL?.trim() || !raw.RENDER_EXTERNAL_URL?.trim()) return raw;
  return { ...raw, APP_URL: raw.RENDER_EXTERNAL_URL.trim() };
}

function parseFields(input: RawEnv) {
  const raw = withHostingDefaults(input);
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

  const personal = p.SITE_MODE === "personal";
  if (personal) {
    if (!p.OWNER_USERNAME)
      errors.push("Falta OWNER_USERNAME: el usuario de la dueña de la web (SITE_MODE=personal), el mismo de su página (p. ej. ana).");
    else {
      const problem = validateUsername(normalizeUsername(p.OWNER_USERNAME), { personal: true });
      if (problem) errors.push(`OWNER_USERNAME no es un usuario válido: ${problem.toLowerCase()}.`);
    }
    if (p.OWNER_EMAIL && !z.string().email().safeParse(p.OWNER_EMAIL.trim()).success)
      errors.push("OWNER_EMAIL no es un email válido: pon el email con el que entrarás en tu panel (p. ej. tu@email.com).");
    if (p.OWNER_NAME && p.OWNER_NAME.trim().length > 80) errors.push("OWNER_NAME es demasiado largo (máximo 80 caracteres).");
  }

  if (!p.PAYMENT_PROVIDER && !raw.PAYMENT_PROVIDER?.trim())
    errors.push(
      personal
        ? "Falta PAYMENT_PROVIDER: «stripe,paypal» para cobrar en la web con tarjeta y PayPal, o «none» si esta web no cobra."
        : "Falta PAYMENT_PROVIDER («simulated» en local, «stripe» en producción).",
    );
  const providers = providerList(p.PAYMENT_PROVIDER);
  if (providers.includes("stripe")) {
    if (!p.STRIPE_SECRET_KEY) errors.push("Falta STRIPE_SECRET_KEY.");
    else if (!/^(sk|rk)_(test|live)_/.test(p.STRIPE_SECRET_KEY)) errors.push("STRIPE_SECRET_KEY no parece una clave secreta de Stripe (sk_… o rk_…).");
    // Con Checkout alojado la clave publicable no se usa: en la web personal es opcional.
    if (!p.STRIPE_PUBLISHABLE_KEY) {
      if (!personal) errors.push("Falta STRIPE_PUBLISHABLE_KEY.");
    } else if (!/^pk_(test|live)_/.test(p.STRIPE_PUBLISHABLE_KEY)) errors.push("STRIPE_PUBLISHABLE_KEY no parece una clave publicable de Stripe (pk_…).");
    if (!p.STRIPE_WEBHOOK_SECRET) errors.push("Falta STRIPE_WEBHOOK_SECRET.");
    else if (!p.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) errors.push("STRIPE_WEBHOOK_SECRET no parece un secreto de webhook de Stripe (whsec_…).");
    // Segundo endpoint (eventos de las cuentas conectadas: account.updated). Obligatorio en producción
    // en la plataforma; la web personal cobra con su propia cuenta, sin cuentas conectadas.
    if (p.STRIPE_CONNECT_WEBHOOK_SECRET && !p.STRIPE_CONNECT_WEBHOOK_SECRET.startsWith("whsec_"))
      errors.push("STRIPE_CONNECT_WEBHOOK_SECRET no parece un secreto de webhook de Stripe (whsec_…).");
    else if (!p.STRIPE_CONNECT_WEBHOOK_SECRET && prod && !personal)
      errors.push("Falta STRIPE_CONNECT_WEBHOOK_SECRET: sin el webhook de cuentas conectadas no sabremos cuándo Stripe verifica a una creadora.");
  }
  if (providers.includes("paypal")) {
    // Con PayPal cobra la dueña con su propia cuenta: en la plataforma no hay forma de repartir.
    if (!personal) errors.push("PayPal solo se admite en modo personal (SITE_MODE=personal): en la plataforma se cobra con Stripe Connect.");
    if (!p.PAYPAL_CLIENT_ID) errors.push("Falta PAYPAL_CLIENT_ID: el «Client ID» de tu app de PayPal (developer.paypal.com → Apps & Credentials).");
    if (!p.PAYPAL_CLIENT_SECRET) errors.push("Falta PAYPAL_CLIENT_SECRET: el «Secret» de tu app de PayPal.");
    // Sin el id del webhook no se puede comprobar que los avisos vienen de PayPal.
    if (!p.PAYPAL_WEBHOOK_ID && prod) errors.push("Falta PAYPAL_WEBHOOK_ID: el «Webhook ID» que te da PayPal al crear el webhook (docs/modo-personal.md).");
  }
  if (p.PAYPAL_API_URL && (prod || !isLocalUrl(p.PAYPAL_API_URL)))
    errors.push("PAYPAL_API_URL solo sirve para pruebas en local (un PayPal falso): quítala.");

  if (p.EMAIL_PROVIDER === "resend") {
    if (!p.RESEND_API_KEY) errors.push("Falta RESEND_API_KEY (EMAIL_PROVIDER=resend).");
    if (!p.EMAIL_FROM) errors.push("Falta EMAIL_FROM, el remitente de los emails (p. ej. Cirella <hola@cirella.app>).");
  }
  if (p.NEWSLETTER_FROM && !/^(?:[^<>]*<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(p.NEWSLETTER_FROM.trim()))
    errors.push("NEWSLETTER_FROM debe ser un remitente como «Cirella <novedades@tudominio.com>».");
  if (p.RESEND_WEBHOOK_SECRET && !p.RESEND_WEBHOOK_SECRET.startsWith("whsec_"))
    errors.push("RESEND_WEBHOOK_SECRET empieza por whsec_ (Resend › Webhooks › tu webhook › Signing secret).");

  if (p.STORAGE_DRIVER === "s3") {
    if (!p.S3_ENDPOINT) errors.push("Falta S3_ENDPOINT (STORAGE_DRIVER=s3).");
    else if (!p.S3_ENDPOINT.startsWith("https://") && !(p.S3_ENDPOINT.startsWith("http://") && isLocalUrl(p.S3_ENDPOINT)))
      errors.push("S3_ENDPOINT debe empezar por https://.");
    for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const)
      if (!p[key]) errors.push(`Falta ${key} (STORAGE_DRIVER=s3).`);
  }

  if (!p.TURNSTILE_SITE_KEY !== !p.TURNSTILE_SECRET_KEY) errors.push("Configura las dos claves de Turnstile o ninguna.");
  if (p.CLIENT_IP_HEADER && !/^[a-z0-9-]+$/i.test(p.CLIENT_IP_HEADER))
    errors.push("CLIENT_IP_HEADER debe ser el nombre de una cabecera (p. ej. x-real-ip).");

  // Vercel fija VERCEL_ENV y no se puede declarar a mano: si dice producción, APP_ENV tiene que decir
  // lo mismo. Si no, un .env.example pegado tal cual (APP_ENV=development, DEMO_MODE=true, pagos
  // simulados) arrancaría la web real en modo demo.
  if (raw.VERCEL_ENV?.trim() === "production" && appEnv !== "production")
    errors.push(`Este despliegue es la producción de Vercel (VERCEL_ENV=production) pero APP_ENV=${appEnv}: pon APP_ENV=production.`);

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
    if (providers.includes("simulated"))
      errors.push("PAYMENT_PROVIDER=simulated está prohibido en producción: los pagos no se cobrarían y el contenido se entregaría gratis. Usa PAYMENT_PROVIDER=stripe.");
    // Sin pasarela solo en la web personal; en la plataforma las creadoras tienen que poder cobrar.
    if (p.PAYMENT_PROVIDER === "none" && !personal)
      errors.push("PAYMENT_PROVIDER=none (sin cobros) solo se admite en modo personal (SITE_MODE=personal). En la plataforma usa PAYMENT_PROVIDER=stripe.");
    if (appEnv === "production" && providers.includes("stripe")) {
      if (p.STRIPE_SECRET_KEY && !/^(sk|rk)_live_/.test(p.STRIPE_SECRET_KEY))
        errors.push("En producción STRIPE_SECRET_KEY debe ser una clave live (sk_live_… o rk_live_…).");
      if (p.STRIPE_PUBLISHABLE_KEY && !p.STRIPE_PUBLISHABLE_KEY.startsWith("pk_live_"))
        errors.push("En producción STRIPE_PUBLISHABLE_KEY debe ser una clave live (pk_live_…).");
    }
    if (appEnv === "production" && providers.includes("paypal") && p.PAYPAL_ENV !== "live")
      errors.push("En producción pon PAYPAL_ENV=live (y las claves de la pestaña «Live» de tu app de PayPal): con «sandbox» los pagos son de prueba.");
    for (const key of ["CRON_SECRET", "APP_SECRET"] as const) {
      const secret = p[key];
      if (!secret || secret.length < 32 || PLACEHOLDER_SECRET.test(secret))
        errors.push(`${key} debe tener al menos 32 caracteres aleatorios (genera uno con: openssl rand -hex 32).`);
    }
    // Los límites de intentos cuentan por conexión: con la cabecera equivocada todas las clientas
    // compartirían contador (o cualquiera podría inventarse la IP).
    if (!p.CLIENT_IP_HEADER)
      errors.push(
        "Falta CLIENT_IP_HEADER: la cabecera con la IP real de la clienta que tu plataforma sobrescribe siempre (x-real-ip en Vercel y en Railway; fly-client-ip en Fly…). cf-connecting-ip solo si a la web únicamente se llega a través de Cloudflare.",
      );
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
    if (p.PAYPAL_ENV === "live") errors.push("Fuera de producción usa PayPal en modo de pruebas (PAYPAL_ENV=sandbox).");
  }

  return errors.length ? { ok: false, appEnv, errors } : { ok: true, env: withDefaults(p, appEnv) };
}

/** Pasarelas de PAYMENT_PROVIDER ya validado (vacía con «none» o sin valor). */
function providerList(value: string | undefined): ChargeProviderKey[] {
  if (!value) return [];
  const r = parsePaymentProviders(value);
  return r.ok ? r.keys : [];
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
  // VERCEL_ENV lo fija la plataforma: en la producción de Vercel nunca hay demo, diga lo que diga APP_ENV.
  return env().DEMO_MODE === "true" && !isProductionLike() && process.env.VERCEL_ENV !== "production";
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
