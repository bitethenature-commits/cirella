import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { formatNumber } from "@/lib/money";
import { SOURCE_LABEL, STATUS_LABEL, type SubscriberSource, type SubscriberStatus } from "@/lib/newsletter-rules";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { Badge, PageHeader, PersonDot } from "../../ui";
import { requireNewsletterOwner } from "../guard";
import { STATUS_TONE } from "../labels";
import { NewsletterTabs } from "../tabs";
import { deleteSubscriber } from "./actions";

export const dynamic = "force-dynamic";

const PAGE = 50;

/** Suscriptoras: el listado (estado, alta y origen), con un buscador por email. Cada una abre su ficha. */
export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const { creator } = await requireNewsletterOwner();
  const sp = await searchParams;
  const db = tenantDb(creator.id);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.p) || 1);
  const where = q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {};
  const [rows, total, counts] = await Promise.all([
    db.subscriber.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    db.subscriber.count({ where }),
    db.subscriber.groupBy({ by: ["status"], _count: true }),
  ]);
  const byStatus = new Map(counts.map((c) => [c.status, c._count]));
  const day = (d: Date) => formatDate(d, { day: "numeric", month: "short", year: "numeric" }, creator.timezone);
  const href = (p: number) => `/panel/newsletter/suscriptoras?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { p: String(p) } : {}) })}`;
  return (
    <div>
      <PageHeader title="Suscriptoras" subtitle={`${formatNumber(byStatus.get("CONFIRMED") ?? 0)} confirmadas · ${formatNumber(byStatus.get("PENDING") ?? 0)} sin confirmar`} />
      <NewsletterTabs current="/panel/newsletter/suscriptoras" />

      <form className="relative mb-4 max-w-md" action="/panel/newsletter/suscriptoras">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input name="q" type="search" defaultValue={q} placeholder="Buscar por email" aria-label="Buscar por email" className="input h-11 pl-9 text-base sm:text-sm" />
      </form>

      <div className="card overflow-x-auto" data-testid="subscriber-list">
        <table className="nl-table w-full min-w-[36rem] text-sm">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Estado</th>
              <th>Alta</th>
              <th>Origen</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/panel/newsletter/suscriptoras/${s.id}`} className="flex min-w-0 items-center gap-2.5">
                    <PersonDot name={s.name} email={s.email} className="h-8 w-8 shrink-0 text-xs" />
                    <span className="min-w-0">
                      <span className="block max-w-[16rem] truncate font-medium">{s.name || s.email}</span>
                      {s.name && <span className="block max-w-[16rem] truncate text-xs text-muted">{s.email}</span>}
                    </span>
                  </Link>
                </td>
                <td><Badge tone={STATUS_TONE[s.status as SubscriberStatus] ?? "neutral"}>{STATUS_LABEL[s.status as SubscriberStatus] ?? s.status}</Badge></td>
                <td className="whitespace-nowrap text-muted">{day(s.createdAt)}</td>
                <td className="whitespace-nowrap text-muted">{SOURCE_LABEL[s.source as SubscriberSource] ?? s.source}</td>
                <td>
                  <span className="flex items-center justify-end gap-1">
                    <DeleteButton action={deleteSubscriber} id={s.id} what={s.email} message={`¿Borrar a ${s.email} de tu lista, sin dejar rastro? No se puede deshacer.`} />
                    <Link href={`/panel/newsletter/suscriptoras/${s.id}`} aria-label={`Ver la ficha de ${s.email}`} className="text-muted hover:text-ink">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  {q ? "Nadie con ese email." : "Aún no tienes suscriptoras. Activa la sección «Newsletter» en Mi página para que se apunten."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="btn btn-outline btn-sm">Anteriores</Link> : <span />}
          <span className="text-muted">Página {page} de {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total ? <Link href={href(page + 1)} className="btn btn-outline btn-sm">Siguientes</Link> : <span />}
        </div>
      )}
    </div>
  );
}
