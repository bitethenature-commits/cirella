import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorPageView } from "@/components/creator-page/creator-page-view";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { Reveal } from "@/components/reveal";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { getPublicCreator } from "@/lib/public";

type Params = { username: string };
type Search = { preview?: string; embed?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await getPublicCreator(username);
  if (!data) return { title: "Página no encontrada" };
  const { creator, config } = data;
  const title = creator.seoTitle || `${config.displayName}${config.tagline ? ` · ${config.tagline}` : ""}`;
  const description = creator.seoDescription || config.bio || config.headline || `${config.displayName} en ${data.platformName}`;
  const url = `${appUrl()}/${creator.username}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "profile", siteName: data.platformName },
    twitter: { card: "summary_large_image", title, description },
    robots: creator.published ? undefined : { index: false },
  };
}

export default async function CreatorPublicPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { username } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const base = await getPublicCreator(username);
  if (!base) notFound();
  const isOwner = user?.id === base.creator.userId;
  const draft = isOwner && sp.preview === "1";
  const data = draft ? await getPublicCreator(username, true) : base;
  if (!data) notFound();
  if (!data.creator.published && !isOwner) notFound();

  const { creator, config, products } = data;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: config.displayName,
    description: config.tagline || config.bio,
    url: `${appUrl()}/${creator.username}`,
    image: config.avatarUrl ? `${appUrl()}${config.avatarUrl}` : undefined,
    sameAs: Object.values(config.socials).filter((v) => v?.startsWith("http")),
    makesOffer: products.map((p) => ({
      "@type": "Offer",
      name: p.title,
      price: (p.priceCents / 100).toFixed(2),
      priceCurrency: p.currency,
      url: `${appUrl()}/${creator.username}/${p.slug}`,
    })),
  };

  return (
    <>
      {(draft || !creator.published) && isOwner && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-ink px-4 py-2 text-xs text-cream">
          <span>{draft ? "Vista previa del borrador" : "Tu página aún no está publicada"} · solo tú la ves</span>
          <Link href="/panel/pagina" className="font-semibold underline underline-offset-2">
            Volver al editor
          </Link>
        </div>
      )}
      <CreatorPageView
        creatorId={creator.id}
        username={creator.username}
        config={config}
        products={products}
        allowCustom={data.allowCustom}
        showPoweredBy={data.showPoweredBy}
        platformName={data.platformName}
        referralCode={creator.referralCode}
      />
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" disabled={isOwner || sp.embed === "1"} />
      <Reveal />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
