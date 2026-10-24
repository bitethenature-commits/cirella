import Link from "next/link";
import { CalendarClock, Mail, Plus } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendingQuota } from "@/lib/email/outbox";
import { formatNumber } from "@/lib/money";
import { peopleCount } from "@/lib/newsletter-rules";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { Badge, PageHeader, Stat } from "../ui";
import { createCampaign } from "./actions";
import { requireNewsletterOwner } from "./guard";
import { CAMPAIGN_STATUS, segmentLabel, type Tone } from "./labels";
import { NewsletterTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function NewsletterPage() {
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [campaigns, confirmed, newThisMonth, pending, unsubscribed, products, quota] = await Promise.all([
    db.campaign.findMany({ orderBy: [{ updatedAt: "desc" }], take: 50 }),
    db.subscriber.count({ where: { status: "CONFIRMED" } }),
    db.subscriber.count({ where: { status: "CONFIRMED", confirmedAt: { gte: monthStart } } }),
    db.subscriber.count({ where: { status: "PENDING" } }),
    db.subscriber.count({ where: { status: { in: ["UNSUBSCRIBED", "BOUNCED", "COMPLAINED"] } } }),
    db.product.findMany({ select: { id: true, title: true } }),
    sendingQuota(),
  ]);
  const sent = new Map(
    (await db.emailMessage.groupBy({ by: ["campaignId"], where: { campaignId: { in: campaigns.map((c) => c.id) }, status: "SENT" }, _count: true })).map((g) => [g.campaignId, g._count]),
  );
  const titles = new Map(products.map((p) => [p.id, p.title]));
  return (
    <div>
      <PageHeader
        title="Newsletter"
        subtitle="Tu propia newsletter, con tu nombre y desde tu dominio."
        actions={
          <form action={createCampaign}>
            <SubmitButton className="btn btn-primary" pendingLabel="Creando…">
              <Plus className="h-4 w-4" /> Nueva newsletter
            </SubmitButton>
          </form>
        }
      />
      <NewsletterTabs current="/panel/newsletter" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Suscriptoras" value={formatNumber(confirmed)} hint={newThisMonth ? `+${formatNumber(newThisMonth)} este mes` : "Confirmadas"} accent />
        <Stat label="Sin confirmar" value={formatNumber(pending)} hint="Aún no han pulsado el email" />
        <Stat label="Bajas" value={formatNumber(unsubscribed)} hint="Bajas, rebotes y quejas" />
        <Stat
          label="Hoy puedes enviar"
          value={Number.isFinite(quota.bulk) ? formatNumber(quota.bulk) : "Sin límite"}
          hint={quota.cap > 0 ? `Límite de ${quota.cap} al día (${quota.reserve} quedan para accesos y recibos)` : "Sin límite diario configurado"}
        />
      </div>

      <h2 className="eyebrow mb-3 mt-8 !text-ink">Tus newsletters</h2>
      {campaigns.length === 0 ? (
        <div className="card p-8 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 font-semibold">Aún no has escrito ninguna</p>
          <p className="mt-1 text-sm text-muted">Pulsa «Nueva newsletter»: empiezas con un diseño sencillo que puedes cambiar desde el móvil.</p>
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {campaigns.map((c) => {
            const st = CAMPAIGN_STATUS[c.status] ?? { label: c.status, tone: "neutral" as Tone };
            const when =
              c.status === "SCHEDULED" && c.scheduledAt
                ? `Sale el ${formatDate(c.scheduledAt, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, creator.timezone)}`
                : c.startedAt
                  ? `Enviada el ${formatDate(c.startedAt, { day: "numeric", month: "long" }, creator.timezone)} · ${formatNumber(sent.get(c.id) ?? 0)} de ${peopleCount(c.recipientsCount)}`
                  : `Editada el ${formatDate(c.updatedAt, { day: "numeric", month: "long" }, creator.timezone)}`;
            return (
              <li key={c.id}>
                <Link href={`/panel/newsletter/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper">
                  {c.status === "SCHEDULED" ? <CalendarClock className="h-4 w-4 shrink-0 text-muted" /> : <Mail className="h-4 w-4 shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.subject || "Sin asunto"}</span>
                    <span className="block truncate text-xs text-muted">
                      {segmentLabel(c.segment, titles)} · {when}
                    </span>
                  </span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
