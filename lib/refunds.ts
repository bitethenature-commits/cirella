/**
 * Reembolsos (los implementa #6). Este archivo existe para que los avisos de la pasarela
 * (reembolsos hechos desde el panel de Stripe y contracargos perdidos) ya tengan a quién llamar.
 */
export type ProviderRefundInput = {
  paymentRef: string;
  /** re_… / sim_re_… o, para un contracargo perdido, el id del contracargo. Clave de idempotencia. */
  refundRef: string;
  amountCents: number;
  reason: "PROVIDER" | "DISPUTE_LOST";
};

/** Registra un reembolso confirmado por la pasarela. Idempotente por refundRef. */
export async function applyProviderRefund(i: ProviderRefundInput): Promise<void> {
  throw new Error(`Reembolso ${i.refundRef} pendiente de registrar: falta el módulo de reembolsos (#6).`);
}
