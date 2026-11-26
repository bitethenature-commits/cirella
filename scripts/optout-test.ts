/**
 * Baja de los recordatorios de compra abandonada: cabeceras List-Unsubscribe y baja en un clic.
 *   npx tsx --conditions=react-server scripts/optout-test.ts      (BD sembrada)
 *
 *   · el email de recuperación guarda las cabeceras List-Unsubscribe / List-Unsubscribe-Post y el
 *     proveedor las recibe al enviarlo;
 *   · POST a /unsubscribe/reminders/one-click da de baja (RFC 8058); un GET no cambia nada, solo lleva a la
 *     página con el botón; un enlace manipulado no sirve;
 *   · la baja guarda el hash del email, nunca el email, y repetirla actualiza updatedAt sin duplicar;
 *   · si se da de baja entre el cron y el envío, el pedido queda con el motivo «opuesta».
 * Crea pedidos de prueba sobre Cirella (seed) y borra todo lo que crea.
 */
import "./load-env";
import { GET, POST } from "../app/unsubscribe/reminders/one-click/route";
import { prisma } from "../lib/db";
import { handleAutomation } from "../lib/automations";
import { deliverEmail } from "../lib/email/outbox";
import type { OutgoingEmail } from "../lib/email/provider";
import { logProvider } from "../lib/email/providers/log";
import { createPendingOrder } from "../lib/orders";
import { hasOptedOut, optOutEmailHash, optOutHeaders, optOutToken, recordOptOut } from "../lib/recovery-optout";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `optout-${Date.now()}`;
const email = (label: string) => `${TAG}-${label}@example.com`;
const created = { orders: [] as string[] };

const oneClick = (t: string, method: "GET" | "POST") =>
  new Request(`http://localhost:3000/unsubscribe/reminders/one-click?t=${encodeURIComponent(t)}`, {
    method,
    ...(method === "POST" ? { body: "List-Unsubscribe=One-Click", headers: { "Content-Type": "application/x-www-form-urlencoded" } } : {}),
  });

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const digital = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", deliveryMode: "AUTOMATIC" } });
  const newOrder = async (label: string) => {
    const o = await createPendingOrder({ productId: digital.id, buyerEmail: email(label), buyerName: `Prueba ${label}` });
    created.orders.push(o.id);
    return o;
  };

  // ── Cabeceras ──
  const h = optOutHeaders("pedido123");
  check("List-Unsubscribe apunta a la baja en un clic", /^<https?:\/\/[^>]+\/baja\/recordatorios\/un-clic\?t=[^>]+>$/.test(h["List-Unsubscribe"]), h);
  check("List-Unsubscribe-Post es el de RFC 8058", h["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");

  const automation = await prisma.automation.findUnique({ where: { creatorId_trigger: { creatorId: ana.id, trigger: "ABANDONED_CHECKOUT" } } });
  const keep = await newOrder("cabeceras");
  await handleAutomation({ type: "checkout.abandoned", orderId: keep.id });
  const msg = await prisma.emailMessage.findFirst({ where: { to: email("cabeceras"), template: "ABANDONED_CHECKOUT" } });
  if (automation && !automation.enabled) console.log("· (Cirella tiene la recuperación desactivada: no se comprueban las cabeceras del email)");
  else {
    const stored = msg?.headers as Record<string, string> | null | undefined;
    check("el email de recuperación guarda List-Unsubscribe", !!stored?.["List-Unsubscribe"]?.includes("/unsubscribe/reminders/one-click?t="), stored);
    check("…y List-Unsubscribe-Post", stored?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click", stored);

    // El proveedor recibe las cabeceras al enviar (se reintenta el envío ya hecho en línea).
    const seen: OutgoingEmail[] = [];
    const original = logProvider.send;
    logProvider.send = async (m) => {
      seen.push(m);
      return original(m);
    };
    try {
      await prisma.emailMessage.update({ where: { id: msg!.id }, data: { status: "QUEUED", sendAt: new Date(Date.now() - 1000) } });
      await deliverEmail(msg!.id);
    } finally {
      logProvider.send = original;
    }
    check("el proveedor recibe las cabeceras de baja", seen[0]?.headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click", seen[0]?.headers);
  }

  // ── Baja en un clic ──
  const out = await newOrder("unclic");
  const t = optOutToken(out.id);
  const get = await GET(oneClick(t, "GET"));
  check("GET lleva a la página de confirmar (303)", get.status === 303 && (get.headers.get("location") ?? "").includes(`/unsubscribe/reminders?t=${encodeURIComponent(t)}`), get.headers.get("location"));
  check("…y no da de baja", !(await hasOptedOut(ana.id, email("unclic"))));

  const bad = await POST(oneClick(t.slice(0, -2) + (t.endsWith("AA") ? "BB" : "AA"), "POST"));
  check("POST con un enlace manipulado → 400", bad.status === 400, bad.status);
  check("…y no da de baja", !(await hasOptedOut(ana.id, email("unclic"))));

  const okRes = await POST(oneClick(t, "POST"));
  check("POST con el enlace del email → 200", okRes.status === 200, okRes.status);
  check("…y da de baja", await hasOptedOut(ana.id, email("unclic")));

  const row = await prisma.recoveryOptOut.findUniqueOrThrow({ where: { creatorId_emailHash: { creatorId: ana.id, emailHash: optOutEmailHash(email("unclic")) } } });
  check("se guarda el hash del email, no el email", row.emailHash !== email("unclic") && !JSON.stringify(row).includes(TAG), row);
  await new Promise((r) => setTimeout(r, 20));
  await POST(oneClick(t, "POST"));
  await recordOptOut(ana.id, email("unclic").toUpperCase());
  const rows = await prisma.recoveryOptOut.findMany({ where: { creatorId: ana.id, emailHash: optOutEmailHash(email("unclic")) } });
  check("repetir la baja no duplica la fila", rows.length === 1, rows.length);
  check("…y actualiza updatedAt", rows[0].updatedAt > row.updatedAt && rows[0].createdAt.getTime() === row.createdAt.getTime(), rows[0]);

  // ── Baja entre el cron y el envío: queda el motivo ──
  await handleAutomation({ type: "checkout.abandoned", orderId: out.id });
  const after = await prisma.order.findUniqueOrThrow({ where: { id: out.id } });
  const sent = await prisma.emailMessage.count({ where: { to: email("unclic"), template: "ABANDONED_CHECKOUT" } });
  if (automation && !automation.enabled) console.log("· (Cirella tiene la recuperación desactivada: no se comprueba el motivo «opuesta» del envío)");
  else check("el envío no sale y el pedido queda con motivo «opuesta»", sent === 0 && after.recoverySkipped === "opuesta", { sent, skipped: after.recoverySkipped });
}

async function cleanup() {
  const orderIds = created.orders;
  const buyers = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = buyers.map((u) => u.id);
  await prisma.$transaction([
    prisma.outboxEvent.deleteMany({ where: { OR: orderIds.length ? orderIds.map((id) => ({ payload: { path: ["orderId"], equals: id } })) : [{ id: "" }] } }),
    prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...orderIds.map((id) => ({ dedupeKey: { contains: id } }))] } }),
    prisma.recoveryOptOut.deleteMany({ where: { emailHash: { in: ["cabeceras", "unclic"].map((l) => optOutEmailHash(email(l))) } } }),
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
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nBaja de los recordatorios (cabeceras y un clic) correcta ✓");
    process.exit(failures ? 1 : 0);
  });
