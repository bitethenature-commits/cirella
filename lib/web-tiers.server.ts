import "server-only";
import type { PublicProduct } from "@/components/creator-page/creator-page-view";
import type { WebTiers } from "./web-tiers";
import { prisma } from "./db";
import { formatPrice } from "./money";
import { siteText, type SiteTexts } from "./site-texts";
import { defaultEmblem, readTierCard, readTierEmblem, TIER_CTA_DEFAULT } from "./tier-card";
import { readTierLook } from "./tier-look";
import { tierFeatureItems } from "./tier-features";
import { orderTiers } from "./tiers";

/**
 * Los niveles de la comunidad de una creadora (sus membresías publicadas), de menos a más, con todo lo que enseña su
 * portal: el precio (y la oferta), la frase, lo que incluye, el botón, el icono y «Todo lo de…». La carta que dejó
 * (lib/tier-card.ts) o, si no, lo de su descripción. Lo usan la página Hacerte miembro y Mi página.
 * `home`: la dirección de su portada (para «Apúntate a un día suelto») y sus textos fijos.
 */
export async function webTiers(creatorId: string, username: string, products: PublicProduct[], home: { href: string; texts?: SiteTexts }): Promise<WebTiers> {
  const memberships = products.filter((p) => p.type === "MEMBERSHIP");
  const circles = products
    .filter((p) => p.moonCircle && p.eventStartAt)
    .sort((a, b) => (a.eventStartAt! < b.eventStartAt! ? -1 : 1))
    .slice(0, 3)
    .map((c) => `${c.title} · ${c.eventLabel}`);
  const note = circles.length ? { text: siteText(home.texts, "pg.community.circles"), link: siteText(home.texts, "pg.community.circlesLink"), href: `${home.href}#lecturas` } : null;
  const empty = siteText(home.texts, "pg.community.empty");
  if (!memberships.length) return { creatorId, tiers: [], circles, note, empty };
  const [edges, rows] = await Promise.all([
    prisma.productInclusion.findMany({ where: { creatorId }, select: { productId: true, includedProductId: true } }),
    prisma.product.findMany({ where: { creatorId, id: { in: memberships.map((m) => m.id) } }, select: { id: true, description: true, summary: true, pageTexts: true } }),
  ]);
  const ordered = orderTiers(memberships, edges);
  const top = ordered.at(-1)?.tier.id;
  const rowOf = new Map(rows.map((d) => [d.id, d]));
  return {
    creatorId,
    empty,
    circles,
    note,
    tiers: ordered.map(({ tier: t, includesPrevious }, i) => {
      const d = rowOf.get(t.id);
      const own = readTierCard(d?.pageTexts);
      const features = own ? own.features : tierFeatureItems(d?.description ?? null, d?.summary ?? t.summary);
      const intro = own
        ? own.intro
        : ((d?.description ?? "")
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l && !/^[•\-*✦]\s/.test(l) && !/^incluye:?$/i.test(l)) ?? t.summary ?? "");
      const mode = t.accessMode ?? "PAID";
      const price = t.sale ? t.sale.priceCents : t.priceCents;
      return {
        id: t.id,
        slug: t.slug,
        title: t.title,
        imageUrl: t.imageUrl,
        price: formatPrice(price, t.currency),
        priceInput: String(t.priceCents / 100).replace(".", ","),
        currency: t.currency,
        interval: t.billingInterval ? (t.billingInterval === "year" ? "año" : "mes") : null,
        regular: t.sale ? formatPrice(t.sale.regularCents, t.currency) : null,
        saleLine: t.sale ? `${[t.sale.label, t.sale.endsLabel].filter(Boolean).join(" · ") || "Oferta"} · el primer pago` : null,
        intro,
        features,
        cta: own?.cta || TIER_CTA_DEFAULT,
        area: own?.area ?? "",
        paid: mode === "PAID",
        href: mode === "PAID" ? `/${username}/${t.slug}/solicitar` : mode === "EXTERNAL" && t.externalUrl ? t.externalUrl : `/${username}/${t.slug}`,
        includesPrevious: includesPrevious?.title ?? null,
        highlight: ordered.length > 1 && t.id === top,
        level: i,
        emblem: readTierEmblem(d?.pageTexts) ?? defaultEmblem(i),
        look: readTierLook(d?.pageTexts),
      };
    }),
  };
}
