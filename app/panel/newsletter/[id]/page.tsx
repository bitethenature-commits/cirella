import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { readDesign } from "@/lib/email-blocks";
import { brandPalette, brandSocials } from "@/lib/email-starters";
import { appUrl } from "@/lib/env";
import { sendingQuota } from "@/lib/email/outbox";
import { formatNumber } from "@/lib/money";
import { etaDays, parseSegment, peopleCount } from "@/lib/newsletter-rules";
import { footerMessage } from "@/lib/email/newsletter-templates";
import { brandName } from "@/lib/newsletter";
import { campaignStats, renderCampaignFor } from "@/lib/newsletter-send";
import { getSettings } from "@/lib/settings";
import { clicksByLink, prettyLink } from "@/lib/newsletter-stats";
import { tenantDb } from "@/lib/tenant";
import { tzCity } from "@/lib/timezones";
import { dateKeyInTz, formatDate } from "@/lib/tz";
import { EmailPreview } from "@/components/email-editor/email-preview";
import { Badge, PageHeader } from "../../ui";
import { cancelCampaignAction, deleteDraft, duplicateCampaign, pauseCampaignAction, resumeCampaignAction } from "../actions";
import { requireNewsletterOwner } from "../guard";
import { CAMPAIGN_STATUS, segmentLabel } from "../labels";
import { CampaignEditor } from "./campaign-editor";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  const { creator, user } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const c = await db.campaign.findFirst({ where: { id } });
  if (!c) notFound();
  const products = await db.product.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { createdAt: "asc" } });
  const fromTemplate = c.templateId ? await db.newsletterTemplate.findFirst({ where: { id: c.templateId }, select: { id: true, name: true } }) : null;
  const { newsletterFooterText } = await getSettings();
  const st = CAMPAIGN_STATUS[c.status] ?? { label: c.status, tone: "neutral" as const };
  const back = (
    <Link href="/panel/newsletter" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Newsletter"} /></Link>
  );
  const fmt = (d: Date) => formatDate(d, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }, creator.timezone);

  if (c.status === "DRAFT" || c.status === "SCHEDULED") {
    const tomorrow = dateKeyInTz(new Date(Date.now() + 86_400_000), creator.timezone);
    return (
      <div>
        {back}
        <PageHeader
          title={c.status === "SCHEDULED" ? t("Newsletter programada") : t("Nueva newsletter")}
          subtitle={fromTemplate ? <><Tr s={"Hecha con tu plantilla"} />{" "}<Link href={`/panel/newsletter/plantillas/${fromTemplate.id}`} className="underline underline-offset-2">«{fromTemplate.name}»</Link><Tr s={". Es una copia: lo que cambies aquí no toca la plantilla."} /></> : undefined}
          actions={
            <div className="flex gap-2">
              <form action={duplicateCampaign}>
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton className="btn btn-outline btn-sm"><Tr s={"Duplicar"} /></SubmitButton>
              </form>
              {(
                <ConfirmForm action={deleteDraft} message={c.status === "DRAFT" ? t("¿Borrar este borrador? No se puede deshacer.") : t("¿Borrar esta newsletter programada? Ya no saldrá. No se puede deshacer.")} className="inline">
                  <input type="hidden" name="id" value={c.id} />
                  <button className="btn btn-ghost btn-sm text-rose"><Tr s={"Borrar"} /></button>
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
          testTo={(creator.contactEmail || user.email).toLowerCase()}
          palette={brandPalette(creator.pageDraft, creator.displayName)}
          socials={brandSocials(creator.pageDraft, creator.displayName)}
          siteUrl={`${appUrl()}/`}
          brand={creator.displayName}
          footerMessage={footerMessage(newsletterFooterText, brandName(creator))}
        />
      </div>
    );
  }

  const [stats, quota, links] = await Promise.all([campaignStats(creator.id, c.id), sendingQuota(), clicksByLink(creator.id, [c.id], 15)]);
  const maxLink = links[0]?.clicks ?? 1;
  const done = stats.sent + stats.failed;
  const pct = stats.recipients ? Math.round((done / stats.recipients) * 100) : 100;
  const remaining = stats.pending + stats.queued;
  const perDay = quota.cap > 0 ? Math.max(1, quota.cap - quota.reserve) : Infinity;
  const days = etaDays(remaining, perDay);
  const mail = renderCampaignFor(c, creator, { id: null, name: "Laura" }, { message: newsletterFooterText });
  const titles = new Map(products.map((p) => [p.id, p.title]));
  return (
    <div>
      {back}
      <PageHeader title={t(c.subject || t("Sin asunto"))} subtitle={`${segmentLabel(c.segment, titles)}${c.startedAt ? ` · empezó el ${fmt(c.startedAt)}` : ""}`} actions={
        <div className="flex items-center gap-2">
          <Badge tone={st.tone}><Tr s={st.label} /></Badge>
          <ConfirmForm action={deleteDraft} message={c.status === "SENDING" || c.status === "PAUSED" ? t("¿Borrar esta newsletter? Lo que falta por salir ya no sale. No se puede deshacer.") : t("¿Borrar esta newsletter con sus estadísticas? No se puede deshacer.")} className="inline">
            <input type="hidden" name="id" value={c.id} />
            <button className="btn btn-ghost btn-sm text-rose"><Tr s={"Borrar"} /></button>
          </ConfirmForm>
        </div>
      } />
      <div className="card p-5">
        <div className="flex items-center justify-between text-sm">
          <span><Tr s={"Enviadas"} />{" "}<strong data-testid="sent-count">{formatNumber(stats.sent)}</strong>{" "}<Tr s={"de"} />{" "}{peopleCount(stats.recipients)}
          </span>
          <span className="text-muted">{pct} %</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
        </div>
        {(c.status === "SENDING" || c.status === "PAUSED") && remaining > 0 && (
          <p className="mt-2 text-xs text-muted">
            {c.status === "PAUSED"
              ? t("En pausa: no sale ninguna más hasta que la reanudes.")
              : days <= 1
                ? t("Las que faltan salen en los próximos minutos.")
                : `Faltan ${peopleCount(remaining)}: con tu límite diario terminará en ${days} días. Sigue sola cada día.`}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {c.status === "SENDING" && (
            <form action={pauseCampaignAction}>
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton className="btn btn-outline btn-sm"><Tr s={"Pausar"} /></SubmitButton>
            </form>
          )}
          {c.status === "PAUSED" && (
            <form action={resumeCampaignAction}>
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton className="btn btn-primary btn-sm"><Tr s={"Reanudar"} /></SubmitButton>
            </form>
          )}
          {(c.status === "SENDING" || c.status === "PAUSED") && (
            <ConfirmForm action={cancelCampaignAction} message={t("¿Cancelar el envío? Las que aún no la han recibido ya no la recibirán.")} className="inline">
              <input type="hidden" name="id" value={c.id} />
              <button className="btn btn-ghost btn-sm text-rose"><Tr s={"Cancelar el envío"} /></button>
            </ConfirmForm>
          )}
          <form action={duplicateCampaign}>
            <input type="hidden" name="id" value={c.id} />
            <SubmitButton className="btn btn-outline btn-sm"><Tr s={"Duplicar"} /></SubmitButton>
          </form>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        <span data-testid="unsub-count">{formatNumber(stats.unsubscribed)}</span> {stats.unsubscribed === 1 ? t("persona se dio") : t("personas se dieron")}{" "}<Tr s={"de baja desde esta newsletter."} />{stats.skipped > 0 && ` ${peopleCount(stats.skipped)} se saltaron porque se dieron de baja antes de recibirla.`}
      </p>

      {links.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="mb-1 font-serif text-xl"><Tr s={"Enlaces más tocados"} /></h2>
          <p className="mb-4 text-xs text-muted"><Tr s={"Personas distintas que hicieron clic en cada enlace (sin contar el de baja)."} /></p>
            <ul className="space-y-3">
              {links.map((l) => (
                <li key={l.link}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <a href={l.link} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate hover:underline" title={t(l.link)}>{prettyLink(l.link)}</a>
                    <span className="shrink-0 tabular-nums text-muted">{formatNumber(l.clicks)}</span>
                  </div>
                  <div className="nl-bar mt-1"><span style={{ width: `${Math.max(4, (l.clicks / maxLink) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
        </section>
      )}

      <h2 className="eyebrow mb-3 mt-8 !text-ink"><Tr s={"Cómo salió"} /></h2>
      <EmailPreview html={mail.html} subject={mail.subject} />
    </div>
  );
}
