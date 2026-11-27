/**
 * Importes de una venta: la comisión de la plataforma sobre el precio que se paga y lo que recibe la
 * creadora. Puro (se usa también en el navegador). La web no calcula ni guarda impuestos.
 */
export function computeSaleAmounts(amountCents: number, commissionBps: number) {
  const platformFeeCents = Math.round((amountCents * commissionBps) / 10000);
  return { platformFeeCents, netCents: amountCents - platformFeeCents };
}
