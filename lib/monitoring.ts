import type { Instrumentation } from "next";
import { env } from "./env";

/**
 * Monitorización de errores. Sentry es opcional: solo se carga (import dinámico) si hay
 * SENTRY_DSN, así que sin DSN no cuesta nada y todo queda en la consola del servidor con un
 * formato estructurado. Sin SDK de navegador: el bundle del cliente no cambia.
 *
 * Privacidad: a Sentry solo van ids (pedido, email, evento), nunca emails ni nombres;
 * sendDefaultPii está desactivado y beforeSend borra cookies y cabeceras de autorización.
 */

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
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.cookie;
            delete event.request.headers.authorization;
          }
        }
        return event;
      },
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
