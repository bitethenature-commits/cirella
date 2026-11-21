/**
 * Importes de las ventas de la demo con las mismas reglas que el checkout real
 * (createPendingOrder en lib/orders.ts): comisión sobre el precio y lo que recibe la creadora. Así una
 * venta sembrada muestra el mismo «Recibes» que una nueva. Puro (sin BD): se prueba en
 * scripts/unit/seed.test.ts.
 */
import { computeSaleAmounts } from "../lib/sale-amounts";

export function demoSaleFields(i: { product: { priceCents: number }; commissionBps: number }) {
  const a = computeSaleAmounts(i.product.priceCents, i.commissionBps);
  return {
    amountCents: i.product.priceCents,
    commissionBps: i.commissionBps,
    platformFeeCents: a.platformFeeCents,
    netCents: a.netCents,
  };
}
