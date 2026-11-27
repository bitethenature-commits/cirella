"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createCreatorSpace, isUsernameAvailable, publishPage, uniqueProductSlug, updateDraft } from "@/lib/creator";
import { prisma } from "@/lib/db";
import { DELIVERY_COUNT, deliveryFacts, deliveryIssue, MIN_PERSONAL_INSTRUCTIONS } from "@/lib/delivery";
import { appUrl } from "@/lib/env";
import { enqueueEmail } from "@/lib/email/outbox";
import { legalIdentityComplete, PLATFORM_TERMS_VERSION } from "@/lib/legal";
import { welcomeCreatorEmail } from "@/lib/email/templates";
import { parseMoneyToCents } from "@/lib/money";
import { captureError } from "@/lib/monitoring";
import { canAcceptPayments, payoutOnboardingLink } from "@/lib/payouts";
import { canSellType } from "@/lib/plans";
import { isPersonalMode } from "@/lib/site-mode";
import { normalizeUsername, RESERVED_PRODUCT_SLUGS } from "@/lib/slug";
import { privateKey, storage } from "@/lib/storage";
import { tenantDb } from "@/lib/tenant";
import { DEFAULT_CTA, PRODUCT_TYPES, type ProductType } from "@/lib/types";
import { inMail } from "@/lib/i18n/email";

type Result = { ok: true; data?: Record<string, unknown> } | { ok: false; error: string };

async function currentCreator() {
  // Modo personal: el asistente está cerrado (ver app/onboarding/page.tsx).
  if (isPersonalMode()) redirect("/login?error=cerrado");
  const user = await requireUser("/onboarding");
  const creator = await prisma.creator.findUnique({ where: { userId: user.id }, include: { plan: true } });
  if (creator?.status === "BLOCKED") redirect("/login?error=bloqueada");
  return { user, creator };
}

export async function checkUsername(raw: string): Promise<Result> {
  const { creator } = await currentCreator();
  const res = await isUsernameAvailable(normalizeUsername(raw), creator?.id);
  return res.ok ? { ok: true } : res;
}

/** Paso 2: nombre de usuario y aceptación de los Términos del servicio y del encargo de tratamiento. */
export async function saveUsername(raw: string, acceptTerms: boolean): Promise<Result> {
  const { user, creator } = await currentCreator();
  if (!acceptTerms && !creator?.termsAcceptedAt) return { ok: false, error: "Acepta los términos para crear tu página" };
  const username = normalizeUsername(raw);
  const res = await isUsernameAvailable(username, creator?.id);
  if (!res.ok) return res;
  if (creator) {
    const terms = creator.termsAcceptedAt ? {} : { termsAcceptedAt: new Date(), termsVersion: PLATFORM_TERMS_VERSION };
    await prisma.creator.update({ where: { id: creator.id }, data: { username, ...terms } });
  } else {
    const jar = await cookies();
    let ref: string | null = null;
    try {
      ref = JSON.parse(jar.get("cirella_signup")?.value ?? "{}").ref || null;
    } catch {}
    const name = user.name || username.charAt(0).toUpperCase() + username.slice(1);
    await createCreatorSpace({ userId: user.id, username, displayName: name, referralCode: ref, termsVersion: PLATFORM_TERMS_VERSION });
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
  return { ok: true };
}

/** Los dos colores con los que empieza su diseño (lo demás lo diseña luego en Mi página › Diseño). */
export async function saveColors(colors: { background: string; accent: string; text: string }): Promise<Result> {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
  const c = z.object({ background: hex, accent: hex, text: hex }).safeParse(colors);
  if (!c.success) return { ok: false, error: "Elige tus colores" };
  await updateDraft(creator.id, (cfg) => ({ ...cfg, theme: { ...cfg.theme, background: c.data.background, bg2: c.data.background, text: c.data.text, accent: c.data.accent, accentText: null } }));
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
  // Tras el onboarding todo pasa por el panel: aquí se podría cambiar el tipo de un producto ya
  // publicado o vendido y saltarse la comprobación de entrega.
  if (creator.onboardedAt) return { ok: false, error: "Hazlo desde el panel" };
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
    // Solo un producto digital puede entregarse «a mano»: si cambia de tipo, vuelve a automático.
    deliveryMode: p.type === "DIGITAL" ? undefined : "AUTOMATIC",
    ...(priceCents !== undefined ? { priceCents } : {}),
  };
  if (p.productId) {
    const existing = await db.product.findFirst({ where: { id: p.productId } });
    if (!existing) return { ok: false, error: "Producto no encontrado" };
    // Un producto que ya no está en borrador no cambia de tipo (pedidos, accesos y reservas dependen de él).
    if (existing.status !== "DRAFT" && existing.type !== p.type) return { ok: false, error: "Hazlo desde el panel" };
    // Un slug que ha pasado a estar reservado (p. ej. «novedades») se recalcula aunque no cambie el título.
    const slug = existing.title !== p.title || RESERVED_PRODUCT_SLUGS.has(existing.slug) ? await uniqueProductSlug(creator.id, p.title, existing.id) : existing.slug;
    await db.product.update({ where: { id: existing.id }, data: { ...data, slug } });
    return { ok: true, data: { productId: existing.id } };
  }
  // El onboarding solo crea el primer producto; el resto se crea desde el panel (con sus límites).
  if ((await db.product.count()) > 0) return { ok: false, error: "Crea tus productos desde el panel" };
  const product = await db.product.create({
    data: {
      ...data,
      priceCents: priceCents ?? 0,
      slug: await uniqueProductSlug(creator.id, p.title),
      sortOrder: 1,
      featured: true,
      // El primer producto nace en borrador; se publica al final si tiene algo que entregar.
      status: "DRAFT",
      creatorId: creator.id,
    },
  });
  return { ok: true, data: { productId: product.id } };
}

/** Paso 9: lleva a la creadora al formulario de Stripe (o al simulador). La vuelta llega a /onboarding. */
export async function connectPayments(): Promise<Result> {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  if (canAcceptPayments(creator)) return { ok: true };
  // Sin datos legales no se puede vender (LSSI art. 10): se piden antes de la cuenta de cobro.
  if (!legalIdentityComplete(creator)) return { ok: false, error: "Completa tus datos legales para activar los cobros" };
  try {
    return { ok: true, data: { url: await payoutOnboardingLink(creator.id, "onboarding") } };
  } catch (e) {
    captureError(e, { area: "payments", tags: { op: "cuenta-alta" }, extra: { creatorId: creator.id } });
    return { ok: false, error: "No hemos podido conectar con Stripe. Inténtalo de nuevo en unos minutos." };
  }
}

export async function publishOnboarding(): Promise<Result> {
  const { user, creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  if (!creator.onboardedAt) {
    // El primer producto solo sale a la venta si se puede vender y tiene algo que entregar (lib/delivery.ts);
    // si no, se queda en borrador y el panel avisa de lo que falta.
    const db = tenantDb(creator.id);
    const first = await db.product.findFirst({ where: { status: { not: "ARCHIVED" } }, orderBy: { createdAt: "asc" }, include: DELIVERY_COUNT });
    if (first) {
      const sellable = first.priceCents >= 100 && canSellType(creator.plan, first.type as ProductType) && !deliveryIssue(deliveryFacts(first))?.blocking;
      await db.product.update({ where: { id: first.id }, data: { status: sellable ? "PUBLISHED" : "DRAFT" } });
    }
  }
  await publishPage(creator.id);
  if (!creator.onboardedAt) {
    await prisma.creator.update({ where: { id: creator.id }, data: { onboardedAt: new Date() } });
    const base = appUrl();
    await enqueueEmail({
      to: user.email,
      template: "WELCOME_CREATOR",
      creatorId: creator.id,
      ...(await inMail(user.email, () => welcomeCreatorEmail({ name: creator.displayName, pageUrl: `${base}/${creator.username}`, panelUrl: `${base}/panel` }))),
    });
  }
  redirect("/onboarding/lista");
}

// ───────────── Paso 8: cómo se entrega el primer producto ─────────────
// Solo durante el onboarding: después, todo pasa por el panel (y su comprobación al publicar).

async function onboardingProductDb(productId: string) {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false as const, error: "Primero elige tu nombre de usuario" };
  if (creator.onboardedAt) return { ok: false as const, error: "Hazlo desde el panel" };
  const db = tenantDb(creator.id);
  const product = await db.product.findFirst({ where: { id: productId }, include: DELIVERY_COUNT });
  if (!product) return { ok: false as const, error: "Producto no encontrado" };
  return { ok: true as const, creator, db, product };
}

const deliverySchema = z.object({
  productId: z.string().min(1),
  choice: z.enum(["FILES", "PERSONAL", "LATER"]),
  instructions: z.string().trim().max(1000).optional(),
});

export async function saveDelivery(input: z.infer<typeof deliverySchema>): Promise<Result> {
  const parsed = deliverySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Elige cómo lo entregas" };
  const d = parsed.data;
  const ctx = await onboardingProductDb(d.productId);
  if (!ctx.ok) return ctx;
  const { db, product } = ctx;
  if (product.type !== "DIGITAL") return { ok: true, data: { deliverable: !deliveryIssue(deliveryFacts(product))?.blocking } };
  let data: { deliveryMode: string; instructions?: string };
  if (d.choice === "FILES") {
    if (product._count.files === 0) return { ok: false, error: "Sube un archivo o añade un enlace para continuar" };
    data = { deliveryMode: "AUTOMATIC" };
  } else if (d.choice === "PERSONAL") {
    const instructions = d.instructions ?? "";
    if (instructions.length < MIN_PERSONAL_INSTRUCTIONS) return { ok: false, error: "Cuenta en una frase qué recibirá tu clienta y cuándo" };
    data = { deliveryMode: "PERSONAL", instructions };
  } else {
    data = { deliveryMode: "AUTOMATIC" };
  }
  await db.product.update({ where: { id: product.id }, data });
  const issue = deliveryIssue(deliveryFacts({ ...product, ...data, instructions: data.instructions ?? product.instructions }));
  return { ok: true, data: { deliverable: !issue?.blocking } };
}

const linkSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1, "Ponle un nombre al enlace").max(120),
  url: z.string().trim().max(500).regex(/^https?:\/\//, "El enlace debe empezar por https://"),
});

export async function addDeliveryLink(input: z.infer<typeof linkSchema>): Promise<Result> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ctx = await onboardingProductDb(d.productId);
  if (!ctx.ok) return ctx;
  const { creator, db, product } = ctx;
  if (product.type !== "DIGITAL") return { ok: false, error: "Este producto no se entrega con enlaces" };
  const file = await db.productFile.create({
    data: { creatorId: creator.id, productId: product.id, name: d.name, kind: "LINK", url: d.url, sortOrder: product._count.files },
  });
  return { ok: true, data: { file: { id: file.id, name: file.name, kind: file.kind, sizeBytes: null } } };
}

/** Quita un archivo o enlace añadido en el paso 8 (el objeto guardado, si lo hay, se limpia como en el panel). */
export async function removeDeliveryFile(fileId: string): Promise<Result> {
  const { creator } = await currentCreator();
  if (!creator) return { ok: false, error: "Primero elige tu nombre de usuario" };
  if (creator.onboardedAt) return { ok: false, error: "Hazlo desde el panel" };
  const db = tenantDb(creator.id);
  const file = await db.productFile.findFirst({ where: { id: String(fileId) } });
  if (!file) return { ok: true };
  await db.productFile.deleteMany({ where: { id: file.id } });
  if (file.storageKey) await storage().delete([privateKey(file.storageKey)]).catch(() => {});
  return { ok: true };
}
