import type { Metadata } from "next";
import { hiddenProductSlugs } from "@/components/creator-page/site-page-view";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CODE_STATE_LABEL, codeState, dateKeyFromExpiry, readCodePhotos, readCodeRecommendations } from "@/lib/discount-codes";
import { appHost, appUrl } from "@/lib/env";
import { nextMoonCircles } from "@/lib/moon-circles";
import { getPublishedOracleDecks } from "@/lib/oracle-decks";
import { readPageConfig } from "@/lib/page-config";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode } from "@/lib/site-mode";
import { readSitePageContent, sitePagePath, sitePageState } from "@/lib/site-pages";
import { sitePageLinkTargets } from "@/lib/site-pages.server";
import { tenantDb } from "@/lib/tenant";
import { HomeCanva, type CanvaCode } from "./home-canva";
import { PageCanva } from "./page-canva";

export const metadata: Metadata = { title: "Canva" };

/** El modo Canva: la web de la dueña con todo editable encima (la portada o una página extra con ?pagina=). */
export default async function CanvaPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { pagina } = await searchParams;
  const { creator } = await requireCreator();
  const personal = isPersonalMode();
  const db = tenantDb(creator.id);
  const [data, pages, oracleDecks, linkTargets, allCodes] = await Promise.all([
    getPublicCreator(creator.username, true),
    db.sitePage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    getPublishedOracleDecks(creator.id),
    sitePageLinkTargets(creator.id, creator.username, personal),
    // Todos los códigos (también los ocultos y caducados), para cambiarlos en su ventanita.
    db.discountCode.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  const codes: CanvaCode[] = allCodes.map((c) => ({
    id: c.id,
    brand: c.brand,
    code: c.code,
    description: c.description ?? "",
    url: c.url,
    imageUrl: c.imageUrl,
    images: readCodePhotos(c.images),
    recommendations: readCodeRecommendations(c.recommendations),
    expiresOn: dateKeyFromExpiry(c.expiresAt, creator.timezone),
    active: c.active,
    stateLabel: CODE_STATE_LABEL[codeState(c)],
  }));
  const list = pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug, status: p.status }));
  const page = pagina ? pages.find((p) => p.slug === pagina) : undefined;

  if (page && data) {
    return (
      <PageCanva
        id={page.id}
        initial={readSitePageContent(page.draft, page.title)}
        status={page.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
        slug={page.slug}
        showInNav={page.showInNav}
        username={creator.username}
        personal={personal}
        host={appHost()}
        origin={appUrl()}
        linkTargets={linkTargets.filter((t) => !t.href.endsWith(`/${page.slug}`))}
        config={{ displayName: data.config.displayName, avatarUrl: data.config.avatarUrl, theme: data.config.theme, pageThemes: data.config.pageThemes, newsletter: data.config.newsletter, texts: data.config.texts }}
        allowCustom={data.allowCustom}
        signupsOnly={data.signupsOnly}
        hiddenSlugs={[...hiddenProductSlugs(data.products, data.signupsOnly)]}
        navPages={data.pages}
        pages={list}
        oracleDecks={oracleDecks}
        moonCircles={nextMoonCircles(data.products)}
        viewHref={sitePagePath(creator.username, page.slug, personal)}
      />
    );
  }

  const draft = readPageConfig(creator.pageDraft, creator.displayName);
  const published = creator.pagePublished ? readPageConfig(creator.pagePublished, creator.displayName) : null;
  return (
    <HomeCanva
      pages={list}
      sellerName={data?.creator.legalName ?? null}
      viewHref={personal ? "/" : `/${creator.username}`}
      codes={codes}
      editor={{
        initial: draft,
        publishedJson: published ? JSON.stringify(published) : "",
        creatorId: creator.id,
        username: creator.username,
        products: data?.products ?? [],
        posts: data?.posts ?? [],
        postCount: data?.postCount ?? 0,
        news: data?.news ?? [],
        portal: data?.portal ?? [],
        gifts: data?.gifts,
        discountCodes: data?.discountCodes ?? [],
        personal: data?.personal ?? false,
        signupsOnly: data?.signupsOnly ?? false,
        siteOrigin: appUrl(),
        allowCustom: data?.features.customDesign ?? false,
        allowRemoveBranding: data?.features.removeBranding ?? false,
        platformName: data?.platformName ?? "Cirella",
        referralCode: creator.referralCode,
        pages: pages.map((p) => ({ id: p.id, title: p.title, slug: p.slug, state: sitePageState(p) })),
        linkTargets,
        oracleDecks,
      }}
    />
  );
}
