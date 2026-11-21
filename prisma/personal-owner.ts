/**
 * Cuenta de la dueña de una web en modo personal: la crea o la pone al día. La usan
 * `npm run personal:setup` (scripts/personal-setup.ts, desde su ordenador y con contraseña) y
 * `npm run deploy` (prisma/bootstrap.ts, con OWNER_EMAIL: la crea en el primer despliegue, sin
 * contraseña; entra con un enlace por email y la elige después).
 *
 * Idempotente: no duplica ni borra nada.
 *   · el plan «Personal»: gratis, comisión 0 y todas las funciones;
 *   · su usuario: administradora y con el email confirmado (y la contraseña, si se pasa);
 *   · su página (username): con el asistente hecho, publicada y con el plan «Personal».
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { defaultPageConfig } from "../lib/page-config";
import { PERSONAL_PLAN } from "../lib/personal-setup";
import { normalizeUsername, randomCode, slugify } from "../lib/slug";
import { ensureBaseData } from "./base-data";

export class OwnerSetupError extends Error {}

/** Qué hacer con la cuenta de la dueña en este despliegue (pura: la prueban los tests). */
export function ownerBootstrapPlan(env: Record<string, string | undefined>): { email: string; username: string; name: string | null } | null {
  if (env.SITE_MODE?.trim() !== "personal") return null;
  const email = env.OWNER_EMAIL?.trim().toLowerCase();
  const username = normalizeUsername(env.OWNER_USERNAME ?? "");
  if (!email || !username) return null;
  const name = env.OWNER_NAME?.trim().slice(0, 80) || null;
  return { email, username, name };
}

async function uniqueReferralCode(prisma: PrismaClient, base: string) {
  const clean = slugify(base).replace(/-/g, "").toUpperCase().slice(0, 8);
  for (let i = 0; i < 5; i++) {
    const code = i === 0 && clean.length >= 4 ? clean : `${clean.slice(0, 4)}${randomCode(4)}`;
    if (!(await prisma.creator.findUnique({ where: { referralCode: code } }))) return code;
  }
  return randomCode(10);
}

export async function ensurePersonalOwner(
  prisma: PrismaClient,
  input: { email: string; username: string; name: string | null; passwordHash?: string },
) {
  const { email, username, name, passwordHash } = input;
  // 1. Datos base y plan «Personal» (si ya existe, se le vuelve a dejar sin comisión y con todo).
  await ensureBaseData(prisma);
  const { key, features, ...planData } = PERSONAL_PLAN;
  const plan = await prisma.plan.upsert({
    where: { key },
    create: { key, ...planData, features: features as Prisma.InputJsonValue },
    update: { ...planData, features: features as Prisma.InputJsonValue },
  });

  // 2. Usuario: administradora, con el email confirmado.
  const existing = await prisma.user.findUnique({ where: { email }, include: { creator: true } });
  const taken = await prisma.creator.findUnique({ where: { username }, include: { user: { select: { email: true } } } });
  if (taken && taken.userId !== existing?.id)
    throw new OwnerSetupError(`El usuario «${username}» ya es de otra cuenta (${taken.user.email}). Usa ese email o elige otro OWNER_USERNAME.`);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { isAdmin: true, status: "ACTIVE", emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), ...(passwordHash ? { passwordHash } : {}), ...(name && !existing.name ? { name } : {}) },
      })
    : await prisma.user.create({ data: { email, name, isAdmin: true, emailVerifiedAt: new Date(), passwordHash } });

  // 3. Página: con el asistente hecho, publicada y con el plan «Personal».
  const now = new Date();
  let creator = existing?.creator ?? null;
  if (!creator) {
    const displayName = name ?? user.name ?? username;
    const page = defaultPageConfig({ displayName, personal: true }) as unknown as Prisma.InputJsonValue;
    creator = await prisma.creator.create({
      data: {
        userId: user.id,
        username,
        displayName,
        planId: plan.id,
        pageDraft: page,
        pagePublished: page,
        published: true,
        publishedAt: now,
        onboardedAt: now,
        contactEmail: email,
        referralCode: await uniqueReferralCode(prisma, username),
      },
    });
    // Disponibilidad por defecto, por si algún día una sesión se reserva aquí: L–V 10–14 y 16–19.
    await prisma.availabilityRule.createMany({
      data: [1, 2, 3, 4, 5].flatMap((weekday) => [
        { weekday, startMinute: 600, endMinute: 840, creatorId: creator!.id },
        { weekday, startMinute: 960, endMinute: 1140, creatorId: creator!.id },
      ]),
    });
  } else {
    creator = await prisma.creator.update({
      where: { id: creator.id },
      data: {
        username,
        planId: plan.id,
        status: "ACTIVE",
        onboardedAt: creator.onboardedAt ?? now,
        published: true,
        publishedAt: creator.publishedAt ?? now,
        ...(creator.pagePublished === null ? { pagePublished: creator.pageDraft as Prisma.InputJsonValue } : {}),
      },
    });
  }
  return { plan, user, creator, existed: !!existing };
}
