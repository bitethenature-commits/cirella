import Link from "next/link";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PAYOUT_STATUSES, type PayoutStatus } from "@/lib/payouts";
import { formatDate } from "@/lib/tz";
import { PAYOUT_STATUS_LABEL } from "@/lib/types";
import { Badge, PageHeader } from "../../panel/ui";
import { setCreatorPlan, setCreatorStatus } from "../actions";
import { AdminTable, td } from "../ui";

const PAYOUT_TONE: Record<PayoutStatus, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  VERIFYING: "warning",
  PENDING: "warning",
  ACTION_REQUIRED: "danger",
  REJECTED: "danger",
  NONE: "neutral",
};

/** Orden del embudo de alta de cobros: dónde se quedan las creadoras. */
const FUNNEL: [PayoutStatus, string][] = [
  ["ACTIVE", "activadas"],
  ["VERIFYING", "verificando"],
  ["ACTION_REQUIRED", "falta algo"],
  ["PENDING", "pendientes"],
  ["NONE", "sin conectar"],
  ["REJECTED", "rechazadas"],
];

export default async function AdminCreators({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; cobros?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const payoutFilter = (PAYOUT_STATUSES as string[]).includes(sp.cobros ?? "") ? sp.cobros : undefined;
  const [creators, plans, gmv, funnel] = await Promise.all([
    prisma.creator.findMany({
      where: {
        ...(sp.q ? { OR: [{ username: { contains: sp.q, mode: "insensitive" as const } }, { displayName: { contains: sp.q, mode: "insensitive" as const } }] } : {}),
        ...(payoutFilter ? { payoutStatus: payoutFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true, user: { select: { email: true } }, category: true, _count: { select: { products: true, customers: true } } },
    }),
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.order.groupBy({ by: ["creatorId"], where: { status: "PAID" }, _sum: { amountCents: true, platformFeeCents: true } }),
    prisma.creator.groupBy({ by: ["payoutStatus"], _count: { _all: true } }),
  ]);
  const funnelCount = new Map(funnel.map((f) => [f.payoutStatus, f._count._all]));
  const g = new Map(gmv.map((x) => [x.creatorId, x._sum]));
  return (
    <div>
      <PageHeader title="Creadoras" subtitle={`${creators.length} espacios`} />
      <Flash ok={sp.ok} />
      <p className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
        <span className="font-semibold text-ink">Cobros:</span>
        {FUNNEL.map(([status, label], i) => (
          <span key={status}>
            <Link href={`/admin/creadoras?cobros=${status}`} className={`underline-offset-4 hover:underline ${payoutFilter === status ? "font-semibold text-ink" : ""}`}>
              {funnelCount.get(status) ?? 0} {label}
            </Link>
            {i < FUNNEL.length - 1 && " ·"}
          </span>
        ))}
        {payoutFilter && <Link href="/admin/creadoras" className="ml-2 text-xs underline">Quitar filtro</Link>}
      </p>
      <form className="mb-4">
        <input name="q" defaultValue={sp.q} placeholder="Buscar por nombre o usuario" className="input h-10 max-w-xs text-sm" />
        {payoutFilter && <input type="hidden" name="cobros" value={payoutFilter} />}
      </form>
      <AdminTable head={["Creadora", "Categoría", "Plan", "Productos", "Clientes", "GMV / comisión", "Cobros", "Estado", "Acciones"]} minWidth={1100}>
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
              <Badge tone={PAYOUT_TONE[c.payoutStatus as PayoutStatus] ?? "neutral"}>{PAYOUT_STATUS_LABEL[c.payoutStatus] ?? c.payoutStatus}</Badge>
              {c.payoutStatusUpdatedAt && <span className="block text-xs text-muted">{formatDate(c.payoutStatusUpdatedAt)}</span>}
            </td>
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
