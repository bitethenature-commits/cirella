import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformOverview } from "@/lib/platform-stats";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new NextResponse("No autorizado", { status: 403 });
  const s = await getPlatformOverview();
  const rows = [["mes", "nuevas_creadoras", "nuevas_clientas", "pedidos", "gmv_eur", "comisiones_eur", "cuotas_plan_eur"]];
  for (const m of s.series) rows.push([m.key, String(m.newCreators), String(m.newCustomers), String(m.orders), (m.gmv / 100).toFixed(2), (m.commissions / 100).toFixed(2), (m.planFees / 100).toFixed(2)]);
  return new NextResponse(rows.map((r) => r.join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="cirella-reporte.csv"' },
  });
}
