import { Mail } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCreator } from "@/lib/auth";
import { AUTOMATIONS, type AutomationTrigger } from "@/lib/automations";
import { planFeatures } from "@/lib/plans";
import { tenantDb } from "@/lib/tenant";
import { formatDateTime } from "@/lib/tz";
import { Badge, Locked, PageHeader } from "../ui";
import { saveAutomation } from "./actions";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  SENT: { label: "Enviado", tone: "success" },
  QUEUED: { label: "Programado", tone: "warning" },
  CANCELED: { label: "Cancelado", tone: "neutral" },
  FAILED: { label: "Error", tone: "danger" },
};

export default async function AutomationsPage() {
  const { creator } = await requireCreator();
  const pro = planFeatures(creator.plan).automations;
  const db = tenantDb(creator.id);
  const [rows, log] = await Promise.all([
    db.automation.findMany(),
    db.emailMessage.findMany({ orderBy: { sendAt: "desc" }, take: 25 }),
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
          const enabled = meta.essential || (pro && (row ? row.enabled : true));
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
                    {(t === "WELCOME" || t === "SESSION_REMINDER" || t === "ABANDONED_CHECKOUT") && (
                      <label className="flex items-center gap-2 text-sm">
                        {t === "SESSION_REMINDER" ? "Enviar" : "Esperar"}
                        <input type="number" name="delayMinutes" min={0} defaultValue={row?.delayMinutes ?? meta.defaultDelay} className="input h-9 w-24 text-sm" />
                        {t === "SESSION_REMINDER" ? "minutos antes" : "minutos"}
                      </label>
                    )}
                    <input name="subject" defaultValue={row?.subject ?? ""} placeholder="Asunto personalizado (opcional)" className="input h-9 text-sm" />
                    {(t === "WELCOME" || t === "ABANDONED_CHECKOUT") && (
                      <textarea name="message" defaultValue={row?.message ?? ""} rows={3} placeholder="Tu mensaje (opcional)" className="input text-sm" />
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
          {log.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.subject}</p>
                <p className="truncate text-xs text-muted">{m.to} · {formatDateTime(m.status === "SENT" && m.sentAt ? m.sentAt : m.sendAt)}</p>
              </div>
              <Badge tone={STATUS[m.status]?.tone}>{STATUS[m.status]?.label ?? m.status}</Badge>
            </div>
          ))}
          {log.length === 0 && <p className="p-5 text-sm text-muted">Aún no se ha enviado ningún email.</p>}
        </div>
      </section>
    </div>
  );
}
