/**
 * Cabeceras de seguridad del navegador para todas las respuestas (next.config.ts).
 * Puro y sin alias de rutas: next.config.ts lo importa con una ruta relativa y
 * scripts/unit/headers.test.ts lo prueba.
 *
 * Los orígenes externos de la CSP se añaden solos según la configuración (Stripe, Turnstile,
 * Sentry, R2): quien integre algo nuevo debe usar estas mismas variables de entorno.
 * Los valores se fijan al hacer `next build`: cambiar estas variables exige volver a desplegar.
 */
export type SecurityHeaderOptions = {
  appUrl: string;
  isDev: boolean;
  /** Origen del almacenamiento (R2) al que el navegador sube y del que descarga con URLs firmadas. */
  storageOrigin?: string | null;
  stripe?: boolean;
  turnstile?: boolean;
  sentryOrigin?: string | null;
};

const STRIPE_JS = "https://js.stripe.com";
const TURNSTILE = "https://challenges.cloudflare.com";

/**
 * Content-Security-Policy.
 *
 * 'unsafe-inline' en script-src es deliberado: Next inserta scripts en línea y la alternativa
 * (un nonce por petición) obligaría a renderizar cada página en el servidor en cada visita y
 * rompería la caché de las páginas públicas. Lo que sí se bloquea: scripts de otros dominios,
 * <object>/<embed>, cambiar la <base>, enviar formularios fuera y que otra web nos incruste.
 */
export function buildCsp(o: SecurityHeaderOptions): string {
  const join = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
  const directives = [
    "default-src 'self'",
    join("script-src 'self' 'unsafe-inline'", o.isDev && "'unsafe-eval'", o.stripe && STRIPE_JS, o.turnstile && TURNSTILE),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // https: para los enlaces temporales del almacenamiento (vídeo y audio de los cursos).
    "media-src 'self' blob: https:",
    join("connect-src 'self'", o.storageOrigin, o.stripe && "https://api.stripe.com", o.turnstile && TURNSTILE, o.sentryOrigin, o.isDev && "ws:"),
    join(
      "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
      o.stripe && `${STRIPE_JS} https://hooks.stripe.com https://checkout.stripe.com`,
      o.turnstile && TURNSTILE,
    ),
    "frame-ancestors 'self'",
    join("form-action 'self'", o.stripe && "https://checkout.stripe.com"),
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
  ];
  if (o.appUrl.startsWith("https://")) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function securityHeaders(o: SecurityHeaderOptions): { key: string; value: string }[] {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Content-Security-Policy", value: buildCsp(o) },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  ];
  // HSTS solo con https (sin preload: entrar en la lista de precarga es difícil de deshacer).
  if (o.appUrl.startsWith("https://")) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  return headers;
}

function originOf(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function securityHeaderOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): SecurityHeaderOptions {
  return {
    appUrl: env.APP_URL || "http://localhost:3000",
    isDev: env.NODE_ENV !== "production",
    storageOrigin: env.STORAGE_DRIVER === "s3" ? originOf(env.S3_ENDPOINT) : null,
    stripe: env.PAYMENT_PROVIDER === "stripe" || !!env.STRIPE_SECRET_KEY,
    turnstile: !!(env.TURNSTILE_SITE_KEY || env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    sentryOrigin: originOf(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN),
  };
}

/**
 * Lo que `next build` deja fijado con las variables de ese momento: las cabeceras de seguridad
 * (dirección de la web, almacenamiento, Stripe, Turnstile, Sentry) y el modo del sitio de la página
 * de error. Se guarda al compilar (next.config.ts → CIRELLA_BUILD_ENV) y se compara al arrancar.
 */
export function buildEnvSnapshot(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const o = securityHeaderOptionsFromEnv(env);
  return {
    APP_URL: o.appUrl,
    "STORAGE_DRIVER/S3_ENDPOINT": o.storageOrigin ?? "",
    "PAYMENT_PROVIDER/STRIPE_SECRET_KEY": String(o.stripe),
    TURNSTILE_SITE_KEY: String(o.turnstile),
    SENTRY_DSN: o.sentryOrigin ?? "",
    SITE_MODE: env.SITE_MODE?.trim() || "platform",
  };
}

/**
 * Variables que han cambiado desde que se compiló la web (vacío si ninguna o si no se sabe). Si
 * cambian sin volver a compilar, la CSP bloquea, por ejemplo, las subidas al nuevo almacenamiento:
 * hay que volver a desplegar (con build) para que cuenten.
 */
export function buildEnvDrift(built: string | undefined, env: NodeJS.ProcessEnv = process.env): string[] {
  if (!built) return [];
  let then: Record<string, string>;
  try {
    then = JSON.parse(built);
  } catch {
    return [];
  }
  const now = buildEnvSnapshot(env);
  return Object.keys(now).filter((k) => k in then && then[k] !== now[k]);
}
