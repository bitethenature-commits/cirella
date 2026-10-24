import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { hashToken } from "./auth-tokens";
import { deviceLabel, HINT_COOKIE, safeNext, sessionSatisfies, sessionUsable } from "./auth-utils";
import { homeFor } from "./home";
import { createChallenge, isTrustedDevice, type LoginMethod } from "./two-factor";
import { notifyNewLogin } from "./two-factor-notify";

export { HINT_COOKIE, safeNext };
export { hashToken, purgeExpiredAuth } from "./auth-tokens";
export { consumeMagicLink, magicLinkCreatorId, peekMagicLink, sendMagicLink, type MagicPurpose } from "./magic-links";

export const SESSION_COOKIE = "cirella_session";
/** Paso «falta el código» del login con verificación en dos pasos (lib/two-factor.ts → createChallenge). */
export const TWO_FACTOR_COOKIE = "cirella_2fa";
/** «Recordar este dispositivo 30 días»: `${id}.${token}` (lib/two-factor.ts → trustDevice). */
export const TRUSTED_DEVICE_COOKIE = "cirella_dispositivo";
/** Permiso de compra del navegador que hizo el pedido: `${orderId}.${token}`. */
export const CHECKOUT_COOKIE = "cirella_compra";
const SESSION_DAYS = 30;
/** La sesión que se abre al pagar dura un día y solo en el navegador que pagó. */
const CHECKOUT_SESSION_HOURS = 24;

export { hashPassword, verifyPassword } from "./auth-password";

const cookieBase = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" });

/**
 * Crea una sesión y la guarda en una cookie httpOnly. Solo en Server Actions / Route Handlers.
 *   · verified: quien la abre ha demostrado que el email es suyo (enlace mágico, o contraseña sobre
 *     un email ya confirmado). Es obligatorio: una sesión sin verificar no abre el área de cliente.
 *   · orderId: sesión limitada a un pedido (tras pagar o desde un enlace personal). Solo abre ese
 *     pedido; getCurrentUser() la ignora, así que no sirve para /cuenta completa, /panel ni /admin.
 *   · mfa: ha pasado el segundo factor. Las sesiones de cuenta de quien tiene la verificación en dos
 *     pasos se abren SOLO con completeLogin / el código (getSession ignora las que no lo llevan).
 * Devuelve el id de la sesión (sha256 del token).
 */
export async function createSession(userId: string, opts: { verified: boolean; orderId?: string | null; ttlHours?: number; mfa?: boolean }) {
  const token = randomBytes(32).toString("base64url");
  const ttlMs = opts.ttlHours ? opts.ttlHours * 3600_000 : SESSION_DAYS * 86400_000;
  const expiresAt = new Date(Date.now() + ttlMs);
  const id = hashToken(token);
  await prisma.session.create({ data: { id, userId, expiresAt, verified: opts.verified, orderId: opts.orderId ?? null, mfa: !!opts.mfa } });
  if (!opts.orderId) await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { ...cookieBase(), expires: expiresAt });
  if (!opts.orderId) jar.set(HINT_COOKIE, "1", { ...cookieBase(), httpOnly: false, expires: expiresAt });
  return id;
}

/**
 * Final de todo login completo (contraseña, enlace mágico, demo y el código de la verificación en
 * dos pasos). Si la usuaria tiene la verificación activada y este navegador no es un dispositivo
 * recordado, NO abre sesión: crea el paso «falta el código» (cookie cirella_2fa, 10 min) y lleva a
 * /entrar/codigo. Sin verificación, abre la sesión como siempre.
 */
export async function completeLogin(userId: string, o: { verified: boolean; next?: string | null; method: LoginMethod }): Promise<never> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpEnabledAt: true } });
  const jar = await cookies();
  if (user.totpEnabledAt) {
    const trusted = await isTrustedDevice(userId, jar.get(TRUSTED_DEVICE_COOKIE)?.value);
    if (!trusted) {
      const token = await createChallenge(userId, { verified: o.verified, redirectTo: o.next ?? null, method: o.method });
      jar.set(TWO_FACTOR_COOKIE, token, { ...cookieBase(), maxAge: 10 * 60 });
      redirect("/entrar/codigo");
    }
    return finishLogin(userId, { verified: o.verified, next: o.next, mfa: true, alert: false });
  }
  return finishLogin(userId, { verified: o.verified, next: o.next, mfa: false, alert: o.method !== "DEMO" });
}

/**
 * Abre la sesión y lleva a su sitio: `next` o el destino natural (homeFor). El área de cliente
 * necesita el email confirmado: si la sesión no lo está, se pide con un enlace. `alert`: avisa por
 * email del acceso nuevo al panel (lib/two-factor-notify.ts decide si toca).
 */
export async function finishLogin(userId: string, o: { verified: boolean; next?: string | null; mfa: boolean; alert: boolean }): Promise<never> {
  const sessionId = await createSession(userId, { verified: o.verified, mfa: o.mfa });
  if (o.alert) {
    const ua = (await headers()).get("user-agent");
    await notifyNewLogin(userId, { device: deviceLabel(ua), sessionId });
  }
  const next = o.next ? safeNext(o.next, "") : "";
  const dest = next || (await homeFor(userId));
  if (!sessionSatisfies({ verified: o.verified, scoped: false }, dest)) redirect(`/entrar?next=${encodeURIComponent(dest)}&motivo=confirmar`);
  redirect(dest);
}

/** Cierra todas las demás sesiones del usuario (al fijar o cambiar la contraseña). */
export async function revokeOtherSessions(userId: string) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await prisma.session.deleteMany({ where: { userId, ...(token ? { NOT: { id: hashToken(token) } } : {}) } });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
  jar.delete(HINT_COOKIE);
}

/**
 * Sesión de la cookie (memoizada por petición), de cualquier tipo: de cuenta o limitada a un
 * pedido. null si no hay, si caducó o si la usuaria está bloqueada.
 */
export const getSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: { include: { creator: { include: { plan: true } } } },
      order: { select: { id: true, productId: true, productType: true, creatorId: true } },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status === "BLOCKED") return null;
  // Verificación en dos pasos: una sesión de cuenta sin el segundo factor no cuenta (se ignora, no se
  // borra). Así cualquier sitio que abriera una sesión sin pasar por completeLogin falla cerrado.
  // Las limitadas a un pedido no abren ni el panel ni la administración: no se tocan.
  if (!sessionUsable(session)) return null;
  return { id: session.id, verified: session.verified, mfa: session.mfa, orderId: session.orderId, order: session.order, user: session.user };
});

export type CurrentSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Usuario de una sesión de cuenta (memoizado por petición). Las limitadas a un pedido no cuentan. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session || session.orderId) return null;
  return { ...session.user, sessionVerified: session.verified };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(next = "/cuenta") {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

/** Exige una creadora autenticada. Devuelve usuario + creadora (tenant). */
export async function requireCreator(opts: { allowIncompleteOnboarding?: boolean } = {}) {
  const user = await requireUser("/panel");
  const creator = user.creator;
  if (!creator) redirect("/onboarding");
  if (creator.status === "BLOCKED") redirect("/entrar?error=bloqueada");
  if (!opts.allowIncompleteOnboarding && !creator.onboardedAt) redirect("/onboarding");
  return { user, creator };
}

/** La administración exige además una sesión que haya demostrado que el email es suyo. */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!user.isAdmin) redirect("/");
  if (!user.sessionVerified) redirect("/entrar?next=%2Fadmin&motivo=confirmar");
  return user;
}

// ─── Acceso tras pagar ───

/**
 * Marca este navegador como el que hace el pedido: guarda el hash de un token en el pedido y el
 * token en una cookie httpOnly de 24 h. Solo ese navegador podrá abrir la sesión limitada al
 * pedido (claimOrderSession), también cuando el pago se confirma después en un webhook o al volver
 * del banco. Solo en Server Actions / Route Handlers, antes de cobrar o de salir a la pasarela.
 */
export async function rememberCheckout(orderId: string) {
  const token = randomBytes(24).toString("base64url");
  await prisma.order.update({ where: { id: orderId }, data: { claimTokenHash: hashToken(token) } });
  const jar = await cookies();
  jar.set(CHECKOUT_COOKIE, `${orderId}.${token}`, { ...cookieBase(), maxAge: CHECKOUT_SESSION_HOURS * 3600 });
}

/** ¿Tiene este navegador el permiso de compra de este pedido? (sin comprobar el token: solo para la UI). */
export async function hasCheckoutCookie(orderId: string) {
  const value = (await cookies()).get(CHECKOUT_COOKIE)?.value ?? "";
  return value.startsWith(`${orderId}.`);
}

/**
 * ¿Es este navegador el que tiene el permiso de compra vigente de este pedido? (cookie con el token
 * cuyo hash guarda el pedido). Un pedido que nunca se ha intentado pagar no es de nadie todavía.
 * Sin efectos: solo compara.
 */
export async function holdsCheckout(orderId: string, claimTokenHash: string | null) {
  if (!claimTokenHash) return true;
  const value = (await cookies()).get(CHECKOUT_COOKIE)?.value ?? "";
  const dot = value.indexOf(".");
  const token = dot > 0 && value.slice(0, dot) === orderId ? value.slice(dot + 1) : "";
  return !!token && sameHash(hashToken(token), claimTokenHash);
}

function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Tras un pago completado, abre la sesión limitada al pedido en el navegador que pagó (24 h):
 *   · "session": se ha abierto;
 *   · "already": ya tenía acceso (sesión verificada de la compradora o sesión de este pedido);
 *   · "email": no se puede (otro navegador, pedido sin pagar o de hace más de 24 h, o hay otra
 *     cuenta abierta, que nunca se sustituye): el recibo lleva el enlace personal.
 * Nunca abre la cuenta completa: para ver el resto de sus compras se pide un enlace al email.
 */
export async function claimOrderSession(orderId: string): Promise<"session" | "already" | "email"> {
  const value = (await cookies()).get(CHECKOUT_COOKIE)?.value ?? "";
  const dot = value.indexOf(".");
  const token = dot > 0 && value.slice(0, dot) === orderId ? value.slice(dot + 1) : "";
  if (!token) return "email";
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, paidAt: true, claimTokenHash: true, customer: { select: { userId: true, user: { select: { status: true } } } } },
  });
  if (!order?.claimTokenHash || !sameHash(hashToken(token), order.claimTokenHash)) return "email";
  if (order.status !== "PAID" || !order.paidAt || order.paidAt.getTime() < Date.now() - CHECKOUT_SESSION_HOURS * 3600_000) return "email";
  const userId = order.customer?.userId;
  if (!userId || order.customer?.user?.status === "BLOCKED") return "email";

  const current = await getSession();
  if (current && !current.orderId) return current.user.id === userId && current.verified ? "already" : "email";
  if (current?.orderId === orderId) return "already";
  await createSession(userId, { verified: false, orderId, ttlHours: CHECKOUT_SESSION_HOURS });
  return "session";
}
