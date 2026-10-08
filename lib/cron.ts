import "server-only";
import { emitAbandoned } from "./abandoned";
import { processOutbox } from "./email/outbox";
import { processRenewals } from "./subscriptions";

/** Tareas periódicas: ejecutar cada 5–15 minutos (Vercel Cron, GitHub Actions, crontab…). */
export async function runScheduledJobs() {
  const abandoned = await emitAbandoned(60);
  const renewals = await processRenewals();
  const emails = await processOutbox();
  return { abandoned, renewals, emails };
}
