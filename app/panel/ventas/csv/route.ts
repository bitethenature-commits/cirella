import { NextResponse, type NextRequest } from "next/server";
import { requireCreator } from "@/lib/auth";
import { centsToCsv, toCsv } from "@/lib/csv";
import { orderRef } from "@/lib/order-ref";
import { orderBreakdown } from "@/lib/order-breakdown";
import { parseRange, rangeStart } from "@/lib/stats";
import { tenantDb } from "@/lib/tenant";
import { ORDER_STATUS_LABEL, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { dateKeyInTz } from "@/lib/tz";

/**
 * «Descargar CSV» de /panel/ventas: ventas pagadas y reembolsadas del periodo con su desglose
 * fiscal (quién vende, país, IVA, comisión, lo que recibe) y el número de factura. Cuadra fila a fila:
 * importe − reembolsado − iva_cirella − (comision − comision_devuelta) = recibes (lib/order-breakdown).
 */
export async function GET(req: NextRequest) {
  const { creator } = await requireCreator();
  const range = parseRange(req.nextUrl.searchParams.get("rango"));
  const since = rangeStart(range, creator.timezone);
  const orders = await tenantDb(creator.id).order.findMany({
    where: { status: { in: ["PAID", "REFUNDED"] }, ...(since ? { paidAt: { gte: since } } : {}) },
    orderBy: { paidAt: "desc" },
    include: {
      invoices: { where: { type: { in: ["F1", "F2", "F3"] } }, orderBy: { issuedAt: "desc" }, take: 1, select: { fullNumber: true } },
      transactions: { where: { type: "REFUND", refundId: { not: null } }, select: { amountCents: true, taxCents: true } },
    },
  });
  const rows: (string | number | null)[][] = [
    ["fecha", "pedido", "producto", "tipo", "compradora", "email", "pais", "vende", "importe_eur", "base_eur", "tipo_iva", "iva_eur", "comision_eur", "reembolsado_eur", "iva_devuelto_eur", "comision_devuelta_eur", "iva_cirella_eur", "recibes_eur", "estado", "factura"],
  ];
  for (const o of orders) {
    const f = orderBreakdown(o, o.transactions);
    rows.push([
      o.paidAt ? dateKeyInTz(o.paidAt, creator.timezone) : "",
      orderRef(o.id),
      o.productTitle,
      PRODUCT_TYPE_LABEL[o.productType as ProductType] ?? o.productType,
      o.buyerName,
      o.buyerEmail,
      o.taxCountry ?? o.buyerCountry,
      o.taxSeller === "PLATFORM" ? "Cirella" : "Tú",
      centsToCsv(o.amountCents),
      centsToCsv(o.amountCents - o.taxCents),
      String(o.taxRateBps / 100),
      centsToCsv(o.taxCents),
      centsToCsv(o.platformFeeCents),
      centsToCsv(f.refunded),
      centsToCsv(f.refundedTax),
      centsToCsv(f.refundedFee),
      centsToCsv(f.platformTax),
      centsToCsv(f.net),
      ORDER_STATUS_LABEL[o.status] ?? o.status,
      o.invoices[0]?.fullNumber ?? "",
    ]);
  }
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ventas-${creator.username}.csv"` },
  });
}
