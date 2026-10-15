import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { defaultPageConfig, readPageConfig, type PageConfig } from "./page-config";
import { attachReferral } from "./referrals";
import { randomCode, RESERVED_PRODUCT_SLUGS, slugify, validateUsername } from "./slug";
import { tenantDb } from "./tenant";

export async function isUsernameAvailable(username: string, exceptCreatorId?: string) {
  const err = validateUsername(username);
  if (err) return { ok: false as const, error: err };
  const existing = await prisma.creator.findUnique({ where: { username } });
  if (existing && existing.id !== exceptCreatorId) return { ok: false as const, error: "Ese nombre ya está cogido" };
  return { ok: true as const };
}

async function uniqueReferralCode(base: string) {
  const clean = slugify(base).replace(/-/g, "").toUpperCase().slice(0, 8);
  for (let i = 0; i < 5; i++) {
    const code = i === 0 && clean.length >= 4 ? clean : `${clean.slice(0, 4)}${randomCode(4)}`;
    if (!(await prisma.creator.findUnique({ where: { referralCode: code } }))) return code;
  }
  return randomCode(10);
}

/** Crea el espacio (tenant) de una creadora con plan por defecto y disponibilidad inicial. */
export async function createCreatorSpace(input: {
  userId: string;
  username: string;
  displayName: string;
  referralCode?: string | null;
  /** Versión de los Términos del servicio que acepta al crear la página (lib/legal.ts). */
  termsVersion?: string;
}) {
  const plan = (await prisma.plan.findFirst({ where: { isDefault: true, active: true } })) ?? (await prisma.plan.findFirstOrThrow({ orderBy: { sortOrder: "asc" } }));
  const page = defaultPageConfig({ displayName: input.displayName });
  const creator = await prisma.creator.create({
    data: {
      userId: input.userId,
      username: input.username,
      displayName: input.displayName,
      planId: plan.id,
      pageDraft: page as unknown as Prisma.InputJsonValue,
      referralCode: await uniqueReferralCode(input.username),
      ...(input.termsVersion ? { termsAcceptedAt: new Date(), termsVersion: input.termsVersion } : {}),
    },
  });
  // Disponibilidad por defecto: L–V 10:00–14:00 y 16:00–19:00 (editable en Reservas)
  await tenantDb(creator.id).availabilityRule.createMany({
    data: [1, 2, 3, 4, 5].flatMap((weekday) => [
      { weekday, startMinute: 600, endMinute: 840, creatorId: creator.id },
      { weekday, startMinute: 960, endMinute: 1140, creatorId: creator.id },
    ]),
  });
  await attachReferral(creator.id, input.referralCode);
  return creator;
}

/** Aplica cambios al borrador de la página. */
export async function updateDraft(creatorId: string, patch: (cfg: PageConfig) => PageConfig) {
  const creator = await prisma.creator.findUniqueOrThrow({ where: { id: creatorId } });
  const next = patch(readPageConfig(creator.pageDraft, creator.displayName));
  await prisma.creator.update({
    where: { id: creatorId },
    data: { pageDraft: next as unknown as Prisma.InputJsonValue, displayName: next.displayName },
  });
  return next;
}

export async function uniqueProductSlug(creatorId: string, title: string, exceptId?: string) {
  const base = slugify(title) || "producto";
  const db = tenantDb(creatorId);
  let slug = RESERVED_PRODUCT_SLUGS.has(base) ? `${base}-1` : base;
  for (let i = 2; i < 50; i++) {
    const clash = await db.product.findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) } });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${randomCode(4).toLowerCase()}`;
}

/** «Publicar»: copia el borrador a la versión pública. La primera vez, recompensa al referente. */
export async function publishPage(creatorId: string) {
  const c = await prisma.creator.findUniqueOrThrow({ where: { id: creatorId } });
  await prisma.creator.update({
    where: { id: creatorId },
    data: {
      pagePublished: c.pageDraft as Prisma.InputJsonValue,
      published: true,
      publishedAt: c.publishedAt ?? new Date(),
      displayName: readPageConfig(c.pageDraft, c.displayName).displayName,
    },
  });
  if (!c.published) {
    const { rewardReferral } = await import("./referrals");
    await rewardReferral(creatorId);
  }
}
