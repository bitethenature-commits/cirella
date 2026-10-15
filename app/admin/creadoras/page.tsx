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
    // Neto de reembolsos: lo vendido menos lo devuelto (los pedidos REFUNDED suman 0).
    prisma.order.groupBy({
      by: ["creatorId"],
      where: { status: { in: ["PAID", "REFUNDED"] } },
      _sum: { amountCents: true, platformFeeCents: true, refundedCents: true, refundedFeeCents: true },
    }),
    prisma.creator.groupBy({ by: ["payoutStatus"], _count: { _all: true } }),
  ]);
  const funnelCount = new Map(funnel.map((f) => [f.payoutStatus, f._count._all]));
  const g = new Map(
    gmv.map((x) => [
      x.creatorId,
      {
        amountCents: (x._sum.amountCents ?? 0) - (x._sum.refundedCents ?? 0),
        platformFeeCents: (x._sum.platformFeeCents ?? 0) - (x._sum.refundedFeeCents ?? 0),
      },
    ]),
  );
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
      {/* Cabe en 1280 px (área de ~984 px junto a la barra lateral): datos secundarios bajo el nombre,
          productos y clientes juntos, estado y cobros en la misma columna. Más estrecho, se desplaza
          dentro de su propia caja. */}
      <AdminTable head={["Creadora", "Plan", "Productos / clientes", "GMV / comisión", "Estado y cobros", "Acciones"]} minWidth={860}>
        {creators.map((c) => (
          <tr key={c.id}>
            <td className={td}>
              <div className="max-w-[16rem]">
                <Link href={`/${c.username}`} target="_blank" className="font-semibold hover:underline">{c.displayName}</Link>
                <span className="block break-all text-xs text-muted">/{c.username} · {c.user.email}</span>
                {c.category && <span className="block text-xs text-muted">{`${c.category.emoji ?? ""} ${c.category.name}`.trim()}</span>}
              </div>
            </td>
            <td className={td}>
              <form action={setCreatorPlan} className="flex items-center gap-1">
                <input type="hidden" name="id" value={c.id} />
                <select name="planId" defaultValue={c.planId} aria-label={`Plan de ${c.displayName}`} className="input h-8 w-24 text-xs">
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm !h-8 !px-2 text-xs">OK</button>
              </form>
            </td>
            <td className={`${td} whitespace-nowrap tabular-nums`}>
              {c._count.products}
              <span className="text-muted"> · {c._count.customers}</span>
            </td>
            <td className={`${td} whitespace-nowrap tabular-nums`}>{formatMoney(g.get(c.id)?.amountCents ?? 0)}<span className="block text-xs text-muted">{formatMoney(g.get(c.id)?.platformFeeCents ?? 0, "EUR", { decimals: true })}</span></td>
            <td className={td}>
              <div className="flex flex-col items-start gap-1">
                {c.status === "BLOCKED" ? <Badge tone="danger">Bloqueada</Badge> : c.published ? <Badge tone="success">Publicada</Badge> : <Badge tone="warning">Sin publicar</Badge>}
                <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                  <span>Cobros</span>
                  <Badge tone={PAYOUT_TONE[c.payoutStatus as PayoutStatus] ?? "neutral"}>{PAYOUT_STATUS_LABEL[c.payoutStatus] ?? c.payoutStatus}</Badge>
                  {c.payoutStatusUpdatedAt && <span className="whitespace-nowrap">{formatDate(c.payoutStatusUpdatedAt)}</span>}
                </span>
              </div>
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
