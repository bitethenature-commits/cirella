import Link from "next/link";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireCreator } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { rangeStart, parseRange } from "@/lib/stats";
import { tenantDb } from "@/lib/tenant";
import { ORDER_STATUS_LABEL, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { Badge, PageHeader, RangeTabs, Stat } from "../ui";

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { PAID: "success", PENDING: "warning", FAILED: "danger", ABANDONED: "neutral", REFUNDED: "neutral" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ rango?: string; estado?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const range = parseRange(sp.rango);
  const since = rangeStart(range, creator.timezone);
  const db = tenantDb(creator.id);
  const status = sp.estado === "todos" ? undefined : sp.estado === "abandonados" ? { in: ["ABANDONED", "PENDING", "FAILED"] } : "PAID";
  const orders = await db.order.findMany({
    where: { ...(status ? { status } : {}), ...(since ? { createdAt: { gte: since } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { product: { select: { emoji: true } } },
  });
  const paid = orders.filter((o) => o.status === "PAID");
  const gross = paid.reduce((a, o) => a + o.amountCents, 0);
  const fees = paid.reduce((a, o) => a + o.platformFeeCents, 0);
  const filters = [
    ["pagados", "Pagados"],
    ["abandonados", "Sin completar"],
    ["todos", "Todos"],
  ];
  const current = sp.estado ?? "pagados";
  return (
    <div>
      <PageHeader title="Ventas" subtitle="Cada pedido, su comisión y lo que recibes." actions={<RangeTabs current={range} base="/panel/ventas" />} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ingresos brutos" value={formatMoney(gross)} accent />
        <Stat label="Comisión plataforma" value={formatMoney(fees, "EUR", { decimals: true })} hint={`Plan ${creator.plan.name}`} />
        <Stat label="Recibes" value={formatMoney(gross - fees, "EUR", { decimals: true })} />
        <Stat label="Pedidos" value={paid.length} />
      </div>
      <div className="mb-4 flex gap-1.5">
        {filters.map(([k, l]) => (
          <Link key={k} href={`/panel/ventas?rango=${range}&estado=${k}`} className={`rounded-full px-3 py-1.5 text-sm ${current === k ? "bg-ink text-cream" : "bg-sand text-muted hover:text-ink"}`}>
            {l}
          </Link>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.7fr_0.8fr] gap-4 border-b border-line bg-paper px-5 py-2.5 text-xs font-semibold text-muted md:grid">
          <span>Producto</span><span>Cliente</span><span>Fecha</span><span className="text-right">Importe</span><span className="text-right">Recibes</span><span className="text-right">Estado</span>
        </div>
        <ul className="divide-y divide-line">
          {orders.map((o) => (
            <li key={o.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3.5 text-sm md:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.7fr_0.8fr] md:items-center md:px-5">
              <span className="min-w-0 truncate font-medium">{o.product.emoji} {o.productTitle}<span className="block text-xs font-normal text-muted md:hidden">{o.buyerName ?? o.buyerEmail} · {o.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span></span>
              <span className="hidden min-w-0 truncate text-muted md:block">{o.customerId ? <Link className="hover:text-ink" href={`/panel/clientes/${o.customerId}`}>{o.buyerName ?? o.buyerEmail}</Link> : o.buyerEmail}</span>
              <span className="hidden text-muted md:block">{o.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="text-right font-semibold tabular-nums">{formatMoney(o.amountCents, o.currency, { decimals: true })}</span>
              <span className="hidden text-right tabular-nums text-muted md:block">{o.status === "PAID" ? formatMoney(o.netCents, o.currency, { decimals: true }) : "—"}</span>
              <span className="col-span-2 flex justify-start md:col-span-1 md:justify-end"><Badge tone={TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge><span className="ml-2 text-xs text-faint md:hidden">{PRODUCT_TYPE_LABEL[o.productType as ProductType]}</span></span>
            </li>
          ))}
        </ul>
        {orders.length === 0 && <div className="p-6"><EmptyState icon={<Receipt className="h-5 w-5" />} title="Sin pedidos en este periodo" /></div>}
      </div>
      {current === "abandonados" && <p className="mt-3 text-xs text-muted">Los pedidos que se quedan a medias más de una hora reciben automáticamente un email de recuperación si tienes activa esa automatización.</p>}
    </div>
  );
}
