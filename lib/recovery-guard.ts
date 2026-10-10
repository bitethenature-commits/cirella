import { prisma } from "./db";
import { RULES } from "./limits";
import { hit, rlKey, type HitResult } from "./rate-limit";

/**
 * ¿Mandamos el email de compra abandonada? Solo recuperamos a quien abrió el checkout de verdad:
 * así nadie puede usar los pagos fallidos para enviar emails con el nombre de la creadora a
 * direcciones ajenas (escribiendo en el checkout el email de otra persona).
 */

export type RecoveryFacts = {
  hasVisitor: boolean;
  startedCheckout: boolean;
  distinctEmailsFromVisitor: number;
  distinctEmailsFromIp: number;
};
export type RecoverySkip = "sin-visita" | "sin-checkout" | "muchos-emails" | "ya-avisada";

/** Más emails distintos que esto en 24 h desde la misma visitante (o IP) es sospechoso. */
const MAX_EMAILS_PER_VISITOR = 2;
const MAX_EMAILS_PER_IP = 5;
const DAY_MS = 86_400_000;

export function recoveryDecision(f: RecoveryFacts): { send: true } | { send: false; reason: Exclude<RecoverySkip, "ya-avisada"> } {
  if (!f.hasVisitor) return { send: false, reason: "sin-visita" };
  if (!f.startedCheckout) return { send: false, reason: "sin-checkout" };
  if (f.distinctEmailsFromVisitor > MAX_EMAILS_PER_VISITOR || f.distinctEmailsFromIp > MAX_EMAILS_PER_IP) return { send: false, reason: "muchos-emails" };
  return { send: true };
}

type RecoveryOrder = {
  id: string;
  creatorId: string;
  productId: string;
  buyerEmail: string;
  visitorId: string | null;
  ipHash: string | null;
  createdAt: Date;
};

/**
 * Los hechos de un pedido sin pagar. Corre en el cron, entre creadoras, con el cliente global,
 * pero filtra SIEMPRE por la creadora del pedido: la visita en la página de otra no cuenta.
 */
export async function recoveryFacts(order: RecoveryOrder): Promise<RecoveryFacts> {
  if (!order.visitorId) return { hasVisitor: false, startedCheckout: false, distinctEmailsFromVisitor: 0, distinctEmailsFromIp: 0 };
  const t = order.createdAt.getTime();
  const around = { gte: new Date(t - DAY_MS), lte: new Date(t + DAY_MS) };
  const [started, byVisitor, byIp] = await Promise.all([
    prisma.analyticsEvent.count({
      where: {
        creatorId: order.creatorId,
        visitorId: order.visitorId,
        productId: order.productId,
        type: "CHECKOUT_STARTED",
        createdAt: { gte: new Date(t - DAY_MS), lte: new Date(t + 60_000) },
      },
    }),
    prisma.order.groupBy({ by: ["buyerEmail"], where: { creatorId: order.creatorId, visitorId: order.visitorId, createdAt: around } }),
    order.ipHash
      ? prisma.order.groupBy({ by: ["buyerEmail"], where: { creatorId: order.creatorId, ipHash: order.ipHash, createdAt: around } })
      : Promise.resolve([]),
  ]);
  return { hasVisitor: true, startedCheckout: started > 0, distinctEmailsFromVisitor: byVisitor.length, distinctEmailsFromIp: byIp.length };
}

/**
 * Tope de un email de recuperación por destinatario cada 24 h. Consume el cupo: se llama solo
 * cuando el email va a salir, con la transacción que marca el pedido (si se deshace, el cupo también).
 */
export function claimRecoveryEmail(buyerEmail: string, db?: Parameters<typeof hit>[3]): Promise<HitResult> {
  return hit(rlKey("recovery-to", buyerEmail), RULES.recoveryRecipient, new Date(), db);
}

/** Decisión completa (consume el cupo del destinatario si se puede enviar). */
export async function checkRecovery(order: RecoveryOrder): Promise<{ send: true } | { send: false; reason: RecoverySkip }> {
  const d = recoveryDecision(await recoveryFacts(order));
  if (!d.send) return d;
  return (await claimRecoveryEmail(order.buyerEmail)).ok ? d : { send: false, reason: "ya-avisada" };
}
