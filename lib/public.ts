import "server-only";
import { cache } from "react";
import { asAccessMode, externalHost } from "./access-mode";
import { prisma } from "./db";
import { expiryLabel, visibleCodeWhere } from "./discount-codes";
import { readPageConfig } from "./page-config";
import { planFeatures, type PlanFeatures } from "./plans";
import { POSTS_ON_PAGE, POSTS_PER_PAGE, postExcerpt, publicPostWhere } from "./posts";
import { isPublicUsernameAllowed } from "./personal-routing";
import { hasPaymentProvider } from "./payments";
import { getSettings } from "./settings";
import { isPersonalMode, ownerUsername } from "./site-mode";
import { asTaxMode, decideTax, vatIncluded } from "./tax";
import { formatDate } from "./tz";
import { lessonsLabel, PRODUCT_TYPES, type ProductType } from "./types";
import type { PublicDiscountCode, PublicPost, PublicProduct } from "@/components/creator-page/creator-page-view";

/** La dueña de la web personal tiene todo desbloqueado (sin planes): lo que pinta su página. */
const ALL_FEATURES: PlanFeatures = {
  productTypes: [...PRODUCT_TYPES],
  customDesign: true,
  removeBranding: true,
  analytics: "advanced",
  customerArea: true,
  automations: true,
};

/** Datos públicos de una creadora. `draft` = vista previa del borrador (solo propietaria). */
export const getPublicCreator = cache(async (username: string, draft = false) => {
  // Web personal: las demás usuarias no existen (ni sus datos viajan dentro de un 404).
  if (!isPublicUsernameAllowed(username, ownerUsername())) return null;
  const creator = await prisma.creator.findUnique({
    where: { username: username.toLowerCase() },
    include: { plan: true, user: { select: { status: true } } },
  });
  if (!creator || creator.status !== "ACTIVE" || creator.user.status !== "ACTIVE") return null;
  // Web personal: solo la dueña tiene página (las demás ya dan 404 antes de llegar aquí).
  const personal = isPersonalMode() && ownerUsername() === creator.username;
  // Web personal sin cobros: lo de pago en la web no se ofrece (ni condiciones de venta en el pie).
  const signupsOnly = personal && !hasPaymentProvider();
  const features = personal ? ALL_FEATURES : planFeatures(creator.plan);
  const raw = draft ? creator.pageDraft : (creator.pagePublished ?? creator.pageDraft);
  const config = readPageConfig(raw, creator.displayName);
  const now = new Date();
  const [rows, postRows, postCount, codeRows, settings] = await Promise.all([
    prisma.product.findMany({
      where: { creatorId: creator.id, status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { lessons: true } } },
    }),
    prisma.post.findMany({
      where: { creatorId: creator.id, ...publicPostWhere(now) },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: POSTS_ON_PAGE,
      select: POST_CARD_SELECT,
    }),
    prisma.post.count({ where: { creatorId: creator.id, ...publicPostWhere(now) } }),
    prisma.discountCode.findMany({
      where: { creatorId: creator.id, ...visibleCodeWhere(now) },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    getSettings(),
  ]);
  // «IVA incluido» con una compradora de España (el precio es el mismo en todos los países).
  const mode = asTaxMode(settings.taxMode);
  const taxCreator = { country: creator.legalCountry, vatStatus: creator.vatStatus, vatExemptionNote: creator.vatExemptionNote };
  const products: PublicProduct[] = rows
    .filter((p) => features.productTypes.includes(p.type as ProductType))
    .map((p) => {
      const accessMode = asAccessMode(p.accessMode);
      return {
        id: p.id,
        type: p.type,
        slug: p.slug,
        title: p.title,
        emoji: p.emoji,
        summary: p.summary,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        currency: p.currency,
        billingInterval: p.billingInterval,
        ctaLabel: p.ctaLabel,
        featured: p.featured,
        meta:
          p.type === "SESSION" && p.durationMin
            ? `${p.durationMin} min`
            : p.type === "COURSE" && p._count.lessons
              ? lessonsLabel(p._count.lessons)
              : null,
        // Lo gratuito y lo que se paga fuera no llevan IVA aquí (no se cobra en esta web).
        vatIncluded:
          accessMode === "PAID" &&
          vatIncluded(decideTax({ mode, productType: p.type, deliveryMode: p.deliveryMode, buyerCountry: "ES", creator: taxCreator })),
        accessMode,
        externalUrl: accessMode === "EXTERNAL" ? p.externalUrl : null,
        externalLabel: accessMode === "EXTERNAL" ? p.externalLabel : null,
        externalHost: accessMode === "EXTERNAL" ? externalHost(p.externalUrl) : null,
      };
    });
  const posts = postRows.map((p) => toPublicPost(p, creator.timezone));
  const discountCodes: PublicDiscountCode[] = codeRows.map((c) => ({
    id: c.id,
    brand: c.brand,
    code: c.code,
    description: c.description,
    url: c.url,
    imageUrl: c.imageUrl,
    expiresLabel: expiryLabel(c.expiresAt, creator.timezone),
  }));
  return {
    creator,
    config,
    products,
    /** Las últimas publicaciones (sección «Novedades») y cuántas hay en total. */
    posts,
    postCount,
    discountCodes,
    features,
    personal,
    signupsOnly,
    allowCustom: features.customDesign,
    // Web personal: nunca «Powered by».
    showPoweredBy: !personal && !(features.removeBranding && config.hidePoweredBy),
    platformName: settings.platformName,
  };
});

const POST_CARD_SELECT = { id: true, slug: true, title: true, excerpt: true, body: true, imageUrl: true, publishedAt: true } as const;

function toPublicPost(
  p: { id: string; slug: string; title: string; excerpt: string | null; body: string; imageUrl: string | null; publishedAt: Date | null },
  timeZone: string,
): PublicPost {
  const publishedAt = p.publishedAt ?? new Date(0);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: postExcerpt(p),
    imageUrl: p.imageUrl,
    publishedAt,
    dateLabel: formatDate(publishedAt, { day: "numeric", month: "long", year: "numeric" }, timeZone),
  };
}

/** Lista de publicaciones visibles de una creadora (/<usuaria>/novedades), paginada. */
export async function getPublicPostList(creatorId: string, timeZone: string, page = 1) {
  const now = new Date();
  const where = { creatorId, ...publicPostWhere(now) };
  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (Math.max(1, page) - 1) * POSTS_PER_PAGE,
      take: POSTS_PER_PAGE,
      select: POST_CARD_SELECT,
    }),
    prisma.post.count({ where }),
  ]);
  return { posts: rows.map((p) => toPublicPost(p, timeZone)), total, pages: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)) };
}

/** Una publicación visible por su slug (null si no existe, es borrador o está programada). */
export const getPublicPost = cache(async (creatorId: string, slug: string) => {
  return prisma.post.findFirst({ where: { creatorId, slug, ...publicPostWhere(new Date()) } });
});

/** Las publicaciones visibles anterior y siguiente (para navegar entre ellas). */
export async function getAdjacentPosts(creatorId: string, publishedAt: Date, id: string) {
  const base = { creatorId, NOT: { id }, ...publicPostWhere(new Date()) };
  const select = { slug: true, title: true } as const;
  const [older, newer] = await Promise.all([
    prisma.post.findFirst({ where: { ...base, publishedAt: { lt: publishedAt } }, orderBy: { publishedAt: "desc" }, select }),
    prisma.post.findFirst({ where: { ...base, publishedAt: { gt: publishedAt, lte: new Date() } }, orderBy: { publishedAt: "asc" }, select }),
  ]);
  return { older, newer };
}
