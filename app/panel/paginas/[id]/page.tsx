import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hiddenProductSlugs } from "@/components/creator-page/site-page-view";
import { requireCreator } from "@/lib/auth";
import { appHost, appUrl } from "@/lib/env";
import { nextMoonCircles } from "@/lib/moon-circles";
import { getPublishedOracleDecks } from "@/lib/oracle-decks";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode } from "@/lib/site-mode";
import { readSitePageContent } from "@/lib/site-pages";
import { sitePageLinkTargets } from "@/lib/site-pages.server";
import { tenantDb } from "@/lib/tenant";
import { SitePageEditor } from "./page-editor";

export const metadata: Metadata = { title: "Editar página" };

export default async function EditSitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ despublicada?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const page = await tenantDb(creator.id).sitePage.findFirst({ where: { id } });
  if (!page) notFound();
  const personal = isPersonalMode();
  const [data, linkTargets, oracleDecks] = await Promise.all([getPublicCreator(creator.username, true), sitePageLinkTargets(creator.id, creator.username, personal), getPublishedOracleDecks(creator.id)]);
  if (!data) notFound();
  const published = page.published ? readSitePageContent(page.published, page.title) : null;
  return (
    <SitePageEditor
      id={page.id}
      initial={readSitePageContent(page.draft, page.title)}
      publishedJson={page.status === "PUBLISHED" && published ? JSON.stringify(published) : ""}
      everPublished={!!page.published}
      status={page.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
      slug={page.slug}
      publishedSlug={page.status === "PUBLISHED" ? page.slug : null}
      showInNav={page.showInNav}
      username={creator.username}
      personal={personal}
      host={appHost()}
      origin={appUrl()}
      linkTargets={linkTargets.filter((t) => !t.href.endsWith(`/${page.slug}`))}
      config={{ displayName: data.config.displayName, avatarUrl: data.config.avatarUrl, template: data.config.template, theme: data.config.theme }}
      allowCustom={data.allowCustom}
      signupsOnly={data.signupsOnly}
      hiddenSlugs={[...hiddenProductSlugs(data.products, data.signupsOnly)]}
      pages={data.pages}
      notice={sp.despublicada ? "Página despublicada: su dirección ya no se ve" : null}
      oracleDecks={oracleDecks}
      moonCircles={nextMoonCircles(data.products)}
    />
  );
}
