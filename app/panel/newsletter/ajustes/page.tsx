import { CheckCircle2, CircleAlert, ShieldBan } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/ui/copy-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { sendingQuota } from "@/lib/email/outbox";
import { appUrl, env } from "@/lib/env";
import { formatNumber } from "@/lib/money";
import { parseFromAddress } from "@/lib/reliability";
import { domainApiAvailable } from "@/lib/sending-domain";
import { bounceHealth, complaintHealth, type Health } from "@/lib/sending-rules";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/tz";
import { PageHeader, Stat } from "../../ui";
import { requireNewsletterOwner } from "../guard";
import { NewsletterTabs } from "../tabs";
import { defaultFooterMessage } from "@/lib/email/newsletter-templates";
import { brandName } from "@/lib/newsletter";
import { blockEmail, saveFooterText, saveSendingLimits } from "./actions";
import { BlockedList } from "./blocked-list";
import { DomainCard, SenderForm, TestEmail } from "./sending-client";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

function Row({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 px-4 py-3.5 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f6b4a]" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6420]" />}
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <div className="mt-0.5 text-xs text-muted">{children}</div>
      </div>
    </li>
  );
}

const TONE = { ok: "nl-rel-real", wait: "nl-rel-aprox", bad: "nl-rel-bad", none: "nl-rel-none" } as const;

function HealthBox({ title, rate, count, h }: { title: string; rate: number; count: number; h: Health }) {
  return (
    <div className="rounded-2xl bg-sand/60 p-4">
      <div className="flex items-center gap-2">
        <span className="nl-dot" data-tone={h.tone} aria-hidden />
        <p className="text-sm font-semibold">{title}</p>
        <span className={`nl-rel ml-auto ${TONE[h.tone]}`}><Tr s={h.label} /></span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{rate.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %</p>
      <p className="text-xs text-muted">{formatNumber(count)}{" "}<Tr s={"en 30 días"} /></p>
      <p className="mt-2 text-xs text-muted"><Tr s={h.text} /></p>
    </div>
  );
}


/** Cómo sale la newsletter: dominio, remitente, prueba, salud, bloqueados y límite diario. */
export default async function NewsletterSendingPage() {
  const t = await getT();
  const { user, creator } = await requireNewsletterOwner();
  const e = env();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const newsWhere = { creatorId: creator.id, stream: "news", status: "SENT", sentAt: { gte: since } };
  const blockedWhere = { creatorId: creator.id, status: { in: ["BOUNCED", "COMPLAINED"] } };
  const [quota, settings, lastEvent, sent, bounced, complained, blockedCount, blocked] = await Promise.all([
    sendingQuota(),
    getSettings(),
    prisma.emailMessage.findFirst({ where: { OR: [{ deliveredAt: { not: null } }, { bouncedAt: { not: null } }] }, orderBy: { deliveredAt: "desc" }, select: { deliveredAt: true, bouncedAt: true } }),
    prisma.emailMessage.count({ where: newsWhere }),
    prisma.emailMessage.count({ where: { ...newsWhere, bouncedAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...newsWhere, complainedAt: { not: null } } }),
    prisma.subscriber.count({ where: blockedWhere }),
    prisma.subscriber.findMany({ where: blockedWhere, orderBy: { unsubscribedAt: "desc" }, take: 5, select: { id: true, email: true, unsubscribeVia: true, unsubscribedAt: true } }),
  ]);
  const resend = e.EMAIL_PROVIDER === "resend";
  const webhook = `${appUrl()}/api/webhooks/resend`;
  const domain = settings.sendingDomain;
  const configured = e.NEWSLETTER_FROM || e.EMAIL_FROM;
  const fallback = {
    name: creator.displayName,
    address: configured ? parseFromAddress(configured).address : "la dirección de la web",
    replyTo: (creator.contactEmail || user.email).toLowerCase(),
  };
  const bRate = sent ? (bounced / sent) * 100 : 0;
  const cRate = sent ? (complained / sent) * 100 : 0;
  return (
    <div>
      <PageHeader title={t("Ajustes mail")} subtitle={t("Desde dónde sale tu newsletter, cómo llega y cuánto puede salir cada día.")} />
      <NewsletterTabs current="/panel/newsletter/ajustes" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={t("Enviados en 24 h")} value={formatNumber(quota.sentLast24h)} hint={t("Todos los emails cuentan")} />
        <Stat label={t("Límite diario")} value={quota.cap > 0 ? formatNumber(quota.cap) : "Sin límite"} hint={settings.emailDailyCap === null ? t("Automático") : t("Elegido por ti")} />
        <Stat label={t("Hoy caben")} value={Number.isFinite(quota.bulk) ? formatNumber(quota.bulk) : "Sin límite"} hint={`de newsletter (${quota.reserve} reservados)`} />
      </div>

      <div className="mt-5 space-y-5">
        <DomainCard domain={domain} demo={!domainApiAvailable()} canEdit={user.isAdmin} />
        <SenderForm initial={settings.newsSender} domain={domain?.name ?? null} verified={domain?.status === "verified"} fallback={fallback} canEdit={user.isAdmin} />
        <TestEmail defaultTo={fallback.replyTo} />

        {user.isAdmin && (
          <form action={saveFooterText} className="card space-y-3 p-4 sm:p-5">
            <div>
              <p className="font-semibold"><Tr s={"Mensaje del pie"} /></p>
              <p className="mt-0.5 text-sm text-muted"><Tr s={"Sale al final de todas tus newsletters. Detrás van siempre solos el enlace «Darme de baja» y tus datos: esos no se pueden quitar."} /></p>
            </div>
            <input type="hidden" name="default" value={defaultFooterMessage(brandName(creator))} />
            <textarea name="text" rows={3} maxLength={400} defaultValue={settings.newsletterFooterText || defaultFooterMessage(brandName(creator))} className="input min-h-24 py-2.5 text-base sm:text-sm" aria-label={t("Mensaje del pie")} />
            <p className="text-xs text-muted"><Tr s={"Si lo dejas vacío, sale el de siempre."} /></p>
            <SubmitButton className="btn btn-primary btn-sm"><Tr s={"Guardar el mensaje"} /></SubmitButton>
          </form>
        )}

        <section className="card p-4 sm:p-5">
          <p className="font-semibold"><Tr s={"Salud del envío"} /></p>
          <p className="mt-0.5 text-sm text-muted"><Tr s={"De tus"} />{" "}{formatNumber(sent)}{" "}<Tr s={"emails de newsletter y automatizaciones de los últimos 30 días."} />{" "}
            {!e.RESEND_WEBHOOK_SECRET && t("Sin el webhook de Resend (abajo) no se saben los rebotes ni las quejas.")}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <HealthBox title={t("Rebotes")} rate={bRate} count={bounced} h={bounceHealth(bRate, sent)} />
            <HealthBox title={t("Marcados como spam")} rate={cRate} count={complained} h={complaintHealth(cRate, sent)} />
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldBan className="h-5 w-5 text-muted" />
            <p className="font-semibold"><Tr s={"Bloqueados"} /></p>
            <span className="text-sm text-muted">({formatNumber(blockedCount)})</span>
            {blockedCount > 0 && (
              <Link href="/panel/newsletter/ajustes/bloqueados" className="btn btn-outline btn-sm ml-auto"><Tr s={"Ver todos"} /></Link>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted"><Tr s={"Direcciones que rebotaron, que te marcaron como spam o que bloqueaste tú. No reciben la newsletter ni las automatizaciones."} /></p>
          {blocked.length > 0 && <BlockedList rows={blocked} />}
          <form action={blockEmail} className="mt-3 flex flex-wrap gap-2">
            <input name="email" type="email" required placeholder={t("email@ejemplo.com")} className="input h-10 min-w-0 flex-1 text-base sm:text-sm" aria-label={t("Email que quieres bloquear")} />
            <SubmitButton className="btn btn-outline btn-sm"><Tr s={"Bloquear"} /></SubmitButton>
          </form>
        </section>

        <ul className="card divide-y divide-line">
          <Row ok={resend} title={resend ? t("Se envía con Resend") : t("Buzón de demostración")}>
            {resend ? t("Tus emails salen de verdad por Resend.") : t("Los emails no salen: se ven en el buzón de demostración (/dev/email).")}
          </Row>
          <Row ok={!!e.RESEND_WEBHOOK_SECRET} title={t("Rebotes y quejas (webhook de Resend)")}>
            {e.RESEND_WEBHOOK_SECRET ? (
              <><Tr s={"Activado."} />{" "}{lastEvent ? `Último aviso: ${formatDateTime((lastEvent.deliveredAt ?? lastEvent.bouncedAt)!)}.` : t("Aún no ha llegado ningún aviso.")}</>
            ) : (
              <><Tr s={"Sin activar: las direcciones que no existen no se bloquean solas. En Resend › Webhooks crea uno con esta dirección y los eventos delivered, bounced, complained, opened y clicked, y pon su «Signing secret» en RESEND_WEBHOOK_SECRET."} /></>
            )}
            <span className="mt-1.5 flex items-center gap-2">
              <code className="truncate rounded bg-sand px-1.5 py-0.5 text-ink">{webhook}</code>
              <CopyButton text={t(webhook)} label={t("Copiar")} className="btn btn-outline btn-sm" />
            </span>
          </Row>
        </ul>

        {user.isAdmin && (
          <form action={saveSendingLimits} className="card space-y-3 p-4">
            <p className="text-sm font-semibold"><Tr s={"Límite diario"} /></p>
            <p className="text-xs text-muted"><Tr s={"El plan gratuito de Resend permite 100 emails al día y 3000 al mes (contando todos). Si pasas a un plan de pago, sube el límite (0 = sin límite). La reserva queda siempre para los emails de acceso, recibos y enlaces para entrar."} /></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="cap"><Tr s={"Emails al día"} /></label>
                <input id="cap" name="cap" type="number" min={0} defaultValue={settings.emailDailyCap ?? quota.cap} className="input h-11 text-base" />
              </div>
              <div>
                <label className="field-label" htmlFor="reserve"><Tr s={"Reserva para transaccionales"} /></label>
                <input id="reserve" name="reserve" type="number" min={0} defaultValue={settings.emailTransactionalReserve} className="input h-11 text-base" />
              </div>
            </div>
            <SubmitButton className="btn btn-primary btn-sm"><Tr s={"Guardar"} /></SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
