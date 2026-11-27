/**
 * Desistimiento (Postgres, web personal de Cirella con cobros): las reglas de lib/withdrawal.ts de punta
 * a punta.
 *   npm run test:withdrawal        (con la BD sembrada: npm run db:reset)
 *
 *   · lo digital, «Lo preparo yo» y los cursos no se pagan sin la renuncia, sea cual sea la pasarela
 *     (simulador, Stripe o PayPal), y luego no se puede desistir;
 *   · las sesiones que se pagan en la web no tienen huecos antes del día 15 (ni al comprar ni al
 *     pedirlos a mano en el pedido), con la antelación de la dueña si es mayor;
 *   · elegir o cambiar la fecha, y tras «Proponer otra fecha», cuenta desde el pago del pedido;
 *   · desistir de una sesión dentro de los 14 días: reembolso, reserva cancelada y hueco libre;
 *   · las sesiones dadas a mano («Dar una sesión o lectura») no siguen la regla;
 *   · talleres: a 5 o a 20 días, siempre la casilla de «fecha fija, sin desistimiento» y nunca «Desistir»;
 *   · membresías: sin la casilla de empezar ya no se cobra; en los 14 días, «Desistir» devuelve la
 *     parte proporcional y termina la suscripción; después de los 14 días o ya renovada, no.
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
  const { earliestPaidSessionStart, membershipWithdrawalRefund, withdrawalDeadline } = await import("../lib/withdrawal");

  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const tz = ana.timezone;
  let n = 0;
  const mk = (data: Record<string, unknown>) =>
    prisma.product.create({
      data: { creatorId: ana.id, status: "PUBLISHED", accessMode: "PAID", priceCents: 4900, slug: `${TAG}-${++n}`, title: `${TAG} producto ${n}`, ...data } as never,
    });
  const flat = (r: Awaited<ReturnType<typeof getAvailableSlots>>) => r.days.flatMap((d) => d.slots.map((s) => s.start));
  const orderOf = (id: string) => prisma.order.findUniqueOrThrow({ where: { id }, include: { bookings: true, refunds: true, customer: true } });
  const { membershipTermsFor } = await import("../lib/refunds");
  const eligibility = async (id: string, now = new Date()) =>
    withdrawalEligibility(toWithdrawalInput({ ...(await orderOf(id)), timezone: tz, membership: (await membershipTermsFor([id])).get(id) ?? null }), now);
  const pending = (productId: string, label: string, slotStart?: string) =>
    createPendingOrder({ productId, buyerEmail: email(label), buyerName: `Prueba ${label}`, slotStart });
  const onlyTerms = (id: string) => prisma.order.update({ where: { id }, data: { termsAcceptedAt: new Date() } });

  // ── 1. Renuncia obligatoria en lo digital, con cualquier pasarela ──
  const digital = await mk({ type: "DIGITAL", deliveryMode: "AUTOMATIC" });
  const reading = await mk({ type: "DIGITAL", deliveryMode: "PERSONAL", instructions: "Te la envío en 72 horas." });
  const course = await mk({ type: "COURSE" });
  for (const [label, product, kind] of [
    ["descarga", digital, "DIGITAL_IMMEDIATE"],
    ["lectura «Lo preparo yo»", reading, "DIGITAL_PREPARED"],
    ["curso", course, "DIGITAL_IMMEDIATE"],
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
    await prisma.order.update({ where: { id: o.id }, data: acceptedConsentFields(product, new Date()) });
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

  // ── 6. Talleres con fecha fija: sin desistimiento (art. 103 l), queden los días que queden ──
  const at = (days: number) => new Date(Date.now() + days * DAY);
  for (const days of [5, 20]) {
    const W = await mk({ type: "SESSION", groupSession: true, eventStartAt: at(days), durationMin: 90, minNoticeHours: 0, title: `${TAG} taller ${days}` });
    const t = await pending(W.id, `taller${days}`);
    await onlyTerms(t.id);
    check(`taller a ${days} días: sin la casilla de fecha fija no se cobra`, (await errorOf(() => startOrderPayment(t.id, CARD))) === WAIVER_REQUIRED_ERROR.WORKSHOP_FIXED_DATE);
    await prisma.order.update({ where: { id: t.id }, data: acceptedConsentFields(W, new Date()) });
    const rt = await startOrderPayment(t.id, CARD);
    const ot = await orderOf(t.id);
    check(
      `taller a ${days} días: con la casilla se paga y guarda la prueba (texto y versión)`,
      rt.kind === "paid" && ot.waiverKind === "WORKSHOP_FIXED_DATE" && ot.waiverText === WAIVER_TEXT.WORKSHOP_FIXED_DATE && !!ot.waiverVersion && !!ot.waiverAcceptedAt,
    );
    const e = await eligibility(t.id);
    check(`taller a ${days} días: sin «Desistir» desde el primer minuto`, !e.eligible && e.reason === "WORKSHOP", e);
    const w = await withdrawOrder({ orderId: t.id, userId: ot.customer!.userId!, email: ot.buyerEmail });
    check(`taller a ${days} días: el servidor rechaza el desistimiento`, !w.ok && w.code === "NOT_REFUNDABLE" && /fecha fija/.test(w.error) && (await orderOf(t.id)).refunds.length === 0, w);
  }

  // ── 7. Membresías: empezar ya y, si desiste en 14 días, la parte proporcional ──
  const M = await mk({ type: "MEMBERSHIP", billingInterval: "month", priceCents: 1900, title: `${TAG} membresía` });
  const subOf = (orderId: string) => prisma.subscription.findFirstOrThrow({ where: { orderId } });
  const payMembership = async (label: string) => {
    const o = await pending(M.id, label);
    await prisma.order.update({ where: { id: o.id }, data: acceptedConsentFields(M, new Date()) });
    await startOrderPayment(o.id, CARD);
    return orderOf(o.id);
  };
  const m0 = await pending(M.id, "socia0");
  await onlyTerms(m0.id);
  for (const provider of ["simulated", "stripe", "paypal"]) {
    await prisma.order.update({ where: { id: m0.id }, data: { paymentProvider: provider } });
    const msg = await errorOf(() => startOrderPayment(m0.id, CARD));
    check(`membresía con ${provider}: sin la casilla de empezar ya no se cobra`, msg === WAIVER_REQUIRED_ERROR.MEMBERSHIP_START && (await orderOf(m0.id)).status === "PENDING", msg);
  }
  // Una renuncia de las de antes (DIGITAL_IMMEDIATE) ya no vale para pagar una membresía.
  await prisma.order.update({ where: { id: m0.id }, data: { paymentProvider: "simulated", ...acceptedConsentFields(digital, new Date()) } });
  check("membresía: con la renuncia de lo digital tampoco", (await errorOf(() => startOrderPayment(m0.id, CARD))) === WAIVER_REQUIRED_ERROR.MEMBERSHIP_START);

  const m1 = await payMembership("socia1");
  const sub1 = await subOf(m1.id);
  check("membresía: con la casilla se paga y la guarda", m1.status === "PAID" && m1.waiverKind === "MEMBERSHIP_START" && m1.waiverText === WAIVER_TEXT.MEMBERSHIP_START && !!m1.waiverVersion && sub1.status === "ACTIVE");
  const expected = membershipWithdrawalRefund({ amountCents: 1900, periodStart: sub1.currentPeriodStart, periodEnd: sub1.currentPeriodEnd, now: new Date(), timezone: tz });
  const em1 = await eligibility(m1.id);
  check(
    "membresía: «Desistir» con el importe proporcional (hoy cuenta como disfrutado)",
    em1.eligible && em1.amountCents === expected.refundCents && expected.usedDays === 1 && expected.refundCents === Math.floor((1900 * (expected.totalDays - 1)) / expected.totalDays) && expected.refundCents < 1900,
    { em1, expected },
  );
  const wrong = await withdrawOrder({ orderId: m1.id, userId: m1.customer!.userId!, email: m1.buyerEmail, expectedCents: 1900 });
  check("membresía: si el importe que vio ya no es el de ahora, no se tramita", !wrong.ok && wrong.code === "AMOUNT" && (await orderOf(m1.id)).refunds.length === 0, wrong);
  const wm1 = await withdrawOrder({ orderId: m1.id, userId: m1.customer!.userId!, email: m1.buyerEmail, expectedCents: expected.refundCents });
  const after1 = await orderOf(m1.id);
  const subAfter = await subOf(m1.id);
  const access = await prisma.access.findMany({ where: { OR: [{ orderId: m1.id }, { subscriptionId: sub1.id }] } });
  check(
    "membresía: reembolso parcial de lo proporcional, suscripción cancelada ya y acceso retirado",
    wm1.ok &&
      wm1.amountCents === expected.refundCents &&
      after1.status === "PAID" &&
      after1.refundedCents === expected.refundCents &&
      after1.refunds[0]?.reason === "WITHDRAWAL" &&
      subAfter.status === "CANCELED" &&
      !subAfter.cancelAtPeriodEnd &&
      access.length > 0 &&
      access.every((a) => a.status === "REVOKED"),
    { wm1, status: after1.status, refunded: after1.refundedCents, sub: subAfter.status, access: access.map((a) => a.status) },
  );
  const mails = await prisma.emailMessage.findMany({ where: { OR: [{ dedupeKey: `withdrawal:${m1.id}` }, { to: m1.buyerEmail, template: "WITHDRAWAL_RECEIPT" }] } });
  check(
    "membresía: acuse a la compradora y aviso a la dueña, con la parte proporcional",
    mails.some((m) => m.template === "WITHDRAWAL_RECEIPT" && /parte proporcional/.test(m.html)) && mails.some((m) => m.template === "WITHDRAWAL_CREATOR" && /membresía ha terminado/.test(m.html)),
    mails.map((m) => m.template),
  );
  const again = await eligibility(m1.id);
  check("membresía: después de desistir ya no hay «Desistir»", !again.eligible && again.reason === "MEMBERSHIP_ENDED", again);

  // Pasados los 14 días desde el primer pago: no (aunque quede periodo).
  const m2 = await payMembership("socia2");
  const sub2 = await subOf(m2.id);
  const day15m = new Date(withdrawalDeadline(m2.paidAt!, tz).getTime() + 1);
  const e2 = await eligibility(m2.id, day15m);
  const w2 = await withdrawOrder({ orderId: m2.id, userId: m2.customer!.userId!, email: m2.buyerEmail, now: day15m });
  check("membresía: el día 15 desde el primer pago ya no se desiste", !e2.eligible && e2.reason === "EXPIRED" && !w2.ok && sub2.currentPeriodEnd > day15m, { e2, w2 });
  const lastMinute = await eligibility(m2.id, withdrawalDeadline(m2.paidAt!, tz));
  check("membresía: a las 23:59 del día 14 todavía sí", lastMinute.eligible && lastMinute.proportional?.usedDays === 15, lastMinute);

  // Ya renovada (las renovaciones no dan derecho de desistimiento): no.
  const m3 = await payMembership("socia3");
  const sub3 = await subOf(m3.id);
  await prisma.transaction.create({
    data: { creatorId: ana.id, subscriptionId: sub3.id, type: "RENEWAL", description: "Renovación de membresía", amountCents: 1900, platformFeeCents: 0, netCents: 1900, provider: "simulated", idempotencyKey: `${TAG}-renewal` } as never,
  });
  const e3 = await eligibility(m3.id);
  const w3 = await withdrawOrder({ orderId: m3.id, userId: m3.customer!.userId!, email: m3.buyerEmail });
  check("membresía renovada: sin «Desistir» y el servidor lo rechaza", !e3.eligible && e3.reason === "RENEWED" && !w3.ok && (await subOf(m3.id)).status === "ACTIVE", { e3, w3 });
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
