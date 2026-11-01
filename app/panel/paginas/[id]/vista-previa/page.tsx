import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hiddenProductSlugs, SitePageView } from "@/components/creator-page/site-page-view";
import { requireCreator } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { nextMoonCircles } from "@/lib/moon-circles";
import { oracleDecksForBlocks } from "@/lib/oracle-decks";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode } from "@/lib/site-mode";
import { readSitePageContent, sitePagePath } from "@/lib/site-pages";
import { tenantDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vista previa", robots: { index: false } };

/** Vista previa del borrador de una página extra, con el diseño de la web. Solo la dueña. */
export default async function SitePagePreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const [page, data] = await Promise.all([tenantDb(creator.id).sitePage.findFirst({ where: { id } }), getPublicCreator(creator.username, true)]);
  if (!page || !data) notFound();
  const content = readSitePageContent(page.draft, page.title);
  const oracleDecks = await oracleDecksForBlocks(creator.id, content.blocks);
  return (
    <>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-center text-xs text-cream">
        <span>Vista previa del borrador · solo tú la ves</span>
        <Link href={`/panel/paginas/${page.id}`} className="font-semibold underline underline-offset-2">
          Volver a editar
        </Link>
      </div>
      <SitePageView
        username={creator.username}
        config={data.config}
        content={content}
        allowCustom={data.allowCustom}
        personal={data.personal}
        signupsOnly={data.signupsOnly}
        hiddenSlugs={hiddenProductSlugs(data.products, data.signupsOnly)}
        siteOrigin={appUrl()}
        pages={data.pages}
        currentPath={sitePagePath(creator.username, page.slug, isPersonalMode())}
        back={false}
        oracleDecks={oracleDecks}
        moonCircles={nextMoonCircles(data.products)}
      />
    </>
  );
}
