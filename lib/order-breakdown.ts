/**
 * Desglose de un pedido para la creadora (/panel/ventas y su CSV): cada línea que separa el importe
 * cobrado de lo que recibe, con los importes guardados en el pedido, de modo que la resta se vea y
 * cuadre al céntimo:
 *
 *   importe − reembolsado − comisión = recibes
 *
 * Puro (sin BD).
 */
export type OrderBreakdownInput = {
  status: string;
  amountCents: number;
  platformFeeCents: number;
  refundedCents: number;
  refundedFeeCents: number;
};

export type OrderBreakdown = {
  /** Pagado o reembolsado: solo entonces hay dinero que repartir. */
  settled: boolean;
  amount: number;
  refunded: number;
  /** Comisión que se queda la plataforma tras devolver su parte de los reembolsos. */
  fee: number;
  saleFee: number;
  refundedFee: number;
  net: number;
};

export function orderBreakdown(o: OrderBreakdownInput): OrderBreakdown {
  const settled = o.status === "PAID" || o.status === "REFUNDED";
  const refunded = settled ? o.refundedCents : 0;
  const refundedFee = settled ? o.refundedFeeCents : 0;
  const fee = settled ? o.platformFeeCents - refundedFee : 0;
  return {
    settled,
    amount: o.amountCents,
    refunded,
    fee,
    saleFee: o.platformFeeCents,
    refundedFee,
    net: settled ? o.amountCents - refunded - fee : 0,
  };
}
