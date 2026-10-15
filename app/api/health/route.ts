import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env, isDemoMode } from "@/lib/env";
import { getJobStatus } from "@/lib/job-lock";
import { CRON_STALE_MINUTES, isStale } from "@/lib/reliability";

export const dynamic = "force-dynamic";

/**
 * GET /api/health: para un monitor de disponibilidad (BetterStack, UptimeRobot…).
 * 200 si todo va bien; 503 si la base de datos no responde o si las tareas programadas llevan
 * más de 20 min sin ejecutarse (sin cron no salen los emails ni se reintentan las entregas).
 * El cron solo se vigila donde está configurado (CRON_SECRET) y fuera del modo demo.
 * Sin datos sensibles.
 */
export async function GET() {
  const now = new Date();
  let db: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  const cronExpected = !!env().CRON_SECRET && !isDemoMode();
  const job = db === "ok" ? await getJobStatus("cron").catch(() => null) : null;
  const lastFinishedAt = job?.lastFinishedAt ?? null;
  const estado = !cronExpected ? "sin-configurar" : isStale(lastFinishedAt, now, CRON_STALE_MINUTES) ? "retrasado" : "ok";
  const ok = db === "ok" && estado !== "retrasado";
  return NextResponse.json(
    { ok, db, cron: { estado, ultimaEjecucion: lastFinishedAt?.toISOString() ?? null } },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
