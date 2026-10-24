/**
 * Pruebas de la verificación en dos pasos contra Postgres.
 *   npm run test:two-factor        (con la BD sembrada: npm run db:reset)
 *
 *   · configurar: el primer código activa, crea 10 códigos, marca la sesión actual y cierra las demás
 *     (las limitadas a un pedido siguen);
 *   · el mismo código de la app y el mismo código de recuperación solo valen una vez, también a la vez;
 *   · el paso de login: 5 fallos lo queman, caduca, se gasta una sola vez y es de su usuaria;
 *   · límites de intentos (15 min y día) y volver a confirmar (código + contraseña);
 *   · dispositivos recordados, reinicio desde el servidor, limpieza y avisos por email;
 *   · la regla de getSession: sin el segundo factor la sesión de cuenta no cuenta.
 * Crea sus propios datos y los borra.
 */
import "./load-env";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { hashToken, purgeExpiredAuth } from "../lib/auth-tokens";
import { sessionUsable } from "../lib/auth-utils";
import { prisma } from "../lib/db";
import { clearTwoFactorLimit, limitTwoFactor, RULES } from "../lib/limits";
import { rlKey } from "../lib/rate-limit";
import { base32Decode, hotp, totpStep } from "../lib/totp";
import {
  beginSetup,
  CHALLENGE_MAX_ATTEMPTS,
  confirmSetup,
  consumeRecoveryCode,
  createChallenge,
  disableTwoFactor,
  forgetDevices,
  isTrustedDevice,
  noteChallengeFailure,
  openSecret,
  pendingSetup,
  readChallenge,
  reauthenticate,
  regenerateRecoveryCodes,
  remainingRecoveryCodes,
  spendChallenge,
  trustDevice,
  verifySecondFactor,
} from "../lib/two-factor";
import { notifyNewLogin, resetTwoFactorFromServer } from "../lib/two-factor-notify";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `dos-pasos-${Date.now()}`;
const email = (label: string) => `${TAG}-${label}@example.com`;
const HOUR = 3_600_000;
const userIds: string[] = [];

async function user(label: string, o: { password?: string; isAdmin?: boolean } = {}) {
  const u = await prisma.user.create({
    data: { email: email(label), emailVerifiedAt: new Date(), isAdmin: !!o.isAdmin, passwordHash: o.password ? await bcrypt.hash(o.password, 4) : null },
  });
  userIds.push(u.id);
  return u;
}

async function session(userId: string, o: { mfa?: boolean; orderId?: string } = {}) {
  return prisma.session.create({
    data: { id: hashToken(randomBytes(16).toString("hex")), userId, verified: true, mfa: !!o.mfa, orderId: o.orderId ?? null, expiresAt: new Date(Date.now() + HOUR) },
  });
}

async function secretOf(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return base32Decode(openSecret(u.totpSecret!));
}

/** Activa la verificación de una usuaria y devuelve su secreto y sus códigos. */
async function enable(userId: string, currentSessionId: string | null = null) {
  await beginSetup(userId);
  const secret = await secretOf(userId);
  const r = await confirmSetup(userId, hotp(secret, totpStep()), currentSessionId);
  if (!r.ok) throw new Error(r.error);
  return { secret, codes: r.codes };
}

async function resetLimits(userId: string) {
  await prisma.rateLimit.deleteMany({ where: { key: { in: [rlKey("2fa-user", userId), rlKey("2fa-user-day", userId)] } } });
}

async function main() {
  // ── Configurar ──
  {
    const u = await user("config");
    const current = await session(u.id);
    const other = await session(u.id);
    const order = await prisma.order.findFirst({ select: { id: true } });
    const scoped = order ? await session(u.id, { orderId: order.id }) : null;
    await prisma.trustedDevice.create({ data: { userId: u.id, tokenHash: hashToken(randomBytes(8).toString("hex")), label: "x", expiresAt: new Date(Date.now() + HOUR) } });

    const view = await beginSetup(u.id);
    check("beginSetup: clave, QR y dirección otpauth", !!view && view.uri.startsWith("otpauth://totp/") && view.qrSvg.startsWith("<svg") && view.secretB32.length === 32);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    check("…el secreto se guarda cifrado y sin activar", !!stored.totpSecret?.startsWith("v1:") && !stored.totpSecret.includes(view!.secretB32) && !stored.totpEnabledAt);
    check("pendingSetup vuelve a enseñar la misma clave", (await pendingSetup(u.id))?.secretB32 === view!.secretB32);

    const wrong = await confirmSetup(u.id, "000000", current.id);
    check("confirmSetup con un código incorrecto no activa", !wrong.ok && !(await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).totpEnabledAt);
    const secret = base32Decode(view!.secretB32);
    const r = await confirmSetup(u.id, hotp(secret, totpStep()), current.id);
    check("confirmSetup con el código bueno activa y da 10 códigos", r.ok && r.codes.length === 10, r);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    check("…totpEnabledAt y el paso usado guardados", !!after.totpEnabledAt && after.totpLastStep === totpStep());
    check("…10 códigos guardados como HMAC", (await prisma.twoFactorRecoveryCode.count({ where: { userId: u.id } })) === 10 && r.ok && !(await prisma.twoFactorRecoveryCode.findFirst({ where: { codeHash: r.codes[0] } })));
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    check("…la sesión actual queda con mfa y las demás de cuenta se cierran", sessions.some((s) => s.id === current.id && s.mfa) && !sessions.some((s) => s.id === other.id));
    if (scoped) check("…la limitada a un pedido sigue", sessions.some((s) => s.id === scoped.id));
    check("…y se olvidan los dispositivos", (await prisma.trustedDevice.count({ where: { userId: u.id } })) === 0);
    check("beginSetup con la verificación activada no hace nada", (await beginSetup(u.id)) === null);
    check("confirmSetup otra vez no reactiva", !(await confirmSetup(u.id, hotp(secret, totpStep() + 1), current.id)).ok);

    // ── Regla de getSession ──
    const full = { orderId: null, mfa: false, user: { totpEnabledAt: after.totpEnabledAt } };
    check("getSession: sesión de cuenta sin mfa de quien tiene 2FA → no cuenta", !sessionUsable(full));
    check("getSession: con mfa sí", sessionUsable({ ...full, mfa: true }));
    check("getSession: la limitada a un pedido sí (sin mfa)", sessionUsable({ ...full, orderId: "pedido" }));
    check("getSession: sin 2FA, cualquier sesión como siempre", sessionUsable({ orderId: null, mfa: false, user: { totpEnabledAt: null } }));
  }

  // ── El mismo código solo vale una vez ──
  {
    const u = await user("repeticion");
    const { secret, codes } = await enable(u.id);
    const replay = await verifySecondFactor(u.id, hotp(secret, totpStep()));
    check("el código con el que se activó no vale para entrar (ya usado)", replay === null);
    const next = hotp(secret, totpStep() + 1);
    const both = await Promise.all([verifySecondFactor(u.id, next), verifySecondFactor(u.id, next), verifySecondFactor(u.id, next)]);
    check("tres envíos a la vez del mismo código → solo uno vale", both.filter((x) => x === "totp").length === 1, both);
    check("un código antiguo (paso anterior) ya no vale", (await verifySecondFactor(u.id, hotp(secret, totpStep() - 1))) === null);

    const rc = codes[0].toUpperCase().replace("-", " ");
    const rr = await Promise.all([consumeRecoveryCode(u.id, rc), consumeRecoveryCode(u.id, codes[0]), verifySecondFactor(u.id, codes[0])]);
    check("un código de recuperación a la vez → solo uno vale (mayúsculas y espacios dan igual)", rr.filter((x) => x === true || x === "recovery").length === 1, rr);
    check("…y después no vale otra vez", (await verifySecondFactor(u.id, codes[0])) === null);
    check("quedan 9", (await remainingRecoveryCodes(u.id)) === 9);
    check("verifySecondFactor acepta un código de recuperación", (await verifySecondFactor(u.id, codes[1])) === "recovery");
    const other = await user("otra-cuenta");
    await enable(other.id);
    check("el código de recuperación de otra cuenta no vale", (await verifySecondFactor(other.id, codes[2])) === null);

    const fresh = await regenerateRecoveryCodes(u.id);
    check("códigos nuevos: 10, y los anteriores dejan de valer", fresh.length === 10 && (await remainingRecoveryCodes(u.id)) === 10 && (await verifySecondFactor(u.id, codes[3])) === null);
  }

  // ── El paso de login ──
  {
    const u = await user("paso");
    await enable(u.id);
    const t = await createChallenge(u.id, { verified: true, redirectTo: "//evil.com", method: "PASSWORD" });
    const ch = await readChallenge(t);
    check("el paso se lee con su token (y no guarda destinos externos)", ch?.userId === u.id && ch.verified && ch.redirectTo === null);
    check("con otro token no", (await readChallenge(randomBytes(32).toString("base64url"))) === null);
    for (let i = 0; i < CHALLENGE_MAX_ATTEMPTS; i++) await noteChallengeFailure(ch!.id);
    check(`${CHALLENGE_MAX_ATTEMPTS} fallos lo queman`, (await readChallenge(t)) === null);

    const t2 = await createChallenge(u.id, { verified: false, redirectTo: "/panel", method: "MAGIC_LINK" });
    const ch2 = (await readChallenge(t2))!;
    const spent = await Promise.all([spendChallenge(ch2.id), spendChallenge(ch2.id)]);
    check("se gasta una sola vez aunque lleguen dos a la vez", spent.filter(Boolean).length === 1);
    check("…y gastado ya no se lee", (await readChallenge(t2)) === null);

    const t3 = await createChallenge(u.id, { verified: true, redirectTo: null, method: "PASSWORD" });
    await prisma.twoFactorChallenge.update({ where: { id: hashToken(t3) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    check("caducado (10 min) no vale", (await readChallenge(t3)) === null);
    const t4 = await createChallenge(u.id, { verified: true, redirectTo: null, method: "PASSWORD" });
    await disableTwoFactor(u.id, { by: "user" });
    check("al desactivar la verificación, los pasos pendientes desaparecen", (await readChallenge(t4)) === null);
  }

  // ── Límites ──
  {
    const u = await user("limites");
    const ip = `ip-${TAG}`;
    const ip2 = `ip2-${TAG}`;
    let okCount = 0;
    for (let i = 0; i < RULES.twoFactorUser.limit; i++) if ((await limitTwoFactor(u.id, i % 2 ? ip : ip2)).ok) okCount++;
    const sixth = await limitTwoFactor(u.id, `${ip}-otra`);
    check(`${RULES.twoFactorUser.limit} intentos en 15 min y el siguiente, aunque sea desde otra conexión, no`, okCount === RULES.twoFactorUser.limit && !sixth.ok && /Demasiados intentos/.test(sixth.ok ? "" : sixth.message));
    await clearTwoFactorLimit(u.id);
    check("al acertar se reinicia la ventana corta", (await limitTwoFactor(u.id, ip)).ok);
    // Hasta el tope del día, reiniciando la ventana corta como si acertara entre medias.
    let refused = false;
    for (let i = 0; i < RULES.twoFactorUserDay.limit + 2 && !refused; i++) {
      await clearTwoFactorLimit(u.id);
      refused = !(await limitTwoFactor(u.id, `${ip}-${i}`)).ok;
    }
    const day = await prisma.rateLimit.findUnique({ where: { key: rlKey("2fa-user-day", u.id) } });
    check("el tope del día (20) no se reinicia al acertar", refused && (day?.count ?? 0) > RULES.twoFactorUserDay.limit);
    await resetLimits(u.id);
  }

  // ── Volver a confirmar ──
  {
    const u = await user("reauth", { password: "secreto123" });
    const { secret, codes } = await enable(u.id);
    const code = () => hotp(secret, totpStep() + 1);
    check("contraseña equivocada → no (y el código de recuperación no se gasta)", !(await reauthenticate(u, { code: codes[0], password: "otra" })) && (await remainingRecoveryCodes(u.id)) === 10);
    check("código bueno sin la contraseña (que tiene) → no", !(await reauthenticate(u, { code: code() })));
    check("código y contraseña buenos → sí", await reauthenticate(u, { code: code(), password: "secreto123" }));
    const nopw = await user("reauth-sin-pw");
    const e2 = await enable(nopw.id);
    check("sin contraseña basta un código de recuperación", await reauthenticate(nopw, { code: e2.codes[0] }));
    check("…y un código equivocado no", !(await reauthenticate(nopw, { code: "123456" })));
  }

  // ── Dispositivos recordados ──
  {
    const u = await user("dispositivo");
    const v = await user("dispositivo-otra");
    const d = await trustDevice(u.id, "iPhone · Safari");
    check("dispositivo recordado: vale para su usuaria", await isTrustedDevice(u.id, d.cookie));
    check("…no para otra", !(await isTrustedDevice(v.id, d.cookie)));
    check("…ni con el token cambiado", !(await isTrustedDevice(u.id, `${d.cookie.split(".")[0]}.${randomBytes(32).toString("base64url")}`)));
    check("…dura 30 días", Math.abs(d.expiresAt.getTime() - Date.now() - 30 * 86_400_000) < 60_000);
    const d2 = await trustDevice(u.id, "Mac · Chrome");
    await prisma.trustedDevice.update({ where: { id: d2.cookie.split(".")[0] }, data: { expiresAt: new Date(Date.now() - 1000) } });
    check("caducado no vale", !(await isTrustedDevice(u.id, d2.cookie)));
    await forgetDevices(u.id, { id: d.cookie.split(".")[0] });
    check("olvidado no vale", !(await isTrustedDevice(u.id, d.cookie)));

    // ── Limpieza ──
    const oldCh = await createChallenge(u.id, { verified: true, redirectTo: null, method: "PASSWORD" });
    await prisma.twoFactorChallenge.update({ where: { id: hashToken(oldCh) }, data: { expiresAt: new Date(Date.now() - 2 * 86_400_000) } });
    await purgeExpiredAuth();
    check("purgeExpiredAuth borra pasos viejos y dispositivos caducados",
      !(await prisma.twoFactorChallenge.findUnique({ where: { id: hashToken(oldCh) } })) && !(await prisma.trustedDevice.findUnique({ where: { id: d2.cookie.split(".")[0] } })));
  }

  // ── Reinicio desde el servidor ──
  {
    const u = await user("reinicio");
    const s = await session(u.id, { mfa: true });
    await enable(u.id, s.id);
    await trustDevice(u.id, "iPhone · Safari");
    await createChallenge(u.id, { verified: true, redirectTo: null, method: "PASSWORD" });
    check("reinicio de una cuenta que no existe → null", (await resetTwoFactorFromServer(email("nadie"))) === null);
    check("reinicio → true", (await resetTwoFactorFromServer(u.email.toUpperCase())) === true);
    const [after, codes, devices, challenges, sessions, mail] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: u.id } }),
      prisma.twoFactorRecoveryCode.count({ where: { userId: u.id } }),
      prisma.trustedDevice.count({ where: { userId: u.id } }),
      prisma.twoFactorChallenge.count({ where: { userId: u.id } }),
      prisma.session.count({ where: { userId: u.id } }),
      prisma.emailMessage.findFirst({ where: { to: u.email, template: "TWO_FACTOR_CHANGED", subject: { contains: "desde el servidor" } } }),
    ]);
    check("…quita secreto, códigos, dispositivos, pasos y TODAS las sesiones", !after.totpSecret && !after.totpEnabledAt && codes + devices + challenges + sessions === 0);
    check("…y le avisa por email", !!mail);
    check("reinicio de una cuenta sin la verificación → false", (await resetTwoFactorFromServer(u.email)) === false);
  }

  // ── Avisos de acceso nuevo ──
  {
    const admin = await user("aviso-admin", { isAdmin: true });
    const student = await user("aviso-alumna");
    const sid = hashToken(randomBytes(8).toString("hex"));
    const personal = process.env.SITE_MODE === "personal";
    await notifyNewLogin(student.id, { device: "iPhone · Safari", sessionId: sid });
    check("a una alumna nunca se le envía el aviso de acceso", (await prisma.emailMessage.count({ where: { to: student.email, template: "LOGIN_ALERT" } })) === 0);
    await notifyNewLogin(admin.id, { device: "iPhone · Safari", sessionId: sid });
    const before = await prisma.emailMessage.count({ where: { to: admin.email, template: "LOGIN_ALERT" } });
    check(personal ? "web personal: aviso a la admin aunque no tenga 2FA" : "plataforma: sin 2FA no hay aviso", before === (personal ? 1 : 0));
    await enable(admin.id);
    await notifyNewLogin(admin.id, { device: "iPhone · Safari", sessionId: sid });
    await notifyNewLogin(admin.id, { device: "iPhone · Safari", sessionId: sid });
    const sent = await prisma.emailMessage.findMany({ where: { to: admin.email, template: "LOGIN_ALERT" } });
    check("con 2FA hay aviso, una vez por sesión", sent.length === 1 && sent[0].html.includes("iPhone · Safari"));
  }
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await prisma.emailMessage.deleteMany({ where: { to: { startsWith: TAG } } });
    for (const id of userIds) await resetLimits(id);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    console.log(failures ? `\n${failures} pruebas fallidas` : "\nTodas las pruebas de la verificación en dos pasos pasan ✓");
    process.exit(failures ? 1 : 0);
  });
