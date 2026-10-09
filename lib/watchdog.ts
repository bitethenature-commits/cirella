import { prisma } from "./db";
import { env, isDemoMode } from "./env";
import { getJobStatus } from "./job-lock";
import { captureAlert, captureError } from "./monitoring";
import { fulfillOrder } from "./orders";
import { CRON_STALE_MINUTES, isStale } from "./reliability";

/** Margen antes de dar un pedido cobrado por «no entregado» (la entrega normal tarda segundos). */
const CHARGED_GRACE_MIN = 10;
/** Un «pago completado» sin procesar pasado este tiempo significa que el recibo no ha salido. */
const PAID_EVENT_GRACE_MIN = 15;

/**
 * Vigilante (en cada ejecución del cron):
 *   · Pedidos cobrados y no entregados: la pasarela confirmó el cobro (Order.chargedAt) pero la
 *     entrega falló o el proceso cayó a mitad. Vuelve a ejecutar la entrega (idempotente) y avisa.
 *   · Pagos completados cuyo evento sigue sin procesar (el recibo y el acceso no han salido): avisa.
 */
export async function runWatchdog(now = new Date()) {
  // Estados en los que el pedido ya está entregado o deshecho: no se vuelve a entregar.
  const orders = await prisma.order.findMany({
    where: {
      chargedAt: { lt: new Date(now.getTime() - CHARGED_GRACE_MIN * 60_000) },
      status: { notIn: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] },
    },
    orderBy: { chargedAt: "asc" },
    take: 20,
    select: { id: true, paymentRef: true },
  });
  let refulfilled = 0;
  for (const o of orders) {
    captureAlert("Pedido cobrado sin entregar: reintentando la entrega", {
      area: "payments",
      level: "error",
      fingerprint: ["cobrado-sin-entregar"],
      extra: { orderId: o.id },
    });
    try {
      await fulfillOrder(o.id, o.paymentRef ?? "");
      refulfilled++;
    } catch (e) {
      captureError(e, { area: "payments", extra: { orderId: o.id } });
    }
  }

  const paidUndelivered = await prisma.outboxEvent.count({
    where: {
      type: "order.paid",
      status: { in: ["PENDING", "PROCESSING"] },
      createdAt: { lt: new Date(now.getTime() - PAID_EVENT_GRACE_MIN * 60_000) },
    },
  });
  if (paidUndelivered > 0)
    captureAlert(`${paidUndelivered} pagos completados sin recibo enviado`, { area: "events", level: "error", fingerprint: ["entrega-pendiente"] });

  return { refulfilled, paidUndelivered };
}

/**
 * Resumen para la administradora (/admin y /admin/envios): emails no entregados en los últimos
 * 30 días, eventos descartados y estado del cron. El cron solo cuenta como parado donde está
 * configurado (CRON_SECRET) y fuera del modo demo, igual que en /api/health.
 */
export async function getDeliveryHealth(now = new Date()) {
  const [failedEmails, deadEvents, cron] = await Promise.all([
    prisma.emailMessage.count({ where: { status: "FAILED", createdAt: { gte: new Date(now.getTime() - 30 * 24 * 3600_000) } } }),
    prisma.outboxEvent.count({ where: { status: "DEAD" } }),
    getJobStatus("cron"),
  ]);
  const cronExpected = !!env().CRON_SECRET && !isDemoMode();
  const cronStale = isStale(cron?.lastFinishedAt ?? null, now, CRON_STALE_MINUTES);
  return { failedEmails, deadEvents, cron, cronExpected, cronStale, cronStopped: cronExpected && cronStale };
}
