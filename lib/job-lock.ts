import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { truncateError } from "./reliability";

/**
 * Cerrojo con lease para tareas programadas, que además hace de latido: la fila JobLock guarda
 * cuándo empezó y terminó la última ejecución y si fue bien (lo leen /api/health y /admin/envios).
 *
 * Se adquiere con un único INSERT … ON CONFLICT … WHERE "lockedUntil" < now(): atómico en
 * Postgres y con el reloj de la BD, así que dos servidores nunca ejecutan la tarea a la vez.
 * Si el proceso cae sin liberarlo, el lease caduca solo.
 */
export async function withJobLock<T extends { ok: boolean }>(
  name: string,
  leaseSeconds: number,
  fn: () => Promise<T>,
): Promise<{ ran: false } | { ran: true; result: T }> {
  const token = randomUUID();
  const acquired = await prisma.$queryRaw<{ name: string }[]>`
    INSERT INTO "JobLock" ("name", "lockedUntil", "lockedBy", "lastStartedAt")
    VALUES (${name}, now() + make_interval(secs => ${leaseSeconds}), ${token}, now())
    ON CONFLICT ("name") DO UPDATE
      SET "lockedUntil" = EXCLUDED."lockedUntil", "lockedBy" = EXCLUDED."lockedBy", "lastStartedAt" = now()
      WHERE "JobLock"."lockedUntil" < now()
    RETURNING "name"`;
  if (!acquired.length) return { ran: false };

  let result: T | undefined;
  let error: unknown;
  try {
    result = await fn();
    return { ran: true, result };
  } catch (e) {
    error = e;
    throw e;
  } finally {
    const finishedAt = new Date();
    const ok = !!result?.ok;
    const released = await prisma.jobLock
      .updateMany({
        where: { name, lockedBy: token },
        data: {
          lockedUntil: finishedAt,
          lastFinishedAt: finishedAt,
          ...(ok
            ? { lastOkAt: finishedAt, lastError: null }
            : { lastError: error ? truncateError(error) : "Algunas tareas han fallado (ver lastResult)" }),
          ...(result ? { lastResult: result as unknown as Prisma.InputJsonValue } : {}),
        },
      })
      .catch((e) => {
        console.error(`[job-lock] No se pudo liberar «${name}»`, e);
        return { count: -1 };
      });
    if (released.count === 0) console.warn(`[job-lock] «${name}» terminó después de que caducara su lease (lease perdido).`);
  }
}

export function getJobStatus(name: string) {
  return prisma.jobLock.findUnique({ where: { name } });
}
