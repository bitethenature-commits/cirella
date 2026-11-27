import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { orderFigures, orderStatusLabel } from "@/lib/refund-math";
import { DISPUTE_STATUS_LABEL } from "@/lib/types";
import { Badge, PageHeader, Stat } from "../../panel/ui";
import { AdminTable, td } from "../ui";
import { formatDate } from "@/lib/tz";
import { platformOnly } from "../platform-only";
import { getT } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

export default async function AdminSales() {
  const t = await getT();
  platformOnly();
  await requireAdmin();
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { creator: { select: { displayName: true, username: true } } } });
  // Cifras netas de reembolsos; un pedido devuelto del todo ya no cuenta como pagado.
  const paid = orders.map(orderFigures).filter((f) => f.counts);
  return (
    <div>
      <PageHeader title={t("Ventas")} subtitle={t("Todos los pedidos de todas las creadoras (últimos 300).")} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("GMV")} value={formatMoney(paid.reduce((a, f) => a + f.gross, 0))} accent />
        <Stat label={t("Comisiones")} value={formatMoney(paid.reduce((a, f) => a + f.fee, 0), "EUR", { decimals: true })} />
        <Stat label={t("Pedidos pagados")} value={paid.length} />
        <Stat label={t("Sin completar")} value={orders.length - paid.length} />
      </div>
      <AdminTable head={["Fecha", "Creadora", "Producto", "Comprador", "Importe", "Comisión", "Estado"]} minWidth={900}>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className={`${td} text-muted`}>{formatDate(o.createdAt, { day: "numeric", month: "short" })}</td>
            <td className={td}>{o.creator.displayName}</td>
            <td className={td}><Tr s={o.productTitle} /></td>
            <td className={`${td} text-muted`}><Tr s={o.buyerEmail} /></td>
            <td className={`${td} tabular-nums`}>{formatMoney(o.amountCents, o.currency, { decimals: true })}</td>
            <td className={`${td} tabular-nums text-muted`}>{formatMoney(o.platformFeeCents, o.currency, { decimals: true })} <span className="text-xs">({o.commissionBps / 100} %)</span></td>
            <td className={`${td} text-right`}>
              <span className="inline-flex flex-wrap justify-end gap-1.5">
                <Badge tone={o.status === "PAID" ? (o.refundedCents > 0 ? "warning" : "success") : o.status === "FAILED" ? "danger" : o.status === "PROCESSING" ? "warning" : "neutral"}>{orderStatusLabel(o)}</Badge>
                {o.disputeStatus && <Badge tone={o.disputeStatus === "WON" ? "neutral" : "danger"}><Tr s={DISPUTE_STATUS_LABEL[o.disputeStatus]} /></Badge>}
              </span>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
