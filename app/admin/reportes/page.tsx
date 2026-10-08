import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getPlatformOverview } from "@/lib/platform-stats";
import { PageHeader } from "../../panel/ui";
import { AdminTable, td } from "../ui";

export default async function AdminReports() {
  await requireAdmin();
  const s = await getPlatformOverview();
  return (
    <div>
      <PageHeader title="Reportes" subtitle="Evolución mensual de la plataforma (últimos 6 meses)." actions={<a href="/admin/reportes/csv" className="btn btn-outline"><Download className="h-4 w-4" /> Exportar CSV</a>} />
      <AdminTable head={["Mes", "Nuevas creadoras", "Nuevas clientas", "Pedidos", "GMV", "Comisiones", "Cuotas de plan", "Ingresos plataforma"]} minWidth={900}>
        {[...s.series].reverse().map((m) => (
          <tr key={m.key}>
            <td className={`${td} font-semibold capitalize`}>{m.label}</td>
            <td className={td}>{m.newCreators}</td>
            <td className={td}>{m.newCustomers}</td>
            <td className={td}>{m.orders}</td>
            <td className={`${td} tabular-nums`}>{formatMoney(m.gmv)}</td>
            <td className={`${td} tabular-nums`}>{formatMoney(m.commissions, "EUR", { decimals: true })}</td>
            <td className={`${td} tabular-nums`}>{formatMoney(m.planFees, "EUR", { decimals: true })}</td>
            <td className={`${td} text-right font-semibold tabular-nums`}>{formatMoney(m.commissions + m.planFees, "EUR", { decimals: true })}</td>
          </tr>
        ))}
      </AdminTable>
      <p className="mt-4 text-xs text-muted">Pregunta de validación del MVP: ¿cuántas creadoras pasan a un plan de pago y cuánto genera la comisión frente a la cuota? Compara «Comisiones» y «Cuotas de plan» mes a mes.</p>
    </div>
  );
}
