import { Bell, BellRing, CalendarCheck, GraduationCap, Heart, HeartHandshake, Hourglass, KeyRound, Mail, MailCheck, MessageCircle, Moon, PenLine, Receipt, ShoppingBag, Sparkles, UserMinus, UserPlus, type LucideIcon } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { SubmitButton } from "@/components/ui/submit-button";
import Link from "next/link";
import { AUTOMATIONS, automationDefaultOn, type AutomationTrigger } from "@/lib/automations";
import { DELAY_FIELDS, EDITABLE_EMAILS, visibleAutomations } from "@/lib/automation-catalog";
import { planFeatures } from "@/lib/plans";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { formatDateTime } from "@/lib/tz";
import { Badge, Locked } from "../ui";
import { saveAutomation } from "./actions";
import { Tr } from "@/lib/i18n/client";

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

const GROUPS = [
  { title: "Para tus clientas", text: "Lo que les llega solo: confirmaciones, recordatorios y detalles que cuidan.", audiences: ["Clienta", "Suscriptora"] },
  { title: "Para ti", text: "Avisos a tu correo para que no se te escape nada.", audiences: ["Tú"] },
];

const ICONS: Partial<Record<AutomationTrigger, LucideIcon>> = {
  PURCHASE_RECEIPT: Receipt,
  COURSE_ACCESS: GraduationCap,
  BOOKING_CONFIRMED: CalendarCheck,
  NEW_SUBSCRIPTION: UserPlus,
  SUBSCRIPTION_CANCELED: UserMinus,
  WELCOME: Sparkles,
  SESSION_REMINDER: Bell,
  SESSION_REMINDER_SOON: BellRing,
  ABANDONED_CHECKOUT: ShoppingBag,
  BOOKING_OWNER_NOTICE: CalendarCheck,
  ACCESS_ENDING: Hourglass,
  MEMBER_ENDED: Hourglass,
  NEW_COMMENT: MessageCircle,
  ACCESS_GRANTED: KeyRound,
  REQUEST_RECEIVED: MailCheck,
  MOON_CIRCLE_REMINDER: Moon,
  SESSION_THANKS: HeartHandshake,
  MISS_YOU: Heart,
};

/** «Sale 24 horas antes», en palabras. */
function whenText(d: { after: string; unit: number }, minutes: number) {
  const n = Math.round(minutes / d.unit);
  if (n === 0) return "Sale al momento";
  return `${d.after.endsWith("sin entrar") ? "Tras" : "Sale"} ${n} ${n === 1 ? d.after.replace(/^(minuto|hora|día)s/, "$1") : d.after}`;
}

/**
 * Los emails que salen solos (recibos, accesos, recordatorios, avisos para ti): encenderlos, cuándo
 * salen, escribirlos a tu manera (web personal) y los últimos enviados. En la web personal vive en
 * Newsletter › Automatizaciones; en la plataforma, en Automatizaciones del panel.
 */
export async function AutomaticEmails({ creator }: { creator: { id: string; plan: Parameters<typeof planFeatures>[0] } }) {
  const pro = planFeatures(creator.plan).automations;
  const failedNote = isPersonalMode() ? FAILED_NOTE_PERSONAL : FAILED_NOTE;
  const db = tenantDb(creator.id);
  const [rows, log] = await Promise.all([
    db.automation.findMany(),
    // Los enlaces para entrar y confirmar el email son de la plataforma, no emails de la creadora:
    // cualquiera puede pedirlos desde su página y no deben enseñarle direcciones que no son clientas.
    // La newsletter tiene su propia pantalla (y son muchos): fuera de esta lista.
    db.emailMessage.findMany({ where: { template: { notIn: ["MAGIC_LINK", "VERIFY_EMAIL", "MEMBER_POST", "NEWSLETTER", "NEWSLETTER_TEST", "NEWSLETTER_INVITE"] } }, orderBy: { sendAt: "desc" }, take: 25 }),
  ]);
  const byTrigger = new Map(rows.map((r) => [r.trigger, r]));
  return (
    <div className="space-y-8">
      {!pro && <Locked title="Automatiza tu relación con tus clientas" text="Bienvenida personalizada, recordatorios de sesión y recuperación de compras abandonadas. Los emails esenciales (compra, acceso y reservas) ya se envían en todos los planes." />}
      {GROUPS.map((g) => {
        const list = visibleAutomations(isPersonalMode()).filter((t) => g.audiences.includes(AUTOMATIONS[t].audience));
        if (!list.length) return null;
        return (
          <section key={g.title}>
            <h2 className="eyebrow mb-1 !text-ink">{g.title}</h2>
            <p className="mb-3 text-sm text-muted"><Tr s={g.text} /></p>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((t) => {
                const meta = AUTOMATIONS[t];
                const row = byTrigger.get(t);
                const enabled = meta.essential || (pro && (row ? row.enabled : automationDefaultOn(t)));
                const Icon = ICONS[t] ?? Mail;
                const delay = DELAY_FIELDS[t];
                const minutes = row?.delayMinutes ?? meta.defaultDelay;
                const writable = isPersonalMode() && !!EDITABLE_EMAILS[t];
                return (
                  <form key={t} action={saveAutomation} className={`auto-card card flex flex-col p-5 ${enabled ? "auto-card-on" : ""} ${!meta.essential && !pro ? "opacity-60" : ""}`}>
                    <input type="hidden" name="trigger" value={t} />
                    <div className="flex items-start gap-3">
                      <span className="auto-icon"><Icon className="h-5 w-5" strokeWidth={1.5} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display text-lg leading-tight"><Tr s={meta.label} /></p>
                          {meta.essential ? <Badge tone="success"><Tr s={"Siempre"} /></Badge> : enabled ? <Badge tone="success"><Tr s={"Activa"} /></Badge> : <Badge><Tr s={"Apagada"} /></Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted"><Tr s={meta.description} /></p>
                        {delay && enabled && <p className="mt-2 text-xs font-medium text-gold">✦ {whenText(delay, minutes)}</p>}
                      </div>
                    </div>
                    {(writable || pro) && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        {writable && (
                          <Link href={`/panel/newsletter/automatizaciones/emails/${t}`} className="btn btn-primary btn-sm">
                            <PenLine className="h-4 w-4" />{" "}<Tr s={"Escribir el email"} /></Link>
                        )}
                        {writable && (row?.design || row?.subject) && <Badge tone="dark"><Tr s={"Tu versión"} /></Badge>}
                        {pro && (!meta.essential || delay || !writable) && (
                          <details className="auto-settings w-full">
                            <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink"><Tr s={"Cuándo y cómo"} /></summary>
                            <div className="mt-3 space-y-3">
                              {!meta.essential && (
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" name="enabled" defaultChecked={enabled} className="accent-[#D9BF8C]" />{" "}<Tr s={"Encendida"} /></label>
                              )}
                              {meta.essential && <input type="hidden" name="enabled" value="on" />}
                              {delay && (
                                <label className="flex flex-wrap items-center gap-2 text-sm">
                                  <Tr s={delay.before} />
                                  <input type="number" name="delay" min={delay.min} max={delay.max} defaultValue={Math.round(minutes / delay.unit)} className="input h-9 w-20 text-sm" />
                                  <Tr s={delay.after} />
                                </label>
                              )}
                              {!writable && <input name="subject" defaultValue={row?.subject ?? ""} placeholder="Asunto personalizado (opcional)" className="input h-9 text-base sm:text-sm" />}
                              {!writable && (t === "WELCOME" || t === "ABANDONED_CHECKOUT") && (
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
                              <SubmitButton className="btn btn-primary btn-sm"><Tr s={"Guardar"} /></SubmitButton>
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </form>
                );
              })}
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="eyebrow mb-3 !text-ink"><Tr s={"Últimos emails"} /></h2>
        <div className="card divide-y divide-line">
          {log.map((m) => {
            // En cola tras algún intento fallido: se está reintentando, no está «programado».
            const retrying = m.status === "QUEUED" && m.attempts > 0;
            const st = retrying ? RETRYING : (STATUS[m.status] ?? { label: m.status, tone: "neutral" as Tone });
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium"><Tr s={m.subject} /></p>
                  <p className="truncate text-xs text-muted"><Tr s={m.to} /> · {formatDateTime(m.status === "SENT" && m.sentAt ? m.sentAt : m.sendAt)}</p>
                  {m.status === "FAILED" && <p className="mt-0.5 text-xs text-[#9a3a2e]"><Tr s={failedNote} /></p>}
                  {retrying && <p className="mt-0.5 text-xs text-muted"><Tr s={"El proveedor de email ha fallado; se reintenta solo ("} />{formatDateTime(m.sendAt)}).</p>}
                </div>
                <span title={m.status === "FAILED" ? failedNote : undefined}>
                  <Badge tone={st.tone}><Tr s={st.label} /></Badge>
                </span>
              </div>
            );
          })}
          {log.length === 0 && <p className="p-5 text-sm text-muted"><Tr s={"Aún no se ha enviado ningún email."} /></p>}
        </div>
      </section>
    </div>
  );
}
