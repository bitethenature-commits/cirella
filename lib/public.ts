import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { readPageConfig } from "./page-config";
import { canSellType, planFeatures } from "./plans";
import { getSettings } from "./settings";
import type { ProductType } from "./types";
import type { PublicProduct } from "@/components/creator-page/creator-page-view";

/** Datos públicos de una creadora. `draft` = vista previa del borrador (solo propietaria). */
export const getPublicCreator = cache(async (username: string, draft = false) => {
  const creator = await prisma.creator.findUnique({
    where: { username: username.toLowerCase() },
    include: { plan: true, user: { select: { status: true } } },
  });
  if (!creator || creator.status !== "ACTIVE" || creator.user.status !== "ACTIVE") return null;
  const features = planFeatures(creator.plan);
  const raw = draft ? creator.pageDraft : (creator.pagePublished ?? creator.pageDraft);
  const config = readPageConfig(raw, creator.displayName);
  const rows = await prisma.product.findMany({
    where: { creatorId: creator.id, status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { lessons: true } } },
  });
  const products: PublicProduct[] = rows
    .filter((p) => canSellType(creator.plan, p.type as ProductType))
    .map((p) => ({
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
            ? `${p._count.lessons} lecciones`
            : null,
    }));
  const settings = await getSettings();
  return {
    creator,
    config,
    products,
    features,
    allowCustom: features.customDesign,
    showPoweredBy: !(features.removeBranding && config.hidePoweredBy),
    platformName: settings.platformName,
  };
});
