/**
 * Pruebas de IVA y facturas contra Postgres (pasarela simulada).
 *   npm run test:invoices        (con la BD sembrada: npm run db:reset)
 *
 *   · fuera del modo demo, sin los datos fiscales de la empresa no se vende lo que vende Cirella;
 *   · venta digital a España con NIF: IVA en el pedido y el cobro, comisión sobre la base, la
 *     pasarela retiene comisión + IVA y se emite una factura completa (F1, serie V);
 *   · venta a Francia: 20 % con nota OSS y simplificada (F2); la factura con NIF-IVA pedida después
 *     la sustituye (F3) una sola vez; el reembolso emite la rectificativa (R1) en negativo;
 *   · sesión de una creadora sin IVA: sin factura; con IVA: factura en su nombre (serie CIR);
 *   · renovación de membresía con su IVA y su factura;
 *   · factura mensual de cuotas y comisiones: idempotente y sin las ventas de Cirella.
 * Borra todo lo que crea.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { isDemoMode } from "../lib/env";
import { issueMonthlyPlatformInvoices, monthPeriod } from "../lib/invoices/fees";
import { invoiceLines } from "../lib/invoices/format";
import { InvoiceError, issueFullInvoiceForOrder } from "../lib/invoices/issue";
import { CheckoutError, createPendingOrder, startOrderPayment } from "../lib/orders";
import { paymentProvider } from "../lib/payments";
import { markRefundSucceeded, refundOrder } from "../lib/refunds";
import { processRenewals } from "../lib/subscriptions";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `facturas-${Date.now()}`;
const STARTED = new Date();
const email = (label: string) => `${TAG}-${label}@example.com`;
const created = { orders: [] as string[], feeInvoices: [] as string[] };
const errorOf = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof CheckoutError || e instanceof InvoiceError ? e.message : String(e)));

/** Lo que hace el checkout: pedido con país y datos de factura, condiciones aceptadas y pago. */
async function buy(productId: string, label: string, opts: { country?: string; billing?: { name: string; taxId: string; address: string } } = {}) {
  const order = await createPendingOrder({
    productId,
    buyerEmail: email(label),
    buyerName: `Prueba ${label}`,
    buyerCountry: opts.country ?? "ES",
    ipCountry: opts.country ?? "ES",
    billing: opts.billing ?? null,
  });
  created.orders.push(order.id);
  await prisma.order.update({ where: { id: order.id }, data: { termsAcceptedAt: new Date() } });
  await startOrderPayment(order.id, { method: "card", cardNumber: "4242 4242 4242 4242" });
  return prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { transactions: true, invoices: { orderBy: { issuedAt: "asc" } } } });
}

async function main() {
  check("pasarela simulada", paymentProvider().key === "simulated");
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" }, include: { plan: true } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const product = (creatorId: string, type: string) => prisma.product.findFirstOrThrow({ where: { creatorId, type, status: "PUBLISHED" } });
  const digital = await product(ana.id, "DIGITAL");
  const anaSession = await product(ana.id, "SESSION");
  const membership = await product(ana.id, "MEMBERSHIP");
  const mariaSession = await product(maria.id, "SESSION");

  // ── 1. Sin datos fiscales de la empresa no vende Cirella (fuera del modo demo) ──
  const company = await prisma.platformSetting.findUnique({ where: { key: "legalCompanyName" } });
  if (!isDemoMode()) {
    await prisma.platformSetting.upsert({ where: { key: "legalCompanyName" }, update: { value: "" }, create: { key: "legalCompanyName", value: "" } });
    try {
      const msg = await errorOf(createPendingOrder({ productId: digital.id, buyerEmail: email("sin-empresa"), buyerName: "Prueba" }));
      check("sin datos de la empresa: no se crea el pedido de un producto digital", msg === "Las compras no están disponibles en este momento.", msg);
      const session = await createPendingOrder({ productId: anaSession.id, buyerEmail: email("sin-empresa-sesion"), buyerName: "Prueba" });
      created.orders.push(session.id);
      check("…pero sí el de una sesión (la vende la creadora)", session.taxSeller === "CREATOR");
    } finally {
      if (company) await prisma.platformSetting.update({ where: { key: "legalCompanyName" }, data: { value: company.value ?? "" } });
    }
  } else console.log("· (modo demo: se omite la comprobación de los datos de la empresa)");

  // ── 2. Venta digital a España con factura: F1, comisión sobre la base, la pasarela retiene el IVA ──
  const provider = paymentProvider();
  const realStart = provider.startPayment;
  const fees: number[] = [];
  provider.startPayment = async (i) => {
    fees.push(i.platformFeeCents);
    return realStart(i);
  };
  let es;
  try {
    es = await buy(digital.id, "es", { billing: { name: "Paula Gómez", taxId: "12345678Z", address: "Calle Sol 1, 28001 Madrid" } });
  } finally {
    provider.startPayment = realStart;
  }
  const commission = ana.plan.commissionBps;
  const base = Math.round((digital.priceCents * 10000) / 12100);
  const tax = digital.priceCents - base;
  const fee = Math.round((base * commission) / 10000);
  check("ES: pedido pagado con Cirella como vendedora al 21 %", es.status === "PAID" && es.taxSeller === "PLATFORM" && es.taxCountry === "ES" && es.taxRateBps === 2100 && es.taxCents === tax, es);
  check("ES: comisión sobre la base sin IVA y neto sin el IVA", es.platformFeeCents === fee && es.netCents === digital.priceCents - fee - tax, { fee: es.platformFeeCents, net: es.netCents });
  check("ES: la pasarela retiene comisión + IVA (application_fee_amount)", fees[0] === fee + tax, fees);
  const esCharge = es.transactions.find((t) => t.type === "CHARGE");
  check("ES: el cobro copia la instantánea fiscal", esCharge?.taxSeller === "PLATFORM" && esCharge.taxCents === tax && esCharge.taxCountry === "ES", esCharge);
  const f1 = es.invoices[0];
  check("ES: factura completa F1 de la serie V con el NIF", es.invoices.length === 1 && f1.type === "F1" && f1.seriesCode === "V" && /^V\d{4}-\d{6}$/.test(f1.fullNumber) && f1.recipientTaxId === "12345678Z", es.invoices);
  check("ES: base + IVA = total en la factura y en sus líneas", f1.baseCents + f1.taxCents === f1.totalCents && f1.totalCents === digital.priceCents && invoiceLines(f1.lines).every((l) => l.baseCents + l.taxCents === l.totalCents));
  check("ES: la factura es de la compradora (acceso desde su cuenta)", !!f1.buyerUserId && f1.buyerUserId === (await prisma.customer.findUniqueOrThrow({ where: { id: es.customerId! } })).userId);
  const again = await issueFullInvoiceForOrder(es.id, { name: "Otra", taxId: "12345678Z", address: "Otra calle 2", country: "ES" });
  check("ES: pedir otra factura completa devuelve la misma", again.id === f1.id);

  // ── 3. Francia sin factura → F2 con OSS; después F3 con NIF-IVA; el reembolso → R1 ──
  const fr = await buy(digital.id, "fr", { country: "FR" });
  const f2 = fr.invoices[0];
  check("FR: 20 % con la nota de la ventanilla única", fr.taxRateBps === 2000 && f2?.type === "F2" && !!f2.taxNote?.includes("OSS"), f2);
  check("FR: la simplificada no lleva NIF", f2.recipientTaxId === null && f2.recipientEmail === email("fr"));
  check("FR: NIF no válido → error", (await errorOf(issueFullInvoiceForOrder(fr.id, { name: "Société", taxId: "ab", address: "1 rue de Paris", country: "FR" }))) === "Revisa el NIF: no es válido");
  const f3 = await issueFullInvoiceForOrder(fr.id, { name: "Société Lune", taxId: "FR 12345678901", address: "1 rue de la Paix, 75002 Paris", country: "FR" });
  check("FR: F3 en la misma serie que sustituye a la simplificada", f3.type === "F3" && f3.seriesCode === "V" && f3.relatedInvoiceId === f2.id && !!f3.taxNote?.includes(`Sustituye a la factura simplificada ${f2.fullNumber}`), f3);
  check("FR: F3 con los importes de la venta y el NIF-IVA normalizado", f3.totalCents === f2.totalCents && f3.taxCents === f2.taxCents && f3.recipientTaxId === "FR12345678901");
  const twice = await Promise.all([
    issueFullInvoiceForOrder(fr.id, { name: "Société Lune", taxId: "FR12345678901", address: "1 rue de la Paix", country: "FR" }),
    issueFullInvoiceForOrder(fr.id, { name: "Société Lune", taxId: "FR12345678901", address: "1 rue de la Paix", country: "FR" }),
  ]);
  check("FR: pedirla otra vez (y a la vez) no emite otra", twice.every((i) => i.id === f3.id) && (await prisma.invoice.count({ where: { orderId: fr.id, type: "F3" } })) === 1);

  const r = await refundOrder({ orderId: fr.id, actor: { kind: "creator", creatorId: ana.id, userId: ana.userId }, reason: "CUSTOMER_REQUEST", revokeAccess: true, cancelBooking: false });
  if (r.ok && r.status === "PENDING") await markRefundSucceeded(r.refundId);
  const refundTx = await prisma.transaction.findFirst({ where: { orderId: fr.id, type: "REFUND" } });
  check("reembolso: fila REFUND con el IVA en negativo", !!refundTx && refundTx.taxCents === -fr.taxCents && refundTx.taxSeller === "PLATFORM", refundTx);
  check("reembolso: a la creadora solo se le descuenta lo que recibió", refundTx?.netCents === -fr.netCents, { refund: refundTx?.netCents, net: fr.netCents });
  const r1 = await prisma.invoice.findFirst({ where: { orderId: fr.id, type: { in: ["R1", "R5"] } } });
  check("reembolso: rectificativa R1 de la F3, serie R, en negativo", r1?.type === "R1" && r1.seriesCode === "R" && r1.relatedInvoiceId === f3.id && r1.totalCents === -fr.amountCents && r1.taxCents === -fr.taxCents, r1);

  // ── 4. Sesiones: la vende la creadora ──
  const mSes = await buy(mariaSession.id, "maria-sesion");
  check("sesión de María (sin IVA): 0 % y sin factura", mSes.taxSeller === "CREATOR" && mSes.taxRateBps === 0 && mSes.invoices.length === 0, mSes);
  check("…y no se puede pedir factura", (await errorOf(issueFullInvoiceForOrder(mSes.id, { name: "Paula", taxId: "12345678Z", address: "Calle Sol 1, Madrid", country: "ES" }))).includes("no emite facturas"));
  const aSes = await buy(anaSession.id, "ana-sesion", { country: "FR" });
  const cir = aSes.invoices[0];
  check("sesión de Ana (con IVA): IVA de su país aunque la compradora sea de Francia", aSes.taxSeller === "CREATOR" && aSes.taxCountry === "ES" && aSes.taxRateBps === 2100);
  check("…neto = precio − comisión (el IVA lo declara ella)", aSes.netCents === aSes.amountCents - aSes.platformFeeCents);
  check("…factura en su nombre, serie CIR, numerada por creadora", cir?.issuer === "CREATOR" && cir.seriesCode === "CIR" && cir.issuerKey === ana.id && cir.issuerTaxId === ana.legalTaxId && !!cir.taxNote?.includes("en nombre y por cuenta de"), cir);

  // ── 5. Renovación de membresía con su IVA y su factura ──
  const member = await buy(membership.id, "miembro", { country: "DE" });
  const sub = await prisma.subscription.findFirstOrThrow({ where: { productId: membership.id, customer: { email: email("miembro") } } });
  check("membresía: la suscripción recuerda el pedido y el país", sub.orderId === member.id && sub.buyerCountry === "DE");
  await prisma.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: new Date(Date.now() - 60_000), providerPaymentMethodRef: null } });
  await processRenewals();
  const renewal = await prisma.transaction.findFirst({ where: { subscriptionId: sub.id, type: "RENEWAL" } });
  check("renovación: IVA de Alemania (19 %) y neto sin el IVA", renewal?.taxSeller === "PLATFORM" && renewal.taxRateBps === 1900 && renewal.netCents === renewal.amountCents - renewal.platformFeeCents - renewal.taxCents, renewal);
  const renewalInvoice = renewal ? await prisma.invoice.findUnique({ where: { dedupeKey: `sale:${renewal.id}` } }) : null;
  check("renovación: su factura, con el pedido inicial y «Renovación de»", renewalInvoice?.orderId === member.id && invoiceLines(renewalInvoice.lines)[0]?.description.startsWith("Renovación de"), renewalInvoice);

  // ── 6. Factura mensual de cuotas y comisiones (del mes en curso, como si fuera el día 1 del siguiente) ──
  const month = monthPeriod(new Date());
  const firstOfNext = new Date(month.to.getTime() + 3600_000);
  const before = new Set((await prisma.invoice.findMany({ where: { kind: "FEES", period: month.period }, select: { id: true } })).map((i) => i.id));
  const issued = await issueMonthlyPlatformInvoices(firstOfNext);
  const fresh = await prisma.invoice.findMany({ where: { kind: "FEES", period: month.period, id: { notIn: [...before] } } });
  created.feeInvoices = fresh.map((i) => i.id);
  const anaFees = fresh.find((i) => i.creatorId === ana.id) ?? (await prisma.invoice.findUnique({ where: { dedupeKey: `fees:${ana.id}:${month.period}` } }));
  const salesFee = await prisma.transaction.aggregate({
    where: { creatorId: ana.id, taxSeller: "CREATOR", type: { in: ["CHARGE", "RENEWAL", "REFUND"] }, createdAt: { gte: month.from, lt: month.to } },
    _sum: { platformFeeCents: true },
  });
  const commissionLine = anaFees ? invoiceLines(anaFees.lines).find((l) => l.description.startsWith("Comisión del servicio")) : undefined;
  check("factura mensual: emitida para Ana, serie S", issued >= 1 && anaFees?.seriesCode === "S" && anaFees.kind === "FEES", { issued, anaFees });
  check("…con la comisión de sus sesiones y no la de las ventas de Cirella", commissionLine?.totalCents === salesFee._sum.platformFeeCents, { commissionLine, salesFee });
  check("…al 21 % (creadora en España)", anaFees?.taxRateBps === 2100 && anaFees.baseCents + anaFees.taxCents === anaFees.totalCents);
  check("…y una segunda ejecución no emite nada", (await issueMonthlyPlatformInvoices(firstOfNext)) === 0);
}

async function cleanup() {
  const orderIds = created.orders;
  const buyers = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = buyers.map((u) => u.id);
  const subs = (await prisma.subscription.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((s) => s.id);
  const customerIds = (await prisma.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((c) => c.id);
  const byPayload = [
    ...orderIds.map((id) => ({ payload: { path: ["orderId"], equals: id } })),
    ...subs.map((id) => ({ payload: { path: ["subscriptionId"], equals: id } })),
    ...customerIds.map((id) => ({ payload: { path: ["customerId"], equals: id } })),
  ];
  const invoiceWhere = { OR: [{ recipientEmail: { startsWith: TAG } }, { id: { in: created.feeInvoices } }] };
  await prisma.$transaction([
    prisma.outboxEvent.deleteMany({ where: { OR: byPayload.length ? byPayload : [{ id: "" }] } }),
    prisma.emailMessage.deleteMany({
      where: { OR: [{ to: { startsWith: TAG } }, ...orderIds.map((id) => ({ dedupeKey: { contains: id } })), ...created.feeInvoices.map((id) => ({ dedupeKey: `invoice-mail:${id}` }))] },
    }),
    prisma.invoice.updateMany({ where: invoiceWhere, data: { relatedInvoiceId: null } }),
    prisma.invoice.deleteMany({ where: invoiceWhere }),
    prisma.access.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.booking.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.transaction.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { subscriptionId: { in: subs } }] } }),
    prisma.refund.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.subscription.deleteMany({ where: { id: { in: subs } } }),
    prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: userIds.map((id) => `user:${id}`) } } }),
    prisma.orderLink.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
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
      console.error("Limpieza:", e);
      failures++;
    });
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nIVA y facturas correctos ✓");
    console.log(`(inicio ${STARTED.toISOString()})`);
    process.exit(failures ? 1 : 0);
  });
