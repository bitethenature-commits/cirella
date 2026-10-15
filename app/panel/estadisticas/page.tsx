import { BarChart, HBars } from "@/components/charts";
import { requireCreator } from "@/lib/auth";
import { SOURCE_LABEL, type Source } from "@/lib/analytics";
import { formatMoney, formatNumber, formatPercent } from "@/lib/money";
import { planFeatures } from "@/lib/plans";
import { isPersonalMode } from "@/lib/site-mode";
import { getAdvancedStats, getDashboardStats, parseRange } from "@/lib/stats";
import { Locked, PageHeader, RangeTabs, Stat } from "../ui";

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ rango?: string }> }) {
  const { creator } = await requireCreator();
  const range = parseRange((await searchParams).rango);
  const f = planFeatures(creator.plan);
  if (f.analytics === "basic")
    return (
      <div>
        <PageHeader title="Estadísticas" />
        <Locked plan="Creator" title="Entiende qué funciona" text="Visitas, conversión, ventas por producto y de dónde llegan tus clientas: Instagram, TikTok, Telegram…" />
      </div>
    );
  const [s, adv] = await Promise.all([getDashboardStats(creator.id, range, creator.timezone), getAdvancedStats(creator.id, range, creator.timezone)]);
  const advanced = f.analytics === "advanced";
  // Modo personal: aquí no hay ventas; el final del recorrido son las inscripciones y los clics al botón.
  const personal = isPersonalMode();
  const first = adv.funnel[0].value || 1;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Estadísticas"
        subtitle={personal ? "Visitas, visitantes, clics e inscripciones." : "Page views, visitantes, clics, checkouts, compras e ingresos."}
        actions={<RangeTabs current={range} base="/panel/estadisticas" />}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Visitas" value={formatNumber(s.pageViews)} accent />
        <Stat label="Visitantes únicos" value={formatNumber(s.uniqueVisitors)} hint="Personas distintas cada día, medidas sin cookies" />
        {personal ? (
          <>
            <Stat label="Inscripciones" value={formatNumber(s.signups)} hint={`${formatPercent(s.signupConversion)} de los visitantes`} />
            <Stat label="Clics en productos" value={formatNumber(s.clicks)} hint="Incluye los botones a otras webs" />
          </>
        ) : (
          <>
            <Stat label="Conversión" value={formatPercent(s.conversion)} hint="Compras / visitantes" />
            <Stat label="Ingresos" value={formatMoney(s.revenue)} hint={`${s.sales} compras`} />
          </>
        )}
      </div>
      <section className="card p-5 sm:p-6">
        <h2 className="mb-5 font-semibold">Visitas</h2>
        <BarChart title="Visitas" color="var(--color-gold)" data={s.series.map((p) => ({ key: p.key, label: p.label, value: p.visits, display: `${p.visits} visitas` }))} />
      </section>
      {advanced ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5 sm:p-6">
              <h2 className="font-semibold">{personal ? "Recorrido" : "Embudo de venta"}</h2>
              <p className="mb-5 text-xs text-muted">{personal ? "Del primer vistazo a la inscripción." : "Del primer vistazo a la compra."}</p>
              <HBars rows={adv.funnel.map((r) => ({ label: r.label, value: r.value, display: formatNumber(r.value), sub: r.key === "PAGE_VIEW" ? undefined : formatPercent(r.value / first) }))} />
            </section>
            <section className="card p-5 sm:p-6">
              <h2 className="font-semibold">De dónde llegan</h2>
              <p className="mb-5 text-xs text-muted">Origen de las visitas (referrer o ?utm_source en tu enlace).</p>
              <HBars color="var(--color-ink-3)" rows={adv.sources.map((r) => ({ label: SOURCE_LABEL[r.source as Source] ?? r.source, value: r.value, display: formatNumber(r.value), sub: formatPercent(r.value / Math.max(1, s.pageViews)) }))} />
            </section>
          </div>
          <section className="card overflow-hidden">
            <h2 className="px-5 pt-5 font-semibold sm:px-6">Por producto</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-y border-line bg-paper text-xs text-muted">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-semibold sm:px-6">Producto</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Vistas</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Clics</th>
                    {personal ? (
                      <th className="px-3 py-2.5 text-right font-semibold">Inscripciones</th>
                    ) : (
                      <>
                        <th className="px-3 py-2.5 text-right font-semibold">Checkouts</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Compras</th>
                      </>
                    )}
                    <th className={`px-3 py-2.5 text-right font-semibold ${personal ? "pr-5 sm:pr-6" : ""}`}>Conversión</th>
                    {!personal && <th className="px-5 py-2.5 text-right font-semibold sm:px-6">Ingresos</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {adv.perProduct.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 sm:px-6">{p.emoji} {p.title}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.views}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.clicks}</td>
                      {personal ? (
                        <td className="px-3 py-3 text-right tabular-nums">{p.signups}</td>
                      ) : (
                        <>
                          <td className="px-3 py-3 text-right tabular-nums">{p.checkouts}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{p.purchases}</td>
                        </>
                      )}
                      <td className={`px-3 py-3 text-right tabular-nums ${personal ? "pr-5 sm:pr-6" : ""}`}>{formatPercent(p.conversion)}</td>
                      {!personal && <td className="px-5 py-3 text-right font-semibold tabular-nums sm:px-6">{formatMoney(p.revenue)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-xs text-muted">Consejo: usa <code className="rounded bg-sand px-1">?utm_source=instagram</code> o <code className="rounded bg-sand px-1">?utm_source=telegram</code> al final de tu enlace en cada red para medir mejor el origen.</p>
        </>
      ) : (
        <Locked title="Estadísticas avanzadas" text="Embudo de conversión, fuentes de tráfico y rendimiento de cada producto." />
      )}
    </div>
  );
}
