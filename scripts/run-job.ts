/**
 * Ayuda de las pruebas e2e: ejecuta una tarea del cron sin pasar por /api/cron.
 *   tsx --conditions=react-server scripts/run-job.ts comunidad|caducidades|emails
 * comunidad → avisos de publicaciones · caducidades → fin de los accesos con fecha; las dos crean
 * sus emails (no los envía: los masivos esperan a la bandeja). emails → processOutbox.
 * Imprime el resultado en JSON. Solo fuera de producción (APP_ENV test o development).
 */
import "./load-env";
import { processAccessExpiry } from "../lib/access-expiry";
import { processPostNotifications } from "../lib/community-notify";
import { prisma } from "../lib/db";
import { processOutbox } from "../lib/email/outbox";

async function main() {
  const env = process.env.APP_ENV ?? "development";
  if (env !== "test" && env !== "development") throw new Error(`run-job solo funciona en test o development (APP_ENV=${env})`);
  const job = process.argv[2];
  const jobs: Record<string, () => Promise<number>> = {
    comunidad: () => processPostNotifications(),
    caducidades: () => processAccessExpiry(),
    emails: () => processOutbox(),
  };
  if (!jobs[job]) throw new Error(`Tarea desconocida: ${job}`);
  console.log(JSON.stringify({ job, result: await jobs[job]() }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
