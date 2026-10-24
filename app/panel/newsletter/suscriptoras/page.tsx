import Link from "next/link";
import { Download, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatNumber } from "@/lib/money";
import { subscriberTags } from "@/lib/newsletter";
import { SOURCE_LABEL, STATUS_LABEL, SUBSCRIBER_SOURCES, SUBSCRIBER_STATUSES, type SubscriberSource, type SubscriberStatus } from "@/lib/newsletter-rules";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { Badge, PageHeader } from "../../ui";
import { requireNewsletterOwner } from "../guard";
import { NewsletterTabs } from "../tabs";
import { deleteSubscriber, ownerUnsubscribe, resendConfirmationAction, updateTags } from "./actions";
import { AddSubscriberForm, ImportPanel } from "./forms";

export const dynamic = "force-dynamic";

const PAGE = 50;
const TONE: Record<SubscriberStatus, "success" | "warning" | "neutral" | "danger"> = {
  CONFIRMED: "success",
  PENDING: "warning",
  UNSUBSCRIBED: "neutral",
  BOUNCED: "danger",
  COMPLAINED: "danger",
};

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; etiqueta?: string; origen?: string; p?: string }> }) {
  const { creator } = await requireNewsletterOwner();
  const sp = await searchParams;
  const db = tenantDb(creator.id);
  const status = (SUBSCRIBER_STATUSES as readonly string[]).includes(sp.estado ?? "") ? (sp.estado as SubscriberStatus) : null;
  const source = (SUBSCRIBER_SOURCES as readonly string[]).includes(sp.origen ?? "") ? (sp.origen as SubscriberSource) : null;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.p) || 1);
  const where: Prisma.SubscriberWhereInput = {
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(sp.etiqueta ? { tags: { has: sp.etiqueta } } : {}),
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total, counts, tags] = await Promise.all([
    db.subscriber.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    db.subscriber.count({ where }),
    db.subscriber.groupBy({ by: ["status"], _count: true }),
    subscriberTags(creator.id),
  ]);
  const byStatus = new Map(counts.map((c) => [c.status, c._count]));
  const fmt = (d: Date | null) => (d ? formatDate(d, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }, creator.timezone) : "—");
  const qs = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const cur = { q: q || null, estado: status, etiqueta: sp.etiqueta ?? null, origen: source, ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) u.set(k, v);
    const s = u.toString();
    return `/panel/newsletter/suscriptoras${s ? `?${s}` : ""}`;
  };
  return (
    <div>
      <PageHeader
        title="Suscriptoras"
        subtitle={`${formatNumber(byStatus.get("CONFIRMED") ?? 0)} confirmadas · ${formatNumber(byStatus.get("PENDING") ?? 0)} sin confirmar`}
        actions={
          <a href="/panel/newsletter/suscriptoras/exportar" className="btn btn-outline btn-sm">
            <Download className="h-4 w-4" /> Exportar CSV
          </a>
        }
      />
      <NewsletterTabs current="/panel/newsletter/suscriptoras" />

      <div className="grid gap-3 lg:grid-cols-2">
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Añadir a mano</summary>
          <div className="mt-3"><AddSubscriberForm /></div>
        </details>
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Importar CSV</summary>
          <div className="mt-3"><ImportPanel /></div>
        </details>
      </div>

      <form className="mt-5 flex flex-wrap items-end gap-2" action="/panel/newsletter/suscriptoras">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Buscar por email o nombre" aria-label="Buscar" className="input h-11 pl-9 text-base sm:text-sm" />
        </div>
        <select name="estado" defaultValue={status ?? ""} aria-label="Estado" className="input h-11 w-auto text-base sm:text-sm">
          <option value="">Todos los estados</option>
          {SUBSCRIBER_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]} ({byStatus.get(s) ?? 0})</option>
          ))}
        </select>
        {tags.length > 0 && (
          <select name="etiqueta" defaultValue={sp.etiqueta ?? ""} aria-label="Etiqueta" className="input h-11 w-auto text-base sm:text-sm">
            <option value="">Todas las etiquetas</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <select name="origen" defaultValue={source ?? ""} aria-label="Origen" className="input h-11 w-auto text-base sm:text-sm">
          <option value="">Cualquier origen</option>
          {SUBSCRIBER_SOURCES.map((s) => (
            <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
          ))}
        </select>
        <button className="btn btn-outline h-11">Filtrar</button>
      </form>

      <ul className="card mt-4 divide-y divide-line" data-testid="subscriber-list">
        {rows.map((s) => (
          <li key={s.id}>
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.email}</span>
                  <span className="block truncate text-xs text-muted">
                    {[s.name, SOURCE_LABEL[s.source as SubscriberSource] ?? s.source, ...s.tags.map((t) => `#${t}`)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Badge tone={TONE[s.status as SubscriberStatus] ?? "neutral"}>{STATUS_LABEL[s.status as SubscriberStatus] ?? s.status}</Badge>
              </summary>
              <div className="space-y-3 border-t border-line bg-paper/60 px-4 py-3 text-xs">
                <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-muted">Consentimiento</dt>
                  <dd>{fmt(s.consentAt)}</dd>
                  <dt className="text-muted">Texto aceptado</dt>
                  <dd>{s.consentText ?? "—"}</dd>
                  <dt className="text-muted">Desde</dt>
                  <dd>{(s.consentMeta as { form?: string } | null)?.form ?? "—"}{s.sourceRef ? ` · ${s.sourceRef}` : ""}</dd>
                  <dt className="text-muted">Confirmó</dt>
                  <dd>{fmt(s.confirmedAt)}</dd>
                  {s.unsubscribedAt && (
                    <>
                      <dt className="text-muted">Baja</dt>
                      <dd>{fmt(s.unsubscribedAt)}{s.unsubscribeVia ? ` (${s.unsubscribeVia === "OWNER" ? "la diste tú" : s.unsubscribeVia === "BOUNCE" ? "rebote" : s.unsubscribeVia === "COMPLAINT" ? "queja" : "ella"})` : ""}</dd>
                    </>
                  )}
                </dl>
                <form action={updateTags} className="flex gap-2">
                  <input type="hidden" name="id" value={s.id} />
                  <input name="tags" defaultValue={s.tags.join(", ")} aria-label={`Etiquetas de ${s.email}`} placeholder="Etiquetas, separadas por comas" className="input h-10 min-w-0 flex-1 text-base sm:text-sm" />
                  <SubmitButton className="btn btn-outline btn-sm">Guardar</SubmitButton>
                </form>
                <div className="flex flex-wrap gap-2">
                  {s.status === "PENDING" && (
                    <form action={resendConfirmationAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <SubmitButton className="btn btn-outline btn-sm">Reenviar confirmación</SubmitButton>
                    </form>
                  )}
                  {(s.status === "CONFIRMED" || s.status === "PENDING") && (
                    <ConfirmForm action={ownerUnsubscribe} message={`¿Dar de baja a ${s.email}? No volverá a recibir tu newsletter salvo que se apunte otra vez.`}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn btn-outline btn-sm">Dar de baja</button>
                    </ConfirmForm>
                  )}
                  <ConfirmForm action={deleteSubscriber} message={`¿Borrar a ${s.email} para siempre? Se pierde también la prueba de su consentimiento y de su baja. Úsalo si te pide que borres sus datos.`}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn btn-ghost btn-sm text-rose">Borrar definitivamente</button>
                  </ConfirmForm>
                </div>
              </div>
            </details>
          </li>
        ))}
        {rows.length === 0 && <li className="p-5 text-sm text-muted">{q || status || source || sp.etiqueta ? "Nadie con estos filtros." : "Aún no tienes suscriptoras. Activa la sección «Newsletter» en Mi página para que se apunten."}</li>}
      </ul>
      {total > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={qs({ p: String(page - 1) })} className="btn btn-outline btn-sm">Anteriores</Link> : <span />}
          <span className="text-muted">Página {page} de {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total ? <Link href={qs({ p: String(page + 1) })} className="btn btn-outline btn-sm">Siguientes</Link> : <span />}
        </div>
      )}
    </div>
  );
}
