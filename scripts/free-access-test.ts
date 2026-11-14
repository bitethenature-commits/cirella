/**
 * Acceso sin cobro contra Postgres (lib/free-access.ts):
 *   tsx --conditions=react-server scripts/free-access-test.ts     (con la BD sembrada: npm run db:reset)
 *
 *   · gratis con email: pedido de 0 € «free», sin transacción, factura, IVA ni comisión; acceso y
 *     el email «Ya tienes acceso a «X»» con el enlace personal (ni recibo ni aviso de venta);
 *   · repetir con el mismo email no crea otro pedido: reenvía el enlace; a la vez, tampoco;
 *   · lo de pago y lo externo no se piden gratis; lo gratis no tiene checkout;
 *   · acceso a mano (manual), quitarlo (enlaces fuera) y devolverlo; no hay reembolso de 0 €;
 *   · las estadísticas cuentan inscripciones aparte de las ventas;
 *   · sin datos legales completos no se puede apuntar nadie;
 *   · quitar el acceso de algo gratis no se deshace volviendo a apuntarse (solo la dueña lo devuelve);
 *   · las novedades no cuentan hasta confirmarlas desde el email (también al repetir el formulario);
 *   · el nombre del formulario no llega al saludo del email ni a una cuenta que ya existía;
 *   · una membresía gratis sobre una suscripción vieja (sin renovar y caducada) da el acceso.
 * Usa emails y productos temporales de Cirella y deja la BD como estaba.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { claimFreeAccess, confirmNewsletter, FreeAccessError, getClaimableProduct, grantManualAccess, revokeManualAccess } from "../lib/free-access";
import { CheckoutError, createPendingOrder } from "../lib/orders";
import { refundOrder } from "../lib/refunds";
import { getDashboardStats } from "../lib/stats";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `gratis-${Date.now()}`;
const email = (n: string) => `${TAG}-${n}@example.com`;

async function rejects(fn: () => Promise<unknown>, kind: new (...a: never[]) => Error, match?: RegExp) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof kind && (!match || match.test((e as Error).message));
  }
}

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const free = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, accessMode: "FREE_EMAIL", status: "PUBLISHED", type: "COURSE" } });
  const external = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, accessMode: "EXTERNAL", type: "SESSION" } });
  const paid = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, accessMode: "PAID", status: "PUBLISHED", type: "COURSE" } });
  const extDigital = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "DIGITAL", slug: `${TAG}-externo`, title: "Guía pagada en Hotmart", priceCents: 2900, status: "PUBLISHED",
      accessMode: "EXTERNAL", externalUrl: "https://pay.hotmart.com/prueba",
    },
  });
  const freeMembership = await prisma.product.create({
    data: {
      creatorId: ana.id, type: "MEMBERSHIP", slug: `${TAG}-membresia`, title: "Círculo gratis de prueba", priceCents: 0, status: "PUBLISHED",
      accessMode: "FREE_EMAIL",
    },
  });
  const before = await getDashboardStats(ana.id, "all", ana.timezone);
  try {
    // ── Gratis con email ──
    check("el mini-curso gratis se puede pedir", !!(await getClaimableProduct(free.id)));
    check("un producto de pago no se pide gratis", (await getClaimableProduct(paid.id)) === null);
    check("un producto externo no se pide gratis", (await getClaimableProduct(external.id)) === null);
    check(
      "lo gratis no tiene checkout de pago",
      await rejects(() => createPendingOrder({ productId: free.id, buyerEmail: email("checkout"), buyerName: "X" }), CheckoutError),
    );

    const lucia = email("lucia");
    const r1 = await claimFreeAccess({ productId: free.id, name: "Lucía", email: lucia.toUpperCase(), newsletter: true, ipHash: "prueba" });
    check("primera vez: acceso concedido", r1.status === "granted", r1);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: r1.orderId }, include: { customer: true, transactions: true } });
    check("pedido de 0 € «free» pagado, con el email en minúsculas", order.status === "PAID" && order.paymentProvider === "free" && order.amountCents === 0 && order.buyerEmail === lucia, order);
    check("sin comisión", order.platformFeeCents === 0 && order.commissionBps === 0 && order.netCents === 0);
    check("sin transacción de cobro", order.transactions.length === 0);
    check("sin referencia de pago (no hay nada que reembolsar)", order.paymentRef === null);
    check("guarda la versión de los textos legales y la privacidad aceptada", !!order.legalSnapshotId && !!(order.metadata as { privacyAcceptedAt?: string })?.privacyAcceptedAt);
    check("la casilla de novedades no es consentimiento todavía", order.customer?.marketingOptIn === false && order.marketingOptIn === false, order.customer);
    check("…queda pedida, pendiente de confirmar", (order.metadata as { newsletterRequested?: boolean })?.newsletterRequested === true);
    const access = await prisma.access.findFirst({ where: { userId: order.customer!.userId, productId: free.id } });
    check("acceso activo y sin caducidad", access?.status === "ACTIVE" && access.expiresAt === null && access.orderId === order.id, access);
    const mails = await prisma.emailMessage.findMany({ where: { to: lucia } });
    const accessMail = mails.find((m) => m.template === "ACCESS_GRANTED");
    check("email «Ya tienes acceso a «X»»", accessMail?.subject === `Ya tienes acceso a «${free.title}»`, mails.map((m) => m.subject));
    check("con el enlace personal directo al curso", !!accessMail && /\/auth\/enlace\?t=/.test(accessMail.html) && (await prisma.orderLink.count({ where: { orderId: order.id, path: `/cuenta/cursos/${free.id}` } })) === 1);
    check("el email de acceso lleva el botón para confirmar las novedades", !!accessMail?.html.includes("Confirmar que quiero recibir novedades") &&
      (await prisma.orderLink.count({ where: { orderId: order.id, path: `/cuenta/novedades/confirmar?pedido=${order.id}` } })) === 1);
    check("…y no saluda con el nombre escrito en el formulario", !!accessMail && !accessMail.html.includes("Lucía"));
    check("otra persona no puede confirmar sus novedades", !(await confirmNewsletter({ orderId: order.id, userId: ana.userId })));
    check("confirmarlas desde su sesión", await confirmNewsletter({ orderId: order.id, userId: order.customer!.userId }));
    const confirmed = await prisma.customer.findUniqueOrThrow({ where: { id: order.customerId! } });
    check("…ahora sí recibe novedades", confirmed.marketingOptIn === true && !!confirmed.marketingOptInAt);
    check("ni recibo, ni email de curso aparte", !mails.some((m) => ["PURCHASE_RECEIPT", "COURSE_ACCESS"].includes(m.template)));
    check("ni aviso de venta a la creadora", (await prisma.emailMessage.count({ where: { template: "NEW_SALE", dedupeKey: `sale:${order.id}` } })) === 0);
    check("métricas: SIGNUP, no PURCHASE", (await prisma.analyticsEvent.count({ where: { creatorId: ana.id, productId: free.id, type: "SIGNUP", visitorId: { contains: order.customer!.userId } } })) === 1 &&
      (await prisma.analyticsEvent.count({ where: { creatorId: ana.id, productId: free.id, type: "PURCHASE" } })) === 0);

    const r2 = await claimFreeAccess({ productId: free.id, name: "Lucía", email: lucia, newsletter: false });
    check("segunda vez: reenvía el enlace", r2.status === "resent" && r2.orderId === r1.orderId, r2);
    check("no duplica el pedido", (await prisma.order.count({ where: { productId: free.id, buyerEmail: lucia } })) === 1);
    check("segundo email de acceso (reenvío)", (await prisma.emailMessage.count({ where: { to: lucia, template: "ACCESS_GRANTED" } })) === 2);
    check("desmarcar novedades al repetir no retira el consentimiento", (await prisma.customer.findUniqueOrThrow({ where: { id: order.customerId! } })).marketingOptIn === true);

    // Novedades marcadas al repetir: no se pierden, quedan pendientes y el reenvío lleva el botón.
    const later = email("despues");
    const l1 = await claimFreeAccess({ productId: free.id, name: "Luego", email: later, newsletter: false });
    const l1Order = await prisma.order.findUniqueOrThrow({ where: { id: l1.orderId } });
    check("sin la casilla: nada pendiente", !(l1Order.metadata as { newsletterRequested?: boolean })?.newsletterRequested);
    const l2 = await claimFreeAccess({ productId: free.id, name: "Luego", email: later, newsletter: true });
    const l2Order = await prisma.order.findUniqueOrThrow({ where: { id: l2.orderId }, include: { customer: true } });
    check("repetir marcando novedades: queda pedida en el mismo pedido", l2.orderId === l1.orderId && (l2Order.metadata as { newsletterRequested?: boolean })?.newsletterRequested === true && !!(l2Order.metadata as { privacyAcceptedAt?: string })?.privacyAcceptedAt, l2Order.metadata);
    const resent = await prisma.emailMessage.findFirst({ where: { to: later, template: "ACCESS_GRANTED" }, orderBy: { createdAt: "desc" } });
    check("…y el reenvío lleva el botón para confirmarlas", !!resent?.html.includes("Confirmar que quiero recibir novedades") && l2Order.customer?.marketingOptIn === false);

    // El nombre del formulario no se pone en una cuenta que ya existía.
    const known = email("conocida");
    const knownUser = await prisma.user.create({ data: { email: known } });
    await claimFreeAccess({ productId: free.id, name: "Has ganado 500 € en premio-ya.com", email: known, newsletter: false });
    check("una cuenta sin nombre no toma el del formulario", (await prisma.user.findUniqueOrThrow({ where: { id: knownUser.id } })).name === null);

    // Sin datos legales completos, nadie puede apuntarse (la privacidad no diría quién trata los datos).
    await prisma.creator.update({ where: { id: ana.id }, data: { legalTaxId: null } });
    try {
      check("sin datos legales: no se puede pedir", (await getClaimableProduct(free.id)) === null);
      check(
        "…ni apuntarse",
        await rejects(() => claimFreeAccess({ productId: free.id, name: "Sin", email: email("sin-legal"), newsletter: false }), FreeAccessError, /no está disponible/),
      );
    } finally {
      await prisma.creator.update({ where: { id: ana.id }, data: { legalTaxId: ana.legalTaxId } });
    }

    // Membresía gratis sobre una suscripción vieja que no se renueva (modo personal): da el acceso.
    const stale = email("suscripcion-vieja");
    const staleUser = await prisma.user.create({ data: { email: stale, name: "Socia" } });
    const staleCustomer = await prisma.customer.create({ data: { creatorId: ana.id, userId: staleUser.id, email: stale, name: "Socia" } });
    const longAgo = new Date(Date.now() - 40 * 86_400_000);
    const ended = new Date(Date.now() - 10 * 86_400_000);
    const staleSub = await prisma.subscription.create({
      data: { creatorId: ana.id, productId: freeMembership.id, customerId: staleCustomer.id, userId: staleUser.id, priceCents: 900, currentPeriodStart: longAgo, currentPeriodEnd: ended, provider: "simulated" },
    });
    await prisma.access.create({ data: { creatorId: ana.id, userId: staleUser.id, productId: freeMembership.id, subscriptionId: staleSub.id, expiresAt: ended } });
    const sm = await claimFreeAccess({ productId: freeMembership.id, name: "Socia", email: stale, newsletter: false });
    const staleAccess = await prisma.access.findFirstOrThrow({ where: { userId: staleUser.id, productId: freeMembership.id } });
    check("suscripción vieja caducada + membresía gratis: acceso activo y sin caducidad a la primera", sm.status === "granted" && staleAccess.status === "ACTIVE" && staleAccess.expiresAt === null && staleAccess.orderId === sm.orderId, staleAccess);

    const twin = email("a-la-vez");
    const both = await Promise.all([0, 1, 2].map(() => claimFreeAccess({ productId: free.id, name: "Doble", email: twin, newsletter: false })));
    check("tres envíos a la vez: un solo pedido", (await prisma.order.count({ where: { productId: free.id, buyerEmail: twin } })) === 1, both);
    check("…los tres ven «revisa tu email» y sale un solo email", both.every((r) => r.status === "granted") && (await prisma.emailMessage.count({ where: { to: twin, template: "ACCESS_GRANTED" } })) === 1, both);

    const refund = await refundOrder({ orderId: order.id, actor: { kind: "creator", userId: ana.userId, creatorId: ana.id }, reason: "OTHER", revokeAccess: false, cancelBooking: false });
    check("no hay reembolso de 0 €", !refund.ok && /gratuito/.test(refund.error), refund);

    // ── Acceso a mano ──
    check(
      "una sesión externa no admite acceso a mano",
      await rejects(() => grantManualAccess({ creatorId: ana.id, productId: external.id, name: "X", email: email("sesion"), grantedByUserId: ana.userId }), FreeAccessError, /sesiones/),
    );
    check(
      "un producto de pago en la web no admite acceso a mano",
      await rejects(() => grantManualAccess({ creatorId: ana.id, productId: paid.id, name: "X", email: email("pago"), grantedByUserId: ana.userId }), FreeAccessError),
    );
    check(
      "un externo sin contenido aquí no admite acceso a mano",
      await rejects(() => grantManualAccess({ creatorId: ana.id, productId: extDigital.id, name: "X", email: email("vacio"), grantedByUserId: ana.userId }), FreeAccessError, /Añade primero/),
    );
    await prisma.productFile.create({ data: { creatorId: ana.id, productId: extDigital.id, name: "Guía en PDF", kind: "LINK", url: "https://example.com/guia.pdf" } });
    const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
    check(
      "otra creadora no puede dar acceso a un producto de Cirella",
      await rejects(() => grantManualAccess({ creatorId: maria.id, productId: extDigital.id, name: "X", email: email("ajena"), grantedByUserId: maria.userId }), FreeAccessError, /no encontrado/),
    );
    const eva = email("eva");
    const g1 = await grantManualAccess({ creatorId: ana.id, productId: extDigital.id, name: "Eva", email: eva, grantedByUserId: ana.userId });
    const manual = await prisma.order.findUniqueOrThrow({ where: { id: g1.orderId }, include: { customer: true, transactions: true } });
    check("acceso a mano: pedido de 0 € «manual» sin transacción", g1.status === "granted" && manual.paymentProvider === "manual" && manual.amountCents === 0 && manual.transactions.length === 0);
    check("acceso a mano: mismo email de acceso", (await prisma.emailMessage.count({ where: { to: eva, template: "ACCESS_GRANTED" } })) === 1);
    check("acceso a mano: no cuenta como inscripción de la página (sin evento)", (await prisma.analyticsEvent.count({ where: { productId: extDigital.id } })) === 0);
    check("otra creadora no puede quitar ese acceso", !(await revokeManualAccess({ creatorId: maria.id, orderId: manual.id })));
    check("quitar acceso", await revokeManualAccess({ creatorId: ana.id, orderId: manual.id }));
    check("…el acceso queda retirado", (await prisma.access.findFirst({ where: { userId: manual.customer!.userId, productId: extDigital.id } }))?.status === "REVOKED");
    check("…y sus enlaces personales dejan de existir", (await prisma.orderLink.count({ where: { orderId: manual.id } })) === 0);
    const g2 = await grantManualAccess({ creatorId: ana.id, productId: extDigital.id, name: "Eva", email: eva, grantedByUserId: ana.userId });
    check("darlo otra vez: mismo pedido, acceso devuelto", g2.status === "resent" && g2.orderId === manual.id &&
      (await prisma.access.findFirst({ where: { userId: manual.customer!.userId, productId: extDigital.id } }))?.status === "ACTIVE");

    // ── Quitar el acceso de algo gratis: volver a apuntarse no lo devuelve ──
    const userOf = async (orderId: string) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true } })).customer!.userId;
    const luciaUser = await userOf(order.id);
    const freeAccessOf = async () => (await prisma.access.findFirst({ where: { userId: luciaUser, productId: free.id } }))?.status;
    check("quitar el acceso a una inscripción gratis", await revokeManualAccess({ creatorId: ana.id, orderId: order.id }));
    const mailsBefore = await prisma.emailMessage.count({ where: { to: lucia, template: "ACCESS_GRANTED" } });
    const again = await claimFreeAccess({ productId: free.id, name: "Lucía", email: lucia, newsletter: true });
    check("volver a apuntarse con el mismo email no hace nada", again.status === "blocked" && (await freeAccessOf()) === "REVOKED", again);
    check("…ni le manda otro enlace", (await prisma.emailMessage.count({ where: { to: lucia, template: "ACCESS_GRANTED" } })) === mailsBefore);
    const back = await grantManualAccess({ creatorId: ana.id, productId: free.id, name: "Lucía", email: lucia, grantedByUserId: ana.userId });
    check("la dueña sí lo devuelve dándolo a mano", back.status === "resent" && back.orderId === order.id && (await freeAccessOf()) === "ACTIVE", back);
    check("…y desde entonces el formulario vuelve a reenviar el enlace", (await claimFreeAccess({ productId: free.id, name: "Lucía", email: lucia, newsletter: false })).status === "resent");

    // ── Estadísticas ──
    const after = await getDashboardStats(ana.id, "all", ana.timezone);
    check("las inscripciones no cuentan como ventas", after.sales === before.sales && after.revenue === before.revenue, { before: before.sales, after: after.sales });
    check("se cuentan aparte (6 inscripciones nuevas: 5 del formulario y 1 a mano)", after.signups - before.signups === 6 && after.formSignups - before.formSignups === 5, {
      signups: [before.signups, after.signups],
      form: [before.formSignups, after.formSignups],
    });
  } finally {
    const orders = await prisma.order.findMany({ where: { buyerEmail: { startsWith: TAG } }, select: { id: true, customerId: true } });
    const ids = orders.map((o) => o.id);
    const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    await prisma.emailMessage.deleteMany({ where: { to: { startsWith: TAG } } });
    if (ids.length) await prisma.outboxEvent.deleteMany({ where: { OR: ids.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } });
    await prisma.analyticsEvent.deleteMany({ where: { OR: [{ productId: { in: [extDigital.id, freeMembership.id] } }, { visitorId: { in: userIds.map((u) => `user:${u}`) } }] } });
    await prisma.access.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.orderLink.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.customer.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.productFile.deleteMany({ where: { productId: extDigital.id } });
    await prisma.product.deleteMany({ where: { id: { in: [extDigital.id, freeMembership.id] } } });
  }
  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nAcceso gratis, externo y a mano correcto ✓");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
