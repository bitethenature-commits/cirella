/**
 * Prueba de aislamiento multi-tenant.
 *   npm run test:isolation
 *
 * Comprueba que el cliente `tenantDb(ana)` jamás lee, modifica ni borra datos
 * de otra creadora (María), aunque se le pasen sus ids directamente.
 */
import "./load-env";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { scopeAllows } from "../lib/auth-utils";
import { prisma } from "../lib/db";
import { yearOf } from "../lib/dac7";
import { dac7ForCreator, dac7Report } from "../lib/dac7-data";
import { createPendingOrder } from "../lib/orders";
import { cancelBooking, requestReschedule } from "../lib/booking-changes";
import { ensureLegalSnapshot, getLegalSnapshot } from "../lib/legal-snapshot";
import { createOrderLink, resolveOrderLink, revokeOrderAccess } from "../lib/order-links";
import { applyPaymentUpdate } from "../lib/payments/events";
import type { PaymentProvider } from "../lib/payments/provider";
import { simulatedProvider } from "../lib/payments/simulated";
import { refundOrder, withdrawOrder } from "../lib/refunds";
import { syncPayoutAccount } from "../lib/payouts";
import { findPastDueSubscription } from "../lib/subscriptions";
import { TENANT_MODELS, tenantDb } from "../lib/tenant";

// Tablas con creatorId que NO son de negocio de una creadora: autenticación (la marca del email
// de acceso) y avisos de la pasarela (se buscan por id del evento, nunca desde el panel).
const NOT_TENANT = new Set(["LoginToken", "PaymentEvent"]);

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failures++;
}

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const db = tenantDb(ana.id);

  // Toda tabla con creatorId está protegida por tenantDb (o es una excepción documentada)
  const withCreatorId = Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === "creatorId")).map((m) => m.name);
  const unprotected = withCreatorId.filter((m) => !TENANT_MODELS.has(m as Prisma.ModelName) && !NOT_TENANT.has(m));
  check(`todas las tablas con creatorId están en TENANT_MODELS${unprotected.length ? ` (faltan: ${unprotected.join(", ")})` : ""}`, unprotected.length === 0);

  const mariaProduct = await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id } });
  const mariaOrder = await prisma.order.findFirstOrThrow({ where: { creatorId: maria.id } });
  const mariaCustomer = await prisma.customer.findFirstOrThrow({ where: { creatorId: maria.id } });
  const mariaFile = await prisma.productFile.findFirstOrThrow({ where: { creatorId: maria.id } });

  // Lecturas
  const products = await db.product.findMany();
  check("findMany solo devuelve productos de Ana", products.length > 0 && products.every((p) => p.creatorId === ana.id));
  check("findFirst con id de producto de María → null", (await db.product.findFirst({ where: { id: mariaProduct.id } })) === null);
  check("findUnique con id de pedido de María → null", (await db.order.findUnique({ where: { id: mariaOrder.id } })) === null);
  check("findUnique con id de clienta de María → null", (await db.customer.findUnique({ where: { id: mariaCustomer.id } })) === null);
  check("archivos privados de María invisibles", (await db.productFile.findFirst({ where: { id: mariaFile.id } })) === null);
  const customers = await db.customer.findMany();
  check("clientes: solo la relación con Ana (Carmen compra a ambas, pero son filas distintas)", customers.every((c) => c.creatorId === ana.id) && !customers.some((c) => c.id === mariaCustomer.id));
  const agg = await db.order.aggregate({ _sum: { amountCents: true }, where: { status: "PAID" } });
  const real = await prisma.order.aggregate({ _sum: { amountCents: true }, where: { status: "PAID", creatorId: ana.id } });
  check("aggregate de ventas = solo ventas de Ana", agg._sum.amountCents === real._sum.amountCents);
  const groups = await db.analyticsEvent.groupBy({ by: ["creatorId"] });
  check("groupBy de analytics solo ve el tenant de Ana", groups.length === 1 && groups[0].creatorId === ana.id);
  check("count de reservas no incluye las de otras", (await db.booking.count()) === (await prisma.booking.count({ where: { creatorId: ana.id } })));

  // Escrituras (el siguiente "prisma:error" es esperado: Prisma rechaza el update)
  let threw = false;
  try {
    await db.product.update({ where: { id: mariaProduct.id }, data: { title: "hackeado" } });
  } catch {
    threw = true;
  }
  check("update sobre producto de María falla", threw);
  const um = await db.product.updateMany({ where: { id: mariaProduct.id }, data: { title: "hackeado" } });
  check("updateMany sobre producto de María afecta 0 filas", um.count === 0);
  const dm = await db.productFile.deleteMany({ where: { id: mariaFile.id } });
  check("deleteMany sobre archivo de María afecta 0 filas", dm.count === 0);
  const forged = await db.product.create({
    data: { creatorId: maria.id, type: "DIGITAL", slug: `isolation-${Date.now()}`, title: "Intento", priceCents: 100, status: "DRAFT" },
  });
  check("create con creatorId ajeno se reasigna a Ana", forged.creatorId === ana.id);
  await db.product.delete({ where: { id: forged.id } });
  const still = await prisma.product.findUniqueOrThrow({ where: { id: mariaProduct.id } });
  check("el producto de María sigue intacto", still.title === mariaProduct.title);

  // Tablas de reembolsos, condiciones legales y facturas: filas de María invisibles para Ana
  const tag = `isolation-${Date.now()}`;
  const snapshot = await prisma.legalSnapshot.create({ data: { creatorId: maria.id, hash: tag, content: { terms: "x" } } });
  const refund = await prisma.refund.create({
    data: { creatorId: maria.id, orderId: mariaOrder.id, amountCents: 100, reason: "OTHER", initiatedBy: "CREATOR", provider: "simulated" },
  });
  const invoice = await prisma.invoice.create({
    data: {
      creatorId: maria.id, kind: "SALE", type: "F2", issuer: "CREATOR", issuerKey: maria.id, seriesCode: "CIR", year: 2000, number: 1,
      fullNumber: tag, issuerName: "María Sol", issuerCountry: "ES", lines: [], baseCents: 100, taxRateBps: 0, taxCents: 0, totalCents: 100, dedupeKey: tag,
    },
  });
  try {
    check("condiciones legales de María invisibles", (await db.legalSnapshot.findFirst({ where: { id: snapshot.id } })) === null);
    check("reembolsos de María invisibles", (await db.refund.findUnique({ where: { id: refund.id } })) === null);
    check("findMany/count de reembolsos: solo los de Ana", (await db.refund.findMany()).every((r) => r.creatorId === ana.id) && (await db.refund.count()) === (await prisma.refund.count({ where: { creatorId: ana.id } })));
    check("facturas de María invisibles", (await db.invoice.findFirst({ where: { id: invoice.id } })) === null);
    check("count de facturas no incluye las de otras", (await db.invoice.count()) === (await prisma.invoice.count({ where: { creatorId: ana.id } })));
    const ur = await db.refund.updateMany({ where: { id: refund.id }, data: { status: "SUCCEEDED" } });
    check("updateMany sobre reembolso de María afecta 0 filas", ur.count === 0);
    const di = await db.invoice.deleteMany({ where: { id: invoice.id } });
    check("deleteMany sobre factura de María afecta 0 filas", di.count === 0);
  } finally {
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await prisma.refund.delete({ where: { id: refund.id } });
    await prisma.legalSnapshot.delete({ where: { id: snapshot.id } });
  }

  await legalIsolation(ana, maria);
  await paymentsIsolation(ana, maria);
  await refundsIsolation(ana, maria);
  await buyerScopeIsolation(ana, maria);

  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nAislamiento multi-tenant correcto ✓");
  process.exit(failures ? 1 : 0);
}

type CreatorRow = Awaited<ReturnType<typeof prisma.creator.findUniqueOrThrow>>;

/** Condiciones aceptadas (LegalSnapshot): /ana/legal?v={id de María} nunca enseña los textos de María. */
async function legalIsolation(ana: CreatorRow, maria: CreatorRow) {
  const before = new Set((await prisma.legalSnapshot.findMany({ where: { creatorId: { in: [ana.id, maria.id] } }, select: { id: true } })).map((r) => r.id));
  const mariaSnap = await ensureLegalSnapshot(maria.id);
  const again = await ensureLegalSnapshot(maria.id);
  const db = tenantDb(ana.id);
  let forgedId: string | null = null;
  try {
    check("condiciones sin cambios: se reutiliza la misma versión", again.id === mariaSnap.id);
    check("getLegalSnapshot(ana, versión de María) → null", (await getLegalSnapshot(ana.id, mariaSnap.id)) === null);
    check("getLegalSnapshot(maria, su versión) → sus textos", (await getLegalSnapshot(maria.id, mariaSnap.id))?.identity.legalName === maria.legalName);
    check("findFirst de la versión de María → null", (await db.legalSnapshot.findFirst({ where: { id: mariaSnap.id } })) === null);
    check("findMany de versiones: solo las de Ana", (await db.legalSnapshot.findMany()).every((r) => r.creatorId === ana.id));
    const forged = await db.legalSnapshot.create({ data: { creatorId: maria.id, hash: `isolation-${Date.now()}`, content: {} } });
    forgedId = forged.id;
    check("create de una versión con creatorId ajeno se reasigna a Ana", forged.creatorId === ana.id);
    const del = await db.legalSnapshot.deleteMany({ where: { id: mariaSnap.id } });
    check("deleteMany sobre la versión de María afecta 0 filas", del.count === 0);
  } finally {
    if (forgedId) await prisma.legalSnapshot.delete({ where: { id: forgedId } });
    if (!before.has(mariaSnap.id)) await prisma.legalSnapshot.deleteMany({ where: { id: mariaSnap.id, orders: { none: {} } } });
  }
}

/** Cobros: un pago, una cuenta de cobro o un informe de DAC7 nunca cruzan de una creadora a otra. */
async function paymentsIsolation(ana: CreatorRow, maria: CreatorRow) {
  const tag = `isolation-pago-${Date.now()}`;
  const mariaDigital = await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id, type: "DIGITAL", status: "PUBLISHED" } });
  const order = await createPendingOrder({ productId: mariaDigital.id, buyerEmail: `${tag}@example.com`, buyerName: "Prueba" });
  const payoutFields = { payoutStatus: true, payoutChargesEnabled: true, payoutPayoutsEnabled: true, payoutRequirements: true, payoutStatusUpdatedAt: true, payoutConnectedAt: true } as const;
  const anaPayout = await prisma.creator.findUniqueOrThrow({ where: { id: ana.id }, select: payoutFields });
  const mariaPayout = await prisma.creator.findUniqueOrThrow({ where: { id: maria.id }, select: payoutFields });
  try {
    // Un pago del pedido de María que va a la cuenta de Ana (metadatos manipulados) no se entrega.
    await applyPaymentUpdate(
      {
        kind: "payment",
        status: { state: "succeeded", ref: `sim_ch_${tag}`, amountCents: order.amountCents, currency: order.currency, destinationAccount: ana.payoutAccountId, metadata: { orderId: order.id } },
      },
      "simulated",
    );
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    check("pago hacia la cuenta de otra creadora: el pedido no se paga", after.status === "PENDING");
    check("…ni da acceso ni crea clienta en ningún tenant", (await prisma.access.count({ where: { orderId: order.id } })) === 0 && (await prisma.customer.count({ where: { email: `${tag}@example.com` } })) === 0);

    // La cuenta de cobro de Ana solo cambia la fila de Ana.
    await syncPayoutAccount(ana.payoutAccountId!, {
      accountId: ana.payoutAccountId!, chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true,
      currentlyDue: [], pastDue: [], eventuallyDue: ["individual.id_number"], pendingVerification: [], disabledReason: null, currentDeadline: null,
    });
    const anaNow = await prisma.creator.findUniqueOrThrow({ where: { id: ana.id }, select: payoutFields });
    const mariaNow = await prisma.creator.findUniqueOrThrow({ where: { id: maria.id }, select: payoutFields });
    check("sincronizar la cuenta de Ana actualiza a Ana", anaNow.payoutStatus === "ACTIVE" && anaNow.payoutRequirements !== null);
    check("…y deja la cuenta de cobro de María intacta", JSON.stringify(mariaNow) === JSON.stringify(mariaPayout));

    // DAC7: los totales de cada creadora son solo sus movimientos.
    const year = yearOf(new Date());
    const ownSessions = (creatorId: string) =>
      prisma.transaction.count({ where: { creatorId, type: "CHARGE", status: "SUCCEEDED", order: { productType: "SESSION", paidAt: { gte: new Date(Date.UTC(year, 0, 1) - 3_600_000) } } } });
    const anaDac7 = await dac7ForCreator(ana.id, year);
    check("DAC7 de Ana: solo cuenta sus sesiones", anaDac7.agg.total.activities === (await ownSessions(ana.id)));
    const report = await dac7Report(year);
    const ids = report.map((r) => r.creator.id);
    check("informe DAC7: una fila por creadora", new Set(ids).size === ids.length);
    const anaRow = report.find((r) => r.creator.id === ana.id);
    const mariaRow = report.find((r) => r.creator.id === maria.id);
    check("informe DAC7: la fila de Ana coincide con su panel", !!anaRow && JSON.stringify(anaRow.agg) === JSON.stringify(anaDac7.agg));
    check("informe DAC7: la fila de María solo tiene lo suyo", (mariaRow?.agg.total.activities ?? 0) === (await ownSessions(maria.id)));

    // «Pagar ahora» busca la suscripción por la usuaria de la sesión: con otra usuaria, nada.
    const sub = await prisma.subscription.findFirst({ where: { creatorId: ana.id } });
    if (sub) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE" } });
      try {
        const intruder = await prisma.user.findFirstOrThrow({ where: { id: { not: sub.userId }, email: { not: "" } } });
        check("«Pagar ahora» no encuentra la suscripción de otra persona", (await findPastDueSubscription(intruder.id, sub.productId)) === null);
        check("…pero sí la de su dueña", (await findPastDueSubscription(sub.userId, sub.productId))?.id === sub.id);
      } finally {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: sub.status } });
      }
    }
  } finally {
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.creator.update({ where: { id: ana.id }, data: { ...anaPayout, payoutRequirements: anaPayout.payoutRequirements ?? Prisma.DbNull } });
  }
}

/** Reembolsos, desistimientos y cambios de reserva: Ana no toca nada de María; Laura, nada de Carmen. */
async function refundsIsolation(ana: CreatorRow, maria: CreatorRow) {
  let providerCalls = 0;
  const provider: PaymentProvider = {
    ...simulatedProvider,
    async refund() {
      providerCalls++;
      return { ok: true, refundRef: `sim_re_isolation_${Date.now()}`, status: "succeeded" };
    },
  };
  const mariaOrder = await prisma.order.findFirstOrThrow({ where: { creatorId: maria.id, status: "PAID" }, include: { customer: true } });
  const before = { status: mariaOrder.status, refundedCents: mariaOrder.refundedCents };
  const r = await refundOrder(
    { orderId: mariaOrder.id, actor: { kind: "creator", creatorId: ana.id, userId: ana.userId }, reason: "OTHER", revokeAccess: true, cancelBooking: true },
    { provider },
  );
  const after = await prisma.order.findUniqueOrThrow({ where: { id: mariaOrder.id } });
  check("Ana no puede reembolsar un pedido de María (NOT_FOUND)", !r.ok && r.code === "NOT_FOUND");
  check("…ni se llama a la pasarela ni se crea un Refund", providerCalls === 0 && (await prisma.refund.count({ where: { orderId: mariaOrder.id } })) === 0);
  check("…y el pedido de María sigue igual", after.status === before.status && after.refundedCents === before.refundedCents);

  // Laura no puede desistir de la compra de Carmen a María.
  const laura = await prisma.user.findUniqueOrThrow({ where: { email: "laura@example.com" } });
  const w = await withdrawOrder({ orderId: mariaOrder.id, userId: laura.id, email: laura.email }, { provider });
  check("Laura no puede desistir de una compra de Carmen (NOT_FOUND)", !w.ok && w.code === "NOT_FOUND" && providerCalls === 0);

  // Reserva temporal de María: Ana no puede cancelarla ni moverla.
  const start = new Date(Date.now() + 40 * 86_400_000);
  const mariaProduct = await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id } });
  const booking = await prisma.booking.create({
    data: {
      creatorId: maria.id, productId: mariaProduct.id, customerId: mariaOrder.customerId!, userId: mariaOrder.customer!.userId,
      status: "CONFIRMED", startAt: start, endAt: new Date(start.getTime() + 3_600_000),
    },
  });
  try {
    const c = await cancelBooking({ creatorId: ana.id, bookingId: booking.id, by: "CREATOR", reason: "intento", notify: true });
    const m = await requestReschedule({ creatorId: ana.id, bookingId: booking.id, note: null });
    const still = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    check("Ana no puede cancelar ni mover una reserva de María", !c.ok && !m.ok);
    check("…y la reserva de María sigue intacta", still.status === "CONFIRMED" && still.startAt?.getTime() === start.getTime() && !still.rescheduleRequestedAt);
  } finally {
    await prisma.booking.delete({ where: { id: booking.id } });
  }
}

/**
 * Alcance de comprador: una sesión limitada a un pedido (tras pagar o desde un enlace personal) solo
 * abre ese pedido, nunca lo de otra creadora; los enlaces personales llevan a la compra correcta y
 * se revocan sin tocar los de otros pedidos.
 */
async function buyerScopeIsolation(ana: CreatorRow, maria: CreatorRow) {
  const carmen = await prisma.user.findUniqueOrThrow({ where: { email: "carmen@example.com" } });
  const mariaOrder = await prisma.order.findFirstOrThrow({ where: { creatorId: maria.id, status: "PAID", customer: { userId: carmen.id } }, include: { customer: true } });
  // Otro pedido pagado (de Ana) para comprobar que revocar uno no toca los demás.
  const anaOrder = await prisma.order.findFirstOrThrow({ where: { creatorId: ana.id, status: "PAID", customerId: { not: null } }, include: { customer: true } });
  const anaProduct = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id } });
  const anaBooking = await prisma.booking.findFirstOrThrow({ where: { creatorId: ana.id, userId: carmen.id } });
  const scope = { orderId: mariaOrder.id, productId: mariaOrder.productId };
  check("alcance del pedido de Carmen a María: abre ese pedido y su producto", scopeAllows(scope, { orderId: mariaOrder.id }) && scopeAllows(scope, { productId: mariaOrder.productId }));
  check("…pero no un producto de Ana", !scopeAllows(scope, { productId: anaProduct.id }));
  check("…ni la reserva de Carmen con Ana (otro pedido)", anaBooking.orderId !== mariaOrder.id && !scopeAllows(scope, { bookingOrderId: anaBooking.orderId }));
  check("…ni otro pedido de Ana", !scopeAllows(scope, { orderId: anaOrder.id }));

  const link = await createOrderLink({ orderId: mariaOrder.id, path: `/cuenta/pedidos/${mariaOrder.id}` });
  const other = await createOrderLink({ orderId: anaOrder.id, path: "//evil.example/robo" });
  const tag = `isolation-scope-${Date.now()}`;
  const sessions = await Promise.all(
    [mariaOrder, anaOrder].map((o, i) =>
      prisma.session.create({ data: { id: `${tag}-${i}`, userId: o.customer!.userId, orderId: o.id, verified: false, expiresAt: new Date(Date.now() + 3_600_000) } }),
    ),
  );
  try {
    const res = await resolveOrderLink(new URL(link.url).searchParams.get("t")!);
    check("el enlace personal resuelve al pedido de María", res?.status === "ok" && res.order.creatorId === maria.id && res.order.id === mariaOrder.id);
    check("…con una ruta interna", res?.status === "ok" && res.link.path === `/cuenta/pedidos/${mariaOrder.id}`);
    const forged = await resolveOrderLink(new URL(other.url).searchParams.get("t")!);
    check("una ruta externa se sustituye por la de la compra", forged?.status === "ok" && forged.link.path === `/cuenta/pedidos/${anaOrder.id}`);
    check("un token inventado no resuelve nada", (await resolveOrderLink("inventado")) === null);

    await revokeOrderAccess(mariaOrder.id);
    const left = {
      links: await prisma.orderLink.count({ where: { orderId: mariaOrder.id } }),
      sessions: await prisma.session.count({ where: { orderId: mariaOrder.id } }),
    };
    check("revokeOrderAccess borra los enlaces y las sesiones de ese pedido", left.links === 0 && left.sessions === 0);
    check(
      "…y no toca los de otros pedidos",
      (await prisma.orderLink.count({ where: { orderId: anaOrder.id } })) >= 1 && (await prisma.session.count({ where: { id: sessions[1].id } })) === 1,
    );
  } finally {
    await prisma.session.deleteMany({ where: { id: { in: sessions.map((x) => x.id) } } });
    const hashes = [link, other].map((l) => createHash("sha256").update(new URL(l.url).searchParams.get("t")!).digest("hex"));
    await prisma.orderLink.deleteMany({ where: { tokenHash: { in: hashes } } });
  }
}

main().finally(() => prisma.$disconnect());
