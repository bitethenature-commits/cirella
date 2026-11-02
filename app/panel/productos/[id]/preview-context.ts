import "server-only";
import type { Creator, Plan } from "@prisma/client";
import { seatsTaken } from "@/lib/booking";
import { visibleMemberPostWhere } from "@/lib/community-rules";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { getPlatformIssuer } from "@/lib/invoices/issuer";
import { legalIdentityComplete, sellerStatement } from "@/lib/legal";
import { readPageConfig, sectionTitle, type SectionKey } from "@/lib/page-config";
import { hasPaymentProvider } from "@/lib/payments";
import { planFeatures } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { isPersonalMode, ownerUsername } from "@/lib/site-mode";
import { sitePagePath } from "@/lib/site-pages";
import { decideTax, vatIncluded } from "@/lib/tax";
import { getTaxMode } from "@/lib/tax/server";
import type { ProductType } from "@/lib/types";
import type { ProductPreviewContext } from "./product-preview";

const SECTION_OF: Record<ProductType, SectionKey> = { DIGITAL: "products", SESSION: "sessions", COURSE: "courses", MEMBERSHIP: "memberships" };

type PreviewProduct = {
  id: string;
  creatorId: string;
  type: string;
  files: { id: string; name: string; kind: string; postId: string | null }[];
  modules: { id: string; title: string; lessons: { id: string; title: string; durationMin: number | null; parts: { kind: string; file: { kind: string } | null }[] }[] }[];
  includes: { includedProduct: { id: string; title: string; slug: string; status: string; creatorId: string; _count: { lessons: number } } }[];
};

/**
 * Lo que la vista previa en vivo de la ficha necesita además del formulario, con las mismas reglas
 * que la página pública (lib/public.ts y app/[username]/[slug]/page.tsx): su diseño publicado, el IVA
 * y quién vende, las plazas ocupadas y lo que el producto ya tiene. Se calcula una vez por carga.
 */
export async function productPreviewContext(creator: Creator & { plan: Plan }, product: PreviewProduct, type: ProductType): Promise<ProductPreviewContext> {
  const personal = isPersonalMode() && ownerUsername() === creator.username;
  const signupsOnly = personal && !hasPaymentProvider();
  const config = readPageConfig(creator.pagePublished ?? creator.pageDraft, creator.displayName);
  const [taxMode, settings, pages, taken, posts] = await Promise.all([
    getTaxMode(),
    getSettings(),
    prisma.sitePage.findMany({
      where: { creatorId: creator.id, status: "PUBLISHED", showInNav: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { slug: true, title: true, publishedTitle: true },
    }),
    type === "SESSION" ? seatsTaken(prisma, product.id) : Promise.resolve(0),
    type === "MEMBERSHIP"
      ? prisma.membershipPost.findMany({ where: { productId: product.id, ...visibleMemberPostWhere(new Date()) }, orderBy: { publishedAt: "desc" }, take: 3, select: { id: true, title: true, publishedAt: true } })
      : Promise.resolve([]),
  ]);
  const taxCreator = { country: creator.legalCountry, vatStatus: creator.vatStatus, vatExemptionNote: creator.vatExemptionNote };
  const issuer = await getPlatformIssuer();
  const taxFor = (deliveryMode: "AUTOMATIC" | "PERSONAL") => {
    const card = decideTax({ mode: taxMode, productType: type, deliveryMode, buyerCountry: "ES", creator: taxCreator });
    const seller = decideTax({ mode: taxMode, productType: type, deliveryMode, buyerCountry: null, creator: taxCreator }).seller;
    const s = sellerStatement(seller, { ...creator, displayName: config.displayName }, seller === "PLATFORM" ? issuer : null);
    return { vatIncluded: vatIncluded(card), seller: { line: s.line, name: s.name, named: !!creator.legalName || s.platformSells } };
  };
  return {
    username: creator.username,
    timeZone: creator.timezone,
    config: { displayName: config.displayName, avatarUrl: config.avatarUrl, template: config.template, theme: config.theme, newsletter: config.newsletter },
    allowCustom: personal || planFeatures(creator.plan).customDesign,
    personal,
    signupsOnly,
    pages: pages.map((p) => ({ href: sitePagePath(creator.username, p.slug, personal), title: p.publishedTitle || p.title })),
    sectionTitle: sectionTitle(config, SECTION_OF[type]),
    offersTitle: sectionTitle(config, "offers"),
    testimonial: config.testimonials[0] ? { quote: config.testimonials[0].quote, author: config.testimonials[0].author } : null,
    tax: { AUTOMATIC: taxFor("AUTOMATIC"), PERSONAL: taxFor("PERSONAL") },
    seatsTaken: taken,
    claim: {
      legalComplete: legalIdentityComplete(creator),
      responsible: creator.legalName || config.displayName,
      processorName: isPersonalMode() ? null : settings.platformName,
      demo: isDemoMode(),
    },
    // Como la ficha pública: sin los adjuntos de las publicaciones de la comunidad.
    files: product.files.filter((f) => !f.postId).map((f) => ({ id: f.id, name: f.name, kind: f.kind })),
    modules: product.modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, durationMin: l.durationMin, parts: l.parts.map((p) => ({ kind: p.kind, file: p.file })) })),
    })),
    includes: product.includes
      .map((i) => i.includedProduct)
      .filter((ip) => ip.status !== "ARCHIVED" && ip.creatorId === product.creatorId)
      .map((ip) => ({ id: ip.id, title: ip.title, slug: ip.slug, status: ip.status, lessons: ip._count.lessons })),
    posts,
  };
}
