import { productPath } from "@/lib/public-paths";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { SiteText } from "@/components/creator-page/site-text";
import { TrackedLink, TrackOnMount } from "@/components/creator-page/tracking";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { orderTiers } from "@/lib/tiers";
import { tierFeatureItems } from "@/lib/tier-features";
import { PortalCircles, PortalFeature, PortalIncludes, PortalPrice, TierPortal, portalButton } from "@/components/creator-page/tier-portal";
import { readTierCard, TIER_CTA_DEFAULT } from "@/lib/tier-card";
import { readTierLook } from "@/lib/tier-look";
import { barePage, hiddenProductSlugs, SitePageView } from "@/components/creator-page/site-page-view";
import { appUrl } from "@/lib/env";
import { nextMoonCircles } from "@/lib/moon-circles";
import { localTx } from "@/lib/i18n/content";
import { oracleDecksForBlocks } from "@/lib/oracle-decks";
import { COMMUNITY_SLUG } from "@/lib/site-pages";
import { getPublicSitePage } from "@/lib/site-pages.server";
import { webTiers } from "@/lib/web-tiers.server";
import { sectionPageData } from "../section-data";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) return { title: (await getT())("Página no encontrada") };
  // Escrita en Mi página (lib/site-pages.ts → COMMUNITY_SLUG): su título y su descripción.
  const own = await getPublicSitePage(username, COMMUNITY_SLUG);
  if (own) {
    const t = `${own.content.seoTitle || own.content.title} · ${data.config.displayName}`;
    const d = own.content.seoDescription || own.content.subtitle || undefined;
    return { title: t, description: d, alternates: { canonical: data.url("comunidad") }, openGraph: { title: t, description: d, url: data.url("comunidad"), siteName: data.siteName } };
  }
  const title = `Comunidad · ${data.config.displayName}`;
  const description = `Los niveles de la comunidad de ${data.config.displayName}: cada uno incluye todo lo del anterior.`;
  return { title, description, alternates: { canonical: data.url("comunidad") }, openGraph: { title, description, url: data.url("comunidad"), siteName: data.siteName } };
}

/**
 * «Comunidad»: los niveles (membresías) uno al lado del otro, de menos a más, con su precio, lo que
 * incluye cada uno («Todo lo de Esencia» en los de arriba, lib/tiers.ts) y el botón para unirse (el
 * checkout de siempre, con su casilla MEMBERSHIP_START).
 */
export default async function ComunidadPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  // Escrita en Mi página (lib/site-pages.ts → COMMUNITY_SLUG): sus secciones y, en la de los niveles, cada nivel.
  const own = await getPublicSitePage(username, COMMUNITY_SLUG);
  if (own) {
    const { data: pub, content } = own;
    const [oracleDecks, tiers] = await Promise.all([
      localTx(pub.creator.id).then((tx) => oracleDecksForBlocks(pub.creator.id, content.blocks, tx)),
      webTiers(pub.creator.id, pub.creator.username, pub.products, { href: pub.personal ? "/" : `/${pub.creator.username}`, texts: pub.config.texts }),
    ]);
    return (
      <>
        <SitePageView
          page="comunidad"
          username={pub.creator.username}
          config={pub.config}
          content={content}
          allowCustom={pub.allowCustom}
          personal={pub.personal}
          signupsOnly={pub.signupsOnly}
          hiddenSlugs={hiddenProductSlugs(pub.products, pub.signupsOnly)}
          siteOrigin={appUrl()}
          pages={pub.pages}
          currentPath={own.path}
          oracleDecks={oracleDecks}
          moonCircles={nextMoonCircles(pub.products)}
          tiers={tiers}
          bare={barePage(COMMUNITY_SLUG)}
        />
        <TrackOnMount creatorId={pub.creator.id} type="PAGE_VIEW" />
      </>
    );
  }
  const data = await sectionPageData(username);
  if (!data) notFound();
  const { creator, config } = data;
  const memberships = data.products.filter((p) => p.type === "MEMBERSHIP");
  const [edges, descriptions] = await Promise.all([
    prisma.productInclusion.findMany({ where: { creatorId: creator.id }, select: { productId: true, includedProductId: true } }),
    prisma.product.findMany({ where: { id: { in: memberships.map((m) => m.id) } }, select: { id: true, description: true, summary: true, pageTexts: true } }),
  ]);
  const tiers = orderTiers(memberships, edges);
  const top = tiers.at(-1)?.tier.id;
  const circles = data.products.filter((p) => p.moonCircle && p.eventStartAt).sort((a, b) => (a.eventStartAt! < b.eventStartAt! ? -1 : 1)).slice(0, 3);
  const descOf = new Map(descriptions.map((d) => [d.id, d]));

  return (
    <CreatorShell page="comunidad" username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:pt-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="cp-eyebrow">
            <SiteText texts={config.texts} k="pg.community.eyebrow" />
          </p>
          <h1 className="cp-display mt-3 text-[2.6rem] leading-[1.05] sm:text-[3.4rem]">
            <SiteText texts={config.texts} k="pg.community.title" />
          </h1>
          <p className="cp-muted mt-4 text-[1.05rem] leading-relaxed">
            <SiteText texts={config.texts} k="pg.community.text" multiline />{" "}
            <SiteText texts={config.texts} k={tiers.length > 1 ? "pg.community.textN" : "pg.community.text1"} multiline />
          </p>
          <div aria-hidden className="mx-auto mt-6 flex max-w-xs items-center gap-3" style={{ color: "var(--c-gold)" }}>
            <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, var(--c-gold))" }} />
            <span className="text-xs">✦</span>
            <span className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, var(--c-gold))" }} />
          </div>
        </div>

        {tiers.length === 0 ? (
          <p className="cp-muted mt-10 text-center">
            <SiteText texts={config.texts} k="pg.community.empty" />
          </p>
        ) : (
          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]" data-tiers>
            {tiers.map(({ tier: t, includesPrevious }, i) => {
              const d = descOf.get(t.id);
              // La carta que dejó en su panel (Comunidad → Cartas) o, si no, lo de su descripción.
              const own = readTierCard(d?.pageTexts);
              const features = own ? own.features : tierFeatureItems(d?.description ?? null, d?.summary ?? t.summary);
              const intro = own ? own.intro || null : ((d?.description ?? "").split("\n").map((l) => l.trim()).find((l) => l && !/^[•\-*✦]\s/.test(l) && !/^incluye:?$/i.test(l)) ?? t.summary);
              const ctaText = own?.cta || TIER_CTA_DEFAULT;
              // La más elegida: el nivel más completo.
              const highlight = tiers.length > 1 && t.id === top;
              const mode = t.accessMode ?? "PAID";
              const href = mode === "PAID" ? `${productPath(creator.username, t, "request")}` : mode === "EXTERNAL" && t.externalUrl ? t.externalUrl : `${productPath(creator.username, t)}`;
              return (
                <TierPortal
                  key={t.id}
                  as="section"
                  level={i}
                  image={t.imageUrl}
                  look={readTierLook(d?.pageTexts)}
                  title={<span id={`nivel-${t.id}`}>{t.title}</span>}
                  intro={intro}
                  badge={highlight ? <SiteText texts={config.texts} k="pg.community.badge" /> : null}
                  className={highlight ? "is-highlight" : ""}
                  style={{ animationDelay: `${i * 0.15}s` }}
                  ariaLabel={t.title}
                  bottom={
                    <TrackedLink
                      href={href}
                      event={{ creatorId: creator.id, type: "PRODUCT_CLICK" as const, productId: t.id }}
                      className={portalButton(highlight)}
                      ariaLabel={mode === "PAID" ? `${ctaText}: ${t.title}` : `Unirme: ${t.title}`}
                    >
                      {mode === "PAID" ? (
                        <>
                          <Mail className="h-4 w-4" /> <Tr s={ctaText} />
                        </>
                      ) : (
                        <><Tr s={"Unirme a"} />{" "}{t.title}</>
                      )}
                    </TrackedLink>
                  }
                >
                  <PortalPrice
                    price={formatPrice(t.sale ? t.sale.priceCents : t.priceCents, t.currency)}
                    interval={t.billingInterval ? (t.billingInterval === "year" ? "año" : "mes") : null}
                    regular={t.sale ? formatPrice(t.sale.regularCents, t.currency) : null}
                    saleLine={t.sale ? `${[t.sale.label, t.sale.endsLabel].filter(Boolean).join(" · ") || "Oferta"} · el primer pago` : null}
                  />
                  {(includesPrevious || features.length > 0) && (
                    <ul className="relative mt-6 w-full space-y-3.5 text-left text-[0.93rem]">
                      {includesPrevious && <PortalIncludes title={includesPrevious.title} />}
                      {features.map((f) => (
                        <PortalFeature key={f.title} f={f} />
                      ))}
                    </ul>
                  )}
                  {t.id === top && circles.length > 0 && tiers.length > 1 && <PortalCircles circles={circles.map((c) => `${c.title} · ${c.eventLabel}`)} />}
                </TierPortal>
              );
            })}
          </div>
        )}

        {circles.length > 0 && (
          <p className="cp-muted mt-10 text-center text-sm">
            <SiteText texts={config.texts} k="pg.community.circles" />{" "}
            <Link href={`${data.homeHref}#lecturas`} className="cp-gold underline underline-offset-4">
              <SiteText texts={config.texts} k="pg.community.circlesLink" />
            </Link>
            .
          </p>
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
