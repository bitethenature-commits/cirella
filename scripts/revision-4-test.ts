/**
 * Revisión 4 · baja de los emails de compra abandonada (LSSI art. 21.2).
 *   npx tsx --conditions=react-server scripts/revision-4-test.ts      (BD sembrada)
 *
 *   · el enlace de baja va firmado: uno manipulado, caducado o de otro uso no sirve;
 *   · el email de recuperación lleva el enlace en el pie aunque la creadora personalice el mensaje;
 *   · darse de baja es idempotente y vale solo para esa creadora;
 *   · el cron ya no recupera a quien se dio de baja (motivo «opuesta») y el envío tampoco sale.
 * Crea pedidos de prueba sobre Cirella (seed) y borra todo lo que crea.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { emitAbandoned } from "../lib/abandoned";
import { handleAutomation } from "../lib/automations";
import { abandonedCheckoutEmail } from "../lib/email/templates";
import { appSecret } from "../lib/env";
import { createPendingOrder } from "../lib/orders";
import { hasOptedOut, optOutEmailHash, optOutToken, optOutTarget, optOutUrl, readOptOutToken, recordOptOut } from "../lib/recovery-optout";
import { signToken } from "../lib/storage/signing";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `rev4-${Date.now()}`;
const email = (label: string) => `${TAG}-${label}@example.com`;
const created = { orders: [] as string[], creators: [] as string[] };

async function main() {
  // ── Enlace firmado ──
  const tok = optOutToken("pedido123");
  check("el enlace de baja lleva el pedido", readOptOutToken(tok) === "pedido123");
  check("un enlace manipulado no sirve", readOptOutToken(tok.slice(0, -2) + (tok.endsWith("AA") ? "BB" : "AA")) === null);
  check("un token firmado para otro uso no sirve", readOptOutToken(signToken({ p: "otro", o: "pedido123" }, appSecret(), 3600)) === null);
  check("un enlace caducado no sirve", readOptOutToken(optOutToken("pedido123", Date.now() - 400 * 86400_000)) === null);
  check("sin token, nada", readOptOutToken(null) === null && readOptOutToken("") === null);
  check("el hash no distingue mayúsculas ni espacios", optOutEmailHash(" Cirella@Example.com ") === optOutEmailHash("ana@example.com"));

  // ── Plantilla ──
  const url = optOutUrl("pedido123");
  const mail = abandonedCheckoutEmail({ creatorName: "Cirella", productTitle: "Guía", url: "https://x/checkout", message: "Mensaje propio", optOutUrl: url });
  check("el email de recuperación lleva el enlace de baja", mail.html.includes(url.replace(/&/g, "&amp;")) && mail.html.includes("Darme de baja"), mail.html);
  check("…también con el mensaje personalizado de la creadora", mail.html.includes("Mensaje propio"));

  // ── BD ──
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const other = await prisma.creator.findFirstOrThrow({ where: { id: { not: ana.id } } });
  const digital = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", deliveryMode: "AUTOMATIC" } });
  const newOrder = async (label: string) => {
    const o = await createPendingOrder({ productId: digital.id, buyerEmail: email(label), buyerName: `Prueba ${label}` });
    created.orders.push(o.id);
    return o;
  };

  const out = await newOrder("baja");
  const target = await optOutTarget(optOutToken(out.id));
  check("el enlace lleva a la creadora y al email del pedido", target?.creatorId === ana.id && target?.email === email("baja"), target);
  check("antes de darse de baja no consta", !(await hasOptedOut(ana.id, email("baja"))));
  await recordOptOut(ana.id, email("baja"));
  await recordOptOut(ana.id, email("baja").toUpperCase());
  const rows = await prisma.recoveryOptOut.count({ where: { creatorId: ana.id, emailHash: optOutEmailHash(email("baja")) } });
  check("darse de baja dos veces deja una sola fila", rows === 1, rows);
  check("la baja vale para esa creadora", await hasOptedOut(ana.id, email("baja")));
  check("…y no para otra", !(await hasOptedOut(other.id, email("baja"))));

  // El envío ya encolado no sale (se dio de baja entre el cron y el envío).
  await handleAutomation({ type: "checkout.abandoned", orderId: out.id });
  const blocked = await prisma.emailMessage.count({ where: { to: email("baja"), template: "ABANDONED_CHECKOUT" } });
  check("a quien se dio de baja no le sale el email de recuperación", blocked === 0, blocked);

  // Otro pedido sin baja: el email sale, con el enlace de baja.
  const keep = await newOrder("sigue");
  await handleAutomation({ type: "checkout.abandoned", orderId: keep.id });
  const sent = await prisma.emailMessage.findFirst({ where: { to: email("sigue"), template: "ABANDONED_CHECKOUT" } });
  const automation = await prisma.automation.findUnique({ where: { creatorId_trigger: { creatorId: ana.id, trigger: "ABANDONED_CHECKOUT" } } });
  if (automation && !automation.enabled) console.log("· (Cirella tiene la recuperación desactivada: no se comprueba el email que sí sale)");
  else check("sin baja, el email sale y lleva el enlace de baja", !!sent && sent.html.includes("/baja/recordatorios?t="), sent?.html?.slice(-600));

  // El cron: el pedido de quien se dio de baja queda abandonado con motivo «opuesta» y sin aviso.
  await prisma.order.update({ where: { id: out.id }, data: { createdAt: new Date(Date.now() - 3 * 3600_000) } });
  await emitAbandoned(0);
  const after = await prisma.order.findUniqueOrThrow({ where: { id: out.id } });
  check("el cron marca el pedido abandonado con motivo «opuesta»", after.status === "ABANDONED" && after.recoverySkipped === "opuesta", {
    status: after.status,
    skipped: after.recoverySkipped,
  });
  const events = await prisma.outboxEvent.count({ where: { type: "checkout.abandoned", payload: { path: ["orderId"], equals: out.id } } });
  check("…sin aviso de compra abandonada", events === 0, events);
}

async function cleanup() {
  const orderIds = created.orders;
  const buyers = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = buyers.map((u) => u.id);
  await prisma.$transaction([
    prisma.outboxEvent.deleteMany({ where: { OR: orderIds.length ? orderIds.map((id) => ({ payload: { path: ["orderId"], equals: id } })) : [{ id: "" }] } }),
    prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...orderIds.map((id) => ({ dedupeKey: { contains: id } }))] } }),
    prisma.recoveryOptOut.deleteMany({ where: { emailHash: { in: ["baja", "sigue"].map((l) => optOutEmailHash(email(l))) } } }),
    prisma.orderLink.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { email: { startsWith: TAG } } }),
    prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
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
      console.error("No se pudo limpiar todo:", e);
      failures++;
    });
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nRevisión 4: baja de los recordatorios de compra abandonada correcta ✓");
    process.exit(failures ? 1 : 0);
  });
