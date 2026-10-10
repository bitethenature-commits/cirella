import Link from "next/link";
import { Download, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireCreator } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { orderFigures, orderStatusLabel } from "@/lib/refund-math";
import { rangeStart, parseRange } from "@/lib/stats";
import { tenantDb } from "@/lib/tenant";
import { DISPUTE_STATUS_LABEL, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { Badge, PageHeader, RangeTabs, Stat } from "../ui";

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { PAID: "success", PENDING: "warning", PROCESSING: "warning", FAILED: "danger", ABANDONED: "neutral", REFUNDED: "neutral" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ rango?: string; estado?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const range = parseRange(sp.rango);
  const since = rangeStart(range, creator.timezone);
  const db = tenantDb(creator.id);
  // «Pagados» incluye los reembolsados en parte (siguen PAID); «Reembolsados», todo lo que tiene devoluciones.
  const filter =
    sp.estado === "todos"
      ? {}
      : sp.estado === "abandonados"
        ? { status: { in: ["ABANDONED", "PENDING", "FAILED"] } }
        : sp.estado === "reembolsados"
          ? { refundedCents: { gt: 0 } }
          : { status: "PAID" };
  const [orders, settled] = await Promise.all([
    db.order.findMany({
      where: { ...filter, ...(since ? { createdAt: { gte: since } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        product: { select: { emoji: true } },
        invoices: { where: { type: { in: ["F1", "F2", "F3"] } }, orderBy: { issuedAt: "desc" }, take: 1, select: { fullNumber: true } },
      },
    }),
    // Cifras del periodo descontando los reembolsos (se restan del mes de la venta).
    db.order.findMany({
      where: { status: { in: ["PAID", "REFUNDED"] }, ...(since ? { paidAt: { gte: since } } : {}) },
      select: { status: true, amountCents: true, platformFeeCents: true, refundedCents: true, refundedFeeCents: true, taxCents: true, taxSeller: true },
    }),
  ]);
  const figures = settled.map(orderFigures);
  const gross = figures.reduce((a, f) => a + f.gross, 0);
  const fees = figures.reduce((a, f) => a + f.fee, 0);
  const refunded = figures.reduce((a, f) => a + f.refunded, 0);
  // «Recibes» descuenta la comisión y el IVA que declara Cirella cuando vende ella (lib/tax).
  const net = figures.reduce((a, f) => a + f.net, 0);
  const platformTax = figures.reduce((a, f) => a + f.platformTax, 0);
  const filters = [
    ["pagados", "Pagados"],
    ["reembolsados", "Reembolsados"],
    ["abandonados", "Sin completar"],
    ["todos", "Todos"],
  ];
  const current = sp.estado ?? "pagados";
  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Cada pedido, su comisión y lo que recibes."
        actions={
          <>
            <RangeTabs current={range} base="/panel/ventas" />
            <a href={`/panel/ventas/csv?rango=${range}`} className="btn btn-outline btn-sm" download>
              <Download className="h-4 w-4" /> Descargar CSV
            </a>
          </>
        }
      />
      <div className={`mb-6 grid grid-cols-2 gap-3 ${platformTax > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        <Stat label="Ingresos brutos" value={formatMoney(gross)} accent hint={refunded > 0 ? `−${formatMoney(refunded, "EUR", { decimals: true })} reembolsados` : "IVA incluido"} />
        {platformTax > 0 && <Stat label="IVA" value={formatMoney(platformTax, "EUR", { decimals: true })} hint="Lo ingresa Cirella" />}
        <Stat label="Comisión plataforma" value={formatMoney(fees, "EUR", { decimals: true })} hint={`Plan ${creator.plan.name}`} />
        <Stat label="Recibes" value={formatMoney(net, "EUR", { decimals: true })} />
        <Stat label="Pedidos" value={figures.filter((f) => f.counts).length} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
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
          {orders.map((o) => {
            const f = orderFigures(o);
            return (
              <li key={o.id}>
                <Link href={`/panel/ventas/${o.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3.5 text-sm transition hover:bg-paper md:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.7fr_0.8fr] md:items-center md:px-5">
                  <span className="min-w-0 truncate font-medium">{o.product.emoji} {o.productTitle}<span className="block text-xs font-normal text-muted md:hidden">{o.buyerName ?? o.buyerEmail} · {o.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span></span>
                  <span className="hidden min-w-0 truncate text-muted md:block">{o.buyerName ?? o.buyerEmail}</span>
                  <span className="hidden text-muted md:block">{o.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-right font-semibold tabular-nums">
                    {formatMoney(o.amountCents, o.currency, { decimals: true })}
                    {o.invoices[0] && <span className="block font-mono text-[0.68rem] font-normal text-faint">{o.invoices[0].fullNumber}</span>}
                  </span>
                  <span className="hidden text-right tabular-nums text-muted md:block">{o.status === "PAID" || o.status === "REFUNDED" ? formatMoney(f.net, o.currency, { decimals: true }) : "—"}</span>
                  <span className="col-span-2 flex justify-start md:col-span-1 md:justify-end"><Badge tone={f.partial ? "warning" : TONE[o.status]}>{orderStatusLabel(o)}</Badge>{o.disputeStatus && <span className="ml-1.5"><Badge tone={o.disputeStatus === "WON" ? "neutral" : "danger"}>{DISPUTE_STATUS_LABEL[o.disputeStatus]}</Badge></span>}<span className="ml-2 text-xs text-faint md:hidden">{PRODUCT_TYPE_LABEL[o.productType as ProductType]}</span></span>
                </Link>
              </li>
            );
          })}
        </ul>
        {orders.length === 0 && <div className="p-6"><EmptyState icon={<Receipt className="h-5 w-5" />} title="Sin pedidos en este periodo" /></div>}
      </div>
      {current === "abandonados" && <p className="mt-3 text-xs text-muted">Los pedidos que se quedan a medias más de una hora reciben automáticamente un email de recuperación si tienes activa esa automatización.</p>}
    </div>
  );
}
