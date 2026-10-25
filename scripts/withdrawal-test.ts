/**
 * Desistimiento (Postgres, web personal de Ana con cobros): las reglas de lib/withdrawal.ts de punta
 * a punta.
 *   npm run test:withdrawal        (con la BD sembrada: npm run db:reset)
 *
 *   · lo digital, «Lo preparo yo», los cursos y las membresías no se pagan sin la renuncia, sea cual
 *     sea la pasarela (simulador, Stripe o PayPal), y luego no se puede desistir;
 *   · las sesiones que se pagan en la web no tienen huecos antes del día 15 (ni al comprar ni al
 *     pedirlos a mano en el pedido), con la antelación de la dueña si es mayor;
 *   · elegir o cambiar la fecha, y tras «Proponer otra fecha», cuenta desde el pago del pedido;
 *   · desistir de una sesión dentro de los 14 días: reembolso, reserva cancelada y hueco libre;
 *   · las sesiones dadas a mano («Dar una sesión o lectura») no siguen la regla;
 *   · talleres: a menos de 15 días, la casilla de servicio en plazo es obligatoria; a 15 o más, no.
 * Crea sus propios productos y pedidos y lo borra todo al terminar.
 */
import "./load-env";

// Antes de cargar la app: la configuración se lee una vez (lib/env.ts).
Object.assign(process.env, { SITE_MODE: "personal", OWNER_USERNAME: "ana", PAYMENT_PROVIDER: "simulated", EMAIL_PROVIDER: "log", STORAGE_DRIVER: "local", DEMO_MODE: "true" });

let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) {
    failures++;
    if (extra !== undefined) console.log("   ", extra);
  }
}
async function errorOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "ok";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const TAG = `desist${Date.now()}`;
const email = (n: string) => `${TAG}-${n}@example.com`;
const DAY = 86_400_000;
const CARD = { method: "card" as const, cardNumber: "4242 4242 4242 4242" };

async function main() {
  const { prisma } = await import("../lib/db");
  const { getAvailableSlots, isSlotAvailable, slotRuleForOrder } = await import("../lib/booking");
  const { requestReschedule } = await import("../lib/booking-changes");
  const { acceptedConsentFields, WAIVER_REQUIRED_ERROR } = await import("../lib/checkout-consents");
  const { WAIVER_TEXT } = await import("../lib/legal");
  const { createManualOrder } = await import("../lib/manual-orders");
  const { createPendingOrder, startOrderPayment } = await import("../lib/orders");
  const { toWithdrawalInput, withdrawalEligibility } = await import("../lib/refund-math");
  const { withdrawOrder } = await import("../lib/refunds");
  const { dateKeyInTz } = await import("../lib/tz");
  const { earliestPaidSessionStart, withdrawalDeadline } = await import("../lib/withdrawal");

  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const tz = ana.timezone;
  let n = 0;
  const mk = (data: Record<string, unknown>) =>
    prisma.product.create({
      data: { creatorId: ana.id, status: "PUBLISHED", accessMode: "PAID", priceCents: 4900, slug: `${TAG}-${++n}`, title: `${TAG} producto ${n}`, ...data } as never,
    });
  const flat = (r: Awaited<ReturnType<typeof getAvailableSlots>>) => r.days.flatMap((d) => d.slots.map((s) => s.start));
  const orderOf = (id: string) => prisma.order.findUniqueOrThrow({ where: { id }, include: { bookings: true, refunds: true, customer: true } });
  const eligibility = async (id: string, now = new Date()) => withdrawalEligibility(toWithdrawalInput({ ...(await orderOf(id)), timezone: tz }), now);
  const pending = (productId: string, label: string, slotStart?: string) =>
    createPendingOrder({ productId, buyerEmail: email(label), buyerName: `Prueba ${label}`, buyerCountry: "ES", slotStart });
  const onlyTerms = (id: string) => prisma.order.update({ where: { id }, data: { termsAcceptedAt: new Date() } });

  // ── 1. Renuncia obligatoria en todo lo de pago que no es una sesión, con cualquier pasarela ──
  const digital = await mk({ type: "DIGITAL", deliveryMode: "AUTOMATIC" });
  const reading = await mk({ type: "DIGITAL", deliveryMode: "PERSONAL", instructions: "Te la envío en 72 horas." });
  const course = await mk({ type: "COURSE" });
  const membership = await mk({ type: "MEMBERSHIP", billingInterval: "month", priceCents: 1900 });
  for (const [label, product, kind] of [
    ["descarga", digital, "DIGITAL_IMMEDIATE"],
    ["lectura «Lo preparo yo»", reading, "DIGITAL_PREPARED"],
    ["curso", course, "DIGITAL_IMMEDIATE"],
    ["membresía", membership, "DIGITAL_IMMEDIATE"],
  ] as const) {
    const o = await pending(product.id, `w-${product.id}`);
    await onlyTerms(o.id);
    for (const provider of ["simulated", "stripe", "paypal"]) {
      await prisma.order.update({ where: { id: o.id }, data: { paymentProvider: provider } });
      const msg = await errorOf(() => startOrderPayment(o.id, CARD));
      const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      check(`${label} con ${provider}: sin la renuncia no se cobra`, msg === WAIVER_REQUIRED_ERROR[kind] && after.status === "PENDING" && !after.checkoutRef && !after.paidAt, { msg, status: after.status });
    }
    await prisma.order.update({ where: { id: o.id }, data: { paymentProvider: "simulated", waiverKind: kind, waiverText: "Quiero acceder ya (texto de otra versión)", waiverAcceptedAt: new Date() } });
    check(`${label}: con un texto que no es el vigente tampoco`, (await errorOf(() => startOrderPayment(o.id, CARD))) === WAIVER_REQUIRED_ERROR[kind]);
    await prisma.order.update({ where: { id: o.id }, data: acceptedConsentFields(product, new Date(), tz) });
    const r = await startOrderPayment(o.id, CARD);
    const paid = await orderOf(o.id);
    check(
      `${label}: con la renuncia se paga y guarda la prueba (hora, texto literal y versión)`,
      r.kind === "paid" && paid.status === "PAID" && paid.waiverKind === kind && paid.waiverText === WAIVER_TEXT[kind] && /^\d{4}-\d{2}-\d{2}#[0-9a-f]{16}$/.test(paid.waiverVersion ?? "") && !!paid.waiverAcceptedAt,
      { kind: r.kind, waiverKind: paid.waiverKind, waiverVersion: paid.waiverVersion },
    );
    const e = await eligibility(o.id);
    check(`${label}: no se puede desistir (ni sin haberlo abierto)`, !e.eligible && e.reason === "WAIVED", e);
    const w = await withdrawOrder({ orderId: o.id, userId: paid.customer!.userId!, email: paid.buyerEmail });
    check(`${label}: «Desistir» lo rechaza en el servidor`, !w.ok && w.code === "NOT_REFUNDABLE" && (await orderOf(o.id)).status === "PAID", w);
  }

  // ── 2. Sesiones pagadas en la web: nada antes del día 15 ──
  const P = await mk({ type: "SESSION", priceCents: 6000, durationMin: 60, bufferMin: 0, minNoticeHours: 24, horizonDays: 56, title: `${TAG} sesión` });
  const now = new Date();
  const day15 = earliestPaidSessionStart(now, tz);
  const shop = await getAvailableSlots(P);
  const starts = flat(shop);
  check("checkout: hay huecos y ninguno antes del día 15 (aunque la sesión diga 24 h)", starts.length > 0 && starts.every((s) => Date.parse(s) >= day15.getTime()), { first: starts[0], day15 });
  check("checkout: la respuesta dice desde cuándo (notBefore = 00:00 del día 15)", shop.notBefore === day15.toISOString() && dateKeyInTz(day15, tz) > dateKeyInTz(withdrawalDeadline(now, tz), tz), shop.notBefore);
  const manualStarts = flat(await getAvailableSlots(P, { manual: true }));
  const early = manualStarts.find((s) => Date.parse(s) < day15.getTime() && Date.parse(s) > now.getTime() + 3 * DAY);
  check("a mano la dueña sí ve huecos antes del día 15", !!early, manualStarts.slice(0, 3));
  check("un hueco antes del día 15 no se acepta al comprar", !!early && !(await isSlotAvailable(P, early)) && /acaba de ocuparse/.test(await errorOf(() => pending(P.id, "early", early))));
  const P21 = await mk({ type: "SESSION", durationMin: 60, bufferMin: 0, minNoticeHours: 21 * 24, horizonDays: 56, title: `${TAG} sesión 21` });
  const s21 = flat(await getAvailableSlots(P21));
  check("con 21 días de antelación, nada antes del día 21", s21.length > 0 && s21.every((s) => Date.parse(s) >= earliestPaidSessionStart(now, tz, 21).getTime()), s21[0]);
  const P14 = await mk({ type: "SESSION", durationMin: 60, bufferMin: 0, minNoticeHours: 24, horizonDays: 14, title: `${TAG} sesión 14` });
  check("con el horizonte de 2 semanas, igualmente hay dos semanas para elegir a partir del día 15", flat(await getAvailableSlots(P14)).length > 0);

  // ── 3. Comprar una sesión: sin renuncia, con los 14 días y la fecha a partir del día 15 ──
  const slot = (i: number) => starts[Math.min(starts.length - 1, i * 4)];
  const s1 = await pending(P.id, "sesion1", slot(0));
  await onlyTerms(s1.id);
  const r1 = await startOrderPayment(s1.id, CARD);
  let o1 = await orderOf(s1.id);
  check("sesión: se paga sin casilla de renuncia y queda confirmada el día elegido", r1.kind === "paid" && !o1.waiverKind && o1.bookings[0]?.status === "CONFIRMED" && o1.bookings[0]?.startAt?.toISOString() === slot(0));
  const e1 = await eligibility(s1.id);
  check("sesión: se puede desistir hasta el final del día 14 (justo antes de la primera hora posible)", e1.eligible && e1.deadline.getTime() === withdrawalDeadline(o1.paidAt!, tz).getTime() && e1.deadline.getTime() < Date.parse(slot(0)), e1);
  check("sesión: pasado el día 14, ya no", (await eligibility(s1.id, new Date(withdrawalDeadline(o1.paidAt!, tz).getTime() + 1))).eligible === false);
  check("su hora ya no se ofrece", !(await isSlotAvailable(P, slot(0))));
  const w1 = await withdrawOrder({ orderId: s1.id, userId: o1.customer!.userId!, email: o1.buyerEmail });
  o1 = await orderOf(s1.id);
  check("«Desistir» dentro de los 14 días: reembolso, reserva cancelada y hueco libre", w1.ok && o1.status === "REFUNDED" && o1.bookings[0]?.status === "CANCELLED" && (await isSlotAvailable(P, slot(0))), { w1, status: o1.status });

  // ── 4. Elegir o cambiar la fecha después: cuenta desde el pago del pedido ──
  const s2 = await pending(P.id, "sesion2", slot(2));
  await onlyTerms(s2.id);
  await startOrderPayment(s2.id, CARD);
  // Como si lo hubiera pagado hace 10 días: el día 15 de su compra es dentro de 5.
  const paidAt = new Date(Date.now() - 10 * DAY);
  await prisma.order.update({ where: { id: s2.id }, data: { paidAt } });
  let o2 = await orderOf(s2.id);
  const rule = slotRuleForOrder(o2);
  const mine = await getAvailableSlots(P, rule);
  const mineStarts = flat(mine);
  const ownDay15 = earliestPaidSessionStart(paidAt, tz);
  check("su calendario empieza el día 15 desde SU pago (antes que el de quien compra hoy)", mine.notBefore === ownDay15.toISOString() && mineStarts.every((s) => Date.parse(s) >= ownDay15.getTime()) && mineStarts.some((s) => Date.parse(s) < day15.getTime()), { notBefore: mine.notBefore, first: mineStarts[0] });
  const between = mineStarts.find((s) => Date.parse(s) < day15.getTime());
  check("ese hueco vale para su reserva pero no para una compra nueva", !!between && (await isSlotAvailable(P, between, rule)) && !(await isSlotAvailable(P, between)));
  const beforeHers = manualStarts.find((s) => Date.parse(s) < ownDay15.getTime() && Date.parse(s) > Date.now() + 2 * DAY);
  check("…y uno antes del día 15 de su compra, no", !beforeHers || !(await isSlotAvailable(P, beforeHers, rule)));
  const prop = await requestReschedule({ creatorId: ana.id, bookingId: o2.bookings[0]!.id, note: "¿Te va otro día?" });
  o2 = await orderOf(s2.id);
  check("«Proponer otra fecha»: la reserva queda pendiente y la regla sigue siendo la de su pago", prop.ok && o2.bookings[0]?.status === "PENDING_SCHEDULE" && (await getAvailableSlots(P, slotRuleForOrder(o2))).notBefore === ownDay15.toISOString());
  await prisma.order.update({ where: { id: s2.id }, data: { paidAt: new Date(Date.now() - 30 * DAY) } });
  const late = await getAvailableSlots(P, slotRuleForOrder(await orderOf(s2.id)));
  check("con el día 15 ya pasado, la antelación es de 24 h desde ahora", flat(late).every((s) => Date.parse(s) >= Date.now() + 23.9 * 3600_000) && Date.parse(late.notBefore!) < Date.now());

  // ── 5. «Dar una sesión o lectura»: sin la regla ──
  const g = await createManualOrder({ creatorId: ana.id, grantedByUserId: ana.userId, productId: P.id, name: "Regalo", email: email("regalo"), payment: "gift", when: { kind: "slot", start: early! }, requestId: `${TAG}-gift-1` });
  check("a mano: confirmada antes del día 15", g.ok && g.status === "CONFIRMED" && (await prisma.booking.findUniqueOrThrow({ where: { id: g.ok ? g.bookingId! : "" } })).startAt?.toISOString() === early);
  const gl = await createManualOrder({ creatorId: ana.id, grantedByUserId: ana.userId, productId: P.id, name: "Luego", email: email("luego"), payment: "paid_elsewhere", paidNote: "Bizum", when: { kind: "later" }, requestId: `${TAG}-gift-2` });
  const glOrder = gl.ok ? await prisma.order.findUniqueOrThrow({ where: { id: gl.orderId } }) : null;
  const glRule = slotRuleForOrder(glOrder);
  const glSlots = await getAvailableSlots(P, glRule);
  check("a mano y «que la elija ella»: puede elegir antes del día 15", gl.ok && glRule.manual === true && glSlots.notBefore === null && flat(glSlots).some((s) => Date.parse(s) < day15.getTime()));

  // ── 6. Talleres con fecha fija ──
  const at = (days: number) => new Date(Date.now() + days * DAY);
  const W5 = await mk({ type: "SESSION", groupSession: true, eventStartAt: at(5), durationMin: 90, minNoticeHours: 0, title: `${TAG} taller 5` });
  const W20 = await mk({ type: "SESSION", groupSession: true, eventStartAt: at(20), durationMin: 90, minNoticeHours: 0, title: `${TAG} taller 20` });
  const t5 = await pending(W5.id, "taller5");
  await onlyTerms(t5.id);
  check("taller a 5 días: sin la casilla de servicio en plazo no se cobra", (await errorOf(() => startOrderPayment(t5.id, CARD))) === WAIVER_REQUIRED_ERROR.SERVICE_IN_PERIOD);
  await prisma.order.update({ where: { id: t5.id }, data: acceptedConsentFields(W5, new Date(), tz) });
  const rt5 = await startOrderPayment(t5.id, CARD);
  const ot5 = await orderOf(t5.id);
  check("taller a 5 días: con la casilla se paga y la guarda", rt5.kind === "paid" && ot5.waiverKind === "SERVICE_IN_PERIOD" && ot5.waiverText === WAIVER_TEXT.SERVICE_IN_PERIOD && !!ot5.waiverVersion);
  check("taller a 5 días: puede desistir hasta que empiece", (await eligibility(t5.id)).eligible && !(await eligibility(t5.id, at(5.1))).eligible);
  const t20 = await pending(W20.id, "taller20");
  await onlyTerms(t20.id);
  const rt20 = await startOrderPayment(t20.id, CARD);
  const ot20 = await orderOf(t20.id);
  const e20 = await eligibility(t20.id);
  check("taller a 20 días: sin casilla, con sus 14 días para desistir", rt20.kind === "paid" && !ot20.waiverKind && e20.eligible && e20.deadline < W20.eventStartAt!);
}

async function cleanup() {
  const { prisma } = await import("../lib/db");
  const products = await prisma.product.findMany({ where: { slug: { startsWith: TAG } }, select: { id: true } });
  const productIds = products.map((p) => p.id);
  const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const orders = await prisma.order.findMany({ where: { OR: [{ productId: { in: productIds } }, { buyerEmail: { startsWith: TAG } }] }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  const bookings = await prisma.booking.findMany({ where: { productId: { in: productIds } }, select: { id: true } });
  const subs = await prisma.subscription.findMany({ where: { productId: { in: productIds } }, select: { id: true } });
  const keys = [...orderIds, ...bookings.map((b) => b.id)];
  await prisma.$transaction([
    prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...keys.map((k) => ({ dedupeKey: { contains: k } })), { html: { contains: TAG } }] } }),
    prisma.outboxEvent.deleteMany({ where: { OR: keys.map((k) => ({ payload: { string_contains: k } })) } }),
    prisma.analyticsEvent.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.access.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.invoice.updateMany({ where: { orderId: { in: orderIds } }, data: { relatedInvoiceId: null } }),
    prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.transaction.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { subscriptionId: { in: subs.map((s) => s.id) } }] } }),
    prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderLink.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.session.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { userId: { in: userIds } }] } }),
    prisma.booking.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.subscription.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.product.deleteMany({ where: { id: { in: productIds } } }),
  ]);
  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await cleanup().catch((e) => {
      console.error("No se ha podido limpiar:", e);
      failures++;
    });
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nDesistimiento ✓");
    process.exit(failures ? 1 : 0);
  });
