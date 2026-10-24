import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { hashToken } from "./auth-tokens";
import { safeNext } from "./auth-utils";
import { prisma } from "./db";
import { enqueueEmail } from "./email/outbox";
import { emailChangeConfirmEmail, magicLinkEmail } from "./email/templates";
import { appUrl } from "./env";
import { dispatchEvents, recordEvents } from "./events";
import { readEmailChangeData, readRegisterData, type EmailChangeData, type RegisterData } from "./login-token-data";

export { readEmailChangeData, readRegisterData, type EmailChangeData, type RegisterData };

/**
 * Enlaces mágicos (sin cookies ni Next: los usan lib/auth.ts y las pruebas de BD). La sesión la
 * abre quien los consume (app/auth/magic/actions.ts).
 */

const MAGIC_LINK_MINUTES = 60;
const VERIFY_LINK_HOURS = 72;
/** Alta de alumna y cambio de email: el email puede tardar o abrirse más tarde. */
const REGISTER_LINK_HOURS = 24;

export type MagicPurpose = "LOGIN" | "VERIFY_SIGNUP" | "REGISTER" | "CHANGE_EMAIL";
const PURPOSES: MagicPurpose[] = ["LOGIN", "VERIFY_SIGNUP", "REGISTER", "CHANGE_EMAIL"];

/**
 * Genera un enlace mágico y lo envía por email (bandeja de salida).
 *   · LOGIN: entrar (1 hora, un solo uso).
 *   · VERIFY_SIGNUP: «Confirma tu email» tras un alta con contraseña (72 horas), con los botones
 *     «Sí, he sido yo» / «No he sido yo».
 *   · REGISTER: «Crear mi cuenta» de una alumna (24 horas). Nada se crea hasta que lo confirma.
 *   · CHANGE_EMAIL: confirmar la dirección nueva (24 horas); `email` es la nueva.
 * creatorId solo pone la marca de la creadora en el email y en la pantalla «Entrar»; no da permisos.
 */
export async function sendMagicLink(
  email: string,
  redirectTo = "/auth/continuar",
  ctx: { creatorId?: string | null; purpose?: MagicPurpose; data?: RegisterData | EmailChangeData; name?: string | null } = {},
) {
  const purpose = ctx.purpose ?? "LOGIN";
  const token = randomBytes(32).toString("base64url");
  const ttlMs =
    purpose === "VERIFY_SIGNUP"
      ? VERIFY_LINK_HOURS * 3600_000
      : purpose === "REGISTER" || purpose === "CHANGE_EMAIL"
        ? REGISTER_LINK_HOURS * 3600_000
        : MAGIC_LINK_MINUTES * 60_000;
  const creator = ctx.creatorId ? await prisma.creator.findUnique({ where: { id: ctx.creatorId }, select: { id: true, displayName: true } }) : null;
  await prisma.loginToken.create({
    data: {
      email: email.toLowerCase(),
      tokenHash: hashToken(token),
      purpose,
      creatorId: creator?.id ?? null,
      redirectTo: safeNext(redirectTo, "/auth/continuar"),
      data: ctx.data ?? Prisma.JsonNull,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  const url = `${appUrl()}/auth/magic?token=${token}`;
  const mail =
    purpose === "CHANGE_EMAIL"
      ? emailChangeConfirmEmail({ url, creatorName: creator?.displayName })
      : magicLinkEmail({ url, creatorName: creator?.displayName, purpose, name: ctx.name });
  await enqueueEmail({
    to: email,
    template: purpose === "VERIFY_SIGNUP" ? "VERIFY_EMAIL" : purpose === "CHANGE_EMAIL" ? "EMAIL_CHANGE_CONFIRM" : purpose === "REGISTER" ? "REGISTER" : "MAGIC_LINK",
    creatorId: creator?.id ?? null,
    ...mail,
    sendNow: true,
  });
}

/** Lee un enlace mágico sin gastarlo (pantalla «Entrar»). null si no existe, ya se usó o caducó. */
export async function peekMagicLink(token: string): Promise<{ purpose: MagicPurpose; email: string; creatorId: string | null } | null> {
  if (!token) return null;
  const record = await prisma.loginToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  const purpose = PURPOSES.includes(record.purpose as MagicPurpose) ? (record.purpose as MagicPurpose) : "LOGIN";
  return { purpose, email: record.email, creatorId: record.creatorId };
}

/** Creadora del enlace (aunque ya se haya usado o caducado): para mandar al login con su marca. */
export async function magicLinkCreatorId(token: string) {
  if (!token) return null;
  const record = await prisma.loginToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { creatorId: true } });
  return record?.creatorId ?? null;
}

/**
 * Gasta un enlace mágico (solo desde el POST de «Entrar»: los antivirus del correo hacen GET).
 * Es atómico: dos peticiones a la vez no pueden usar el mismo enlace. Devuelve la usuaria
 * (creándola si no existe) y adónde ir, o null si el enlace no vale.
 *
 * La primera prueba de que el email es suyo anula lo que se hizo antes sin esa prueba (contraseña
 * y sesiones de quien registró el email). Con «No he sido yo» se anula siempre.
 */
export async function consumeMagicLink(
  token: string,
  choice?: "yes" | "no",
  /** sha256 de la cookie de sesión del navegador que confirma (Session.id), si tiene. */
  ctx: { currentSessionId?: string | null } = {},
): Promise<{ user: { id: string; email: string }; redirectTo: string } | null> {
  if (!token) return null;
  const now = new Date();
  const tokenHash = hashToken(token);
  // Los de cambio de email no abren sesión por aquí: van por consumeEmailChange.
  const used = await prisma.loginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now }, purpose: { not: "CHANGE_EMAIL" } },
    data: { usedAt: now },
  });
  if (used.count !== 1) return null;
  const record = await prisma.loginToken.findUniqueOrThrow({ where: { tokenHash } });
  let user = await prisma.user.upsert({
    where: { email: record.email },
    update: {},
    create: { email: record.email, emailVerifiedAt: now },
  });
  if (user.status === "BLOCKED") return null;

  let resetPassword = false;
  // «Sí, he sido yo» solo conserva la contraseña si se confirma desde el navegador donde se creó la
  // cuenta (su sesión). Si no, nada prueba que quien la puso sea quien abre el email (alguien pudo
  // registrar este email antes que su dueña): se trata como una recuperación.
  const ownSession =
    record.purpose === "VERIFY_SIGNUP" && choice === "yes" && !user.emailVerifiedAt && ctx.currentSessionId
      ? await prisma.session.findFirst({ where: { id: ctx.currentSessionId, userId: user.id, orderId: null, expiresAt: { gt: now } }, select: { id: true } })
      : null;
  if (ownSession) {
    // Solo esa sesión pasa a estar confirmada; cualquier otra sin confirmar deja de valer.
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
    await prisma.session.update({ where: { id: ownSession.id }, data: { verified: true } });
    await prisma.session.deleteMany({ where: { userId: user.id, verified: false } });
  } else if (choice === "no" || !user.emailVerifiedAt) {
    // Recuperación: fuera la contraseña creada sin probar el email y todas las sesiones previas.
    resetPassword = !!user.passwordHash;
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? now, passwordHash: null } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
  } else {
    // Las sesiones no verificadas (p. ej. de un checkout hecho por otra persona con este email) dejan de valer.
    await prisma.session.deleteMany({ where: { userId: user.id, verified: false } });
  }

  if (record.purpose === "REGISTER") await applyRegistration(user, readRegisterData(record.data), now);

  const redirectTo = safeNext(record.redirectTo, "/auth/continuar");
  return {
    user: { id: user.id, email: user.email },
    redirectTo: resetPassword ? `/contrasena?motivo=seguridad&next=${encodeURIComponent(redirectTo)}` : redirectTo,
  };
}

/**
 * «Crear mi cuenta» confirmado (el email ya es suyo): el nombre solo si la cuenta no tenía (nadie
 * renombra la cuenta de otra registrando su email), su ficha de clienta de la dueña (con el email
 * de bienvenida de siempre, customer.created) y las novedades si marcó la casilla: el clic del
 * email es la confirmación (doble opt-in). Las compras con este email ya son de esta cuenta.
 */
async function applyRegistration(user: { id: string; email: string; name: string | null }, data: RegisterData | null, now: Date) {
  if (!data) return;
  const found = await prisma.creator.findUnique({ where: { id: data.creatorId }, select: { id: true, userId: true } });
  // La dueña no es clienta de sí misma (si se «registra» con su propio email, solo entra).
  const creator = found && found.userId !== user.id ? found : null;
  const eventIds = await prisma.$transaction(async (tx) => {
    const name = user.name || data.name || null;
    if (!user.name && data.name) await tx.user.update({ where: { id: user.id }, data: { name: data.name } });
    if (!creator) return [];
    const prev = await tx.customer.findUnique({ where: { creatorId_userId: { creatorId: creator.id, userId: user.id } } });
    const customer = await tx.customer.upsert({
      where: { creatorId_userId: { creatorId: creator.id, userId: user.id } },
      create: { creatorId: creator.id, userId: user.id, email: user.email, name, marketingOptIn: data.newsletter, marketingOptInAt: data.newsletter ? now : null },
      update: data.newsletter && !prev?.marketingOptIn ? { marketingOptIn: true, marketingOptInAt: now } : {},
    });
    return prev ? [] : recordEvents(tx, [{ type: "customer.created", customerId: customer.id }]);
  });
  await dispatchEvents(eventIds);
}

/**
 * Confirma un cambio de email (POST de la pantalla del enlace). En una transacción: gasta el
 * enlace, comprueba que la cuenta sigue teniendo el email de antes y que nadie tiene ya el nuevo,
 * cambia el email de la cuenta y de sus fichas de clienta y cierra TODAS sus sesiones (quien
 * confirma entra de nuevo con completeLogin). 'taken' si el nuevo ya es de otra cuenta.
 */
export async function consumeEmailChange(token: string): Promise<{ user: { id: string; email: string }; fromEmail: string; tokenId: string } | "taken" | null> {
  if (!token) return null;
  const now = new Date();
  const tokenHash = hashToken(token);
  try {
    return await prisma.$transaction(async (tx) => {
      const used = await tx.loginToken.updateMany({ where: { tokenHash, purpose: "CHANGE_EMAIL", usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (used.count !== 1) return null;
      const record = await tx.loginToken.findUniqueOrThrow({ where: { tokenHash } });
      const data = readEmailChangeData(record.data);
      if (!data) return null;
      const user = await tx.user.findUnique({ where: { id: data.userId } });
      if (!user || user.status === "BLOCKED" || user.email !== data.fromEmail.toLowerCase()) return null;
      if (await tx.user.findUnique({ where: { email: record.email }, select: { id: true } })) return "taken" as const;
      const updated = await tx.user.update({ where: { id: user.id }, data: { email: record.email, emailVerifiedAt: user.emailVerifiedAt ?? now } });
      await tx.customer.updateMany({ where: { userId: user.id }, data: { email: record.email } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      return { user: { id: updated.id, email: updated.email }, fromEmail: data.fromEmail, tokenId: record.id };
    });
  } catch (e) {
    // Otra cuenta se ha quedado el email a la vez (índice único).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "taken";
    throw e;
  }
}
