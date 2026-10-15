import type { Instrumentation } from "next";
import { env } from "./env";

/**
 * Monitorización de errores. Sentry es opcional: solo se carga (import dinámico) si hay
 * SENTRY_DSN, así que sin DSN no cuesta nada y todo queda en la consola del servidor con un
 * formato estructurado. Sin SDK de navegador: el bundle del cliente no cambia.
 *
 * Privacidad: a Sentry solo van ids (pedido, email, evento), nunca emails ni nombres;
 * sendDefaultPii está desactivado y beforeSend (scrubEvent) borra cookies, cabeceras de
 * autorización, el cuerpo de las peticiones (formularios con IBAN o NIF) y la query de las URLs
 * (los enlaces personales y mágicos llevan el token ahí: /auth/enlace?t=…, /auth/magic?token=…).
 */

type ScrubbableEvent = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; data?: unknown; headers?: Record<string, string> };
  contexts?: { [key: string]: Record<string, unknown> | undefined };
};

const withoutQuery = (s: unknown) => (typeof s === "string" ? s.split("?")[0] : s);

/** Limpia un evento antes de mandarlo a Sentry (ver arriba). Exportada para las pruebas. */
export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  const nextjs = event.contexts?.nextjs;
  // captureRequestError (onRequestError) guarda aquí la ruta con su query.
  if (nextjs && typeof nextjs.request_path === "string") nextjs.request_path = withoutQuery(nextjs.request_path);
  if (event.request) {
    if (event.request.url) event.request.url = withoutQuery(event.request.url) as string;
    delete event.request.query_string;
    delete event.request.cookies;
    // Los cuerpos de formulario pueden llevar datos fiscales (IBAN, NIF, fecha de nacimiento).
    delete event.request.data;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
      // La página anterior puede ser la URL de un enlace con su token.
      delete event.request.headers.referer;
    }
  }
  return event;
}

/**
 * Sentry manda los eventos en segundo plano. En Vercel la función puede congelarse en cuanto
 * responde y la alerta se perdería: con `after` (Next) sigue viva hasta vaciar la cola (máx. 2 s).
 * Fuera de una petición (scripts, arranque) `after` lanza y no se hace nada; el cron espera a mano
 * en withCronMonitor.
 */
function flushAfterResponse(s: Sentry) {
  import("next/server")
    .then(({ after }) => after(() => s.flush(2000).then(() => undefined)))
    .catch(() => {});
}

type Sentry = typeof import("@sentry/nextjs");
// En globalThis y no en una variable del módulo: Next compila instrumentation.ts y las rutas en
// capas distintas (cada una con su copia de este archivo) y todas deben ver el Sentry iniciado.
const holder = globalThis as typeof globalThis & { __cirellaSentry?: Sentry };

/** La llama instrumentation.ts al arrancar el servidor (runtime de Node). */
export async function initMonitoring() {
  const dsn = env().SENTRY_DSN;
  if (!dsn || holder.__cirellaSentry) return;
  try {
    const mod = await import("@sentry/nextjs");
    mod.init({
      dsn,
      environment: env().APP_ENV,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: (event) => scrubEvent(event),
    });
    holder.__cirellaSentry = mod;
    console.info("[cirella] Monitorización de errores activa (Sentry).");
  } catch (e) {
    // Sin monitorización la web sigue funcionando: no se impide el arranque.
    console.error("[monitoring] No se pudo iniciar Sentry", e);
  }
}

export function monitoringEnabled() {
  return !!holder.__cirellaSentry;
}

type ErrorContext = { area: string; tags?: Record<string, string>; extra?: Record<string, unknown> };

/** Error inesperado: siempre a la consola y, si está configurado, a Sentry. Nunca lanza. */
export function captureError(error: unknown, ctx: ErrorContext) {
  console.error("[error]", ctx.area, { ...ctx.tags, ...ctx.extra }, error);
  const s = holder.__cirellaSentry;
  if (!s) return;
  try {
    s.withScope((scope) => {
      scope.setTag("area", ctx.area);
      for (const [k, v] of Object.entries(ctx.tags ?? {})) scope.setTag(k, v);
      if (ctx.extra) scope.setExtras(ctx.extra);
      s.captureException(error);
    });
    flushAfterResponse(s);
  } catch (e) {
    console.error("[monitoring] No se pudo informar a Sentry", e);
  }
}

type AlertContext = { area: string; level?: "warning" | "error"; fingerprint?: string[]; extra?: Record<string, unknown> };

/**
 * Situación que alguien tiene que revisar aunque no haya una excepción (un email que no
 * sale tras los reintentos, un pedido cobrado sin entregar…). Con Sentry genera una incidencia
 * agrupada por `fingerprint` para que las reglas de alerta avisen por email o Slack.
 */
export function captureAlert(message: string, ctx: AlertContext) {
  const level = ctx.level ?? "warning";
  (level === "error" ? console.error : console.warn)(`[alerta] ${ctx.area}: ${message}`, ctx.extra ?? {});
  const s = holder.__cirellaSentry;
  if (!s) return;
  try {
    s.captureMessage(message, { level, tags: { area: ctx.area }, fingerprint: ctx.fingerprint, extra: ctx.extra });
    flushAfterResponse(s);
  } catch (e) {
    console.error("[monitoring] No se pudo informar a Sentry", e);
  }
}

/**
 * Check-in de Sentry Cron para una tarea programada cada 5 min: si no llega ninguno en
 * 20 min (5 + 15 de margen) o una ejecución falla, Sentry avisa. Sin Sentry, solo ejecuta.
 */
export async function withCronMonitor<T extends { ok: boolean }>(slug: string, fn: () => Promise<T>): Promise<T> {
  const s = holder.__cirellaSentry;
  if (!s) return fn();
  const checkInId = s.captureCheckIn(
    { monitorSlug: slug, status: "in_progress" },
    { schedule: { type: "interval", value: 5, unit: "minute" }, checkinMargin: 15, maxRuntime: 10, timezone: "Etc/UTC" },
  );
  try {
    const result = await fn();
    s.captureCheckIn({ checkInId, monitorSlug: slug, status: result.ok ? "ok" : "error" });
    return result;
  } catch (e) {
    s.captureCheckIn({ checkInId, monitorSlug: slug, status: "error" });
    throw e;
  } finally {
    // Antes de responder: el check-in y las alertas de las tareas (emails no entregados, pedidos
    // sin entregar…) salen ya, no cuando Vercel vuelva a despertar la función (o nunca).
    await s.flush(2000).catch(() => {});
  }
}

/** Errores de servidor no capturados (render, route handlers, server actions): onRequestError de Next. */
export async function reportRequestError(...args: Parameters<Instrumentation.onRequestError>) {
  const s = holder.__cirellaSentry;
  if (!s) return;
  try {
    await s.captureRequestError(...args);
  } catch (e) {
    console.error("[monitoring] No se pudo informar a Sentry", e);
  }
}
