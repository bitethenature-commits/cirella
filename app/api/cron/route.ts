import { NextResponse } from "next/server";
import { runScheduledJobs } from "@/lib/cron";
import { env } from "@/lib/env";

/**
 * GET /api/cron  con cabecera `Authorization: Bearer $CRON_SECRET`.
 * Procesa recordatorios programados, carritos abandonados y renovaciones.
 */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runScheduledJobs()) });
}
