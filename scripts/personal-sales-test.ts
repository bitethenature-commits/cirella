/**
 * Cobros de la web personal contra Postgres y un PayPal falso (scripts/paypal-mock.ts).
 *   npm run test:personal-sales        (con la BD sembrada: npm run db:reset)
 *
 * Web personal de Ana (SITE_MODE=personal) que cobra con tarjeta (simulador) y PayPal:
 *   · un pedido con PayPal: sin comisión, vende la dueña, va a PayPal y solo se cobra al aprobarlo;
 *   · la vuelta de la compradora y el aviso CHECKOUT.ORDER.APPROVED a la vez cobran y entregan una vez;
 *   · un pago aprobado de un pedido sustituido (cambió de método) no se cobra;
 *   · forma de pago rechazada en PayPal → pedido FAILED, de vuelta al checkout;
 *   · membresía con PayPal: guarda la cuenta, renueva sola con ella y un rechazo la deja PAST_DUE;
 *   · reembolso desde el panel por PayPal; un aviso con la firma mala se rechaza y uno repetido se ignora;
 *   · con tarjeta (simulador), la misma web cobra sin cuenta de cobro de Connect.
 * Crea compradoras de prueba y borra todo lo que crea.
 */
export {};

const PORT = 4019;
Object.assign(process.env, {
  SITE_MODE: "personal",
  OWNER_USERNAME: "ana",
  PAYMENT_PROVIDER: "simulated,paypal",
  PAYPAL_CLIENT_ID: "cliente-prueba",
  PAYPAL_CLIENT_SECRET: "secreto-prueba",
  PAYPAL_WEBHOOK_ID: "WH-PRUEBA",
  PAYPAL_ENV: "sandbox",
  PAYPAL_API_URL: `http://localhost:${PORT}`,
});

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `cobros-personal-${Date.now()}`;
const email = (label: string) => `${TAG}-${label}@example.com`;
const created = { orders: [] as string[] };

async function main() {
  await import("./load-env");
  const { startPaypalMock } = await import("./paypal-mock");
  const { prisma } = await import("../lib/db");
  const { createPendingOrder, startOrderPayment } = await import("../lib/orders");
  const { acceptedConsentFields } = await import("../lib/checkout-consents");
  const { paymentProviderKeys, checkoutMethods } = await import("../lib/payments");
  const { processWebhook, reconcileCheckout } = await import("../lib/payments/events");
  const { processRenewals } = await import("../lib/subscriptions");
  const { refundOrder } = await import("../lib/refunds");
  const { signupsOnly, personalSales } = await import("../lib/commerce");

  const mock = await startPaypalMock(PORT);
  const cleanup = async () => {
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
      prisma.paymentEvent.deleteMany({ where: { OR: [{ eventId: { startsWith: `WH-${TAG}` } }, { orderId: { in: orderIds } }] } }),
      prisma.outboxEvent.deleteMany({ where: { OR: byPayload.length ? byPayload : [{ id: "" }] } }),
      prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...orderIds.map((id) => ({ dedupeKey: { contains: id } }))] } }),
      prisma.access.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.invoice.updateMany({ where: { recipientEmail: { startsWith: TAG } }, data: { relatedInvoiceId: null } }),
      prisma.invoice.deleteMany({ where: { recipientEmail: { startsWith: TAG } } }),
      prisma.transaction.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { subscriptionId: { in: subs } }] } }),
      prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } }),
      prisma.subscription.deleteMany({ where: { id: { in: subs } } }),
      prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: userIds.map((id) => `user:${id}`) } } }),
      prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
      prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.loginToken.deleteMany({ where: { email: { startsWith: TAG } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ]);
  };

  const webhook = (event: object, sig = "firma-valida") => {
    const raw = JSON.stringify(event);
    return processWebhook("paypal", raw, new Headers({ "paypal-transmission-sig": sig, "paypal-transmission-id": "t", "paypal-transmission-time": "now", "paypal-cert-url": "https://api.paypal.com/c", "paypal-auth-algo": "SHA256withRSA" }));
  };

  try {
    check("la web es personal y cobra con tarjeta y PayPal", personalSales() && !signupsOnly() && paymentProviderKeys().join() === "simulated,paypal", paymentProviderKeys());
    check("el checkout ofrece los dos métodos", checkoutMethods().map((m) => m.key).join() === "simulated,paypal");

    const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
    const findPaid = (type: string) =>
      prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type, status: "PUBLISHED", accessMode: "PAID", priceCents: { gt: 0 } }, orderBy: { sortOrder: "asc" } });
    const digital = await findPaid("DIGITAL");
    const membership = await findPaid("MEMBERSHIP");

    const newOrder = async (productId: string, label: string, paymentMethod: string, buyerEmail = email(label)) => {
      const o = await createPendingOrder({ productId, buyerEmail, buyerName: `Prueba ${label}`, buyerCountry: "ES", paymentMethod });
      created.orders.push(o.id);
      // Las casillas obligatorias del checkout (condiciones y la renuncia de acceso inmediato).
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      await prisma.order.update({ where: { id: o.id }, data: acceptedConsentFields(product, new Date()) });
      return o;
    };

    // ── 1. Pedido con PayPal: sin comisión, vende la dueña, a PayPal ──
    const o1 = await newOrder(digital.id, "paypal", "paypal");
    check("pedido con PayPal: pasarela paypal, sin comisión y vende la dueña", o1.paymentProvider === "paypal" && o1.commissionBps === 0 && o1.platformFeeCents === 0 && o1.taxSeller === "CREATOR", o1);
    const r1 = await startOrderPayment(o1.id, {});
    const order1 = await prisma.order.findUniqueOrThrow({ where: { id: o1.id } });
    const ppId = order1.checkoutRef ?? "";
    check("startOrderPayment: a la página de PayPal con su pedido", r1.kind === "redirect" && r1.url === `${mock.url}/checkoutnow?token=${ppId}` && mock.orders.has(ppId), r1);
    const ppOrder = mock.orders.get(ppId);
    check("PayPal recibe el importe y el pedido de la web", ppOrder?.purchase_units[0].amount.value === (digital.priceCents / 100).toFixed(2) && ppOrder?.purchase_units[0].custom_id === `o|${o1.id}`, ppOrder?.purchase_units);
    check("la vuelta lleva via=paypal", !!ppOrder?.returnUrl?.includes("/api/payments/return?via=paypal&ref="), ppOrder?.returnUrl);

    // Sin aprobar: volver no cobra nada.
    const early = await reconcileCheckout(ppId, "paypal");
    check("sin aprobar en PayPal: sigue pendiente y no se cobra", early.state === "requires_action" && (await prisma.order.findUniqueOrThrow({ where: { id: o1.id } })).status === "PENDING");

    // ── 2. Aprobado: vuelta + aviso a la vez → un cobro y una entrega ──
    ppOrder!.status = "APPROVED";
    const approvedEvent = { id: `WH-${TAG}-1`, event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: ppId, status: "APPROVED", purchase_units: ppOrder!.purchase_units } };
    const [back, hook] = await Promise.all([reconcileCheckout(ppId, "paypal"), webhook(approvedEvent)]);
    const paid1 = await prisma.order.findUniqueOrThrow({ where: { id: o1.id } });
    const capture1 = mock.orders.get(ppId)?.purchase_units[0].payments?.captures[0];
    check("vuelta y aviso a la vez: pedido PAID con el cobro de PayPal", paid1.status === "PAID" && !!capture1 && paid1.paymentRef === capture1.id, { status: paid1.status, ref: paid1.paymentRef, capture1 });
    check("la vuelta ve el pago hecho y el aviso responde 200", back.state === "succeeded" && hook.status === 200, { back, hook });
    check("un solo cobro en PayPal (misma PayPal-Request-Id)", [...mock.requests.keys()].filter((k) => k === `capture:${ppId}`).length === 1);
    check("una sola transacción CHARGE, sin comisión", (await prisma.transaction.count({ where: { orderId: o1.id, type: "CHARGE", provider: "paypal", platformFeeCents: 0 } })) === 1);
    const buyer1 = await prisma.user.findUniqueOrThrow({ where: { email: email("paypal") } });
    check("acceso concedido", (await prisma.access.count({ where: { userId: buyer1.id, productId: digital.id, status: "ACTIVE" } })) === 1);
    check("un solo recibo por email", (await prisma.emailMessage.count({ where: { to: email("paypal"), template: "PURCHASE_RECEIPT" } })) === 1);

    // Aviso repetido del cobro: se ignora.
    const completed = { id: `WH-${TAG}-2`, event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { ...capture1, supplementary_data: { related_ids: { order_id: ppId } } } };
    await webhook(completed);
    const again = await webhook(completed);
    check("aviso de cobro repetido: «Ya recibido» y nada cambia", again.status === 200 && again.body === "Ya recibido" && (await prisma.transaction.count({ where: { orderId: o1.id, type: "CHARGE" } })) === 1, again);
    const bad = await webhook({ id: `WH-${TAG}-3`, event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} }, "firma-falsa");
    check("aviso con la firma mala → 400", bad.status === 400, bad);

    // ── 3. Pedido sustituido: un pago aprobado después no se cobra ──
    const o2 = await newOrder(digital.id, "sustituido", "paypal");
    await startOrderPayment(o2.id, {});
    const pp2 = (await prisma.order.findUniqueOrThrow({ where: { id: o2.id } })).checkoutRef!;
    await prisma.order.update({ where: { id: o2.id }, data: { status: "ABANDONED", recoverySkipped: "sustituido" } });
    mock.orders.get(pp2)!.status = "APPROVED";
    await webhook({ id: `WH-${TAG}-4`, event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: pp2, status: "APPROVED", purchase_units: mock.orders.get(pp2)!.purchase_units } });
    check("pago aprobado de un pedido sustituido: no se cobra ni se entrega", mock.orders.get(pp2)!.status === "APPROVED" && (await prisma.order.findUniqueOrThrow({ where: { id: o2.id } })).status === "ABANDONED");

    // ── 4. Forma de pago rechazada en PayPal ──
    const o3 = await newOrder(digital.id, "rechazo", "paypal", `rechaza@${TAG}.example.com`);
    created.orders.push(o3.id);
    await startOrderPayment(o3.id, {});
    const pp3 = (await prisma.order.findUniqueOrThrow({ where: { id: o3.id } })).checkoutRef!;
    mock.orders.get(pp3)!.status = "APPROVED";
    const r3 = await reconcileCheckout(pp3, "paypal");
    const failed3 = await prisma.order.findUniqueOrThrow({ where: { id: o3.id } });
    check("cobro rechazado: pedido FAILED con el motivo, sin entrega", r3.state === "failed" && failed3.status === "FAILED" && !!failed3.paymentError?.includes("PayPal"), { r3, status: failed3.status, err: failed3.paymentError });

    // ── 5. Membresía con PayPal: guarda la cuenta y renueva sola ──
    const o4 = await newOrder(membership.id, "membresia", "paypal");
    await startOrderPayment(o4.id, {});
    const pp4 = (await prisma.order.findUniqueOrThrow({ where: { id: o4.id } })).checkoutRef!;
    check("membresía: PayPal pide guardar la cuenta", mock.orders.get(pp4)!.vault === true);
    mock.orders.get(pp4)!.status = "APPROVED";
    await reconcileCheckout(pp4, "paypal");
    const buyer4 = await prisma.user.findUniqueOrThrow({ where: { email: email("membresia") } });
    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: buyer4.id, productId: membership.id } });
    check("suscripción con PayPal y la cuenta guardada", sub.provider === "paypal" && sub.providerPaymentMethodRef === `VAULT-${pp4}` && sub.providerCustomerRef === `CUS-${pp4}`, sub);
    // Vence el periodo: el cron la renueva con la cuenta guardada.
    const due = new Date(Date.now() - 60_000);
    await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: due } });
    await processRenewals();
    const renewed = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    const renewal = await prisma.transaction.findFirst({ where: { subscriptionId: sub.id, type: "RENEWAL" } });
    check("renovación cobrada por PayPal sin la clienta delante", renewed.status === "ACTIVE" && renewed.currentPeriodEnd > new Date() && renewal?.provider === "paypal" && renewal.platformFeeCents === 0, { renewed, renewal });
    // Siguiente periodo con la cuenta rechazada → PAST_DUE con reintento.
    await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: new Date(Date.now() - 30_000), providerPaymentMethodRef: "VAULT-RECHAZA" } });
    await processRenewals();
    const pastDue = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    check("renovación rechazada por PayPal → PAST_DUE con reintento y acceso mientras tanto", pastDue.status === "PAST_DUE" && pastDue.renewalAttempts === 1 && !!pastDue.nextRenewalAttemptAt, pastDue);

    // ── 6. Reembolso desde el panel por PayPal ──
    const refund = await refundOrder({ orderId: o1.id, actor: { kind: "creator", creatorId: ana.id, userId: ana.userId }, reason: "CUSTOMER_REQUEST", note: null, revokeAccess: true, cancelBooking: false });
    const refunded = await prisma.order.findUniqueOrThrow({ where: { id: o1.id } });
    check("reembolso total por PayPal: pedido REFUNDED y acceso retirado", refund.ok && refunded.status === "REFUNDED" && (await prisma.access.count({ where: { userId: buyer1.id, productId: digital.id, status: "ACTIVE" } })) === 0, { refund, status: refunded.status });
    check("PayPal devolvió el cobro entero", capture1 ? (mock.orders.get(ppId)?.purchase_units[0].payments?.captures[0] as { refunded?: number } | undefined)?.refunded === digital.priceCents : false);

    // ── 7. Con tarjeta (simulador): cobra sin cuenta de cobro de Connect ──
    const o5 = await newOrder(digital.id, "tarjeta", "simulated");
    const r5 = await startOrderPayment(o5.id, { method: "card", cardNumber: "4242424242424242" });
    const paid5 = await prisma.order.findUniqueOrThrow({ where: { id: o5.id } });
    check("tarjeta en la web personal: cobrada y entregada al momento, sin comisión", r5.kind === "paid" && paid5.status === "PAID" && paid5.platformFeeCents === 0, { r5, paid5: paid5.status });

    // ── 8. Un método que no está activo no se acepta ──
    let refused = false;
    try {
      await createPendingOrder({ productId: digital.id, buyerEmail: email("stripe"), buyerName: "x", buyerCountry: "ES", paymentMethod: "stripe" });
    } catch {
      refused = true;
    }
    check("un método de pago no activo (stripe) se rechaza", refused);
  } finally {
    await cleanup().catch((e) => {
      console.error("No se ha podido limpiar:", e);
      failures++;
    });
    await mock.close();
    await prisma.$disconnect();
  }
  if (failures) {
    console.error(`\n${failures} comprobaciones fallidas`);
    process.exit(1);
  }
  console.log("\nLa web personal cobra con tarjeta y PayPal y lo entrega todo solo ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
