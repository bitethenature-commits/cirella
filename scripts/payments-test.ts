/**
 * Pruebas de pagos contra Postgres (pasarela simulada).
 *   npm run test:payments        (con la BD sembrada: npm run db:reset)
 *
 *   · entrega una sola vez aunque el aviso de la pasarela llegue repetido y a la vez que la vuelta
 *     de la compradora; un segundo cobro del mismo pedido se reembolsa;
 *   · un aviso (PaymentEvent) repetido se aplica una vez;
 *   · un pago con otro importe no se entrega;
 *   · renovaciones: tarjeta que falla → PAST_DUE, reintentos a +1 y +3 días y cancelación; sin
 *     tarjeta guardada se renueva, una sola vez aunque el cron corra dos veces a la vez;
 *   · cuenta de cobro: VERIFYING → ACTIVE (un email) y ACTION_REQUIRED corta las ventas;
 *   · DAC7: petición, recordatorios a los 20 y 40 días y pausa de las sesiones a los 60.
 * Crea una creadora de prueba y borra todo lo que crea (y deja como estaban los datos de DAC7).
 */
import "./load-env";
import { prisma } from "../lib/db";
import { processDac7Reminders } from "../lib/dac7-data";
import { CheckoutError, createPendingOrder } from "../lib/orders";
import { paymentProvider } from "../lib/payments";
import { AMOUNT_MISMATCH, applyPaymentUpdate, processPaymentEvent, reconcileCheckout } from "../lib/payments/events";
import type { PaymentStatus, PayoutAccountSnapshot } from "../lib/payments/provider";
import { emptySnapshot } from "../lib/payments/simulated";
import { syncPayoutAccount } from "../lib/payouts";
import { processRenewals } from "../lib/subscriptions";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `pagos-${Date.now()}`;
const DAY = 86_400_000;
const STARTED = new Date();
const email = (label: string) => `${TAG}-${label}@example.com`;
const near = (d: Date | null | undefined, target: number, toleranceMs = 60_000) => !!d && Math.abs(d.getTime() - target) < toleranceMs;

const created = { orders: [] as string[], creatorId: null as string | null, creatorUserId: null as string | null };
/** Datos de DAC7 de todas las creadoras antes de empezar (el cron de recordatorios es global). */
let dac7Before: { id: string; dac7RequestedAt: Date | null; dac7RemindersSent: number; dac7LastReminderAt: Date | null }[] = [];

type OrderLike = { id: string; amountCents: number; currency: string };
const paid = (o: OrderLike, ref: string, extra: Partial<PaymentStatus> = {}): PaymentStatus => ({
  state: "succeeded",
  ref,
  amountCents: o.amountCents,
  currency: o.currency,
  destinationAccount: null,
  metadata: { orderId: o.id },
  ...extra,
});

async function newOrder(productId: string, label: string) {
  const o = await createPendingOrder({ productId, buyerEmail: email(label), buyerName: `Prueba ${label}` });
  created.orders.push(o.id);
  return o;
}

async function main() {
  check("la pasarela de la prueba es la simulada", paymentProvider().key === "simulated");
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const digital = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED" } });
  const membership = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "MEMBERSHIP", status: "PUBLISHED" } });
  dac7Before = await prisma.creator.findMany({ select: { id: true, dac7RequestedAt: true, dac7RemindersSent: true, dac7LastReminderAt: true } });

  // ── 1. Entrega simultánea: aviso repetido + vuelta de la compradora ──
  const o1 = await newOrder(digital.id, "simultaneo");
  const cs1 = `sim_cs_${TAG}_1`;
  await prisma.order.update({ where: { id: o1.id }, data: { checkoutRef: cs1 } });
  const refA = `sim_ch_${TAG}_A`;
  await Promise.all([
    applyPaymentUpdate({ kind: "payment", status: paid(o1, refA, { checkoutRef: cs1 }) }, "simulated"),
    applyPaymentUpdate({ kind: "payment", status: paid(o1, refA, { checkoutRef: cs1 }) }, "simulated"),
    reconcileCheckout(cs1),
  ]);
  let order = await prisma.order.findUniqueOrThrow({ where: { id: o1.id } });
  const charges = await prisma.transaction.count({ where: { orderId: o1.id, type: "CHARGE" } });
  const buyer = await prisma.user.findUniqueOrThrow({ where: { email: email("simultaneo") } });
  const accesses = await prisma.access.count({ where: { userId: buyer.id, productId: digital.id } });
  const receipts = await prisma.emailMessage.count({ where: { to: email("simultaneo"), template: "PURCHASE_RECEIPT" } });
  check("tres entregas a la vez: pedido PAID con la referencia del cobro", order.status === "PAID" && order.paymentRef === refA, order);
  check("una sola transacción CHARGE", charges === 1, charges);
  check("un solo acceso", accesses === 1, accesses);
  check("un solo recibo", receipts === 1, receipts);
  check("la cuenta de la compradora la creó esta compra", order.createdBuyerAccount);

  // ── 2. Segundo cobro del mismo pedido → reembolso automático ──
  const provider = paymentProvider();
  const realRefund = provider.refund;
  const refunds: string[] = [];
  provider.refund = async (i) => {
    refunds.push(i.paymentRef);
    return realRefund(i);
  };
  try {
    const refB = `sim_ch_${TAG}_B`;
    await applyPaymentUpdate({ kind: "payment", status: paid(o1, refB) }, "simulated");
    await applyPaymentUpdate({ kind: "payment", status: paid(o1, refB) }, "simulated");
    order = await prisma.order.findUniqueOrThrow({ where: { id: o1.id } });
    check("cobro duplicado: se pide el reembolso del segundo cobro", refunds.length >= 1 && refunds.every((r) => r === refB), refunds);
    check("cobro duplicado: no hay otra CHARGE y el pedido conserva su cobro", (await prisma.transaction.count({ where: { orderId: o1.id, type: "CHARGE" } })) === 1 && order.paymentRef === refA);
  } finally {
    provider.refund = realRefund;
  }

  // ── 3. El mismo aviso dos veces (también a la vez) se aplica una vez ──
  const o2 = await newOrder(digital.id, "aviso");
  const eventId = `sim_evt_${TAG}`;
  const update = { kind: "payment" as const, status: paid(o2, `sim_ch_${TAG}_C`) };
  await Promise.all([
    processPaymentEvent("simulated", eventId, "simulado.prueba", null, [update]),
    processPaymentEvent("simulated", eventId, "simulado.prueba", null, [update]),
  ]);
  const again = await processPaymentEvent("simulated", eventId, "simulado.prueba", null, [update]);
  const events = await prisma.paymentEvent.findMany({ where: { provider: "simulated", eventId } });
  check("aviso repetido: una sola fila PROCESSED ligada al pedido", events.length === 1 && events[0].status === "PROCESSED" && events[0].orderId === o2.id, events);
  check("aviso repetido: la tercera vez ni se aplica", again.duplicate);
  check("aviso repetido: una sola CHARGE", (await prisma.transaction.count({ where: { orderId: o2.id, type: "CHARGE" } })) === 1);

  // ── 4. Guardián de importe ──
  const o3 = await newOrder(digital.id, "importe");
  await applyPaymentUpdate({ kind: "payment", status: paid(o3, `sim_ch_${TAG}_D`, { amountCents: o3.amountCents - 100 }) }, "simulated");
  order = await prisma.order.findUniqueOrThrow({ where: { id: o3.id } });
  check("otro importe: el pedido no se paga y queda marcado", order.status === "PENDING" && order.paymentError === AMOUNT_MISMATCH, order);
  check("otro importe: no hay acceso ni cobro", (await prisma.transaction.count({ where: { orderId: o3.id } })) === 0 && (await prisma.access.count({ where: { orderId: o3.id } })) === 0);
  await applyPaymentUpdate({ kind: "payment", status: paid(o3, `sim_ch_${TAG}_E`, { destinationAccount: "sim_acct_otra" }) }, "simulated");
  check("otra cuenta de destino: tampoco se paga", (await prisma.order.findUniqueOrThrow({ where: { id: o3.id } })).status === "PENDING");

  // ── 5. Renovación con una tarjeta que falla ──
  const o4 = await newOrder(membership.id, "renueva-falla");
  await applyPaymentUpdate({ kind: "payment", status: paid(o4, `sim_ch_${TAG}_F`, { customerRef: `sim_cus_${TAG}`, paymentMethodRef: "sim_pm_0341" }) }, "simulated");
  let sub = await prisma.subscription.findFirstOrThrow({ where: { productId: membership.id, customer: { email: email("renueva-falla") } } });
  check("la membresía guarda la tarjeta para renovar", sub.providerPaymentMethodRef === "sim_pm_0341" && sub.providerCustomerRef === `sim_cus_${TAG}`, sub);
  const due = new Date(Date.now() - 60_000);
  await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: due } });
  await processRenewals();
  sub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
  let access = await prisma.access.findFirstOrThrow({ where: { subscriptionId: sub.id } });
  check("1er fallo: PAST_DUE con 1 intento y reintento mañana", sub.status === "PAST_DUE" && sub.renewalAttempts === 1 && near(sub.nextRenewalAttemptAt, Date.now() + DAY), sub);
  check("1er fallo: mantiene el acceso hasta el reintento", access.status === "ACTIVE" && near(access.expiresAt, Date.now() + DAY), access);
  check("1er fallo: email con «Pagar ahora»", (await prisma.emailMessage.count({ where: { to: email("renueva-falla"), template: "RENEWAL_FAILED" } })) === 1);
  await prisma.subscription.update({ where: { id: sub.id }, data: { nextRenewalAttemptAt: new Date(Date.now() - 1000) } });
  await processRenewals();
  sub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
  check("2º fallo: 2 intentos y reintento a los 3 días", sub.status === "PAST_DUE" && sub.renewalAttempts === 2 && near(sub.nextRenewalAttemptAt, Date.now() + 3 * DAY), sub);
  await prisma.subscription.update({ where: { id: sub.id }, data: { nextRenewalAttemptAt: new Date(Date.now() - 1000) } });
  await processRenewals();
  sub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
  access = await prisma.access.findFirstOrThrow({ where: { subscriptionId: sub.id } });
  check("3er fallo: cancelada y sin acceso", sub.status === "CANCELED" && access.status === "REVOKED", { sub: sub.status, access: access.status });
  check("ningún fallo ha creado una RENEWAL", (await prisma.transaction.count({ where: { subscriptionId: sub.id, type: "RENEWAL" } })) === 0);

  // ── 6. Renovación sin tarjeta guardada (como las del seed), con el cron dos veces a la vez ──
  const o5 = await newOrder(membership.id, "renueva-ok");
  await applyPaymentUpdate({ kind: "payment", status: paid(o5, `sim_ch_${TAG}_G`) }, "simulated");
  let sub2 = await prisma.subscription.findFirstOrThrow({ where: { productId: membership.id, customer: { email: email("renueva-ok") } } });
  const due2 = new Date(Date.now() - 60_000);
  await prisma.subscription.update({ where: { id: sub2.id }, data: { currentPeriodEnd: due2 } });
  await Promise.all([processRenewals(), processRenewals()]);
  sub2 = await prisma.subscription.findUniqueOrThrow({ where: { id: sub2.id } });
  const renewals = await prisma.transaction.count({ where: { subscriptionId: sub2.id, type: "RENEWAL" } });
  check("sin tarjeta guardada: se renueva (periodo nuevo)", sub2.status === "ACTIVE" && sub2.currentPeriodStart.getTime() === due2.getTime() && sub2.currentPeriodEnd > new Date(), sub2);
  check("dos crons a la vez: una sola RENEWAL", renewals === 1, renewals);

  // ── 7. Cuenta de cobro de una creadora nueva ──
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: ana.planId } });
  const creatorUser = await prisma.user.create({ data: { email: email("creadora"), name: "Creadora de prueba" } });
  created.creatorUserId = creatorUser.id;
  const accountId = `sim_acct_${TAG}`;
  const creator = await prisma.creator.create({
    data: {
      userId: creatorUser.id,
      username: TAG,
      displayName: "Creadora de prueba",
      planId: plan.id,
      pageDraft: {},
      referralCode: TAG.toUpperCase(),
      published: true,
      onboardedAt: new Date(),
      payoutProvider: "simulated",
      payoutAccountId: accountId,
      payoutStatus: "PENDING",
      // Identidad legal completa (sin ella no se vende); los datos de DAC7 siguen sin completar.
      legalName: "Creadora de Prueba", legalTaxId: "12345678Z", legalAddress: "Calle de Prueba 1", legalPostalCode: "28001",
      legalCity: "Madrid", legalEmail: email("legal"),
    },
  });
  created.creatorId = creator.id;
  const [session, tagDigital] = await Promise.all([
    prisma.product.create({ data: { creatorId: creator.id, type: "SESSION", status: "PUBLISHED", slug: "sesion", title: "Sesión de prueba", priceCents: 5000, durationMin: 60 } }),
    prisma.product.create({ data: { creatorId: creator.id, type: "DIGITAL", status: "PUBLISHED", slug: "guia", title: "Guía de prueba", priceCents: 1500 } }),
  ]);
  const snap = (o: Partial<PayoutAccountSnapshot>) => ({ ...emptySnapshot(accountId), detailsSubmitted: true, ...o });
  check("verificando: estado VERIFYING", (await syncPayoutAccount(accountId, snap({ pendingVerification: ["individual.verification.document"] }))) === "VERIFYING");
  let c = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
  check("verificando: aún no puede cobrar", !c.payoutChargesEnabled && !c.payoutConnectedAt);
  await syncPayoutAccount(accountId, snap({ chargesEnabled: true, payoutsEnabled: true }));
  c = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
  const connectedAt = c.payoutConnectedAt;
  check("activada: ACTIVE y fecha de la primera activación", c.payoutStatus === "ACTIVE" && c.payoutChargesEnabled && !!connectedAt, c.payoutStatus);
  await syncPayoutAccount(accountId, snap({ chargesEnabled: true, payoutsEnabled: true }));
  c = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
  check("sincronizar otra vez no cambia la fecha de activación", c.payoutConnectedAt?.getTime() === connectedAt?.getTime());
  check("un solo email de «Ya puedes cobrar»", (await prisma.emailMessage.count({ where: { creatorId: creator.id, template: "PAYOUT_ACTIVE" } })) === 1);
  const sold = await newOrder(tagDigital.id, "creadora-activa").then(() => true, () => false);
  check("activada: se puede comprar", sold);
  await syncPayoutAccount(accountId, snap({ currentlyDue: ["individual.verification.document"], disabledReason: "requirements.past_due" }));
  c = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
  check("Stripe pide un documento: ACTION_REQUIRED", c.payoutStatus === "ACTION_REQUIRED" && !c.payoutChargesEnabled);
  check("y se avisa por email", (await prisma.emailMessage.count({ where: { creatorId: creator.id, template: "PAYOUT_ACTION_REQUIRED" } })) === 1);
  const blocked = await newOrder(tagDigital.id, "creadora-pausada").then(
    () => "vendió",
    (e) => (e instanceof CheckoutError ? e.message : String(e)),
  );
  check("sin poder cobrar, nadie puede comprar", blocked.includes("todavía no ha activado los pagos"), blocked);
  await syncPayoutAccount(accountId, snap({ chargesEnabled: true, payoutsEnabled: true }));

  // ── 8. DAC7: petición, recordatorios y pausa de las sesiones ──
  await prisma.order.create({
    data: {
      creatorId: creator.id,
      productId: session.id,
      productTitle: session.title,
      productType: "SESSION",
      buyerEmail: email("dac7"),
      amountCents: 5000,
      platformFeeCents: 250,
      netCents: 4750,
      commissionBps: 500,
      status: "PAID",
      paidAt: new Date(),
      paymentProvider: "simulated",
    },
  }).then((o) => created.orders.push(o.id));
  const dac7Mails = () => prisma.emailMessage.count({ where: { creatorId: creator.id, template: "DAC7_REQUEST" } });
  await processDac7Reminders();
  c = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
  check("primera venta declarable sin datos: se piden (email 0)", !!c.dac7RequestedAt && c.dac7RemindersSent === 0 && (await dac7Mails()) === 1);
  await processDac7Reminders();
  check("el mismo día no se repite", (await dac7Mails()) === 1);
  await prisma.creator.update({ where: { id: creator.id }, data: { dac7RequestedAt: new Date(Date.now() - 20 * DAY) } });
  await processDac7Reminders();
  c = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
  check("a los 20 días: primer recordatorio", c.dac7RemindersSent === 1 && (await dac7Mails()) === 2, c.dac7RemindersSent);
  await prisma.creator.update({ where: { id: creator.id }, data: { dac7RequestedAt: new Date(Date.now() - 40 * DAY), dac7LastReminderAt: new Date(Date.now() - 20 * DAY) } });
  await processDac7Reminders();
  c = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
  check("a los 40 días: segundo recordatorio", c.dac7RemindersSent === 2 && (await dac7Mails()) === 3, c.dac7RemindersSent);
  await prisma.creator.update({ where: { id: creator.id }, data: { dac7RequestedAt: new Date(Date.now() - 60 * DAY), dac7LastReminderAt: new Date(Date.now() - 20 * DAY) } });
  await processDac7Reminders();
  check("no hay tercer recordatorio", (await dac7Mails()) === 3);
  const sessionSale = await newOrder(session.id, "dac7-sesion").then(
    () => "vendió",
    (e) => (e instanceof CheckoutError ? e.message : String(e)),
  );
  check("a los 60 días: las sesiones se pausan", sessionSale.includes("no está disponible temporalmente"), sessionSale);
  check("los productos digitales se siguen vendiendo", await newOrder(tagDigital.id, "dac7-digital").then(() => true, () => false));
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  check("María (datos completos) no recibe nada", (await prisma.emailMessage.count({ where: { creatorId: maria.id, template: "DAC7_REQUEST", createdAt: { gte: STARTED } } })) === 0);
}

async function cleanup() {
  const buyers = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = buyers.map((u) => u.id);
  const subs = (await prisma.subscription.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((s) => s.id);
  const orderIds = created.orders;
  const customerIds = (await prisma.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((c) => c.id);
  const byPayload = [
    ...orderIds.map((id) => ({ payload: { path: ["orderId"], equals: id } })),
    ...subs.map((id) => ({ payload: { path: ["subscriptionId"], equals: id } })),
    ...customerIds.map((id) => ({ payload: { path: ["customerId"], equals: id } })),
  ];
  await prisma.$transaction([
    prisma.paymentEvent.deleteMany({ where: { OR: [{ eventId: { startsWith: `sim_evt_${TAG}` } }, { orderId: { in: orderIds } }] } }),
    prisma.outboxEvent.deleteMany({ where: { OR: byPayload.length ? byPayload : [{ id: "" }] } }),
    prisma.emailMessage.deleteMany({
      where: {
        OR: [
          { to: { startsWith: TAG } },
          ...(created.creatorId ? [{ creatorId: created.creatorId }] : []),
          { template: "DAC7_REQUEST", createdAt: { gte: STARTED } },
          ...orderIds.map((id) => ({ dedupeKey: { contains: id } })),
        ],
      },
    }),
    prisma.access.deleteMany({ where: { userId: { in: userIds } } }),
    // Facturas de las compras de prueba (primero se sueltan las F3/rectificativas de su original).
    prisma.invoice.updateMany({ where: { recipientEmail: { startsWith: TAG } }, data: { relatedInvoiceId: null } }),
    prisma.invoice.deleteMany({ where: { recipientEmail: { startsWith: TAG } } }),
    prisma.transaction.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { subscriptionId: { in: subs } }] } }),
    prisma.subscription.deleteMany({ where: { id: { in: subs } } }),
    prisma.analyticsEvent.deleteMany({ where: { OR: [{ visitorId: { in: userIds.map((id) => `user:${id}`) } }, ...(created.creatorId ? [{ creatorId: created.creatorId }] : [])] } }),
    prisma.order.deleteMany({ where: { OR: [{ id: { in: orderIds } }, ...(created.creatorId ? [{ creatorId: created.creatorId }] : [])] } }),
    prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.product.deleteMany({ where: { creatorId: created.creatorId ?? "" } }),
    prisma.creator.deleteMany({ where: { id: created.creatorId ?? "" } }),
    prisma.user.deleteMany({ where: { id: { in: [...userIds, ...(created.creatorUserId ? [created.creatorUserId] : [])] } } }),
    // El cron de DAC7 recorre todas las creadoras: se deja todo como estaba.
    ...dac7Before.map((c) =>
      prisma.creator.updateMany({
        where: { id: c.id },
        data: { dac7RequestedAt: c.dac7RequestedAt, dac7RemindersSent: c.dac7RemindersSent, dac7LastReminderAt: c.dac7LastReminderAt },
      }),
    ),
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
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nLos pagos se entregan una vez, se protegen y se renuevan bien ✓");
    process.exit(failures ? 1 : 0);
  });
