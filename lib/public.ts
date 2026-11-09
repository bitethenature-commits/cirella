import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { expiryLabel, readCodePhotos, readCodeRecommendations, visibleCodeWhere } from "./discount-codes";
import { readPageConfig } from "./page-config";
import { planFeatures, type PlanFeatures } from "./plans";
import { POSTS_ON_PAGE, POSTS_PER_PAGE, postDateBadge, postExcerpt, publicPostWhere, readPostMedia } from "./posts";
import { publicPortalItem, type PublicPortalItem } from "./portal-rules";
import { toPublicProduct } from "./product-view";
import { isPublicUsernameAllowed } from "./personal-routing";
import { hasPaymentProvider } from "./payments";
import { getSettings } from "./settings";
import { isPersonalMode, ownerUsername } from "./site-mode";
import { sitePagePath } from "./site-pages";
import { formatDate } from "./tz";
import { PRODUCT_TYPES, type ProductType } from "./types";
import type { PublicDiscountCode, PublicPost, PublicProduct } from "@/components/creator-page/creator-page-view";
import { webNews } from "./web-news";

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
  const [rows, postRows, postCount, codeRows, settings, pageRows, portalRows] = await Promise.all([
    prisma.product.findMany({
      where: { creatorId: creator.id, status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { lessons: { where: { published: true } } } } },
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
    // Páginas extra publicadas que salen en el pie (solo título y dirección: nunca el contenido).
    prisma.sitePage.findMany({
      where: { creatorId: creator.id, status: "PUBLISHED", showInNav: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { slug: true, title: true, publishedTitle: true },
    }),
    // Portal de Noticias: solo lo que se puede enseñar bloqueado (la página está cacheada; lo
    // desbloqueado lo pide el navegador a /api/portal con su sesión).
    prisma.portalItem.findMany({
      where: { creatorId: creator.id, status: "PUBLISHED" },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);
  const products: PublicProduct[] = rows
    .filter((p) => features.productTypes.includes(p.type as ProductType))
    // Un taller ya celebrado no se ofrece en la página.
    .filter((p) => !(p.type === "SESSION" && p.groupSession && (!p.eventStartAt || p.eventStartAt <= now)))
    .map((p) =>
      toPublicProduct(p, {
        lessons: p._count.lessons,
        timeZone: creator.timezone,
        now,
        updatedAt: p.updatedAt,
      }),
    );
  const posts = postRows.map((p) => toPublicPost(p, creator.timezone));
  // «Actualidades»: lo que se va subiendo a la web (lib/web-news.ts).
  const news = await webNews({ creatorId: creator.id, username: creator.username, publicProductIds: products.map((p) => p.id), codesHref: "#codigos", timeZone: creator.timezone });
  const portal: PublicPortalItem[] = portalRows.map((i) => publicPortalItem(i, false, creator.timezone));
  const discountCodes: PublicDiscountCode[] = codeRows.map((c) => ({
    id: c.id,
    brand: c.brand,
    code: c.code,
    description: c.description,
    url: c.url,
    imageUrl: c.imageUrl,
    photos: readCodePhotos(c.images),
    recommendations: readCodeRecommendations(c.recommendations),
    expiresLabel: expiryLabel(c.expiresAt, creator.timezone),
  }));
  return {
    creator,
    config,
    products,
    /** Las últimas publicaciones (sección «Actualidades») y cuántas hay en total. */
    posts,
    postCount,
    /** «Actualidades»: lo nuevo de la web, de lo más nuevo a lo más antiguo. */
    news,
    /** Portal de Noticias, siempre bloqueado aquí (página cacheada). */
    portal,
    discountCodes,
    /** Páginas extra publicadas del pie de la web («Sobre mí», «Preguntas frecuentes»…). */
    pages: pageRows.map((p) => ({ href: sitePagePath(creator.username, p.slug, personal), title: p.publishedTitle || p.title })),
    features,
    personal,
    signupsOnly,
    allowCustom: features.customDesign,
    // Web personal: nunca «Powered by».
    showPoweredBy: !personal && !(features.removeBranding && config.hidePoweredBy),
    platformName: settings.platformName,
  };
});

const POST_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  bodyFormat: true,
  imageUrl: true,
  publishedAt: true,
  mediaKind: true,
  media: true,
  ctaLabel: true,
  ctaUrl: true,
  ctaCode: true,
} as const;

function toPublicPost(
  p: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    body: string;
    bodyFormat?: string | null;
    imageUrl: string | null;
    publishedAt: Date | null;
    mediaKind?: string | null;
    media?: unknown;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    ctaCode?: string | null;
  },
  timeZone: string,
): PublicPost {
  const publishedAt = p.publishedAt ?? new Date(0);
  const media = readPostMedia(p.mediaKind, p.media);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: postExcerpt(p),
    imageUrl: p.imageUrl ?? (media && "poster" in media ? (media.poster ?? null) : null),
    publishedAt,
    dateLabel: formatDate(publishedAt, { day: "numeric", month: "long", year: "numeric" }, timeZone),
    dateBadge: postDateBadge(publishedAt, timeZone),
    mediaKind: media?.kind ?? null,
    cta: p.ctaLabel && p.ctaUrl ? { label: p.ctaLabel, url: p.ctaUrl, code: null } : null,
  };
}

/** Lista de publicaciones visibles de una creadora (/<usuaria>/actualidades), paginada. */
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
