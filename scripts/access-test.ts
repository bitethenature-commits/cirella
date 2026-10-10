/**
 * Pruebas del acceso a la cuenta contra Postgres.
 *   npm run test:access        (con la BD sembrada: npm run db:reset)
 *
 *   · el enlace mágico solo se gasta una vez, aunque lleguen dos peticiones a la vez, y leerlo
 *     (pantalla «Entrar») no lo gasta;
 *   · recuperación: la primera prueba de que el email es suyo borra la contraseña creada sin esa
 *     prueba y todas las sesiones; «Sí, he sido yo» confirma y conserva la contraseña; «No he sido
 *     yo» siempre la borra; con el email ya confirmado solo caen las sesiones sin verificar;
 *   · la marca de la creadora y el propósito del email («Confirma tu email»);
 *   · los emails de una compra llevan enlaces personales al destino correcto, sin duplicarlos al
 *     reprocesar el evento; caducados, dicen de qué creadora son;
 *   · la limpieza programada de sesiones, enlaces mágicos y enlaces personales.
 * Crea sus propios datos y los borra.
 */
import "./load-env";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { hashToken, purgeExpiredAuth } from "../lib/auth-tokens";
import { handleAutomation } from "../lib/automations";
import { prisma } from "../lib/db";
import { consumeMagicLink, peekMagicLink, sendMagicLink } from "../lib/magic-links";
import { createOrderLink, resolveOrderLink } from "../lib/order-links";
import { createPendingOrder } from "../lib/orders";
import { applyPaymentUpdate } from "../lib/payments/events";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `acceso-${Date.now()}`;
const email = (label: string) => `${TAG}-${label}@example.com`;
const created = { orders: [] as string[] };
const HOUR = 3_600_000;

/** Enlace mágico con un token conocido (sendMagicLink no devuelve el token: va por email). */
async function token(to: string, purpose: "LOGIN" | "VERIFY_SIGNUP" = "LOGIN", opts: { redirectTo?: string; expiresAt?: Date } = {}) {
  const t = randomBytes(24).toString("base64url");
  await prisma.loginToken.create({
    data: { email: to, tokenHash: hashToken(t), purpose, redirectTo: opts.redirectTo ?? "/auth/continuar", expiresAt: opts.expiresAt ?? new Date(Date.now() + HOUR) },
  });
  return t;
}

async function session(userId: string, opts: { verified: boolean; orderId?: string; expiresAt?: Date }) {
  return prisma.session.create({
    data: { id: hashToken(randomBytes(16).toString("hex")), userId, verified: opts.verified, orderId: opts.orderId ?? null, expiresAt: opts.expiresAt ?? new Date(Date.now() + HOUR) },
  });
}

/** Cuenta registrada con contraseña y sin confirmar el email (p. ej. por otra persona). */
async function unverifiedUser(label: string) {
  const user = await prisma.user.create({ data: { email: email(label), passwordHash: await bcrypt.hash("secreto123", 4) } });
  await session(user.id, { verified: false });
  return user;
}

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });

  // ── Un solo uso, atómico; leer no gasta ──
  {
    const to = email("atomico");
    const t = await token(to);
    check("peekMagicLink lee el enlace sin gastarlo", (await peekMagicLink(t))?.email === to && (await peekMagicLink(t)) !== null);
    const results = await Promise.all([consumeMagicLink(t), consumeMagicLink(t), consumeMagicLink(t)]);
    check("tres consumos a la vez → solo uno vale", results.filter(Boolean).length === 1, results.map(Boolean));
    check("…y después ya no se puede leer ni gastar", (await peekMagicLink(t)) === null && (await consumeMagicLink(t)) === null);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: to } });
    check("un email nuevo crea la cuenta ya confirmada", !!user.emailVerifiedAt);
    const old = await token(to, "LOGIN", { expiresAt: new Date(Date.now() - 1000) });
    check("un enlace caducado no vale", (await peekMagicLink(old)) === null && (await consumeMagicLink(old)) === null);
  }

  // ── Recuperación con un enlace de entrar ──
  {
    const user = await unverifiedUser("secuestro");
    const t = await token(user.email, "LOGIN", { redirectTo: "/onboarding" });
    const r = await consumeMagicLink(t);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    check("la primera prueba del email borra la contraseña previa", after.passwordHash === null && !!after.emailVerifiedAt);
    check("…y todas las sesiones anteriores", (await prisma.session.count({ where: { userId: user.id } })) === 0);
    check("…y pide crear una contraseña nueva", r?.redirectTo === `/contrasena?motivo=seguridad&next=${encodeURIComponent("/onboarding")}`, r?.redirectTo);
  }

  // ── «Sí, he sido yo» ──
  {
    const user = await unverifiedUser("si");
    const t = await token(user.email, "VERIFY_SIGNUP");
    const r = await consumeMagicLink(t, "yes");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    check("«Sí, he sido yo» confirma el email y conserva la contraseña", !!after.emailVerifiedAt && after.passwordHash === user.passwordHash);
    check("…y sus sesiones de cuenta pasan a verificadas", (await prisma.session.count({ where: { userId: user.id, verified: false } })) === 0);
    check("…sin desvío a «Crea tu contraseña»", r?.redirectTo === "/auth/continuar", r?.redirectTo);
  }

  // ── «No he sido yo» ──
  {
    const user = await unverifiedUser("no");
    const t = await token(user.email, "VERIFY_SIGNUP");
    const r = await consumeMagicLink(t, "no");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    check("«No he sido yo» borra la contraseña y las sesiones de quien la creó", after.passwordHash === null && (await prisma.session.count({ where: { userId: user.id } })) === 0);
    check("…y la dueña entra a crear la suya", !!r?.redirectTo.startsWith("/contrasena?motivo=seguridad"), r?.redirectTo);
  }

  // ── Email ya confirmado ──
  {
    const user = await prisma.user.create({ data: { email: email("confirmada"), passwordHash: await bcrypt.hash("secreto123", 4), emailVerifiedAt: new Date() } });
    const kept = await session(user.id, { verified: true });
    await session(user.id, { verified: false });
    const r = await consumeMagicLink(await token(user.email));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    check("con el email ya confirmado se conserva la contraseña", after.passwordHash === user.passwordHash && r?.redirectTo === "/auth/continuar");
    const left = await prisma.session.findMany({ where: { userId: user.id } });
    check("…y solo caen las sesiones sin verificar", left.length === 1 && left[0].id === kept.id);
  }

  // ── Marca y propósito ──
  {
    const to = email("marca");
    await sendMagicLink(to, "//evil.example", { creatorId: ana.id });
    await sendMagicLink(to, "/panel", { purpose: "VERIFY_SIGNUP" });
    const [login, verify] = await prisma.loginToken.findMany({ where: { email: to }, orderBy: { createdAt: "asc" } });
    const mails = await prisma.emailMessage.findMany({ where: { to }, orderBy: { createdAt: "asc" } });
    check("el enlace pedido desde la página de Ana lleva su marca", login.creatorId === ana.id && mails[0]?.template === "MAGIC_LINK" && mails[0].html.includes(ana.displayName));
    check("…y nunca un destino externo", login.redirectTo === "/auth/continuar", login.redirectTo);
    const hours = (verify.expiresAt.getTime() - verify.createdAt.getTime()) / HOUR;
    check("«Confirma tu email» dura 72 h y usa su plantilla", verify.purpose === "VERIFY_SIGNUP" && Math.round(hours) === 72 && mails[1]?.template === "VERIFY_EMAIL", { hours, t: mails[1]?.template });
    const minutes = (login.expiresAt.getTime() - login.createdAt.getTime()) / 60_000;
    check("el enlace de entrar dura 60 min", Math.round(minutes) === 60, minutes);
  }

  // ── Enlaces personales de los emails de una compra ──
  {
    const course = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "COURSE", status: "PUBLISHED" } });
    const o = await createPendingOrder({ productId: course.id, buyerEmail: email("curso"), buyerName: "Prueba curso" });
    created.orders.push(o.id);
    await applyPaymentUpdate(
      { kind: "payment", status: { state: "succeeded", ref: `sim_ch_${TAG}`, amountCents: o.amountCents, currency: o.currency, destinationAccount: null, metadata: { orderId: o.id } } },
      "simulated",
    );
    const links = await prisma.orderLink.findMany({ where: { orderId: o.id } });
    check("el recibo y el acceso al curso llevan un enlace personal cada uno", links.length === 2, links.length);
    check("…que abren el curso", links.every((l) => l.path === `/cuenta/cursos/${course.id}`));
    const days = (links[0].expiresAt.getTime() - links[0].createdAt.getTime()) / 86_400_000;
    check("…durante 14 días", Math.round(days) === 14, days);
    const receipt = await prisma.emailMessage.findFirstOrThrow({ where: { dedupeKey: `receipt:${o.id}` } });
    check("el recibo enlaza a /auth/enlace con la nota «personal»", receipt.html.includes("/auth/enlace?t=") && receipt.html.includes("Este enlace es personal"));
    await handleAutomation({ type: "order.paid", orderId: o.id });
    check("reprocesar el evento no crea enlaces que nadie recibe", (await prisma.orderLink.count({ where: { orderId: o.id } })) === 2);

    const t = new URL(receipt.html.match(/href="([^"]*\/auth\/enlace\?t=[^"]+)"/)![1].replace(/&amp;/g, "&")).searchParams.get("t")!;
    const ok = await resolveOrderLink(t);
    check("el enlace del recibo resuelve al pedido", ok?.status === "ok" && ok.order.id === o.id);
    await prisma.orderLink.updateMany({ where: { orderId: o.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await resolveOrderLink(t);
    check("caducado, dice de qué creadora es y adónde iba", expired?.status === "expired" && expired.username === "ana" && expired.path === `/cuenta/cursos/${course.id}`);
    await prisma.order.update({ where: { id: o.id }, data: { status: "REFUNDED" } });
    const fresh = await createOrderLink({ orderId: o.id, path: `/cuenta/pedidos/${o.id}` });
    check("un pedido reembolsado no abre nada", (await resolveOrderLink(new URL(fresh.url).searchParams.get("t")!)) === null);
  }

  // ── Limpieza programada ──
  {
    const user = await prisma.user.create({ data: { email: email("limpieza") } });
    const order = created.orders[0];
    const live = await session(user.id, { verified: true });
    await session(user.id, { verified: true, expiresAt: new Date(Date.now() - 1000) });
    const recent = await token(user.email, "LOGIN", { expiresAt: new Date(Date.now() - HOUR) });
    await token(user.email, "LOGIN", { expiresAt: new Date(Date.now() - 2 * 86_400_000) });
    const day = 86_400_000;
    const keep = await prisma.orderLink.create({ data: { tokenHash: hashToken(`${TAG}-keep`), orderId: order, path: "/cuenta", expiresAt: new Date(Date.now() - 2 * day) } });
    await prisma.orderLink.create({ data: { tokenHash: hashToken(`${TAG}-old`), orderId: order, path: "/cuenta", expiresAt: new Date(Date.now() - 31 * day) } });
    await purgeExpiredAuth();
    check("borra las sesiones caducadas y conserva las vigentes", (await prisma.session.findMany({ where: { userId: user.id } })).map((s) => s.id).join() === live.id);
    check(
      "borra los enlaces mágicos caducados hace más de un día",
      (await prisma.loginToken.findMany({ where: { email: user.email } })).map((l) => l.tokenHash).join() === hashToken(recent),
    );
    const linkIds = (await prisma.orderLink.findMany({ where: { tokenHash: { in: [hashToken(`${TAG}-keep`), hashToken(`${TAG}-old`)] } } })).map((l) => l.id);
    check("guarda un mes los enlaces personales caducados (para avisar con la marca)", linkIds.join() === keep.id);
  }
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const orderIds = created.orders;
  const customerIds = (await prisma.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((c) => c.id);
  const byPayload = [
    ...orderIds.map((id) => ({ payload: { path: ["orderId"], equals: id } })),
    ...customerIds.map((id) => ({ payload: { path: ["customerId"], equals: id } })),
  ];
  await prisma.$transaction([
    prisma.paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.outboxEvent.deleteMany({ where: { OR: byPayload.length ? byPayload : [{ id: "" }] } }),
    prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...orderIds.map((id) => ({ dedupeKey: { contains: id } }))] } }),
    prisma.access.deleteMany({ where: { userId: { in: userIds } } }),
    // Facturas de las compras de prueba (primero se sueltan las F3/rectificativas de su original).
    prisma.invoice.updateMany({ where: { recipientEmail: { startsWith: TAG } }, data: { relatedInvoiceId: null } }),
    prisma.invoice.deleteMany({ where: { recipientEmail: { startsWith: TAG } } }),
    prisma.transaction.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: userIds.map((id) => `user:${id}`) } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.customer.deleteMany({ where: { id: { in: customerIds } } }),
    prisma.loginToken.deleteMany({ where: { email: { startsWith: TAG } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nEl acceso a la cuenta y los enlaces personales son seguros ✓");
    process.exit(failures ? 1 : 0);
  });
