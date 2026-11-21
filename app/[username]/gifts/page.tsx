import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { barePage, hiddenProductSlugs, SitePageView } from "@/components/creator-page/site-page-view";
import { appUrl } from "@/lib/env";
import { nextMoonCircles } from "@/lib/moon-circles";
import { oracleDecksForBlocks } from "@/lib/oracle-decks";
import { GIFTS_SLUG, giftsContent } from "@/lib/site-pages";
import { getPublicSitePage } from "@/lib/site-pages.server";
import { sectionPageData } from "../section-data";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) return { title: "Página no encontrada" };
  const own = await getPublicSitePage(username, GIFTS_SLUG);
  const content = own?.content ?? giftsContent(data.config.contact.email || null);
  const title = `${content.seoTitle || content.title} · ${data.config.displayName}`;
  const description = content.seoDescription || content.subtitle || undefined;
  return { title, description, alternates: { canonical: data.url("gifts") }, openGraph: { title, description, url: data.url("gifts"), siteName: data.siteName } };
}

/**
 * «Gifts»: lo que hace Cirella para regalar (calendarios, manualidades, detalles para amigos o familia).
 * Se edita en Páginas → Gifts; mientras no se publique, sale la de partida (lib/site-pages.ts → giftsContent).
 */
export default async function GiftsPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) notFound();
  const own = await getPublicSitePage(username, GIFTS_SLUG);
  const content = own?.content ?? giftsContent(data.config.contact.email || null);
  const oracleDecks = await oracleDecksForBlocks(data.creator.id, content.blocks);
  return (
    <>
      <SitePageView
        page="gifts"
        username={data.creator.username}
        config={data.config}
        content={content}
        allowCustom={data.allowCustom}
        personal={data.personal}
        signupsOnly={data.signupsOnly}
        hiddenSlugs={hiddenProductSlugs(data.products, data.signupsOnly)}
        siteOrigin={appUrl()}
        pages={data.pages}
        currentPath={data.path("gifts")}
        oracleDecks={oracleDecks}
        moonCircles={nextMoonCircles(data.products)}
        bare={barePage(GIFTS_SLUG)}
      />
      <TrackOnMount creatorId={data.creator.id} type="PAGE_VIEW" />
    </>
  );
}
