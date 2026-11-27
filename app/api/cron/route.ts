import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { runScheduledJobs } from "@/lib/cron";
import { env } from "@/lib/env";
import { isPersonalMode } from "@/lib/site-mode";

/** Una vez por arranque del servidor (ver abajo). */
let personalPagesRefreshed = false;

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
  // Web personal: la página «no encontrada» se genera al compilar, y en Railway el build no llega a
  // la BD (sale sin la marca de la dueña). La primera tarea tras cada despliegue la regenera, como
  // hace «Publicar» (app/panel/pagina/actions.ts), sin esperar a que ella vuelva a publicar.
  if (isPersonalMode() && !personalPagesRefreshed) {
    personalPagesRefreshed = true;
    revalidatePath("/", "layout");
  }
  const r = await runScheduledJobs();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
