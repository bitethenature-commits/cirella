import { CheckCircle2, CircleAlert } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { sendingQuota } from "@/lib/email/outbox";
import { appUrl, env } from "@/lib/env";
import { formatNumber } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/tz";
import { PageHeader, Stat } from "../../ui";
import { requireNewsletterOwner } from "../guard";
import { NewsletterTabs } from "../tabs";
import { saveSendingLimits } from "./actions";

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

/** Cómo sale la newsletter: remitente, límite diario de Resend, webhook de rebotes y quejas. */
export default async function NewsletterSendingPage() {
  const { user } = await requireNewsletterOwner();
  const e = env();
  const [quota, settings, lastEvent] = await Promise.all([
    sendingQuota(),
    getSettings(),
    prisma.emailMessage.findFirst({ where: { OR: [{ deliveredAt: { not: null } }, { bouncedAt: { not: null } }] }, orderBy: { deliveredAt: "desc" }, select: { deliveredAt: true, bouncedAt: true } }),
  ]);
  const resend = e.EMAIL_PROVIDER === "resend";
  const webhook = `${appUrl()}/api/webhooks/resend`;
  return (
    <div>
      <PageHeader title="Envío" subtitle="Desde dónde sale tu newsletter y cuánto puede salir cada día." />
      <NewsletterTabs current="/panel/newsletter/ajustes" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Enviados en 24 h" value={formatNumber(quota.sentLast24h)} hint="Todos los emails cuentan" />
        <Stat label="Límite diario" value={quota.cap > 0 ? formatNumber(quota.cap) : "Sin límite"} hint={settings.emailDailyCap === null ? "Automático" : "Elegido por ti"} />
        <Stat label="Hoy caben" value={Number.isFinite(quota.bulk) ? formatNumber(quota.bulk) : "Sin límite"} hint={`de newsletter (${quota.reserve} reservados)`} />
      </div>
      <ul className="card mt-5 divide-y divide-line">
        <Row ok={resend} title={resend ? "Se envía con Resend" : "Buzón de demostración"}>
          {resend ? "Tus emails salen de verdad por Resend." : "Los emails no salen: se ven en el buzón de demostración (/dev/correo)."}
        </Row>
        <Row ok={!!e.EMAIL_FROM} title="Remitente de la newsletter">
          {e.NEWSLETTER_FROM ? <>Sale desde <strong>{e.NEWSLETTER_FROM}</strong> (NEWSLETTER_FROM).</> : e.EMAIL_FROM ? <>Sale desde <strong>{e.EMAIL_FROM}</strong>, el mismo que tus emails de acceso (puedes separarla con NEWSLETTER_FROM).</> : "Sin configurar."}{" "}
          Las respuestas llegan a tu email de contacto.
        </Row>
        <Row ok={!!e.RESEND_WEBHOOK_SECRET} title="Rebotes y quejas (webhook de Resend)">
          {e.RESEND_WEBHOOK_SECRET ? (
            <>Activado. {lastEvent ? `Último aviso: ${formatDateTime((lastEvent.deliveredAt ?? lastEvent.bouncedAt)!)}.` : "Aún no ha llegado ningún aviso."}</>
          ) : (
            <>Sin activar: las direcciones que no existen no se dan de baja solas. En Resend › Webhooks crea uno con esta dirección y los eventos delivered, bounced y complained, y pon su «Signing secret» en RESEND_WEBHOOK_SECRET.</>
          )}
          <span className="mt-1.5 flex items-center gap-2">
            <code className="truncate rounded bg-sand px-1.5 py-0.5 text-ink">{webhook}</code>
            <CopyButton text={webhook} label="Copiar" className="btn btn-outline btn-sm" />
          </span>
        </Row>
      </ul>
      {user.isAdmin && (
        <form action={saveSendingLimits} className="card mt-5 space-y-3 p-4">
          <p className="text-sm font-semibold">Límite diario</p>
          <p className="text-xs text-muted">
            El plan gratuito de Resend permite 100 emails al día y 3000 al mes (contando todos). Si pasas a un plan de pago, sube el límite (0 = sin límite). La reserva queda siempre para los
            emails de acceso, recibos y enlaces para entrar.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="cap">Emails al día</label>
              <input id="cap" name="cap" type="number" min={0} defaultValue={settings.emailDailyCap ?? quota.cap} className="input h-11 text-base" />
            </div>
            <div>
              <label className="field-label" htmlFor="reserve">Reserva para transaccionales</label>
              <input id="reserve" name="reserve" type="number" min={0} defaultValue={settings.emailTransactionalReserve} className="input h-11 text-base" />
            </div>
          </div>
          <SubmitButton className="btn btn-primary btn-sm">Guardar</SubmitButton>
        </form>
      )}
      <p className="mt-4 text-xs text-muted">Los pasos para tu dominio (united-domains) y Resend están en la guía de tu web: «Tu newsletter».</p>
    </div>
  );
}
