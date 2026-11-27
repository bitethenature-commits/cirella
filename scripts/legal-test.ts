/**
 * Cumplimiento legal contra Postgres.
 *   npm run test:legal        (con la BD sembrada: npm run db:reset)
 *
 *   · sin la identidad legal de quien vende no se crea ningún pedido;
 *   · sin las condiciones aceptadas no se cobra;
 *   · la compra guarda la versión exacta de las condiciones (LegalSnapshot, direccionada por
 *     contenido), la renuncia marcada y el consentimiento de novedades, que pasa a la clienta y no
 *     se pierde con una compra posterior sin la casilla;
 *   · el recibo repite quién vende, la renuncia con su fecha, el enlace a la versión aceptada y
 *     las condiciones;
 *   · la sal diaria de las visitas sin cookies: una por día y se borran las de antes de ayer.
 * Usa la pasarela simulada y el email «log», y deja la BD como estaba.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { acceptedConsentFields, parseCheckoutConsents } from "../lib/checkout-consents";
import { ensureLegalSnapshot, getLegalSnapshot } from "../lib/legal-snapshot";
import { CheckoutError, createPendingOrder, startOrderPayment } from "../lib/orders";
import { paymentProvider } from "../lib/payments";
import { getDailySalt } from "../lib/visitor";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `legal-${Date.now()}`;
const email = (label: string) => `${TAG}-${label}@example.com`;
const created = { orders: [] as string[], snapshots: [] as string[] };

const errorOf = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof CheckoutError ? e.message : String(e)));

/** Lo que hace la acción del checkout: consentimientos con la versión vigente y pago. */
async function buy(productId: string, label: string, form: Record<string, string>) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const consents = parseCheckoutConsents(form, product.type, product.deliveryMode);
  if (!consents.ok) throw new Error(consents.error);
  const order = await createPendingOrder({ productId, buyerEmail: email(label), buyerName: `Prueba ${label}` });
  created.orders.push(order.id);
  const snapshot = await ensureLegalSnapshot(product.creatorId);
  const now = new Date();
  await prisma.order.update({
    where: { id: order.id },
    data: {
      legalSnapshotId: snapshot.id,
      termsAcceptedAt: now,
      waiverKind: consents.consents.waiverKind,
      waiverText: consents.consents.waiverText,
      waiverVersion: consents.consents.waiverVersion,
      waiverAcceptedAt: consents.consents.waiverKind ? now : null,
      marketingOptIn: consents.consents.marketingOptIn,
    },
  });
  const result = await startOrderPayment(order.id, { method: "card", cardNumber: "4242 4242 4242 4242" });
  return { order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }), result, snapshot };
}

async function main() {
  check("pasarela simulada", paymentProvider().key === "simulated");
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const digital = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", deliveryMode: "AUTOMATIC" } });
  const before = new Set((await prisma.legalSnapshot.findMany({ where: { creatorId: ana.id }, select: { id: true } })).map((r) => r.id));

  // ── 1. Sin identidad legal no se vende ──
  await prisma.creator.update({ where: { id: ana.id }, data: { legalTaxId: null } });
  try {
    const msg = await errorOf(createPendingOrder({ productId: digital.id, buyerEmail: email("sin-datos"), buyerName: "Prueba" }));
    check("sin NIF de la vendedora: no se crea el pedido", msg.includes("todavía no ha activado los pagos"), msg);
  } finally {
    await prisma.creator.update({ where: { id: ana.id }, data: { legalTaxId: ana.legalTaxId } });
  }

  // ── 2. Sin condiciones aceptadas no se cobra ──
  const bare = await createPendingOrder({ productId: digital.id, buyerEmail: email("sin-condiciones"), buyerName: "Prueba" });
  created.orders.push(bare.id);
  const msg = await errorOf(startOrderPayment(bare.id, { method: "card", cardNumber: "4242 4242 4242 4242" }));
  check("pedido sin condiciones aceptadas: no se cobra", msg === "Acepta las condiciones de venta para continuar", msg);
  check("…y sigue pendiente", (await prisma.order.findUniqueOrThrow({ where: { id: bare.id } })).status === "PENDING");

  // ── 3. Compra con novedades: versión aceptada, renuncia y consentimiento ──
  const first = await buy(digital.id, "novedades", { acceptTerms: "on", waiver: "on", newsletter: "on" });
  if (!before.has(first.snapshot.id)) created.snapshots.push(first.snapshot.id);
  check("compra pagada", first.result.kind === "paid" && first.order.status === "PAID", first.result);
  check("guarda la versión aceptada y la renuncia literal", first.order.legalSnapshotId === first.snapshot.id && first.order.waiverKind === "DIGITAL_IMMEDIATE" && !!first.order.waiverText?.startsWith("Quiero acceder ya"));
  const snap = await getLegalSnapshot(ana.id, first.snapshot.id);
  check("la versión guarda la identidad de la vendedora", snap?.identity.legalName === ana.legalName && snap?.identity.legalTaxId === ana.legalTaxId);
  let customer = await prisma.customer.findFirstOrThrow({ where: { creatorId: ana.id, email: email("novedades") } });
  check("la clienta acepta novedades, con fecha", customer.marketingOptIn && !!customer.marketingOptInAt);
  const optInAt = customer.marketingOptInAt;

  const receipt = await prisma.emailMessage.findFirst({ where: { to: email("novedades"), template: "PURCHASE_RECEIPT" } });
  const html = receipt?.html ?? "";
  for (const [label, text] of [
    // Vende Cirella, como dice el checkout.
    ["quién vende", "Cirella · NIF 12345678Z"],
    ["el domicilio", "28004 Madrid"],
    ["la renuncia marcada", "marcaste «Quiero acceder ya al contenido"],
    ["la versión del texto de la renuncia", `(texto ${first.order.waiverVersion})`],
    ["la versión aceptada", `/ana/legal?v=${first.snapshot.id}`],
    ["las condiciones", "CONDICIONES DE VENTA"],
  ] as const)
    check(`recibo: ${label}`, html.includes(text), text);

  // ── 4. Otra compra sin la casilla no retira el consentimiento ──
  const second = await createPendingOrder({ productId: digital.id, buyerEmail: email("novedades"), buyerName: "Prueba novedades" });
  created.orders.push(second.id);
  await prisma.order.update({ where: { id: second.id }, data: { legalSnapshotId: first.snapshot.id, ...acceptedConsentFields(digital, new Date()) } });
  await startOrderPayment(second.id, { method: "card", cardNumber: "4242 4242 4242 4242" });
  customer = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
  check("una compra sin la casilla no retira las novedades", customer.marketingOptIn && customer.marketingOptInAt?.getTime() === optInAt?.getTime());

  // ── 5. Versiones direccionadas por contenido ──
  await prisma.creator.update({ where: { id: ana.id }, data: { legalTerms: `## Prueba\n${TAG}` } });
  try {
    const edited = await ensureLegalSnapshot(ana.id);
    created.snapshots.push(edited.id);
    check("al cambiar las condiciones hay una versión nueva", edited.id !== first.snapshot.id && edited.content.terms.includes(TAG));
    check("la versión que aceptó la primera compra no cambia", !(await getLegalSnapshot(ana.id, first.snapshot.id))?.terms.includes(TAG));
  } finally {
    await prisma.creator.update({ where: { id: ana.id }, data: { legalTerms: ana.legalTerms } });
  }
  check("al volver a la plantilla se reutiliza la versión anterior", (await ensureLegalSnapshot(ana.id)).id === first.snapshot.id);

  // ── 6. Sal diaria (en días de 2099, y se dejan las sales reales como estaban) ──
  const realSalts = await prisma.analyticsSalt.findMany();
  try {
    await prisma.analyticsSalt.createMany({ data: [{ day: "2099-01-07", salt: "vieja" }, { day: "2099-01-09", salt: "ayer" }] });
    const day = new Date("2099-01-10T12:00:00Z");
    const salt = await getDailySalt(day);
    check("una sal por día (64 hex) y la misma en la siguiente visita", /^[0-9a-f]{64}$/.test(salt) && salt === (await getDailySalt(day)));
    const days = (await prisma.analyticsSalt.findMany({ where: { day: { startsWith: "2099" } }, select: { day: true } })).map((r) => r.day).sort();
    check("se borran las de antes de ayer y se conserva la de ayer (visitas de medianoche)", JSON.stringify(days) === JSON.stringify(["2099-01-09", "2099-01-10"]), days);
  } finally {
    await prisma.analyticsSalt.deleteMany({ where: { day: { startsWith: "2099" } } });
    await prisma.analyticsSalt.createMany({ data: realSalts, skipDuplicates: true });
  }
}

async function cleanup() {
  const buyers = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = buyers.map((u) => u.id);
  const orderIds = created.orders;
  const customerIds = (await prisma.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((c) => c.id);
  const byPayload = [...orderIds.map((id) => ({ payload: { path: ["orderId"], equals: id } })), ...customerIds.map((id) => ({ payload: { path: ["customerId"], equals: id } }))];
  await prisma.$transaction([
    prisma.outboxEvent.deleteMany({ where: { OR: byPayload.length ? byPayload : [{ id: "" }] } }),
    prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...orderIds.map((id) => ({ dedupeKey: { contains: id } }))] } }),
    prisma.orderLink.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: userIds.map((id) => `user:${id}`) } } }),
    prisma.access.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.transaction.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.legalSnapshot.deleteMany({ where: { id: { in: created.snapshots }, orders: { none: {} } } }),
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
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nQuién vende, condiciones y consentimientos quedan registrados ✓");
    process.exit(failures ? 1 : 0);
  });
