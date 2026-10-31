/**
 * Revisión 0 · pagos de membresías, reembolsos y contracargos de renovaciones, entrega y recuperación.
 *   npx tsx --conditions=react-server scripts/revision-0-test.ts      (BD sembrada, pasarela simulada)
 *
 *   · el aviso de la sesión llega sin tarjeta y el del PaymentIntent después: la membresía la guarda;
 *   · dos cobros del mismo periodo de renovación: el segundo se devuelve; el mismo aviso repetido no;
 *     un cobro para una suscripción cancelada mientras pagaba, también se devuelve;
 *   · un reembolso hecho fuera de Cirella sobre una renovación se contabiliza (fila REFUND,
 *     rectificativa) una sola vez y, si es la renovación en curso entera, termina la membresía;
 *   · un contracargo abierto sobre una renovación avisa a la creadora;
 *   · dos pedidos pagados de la misma membresía: una sola suscripción y el segundo se reembolsa;
 *   · a quien ya es miembro no se le manda «¿Te quedaste a medias?»;
 *   · la factura completa no acepta otro país que el de la compra;
 *   · markFirstAccess anota el primer acceso una sola vez (desde ahí vale la renuncia).
 * Crea compradoras de prueba sobre Ana (seed) y borra todo lo que crea.
 */
import "./load-env";
import Module from "node:module";
import { prisma } from "../lib/db";
import { emitAbandoned } from "../lib/abandoned";
import { InvoiceError, issueFullInvoiceForOrder } from "../lib/invoices/issue";
import { createPendingOrder } from "../lib/orders";
import { paymentProvider } from "../lib/payments";
import { applyPaymentUpdate } from "../lib/payments/events";
import type { PaymentStatus } from "../lib/payments/provider";
import { renewalPeriodKey } from "../lib/payments/renewal";
import { accessStartedAt } from "../lib/refund-math";

// lib/buyer-access importa next/navigation, que no carga fuera de Next con react-server: un doble.
const req = Module.createRequire(__filename);
const navigation = req.resolve("next/navigation");
req.cache[navigation] = {
  id: navigation,
  filename: navigation,
  loaded: true,
  exports: { notFound: () => { throw new Error("notFound"); }, redirect: () => { throw new Error("redirect"); } },
} as unknown as NodeJS.Module;

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `rev0-${Date.now()}`;
const email = (label: string) => `${TAG}-${label}@example.com`;
const created = { orders: [] as string[] };

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

async function newOrder(productId: string, label: string, extra: { buyerCountry?: string } = {}) {
  const o = await createPendingOrder({ productId, buyerEmail: email(label), buyerName: `Prueba ${label}`, ...extra });
  created.orders.push(o.id);
  return o;
}

async function main() {
  check("la pasarela de la prueba es la simulada", paymentProvider().key === "simulated");
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" }, include: { user: true } });
  const digital = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", deliveryMode: "AUTOMATIC" } });
  const membership = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "MEMBERSHIP", status: "PUBLISHED" } });

  const provider = paymentProvider();
  const realRefund = provider.refund;
  const refunds: string[] = [];
  provider.refund = async (i) => {
    refunds.push(i.paymentRef);
    return realRefund(i);
  };
  try {
    // ── 1. Aviso de la sesión sin tarjeta, después el del PaymentIntent con ella ──
    const o1 = await newOrder(membership.id, "miembro");
    const ref1 = `sim_ch_${TAG}_1`;
    await applyPaymentUpdate({ kind: "payment", status: paid(o1, ref1, { customerRef: `sim_cus_${TAG}` }) }, "simulated");
    let sub = await prisma.subscription.findFirstOrThrow({ where: { productId: membership.id, customer: { email: email("miembro") } } });
    check("la sesión sin PaymentIntent expandido no trae la tarjeta", sub.providerPaymentMethodRef === null, sub.providerPaymentMethodRef);
    await applyPaymentUpdate({ kind: "payment", status: paid(o1, ref1, { customerRef: `sim_cus_${TAG}`, paymentMethodRef: `sim_pm_${TAG}` }) }, "simulated");
    sub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    check("el aviso del PaymentIntent del mismo cobro guarda la tarjeta para renovar", sub.providerPaymentMethodRef === `sim_pm_${TAG}`, sub.providerPaymentMethodRef);
    check("…sin reembolsar nada (es el mismo cobro)", refunds.length === 0, refunds);

    // ── 2. Dos cobros del mismo periodo de renovación («Pagar ahora» + reintento automático) ──
    const due = new Date(Date.now() - 60_000);
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE", currentPeriodEnd: due, renewalAttempts: 1 } });
    const periodKey = renewalPeriodKey(due);
    const renewal = (ref: string, extra: Partial<PaymentStatus> = {}): PaymentStatus => ({
      state: "succeeded",
      ref,
      amountCents: sub.priceCents,
      currency: "EUR",
      destinationAccount: null,
      metadata: { subscriptionId: sub.id, periodKey, kind: "pay_now" },
      ...extra,
    });
    const refA = `sim_ch_${TAG}_A`;
    const refB = `sim_ch_${TAG}_B`;
    await applyPaymentUpdate({ kind: "payment", status: renewal(refA) }, "simulated");
    sub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    check("primer cobro del periodo: se renueva", sub.status === "ACTIVE" && sub.currentPeriodEnd > new Date(), sub);
    await applyPaymentUpdate({ kind: "payment", status: renewal(refA, { paymentMethodRef: `sim_pm_${TAG}_nueva` }) }, "simulated");
    sub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    check("el mismo cobro avisado otra vez no se devuelve", !refunds.includes(refA), refunds);
    check("…y guarda la tarjeta con la que pagó la renovación", sub.providerPaymentMethodRef === `sim_pm_${TAG}_nueva`, sub.providerPaymentMethodRef);
    await applyPaymentUpdate({ kind: "payment", status: renewal(refB) }, "simulated");
    check("segundo cobro del mismo periodo: se devuelve", refunds.includes(refB), refunds);
    check("…y no crea otra renovación", (await prisma.transaction.count({ where: { subscriptionId: sub.id, type: "RENEWAL" } })) === 1);

    // ── 3. Reembolso desde el panel de Stripe de la renovación en curso ──
    const renewalTx = await prisma.transaction.findFirstOrThrow({ where: { subscriptionId: sub.id, type: "RENEWAL", providerRef: refA } });
    const refundUpdate = { kind: "refund" as const, paymentRef: refA, refundRef: `sim_re_${TAG}_1`, amountCents: renewalTx.amountCents, status: "succeeded" as const };
    const r1 = await applyPaymentUpdate(refundUpdate, "simulated");
    await applyPaymentUpdate(refundUpdate, "simulated");
    const refundRows = await prisma.transaction.findMany({ where: { subscriptionId: sub.id, type: "REFUND" } });
    check("reembolso de una renovación: no se ignora", !r1.ignored && r1.creatorId === ana.id, r1);
    check("…una sola fila REFUND en negativo aunque el aviso se repita", refundRows.length === 1 && refundRows[0].amountCents === -renewalTx.amountCents, refundRows);
    const saleInvoice = await prisma.invoice.findUnique({ where: { dedupeKey: `sale:${renewalTx.id}` } });
    if (saleInvoice)
      check(
        "…con la rectificativa de la factura de la renovación",
        (await prisma.invoice.count({ where: { relatedInvoiceId: saleInvoice.id, type: { in: ["R1", "R5"] } } })) === 1,
      );
    sub = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    const access = await prisma.access.findFirst({ where: { subscriptionId: sub.id } });
    check("…devuelta entera la renovación en curso: la membresía termina", sub.status === "CANCELED" && access?.status === "REVOKED", { sub: sub.status, access: access?.status });

    // ── 4. Cobro de «Pagar ahora» para una suscripción ya cancelada → se devuelve ──
    const refC = `sim_ch_${TAG}_C`;
    await applyPaymentUpdate({ kind: "payment", status: { ...renewal(refC), metadata: { subscriptionId: sub.id, periodKey: renewalPeriodKey(sub.currentPeriodEnd), kind: "pay_now" } } }, "simulated");
    check("cobro para una suscripción cancelada: se devuelve", refunds.includes(refC), refunds);

    // ── 5. Contracargo abierto sobre una renovación: aviso a la creadora ──
    const disputeRef = `sim_dp_${TAG}`;
    const d = await applyPaymentUpdate({ kind: "dispute", paymentRef: refA, disputeRef, status: "OPEN", amountCents: renewalTx.amountCents }, "simulated");
    check("contracargo de una renovación: no se ignora", !d.ignored, d);
    check(
      "…y la creadora recibe el aviso",
      (await prisma.emailMessage.count({ where: { template: "DISPUTE_OPENED", dedupeKey: `dispute:${disputeRef}:${ana.userId}` } })) === 1,
    );

    // ── 6. Dos pedidos pagados de la misma membresía ──
    const o2 = await newOrder(membership.id, "doble");
    const o3 = await newOrder(membership.id, "doble");
    await applyPaymentUpdate({ kind: "payment", status: paid(o2, `sim_ch_${TAG}_D`) }, "simulated");
    await applyPaymentUpdate({ kind: "payment", status: paid(o3, `sim_ch_${TAG}_E`) }, "simulated");
    const live = await prisma.subscription.count({ where: { productId: membership.id, customer: { email: email("doble") }, status: { in: ["ACTIVE", "PAST_DUE"] } } });
    check("dos pedidos pagados: una sola suscripción viva", live === 1, live);
    const dupRefund = await prisma.refund.findFirst({ where: { orderId: o3.id } });
    check("…y el segundo pedido se reembolsa entero", !!dupRefund && dupRefund.reason === "DUPLICATE" && dupRefund.amountCents === o3.amountCents, dupRefund);

    // ── 7. Ya es miembro: sin email de recuperación ──
    const o4 = await newOrder(membership.id, "doble");
    // Su membresía la compró antes (si no, «ya lo compró después» bastaría para no escribirle).
    await prisma.order.updateMany({ where: { id: { in: [o2.id, o3.id] } }, data: { createdAt: new Date(Date.now() - 2 * 86_400_000) } });
    await prisma.order.update({ where: { id: o4.id }, data: { createdAt: new Date(Date.now() - 3 * 3600_000) } });
    await emitAbandoned(0);
    const o4After = await prisma.order.findUniqueOrThrow({ where: { id: o4.id } });
    check("pedido bloqueado por «Ya eres miembro»: abandonado sin email", o4After.status === "ABANDONED" && o4After.recoverySkipped === "ya-miembro", {
      status: o4After.status,
      skipped: o4After.recoverySkipped,
    });
    check("…ningún «¿Te quedaste a medias?»", (await prisma.emailMessage.count({ where: { template: "ABANDONED_CHECKOUT", to: email("doble") } })) === 0);

    // ── 8. Factura completa: el país es el de la compra ──
    const o5 = await newOrder(digital.id, "factura", { buyerCountry: "ES" });
    await applyPaymentUpdate({ kind: "payment", status: paid(o5, `sim_ch_${TAG}_F`) }, "simulated");
    const wrong = await issueFullInvoiceForOrder(o5.id, { name: "Société Lune", taxId: "FR12345678901", address: "1 rue de la Paix, Paris", country: "FR" }).then(
      () => "emitida",
      (e) => (e instanceof InvoiceError ? e.message : String(e)),
    );
    check("factura con otro país que el de la compra: no se emite", wrong.includes("debe ser el de la compra"), wrong);

    // ── 9. Primer acceso (descarga, publicaciones): se anota una vez ──
    const buyer = await prisma.user.findUniqueOrThrow({ where: { email: email("factura") } });
    const before = await prisma.order.findUniqueOrThrow({ where: { id: o5.id } });
    check("recién comprado: sin primer acceso", accessStartedAt(before.metadata) === null, before.metadata);
    const { markFirstAccess } = await import("../lib/buyer-access");
    await markFirstAccess(buyer.id, digital.id);
    const first = accessStartedAt((await prisma.order.findUniqueOrThrow({ where: { id: o5.id } })).metadata);
    await new Promise((r) => setTimeout(r, 20));
    await markFirstAccess(buyer.id, digital.id);
    const again = accessStartedAt((await prisma.order.findUniqueOrThrow({ where: { id: o5.id } })).metadata);
    check("primer acceso anotado", !!first);
    check("…y no se mueve al volver a entrar", !!first && again?.getTime() === first.getTime(), { first, again });
  } finally {
    provider.refund = realRefund;
  }
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
  const txIds = (await prisma.transaction.findMany({ where: { OR: [{ orderId: { in: orderIds } }, { subscriptionId: { in: subs } }] }, select: { id: true } })).map((t) => t.id);
  await prisma.$transaction([
    prisma.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.outboxEvent.deleteMany({ where: { OR: byPayload.length ? byPayload : [{ id: "" }] } }),
    prisma.emailMessage.deleteMany({
      where: { OR: [{ to: { startsWith: TAG } }, { dedupeKey: { contains: TAG } }, ...orderIds.map((id) => ({ dedupeKey: { contains: id } }))] },
    }),
    prisma.access.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.invoice.updateMany({ where: { OR: [{ recipientEmail: { startsWith: TAG } }, { orderId: { in: orderIds } }] }, data: { relatedInvoiceId: null } }),
    prisma.invoice.deleteMany({ where: { OR: [{ recipientEmail: { startsWith: TAG } }, { orderId: { in: orderIds } }, { dedupeKey: { in: txIds.map((id) => `sale:${id}`) } }] } }),
    prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.transaction.deleteMany({ where: { id: { in: txIds } } }),
    prisma.subscription.deleteMany({ where: { id: { in: subs } } }),
    prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: userIds.map((id) => `user:${id}`) } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.orderLink.deleteMany({ where: { orderId: { in: orderIds } } }),
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
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nRevisión 0: pagos de membresías, reembolsos y recuperación correctos ✓");
    process.exit(failures ? 1 : 0);
  });
