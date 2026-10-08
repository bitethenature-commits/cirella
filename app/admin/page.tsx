import Link from "next/link";
import { BarChart, HBars } from "@/components/charts";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, formatNumber } from "@/lib/money";
import { getPlatformOverview } from "@/lib/platform-stats";
import { PageHeader, Stat } from "../panel/ui";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getPlatformOverview();
  return (
    <div className="space-y-6">
      <PageHeader title="Resumen de la plataforma" subtitle="Todas las creadoras, ventas e ingresos." />
      <Flash ok={sp.ok} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ingresos de la plataforma" value={formatMoney(s.platformRevenue)} hint={`${formatMoney(s.commissions)} comisiones · ${formatMoney(s.planRevenue)} planes`} accent />
        <Stat label="Volumen vendido (GMV)" value={formatMoney(s.gmv)} hint={`${formatNumber(s.orders)} pedidos`} />
        <Stat label="MRR de planes" value={formatMoney(s.platformMrr)} hint="Suscripciones de creadoras" />
        <Stat label="Creadoras" value={s.creators} hint={`${s.publishedCreators} publicadas · ${s.blockedCreators} bloqueadas`} />
        <Stat label="Clientes" value={s.customers} hint="Compradoras únicas" />
        <Stat label="Membresías activas" value={s.activeSubs} />
        <Stat label="Usuarios bloqueados" value={s.blockedUsers} hint={<Link href="/admin/bloqueados" className="underline">Ver</Link>} />
        <Stat label="Comisión media" value={s.gmv ? `${((s.commissions / s.gmv) * 100).toFixed(1)} %` : "—"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="mb-5 font-semibold">Ingresos de la plataforma por mes</h2>
          <BarChart title="Ingresos de la plataforma" axis="money" data={s.series.map((m) => ({ key: m.key, label: m.label, value: m.commissions + m.planFees, display: `${formatMoney(m.commissions + m.planFees)} (${formatMoney(m.commissions)} comisiones)` }))} />
          <h2 className="mb-5 mt-8 font-semibold">GMV por mes</h2>
          <BarChart title="GMV" axis="money" height={120} color="var(--color-gold)" data={s.series.map((m) => ({ key: m.key, label: m.label, value: m.gmv, display: formatMoney(m.gmv) }))} />
        </section>
        <div className="space-y-4">
          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 font-semibold">Creadoras por plan</h2>
            <HBars rows={s.byPlan.map((p) => ({ label: p.plan.name, value: p.count, display: String(p.count), sub: formatMoney(p.plan.priceMonthlyCents) + "/mes" }))} />
          </section>
          <section className="card p-5 sm:p-6">
            <h2 className="mb-4 font-semibold">Top creadoras</h2>
            <ul className="space-y-2.5 text-sm">
              {s.topCreators.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <Link href={`/${c.username}`} target="_blank" className="truncate hover:underline">{c.displayName} <span className="text-muted">/{c.username}</span></Link>
                  <span className="font-semibold tabular-nums">{formatMoney(c.gmv)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
