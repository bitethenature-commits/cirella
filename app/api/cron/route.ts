import { NextResponse } from "next/server";
import { runScheduledJobs } from "@/lib/cron";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron  con cabecera `Authorization: Bearer $CRON_SECRET`, cada 5 minutos.
 * Procesa eventos pendientes, carritos abandonados, renovaciones, el vigilante de pedidos
 * cobrados sin entregar y la bandeja de emails (lib/cron.ts). Responde 500 si alguna tarea
 * falla, para que el programador lo registre; si ya hay otra ejecución en marcha, `skipped`.
 */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const r = await runScheduledJobs();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
