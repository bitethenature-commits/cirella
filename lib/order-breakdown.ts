/**
 * Desglose de un pedido para la creadora (/panel/ventas y su CSV): cada línea que separa el importe
 * cobrado de lo que recibe, con los importes guardados en el pedido y en el libro, de modo que la
 * resta se vea y cuadre al céntimo:
 *
 *   importe − reembolsado − IVA que ingresa Cirella − comisión = recibes
 *
 * Puro (sin BD). El IVA devuelto sale de las filas REFUND del libro (lib/refunds.ts las guarda con
 * su IVA en negativo); si un pedido antiguo no las tiene, se reparte en proporción como hace
 * orderFigures (lib/refund-math.ts).
 */
export type OrderBreakdownInput = {
  status: string;
  amountCents: number;
  /** IVA incluido en amountCents y quién lo declara (PLATFORM = lo ingresa Cirella). */
  taxCents: number;
  taxSeller: string | null;
  platformFeeCents: number;
  refundedCents: number;
  refundedFeeCents: number;
};

/** Filas REFUND del libro de este pedido (importes en negativo). */
export type RefundLedgerRow = { amountCents: number; taxCents: number };

export type OrderBreakdown = {
  /** Pagado o reembolsado: solo entonces hay dinero que repartir. */
  settled: boolean;
  amount: number;
  refunded: number;
  /** IVA de la venta que queda tras los reembolsos (todo, lo declare quien lo declare). */
  tax: number;
  /** Parte de `tax` que ingresa Cirella porque vende ella; 0 si vende la creadora. */
  platformTax: number;
  /** IVA de la venta original y lo que se devolvió con los reembolsos. */
  saleTax: number;
  refundedTax: number;
  /** Comisión que se queda Cirella tras devolver su parte de los reembolsos. */
  fee: number;
  saleFee: number;
  refundedFee: number;
  net: number;
};

export function orderBreakdown(o: OrderBreakdownInput, refundRows: RefundLedgerRow[] = []): OrderBreakdown {
  const settled = o.status === "PAID" || o.status === "REFUNDED";
  const refunded = settled ? o.refundedCents : 0;
  const booked = refundRows.reduce((a, r) => a + Math.abs(r.amountCents), 0);
  // El libro manda si recoge todos los reembolsos; si no (pedidos antiguos), en proporción.
  const refundedTax = !settled
    ? 0
    : booked === refunded
      ? refundRows.reduce((a, r) => a + Math.abs(r.taxCents), 0)
      : o.amountCents
        ? Math.round((o.taxCents * refunded) / o.amountCents)
        : 0;
  const tax = settled ? Math.max(0, o.taxCents - refundedTax) : 0;
  const platformTax = o.taxSeller === "PLATFORM" ? tax : 0;
  const refundedFee = settled ? o.refundedFeeCents : 0;
  const fee = settled ? o.platformFeeCents - refundedFee : 0;
  return {
    settled,
    amount: o.amountCents,
    refunded,
    tax,
    platformTax,
    saleTax: o.taxCents,
    refundedTax,
    fee,
    saleFee: o.platformFeeCents,
    refundedFee,
    net: settled ? o.amountCents - refunded - platformTax - fee : 0,
  };
}
