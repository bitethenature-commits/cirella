import Link from "next/link";
import { CalendarClock, ChevronDown, Copy, Mail, PenLine, Plus, Send } from "lucide-react";
import { LookPreview } from "@/components/email-editor/look-preview";
import { ConfirmForm } from "@/components/ui/confirm-form";
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
import { createTemplate, deleteTemplate, duplicateTemplate, startFromTemplate } from "./plantillas/actions";
import { ensureStarterTemplates } from "./plantillas/seed";

export const dynamic = "force-dynamic";

/** Las newsletters, por cómo están: programadas, enviadas (con las que se están enviando) y borradores. */
const FOLDERS = [
  { key: "programadas", title: "Programadas", icon: CalendarClock, statuses: ["SCHEDULED"], empty: "No hay ninguna programada." },
  { key: "enviadas", title: "Enviadas", icon: Send, statuses: ["SENDING", "PAUSED", "SENT", "CANCELED"], empty: "Aún no has enviado ninguna." },
  { key: "borradores", title: "Borradores", icon: PenLine, statuses: ["DRAFT"], empty: "No tienes ningún borrador." },
] as const;

/**
 * La pestaña Newsletter, de arriba abajo: tus newsletters por carpetas (programadas, enviadas y borradores),
 * crear una nueva eligiendo su aspecto (una de tus plantillas o «En blanco»; el email empieza vacío) y, abajo,
 * tus plantillas. Las suscriptoras están en Personas y las cifras, en Estadísticas.
 */
export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { creator } = await requireNewsletterOwner();
  const sp = await searchParams;
  await ensureStarterTemplates(creator.id);
  const db = tenantDb(creator.id);
  const [campaigns, products, myTemplates] = await Promise.all([
    db.campaign.findMany({ orderBy: [{ updatedAt: "desc" }], take: 100 }),
    db.product.findMany({ select: { id: true, title: true } }),
    db.newsletterTemplate.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { campaigns: true } } } }),
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
      {sp.aviso && (
        <p role="status" className="mb-4 rounded-xl bg-[#e7f3ec] px-4 py-3 text-sm text-[#2f6b4a]">
          {sp.aviso.slice(0, 200)}
        </p>
      )}

      {/* Tus newsletters, arriba del todo, por carpetas */}
      <h2 className="eyebrow mb-3 !text-ink">Tus newsletters</h2>
      <div className="space-y-3">
        {FOLDERS.map((f) => {
          const list = campaigns.filter((c) => (f.statuses as readonly string[]).includes(c.status));
          const Icon = f.icon;
          return (
            <details key={f.key} className="nl-folder card overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                <span className="auto-icon !h-9 !w-9">
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </span>
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
                          message={
                            c.status === "DRAFT"
                              ? "¿Borrar este borrador? No se puede deshacer."
                              : c.status === "SCHEDULED"
                                ? "¿Borrar esta newsletter programada? Ya no saldrá. No se puede deshacer."
                                : c.status === "SENDING" || c.status === "PAUSED"
                                  ? "¿Borrar esta newsletter? Lo que falta por salir ya no sale. No se puede deshacer."
                                  : "¿Borrar esta newsletter con sus estadísticas? No se puede deshacer."
                          }
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

      {/* Crear una newsletter */}
      <h2 className="mb-1 mt-12 font-serif text-2xl">Crear una newsletter</h2>
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
      </div>

      {/* Tus plantillas, abajo del todo */}
      <section id="plantillas" className="mt-12 scroll-mt-20">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h2 className="flex-1 font-serif text-2xl">Plantillas</h2>
          <form action={createTemplate}>
            <SubmitButton className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" /> Nueva plantilla
            </SubmitButton>
          </form>
        </div>
        <p className="mb-5 text-sm text-muted">El aspecto de tus newsletters: fondo con geometría, colores, burbujas y letras. Todas son tuyas: cámbialas o bórralas cuando quieras. Las newsletters ya hechas con ellas no cambian.</p>
        {myTemplates.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">No tienes plantillas. Crea una con «Nueva plantilla».</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {myTemplates.map((t) => (
              <div key={t.id} className="card flex flex-col overflow-hidden">
                <Link href={`/panel/newsletter/plantillas/${t.id}`} aria-label={`Editar ${t.name}`}>
                  <LookPreview style={readStyle((t.design as { style?: unknown } | null)?.style)} />
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <p className="truncate font-serif text-lg">{t.name}</p>
                  {t._count.campaigns > 0 && (
                    <p className="text-xs text-muted">
                      Usada en {t._count.campaigns} newsletter{t._count.campaigns === 1 ? "" : "s"}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={startFromTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton className="btn btn-primary btn-sm">
                        <Send className="h-4 w-4" /> Usar
                      </SubmitButton>
                    </form>
                    <Link href={`/panel/newsletter/plantillas/${t.id}`} className="btn btn-outline btn-sm">
                      <PenLine className="h-4 w-4" /> Editar
                    </Link>
                    <form action={duplicateTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton className="btn btn-ghost btn-sm">
                        <Copy className="h-4 w-4" /> Duplicar
                      </SubmitButton>
                    </form>
                    <ConfirmForm action={deleteTemplate} message={`¿Borrar la plantilla «${t.name}»? No se puede deshacer. Las newsletters hechas con ella no cambian.`}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="btn btn-ghost btn-sm text-rose">Borrar</button>
                    </ConfirmForm>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
