import Link from "next/link";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { Badge, PageHeader } from "../../panel/ui";
import { setCreatorPlan, setCreatorStatus } from "../actions";
import { AdminTable, td } from "../ui";

export default async function AdminCreators({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [creators, plans, gmv] = await Promise.all([
    prisma.creator.findMany({
      where: sp.q ? { OR: [{ username: { contains: sp.q.toLowerCase() } }, { displayName: { contains: sp.q } }] } : {},
      orderBy: { createdAt: "desc" },
      include: { plan: true, user: { select: { email: true } }, category: true, _count: { select: { products: true, customers: true } } },
    }),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.order.groupBy({ by: ["creatorId"], where: { status: "PAID" }, _sum: { amountCents: true, platformFeeCents: true } }),
  ]);
  const g = new Map(gmv.map((x) => [x.creatorId, x._sum]));
  return (
    <div>
      <PageHeader title="Creadoras" subtitle={`${creators.length} espacios`} />
      <Flash ok={sp.ok} />
      <form className="mb-4"><input name="q" defaultValue={sp.q} placeholder="Buscar por nombre o usuario" className="input h-10 max-w-xs text-sm" /></form>
      <AdminTable head={["Creadora", "Categoría", "Plan", "Productos", "Clientes", "GMV / comisión", "Estado", "Acciones"]} minWidth={1000}>
        {creators.map((c) => (
          <tr key={c.id}>
            <td className={td}>
              <Link href={`/${c.username}`} target="_blank" className="font-semibold hover:underline">{c.displayName}</Link>
              <span className="block text-xs text-muted">/{c.username} · {c.user.email}</span>
            </td>
            <td className={`${td} text-muted`}>{c.category ? `${c.category.emoji ?? ""} ${c.category.name}` : "—"}</td>
            <td className={td}>
              <form action={setCreatorPlan} className="flex items-center gap-1">
                <input type="hidden" name="id" value={c.id} />
                <select name="planId" defaultValue={c.planId} className="input h-8 w-28 text-xs">
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm !h-8 !px-2 text-xs">OK</button>
              </form>
            </td>
            <td className={td}>{c._count.products}</td>
            <td className={td}>{c._count.customers}</td>
            <td className={`${td} tabular-nums`}>{formatMoney(g.get(c.id)?.amountCents ?? 0)}<span className="block text-xs text-muted">{formatMoney(g.get(c.id)?.platformFeeCents ?? 0, "EUR", { decimals: true })}</span></td>
            <td className={td}>
              {c.status === "BLOCKED" ? <Badge tone="danger">Bloqueada</Badge> : c.published ? <Badge tone="success">Publicada</Badge> : <Badge tone="warning">Sin publicar</Badge>}
            </td>
            <td className={`${td} text-right`}>
              <form action={setCreatorStatus}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="status" value={c.status === "BLOCKED" ? "ACTIVE" : "BLOCKED"} />
                <button className={`btn btn-sm ${c.status === "BLOCKED" ? "btn-outline" : "btn-danger"}`}>{c.status === "BLOCKED" ? "Reactivar" : "Bloquear"}</button>
              </form>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
