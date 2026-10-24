import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hiddenProductSlugs, SitePageView } from "@/components/creator-page/site-page-view";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { Reveal } from "@/components/reveal";
import { appUrl } from "@/lib/env";
import { richToPlain } from "@/lib/rich-text";
import type { SitePageContent } from "@/lib/site-pages";
import { getPublicSitePage } from "@/lib/site-pages.server";

type Params = { username: string; slug: string };

// Dinámica (como la ficha de producto): un bot que pruebe direcciones no llena la caché de páginas,
// y un 404 cuesta una sola consulta. En la web personal también se llega por /<slug> (middleware.ts).
export const dynamic = "force-dynamic";

/** Descripción para buscadores y redes: la escrita a mano, el subtítulo o el principio del primer texto. */
function description(content: SitePageContent): string {
  if (content.seoDescription) return content.seoDescription;
  if (content.subtitle) return content.subtitle.slice(0, 160);
  const text = content.blocks.find((b) => b.kind === "text" && b.body.trim());
  const plain = text && text.kind === "text" ? richToPlain(text.body, text.format).replace(/\s+/g, " ").trim() : "";
  return plain.length > 160 ? `${plain.slice(0, 157).trimEnd()}…` : plain;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, slug } = await params;
  const found = await getPublicSitePage(username, slug);
  if (!found) return { title: "Página no encontrada" };
  const { data, content, url } = found;
  const title = `${content.seoTitle || content.title} · ${data.config.displayName}`;
  const desc = description(content) || undefined;
  const siteName = data.personal ? data.config.displayName : data.platformName;
  const image = content.cover
    ? { url: `${appUrl()}${content.cover.src}`, width: content.cover.width, height: content.cover.height, alt: content.cover.alt || content.title }
    : { url: `${appUrl()}/${data.creator.username}/opengraph-image`, width: 1200, height: 630, alt: data.config.displayName };
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, url, type: "website", siteName, images: [image] },
    twitter: { card: "summary_large_image", title, description: desc, images: [image.url] },
  };
}

/** Página extra publicada de la creadora («Sobre mí», «Preguntas frecuentes»…). */
export default async function SitePagePublic({ params }: { params: Promise<Params> }) {
  const { username, slug } = await params;
  const found = await getPublicSitePage(username, slug);
  if (!found) notFound();
  const { data, content, page, path, url } = found;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: content.title,
    description: description(content) || undefined,
    url,
    dateModified: page.updatedAt.toISOString(),
    image: content.cover ? `${appUrl()}${content.cover.src}` : undefined,
    author: { "@type": "Person", name: data.config.displayName, url: data.personal ? `${appUrl()}/` : `${appUrl()}/${data.creator.username}` },
  };
  return (
    <>
      <SitePageView
        username={data.creator.username}
        config={data.config}
        content={content}
        allowCustom={data.allowCustom}
        personal={data.personal}
        signupsOnly={data.signupsOnly}
        hiddenSlugs={hiddenProductSlugs(data.products, data.signupsOnly)}
        siteOrigin={appUrl()}
        pages={data.pages}
        currentPath={path}
      />
      <TrackOnMount creatorId={data.creator.id} type="PAGE_VIEW" />
      <Reveal />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
