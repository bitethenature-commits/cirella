/**
 * Calendario propio (Postgres, web personal de Ana con cobros).
 *   npm run test:calendar        (con la BD sembrada: npm run db:reset)
 *
 * Fechas especiales y bloqueos, horizonte, huecos guardados mientras se paga (y la carrera de dos
 * compradoras por la misma hora), datos para la lectura y zona de la clienta, avisos a la dueña,
 * talleres con plazas, sesiones dadas a mano, entregas por pedido, enlace de Zoom y limpieza de datos.
 * Crea sus propios productos y borra todo lo que crea.
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
async function rejects(fn: () => Promise<unknown>, match: RegExp) {
  try {
    await fn();
    return false;
  } catch (e) {
    return match.test(e instanceof Error ? e.message : String(e));
  }
}

const TAG = `cal${Date.now()}`;
const email = (n: string) => `${TAG}-${n}@example.com`;
const MADRID = "Europe/Madrid";

async function main() {
  const { prisma } = await import("../lib/db");
  const { getAvailableSlots, hasBookingClash, isSlotAvailable } = await import("../lib/booking");
  const { createPendingOrder, fulfillOrder, purgeAbandonedIntake } = await import("../lib/orders");
  const { createManualOrder } = await import("../lib/manual-orders");
  const { moveWorkshop } = await import("../lib/workshops");
  const { sendOrderDelivery } = await import("../lib/order-files");
  const { completeUpload, createUpload } = await import("../lib/uploads");
  const { releaseBookingEmails, setBookingMeetingUrl } = await import("../lib/booking-changes");
  const { emit } = await import("../lib/events");
  const { storage } = await import("../lib/storage");
  const { addDaysToKey, dateKeyInTz, weekdayOfKey, zonedTimeToUtc } = await import("../lib/tz");
  const { toWithdrawalInput, withdrawalEligibility } = await import("../lib/refund-math");

  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const mk = (data: Record<string, unknown>) =>
    prisma.product.create({
      data: { creatorId: ana.id, type: "SESSION", status: "PUBLISHED", accessMode: "PAID", priceCents: 5000, durationMin: 60, bufferMin: 0, minNoticeHours: 0, slug: `${TAG}-${Math.random().toString(36).slice(2, 7)}`, title: `${TAG} sesión`, ...data } as never,
    });
  const P = await mk({ horizonDays: 90, meetingUrl: "https://us02web.zoom.us/j/111", intake: { birth: "required", questions: [] } });
  const P28 = await mk({});
  const flat = (r: Awaited<ReturnType<typeof getAvailableSlots>>) => r.days.flatMap((d) => d.slots.map((s) => s.start));

  // Días de trabajo de Ana (lunes a jueves) lejos de los datos sembrados, dentro de 90 días.
  const today = dateKeyInTz(new Date(), MADRID);
  const blocked = new Set((await prisma.blockedDate.findMany({ where: { creatorId: ana.id } })).map((b) => b.date));
  const seeded = new Set((await prisma.availabilityOverride.findMany({ where: { creatorId: ana.id } })).map((o) => o.date));
  const workdays: string[] = [];
  for (let d = 35; workdays.length < 8; d++) {
    const k = addDaysToKey(today, d);
    if ([1, 2, 3, 4].includes(weekdayOfKey(k)) && !blocked.has(k) && !seeded.has(k)) workdays.push(k);
  }
  const [D1, D2, D3, D4, D5, D6, D7] = workdays;
  const at = (day: string, h: number, m = 0, tz = MADRID) => zonedTimeToUtc(day, h * 60 + m, tz).toISOString();
  const onDay = (slots: string[], day: string) => slots.filter((s) => dateKeyInTz(new Date(s), MADRID) === day);

  // ── 1. Fechas especiales y bloqueos ──
  await prisma.availabilityOverride.createMany({
    data: [
      { creatorId: ana.id, date: D1, kind: "HOURS", startMinute: 16 * 60, endMinute: 18 * 60, timezone: MADRID, note: TAG },
      { creatorId: ana.id, date: D2, kind: "BLOCK", startMinute: 11 * 60, endMinute: 12 * 60, timezone: MADRID, note: TAG },
      { creatorId: ana.id, date: D3, kind: "HOURS", startMinute: 9 * 60, endMinute: 11 * 60, timezone: "Asia/Makassar", note: TAG },
    ],
  });
  let slots = flat(await getAvailableSlots(P));
  check("fecha especial 16–18 h: ese día solo esas horas", JSON.stringify(onDay(slots, D1)) === JSON.stringify([at(D1, 16), at(D1, 17)]), onDay(slots, D1));
  check("horas bloqueadas 11–12 h: fuera las de esa hora, el resto sigue", !onDay(slots, D2).includes(at(D2, 11)) && onDay(slots, D2).includes(at(D2, 10)) && onDay(slots, D2).includes(at(D2, 12)));
  check("fecha especial en hora de Bali: 9:00 y 10:00 de Bali en UTC", slots.includes(at(D3, 9, 0, "Asia/Makassar")) && slots.includes(at(D3, 10, 0, "Asia/Makassar")));
  const bd = await prisma.blockedDate.create({ data: { creatorId: ana.id, date: D1, reason: TAG } });
  slots = flat(await getAvailableSlots(P));
  check("un día bloqueado entero gana a su fecha especial", onDay(slots, D1).length === 0);
  await prisma.blockedDate.delete({ where: { id: bd.id } });

  // ── 2. Horizonte: el mismo para listar y para comprobar ──
  const farDay = workdays.find((k) => k >= addDaysToKey(today, 45))!;
  const far = at(farDay, 10);
  check("horizonte 90: se ofrece un hueco a +45 días y se acepta al pagar", flat(await getAvailableSlots(P)).includes(far) && (await isSlotAvailable(P, far)));
  check("horizonte por defecto (28): ni se ofrece ni se acepta", !flat(await getAvailableSlots(P28)).includes(far) && !(await isSlotAvailable(P28, far)));

  // ── 3. Huecos guardados mientras se paga (web personal) ──
  const S = at(D4, 10);
  const pendingOrder = await createPendingOrder({ productId: P.id, buyerEmail: email("hold"), buyerName: "Retenida", slotStart: S, buyerTimezone: "America/Bogota" });
  await prisma.order.update({ where: { id: pendingOrder.id }, data: { checkoutRef: `${TAG}-cs`, checkoutExpiresAt: new Date(Date.now() + 20 * 60000) } });
  check("un pago en curso guarda la hora: nadie más la ve", !flat(await getAvailableSlots(P)).includes(S));
  check("…salvo quien la está pagando (su pedido)", flat(await getAvailableSlots(P, { ignoreOrderId: pendingOrder.id })).includes(S));
  check("…y en la plataforma (sin retenciones) se sigue viendo", flat(await getAvailableSlots(P, { holds: false })).includes(S));
  check("otra compradora no puede pedir esa hora", await rejects(() => createPendingOrder({ productId: P.id, buyerEmail: email("otra"), buyerName: "Otra", slotStart: S }), /acaba de ocuparse/));
  await prisma.order.update({ where: { id: pendingOrder.id }, data: { checkoutExpiresAt: new Date(Date.now() - 60000) } });
  check("si la página de pago caduca, la hora se libera", flat(await getAvailableSlots(P)).includes(S));
  await prisma.order.update({ where: { id: pendingOrder.id }, data: { checkoutExpiresAt: new Date(Date.now() + 20 * 60000), status: "FAILED" } });
  check("si el pago falla, la hora se libera", flat(await getAvailableSlots(P)).includes(S));
  await prisma.order.update({ where: { id: pendingOrder.id }, data: { status: "ABANDONED" } });

  // ── 4. Dos compradoras a la vez por la misma hora: un solo pedido ──
  const R = at(D4, 12);
  const race = await Promise.allSettled([1, 2].map((n) => createPendingOrder({ productId: P.id, buyerEmail: email(`race${n}`), buyerName: `Carrera ${n}`, slotStart: R })));
  check("carrera: un pedido se crea y el otro ve la hora ocupada", race.filter((r) => r.status === "fulfilled").length === 1 && race.some((r) => r.status === "rejected" && /ocuparse/.test(String(r.reason))));

  // ── 5. Compra con datos para la lectura y zona de la clienta ──
  const intake = { v: 1 as const, birth: { date: "1991-03-03", time: "06:40", timeUnknown: false, place: "Valencia, España" }, answers: [] };
  const T = at(D5, 17);
  const o = await createPendingOrder({ productId: P.id, buyerEmail: email("lucia"), buyerName: "Lucía Prueba", slotStart: T, buyerTimezone: "America/Bogota", intake });
  check("el pedido guarda los datos y la zona de la clienta", JSON.stringify(o.intake).includes("Valencia") && (o.metadata as { buyerTz?: string }).buyerTz === "America/Bogota");
  await fulfillOrder(o.id, `sim_ch_${TAG}_1`);
  const booking = await prisma.booking.findFirstOrThrow({ where: { orderId: o.id } });
  check("reserva confirmada con la zona de la clienta", booking.status === "CONFIRMED" && booking.customerTimezone === "America/Bogota", booking);
  const mails = (template: string, to?: string) => prisma.emailMessage.findMany({ where: { template, ...(to ? { to } : {}), createdAt: { gte: new Date(Date.now() - 600_000) } } });
  const confirm = (await mails("BOOKING_CONFIRMED", email("lucia")))[0];
  check("la confirmación dice su hora (hora de Bogotá) y trae el .ics", !!confirm && confirm.html.includes("(hora de Bogotá)") && confirm.html.includes("Añadir a mi calendario"));
  const owner = (await mails("BOOKING_OWNER")).filter((m) => m.html.includes("Lucía Prueba"));
  check("la dueña recibe «Nueva reserva» con su hora, la de ella y los datos", owner.length === 1 && owner[0].html.includes("Valencia") && owner[0].html.includes("para ella"), owner.map((m) => m.subject));
  check("en la web personal no llega además «Nueva venta»", (await prisma.emailMessage.count({ where: { template: "NEW_SALE", dedupeKey: `sale:${o.id}` } })) === 0);
  check("se programan los dos recordatorios (24 h y 60 min)", (await prisma.emailMessage.count({ where: { dedupeKey: { startsWith: `reminder:${booking.id}:` }, status: "QUEUED" } })) === 2);

  // ── 6. Cambio de fecha de la clienta: un aviso a la dueña ──
  const T2 = at(D5, 18);
  await prisma.booking.update({ where: { id: booking.id }, data: { previousStartAt: booking.startAt, startAt: new Date(T2), endAt: new Date(Date.parse(T2) + 3600_000) } });
  // Como scheduleBooking (app/cuenta/actions.ts): suelta los avisos de la fecha anterior.
  await releaseBookingEmails(booking.id);
  await emit({ type: "booking.confirmed", bookingId: booking.id, change: "rescheduled" });
  await emit({ type: "booking.confirmed", bookingId: booking.id, change: "rescheduled" });
  const moved = await prisma.emailMessage.findMany({ where: { template: "BOOKING_OWNER", dedupeKey: `owner-booking:${booking.id}:${T2}` } });
  check("«ha cambiado la fecha» llega una vez, con la fecha anterior", moved.length === 1 && moved[0].subject.includes("ha cambiado la fecha") && moved[0].html.includes("Antes:"));

  // ── 7. Enlace de Zoom de una reserva: aviso y recordatorios nuevos ──
  const before = await prisma.emailMessage.findMany({ where: { dedupeKey: { startsWith: `reminder:${booking.id}:` }, status: "QUEUED" } });
  await setBookingMeetingUrl({ creatorId: ana.id, bookingId: booking.id, url: "https://us02web.zoom.us/j/999", notify: true });
  const after = await prisma.emailMessage.findMany({ where: { dedupeKey: { startsWith: `reminder:${booking.id}:` }, status: "QUEUED" } });
  check("los recordatorios se rehacen con el enlace nuevo", before.length > 0 && after.length === before.length && after.every((m) => m.html.includes("/j/999")) && after.every((m) => !before.some((b) => b.id === m.id)));
  check("«Nuevo enlace» a la clienta, una vez", (await prisma.emailMessage.count({ where: { template: "MEETING_LINK_CHANGED", to: email("lucia") } })) === 1);
  check("María no puede cambiar el enlace de una reserva de Ana", !(await setBookingMeetingUrl({ creatorId: maria.id, bookingId: booking.id, url: "https://zoom.us/j/1", notify: false })).ok);

  // ── 8. Talleres: plazas que comparten hora y bloquean la agenda 1:1 ──
  const W_AT = new Date(at(D6, 10));
  const W = await mk({ title: `${TAG} taller`, groupSession: true, eventStartAt: W_AT, capacity: 2, durationMin: 90 });
  check("la hora del taller no se ofrece para sesiones 1:1 (con 0 plazas vendidas)", !flat(await getAvailableSlots(P)).includes(W_AT.toISOString()));
  check("hasBookingClash ve el taller", await prisma.$transaction((tx) => hasBookingClash(tx, ana.id, W_AT, new Date(W_AT.getTime() + 3600_000), 0)));
  const seats = [await createPendingOrder({ productId: W.id, buyerEmail: email("s1"), buyerName: "Plaza 1" }), await createPendingOrder({ productId: W.id, buyerEmail: email("s2"), buyerName: "Plaza 2" })];
  check("con las 2 plazas en pago, la tercera no puede comprar", await rejects(() => createPendingOrder({ productId: W.id, buyerEmail: email("s3"), buyerName: "Plaza 3" }), /No quedan plazas/));
  for (const [i, s] of seats.entries()) await fulfillOrder(s.id, `sim_ch_${TAG}_s${i}`);
  const seatRows = await prisma.booking.findMany({ where: { productId: W.id } });
  check("las dos plazas quedan confirmadas a la misma hora (la regla de solapes las admite)", seatRows.length === 2 && seatRows.every((b) => b.status === "CONFIRMED" && b.groupSeat && b.startAt?.getTime() === W_AT.getTime()));
  const clashMove = await moveWorkshop({ creatorId: ana.id, productId: W.id, startAt: new Date(T2) });
  check("mover el taller encima de una sesión 1:1 se rechaza", !clashMove.ok);
  const W2 = new Date(at(D7, 17));
  const mv = await moveWorkshop({ creatorId: ana.id, productId: W.id, startAt: W2 });
  check("mover el taller mueve las plazas y avisa a cada asistente", mv.ok && mv.moved === 2 && (await prisma.emailMessage.count({ where: { to: { in: [email("s1"), email("s2")] }, subject: { startsWith: "Tu taller cambia de fecha" } } })) === 2);

  // ── 9. Sesión dada a mano ──
  const rid = `${TAG}-req-1`;
  const custom = { kind: "custom" as const, date: D7, time: "22:00" };
  const g1 = await createManualOrder({ creatorId: ana.id, grantedByUserId: ana.userId, productId: P.id, name: "Regalo", email: email("gift"), payment: "gift", when: custom, requestId: rid, message: "¡Feliz cumpleaños!" });
  const g2 = await createManualOrder({ creatorId: ana.id, grantedByUserId: ana.userId, productId: P.id, name: "Regalo", email: email("gift"), payment: "gift", when: custom, requestId: rid });
  check("regalo a una hora fuera de su horario: confirmada", g1.ok && g1.status === "CONFIRMED");
  check("repetir el envío no duplica (mismo pedido)", g1.ok && g2.ok && g1.orderId === g2.orderId && (await prisma.booking.count({ where: { order: { buyerEmail: email("gift") } } })) === 1);
  const clash = await createManualOrder({ creatorId: ana.id, grantedByUserId: ana.userId, productId: P.id, name: "Choque", email: email("clash"), payment: "paid_elsewhere", paidNote: "Bizum", when: custom, requestId: `${TAG}-req-2` });
  check("a la misma hora que otra sesión: «Ya tienes otra sesión a esa hora»", !clash.ok && /Ya tienes otra sesión/.test(clash.error));
  const later = await createManualOrder({ creatorId: ana.id, grantedByUserId: ana.userId, productId: P.id, name: "Luego", email: email("later"), payment: "gift", when: { kind: "later" }, requestId: `${TAG}-req-3` });
  check("«que la elija ella»: pendiente de fecha", later.ok && later.status === "PENDING_SCHEDULE");
  const giftMails = await prisma.emailMessage.findMany({ where: { to: email("gift") } });
  check("solo le llega «te ha reservado una sesión» (sin acceso ni venta)", giftMails.length >= 1 && giftMails.every((m) => m.template !== "ACCESS_GRANTED") && giftMails.some((m) => m.subject.includes("te ha reservado una sesión")));
  check("y la dueña no recibe aviso de una sesión que ha dado ella", (await prisma.emailMessage.count({ where: { template: { in: ["BOOKING_OWNER", "NEW_SALE"] }, html: { contains: email("gift") } } })) === 0 && !(await prisma.emailMessage.findFirst({ where: { template: "BOOKING_OWNER", subject: { contains: "Regalo" } } })));
  check("María no puede dar sesiones de Ana", !(await createManualOrder({ creatorId: maria.id, grantedByUserId: maria.userId, productId: P.id, name: "X", email: email("x"), payment: "gift", when: { kind: "later" }, requestId: `${TAG}-req-4` })).ok);

  // ── 10. Lectura preparada: entrega por pedido ──
  const reading = await prisma.product.create({ data: { creatorId: ana.id, type: "DIGITAL", deliveryMode: "PERSONAL", status: "PUBLISHED", accessMode: "PAID", priceCents: 4900, slug: `${TAG}-lectura`, title: `${TAG} lectura`, instructions: "Te la envío en 72 horas." } });
  const ro = await createManualOrder({ creatorId: ana.id, grantedByUserId: ana.userId, productId: reading.id, name: "Lectora", email: email("reader"), payment: "paid_elsewhere", when: { kind: "later" }, requestId: `${TAG}-req-5` });
  check("lectura dada a mano: acceso con «la está preparando»", ro.ok && (await prisma.emailMessage.findFirst({ where: { template: "ACCESS_GRANTED", to: email("reader") } }))?.html.includes("la está preparando") === true);
  if (ro.ok) {
    check("María no puede subir una entrega al pedido de Ana", await rejects(() => createUpload(maria.id, { purpose: "delivery", orderId: ro.orderId, name: "x.pdf", contentType: "application/pdf", size: 10 }), /Pedido no encontrado/));
    const pdf = Buffer.from("%PDF-1.4 tu lectura");
    const up = (await createUpload(ana.id, { purpose: "delivery", orderId: ro.orderId, name: "Tu lectura.pdf", contentType: "application/pdf", size: pdf.length })) as { uploadUrl: string; ticket: string };
    const s = storage() as unknown as { verify: (t: string | null) => { k: string } | null };
    const key = s.verify(new URL(up.uploadUrl, "http://x").searchParams.get("t"))!.k;
    check("la entrega se guarda en private/<Ana>/", key.startsWith(`private/${ana.id}/`));
    await storage().put(key, pdf, { contentType: "application/pdf" });
    const done = await completeUpload(ana.id, up.ticket);
    const file = "file" in done ? await prisma.orderFile.findUnique({ where: { id: done.file.id } }) : null;
    check("queda como borrador (la clienta no lo ve)", !!file && file.sentAt === null && file.orderId === ro.orderId);
    check("María no puede enviar la entrega de Ana", !(await sendOrderDelivery({ creatorId: maria.id, orderId: ro.orderId })).ok);
    const sent = await sendOrderDelivery({ creatorId: ana.id, orderId: ro.orderId, message: "Aquí tienes **tu lectura**", messageFormat: "MD" });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: ro.orderId }, include: { files: true, bookings: true, refunds: true } });
    check("enviar: archivo enviado, pedido entregado y un email «Tu lectura está lista»", sent.ok && sent.sent === 1 && !!order.deliveredAt && order.files.every((f) => f.sentAt) && (await prisma.emailMessage.count({ where: { template: "READING_DELIVERED", to: email("reader") } })) === 1);
    const again = await sendOrderDelivery({ creatorId: ana.id, orderId: ro.orderId });
    check("volver a enviar sin nada nuevo no manda otro email", again.ok && again.sent === 0 && (await prisma.emailMessage.count({ where: { template: "READING_DELIVERED", to: email("reader") } })) === 1);
    const w = withdrawalEligibility(toWithdrawalInput({ ...order, productType: "DIGITAL", status: "PAID", amountCents: 4900 }), new Date());
    check("una lectura entregada ya no se puede desistir", !w.eligible && w.reason === "DELIVERED");
  }

  // ── 11. Los datos de un pedido sin pagar se borran a los 30 días ──
  const old = await prisma.order.create({
    data: { creatorId: ana.id, productId: P.id, productTitle: "x", productType: "SESSION", buyerEmail: email("old"), amountCents: 5000, commissionBps: 0, platformFeeCents: 0, netCents: 5000, paymentProvider: "simulated", status: "ABANDONED", intake, createdAt: new Date(Date.now() - 31 * 86400_000) },
  });
  const recent = await prisma.order.create({
    data: { creatorId: ana.id, productId: P.id, productTitle: "x", productType: "SESSION", buyerEmail: email("recent"), amountCents: 5000, commissionBps: 0, platformFeeCents: 0, netCents: 5000, paymentProvider: "simulated", status: "PENDING", intake, createdAt: new Date(Date.now() - 10 * 86400_000) },
  });
  await purgeAbandonedIntake(new Date());
  check("pedido abandonado hace 31 días: datos borrados", (await prisma.order.findUniqueOrThrow({ where: { id: old.id } })).intake === null);
  check("pendiente de hace 10 días y pagado: se conservan", (await prisma.order.findUniqueOrThrow({ where: { id: recent.id } })).intake !== null && (await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).intake !== null);
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
  const keys = [...orderIds, ...bookings.map((b) => b.id)];
  const files = await prisma.orderFile.findMany({ where: { orderId: { in: orderIds }, storageKey: { not: null } }, select: { storageKey: true } });
  const { privateKey, storage } = await import("../lib/storage");
  if (files.length) await storage().delete(files.map((f) => privateKey(f.storageKey!))).catch(() => {});
  await prisma.$transaction([
    prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...keys.map((k) => ({ dedupeKey: { contains: k } })), { html: { contains: TAG } }] } }),
    prisma.outboxEvent.deleteMany({ where: { OR: keys.map((k) => ({ payload: { string_contains: k } })) } }),
    prisma.analyticsEvent.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.access.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.transaction.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderLink.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.session.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.booking.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.orderFile.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.productFile.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.product.deleteMany({ where: { id: { in: productIds } } }),
    prisma.availabilityOverride.deleteMany({ where: { note: TAG } }),
    prisma.blockedDate.deleteMany({ where: { reason: TAG } }),
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
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nCalendario propio ✓");
    process.exit(failures ? 1 : 0);
  });
