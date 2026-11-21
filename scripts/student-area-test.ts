/**
 * Pruebas del área de alumnas contra Postgres.
 *   npm run test:student-area        (con la BD sembrada: npm run db:reset; en los dos modos)
 *
 *   · «Crear mi cuenta»: el enlace no crea nada; al confirmarlo se crea la cuenta (o se abre la que
 *     había), su ficha de clienta de la dueña con customer.created una sola vez y las novedades si
 *     las pidió; no renombra cuentas ajenas; recupera una cuenta creada sin probar el email;
 *   · lo conseguido con el mismo email antes de registrarse aparece en su área;
 *   · cambio de email: atómico, cambia la cuenta y sus fichas, cierra las sesiones; email ocupado,
 *     cambio viejo y dos confirmaciones a la vez;
 *   · el pie «Tu área» de los emails (web personal) y el destino natural de las alumnas.
 * Crea sus propios datos y los borra.
 */
import "./load-env";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { hashToken } from "../lib/auth-tokens";
import { getCustomerLibrary } from "../lib/customer";
import { prisma } from "../lib/db";
import { enqueueEmail } from "../lib/email/outbox";
import { layout } from "../lib/email/templates";
import { claimFreeAccess } from "../lib/free-access";
import { homeFor } from "../lib/home";
import { consumeEmailChange, consumeMagicLink, peekMagicLink, sendMagicLink } from "../lib/magic-links";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const PERSONAL = process.env.SITE_MODE === "personal";
const TAG = `alumnas-${PERSONAL ? "p" : "x"}-${Date.now()}`;
const email = (label: string) => `${TAG}-${label}@example.com`;
const HOUR = 3_600_000;

async function token(to: string, purpose: "REGISTER" | "CHANGE_EMAIL" | "LOGIN", data: object | null, redirectTo = "/cuenta?bienvenida=1") {
  const t = randomBytes(24).toString("base64url");
  await prisma.loginToken.create({
    data: { email: to, tokenHash: hashToken(t), purpose, redirectTo, data: data ?? Prisma.JsonNull, expiresAt: new Date(Date.now() + HOUR) },
  });
  return t;
}

async function session(userId: string, verified = true) {
  return prisma.session.create({ data: { id: hashToken(randomBytes(16).toString("hex")), userId, verified, expiresAt: new Date(Date.now() + HOUR) } });
}

const createdEvents = (customerId: string) =>
  prisma.outboxEvent.count({ where: { type: "customer.created", payload: { path: ["customerId"], equals: customerId } } });

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const reg = (name: string, newsletter = false) => ({ name, newsletter, creatorId: ana.id });

  // ── «Crear mi cuenta»: el enlace no crea nada ──
  {
    const to = email("nueva");
    await sendMagicLink(to, "/cuenta?bienvenida=1", { creatorId: ana.id, purpose: "REGISTER", name: "Lucía", data: reg("Lucía", true) });
    const lt = await prisma.loginToken.findFirst({ where: { email: to }, orderBy: { createdAt: "desc" } });
    const mail = await prisma.emailMessage.findFirst({ where: { to, template: "REGISTER" } });
    check("el alta solo crea el enlace (sin cuenta)", !(await prisma.user.findUnique({ where: { email: to } })) && lt?.purpose === "REGISTER");
    check("…que dura 24 h y guarda nombre y casilla", !!lt && Math.abs(lt.expiresAt.getTime() - Date.now() - 24 * HOUR) < 60_000 && (lt.data as { name?: string }).name === "Lucía");
    check("…y el email «Confirma tu email para entrar» con «Confirmar y entrar»", mail?.subject === "Confirma tu email para entrar" && mail.html.includes(">Confirmar y entrar</a>"));

    const t = await token(to, "REGISTER", reg("Lucía", true));
    check("peekMagicLink dice que es un alta", (await peekMagicLink(t))?.purpose === "REGISTER");
    const r = await consumeMagicLink(t);
    const user = await prisma.user.findUnique({ where: { email: to } });
    const customer = user ? await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: ana.id, userId: user.id } } }) : null;
    check("al confirmar: cuenta con nombre y email confirmado, y a /cuenta?bienvenida=1", !!user?.emailVerifiedAt && user.name === "Lucía" && r?.redirectTo === "/cuenta?bienvenida=1");
    check("…su ficha de clienta de la dueña con las novedades confirmadas", !!customer && customer.marketingOptIn && !!customer.marketingOptInAt && customer.ordersCount === 0);
    check("…y un customer.created (email de bienvenida)", !!customer && (await createdEvents(customer.id)) === 1);
    check("el enlace no vale dos veces", (await consumeMagicLink(t)) === null);

    const t2 = await token(to, "REGISTER", reg("Otra", false));
    await consumeMagicLink(t2);
    const again = await prisma.user.findUniqueOrThrow({ where: { email: to } });
    check("registrarse otra vez: ni cambia el nombre, ni duplica la ficha, ni otra bienvenida, ni quita las novedades",
      again.name === "Lucía" && (await prisma.customer.count({ where: { userId: again.id } })) === 1 && (await createdEvents(customer!.id)) === 1 &&
      (await prisma.customer.findUniqueOrThrow({ where: { id: customer!.id } })).marketingOptIn);
  }

  // ── Sin la casilla, sin novedades; datos estropeados no rompen el enlace ──
  {
    const to = email("sin-novedades");
    await consumeMagicLink(await token(to, "REGISTER", reg("Marta")));
    const u = await prisma.user.findUniqueOrThrow({ where: { email: to } });
    check("sin la casilla: ficha sin novedades", (await prisma.customer.findFirstOrThrow({ where: { userId: u.id } })).marketingOptIn === false);
    const broken = email("roto");
    const r = await consumeMagicLink(await token(broken, "REGISTER", { name: 42 }));
    check("datos estropeados: entra igual (sin ficha)", !!r && (await prisma.customer.count({ where: { user: { email: broken } } })) === 0);
  }

  // ── Recupera una cuenta creada sin probar el email ──
  {
    const to = email("checkout");
    const u = await prisma.user.create({ data: { email: to, passwordHash: await bcrypt.hash("de-otra-persona", 4) } });
    await session(u.id, false);
    await consumeMagicLink(await token(to, "REGISTER", reg("Dueña del email")));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    check("cuenta de un checkout sin confirmar: fuera la contraseña y las sesiones, email confirmado",
      !after.passwordHash && !!after.emailVerifiedAt && (await prisma.session.count({ where: { userId: u.id } })) === 0 && after.name === "Dueña del email");
  }

  // ── Lo conseguido antes con el mismo email aparece en su área ──
  {
    const to = email("antes");
    const free = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, accessMode: "FREE_EMAIL", status: "PUBLISHED", type: "COURSE" } });
    await claimFreeAccess({ productId: free.id, name: "Antes", email: to, newsletter: false });
    const order = await prisma.order.findFirstOrThrow({ where: { buyerEmail: to }, include: { customer: true } });
    await consumeMagicLink(await token(to, "REGISTER", reg("Antes")));
    const u = await prisma.user.findUniqueOrThrow({ where: { email: to } });
    const lib = await getCustomerLibrary(u.id);
    check("el curso gratis pedido antes de registrarse está en su área", order.customer?.userId === u.id && lib.courses.some((c) => c.product.id === free.id));
    check("…con una sola ficha de clienta y sin otra bienvenida", (await prisma.customer.count({ where: { userId: u.id } })) === 1 && (await createdEvents(order.customerId!)) <= 1);
  }

  // ── Cambio de email ──
  {
    const from = email("cambio-de");
    const to = email("cambio-a");
    const u = await prisma.user.create({ data: { email: from, emailVerifiedAt: new Date(), name: "Cambio" } });
    await prisma.customer.create({ data: { creatorId: ana.id, userId: u.id, email: from, name: "Cambio" } });
    await session(u.id);
    const t = await token(to, "CHANGE_EMAIL", { userId: u.id, fromEmail: from }, "/cuenta/perfil?ok=email");
    check("peekMagicLink dice que es un cambio de email", (await peekMagicLink(t))?.purpose === "CHANGE_EMAIL");
    check("consumeMagicLink no gasta un cambio de email (no abre sesión)", (await consumeMagicLink(t)) === null && !!(await peekMagicLink(t)));
    const both = await Promise.all([consumeEmailChange(t), consumeEmailChange(t)]);
    const winner = both.find((x) => x && x !== "taken");
    check("dos confirmaciones a la vez: una vale", both.filter((x) => x && x !== "taken").length === 1 && both.includes(null), both.map((x) => (typeof x === "object" && x ? "ok" : x)));
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    check("…la cuenta y su ficha usan el email nuevo y se cierran las sesiones",
      after.email === to && !!winner && typeof winner === "object" && winner.fromEmail === from &&
      (await prisma.customer.findFirstOrThrow({ where: { userId: u.id } })).email === to && (await prisma.session.count({ where: { userId: u.id } })) === 0);

    const other = await prisma.user.create({ data: { email: email("ocupado"), emailVerifiedAt: new Date() } });
    const tTaken = await token(other.email, "CHANGE_EMAIL", { userId: u.id, fromEmail: to });
    check("a un email que ya es de otra cuenta → «ocupado» y nada cambia", (await consumeEmailChange(tTaken)) === "taken" && (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).email === to);
    const tStale = await token(email("viejo"), "CHANGE_EMAIL", { userId: u.id, fromEmail: from });
    check("un cambio pedido con el email de antes ya no vale", (await consumeEmailChange(tStale)) === null && (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).email === to);
    const login = await token(email("login"), "LOGIN", null);
    check("un enlace de entrar no sirve para cambiar el email", (await consumeEmailChange(login)) === null);
  }

  // ── Pie «Tu área» y destino natural ──
  {
    const student = await prisma.user.create({ data: { email: email("pie") } });
    const html = layout({ title: "Hola", body: "<p>x</p>" });
    const toStudent = await enqueueEmail({ to: student.email, template: "PRUEBA", subject: "x", html, sendNow: false });
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ana.userId } });
    const toOwner = await enqueueEmail({ to: owner.email, template: "PRUEBA", subject: "x", html, sendNow: false, dedupeKey: `${TAG}-pie-dueña` });
    if (PERSONAL) {
      check("web personal: los emails a las alumnas terminan con «Tu área: …/cuenta»", /Tu área: <a href="[^"]+\/cuenta"/.test(toStudent.html));
      check("…y los de la dueña no", !toOwner.html.includes("Tu área") && !toOwner.html.includes("{{tu-area}}"));
    } else check("plataforma: sin «Tu área» en los emails", !toStudent.html.includes("Tu área") && !toStudent.html.includes("{{tu-area}}"));
    await prisma.emailMessage.deleteMany({ where: { id: { in: [toStudent.id, toOwner.id] } } });
    check(PERSONAL ? "web personal: una alumna sin nada va a /cuenta (nunca al onboarding)" : "plataforma: sin nada, al onboarding como siempre",
      (await homeFor(student.id)) === (PERSONAL ? "/cuenta" : "/onboarding"));
  }
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    const orders = await prisma.order.findMany({ where: { buyerEmail: { startsWith: TAG } }, select: { id: true } });
    const ids = orders.map((o) => o.id);
    const customers = await prisma.customer.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    await prisma.emailMessage.deleteMany({ where: { to: { startsWith: TAG } } });
    await prisma.outboxEvent.deleteMany({
      where: { OR: [...ids.map((id) => ({ payload: { path: ["orderId"], equals: id } })), ...customers.map((c) => ({ payload: { path: ["customerId"], equals: c.id } }))] },
    });
    await prisma.loginToken.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.analyticsEvent.deleteMany({ where: { visitorId: { in: userIds.map((u) => `user:${u}`) } } });
    await prisma.access.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.lessonProgress.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.orderLink.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.customer.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} pruebas fallidas` : "\nTodas las pruebas del área de alumnas pasan ✓");
    process.exit(failures ? 1 : 0);
  });
