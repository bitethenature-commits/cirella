import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { yearOf } from "@/lib/dac7";
import { dac7Report, parseDac7Year } from "@/lib/dac7-data";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { PRODUCT_TYPE_LABEL, PRODUCT_TYPES } from "@/lib/types";
import { Badge, PageHeader } from "../../../panel/ui";
import { AdminTable, td } from "../../ui";
import { saveDac7Types } from "./actions";

const eur = (cents: number) => formatMoney(cents, "EUR", { decimals: true });

export default async function AdminDac7({ searchParams }: { searchParams: Promise<{ anio?: string; ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const year = parseDac7Year(sp.anio);
  const current = yearOf(new Date());
  const [report, settings] = await Promise.all([dac7Report(year), getSettings()]);
  const years = [current, current - 1, current - 2];

  return (
    <div>
      <Link href="/admin/reportes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Reportes
      </Link>
      <PageHeader
        title={`DAC7 · ${year}`}
        subtitle="Lo que cobra cada vendedora por servicios personales, por trimestres (hora de España, importe neto de la comisión)."
        actions={
          <a href={`/admin/reportes/dac7/csv?anio=${year}`} className="btn btn-outline">
            <Download className="h-4 w-4" /> Exportar CSV (modelo 238)
          </a>
        }
      />
      <Flash ok={sp.ok} />
      <nav className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {years.map((y) => (
          <Link key={y} href={`/admin/reportes/dac7?anio=${y}`} className={`rounded-full border px-3 py-1 ${y === year ? "border-ink bg-ink text-cream" : "border-line text-muted hover:text-ink"}`}>
            {y}
          </Link>
        ))}
      </nav>

      <AdminTable head={["Creadora", "Nombre legal", "NIF", "Datos", "T1", "T2", "T3", "T4", "Ventas", "Comisiones", "Total neto"]} minWidth={1100}>
        {report.map(({ creator: c, missing, agg }) => (
          <tr key={c.id}>
            <td className={td}>
              <p className="font-semibold">{c.displayName}</p>
              <p className="text-xs text-muted">@{c.username}</p>
            </td>
            <td className={td}>{c.legalName ?? <span className="text-muted">—</span>}</td>
            <td className={`${td} font-mono text-xs`}>{c.legalTaxId ?? <span className="text-muted">—</span>}</td>
            <td className={td}>{missing.length ? <Badge tone="warning">Faltan: {missing.join(", ")}</Badge> : <Badge tone="success">Completos</Badge>}</td>
            {agg.quarters.map((q, i) => (
              <td key={i} className={`${td} tabular-nums`}>{eur(q.considerationCents)}</td>
            ))}
            <td className={`${td} tabular-nums`}>{agg.total.activities}</td>
            <td className={`${td} tabular-nums text-muted`}>{eur(agg.total.feesCents)}</td>
            <td className={`${td} text-right font-semibold tabular-nums`}>{eur(agg.total.considerationCents)}</td>
          </tr>
        ))}
      </AdminTable>
      {report.length === 0 && <p className="mt-4 text-sm text-muted">Ninguna vendedora tiene ventas declarables en {year}.</p>}
      <p className="mt-4 text-xs text-muted">
        Revisa los criterios con tu asesoría antes de presentar el modelo 238 (plazo: 31 de enero). El CSV no es el fichero oficial de la AEAT: lo prepara la asesoría.
      </p>

      <form action={saveDac7Types} className="card mt-8 max-w-xl space-y-3 p-5">
        <input type="hidden" name="anio" value={year} />
        <h2 className="font-semibold">Tipos de producto declarables (servicios personales)</h2>
        <p className="text-sm text-muted">Por defecto, solo las sesiones. Cambia esto solo si tu asesoría lo indica: afecta al informe, a los avisos a las creadoras y a la pausa de ventas por datos incompletos.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PRODUCT_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="types" value={t} defaultChecked={settings.dac7ReportableTypes.includes(t)} className="h-4 w-4" />
              {PRODUCT_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Guardando…">Guardar</SubmitButton>
      </form>
    </div>
  );
}
