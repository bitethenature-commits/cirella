/**
 * Importes de las ventas de la demo con las mismas reglas que el checkout real
 * (createPendingOrder en lib/orders.ts): quién vende a efectos de IVA, IVA incluido en el precio y
 * comisión sobre la base sin IVA. Así una venta sembrada muestra el mismo «Recibes» que una nueva.
 * Puro (sin BD): se prueba en scripts/unit/seed.test.ts.
 */
import { computeSaleAmounts, decideTax, type TaxMode, type VatStatus } from "../lib/tax";

export function demoSaleFields(i: {
  mode: TaxMode;
  product: { type: string; deliveryMode?: string | null; priceCents: number };
  creator: { legalCountry: string | null; vatStatus: VatStatus | string; vatExemptionNote?: string | null };
  commissionBps: number;
  buyerCountry: string;
}) {
  const tax = decideTax({
    mode: i.mode,
    productType: i.product.type,
    deliveryMode: i.product.deliveryMode,
    buyerCountry: i.buyerCountry,
    creator: { country: i.creator.legalCountry, vatStatus: i.creator.vatStatus, vatExemptionNote: i.creator.vatExemptionNote },
  });
  const a = computeSaleAmounts(i.product.priceCents, i.commissionBps, tax);
  return {
    amountCents: i.product.priceCents,
    commissionBps: i.commissionBps,
    platformFeeCents: a.platformFeeCents,
    netCents: a.netCents,
    taxSeller: tax.seller,
    taxCountry: tax.country,
    taxRateBps: a.taxRateBps,
    taxCents: a.taxCents,
    buyerCountry: i.buyerCountry,
  };
}
