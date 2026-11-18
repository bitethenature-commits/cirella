import { BarChart3, Link2, UserMinus, UserPlus, Users } from "lucide-react";
import { formatNumber } from "@/lib/money";
import { clicksByLink, prettyLink } from "@/lib/newsletter-stats";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { PageHeader } from "../../ui";
import { requireNewsletterOwner } from "../guard";
import { NewsletterTabs } from "../tabs";
import { MonthBars, SummaryStat, trendPct } from "../summary";

export const dynamic = "force-dynamic";

/**
 * Estadísticas de la newsletter, solo lo importante: cuántas te leen, quién entra y quién se va cada
 * mes, y qué enlaces de tus newsletters toca más la gente.
 */
export default async function StatsPage() {
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [active, newThis, newPrev, leftThis, subs, links] = await Promise.all([
    db.subscriber.count({ where: { status: "CONFIRMED" } }),
    db.subscriber.count({ where: { confirmedAt: { gte: monthStart } } }),
    db.subscriber.count({ where: { confirmedAt: { gte: prevMonthStart, lt: monthStart } } }),
    db.subscriber.count({ where: { unsubscribedAt: { gte: monthStart } } }),
    db.subscriber.findMany({ where: { OR: [{ confirmedAt: { gte: yearAgo } }, { unsubscribedAt: { gte: yearAgo } }] }, select: { confirmedAt: true, unsubscribedAt: true } }),
    clicksByLink(creator.id, null, 12),
  ]);
  const months: { label: string; joined: number; left: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const a = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const b = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inM = (d: Date | null) => !!d && d >= a && d < b;
    months.push({ label: formatDate(a, { month: "short" }, creator.timezone), joined: subs.filter((s) => inM(s.confirmedAt)).length, left: subs.filter((s) => inM(s.unsubscribedAt)).length });
  }
  const maxLink = links[0]?.clicks ?? 1;

  return (
    <div>
      <PageHeader title="Estadísticas" subtitle="Lo importante: cuántas te leen, quién entra, quién se va y qué enlaces interesan." />
      <NewsletterTabs current="/panel/newsletter/estadisticas" />

      <h2 className="mb-3 flex items-center gap-2 font-serif text-xl"><Users className="h-5 w-5 text-[#d9bf8c]" strokeWidth={1.5} /> Tu lista</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat icon={Users} value={formatNumber(active)} label="Suscriptoras activas" hint="Las que confirmaron y siguen dentro" />
        <SummaryStat icon={UserPlus} value={formatNumber(newThis)} label="Nuevas este mes" trend={trendPct(newThis, newPrev)} hint={`El mes pasado: ${formatNumber(newPrev)}`} />
        <SummaryStat icon={UserMinus} value={formatNumber(leftThis)} label="Bajas este mes" hint={leftThis ? "Se fueron este mes" : "Nadie se ha ido este mes"} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-serif text-xl"><BarChart3 className="h-5 w-5 text-[#d9bf8c]" strokeWidth={1.5} /> Altas y bajas por mes</h2>
          <p className="mb-3 flex gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#3cc0b2]" /> Altas confirmadas</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#e79a8f]" /> Bajas</span>
          </p>
          <MonthBars months={months} />
        </section>
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-serif text-xl"><Link2 className="h-5 w-5 text-[#d9bf8c]" strokeWidth={1.5} /> Enlaces más tocados</h2>
          <p className="mb-4 text-xs text-muted">Personas distintas que tocaron cada enlace de tus newsletters (sin contar el de baja).</p>
          {links.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay datos. Se ven cuando el seguimiento de clics está activado en Resend.</p>
          ) : (
            <ul className="space-y-3">
              {links.map((l) => (
                <li key={l.link}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <a href={l.link} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate hover:text-[#6fd6cb]" title={l.link}>{prettyLink(l.link)}</a>
                    <span className="shrink-0 tabular-nums text-muted">{formatNumber(l.clicks)}</span>
                  </div>
                  <div className="nl-bar mt-1"><span style={{ width: `${Math.max(4, (l.clicks / maxLink) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
