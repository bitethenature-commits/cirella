import { NextResponse, type NextRequest } from "next/server";
import { NO_CHARGE_PROVIDERS } from "@/lib/access-mode";
import { requireCreator } from "@/lib/auth";
import { centsToCsv, toCsv } from "@/lib/csv";
import { orderRef } from "@/lib/order-ref";
import { orderBreakdown } from "@/lib/order-breakdown";
import { signupsOnly } from "@/lib/commerce";
import { parseRange, rangeStart } from "@/lib/stats";
import { tenantDb } from "@/lib/tenant";
import { ORDER_STATUS_LABEL, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { dateKeyInTz, formatInTz } from "@/lib/tz";
import { listSignups } from "../signups-data";

/**
 * «Descargar CSV» de /panel/ventas: ventas pagadas y reembolsadas del periodo con su desglose
 * (comisión y lo que recibe). Cuadra fila a fila:
 * importe − reembolsado − (comision − comision_devuelta) = recibes (lib/order-breakdown).
 */
export async function GET(req: NextRequest) {
  const { creator } = await requireCreator();
  const params = req.nextUrl.searchParams;
  const range = parseRange(params.get("rango"));
  const since = rangeStart(range, creator.timezone);
  // Web personal sin cobros (o la pestaña «Inscripciones gratis»): quién se ha apuntado a qué.
  if (signupsOnly() || params.get("tipo") === "inscripciones") {
    const { rows: signups } = await listSignups(creator.id, { since, productId: params.get("producto") || null });
    const rows: (string | number | null)[][] = [["fecha", "hora", "nombre", "email", "producto", "origen", "quiere_novedades", "acceso", "pedido"]];
    for (const r of signups)
      rows.push([
        r.paidAt ? dateKeyInTz(r.paidAt, creator.timezone) : "",
        r.paidAt ? formatInTz(r.paidAt, creator.timezone, { hour: "2-digit", minute: "2-digit" }) : "",
        r.name,
        r.email,
        r.productTitle,
        r.origin,
        r.newsletter ? "sí" : r.newsletterPending ? "pendiente de confirmar" : "no",
        r.active ? "con acceso" : "retirado",
        orderRef(r.orderId),
      ]);
    return new NextResponse(toCsv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="inscripciones-${creator.username}.csv"` },
    });
  }
  const orders = await tenantDb(creator.id).order.findMany({
    where: { status: { in: ["PAID", "REFUNDED"] }, paymentProvider: { notIn: [...NO_CHARGE_PROVIDERS] }, ...(since ? { paidAt: { gte: since } } : {}) },
    orderBy: { paidAt: "desc" },
  });
  const rows: (string | number | null)[][] = [
    ["fecha", "pedido", "producto", "tipo", "compradora", "email", "importe_eur", "comision_eur", "reembolsado_eur", "comision_devuelta_eur", "recibes_eur", "estado"],
  ];
  for (const o of orders) {
    const f = orderBreakdown(o);
    rows.push([
      o.paidAt ? dateKeyInTz(o.paidAt, creator.timezone) : "",
      orderRef(o.id),
      o.productTitle,
      PRODUCT_TYPE_LABEL[o.productType as ProductType] ?? o.productType,
      o.buyerName,
      o.buyerEmail,
      centsToCsv(o.amountCents),
      centsToCsv(o.platformFeeCents),
      centsToCsv(f.refunded),
      centsToCsv(f.refundedFee),
      centsToCsv(f.net),
      ORDER_STATUS_LABEL[o.status] ?? o.status,
    ]);
  }
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ventas-${creator.username}.csv"` },
  });
}
