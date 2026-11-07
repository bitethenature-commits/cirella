/**
 * Pruebas de fiabilidad contra Postgres.
 *   npm run test:reliability        (con la BD sembrada: npm run db:reset)
 *
 * Comprueba que ningún recibo, acceso o aviso se pierde en silencio:
 *   · emails: reintentos con backoff, fallo permanente, sin doble envío, lease caducado y
 *     deduplicación concurrente;
 *   · outbox de eventos: atómico con la transacción, entrega tras el pago, reintentos y DEAD;
 *   · cron: un solo proceso a la vez y latido;
 *   · renovaciones y cuotas de plan idempotentes ante ejecuciones simultáneas;
 *   · vigilante de pedidos cobrados sin entregar y abandonos concurrentes;
 *   · aislamiento: el registro de envíos de una creadora no ve el de otra.
 * Usa el proveedor de email «log» (+fallo / +rebote simulan fallos) y borra todo lo que crea.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { emitAbandoned } from "../lib/abandoned";
import { runScheduledJobs } from "../lib/cron";
import { deliverEmail, enqueueEmail, processOutbox } from "../lib/email/outbox";
import { emailProvider } from "../lib/email/provider";
import { processEvents, recordEvents, retryEvent } from "../lib/events";
import { createPendingOrder, fulfillOrder } from "../lib/orders";
import { chargeKey, MAX_ATTEMPTS, planFeeKey, renewalKey } from "../lib/reliability";
import { processPlanRenewals, processRenewals } from "../lib/subscriptions";
import { tenantDb } from "../lib/tenant";
import { runWatchdog } from "../lib/watchdog";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `fiabilidad-${Date.now()}`;
const MIN = 60_000;
const email = (label: string) => `${TAG}-${label}@example.com`;
const past = () => new Date(Date.now() - MIN);
const near = (d: Date | null | undefined, target: number, toleranceMs = 30_000) => !!d && Math.abs(d.getTime() - target) < toleranceMs;

// Lo que se crea, para borrarlo al final.
const created = { emails: [] as string[], events: [] as string[], orders: [] as string[], users: [] as string[], subs: [] as string[] };

async function main() {
  check("el proveedor de email de la prueba es «log»", emailProvider().key === "log");
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const digital = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", deliveryMode: "AUTOMATIC" } });
  const membership = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "MEMBERSHIP" } });

  // ── 1. Reintentos con backoff hasta FAILED ──
  const flaky = await enqueueEmail({ to: email("x+fallo"), subject: "Prueba", html: "<p>x</p>", template: "PURCHASE_RECEIPT", creatorId: ana.id });
  created.emails.push(flaky.id);
  let row = await prisma.emailMessage.findUniqueOrThrow({ where: { id: flaky.id } });
  check("fallo transitorio: sigue en cola con 1 intento", row.status === "QUEUED" && row.attempts === 1, row);
  check("el siguiente intento es en ~1 min", near(row.sendAt, Date.now() + MIN));
  check("guarda el último error", !!row.error?.includes("+fallo"));
  check("el remitente es la creadora y responde a su email", row.fromName === ana.displayName && !!row.replyTo);
  for (let i = 2; i <= MAX_ATTEMPTS; i++) {
    await prisma.emailMessage.update({ where: { id: flaky.id }, data: { sendAt: past() } });
    await processOutbox();
  }
  row = await prisma.emailMessage.findUniqueOrThrow({ where: { id: flaky.id } });
  check(`tras ${MAX_ATTEMPTS} intentos queda FAILED`, row.status === "FAILED" && row.attempts === MAX_ATTEMPTS, { status: row.status, attempts: row.attempts });

  // ── 2. Fallo permanente ──
  const bounce = await enqueueEmail({ to: email("x+rebote"), subject: "Prueba", html: "<p>x</p>", template: "MAGIC_LINK" });
  created.emails.push(bounce.id);
  row = await prisma.emailMessage.findUniqueOrThrow({ where: { id: bounce.id } });
  check("dirección rechazada: FAILED al primer intento", row.status === "FAILED" && row.attempts === 1, row);

  // ── 3. Sin doble envío ──
  const queued = await enqueueEmail({ to: email("doble"), subject: "Prueba", html: "<p>x</p>", template: "MAGIC_LINK", sendNow: false });
  created.emails.push(queued.id);
  await Promise.all([processOutbox(), processOutbox(), deliverEmail(queued.id)]);
  row = await prisma.emailMessage.findUniqueOrThrow({ where: { id: queued.id } });
  check("entrega simultánea desde tres sitios: un solo intento y SENT", row.status === "SENT" && row.attempts === 1, row);

  // ── 4. Lease caducado ──
  const stuck = await prisma.emailMessage.create({
    data: { to: email("lease"), subject: "Prueba", html: "<p>x</p>", template: "MAGIC_LINK", status: "SENDING", attempts: 1, lockedUntil: past() },
  });
  created.emails.push(stuck.id);
  await processOutbox();
  row = await prisma.emailMessage.findUniqueOrThrow({ where: { id: stuck.id } });
  check("un email en SENDING con el lease caducado se reenvía", row.status === "SENT", row);

  // ── 5. Deduplicación concurrente ──
  const dedupeKey = `${TAG}:dedupe`;
  const pair = await Promise.all(
    [1, 2].map(() => enqueueEmail({ to: email("dedupe"), subject: "Prueba", html: "<p>x</p>", template: "MAGIC_LINK", dedupeKey, sendNow: false })),
  );
  created.emails.push(...pair.map((m) => m.id));
  check("misma dedupeKey a la vez: un solo email", pair[0].id === pair[1].id && (await prisma.emailMessage.count({ where: { dedupeKey } })) === 1);

  // ── 6. Outbox atómico ──
  const ghost = `${TAG}-rollback`;
  await prisma
    .$transaction(async (tx) => {
      await recordEvents(tx, [{ type: "order.paid", orderId: ghost }]);
      throw new Error("rollback");
    })
    .catch(() => {});
  check("un evento grabado en una transacción que se deshace no existe", (await prisma.outboxEvent.count({ where: { payload: { path: ["orderId"], equals: ghost } } })) === 0);

  // ── 7. Entrega tras el pago ──
  const order = await createPendingOrder({ productId: digital.id, buyerEmail: email("compra"), buyerName: "Prueba", visitorId: TAG });
  created.orders.push(order.id);
  await fulfillOrder(order.id, `sim_ch_${TAG}`);
  const paidEvent = await prisma.outboxEvent.findFirst({ where: { type: "order.paid", payload: { path: ["orderId"], equals: order.id } } });
  check("el evento «pago completado» queda procesado (DONE)", paidEvent?.status === "DONE", paidEvent);
  const receipt = await prisma.emailMessage.findUnique({ where: { dedupeKey: `receipt:${order.id}` } });
  check("el recibo se ha enviado", receipt?.status === "SENT", receipt?.status);
  const charge = await prisma.transaction.findFirst({ where: { orderId: order.id, type: "CHARGE" } });
  check("el cobro lleva la clave de idempotencia charge:{pedido}", charge?.idempotencyKey === chargeKey(order.id));
  await fulfillOrder(order.id, `sim_ch_${TAG}`);
  check("repetir la entrega no duplica eventos ni cobros", (await prisma.outboxEvent.count({ where: { type: "order.paid", payload: { path: ["orderId"], equals: order.id } } })) === 1 && (await prisma.transaction.count({ where: { orderId: order.id } })) === 1);

  // ── 8. Evento que falla: reintentos y DEAD ──
  const broken = await prisma.outboxEvent.create({ data: { type: "order.paid", payload: { type: "order.paid", orderId: `${TAG}-no-existe` } } });
  created.events.push(broken.id);
  await processEvents();
  let ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: broken.id } });
  check("evento fallido: PENDING con 1 intento y reintento en ~1 min", ev.status === "PENDING" && ev.attempts === 1 && near(ev.runAt, Date.now() + MIN), ev);
  for (let i = 2; i <= MAX_ATTEMPTS; i++) {
    await prisma.outboxEvent.update({ where: { id: broken.id }, data: { runAt: past() } });
    await processEvents();
  }
  ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: broken.id } });
  check(`tras ${MAX_ATTEMPTS} intentos queda DEAD`, ev.status === "DEAD" && ev.attempts === MAX_ATTEMPTS && !!ev.lastError, ev);
  check("reprocesar lo vuelve a poner en marcha", await retryEvent(broken.id));
  ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: broken.id } });
  check("…con la cuenta de intentos reiniciada (vuelve a fallar: 1 intento)", ev.status === "PENDING" && ev.attempts === 1, ev);

  // ── 9. Cron: un solo proceso a la vez ──
  const runs = await Promise.all([runScheduledJobs(), runScheduledJobs()]);
  check("dos ejecuciones simultáneas: exactamente una se salta", runs.filter((r) => r.skipped).length === 1, runs);
  const lock = await prisma.jobLock.findUnique({ where: { name: "cron" } });
  check("el latido del cron queda registrado", !!lock?.lastFinishedAt && !!lock.lastOkAt && lock.lockedUntil <= new Date(), lock);

  // ── 10. Renovación idempotente ──
  const member = await prisma.user.create({ data: { email: email("miembro"), name: "Prueba" } });
  created.users.push(member.id);
  const customer = await prisma.customer.create({ data: { creatorId: ana.id, userId: member.id, email: member.email, totalSpentCents: 0 } });
  const periodEnd = new Date(Date.now() - 3600_000);
  const sub = await prisma.subscription.create({
    data: {
      creatorId: ana.id,
      productId: membership.id,
      customerId: customer.id,
      userId: member.id,
      priceCents: 1500,
      currentPeriodStart: new Date(periodEnd.getTime() - 30 * 24 * 3600_000),
      currentPeriodEnd: periodEnd,
      provider: "simulated",
    },
  });
  created.subs.push(sub.id);
  await Promise.all([processRenewals(), processRenewals()]);
  const renewals = await prisma.transaction.findMany({ where: { subscriptionId: sub.id, type: "RENEWAL" } });
  check("dos renovaciones simultáneas: un solo cargo", renewals.length === 1, renewals.length);
  check("…con la clave renewal:{suscripción}:{periodo}", renewals[0]?.idempotencyKey === renewalKey(sub.id, periodEnd));
  const renewed = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
  const expectedEnd = new Date(periodEnd);
  expectedEnd.setMonth(expectedEnd.getMonth() + 1);
  check("el periodo avanza una sola vez", renewed.currentPeriodEnd.getTime() === expectedEnd.getTime());
  check("el gasto de la clienta se suma una vez", (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).totalSpentCents === 1500);

  // ── 11. Cuota de plan idempotente ──
  const plan = await prisma.plan.findFirstOrThrow({ where: { priceMonthlyCents: { gt: 0 } } });
  const owner = await prisma.user.create({ data: { email: email("creadora"), name: "Prueba" } });
  created.users.push(owner.id);
  const renewsAt = new Date(Date.now() - 3600_000);
  const temp = await prisma.creator.create({
    data: { userId: owner.id, username: TAG, displayName: "Prueba", planId: plan.id, planRenewsAt: renewsAt, pageDraft: {}, referralCode: TAG, creditCents: 500 },
  });
  await Promise.all([processPlanRenewals(), processPlanRenewals()]);
  const fees = await prisma.transaction.findMany({ where: { creatorId: temp.id, type: "PLAN_FEE" } });
  check("dos cobros de cuota simultáneos: uno solo", fees.length === 1 && fees[0].idempotencyKey === planFeeKey(temp.id, renewsAt), fees);
  check("el crédito se descuenta una vez", (await prisma.creator.findUniqueOrThrow({ where: { id: temp.id } })).creditCents === 0);

  // ── 12. Vigilante: cobrado sin entregar ──
  const orphan = await createPendingOrder({ productId: digital.id, buyerEmail: email("huerfano"), buyerName: "Prueba", visitorId: TAG });
  created.orders.push(orphan.id);
  await prisma.order.update({ where: { id: orphan.id }, data: { chargedAt: new Date(Date.now() - 15 * MIN), paymentRef: "sim_ch_test" } });
  const w = await runWatchdog();
  const healed = await prisma.order.findUniqueOrThrow({ where: { id: orphan.id } });
  check("el vigilante entrega el pedido cobrado", w.refulfilled >= 1 && healed.status === "PAID" && healed.paymentRef === "sim_ch_test", { w, status: healed.status });
  const buyer = await prisma.user.findUnique({ where: { email: email("huerfano") } });
  check("…concede el acceso", !!buyer && (await prisma.access.count({ where: { userId: buyer.id, productId: digital.id, status: "ACTIVE" } })) === 1);
  check("…y envía el recibo", !!(await prisma.emailMessage.findUnique({ where: { dedupeKey: `receipt:${orphan.id}` } })));

  // ── 13. Abandonos concurrentes ──
  const stale = await createPendingOrder({ productId: digital.id, buyerEmail: email("abandono"), buyerName: "Prueba", visitorId: `${TAG}-abandono` });
  const charged = await createPendingOrder({ productId: digital.id, buyerEmail: email("cobrado"), buyerName: "Prueba", visitorId: TAG });
  created.orders.push(stale.id, charged.id);
  const old = new Date(Date.now() - 3 * 3600_000);
  await prisma.order.update({ where: { id: stale.id }, data: { createdAt: old } });
  await prisma.order.update({ where: { id: charged.id }, data: { createdAt: old, chargedAt: new Date() } });
  // Solo se recupera a quien abrió el checkout, con su propia visita (lib/recovery-guard.ts).
  await prisma.analyticsEvent.create({
    data: { creatorId: ana.id, type: "CHECKOUT_STARTED", productId: digital.id, visitorId: stale.visitorId!, createdAt: new Date(old.getTime() - MIN) },
  });
  await Promise.all([emitAbandoned(0), emitAbandoned(0)]);
  const abandonedEvents = await prisma.outboxEvent.count({ where: { type: "checkout.abandoned", payload: { path: ["orderId"], equals: stale.id } } });
  check("dos ejecuciones a la vez: un solo aviso de compra abandonada", abandonedEvents === 1, abandonedEvents);
  check("…y como mucho un email de recuperación", (await prisma.emailMessage.count({ where: { template: "ABANDONED_CHECKOUT", to: email("abandono") } })) <= 1);
  check("un pedido ya cobrado nunca se da por abandonado", (await prisma.order.findUniqueOrThrow({ where: { id: charged.id } })).status !== "ABANDONED");

  // ── 14. Aislamiento del registro de envíos ──
  const mariaEmail = await prisma.emailMessage.create({
    data: { to: email("maria"), subject: "Prueba", html: "<p>x</p>", template: "MAGIC_LINK", creatorId: maria.id, status: "FAILED", attempts: 6 },
  });
  created.emails.push(mariaEmail.id);
  const db = tenantDb(ana.id);
  const anaLog = await db.emailMessage.findMany();
  check("el registro de envíos de Ana no incluye los de María", anaLog.length > 0 && anaLog.every((m) => m.creatorId === ana.id));
  check("updateMany sobre un email de María desde Ana afecta 0 filas", (await db.emailMessage.updateMany({ where: { id: mariaEmail.id }, data: { status: "QUEUED" } })).count === 0);
}

async function cleanup() {
  const buyers = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = [...new Set([...buyers.map((u) => u.id), ...created.users])];
  const orderIds = created.orders;
  const customerIds = (await prisma.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((c) => c.id);
  const byPayload = [
    ...orderIds.map((id) => ({ payload: { path: ["orderId"], equals: id } })),
    ...created.subs.map((id) => ({ payload: { path: ["subscriptionId"], equals: id } })),
    ...customerIds.map((id) => ({ payload: { path: ["customerId"], equals: id } })),
  ];
  await prisma.$transaction([
    prisma.outboxEvent.deleteMany({ where: { OR: [{ id: { in: created.events } }, ...byPayload] } }),
    prisma.emailMessage.deleteMany({ where: { OR: [{ id: { in: created.emails } }, { to: { startsWith: TAG } }, ...orderIds.map((id) => ({ dedupeKey: { contains: id } }))] } }),
    prisma.analyticsEvent.deleteMany({ where: { visitorId: { startsWith: TAG } } }),
    prisma.access.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.transaction.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { subscriptionId: { in: created.subs } }] } }),
    prisma.subscription.deleteMany({ where: { OR: [{ id: { in: created.subs } }, { userId: { in: userIds } }] } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await cleanup().catch((e) => {
      console.error("No se pudo limpiar todo:", e);
      failures++;
    });
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nNingún recibo, acceso ni aviso se pierde en silencio ✓");
    process.exit(failures ? 1 : 0);
  });
