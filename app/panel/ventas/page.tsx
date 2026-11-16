import Link from "next/link";
import { Download, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { NO_CHARGE_PROVIDERS } from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { orderBreakdown } from "@/lib/order-breakdown";
import { orderStatusLabel } from "@/lib/refund-math";
import { signupsOnly } from "@/lib/commerce";
import { isPersonalMode } from "@/lib/site-mode";
import { rangeStart, parseRange } from "@/lib/stats";
import { tenantDb } from "@/lib/tenant";
import { DISPUTE_STATUS_LABEL, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { Badge, PageHeader, RangeTabs, Stat } from "../ui";
import { formatDate } from "@/lib/tz";
import { SignupsView } from "./inscripciones";

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { PAID: "success", PENDING: "warning", PROCESSING: "warning", FAILED: "danger", ABANDONED: "neutral", REFUNDED: "neutral" };

/** Ventas = pedidos con cobro. Los de 0 € (gratis con email o acceso dado a mano) van en Inscripciones. */
const CHARGED = { paymentProvider: { notIn: [...NO_CHARGE_PROVIDERS] } };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ rango?: string; estado?: string; producto?: string; filtro?: string; ok?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const range = parseRange(sp.rango);
  const since = rangeStart(range, creator.timezone);
  const db = tenantDb(creator.id);
  // Web personal sin cobros: no se vende nada aquí, «Ventas» es la lista de inscripciones. Si cobra,
  // es como en la plataforma (con la pestaña de inscripciones) pero sin comisión.
  const personal = isPersonalMode();
  const onlySignups = signupsOnly();
  if (onlySignups || sp.estado === "inscripciones")
    return <SignupsView creatorId={creator.id} timezone={creator.timezone} filter={sp.filtro || sp.producto || null} personal={onlySignups} ok={sp.ok} />;
  // «Pagados» incluye los reembolsados en parte (siguen PAID); «Reembolsados», todo lo que tiene devoluciones.
  const filter =
    sp.estado === "todos"
      ? {}
      : sp.estado === "abandonados"
        ? { status: { in: ["ABANDONED", "PENDING", "FAILED"] } }
        : sp.estado === "reembolsados"
          ? { refundedCents: { gt: 0 } }
          : { status: "PAID" };
  const [orders, settled, signups] = await Promise.all([
    db.order.findMany({
      where: { ...filter, ...CHARGED, ...(since ? { createdAt: { gte: since } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        product: { select: { emoji: true } },
      },
    }),
    // Cifras del periodo descontando los reembolsos (se restan del mes de la venta).
    db.order.findMany({
      where: { status: { in: ["PAID", "REFUNDED"] }, ...CHARGED, ...(since ? { paidAt: { gte: since } } : {}) },
      select: {
        status: true,
        amountCents: true,
        platformFeeCents: true,
        refundedCents: true,
        refundedFeeCents: true,
      },
    }),
    // ¿Hay inscripciones gratis (productos gratis con email)? Entonces, su pestaña.
    db.order.count({ where: { status: "PAID", paymentProvider: { in: [...NO_CHARGE_PROVIDERS] } } }),
  ]);
  // Mismo desglose que el detalle del pedido (lib/order-breakdown): brutos − comisión = recibes.
  const figures = settled.map((o) => orderBreakdown(o));
  const gross = figures.reduce((a, f) => a + f.amount - f.refunded, 0);
  const fees = figures.reduce((a, f) => a + f.fee, 0);
  const refunded = figures.reduce((a, f) => a + f.refunded, 0);
  // «Recibes» descuenta la comisión.
  const net = figures.reduce((a, f) => a + f.net, 0);
  const filters = [
    ["pagados", "Pagados"],
    ["reembolsados", "Reembolsados"],
    ["abandonados", "Sin completar"],
    ["todos", "Todos"],
    ...(signups > 0 ? [["inscripciones", "Inscripciones gratis"]] : []),
  ];
  const current = sp.estado ?? "pagados";
  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle={personal ? "Cada pedido y lo que recibes." : "Cada pedido, su comisión y lo que recibes."}
        actions={
          <>
            <RangeTabs current={range} base="/panel/ventas" />
            <a href={`/panel/ventas/csv?rango=${range}`} className="btn btn-outline btn-sm" download>
              <Download className="h-4 w-4" /> Descargar CSV
            </a>
          </>
        }
      />
      <div className={`mb-6 grid grid-cols-2 gap-3 ${personal ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        <Stat label="Ingresos brutos" value={formatMoney(gross)} accent hint={refunded > 0 ? `−${formatMoney(refunded, "EUR", { decimals: true })} reembolsados` : undefined} />
        {!personal && <Stat label="Comisión plataforma" value={formatMoney(fees, "EUR", { decimals: true })} hint={`Plan ${creator.plan.name}`} />}
        <Stat label="Recibes" value={formatMoney(net, "EUR", { decimals: true })} />
        <Stat label="Pedidos" value={figures.filter((f) => f.amount - f.refunded > 0).length} />
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
            const f = orderBreakdown(o);
            const partial = o.status === "PAID" && o.refundedCents > 0;
            return (
              <li key={o.id}>
                <Link href={`/panel/ventas/${o.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3.5 text-sm transition hover:bg-paper md:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.7fr_0.8fr] md:items-center md:px-5">
                  <span className="min-w-0 truncate font-medium">{o.product.emoji} {o.productTitle}<span className="block text-xs font-normal text-muted md:hidden">{o.buyerName ?? o.buyerEmail} · {formatDate(o.paidAt ?? o.createdAt, { day: "numeric", month: "short" }, creator.timezone)}</span></span>
                  <span className="hidden min-w-0 truncate text-muted md:block">{o.buyerName ?? o.buyerEmail}</span>
                  <span className="hidden text-muted md:block">{formatDate(o.paidAt ?? o.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, creator.timezone)}</span>
                  <span className="text-right font-semibold tabular-nums">
                    {formatMoney(o.amountCents, o.currency, { decimals: true })}
                    {f.refunded > 0 && <span className="block text-[0.68rem] font-normal text-muted">−{formatMoney(f.refunded, o.currency, { decimals: true })} reemb.</span>}
                  </span>
                  <span className="hidden text-right tabular-nums text-muted md:block">
                    {f.settled ? (
                      <>
                        {formatMoney(f.net, o.currency, { decimals: true })}
                        {/* Lo que separa el importe de lo que recibes, para que la resta se vea. */}
                        {f.fee > 0 && <span className="block text-[0.68rem] text-faint">−{formatMoney(f.fee, o.currency, { decimals: true })} comisión</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="col-span-2 flex justify-start md:col-span-1 md:justify-end"><Badge tone={partial ? "warning" : TONE[o.status]}>{orderStatusLabel(o)}</Badge>{o.disputeStatus && <span className="ml-1.5"><Badge tone={o.disputeStatus === "WON" ? "neutral" : "danger"}>{DISPUTE_STATUS_LABEL[o.disputeStatus]}</Badge></span>}<span className="ml-2 text-xs text-faint md:hidden">{PRODUCT_TYPE_LABEL[o.productType as ProductType]}</span></span>
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
