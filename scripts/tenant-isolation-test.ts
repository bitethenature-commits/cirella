/**
 * Prueba de aislamiento multi-tenant.
 *   npm run test:isolation
 *
 * Comprueba que el cliente `tenantDb(ana)` jamás lee, modifica ni borra datos
 * de otra creadora (María), aunque se le pasen sus ids directamente.
 */
import "./load-env";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { yearOf } from "../lib/dac7";
import { dac7ForCreator, dac7Report } from "../lib/dac7-data";
import { createPendingOrder } from "../lib/orders";
import { applyPaymentUpdate } from "../lib/payments/events";
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

  await paymentsIsolation(ana, maria);

  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nAislamiento multi-tenant correcto ✓");
  process.exit(failures ? 1 : 0);
}

type CreatorRow = Awaited<ReturnType<typeof prisma.creator.findUniqueOrThrow>>;

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

main().finally(() => prisma.$disconnect());
