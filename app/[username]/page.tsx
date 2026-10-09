import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorPageView } from "@/components/creator-page/creator-page-view";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { Reveal } from "@/components/reveal";
import { appUrl } from "@/lib/env";
import { getPublicCreator } from "@/lib/public";

type Params = { username: string };

// Página cacheada (ISR, 60 s): no leer cookies ni searchParams aquí; lo personal va en
// /vista-previa o en componentes cliente. Lo que cambia la página llama a revalidatePath.
export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams(): Params[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await getPublicCreator(username);
  if (!data || !data.creator.published) return { title: "Página no encontrada" };
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
  };
}

export default async function CreatorPublicPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await getPublicCreator(username);
  if (!data || !data.creator.published) notFound();

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
      {/* Las visitas de la propia creadora se descartan en /api/track; las de ?embed=1, en el navegador. */}
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
      <Reveal />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
