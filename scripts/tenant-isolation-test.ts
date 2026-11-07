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
import { listDeliveryIssues, productDeliveryIssue } from "../lib/delivery";
import { RULES, limitUpload } from "../lib/limits";
import { resetKey, rlKey } from "../lib/rate-limit";
import { recoveryFacts } from "../lib/recovery-guard";
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
  // Calendario propio: fechas especiales y entregas de Ana (sembradas) invisibles para María.
  const mariaDb = tenantDb(maria.id);
  const anaOverride = await prisma.availabilityOverride.findFirstOrThrow({ where: { creatorId: ana.id } });
  const anaOrderFile = await prisma.orderFile.findFirstOrThrow({ where: { creatorId: ana.id } });
  check("María no ve las fechas especiales de Ana", (await mariaDb.availabilityOverride.findFirst({ where: { id: anaOverride.id } })) === null);
  check("María no ve las entregas de Ana", (await mariaDb.orderFile.findFirst({ where: { id: anaOrderFile.id } })) === null);
  check("María no puede borrar una fecha especial de Ana", (await mariaDb.availabilityOverride.deleteMany({ where: { id: anaOverride.id } })).count === 0);
  check("María no puede marcar como enviada una entrega de Ana", (await mariaDb.orderFile.updateMany({ where: { id: anaOrderFile.id }, data: { name: "x" } })).count === 0);
  // Diario del calendario de Ana (sembrado): privado.
  const anaNote = await prisma.calendarNote.findFirstOrThrow({ where: { creatorId: ana.id } });
  check("María no ve las notas del calendario de Ana", (await mariaDb.calendarNote.findFirst({ where: { id: anaNote.id } })) === null && (await mariaDb.calendarNote.count({ where: { date: anaNote.date } })) === 0);
  check("María no puede cambiar ni borrar una nota de Ana", (await mariaDb.calendarNote.updateMany({ where: { id: anaNote.id }, data: { body: "x" } })).count === 0 && (await mariaDb.calendarNote.deleteMany({ where: { id: anaNote.id } })).count === 0);
  // Un upsert de María con la clave de Ana crea (o cambia) la nota de María, nunca la de Ana.
  await mariaDb.calendarNote.upsert({ where: { creatorId_date: { creatorId: maria.id, date: anaNote.date } }, create: { creatorId: maria.id, date: anaNote.date, body: "de María" }, update: { body: "de María" } });
  check("la nota de Ana sigue intacta tras el upsert de María", (await prisma.calendarNote.findUniqueOrThrow({ where: { id: anaNote.id } })).body === anaNote.body);
  await prisma.calendarNote.deleteMany({ where: { creatorId: maria.id, date: anaNote.date } });
  // Comunidad: comentarios y «me gusta» sembrados de Ana invisibles e intocables para María.
  const anaComment = await prisma.membershipComment.findFirstOrThrow({ where: { creatorId: ana.id } });
  const anaLike = await prisma.membershipPostLike.findFirstOrThrow({ where: { creatorId: ana.id } });
  check("María no ve los comentarios ni los «me gusta» de Ana", (await mariaDb.membershipComment.findFirst({ where: { id: anaComment.id } })) === null && (await mariaDb.membershipPostLike.count({ where: { id: anaLike.id } })) === 0);
  check("María no puede borrar ni cambiar un comentario de Ana", (await mariaDb.membershipComment.updateMany({ where: { id: anaComment.id }, data: { body: "x" } })).count === 0 && (await mariaDb.membershipPostLike.deleteMany({ where: { id: anaLike.id } })).count === 0);
  check("María no ve qué incluyen las membresías de Ana", (await mariaDb.productInclusion.count({ where: { creatorId: ana.id } })) === 0);
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

  // Partes de las lecciones (LessonPart): María con un curso temporal; Ana solo ve las suyas y una
  // parte creada con el creatorId de María se queda a nombre de Ana.
  {
    const t = `isolation-lp-${Date.now()}`;
    const mc = await prisma.product.create({ data: { creatorId: maria.id, type: "COURSE", slug: t, title: "Curso de María", priceCents: 0 } });
    try {
      const mm = await prisma.courseModule.create({ data: { creatorId: maria.id, productId: mc.id, title: "M", sortOrder: 0 } });
      const ml = await prisma.lesson.create({ data: { creatorId: maria.id, productId: mc.id, moduleId: mm.id, title: "L", kind: "TEXT", sortOrder: 0 } });
      const mp = await prisma.lessonPart.create({ data: { creatorId: maria.id, productId: mc.id, lessonId: ml.id, sortOrder: 0, kind: "TEXT", body: "de María" } });
      const anaParts = await db.lessonPart.findMany();
      check("partes de lección: Ana solo ve las suyas (y María tiene alguna)", anaParts.length > 0 && anaParts.every((p) => p.creatorId === ana.id) && !anaParts.some((p) => p.id === mp.id));
      check("findFirst de una parte de María → null", (await db.lessonPart.findFirst({ where: { id: mp.id } })) === null);
      check("deleteMany de una parte de María → 0 filas", (await db.lessonPart.deleteMany({ where: { id: mp.id } })).count === 0);
      const fp = await db.lessonPart.create({ data: { creatorId: maria.id, productId: mc.id, lessonId: ml.id, sortOrder: 1, kind: "TEXT", body: "intento" } });
      check("create de una parte con creatorId ajeno se reasigna a Ana", fp.creatorId === ana.id);
    } finally {
      await prisma.product.delete({ where: { id: mc.id } });
    }
  }

  // Tablas de reembolsos y condiciones legales: filas de María invisibles para Ana
  const tag = `isolation-${Date.now()}`;
  const snapshot = await prisma.legalSnapshot.create({ data: { creatorId: maria.id, hash: tag, content: { terms: "x" } } });
  const refund = await prisma.refund.create({
    data: { creatorId: maria.id, orderId: mariaOrder.id, amountCents: 100, reason: "OTHER", initiatedBy: "CREATOR", provider: "simulated" },
  });
  try {
    check("condiciones legales de María invisibles", (await db.legalSnapshot.findFirst({ where: { id: snapshot.id } })) === null);
    check("reembolsos de María invisibles", (await db.refund.findUnique({ where: { id: refund.id } })) === null);
    check("findMany/count de reembolsos: solo los de Ana", (await db.refund.findMany()).every((r) => r.creatorId === ana.id) && (await db.refund.count()) === (await prisma.refund.count({ where: { creatorId: ana.id } })));
    const ur = await db.refund.updateMany({ where: { id: refund.id }, data: { status: "SUCCEEDED" } });
    check("updateMany sobre reembolso de María afecta 0 filas", ur.count === 0);
  } finally {
    await prisma.refund.delete({ where: { id: refund.id } });
    await prisma.legalSnapshot.delete({ where: { id: snapshot.id } });
  }

  await legalIsolation(ana, maria);
  await paymentsIsolation(ana, maria);
  await refundsIsolation(ana, maria);
  await buyerScopeIsolation(ana, maria);
  await deliveryIsolation(ana, maria);
  await limitsIsolation(ana, maria);
  await optOutIsolation(ana, maria);
  await contentIsolation(ana, maria);

  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nAislamiento multi-tenant correcto ✓");
  process.exit(failures ? 1 : 0);
}

type CreatorRow = Awaited<ReturnType<typeof prisma.creator.findUniqueOrThrow>>;

/** Bajas de los recordatorios (RecoveryOptOut): las de María no se ven ni se tocan desde el panel de Ana. */
async function optOutIsolation(ana: CreatorRow, maria: CreatorRow) {
  const db = tenantDb(ana.id);
  const hash = createHash("sha256").update(`aislamiento-baja-${Date.now()}@example.com`).digest("hex");
  const row = await prisma.recoveryOptOut.create({ data: { creatorId: maria.id, emailHash: hash } });
  try {
    check("bajas de María invisibles", (await db.recoveryOptOut.findFirst({ where: { id: row.id } })) === null);
    check("findUnique de una baja de María por (creadora, hash) → null", (await db.recoveryOptOut.findUnique({ where: { creatorId_emailHash: { creatorId: maria.id, emailHash: hash } } })) === null);
    check("count de bajas no incluye las de otras", (await db.recoveryOptOut.count()) === (await prisma.recoveryOptOut.count({ where: { creatorId: ana.id } })));
    const dm = await db.recoveryOptOut.deleteMany({ where: { id: row.id } });
    check("deleteMany sobre una baja de María afecta 0 filas", dm.count === 0);
  } finally {
    await prisma.recoveryOptOut.deleteMany({ where: { id: row.id } });
  }
}

/** Publicaciones y códigos de descuento: los de María no se ven, cambian ni borran desde el panel de Ana. */
async function contentIsolation(ana: CreatorRow, maria: CreatorRow) {
  const db = tenantDb(ana.id);
  const tag = `isolation-contenido-${Date.now()}`;
  const post = await prisma.post.create({ data: { creatorId: maria.id, slug: tag, title: "Novedad de María", body: "Texto", status: "PUBLISHED", publishedAt: new Date() } });
  const code = await prisma.discountCode.create({ data: { creatorId: maria.id, brand: "Marca", code: "MARIA10", url: "https://example.com" } });
  const forged: string[] = [];
  try {
    check("publicaciones de María invisibles", (await db.post.findFirst({ where: { id: post.id } })) === null);
    check("findUnique de una publicación de María por (creadora, slug) → null", (await db.post.findUnique({ where: { creatorId_slug: { creatorId: maria.id, slug: tag } } })) === null);
    check("findMany de publicaciones: solo las de Ana", (await db.post.findMany()).every((p) => p.creatorId === ana.id));
    check("count de publicaciones = las de Ana", (await db.post.count()) === (await prisma.post.count({ where: { creatorId: ana.id } })));
    const up = await db.post.updateMany({ where: { id: post.id }, data: { title: "hackeada" } });
    check("updateMany sobre una publicación de María afecta 0 filas", up.count === 0);
    const dp = await db.post.deleteMany({ where: { id: post.id } });
    check("deleteMany sobre una publicación de María afecta 0 filas", dp.count === 0);
    const fp = await db.post.create({ data: { creatorId: maria.id, slug: tag, title: "Intento", body: "x" } });
    forged.push(fp.id);
    check("create de una publicación con creatorId ajeno se reasigna a Ana", fp.creatorId === ana.id);

    check("códigos de María invisibles", (await db.discountCode.findFirst({ where: { id: code.id } })) === null);
    check("findMany de códigos: solo los de Ana", (await db.discountCode.findMany()).every((c) => c.creatorId === ana.id));
    check("count de códigos = los de Ana", (await db.discountCode.count()) === (await prisma.discountCode.count({ where: { creatorId: ana.id } })));
    const uc = await db.discountCode.updateMany({ where: { id: code.id }, data: { code: "HACK" } });
    check("updateMany sobre un código de María afecta 0 filas", uc.count === 0);
    const dc = await db.discountCode.deleteMany({ where: { id: code.id } });
    check("deleteMany sobre un código de María afecta 0 filas", dc.count === 0);
    const fc = await db.discountCode.create({ data: { creatorId: maria.id, brand: "Intento", code: "X", url: "https://example.com" } });
    check("create de un código con creatorId ajeno se reasigna a Ana", fc.creatorId === ana.id);
    await prisma.discountCode.delete({ where: { id: fc.id } });
    const still = await Promise.all([prisma.post.findUniqueOrThrow({ where: { id: post.id } }), prisma.discountCode.findUniqueOrThrow({ where: { id: code.id } })]);
    check("la publicación y el código de María siguen intactos", still[0].title === post.title && still[1].code === code.code);
  } finally {
    await prisma.post.deleteMany({ where: { id: { in: [post.id, ...forged] } } });
    await prisma.discountCode.deleteMany({ where: { id: code.id } });
  }
}

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

/** Cobros: un pago o una cuenta de cobro nunca cruzan de una creadora a otra. */
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

/** Avisos de entrega (lib/delivery.ts): cada creadora solo ve los suyos, y la semilla no publica nada vacío. */
async function deliveryIsolation(ana: CreatorRow, maria: CreatorRow) {
  const creators = await prisma.creator.findMany({ select: { id: true, username: true } });
  const broken: string[] = [];
  for (const c of creators)
    for (const x of await listDeliveryIssues(tenantDb(c.id)))
      if (x.issue.blocking && x.product.status === "PUBLISHED") broken.push(`${c.username}/${x.product.title}`);
  check(`ningún producto publicado sin nada que entregar${broken.length ? ` (${broken.join(", ")})` : ""}`, broken.length === 0);

  const tag = `isolation-delivery-${Date.now()}`;
  const [anaDraft, mariaDraft] = await Promise.all(
    [ana, maria].map((c) =>
      prisma.product.create({ data: { creatorId: c.id, type: "DIGITAL", status: "DRAFT", slug: `${tag}-${c.username}`, title: "Tirada de 3 cartas", priceCents: 1900 } }),
    ),
  );
  try {
    const issues = await listDeliveryIssues(tenantDb(ana.id));
    const owners = await prisma.product.findMany({ where: { id: { in: issues.map((x) => x.product.id) } }, select: { creatorId: true } });
    check("listDeliveryIssues(Ana) incluye su borrador sin entrega", issues.some((x) => x.product.id === anaDraft.id && x.issue.code === "NO_CONTENT"));
    check("…y solo productos de Ana", owners.length === issues.length && owners.every((o) => o.creatorId === ana.id));
    check("productDeliveryIssue(Ana) con el id de un producto de María → null", (await productDeliveryIssue(tenantDb(ana.id), mariaDraft.id)) === null);
  } finally {
    await prisma.product.deleteMany({ where: { id: { in: [anaDraft.id, mariaDraft.id] } } });
  }
}

/** Límites de intentos: el cupo de subidas es de cada creadora y la regla de recuperación no cruza tenants. */
async function limitsIsolation(ana: CreatorRow, maria: CreatorRow) {
  const uploadKeys = [ana, maria].map((c) => rlKey("upload", c.id));
  await Promise.all(uploadKeys.map(resetKey));
  try {
    const anaUploads = [];
    for (let i = 0; i < RULES.uploadCreator.limit + 1; i++) anaUploads.push(await limitUpload(ana.id));
    check("limitUpload: Ana agota sus 30 subidas y la 31.ª se deniega", anaUploads.slice(0, 30).every((v) => v.ok) && !anaUploads[30].ok);
    check("…mientras María sigue pudiendo subir", (await limitUpload(maria.id)).ok);
  } finally {
    await Promise.all(uploadKeys.map(resetKey));
  }

  // Un pedido de Ana cuya visitante solo abrió el checkout en la página de María (mismo id de
  // producto incluso): no cuenta como checkout real para el email de recuperación de Ana.
  const visitorId = `isolation-recovery-${Date.now()}`;
  const anaProduct = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL" } });
  await prisma.analyticsEvent.create({ data: { creatorId: maria.id, type: "CHECKOUT_STARTED", productId: anaProduct.id, visitorId, createdAt: new Date(Date.now() - 60_000) } });
  try {
    const facts = await recoveryFacts({
      id: visitorId, creatorId: ana.id, productId: anaProduct.id, buyerEmail: `${visitorId}@example.com`, visitorId, ipHash: null, createdAt: new Date(),
    });
    check("recuperación: el checkout abierto en el tenant de María no vale para un pedido de Ana", facts.hasVisitor && !facts.startedCheckout);
  } finally {
    await prisma.analyticsEvent.deleteMany({ where: { visitorId } });
  }
}

main().finally(() => prisma.$disconnect());
