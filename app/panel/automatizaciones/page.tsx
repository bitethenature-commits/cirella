import { Mail } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { AUTOMATIONS, automationDefaultOn, type AutomationTrigger } from "@/lib/automations";
import { planFeatures } from "@/lib/plans";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { formatDateTime } from "@/lib/tz";
import { Badge, Locked, PageHeader } from "../ui";
import { saveAutomation } from "./actions";

type Tone = "success" | "warning" | "neutral" | "danger";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  SENT: { label: "Enviado", tone: "success" },
  QUEUED: { label: "Programado", tone: "warning" },
  SENDING: { label: "Enviando", tone: "warning" },
  CANCELED: { label: "Cancelado", tone: "neutral" },
  FAILED: { label: "No entregado", tone: "danger" },
};

const RETRYING = { label: "Reintentando", tone: "warning" as Tone };
const FAILED_NOTE = "No se pudo entregar: la dirección lo rechazó o falló 6 veces seguidas. El equipo de Cirella ya está avisado.";
// Web personal: no hay equipo de la plataforma detrás; queda en Envíos fallidos para revisarlo.
const FAILED_NOTE_PERSONAL = "No se pudo entregar: la dirección lo rechazó o falló 6 veces seguidas. Ha quedado registrado para revisarlo.";

export default async function AutomationsPage() {
  const { creator } = await requireCreator();
  const pro = planFeatures(creator.plan).automations;
  const failedNote = isPersonalMode() ? FAILED_NOTE_PERSONAL : FAILED_NOTE;
  const db = tenantDb(creator.id);
  const [rows, log] = await Promise.all([
    db.automation.findMany(),
    // Los enlaces para entrar y confirmar el email son de la plataforma, no emails de la creadora:
    // cualquiera puede pedirlos desde su página y no deben enseñarle direcciones que no son clientas.
    db.emailMessage.findMany({ where: { template: { notIn: ["MAGIC_LINK", "VERIFY_EMAIL", "MEMBER_POST"] } }, orderBy: { sendAt: "desc" }, take: 25 }),
  ]);
  const byTrigger = new Map(rows.map((r) => [r.trigger, r]));
  return (
    <div className="space-y-8">
      <PageHeader title="Automatizaciones" subtitle="Emails que se envían solos en el momento justo." />
      {!pro && <Locked title="Automatiza tu relación con tus clientas" text="Bienvenida personalizada, recordatorios de sesión y recuperación de compras abandonadas. Los emails esenciales (compra, acceso y reservas) ya se envían en todos los planes." />}
      <div className="grid gap-3 md:grid-cols-2">
        {(Object.keys(AUTOMATIONS) as AutomationTrigger[]).map((t) => {
          const meta = AUTOMATIONS[t];
          const row = byTrigger.get(t);
          const enabled = meta.essential || (pro && (row ? row.enabled : automationDefaultOn(t)));
          const editable = pro;
          return (
            <form key={t} action={saveAutomation} className={`card flex flex-col p-5 ${!meta.essential && !pro ? "opacity-60" : ""}`}>
              <input type="hidden" name="trigger" value={t} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{meta.description} · Para: {meta.audience}</p>
                </div>
                {meta.essential ? <Badge tone="success">Siempre activa</Badge> : enabled ? <Badge tone="success">Activa</Badge> : <Badge>Desactivada</Badge>}
              </div>
              {editable && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink">Personalizar</summary>
                  <div className="mt-3 space-y-2.5">
                    {!meta.essential && (
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={enabled} className="accent-[#0E1024]" /> Activada</label>
                    )}
                    {(t === "WELCOME" || t === "SESSION_REMINDER" || t === "SESSION_REMINDER_SOON" || t === "ABANDONED_CHECKOUT") && (
                      <label className="flex items-center gap-2 text-sm">
                        {t === "SESSION_REMINDER" || t === "SESSION_REMINDER_SOON" ? "Enviar" : "Esperar"}
                        <input type="number" name="delayMinutes" min={t === "SESSION_REMINDER_SOON" ? 5 : 0} defaultValue={row?.delayMinutes ?? meta.defaultDelay} className="input h-9 w-24 text-sm" />
                        {t === "SESSION_REMINDER" || t === "SESSION_REMINDER_SOON" ? "minutos antes" : "minutos"}
                      </label>
                    )}
                    <input name="subject" defaultValue={row?.subject ?? ""} placeholder="Asunto personalizado (opcional)" className="input h-9 text-base sm:text-sm" />
                    {(t === "WELCOME" || t === "ABANDONED_CHECKOUT") && (
                      <RichTextEditor
                        name="message"
                        ariaLabel="Tu mensaje"
                        formatName="messageFormat"
                        defaultValue={row?.message ?? ""}
                        initialFormat={row?.messageFormat ?? null}
                        maxLength={2000}
                        tools="basic"
                        tone="account"
                        legacy="links"
                        rows={3}
                        placeholder="Tu mensaje (opcional)"
                      />
                    )}
                    <SubmitButton className="btn btn-primary btn-sm">Guardar</SubmitButton>
                  </div>
                </details>
              )}
            </form>
          );
        })}
      </div>

      <section>
        <h2 className="eyebrow mb-3 !text-ink">Últimos emails</h2>
        <div className="card divide-y divide-line">
          {log.map((m) => {
            // En cola tras algún intento fallido: se está reintentando, no está «programado».
            const retrying = m.status === "QUEUED" && m.attempts > 0;
            const st = retrying ? RETRYING : (STATUS[m.status] ?? { label: m.status, tone: "neutral" as Tone });
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.subject}</p>
                  <p className="truncate text-xs text-muted">{m.to} · {formatDateTime(m.status === "SENT" && m.sentAt ? m.sentAt : m.sendAt)}</p>
                  {m.status === "FAILED" && <p className="mt-0.5 text-xs text-[#9a3a2e]">{failedNote}</p>}
                  {retrying && <p className="mt-0.5 text-xs text-muted">El proveedor de email ha fallado; se reintenta solo ({formatDateTime(m.sendAt)}).</p>}
                </div>
                <span title={m.status === "FAILED" ? failedNote : undefined}>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </span>
              </div>
            );
          })}
          {log.length === 0 && <p className="p-5 text-sm text-muted">Aún no se ha enviado ningún email.</p>}
        </div>
      </section>
    </div>
  );
}
