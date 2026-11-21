/**
 * Límites de intentos contra Postgres (lib/rate-limit.ts, lib/limits.ts, lib/recovery-guard.ts).
 *   npm run test:limits     (con la BD sembrada: npm run db:reset)
 *
 *   · el contador es atómico: 20 intentos a la vez con límite 5 dejan pasar exactamente 5;
 *   · la ventana vence, resetKey pone a cero y la limpieza solo borra lo vencido;
 *   · login, enlace mágico y registro cortan en su umbral, y acertar la contraseña desbloquea;
 *   · checkout: captcha a partir del 2.º rechazo (con TURNSTILE_* definidos por el script de
 *     package.json; sin token no se llama a Cloudflare) y bloqueo al 5.º, sin afectar a otras;
 *   · visitas: sin duplicados y como mucho 300 por hora desde una conexión a una creadora;
 *   · email de compra abandonada: sin visita, sin checkout, muchos emails o ya avisada, y
 *     emitAbandoned guarda el motivo y no encola nada para los omitidos.
 * Usa emails, IP y visitantes únicos de esta ejecución y deja la BD como estaba.
 */
import "./load-env";
import { emitAbandoned } from "../lib/abandoned";
import { hashIp } from "../lib/client-ip";
import { prisma } from "../lib/db";
import {
  RULES,
  checkoutGate,
  clearLoginLimit,
  limitLogin,
  limitMagicLink,
  limitSignup,
  noteCheckoutFailure,
  shouldRecordTrack,
} from "../lib/limits";
import { createPendingOrder } from "../lib/orders";
import { hit, peek, purgeExpiredRateLimits, resetKey, rlKey } from "../lib/rate-limit";
import { checkRecovery } from "../lib/recovery-guard";
import { turnstileEnabled } from "../lib/turnstile";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `limites-${Date.now()}`;
const email = (label: string) => `${TAG}-${label}@example.com`;
/** Una «conexión» de prueba: IP inventada de esta ejecución (nunca localhost, que no cuenta fuera de producción). */
const conn = (label: string) => {
  const ip = `${TAG}-${label}`;
  return { ip, ipHash: hashIp(ip) };
};
const MIN = 60_000;
const created = { orders: [] as string[] };

async function main() {
  if (!turnstileEnabled()) {
    console.error("Lanza la prueba con npm run test:limits (define las claves de Turnstile de prueba).");
    process.exit(1);
  }
  const before = new Set((await prisma.rateLimit.findMany({ select: { key: true } })).map((r) => r.key));
  try {
    await counter();
    await authLimits();
    await checkoutLimits();
    await trackLimits();
    await recovery();
  } finally {
    await cleanup(before);
  }
  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nLímites de intentos correctos ✓");
  process.exit(failures ? 1 : 0);
}

/** El contador: atomicidad, ventana, puesta a cero y limpieza. */
async function counter() {
  const key = `${TAG}:atomico`;
  const rule = { limit: 5, windowSec: 60 };
  const now = new Date();
  const results = await Promise.all(Array.from({ length: 20 }, () => hit(key, rule, now)));
  const counts = results.map((r) => r.count).sort((a, b) => a - b);
  check("20 intentos a la vez con límite 5 → exactamente 5 pasan", results.filter((r) => r.ok).length === 5, results.filter((r) => r.ok).length);
  check("…y cada uno recibe un número distinto (1..20)", counts.join(",") === Array.from({ length: 20 }, (_, i) => i + 1).join(","), counts);
  check("…con el tiempo de espera hasta el final de la ventana", results.every((r) => r.retryAfterSec === 60), results.map((r) => r.retryAfterSec));
  check("peek no suma un intento", (await peek(key, now)).count === 20 && (await peek(key, now)).count === 20);

  const later = await hit(key, rule, new Date(now.getTime() + 60_000));
  check("al vencer la ventana vuelve a empezar en 1", later.ok && later.count === 1, later);
  await resetKey(key);
  check("resetKey deja el contador a cero", (await peek(key)).count === 0);

  const stale = `${TAG}:vencida`;
  const fresh = `${TAG}:vigente`;
  await prisma.rateLimit.createMany({
    data: [
      { key: stale, count: 3, resetAt: new Date(Date.now() - 2 * 3600_000) },
      { key: fresh, count: 3, resetAt: new Date(Date.now() + 3600_000) },
    ],
  });
  const purged = await purgeExpiredRateLimits();
  const left = await prisma.rateLimit.findMany({ where: { key: { in: [stale, fresh] } }, select: { key: true } });
  check("purgeExpiredRateLimits borra solo las filas vencidas", purged >= 1 && left.length === 1 && left[0].key === fresh, { purged, left });
}

/** Login, enlace mágico y registro. */
async function authLimits() {
  const a = conn("auth");
  const login = email("login");
  const attempts = [];
  for (let i = 0; i < RULES.loginEmail.limit + 1; i++) attempts.push(await limitLogin(login, a.ipHash));
  check("login: 5 intentos con el mismo email pasan", attempts.slice(0, 5).every((v) => v.ok));
  const sixth = attempts[5];
  check("…el 6.º se corta con «Demasiados intentos con este email»", !sixth.ok && sixth.message.startsWith("Demasiados intentos con este email") && sixth.retryAfterSec > 0, sixth);
  check("…y el mensaje dice cuánto esperar y que hay enlace mágico", !sixth.ok && /Espera 15 minutos o entra con un enlace mágico/.test(sixth.message), sixth);
  await clearLoginLimit(login.toUpperCase());
  check("acertar la contraseña (clearLoginLimit) desbloquea el email, sin distinguir mayúsculas", (await limitLogin(login, a.ipHash)).ok);

  const magic = email("enlace");
  const links = [];
  for (let i = 0; i < RULES.magicEmail.limit + 1; i++) links.push(await limitMagicLink(magic, a.ipHash));
  check("enlace mágico: 3 pasan", links.slice(0, 3).every((v) => v.ok));
  check("…el 4.º se corta con «Ya te hemos enviado varios enlaces»", !links[3].ok && links[3].message.startsWith("Ya te hemos enviado varios enlaces"), links[3]);
  check("…otro email sigue pudiendo pedirlo", (await limitMagicLink(email("enlace-otro"), a.ipHash)).ok);

  const b = conn("enlaces-ip");
  const byIp = [];
  for (let i = 0; i < RULES.magicIp.limit + 1; i++) byIp.push(await limitMagicLink(email(`enlace-ip-${i}`), b.ipHash));
  check("…pero 11 emails distintos desde una conexión: el 11.º se corta", byIp.slice(0, 10).every((v) => v.ok) && !byIp[10].ok && byIp[10].message.includes("desde esta conexión"), byIp[10]);

  const s = conn("registro");
  const signups = [];
  for (let i = 0; i < RULES.signupIp.limit + 1; i++) signups.push(await limitSignup(s.ipHash));
  check("registro: 10 por hora desde una conexión y el 11.º se corta", signups.slice(0, 10).every((v) => v.ok) && !signups[10].ok, signups[10]);
  check("…otra conexión sí puede registrarse", (await limitSignup(conn("registro-otra").ipHash)).ok);
}

/** Checkout: captcha tras 2 rechazos, bloqueo tras 5; las demás compradoras no se enteran. */
async function checkoutLimits() {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  let captchaAnswer = true;
  globalThis.fetch = (async (url: unknown) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ success: captchaAnswer }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const c = conn("pago");
    const buyer = email("pago");
    const gate = (turnstileToken?: string) => checkoutGate({ email: buyer, ip: c.ip, ipHash: c.ipHash, turnstileToken });

    check("sin rechazos: el pago pasa sin captcha", (await gate()).ok && calls.length === 0);
    const first = await noteCheckoutFailure({ email: buyer, ipHash: c.ipHash });
    check("un rechazo no pide captcha", !first.needsCaptcha && !first.captchaSiteKey, first);
    check("…ni lo exige el siguiente intento", (await gate()).ok && calls.length === 0);
    const second = await noteCheckoutFailure({ email: buyer, ipHash: c.ipHash });
    check("tras 2 rechazos: needsCaptcha y la clave pública", second.needsCaptcha && second.captchaSiteKey === process.env.TURNSTILE_SITE_KEY, second);

    const noToken = await gate();
    check(
      "…sin token el pago no pasa y no se llama a Cloudflare",
      !noToken.ok && noToken.needsCaptcha === true && !!noToken.captchaSiteKey && noToken.message.includes("espera a que termine la comprobación") && calls.length === 0,
      { noToken, calls },
    );
    captchaAnswer = false;
    const badToken = await gate("token-malo");
    check("…con un token que Cloudflare rechaza, tampoco", !badToken.ok && badToken.needsCaptcha === true && badToken.message.includes("No hemos podido comprobar"), badToken);
    captchaAnswer = true;
    check("…con un token válido, sí (se comprueba con Cloudflare)", (await gate("token-bueno")).ok && calls.length === 2, calls);

    globalThis.fetch = (async () => {
      throw new Error("Cloudflare caído");
    }) as typeof fetch;
    const warn = console.warn;
    console.warn = () => {};
    try {
      check("si Cloudflare no responde, el pago pasa (siguen los límites duros)", (await gate("token-cualquiera")).ok);
    } finally {
      console.warn = warn;
    }

    for (let i = 0; i < 3; i++) await noteCheckoutFailure({ email: buyer, ipHash: c.ipHash });
    const blocked = await gate("token-bueno");
    check("tras 5 rechazos: bloqueado aunque haya token", !blocked.ok && blocked.message.startsWith("Demasiados pagos rechazados") && !blocked.needsCaptcha, blocked);
    const sameIp = await checkoutGate({ email: email("pago-otra"), ip: c.ip, ipHash: c.ipHash, turnstileToken: null });
    check("…también otro email desde la misma conexión", !sameIp.ok && sameIp.message.startsWith("Demasiados pagos rechazados"), sameIp);
    const sameEmail = await checkoutGate({ email: buyer, ...conn("pago-otra-ip"), turnstileToken: null });
    check("…y el mismo email desde otra conexión", !sameEmail.ok && sameEmail.message.startsWith("Demasiados pagos rechazados"), sameEmail);
    check("otro email desde otra conexión no se entera", (await checkoutGate({ email: email("pago-ajena"), ...conn("pago-ajena"), turnstileToken: null })).ok);

    const attempts = conn("pago-intentos");
    const tries = [];
    for (let i = 0; i < RULES.checkoutEmail.limit + 1; i++) tries.push(await checkoutGate({ email: email("pago-intentos"), ...attempts, turnstileToken: null }));
    check(
      "sin rechazos: 5 intentos de pago con el mismo email y el 6.º se corta",
      tries.slice(0, 5).every((v) => v.ok) && !tries[5].ok && tries[5].message.startsWith("Demasiados intentos de pago con este email"),
      tries[5],
    );

    const failedBySignal = await noteCheckoutFailure({ email: email("aviso"), ipHash: null });
    check("un rechazo que llega por el aviso de la pasarela sin IP cuenta por email", !failedBySignal.needsCaptcha && (await peekFailures(email("aviso"))) === 1);
  } finally {
    globalThis.fetch = realFetch;
  }
}

async function peekFailures(buyer: string) {
  return (await peek(rlKey("checkout-fail-email", buyer))).count;
}

/** Visitas: sin duplicados en 30 minutos y como mucho 300 por hora desde una conexión a una creadora. */
async function trackLimits() {
  const v = { ...conn("visitas"), ua: "Mozilla/5.0 (iPhone) prueba" };
  const creatorA = `${TAG}-creadora-a`;
  const creatorB = `${TAG}-creadora-b`;
  const view = (creatorId: string, productId: string | null) => shouldRecordTrack({ creatorId, type: "PRODUCT_VIEW", productId, ipHash: v.ipHash, ua: v.ua });
  const first = await view(creatorA, "p1");
  const again = await view(creatorA, "p1");
  check("el mismo evento de la misma persona: cuenta una vez", first && !again, { first, again });
  check("…otro producto sí cuenta", await view(creatorA, "p2"));
  check("…otra creadora sí cuenta", await view(creatorB, "p1"));
  check("…otro navegador desde la misma conexión sí cuenta", await shouldRecordTrack({ creatorId: creatorA, type: "PRODUCT_VIEW", productId: "p1", ipHash: v.ipHash, ua: "Otro navegador" }));

  const flood = conn("rafaga");
  const results: boolean[] = [];
  for (let i = 0; i < RULES.trackIpCreator.limit + 1; i++)
    results.push(await shouldRecordTrack({ creatorId: creatorA, type: "PRODUCT_VIEW", productId: `p-${i}`, ipHash: flood.ipHash, ua: v.ua }));
  check("301 eventos distintos desde una conexión a una creadora: el 301.º no cuenta", results.slice(0, 300).every(Boolean) && !results[300], results.lastIndexOf(true));
  check("…pero esa conexión sigue contando en otra creadora", await shouldRecordTrack({ creatorId: creatorB, type: "PRODUCT_VIEW", productId: "p-0", ipHash: flood.ipHash, ua: v.ua }));
}

/** Email de compra abandonada: solo para checkouts reales. */
async function recovery() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const digital = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, type: "DIGITAL", status: "PUBLISHED", deliveryMode: "AUTOMATIC" } });
  const order = async (label: string, opts: { visitorId?: string | null; ipHash?: string | null; buyer?: string } = {}) => {
    const o = await createPendingOrder({
      productId: digital.id,
      buyerEmail: opts.buyer ?? email(label),
      buyerName: "Prueba",
      visitorId: opts.visitorId === undefined ? `${TAG}-${label}` : opts.visitorId,
      ipHash: opts.ipHash ?? null,
    });
    created.orders.push(o.id);
    return o;
  };
  const startedCheckout = (visitorId: string, at = new Date()) =>
    prisma.analyticsEvent.create({ data: { creatorId: ana.id, type: "CHECKOUT_STARTED", productId: digital.id, visitorId, createdAt: new Date(at.getTime() - 5 * MIN) } });

  check("pedido sin visitante → sin-visita", reason(await checkRecovery(await order("sin-visita", { visitorId: null }))) === "sin-visita");
  check("visitante que no abrió el checkout → sin-checkout", reason(await checkRecovery(await order("sin-checkout"))) === "sin-checkout");
  const otherProduct = await order("otro-producto");
  await prisma.analyticsEvent.create({ data: { creatorId: ana.id, type: "CHECKOUT_STARTED", productId: `${TAG}-otro`, visitorId: otherProduct.visitorId!, createdAt: new Date(Date.now() - 5 * MIN) } });
  check("…el checkout de otro producto no vale", reason(await checkRecovery(otherProduct)) === "sin-checkout");

  const real = await order("real");
  await startedCheckout(real.visitorId!);
  check("abrió el checkout de ese producto → se envía", (await checkRecovery(real)).send);
  const repeat = await order("real-otra-vez", { buyer: real.buyerEmail });
  await startedCheckout(repeat.visitorId!);
  check("segundo pedido abandonado al mismo destinatario en 24 h → ya-avisada", reason(await checkRecovery(repeat)) === "ya-avisada");

  const visitor = `${TAG}-muchos`;
  await startedCheckout(visitor);
  await order("muchos-1", { visitorId: visitor });
  check("dos emails distintos desde la misma visitante → se envía", (await checkRecovery(await order("muchos-2", { visitorId: visitor }))).send);
  check("el tercer email distinto desde la misma visitante → muchos-emails", reason(await checkRecovery(await order("muchos-3", { visitorId: visitor }))) === "muchos-emails");

  const ip = conn("recuperacion").ipHash;
  const fromIp = [];
  for (const n of [1, 2, 3, 4, 5, 6]) fromIp.push(await order(`ip-${n}`, { ipHash: ip }));
  await startedCheckout(fromIp[5].visitorId!);
  check("seis emails distintos desde la misma conexión → muchos-emails", reason(await checkRecovery(fromIp[5])) === "muchos-emails");

  // emitAbandoned: el motivo queda en el pedido y no se encola nada para los omitidos.
  const old = new Date(Date.now() - 3 * 3600_000);
  const skipped = await order("cron-omitido");
  const sent = await order("cron-enviado");
  await prisma.order.updateMany({ where: { id: { in: [skipped.id, sent.id] } }, data: { createdAt: old } });
  await startedCheckout(sent.visitorId!, old);
  await emitAbandoned(0);
  const [s, e] = await Promise.all([skipped.id, sent.id].map((id) => prisma.order.findUniqueOrThrow({ where: { id } })));
  const eventFor = (id: string) => prisma.outboxEvent.count({ where: { type: "checkout.abandoned", payload: { path: ["orderId"], equals: id } } });
  check("emitAbandoned marca el pedido omitido como abandonado con su motivo", s.status === "ABANDONED" && s.recoverySkipped === "sin-checkout", s);
  check(
    "…sin aviso ni email de recuperación",
    (await eventFor(skipped.id)) === 0 && (await prisma.emailMessage.count({ where: { template: "ABANDONED_CHECKOUT", to: skipped.buyerEmail } })) === 0,
  );
  check("el checkout real sí genera el aviso de compra abandonada", e.status === "ABANDONED" && e.recoverySkipped === null && (await eventFor(sent.id)) === 1, e);
}

const reason = (d: { send: true } | { send: false; reason: string }) => (d.send ? "send" : d.reason);

async function cleanup(keysBefore: Set<string>) {
  const ids = created.orders;
  await prisma.$transaction([
    prisma.outboxEvent.deleteMany({ where: { OR: ids.map((id) => ({ payload: { path: ["orderId"], equals: id } })) } }),
    prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, ...ids.map((id) => ({ dedupeKey: { contains: id } }))] } }),
    prisma.analyticsEvent.deleteMany({ where: { visitorId: { startsWith: TAG } } }),
    prisma.order.deleteMany({ where: { id: { in: ids } } }),
  ]);
  // Las claves son HMAC: se borran las que no existían antes de la prueba.
  const now = await prisma.rateLimit.findMany({ select: { key: true } });
  await prisma.rateLimit.deleteMany({ where: { key: { in: now.map((r) => r.key).filter((k) => !keysBefore.has(k)) } } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
