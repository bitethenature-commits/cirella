import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { appUrl } from "./env";
import { enqueueEmail } from "./email/outbox";
import { magicLinkEmail } from "./email/templates";

export const SESSION_COOKIE = "cirella_session";
const SESSION_DAYS = 30;
const MAGIC_LINK_MINUTES = 30;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/** Crea una sesión y la guarda en una cookie httpOnly. Solo en Server Actions / Route Handlers. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Usuario de la sesión actual (memoizado por petición). */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { creator: { include: { plan: true } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status === "BLOCKED") return null;
  return session.user;
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

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!user.isAdmin) redirect("/");
  return user;
}

/** Genera un enlace mágico de acceso y lo envía por email (bandeja de salida). */
export async function sendMagicLink(email: string, redirectTo = "/cuenta", context?: { creatorName?: string; creatorId?: string }) {
  const token = randomBytes(32).toString("base64url");
  await prisma.loginToken.create({
    data: {
      email: email.toLowerCase(),
      tokenHash: hashToken(token),
      redirectTo,
      expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000),
    },
  });
  const url = `${appUrl()}/auth/magic?token=${token}`;
  const mail = magicLinkEmail({ url, creatorName: context?.creatorName });
  await enqueueEmail({ to: email, template: "MAGIC_LINK", creatorId: context?.creatorId ?? null, ...mail, sendNow: true });
}

/** Consume un token de enlace mágico. Devuelve el usuario (creándolo si no existe). */
export async function consumeMagicLink(token: string) {
  const record = await prisma.loginToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  await prisma.loginToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  const user = await prisma.user.upsert({
    where: { email: record.email },
    update: {},
    create: { email: record.email },
  });
  if (user.status === "BLOCKED") return null;
  return { user, redirectTo: record.redirectTo ?? "/cuenta" };
}

/** Solo acepta redirecciones internas (evita open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/cuenta") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
