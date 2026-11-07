import "server-only";
import { emitAbandoned } from "./abandoned";
import { processAccessExpiry } from "./access-expiry";
import { purgeOrphanPostFiles } from "./community";
import { processPostNotifications } from "./community-notify";
import { purgeExpiredAuth } from "./auth-tokens";
import { processOutbox } from "./email/outbox";
import { processCampaigns } from "./newsletter-send";
import { processEvents } from "./events";
import { purgeAbandonedIntake } from "./orders";
import { withJobLock } from "./job-lock";
import { captureError, withCronMonitor } from "./monitoring";
import { processPlanRenewals, processRenewals } from "./subscriptions";
import { runWatchdog } from "./watchdog";

type CronResult = { ok: boolean; skipped?: true; results: Record<string, number>; errors: string[] };

/** La ejecución no debería pasar de unos segundos; el lease cubre de sobra una ejecución lenta. */
const LEASE_SECONDS = 600;

/**
 * Tareas periódicas. Programar /api/cron cada 5 min (Vercel Cron, GitHub Actions, crontab…):
 * si pasan 20 min sin ejecutarse, Sentry (cron monitor «cirella-cron») y /api/health avisan.
 *
 * Nunca corren dos a la vez (JobLock) y cada tarea aísla sus errores: si una falla, las demás
 * siguen y el fallo queda registrado. Los emails van al final para que salgan ya los que
 * acaban de generar los eventos y los abandonos.
 */
export async function runScheduledJobs(): Promise<CronResult> {
  const run = await withJobLock("cron", LEASE_SECONDS, () =>
    withCronMonitor("cirella-cron", async () => {
      const jobs: [string, () => Promise<number>][] = [
        ["eventos", () => processEvents()],
        ["abandonados", () => emitAbandoned()],
        ["renovaciones", () => processRenewals()],
        ["cuotasPlan", () => processPlanRenewals()],
        ["vigilancia", async () => {
          const w = await runWatchdog();
          return w.refulfilled + w.paidUndelivered;
        }],
        // Comunidad: aviso por email de las publicaciones que acaban de hacerse visibles (las programadas).
        ["comunidad", () => processPostNotifications()],
        // Accesos con fecha de fin: aviso 7 días antes y, al llegar, se cierran y se avisa.
        ["caducidades", () => processAccessExpiry()],
        // Datos para la lectura de los pedidos que nunca se pagaron: fuera a los 30 días.
        ["datosLecturas", () => purgeAbandonedIntake(new Date())],
        // Newsletter: empieza las programadas y mete en la bandeja lo que cabe en el cupo de hoy.
        ["newsletter", () => processCampaigns(new Date())],
        ["emails", () => processOutbox()],
        // Sesiones, enlaces mágicos y enlaces personales caducados.
        ["accesos", () => purgeExpiredAuth()],
        // Archivos subidos para una publicación que nunca se guardó.
        ["adjuntosSueltos", () => purgeOrphanPostFiles(new Date())],
      ];
      const results: Record<string, number> = {};
      const errors: string[] = [];
      for (const [name, job] of jobs) {
        try {
          results[name] = await job();
        } catch (e) {
          errors.push(name);
          captureError(e, { area: "cron", tags: { job: name } });
        }
      }
      return { ok: errors.length === 0, results, errors };
    }),
  );
  if (!run.ran) return { ok: true, skipped: true, results: {}, errors: [] };
  return run.result;
}
