import Link from "next/link";
import { CalendarClock, ChevronDown, Mail, PenLine, Plus, Send } from "lucide-react";
import { LookPreview } from "@/components/email-editor/look-preview";
import { DeleteButton } from "@/components/ui/delete-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { DEFAULT_EMAIL_STYLE, readStyle } from "@/lib/email-blocks";
import { formatNumber } from "@/lib/money";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { Badge, PageHeader } from "../ui";
import { createCampaign, deleteDraft } from "./actions";
import { requireNewsletterOwner } from "./guard";
import { CAMPAIGN_STATUS, segmentLabel, type Tone } from "./labels";
import { NewsletterTabs } from "./tabs";
import { ensureStarterTemplates } from "./plantillas/seed";

export const dynamic = "force-dynamic";

/** Las newsletters, por cómo están: borradores, programadas y enviadas (con las que se están enviando). */
const FOLDERS = [
  { key: "borradores", title: "Borradores", icon: PenLine, statuses: ["DRAFT"], empty: "No tienes ningún borrador." },
  { key: "programadas", title: "Programadas", icon: CalendarClock, statuses: ["SCHEDULED"], empty: "No hay ninguna programada." },
  { key: "enviadas", title: "Enviadas", icon: Send, statuses: ["SENDING", "PAUSED", "SENT", "CANCELED"], empty: "Aún no has enviado ninguna." },
] as const;

/**
 * Portada de la newsletter: crear una nueva eligiendo su aspecto (una de tus plantillas o «En blanco»;
 * el email empieza vacío) y tus newsletters por carpetas. Las cifras están en Estadísticas.
 */
export default async function NewsletterPage() {
  const { creator } = await requireNewsletterOwner();
  await ensureStarterTemplates(creator.id);
  const db = tenantDb(creator.id);
  const [campaigns, products, myTemplates] = await Promise.all([
    db.campaign.findMany({ orderBy: [{ updatedAt: "desc" }], take: 100 }),
    db.product.findMany({ select: { id: true, title: true } }),
    db.newsletterTemplate.findMany({ select: { id: true, name: true, design: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const titles = new Map(products.map((p) => [p.id, p.title]));
  const looks = [
    ...myTemplates.map((t) => ({ id: t.id, name: t.name, value: t.id, style: readStyle((t.design as { style?: unknown } | null)?.style) })),
    { id: "blanco", name: "En blanco", value: "", style: DEFAULT_EMAIL_STYLE },
  ];
  return (
    <div>
      <PageHeader title="Newsletter" subtitle="Conecta con quien te lee y comparte lo que te inspira." />
      <NewsletterTabs current="/panel/newsletter" />

      <h2 className="mb-1 font-serif text-2xl">Crear una newsletter</h2>
      <p className="mb-5 text-sm text-muted">Elige el aspecto y empieza a escribir. El email empieza vacío; el fondo, los colores y las letras los cambias cuando quieras.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {looks.map((l) => (
          <form key={l.id} action={createCampaign}>
            <input type="hidden" name="template" value={l.value} />
            <SubmitButton className="nl-look group block w-full overflow-hidden rounded-2xl border border-line bg-white text-left transition hover:-translate-y-0.5 hover:shadow-soft">
              <LookPreview style={l.style} />
              <span className="flex items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span>
              </span>
            </SubmitButton>
          </form>
        ))}
        <Link href="/panel/newsletter/plantillas" className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted transition hover:border-ink hover:text-ink">
          <span>
            <Plus className="mx-auto mb-1.5 h-5 w-5" />
            Crear o cambiar plantillas
          </span>
        </Link>
      </div>

      {/* Tus newsletters, abajo del todo, por carpetas */}
      <h2 className="eyebrow mb-3 mt-10 !text-ink">Tus newsletters</h2>
      <div className="space-y-3">
        {FOLDERS.map((f) => {
          const list = campaigns.filter((c) => (f.statuses as readonly string[]).includes(c.status));
          const Icon = f.icon;
          return (
            <details key={f.key} className="nl-folder card overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                <span className="auto-icon !h-9 !w-9"><Icon className="h-4 w-4" strokeWidth={1.5} /></span>
                <span className="flex-1 font-display text-lg">{f.title}</span>
                <span className="text-sm text-muted">{formatNumber(list.length)}</span>
                <ChevronDown className="nl-folder-chev h-4 w-4 text-muted transition" />
              </summary>
              {list.length === 0 ? (
                <p className="border-t border-line px-4 py-4 text-sm text-muted">{f.empty}</p>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {list.map((c) => {
                    const st = CAMPAIGN_STATUS[c.status] ?? { label: c.status, tone: "neutral" as Tone };
                    const when =
                      c.status === "SCHEDULED" && c.scheduledAt
                        ? `Sale el ${formatDate(c.scheduledAt, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, creator.timezone)}`
                        : c.startedAt
                          ? `Enviada el ${formatDate(c.startedAt, { day: "numeric", month: "long" }, creator.timezone)}`
                          : `Editada el ${formatDate(c.updatedAt, { day: "numeric", month: "long" }, creator.timezone)}`;
                    return (
                      <li key={c.id} className="flex items-center pr-2">
                        <Link href={`/panel/newsletter/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 hover:bg-paper">
                          <Mail className="h-4 w-4 shrink-0 text-muted" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{c.subject || "Sin asunto"}</span>
                            <span className="block truncate text-xs text-muted">
                              {segmentLabel(c.segment, titles)} · {when}
                            </span>
                          </span>
                          {f.key === "enviadas" && <Badge tone={st.tone}>{st.label}</Badge>}
                        </Link>
                        <DeleteButton
                          action={deleteDraft}
                          id={c.id}
                          what={c.subject || "Sin asunto"}
                          message={c.status === "DRAFT" ? "¿Borrar este borrador? No se puede deshacer." : c.status === "SCHEDULED" ? "¿Borrar esta newsletter programada? Ya no saldrá. No se puede deshacer." : c.status === "SENDING" || c.status === "PAUSED" ? "¿Borrar esta newsletter? Lo que falta por salir ya no sale. No se puede deshacer." : "¿Borrar esta newsletter con sus estadísticas? No se puede deshacer."}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}
