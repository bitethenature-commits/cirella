import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorPageView } from "@/components/creator-page/creator-page-view";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { Reveal } from "@/components/reveal";
import { appUrl } from "@/lib/env";
import { oracleDecksForBlocks } from "@/lib/oracle-decks";
import { getPublicCreator } from "@/lib/public";
import { isPublicUsernameAllowed } from "@/lib/personal-routing";
import { isPersonalMode, ownerUsername } from "@/lib/site-mode";

/**
 * La página pública de una creadora, en un único sitio para sus dos direcciones:
 *   · /<usuaria> (app/[username]/page.tsx), en la plataforma;
 *   · «/» (app/page.tsx), en modo personal: la página de la dueña es la portada de la web.
 * En modo personal la dirección canónica de la dueña es la raíz, y no hay «Powered by»; las demás
 * usuarias no existen. Se comprueba aquí además de en el layout: Next pinta la página a la vez que
 * el layout, y sin esto los datos de otra creadora viajarían dentro de la respuesta del 404.
 */

/** Datos públicos de la página, o null si no existe o (modo personal) no es la dueña. */
async function publicPageData(username: string) {
  if (!isPublicUsernameAllowed(username, ownerUsername())) return null;
  const data = await getPublicCreator(username);
  return data?.creator.published ? data : null;
}

/** Dirección canónica de la página de una creadora (la raíz si es la dueña en modo personal). */
export function creatorPageUrl(username: string) {
  return isPersonalMode() && ownerUsername() === username ? `${appUrl()}/` : `${appUrl()}/${username}`;
}

export async function creatorPageMetadata(username: string, opts: { root?: boolean } = {}): Promise<Metadata> {
  const data = await publicPageData(username);
  if (!data) return { title: "Página no encontrada" };
  const { creator, config } = data;
  const personal = isPersonalMode();
  const siteName = personal ? config.displayName : data.platformName;
  const title = creator.seoTitle || `${config.displayName}${config.tagline ? ` · ${config.tagline}` : ""}`;
  const description = creator.seoDescription || config.bio || config.headline || (personal ? config.displayName : `${config.displayName} en ${data.platformName}`);
  const url = creatorPageUrl(creator.username);
  const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "profile", siteName },
    twitter: { card: "summary_large_image", title, description },
  };
  if (opts.root) {
    // En la raíz no aplican el favicon ni la imagen para redes de /[username]: se apuntan a mano
    // (son las mismas rutas generadas de la dueña).
    const image = { url: `/${creator.username}/opengraph-image`, width: 1200, height: 630, alt: config.displayName };
    metadata.icons = { icon: [{ url: `/${creator.username}/icon`, type: "image/png", sizes: "64x64" }] };
    metadata.openGraph = { ...metadata.openGraph, images: [image] };
    metadata.twitter = { ...metadata.twitter, images: [image.url] };
  }
  return metadata;
}

export async function CreatorPublicPage({ username }: { username: string }) {
  const data = await publicPageData(username);
  if (!data) notFound();

  const { creator, config, products } = data;
  const personal = isPersonalMode();
  // Las barajas propias de sus bloques «Oráculo» (la de serie no necesita nada).
  const oracleDecks = await oracleDecksForBlocks(creator.id, config.blocks ?? []);
  const url = creatorPageUrl(creator.username);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: config.displayName,
    description: config.tagline || config.bio,
    url,
    image: config.avatarUrl ? `${appUrl()}${config.avatarUrl}` : undefined,
    sameAs: Object.values(config.socials).filter((v) => v?.startsWith("http")),
    // Lo mismo que enseñan las tarjetas: en la web personal sin cobros no se ofrece nada de pago aquí.
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
        showPoweredBy={data.showPoweredBy && !personal}
        platformName={data.platformName}
        referralCode={creator.referralCode}
        sellerName={creator.legalName}
        posts={data.posts}
        postCount={data.postCount}
        news={data.news}
        portal={data.portal}
        discountCodes={data.discountCodes}
        personal={personal}
        signupsOnly={data.signupsOnly}
        siteOrigin={appUrl()}
        pages={data.pages}
        oracleDecks={oracleDecks}
      />
      {/* Las visitas de la propia creadora se descartan en /api/track; las de ?embed=1, en el navegador. */}
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
      <Reveal />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
