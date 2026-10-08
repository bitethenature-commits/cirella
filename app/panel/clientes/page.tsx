import Link from "next/link";
import { Search, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireCreator } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { tenantDb } from "@/lib/tenant";
import { Badge, PageHeader, Stat } from "../ui";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { creator } = await requireCreator();
  const { q } = await searchParams;
  const db = tenantDb(creator.id);
  const [customers, total, subs] = await Promise.all([
    db.customer.findMany({
      where: q ? { OR: [{ email: { contains: q.toLowerCase() } }, { name: { contains: q } }] } : {},
      orderBy: { lastPurchaseAt: "desc" },
      take: 200,
      include: { subscriptions: { where: { status: "ACTIVE" }, select: { id: true } } },
    }),
    db.customer.count(),
    db.subscription.count({ where: { status: "ACTIVE" } }),
  ]);
  const ltv = customers.reduce((a, c) => a + c.totalSpentCents, 0) / Math.max(1, customers.length);
  const repeat = customers.filter((c) => c.ordersCount > 1).length;
  return (
    <div>
      <PageHeader title="Clientes" subtitle="Solo tú ves a tus clientas. Cada una tiene acceso a su área privada." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Clientas" value={total} accent />
        <Stat label="Repiten" value={repeat} hint="Más de una compra" />
        <Stat label="Gasto medio" value={formatMoney(Math.round(ltv))} />
        <Stat label="Miembros activos" value={subs} />
      </div>
      <form className="mb-4 flex max-w-sm items-center gap-2 rounded-full border border-line bg-white px-4">
        <Search className="h-4 w-4 text-muted" />
        <input name="q" defaultValue={q} placeholder="Buscar por nombre o email" className="h-10 flex-1 bg-transparent text-sm outline-none" />
      </form>
      <div className="card divide-y divide-line">
        {customers.map((c) => (
          <Link key={c.id} href={`/panel/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-paper sm:px-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand text-sm font-semibold">{(c.name ?? c.email)[0].toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.name ?? c.email}</p>
              <p className="truncate text-xs text-muted">{c.email}</p>
            </div>
            <div className="hidden sm:block">{c.subscriptions.length > 0 && <Badge tone="dark">Miembro</Badge>}</div>
            <div className="text-right text-sm">
              <p className="font-semibold tabular-nums">{formatMoney(c.totalSpentCents)}</p>
              <p className="text-xs text-muted">{c.ordersCount} {c.ordersCount === 1 ? "compra" : "compras"}</p>
            </div>
          </Link>
        ))}
      </div>
      {customers.length === 0 && <EmptyState icon={<Users className="h-5 w-5" />} title={q ? "Sin resultados" : "Aún no tienes clientas"}>Cuando alguien compre, aparecerá aquí con su historial.</EmptyState>}
    </div>
  );
}
