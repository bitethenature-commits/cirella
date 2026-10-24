import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { readDesign } from "@/lib/email-blocks";
import { sendingQuota } from "@/lib/email/outbox";
import { formatNumber } from "@/lib/money";
import { subscriberTags } from "@/lib/newsletter";
import { etaDays, parseSegment, peopleCount } from "@/lib/newsletter-rules";
import { campaignStats, renderCampaignFor } from "@/lib/newsletter-send";
import { tenantDb } from "@/lib/tenant";
import { tzCity } from "@/lib/timezones";
import { dateKeyInTz, formatDate } from "@/lib/tz";
import { EmailPreview } from "@/components/email-editor/email-preview";
import { Badge, PageHeader, Stat } from "../../ui";
import { cancelCampaignAction, deleteDraft, duplicateCampaign, pauseCampaignAction, resumeCampaignAction } from "../actions";
import { requireNewsletterOwner } from "../guard";
import { CAMPAIGN_STATUS, segmentLabel } from "../labels";
import { CampaignEditor } from "./campaign-editor";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator, user } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const c = await db.campaign.findFirst({ where: { id } });
  if (!c) notFound();
  const products = await db.product.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { createdAt: "asc" } });
  const st = CAMPAIGN_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
  const back = (
    <Link href="/panel/newsletter" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> Newsletter
    </Link>
  );
  const fmt = (d: Date) => formatDate(d, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }, creator.timezone);

  if (c.status === "DRAFT" || c.status === "SCHEDULED") {
    const tags = await subscriberTags(creator.id);
    const tomorrow = dateKeyInTz(new Date(Date.now() + 86_400_000), creator.timezone);
    return (
      <div>
        {back}
        <PageHeader
          title={c.status === "SCHEDULED" ? "Newsletter programada" : "Nueva newsletter"}
          actions={
            <div className="flex gap-2">
              <form action={duplicateCampaign}>
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton className="btn btn-outline btn-sm">Duplicar</SubmitButton>
              </form>
              {c.status === "DRAFT" && (
                <ConfirmForm action={deleteDraft} message="¿Borrar este borrador? No se puede deshacer." className="inline">
                  <input type="hidden" name="id" value={c.id} />
                  <button className="btn btn-ghost btn-sm text-rose">Borrar</button>
                </ConfirmForm>
              )}
            </div>
          }
        />
        <CampaignEditor
          id={c.id}
          version={c.version}
          status={c.status}
          subject={c.subject}
          preheader={c.preheader ?? ""}
          design={readDesign(c.design) ?? { v: 1, blocks: [] }}
          segment={parseSegment(c.segment)}
          scheduledLabel={c.scheduledAt ? fmt(c.scheduledAt) : null}
          defaultDate={c.scheduledAt ? dateKeyInTz(c.scheduledAt, creator.timezone) : tomorrow}
          defaultTime={c.scheduledAt ? formatDate(c.scheduledAt, { hour: "2-digit", minute: "2-digit", hour12: false }, creator.timezone) : "10:00"}
          timezoneLabel={tzCity(creator.timezone)}
          products={products}
          tags={tags}
          testTo={(creator.contactEmail || user.email).toLowerCase()}
        />
      </div>
    );
  }

  const [stats, quota] = await Promise.all([campaignStats(creator.id, c.id), sendingQuota()]);
  const done = stats.sent + stats.failed;
  const pct = stats.recipients ? Math.round((done / stats.recipients) * 100) : 100;
  const remaining = stats.pending + stats.queued;
  const perDay = quota.cap > 0 ? Math.max(1, quota.cap - quota.reserve) : Infinity;
  const days = etaDays(remaining, perDay);
  const mail = renderCampaignFor(c, creator, { id: null, name: "Laura" });
  const titles = new Map(products.map((p) => [p.id, p.title]));
  const rate = (n: number) => (stats.sent ? ` · ${Math.round((n / stats.sent) * 100)} %` : "");
  return (
    <div>
      {back}
      <PageHeader title={c.subject || "Sin asunto"} subtitle={`${segmentLabel(c.segment, titles)}${c.startedAt ? ` · empezó el ${fmt(c.startedAt)}` : ""}`} actions={<Badge tone={st.tone}>{st.label}</Badge>} />
      <div className="card p-5">
        <div className="flex items-center justify-between text-sm">
          <span>
            Enviadas <strong data-testid="sent-count">{formatNumber(stats.sent)}</strong> de {peopleCount(stats.recipients)}
          </span>
          <span className="text-muted">{pct} %</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
        </div>
        {(c.status === "SENDING" || c.status === "PAUSED") && remaining > 0 && (
          <p className="mt-2 text-xs text-muted">
            {c.status === "PAUSED"
              ? "En pausa: no sale ninguna más hasta que la reanudes."
              : days <= 1
                ? "Las que faltan salen en los próximos minutos."
                : `Faltan ${peopleCount(remaining)}: con tu límite diario terminará en ${days} días. Sigue sola cada día.`}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {c.status === "SENDING" && (
            <form action={pauseCampaignAction}>
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton className="btn btn-outline btn-sm">Pausar</SubmitButton>
            </form>
          )}
          {c.status === "PAUSED" && (
            <form action={resumeCampaignAction}>
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton className="btn btn-primary btn-sm">Reanudar</SubmitButton>
            </form>
          )}
          {(c.status === "SENDING" || c.status === "PAUSED") && (
            <ConfirmForm action={cancelCampaignAction} message="¿Cancelar el envío? Las que aún no la han recibido ya no la recibirán." className="inline">
              <input type="hidden" name="id" value={c.id} />
              <button className="btn btn-ghost btn-sm text-rose">Cancelar el envío</button>
            </ConfirmForm>
          )}
          <form action={duplicateCampaign}>
            <input type="hidden" name="id" value={c.id} />
            <SubmitButton className="btn btn-outline btn-sm">Duplicar</SubmitButton>
          </form>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Entregadas" value={formatNumber(stats.delivered)} hint={stats.delivered || stats.sent === 0 ? `Lo confirma Resend${rate(stats.delivered)}` : "Sin datos del webhook de Resend"} />
        <Stat label="Rebotadas" value={formatNumber(stats.bounced + stats.failed)} hint="No existe o no la acepta" />
        <Stat label="Quejas" value={formatNumber(stats.complained)} hint="La marcaron como spam" />
        <Stat label="Bajas" value={<span data-testid="unsub-count">{formatNumber(stats.unsubscribed)}</span>} hint={`Desde esta newsletter${rate(stats.unsubscribed)}`} />
      </div>
      {(stats.opened > 0 || stats.clicked > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Aperturas" value={formatNumber(stats.opened)} hint={`Aproximadas${rate(stats.opened)}`} />
          <Stat label="Clics" value={formatNumber(stats.clicked)} hint={rate(stats.clicked).slice(3) || undefined} />
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Aperturas y clics: no se miden por defecto (necesitan el consentimiento de quien lee y Apple Mail las falsea). Si los activas en Resend, aparecerán aquí.
        {stats.skipped > 0 && ` ${peopleCount(stats.skipped)} se saltaron porque se dieron de baja antes de recibirla.`}
      </p>

      <h2 className="eyebrow mb-3 mt-8 !text-ink">Cómo salió</h2>
      <EmailPreview html={mail.html} subject={mail.subject} />
    </div>
  );
}
