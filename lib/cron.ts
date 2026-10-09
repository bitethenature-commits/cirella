import "server-only";
import { emitAbandoned } from "./abandoned";
import { processDac7Reminders } from "./dac7-data";
import { processOutbox } from "./email/outbox";
import { processEvents } from "./events";
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
        // Petición y recordatorios de los datos fiscales de DAC7 (solo actúa cuando toca: 0, +20 y +40 días).
        ["dac7", () => processDac7Reminders()],
        ["vigilancia", async () => {
          const w = await runWatchdog();
          return w.refulfilled + w.paidUndelivered;
        }],
        ["emails", () => processOutbox()],
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
