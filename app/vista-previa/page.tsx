import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorPageView } from "@/components/creator-page/creator-page-view";
import { Reveal } from "@/components/reveal";
import { requireCreator } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { getPublicCreator } from "@/lib/public";

/**
 * Vista previa del borrador de la página de la creadora (solo ella la ve). Vive aparte de
 * /[username] porque esa página está cacheada y no puede saber quién la mira. No cuenta visitas.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vista previa", robots: { index: false } };

export default async function DraftPreviewPage() {
  const { creator } = await requireCreator();
  const data = await getPublicCreator(creator.username, true);
  if (!data) notFound();

  return (
    <>
      <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-ink px-4 py-2 text-xs text-cream">
        <span>
          Vista previa del borrador · solo tú la ves{!creator.published && " · tu página aún no está publicada"}
        </span>
        <Link href="/panel/pagina" className="font-semibold underline underline-offset-2">
          Volver al editor
        </Link>
      </div>
      <CreatorPageView
        creatorId={data.creator.id}
        username={data.creator.username}
        config={data.config}
        products={data.products}
        allowCustom={data.allowCustom}
        showPoweredBy={data.showPoweredBy}
        platformName={data.platformName}
        referralCode={data.creator.referralCode}
        sellerName={data.creator.legalName}
        posts={data.posts}
        postCount={data.postCount}
        discountCodes={data.discountCodes}
        personal={data.personal}
        signupsOnly={data.signupsOnly}
        siteOrigin={appUrl()}
      />
      <Reveal />
    </>
  );
}
