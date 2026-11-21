import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/money";
import { PageHeader } from "../../../ui";
import { requireNewsletterOwner } from "../../guard";
import { blockEmail } from "../actions";
import { BlockedList } from "../blocked-list";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;
const KINDS: Record<string, { label: string; via?: string[] }> = {
  todos: { label: "Todos" },
  rebotes: { label: "Rebotes", via: ["BOUNCE"] },
  spam: { label: "Spam", via: ["COMPLAINT"] },
  mano: { label: "Bloqueados por ti", via: ["BLOCK"] },
};

/** Todas las direcciones bloqueadas, con buscador, filtro por motivo y páginas. */
export default async function BlockedPage({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; p?: string }> }) {
  const sp = await searchParams;
  const { creator } = await requireNewsletterOwner();
  const q = (sp.q ?? "").trim().toLowerCase();
  const tipo = KINDS[sp.tipo ?? ""] ? sp.tipo! : "todos";
  const page = Math.max(1, Number(sp.p) || 1);
  const where = {
    creatorId: creator.id,
    status: { in: ["BOUNCED", "COMPLAINED"] },
    ...(q ? { email: { contains: q } } : {}),
    ...(KINDS[tipo].via ? { unsubscribeVia: { in: KINDS[tipo].via } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.subscriber.count({ where }),
    prisma.subscriber.findMany({ where, orderBy: { unsubscribedAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, email: true, unsubscribeVia: true, unsubscribedAt: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (o: { tipo?: string; p?: number }) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    const t = o.tipo ?? tipo;
    if (t !== "todos") u.set("tipo", t);
    if (o.p && o.p > 1) u.set("p", String(o.p));
    const s = u.toString();
    return `/panel/newsletter/ajustes/bloqueados${s ? `?${s}` : ""}`;
  };
  return (
    <div>
      <Link href="/panel/newsletter/ajustes" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Ajustes mail
      </Link>
      <PageHeader title="Bloqueados" subtitle="No reciben tu newsletter ni tus automatizaciones. Los rebotes y el spam llegan solos con el webhook de Resend." />
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-full bg-sand p-1 text-sm">
          {Object.entries(KINDS).map(([k, v]) => (
            <Link key={k} href={href({ tipo: k })} aria-current={k === tipo ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 font-medium ${k === tipo ? "bg-white shadow-soft" : "text-muted"}`}>
              {v.label}
            </Link>
          ))}
        </div>
        <form className="ml-auto flex gap-2">
          {tipo !== "todos" && <input type="hidden" name="tipo" value={tipo} />}
          <input name="q" defaultValue={q} placeholder="Buscar email" className="input h-10 w-56 text-base sm:text-sm" aria-label="Buscar email" />
          <button className="btn btn-outline btn-sm">Buscar</button>
        </form>
      </div>
      <p className="mt-3 text-sm text-muted">{formatNumber(total)} {total === 1 ? "dirección" : "direcciones"}</p>
      {rows.length ? <BlockedList rows={rows} /> : <p className="card mt-3 p-5 text-sm text-muted">No hay ninguna{q ? " con esa búsqueda" : ""}.</p>}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={href({ p: page - 1 })} className="btn btn-outline btn-sm">Anterior</Link>}
          <span className="text-muted">Página {page} de {pages}</span>
          {page < pages && <Link href={href({ p: page + 1 })} className="btn btn-outline btn-sm">Siguiente</Link>}
        </div>
      )}
      <form action={blockEmail} className="card mt-5 flex flex-wrap items-center gap-2 p-4">
        <p className="w-full text-sm font-semibold">Bloquear una dirección</p>
        <input name="email" type="email" required placeholder="email@ejemplo.com" className="input h-10 min-w-0 flex-1 text-base sm:text-sm" aria-label="Email que quieres bloquear" />
        <SubmitButton className="btn btn-outline btn-sm">Bloquear</SubmitButton>
      </form>
    </div>
  );
}
