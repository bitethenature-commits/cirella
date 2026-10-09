"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createCreatorSpace, isUsernameAvailable, publishPage, uniqueProductSlug, updateDraft } from "@/lib/creator";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { enqueueEmail } from "@/lib/email/outbox";
import { welcomeCreatorEmail } from "@/lib/email/templates";
import { parseMoneyToCents } from "@/lib/money";
import { paymentProvider } from "@/lib/payments";
import { canSellType } from "@/lib/plans";
import { normalizeUsername } from "@/lib/slug";
import { TEMPLATE_KEYS } from "@/lib/templates";
import { tenantDb } from "@/lib/tenant";
import { DEFAULT_CTA, PRODUCT_TYPES } from "@/lib/types";

type Result = { ok: true; data?: Record<string, unknown> } | { ok: false; error: string };

async function currentCreator() {
  const user = await requireUser("/onboarding");
  const creator = await prisma.creator.findUnique({ where: { userId: user.id }, include: { plan: true } });
  if (creator?.status === "BLOCKED") redirect("/entrar?error=bloqueada");
  return { user, creator };
}

export async function checkUsername(raw: string): Promise<Result> {
  const { creator } = await currentCreator();
  const res = await isUsernameAvailable(normalizeUsername(raw), creator?.id);
  return res.ok ? { ok: true } : res;
}

export async function saveUsername(raw: string): Promise<Result> {
  const { user, creator } = await currentCreator();
  const username = normalizeUsername(raw);
  const res = await isUsernameAvailable(username, creator?.id);
  if (!res.ok) return res;
  if (creator) {
    await prisma.creator.update({ where: { id: creator.id }, data: { username } });
  } else {
    const jar = await cookies();
    let ref: string | null = null;
    try {
      ref = JSON.parse(jar.get("cirella_signup")?.value ?? "{}").ref || null;
    } catch {}
    const name = user.name || username.charAt(0).toUpperCase() + username.slice(1);
    await createCreatorSpace({ userId: user.id, username, displayName: name, referralCode: ref });
  }
  return { ok: true, data: { username } };
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Escribe tu nombre").max(80),
  tagline: z.string().trim().max(120),
  bio: z.string().trim().max(600),
  avatarUrl: z.string().max(500).nullable(),
});

export async function saveProfile(input: z.infer<typeof profileSchema>): Promise<Result> {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const a = parsed.data.avatarUrl;
  const avatarUrl = a && (a.startsWith("/media/") || a.startsWith("/demo/")) ? a : null;
  await updateDraft(creator.id, (c) => ({ ...c, ...parsed.data, avatarUrl }));
  return { ok: true };
}

export async function saveAvatar(avatarUrl: string | null): Promise<Result> {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  if (avatarUrl && !avatarUrl.startsWith("/media/") && !avatarUrl.startsWith("/demo/")) return { ok: false, error: "Imagen no válida" };
  await updateDraft(creator.id, (c) => ({ ...c, avatarUrl }));
  return { ok: true };
}

export async function saveCategory(categoryId: string): Promise<Result> {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  const cat = await prisma.category.findFirst({ where: { id: categoryId, active: true } });
  if (!cat) return { ok: false, error: "Elige una categoría" };
  await prisma.creator.update({ where: { id: creator.id }, data: { categoryId: cat.id } });
  return { ok: true, data: { suggestedTemplate: cat.defaultTemplate } };
}

export async function saveTemplate(template: string): Promise<Result> {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  const t = z.enum(TEMPLATE_KEYS).safeParse(template);
  if (!t.success) return { ok: false, error: "Elige un estilo" };
  const active = await prisma.template.findFirst({ where: { key: t.data, active: true } });
  if (!active) return { ok: false, error: "Ese estilo no está disponible" };
  await updateDraft(creator.id, (c) => ({ ...c, template: t.data }));
  return { ok: true };
}

const productSchema = z.object({
  productId: z.string().nullable(),
  type: z.enum(PRODUCT_TYPES),
  title: z.string().trim().min(2, "Ponle un nombre a tu producto").max(100),
  summary: z.string().trim().max(240),
  emoji: z.string().max(8).nullable(),
  imageUrl: z.string().max(500).nullable(),
  price: z.string().optional(),
  durationMin: z.number().int().min(15).max(480).nullable().optional(),
});

export async function saveFirstProduct(input: z.infer<typeof productSchema>): Promise<Result> {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const p = parsed.data;
  if (p.imageUrl && !p.imageUrl.startsWith("/media/") && !p.imageUrl.startsWith("/demo/")) return { ok: false, error: "Imagen no válida" };
  if (!canSellType(creator.plan, p.type)) return { ok: false, error: "Ese tipo de producto no está incluido en tu plan" };
  const db = tenantDb(creator.id);
  const priceCents = p.price !== undefined ? parseMoneyToCents(p.price) : undefined;
  if (priceCents !== undefined && (priceCents < 100 || priceCents > 1_000_000)) return { ok: false, error: "El precio debe estar entre 1 € y 10.000 €" };
  const data = {
    type: p.type,
    title: p.title,
    summary: p.summary || null,
    emoji: p.emoji,
    imageUrl: p.imageUrl,
    ctaLabel: DEFAULT_CTA[p.type],
    billingInterval: p.type === "MEMBERSHIP" ? "month" : null,
    durationMin: p.type === "SESSION" ? (p.durationMin ?? 60) : null,
    bufferMin: p.type === "SESSION" ? 15 : null,
    minNoticeHours: p.type === "SESSION" ? 24 : null,
    ...(priceCents !== undefined ? { priceCents } : {}),
  };
  if (p.productId) {
    const existing = await db.product.findFirst({ where: { id: p.productId } });
    if (!existing) return { ok: false, error: "Producto no encontrado" };
    const slug = existing.title !== p.title ? await uniqueProductSlug(creator.id, p.title, existing.id) : existing.slug;
    await db.product.update({ where: { id: existing.id }, data: { ...data, slug } });
    return { ok: true, data: { productId: existing.id } };
  }
  // El onboarding solo crea el primer producto; el resto se crea desde el panel (con sus límites).
  if (creator.onboardedAt || (await db.product.count()) > 0) return { ok: false, error: "Crea tus productos desde el panel" };
  const product = await db.product.create({
    data: {
      ...data,
      priceCents: priceCents ?? 0,
      slug: await uniqueProductSlug(creator.id, p.title),
      sortOrder: 1,
      featured: true,
      status: "PUBLISHED", // el primer producto sale publicado con la página
      creatorId: creator.id,
    },
  });
  return { ok: true, data: { productId: product.id } };
}

export async function connectPayments(): Promise<Result> {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  if (creator.payoutConnectedAt) return { ok: true };
  const provider = paymentProvider();
  const { accountId } = await provider.connectAccount(creator.id);
  await prisma.creator.update({
    where: { id: creator.id },
    data: { payoutProvider: provider.key, payoutAccountId: accountId, payoutConnectedAt: new Date() },
  });
  return { ok: true };
}

export async function publishOnboarding(): Promise<Result> {
  const { user, creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  await publishPage(creator.id);
  if (!creator.onboardedAt) {
    await prisma.creator.update({ where: { id: creator.id }, data: { onboardedAt: new Date() } });
    const base = appUrl();
    await enqueueEmail({
      to: user.email,
      template: "WELCOME_CREATOR",
      creatorId: creator.id,
      ...welcomeCreatorEmail({ name: creator.displayName, pageUrl: `${base}/${creator.username}`, panelUrl: `${base}/panel` }),
    });
  }
  redirect("/onboarding/lista");
}
