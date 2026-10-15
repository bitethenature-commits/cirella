import "server-only";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { visitorHash } from "./analytics";
import { prisma } from "./db";
import { clientIp } from "./request-ip";

/**
 * Medición sin cookies: la sal diaria se borra, así que no se puede seguir a nadie entre días.
 * Nada se guarda en el navegador: el visitante del día se calcula en el servidor a partir de la IP
 * y del navegador (ver README, «Cumplimiento legal»).
 */

const DAY_MS = 86_400_000;
/** Sal de cada día en este proceso (evita una consulta por cada visita). */
const cache = new Map<string, string>();

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** Sal del día (UTC). La crea si no existe y borra las de antes de ayer. */
export async function getDailySalt(now: Date = new Date()): Promise<string> {
  const day = dayOf(now);
  const cached = cache.get(day);
  if (cached) return cached;
  let row = await prisma.analyticsSalt.findUnique({ where: { day } });
  if (!row) {
    try {
      row = await prisma.analyticsSalt.create({ data: { day, salt: randomBytes(32).toString("hex") } });
    } catch (e) {
      // Otra petición la ha creado a la vez.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      row = await prisma.analyticsSalt.findUniqueOrThrow({ where: { day } });
    }
    // Se conserva la de ayer para que las visitas de alrededor de medianoche se atribuyan bien.
    await prisma.analyticsSalt.deleteMany({ where: { day: { lt: dayOf(new Date(now.getTime() - DAY_MS)) } } });
  }
  cache.clear();
  cache.set(day, row.salt);
  return row.salt;
}

/** Visitante del día de esta petición para una creadora (Server Components, acciones y rutas). */
export async function currentVisitorId(creatorId: string): Promise<string> {
  const h = await headers();
  return visitorHash(await getDailySalt(), creatorId, clientIp(h), h.get("user-agent") ?? "");
}
