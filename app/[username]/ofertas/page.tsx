import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { CfgText, SiteText } from "@/components/creator-page/site-text";
import { HomeRows, PercentIcon } from "@/components/creator-page/home-rows";
import { offerRow } from "@/components/creator-page/offer-rows";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { sectionTitle } from "@/lib/page-config";
import { sectionPageData } from "../section-data";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) return { title: "Página no encontrada" };
  const title = `${sectionTitle(data.config, "offers")} · ${data.config.displayName}`;
  const description = `Las ofertas de ${data.config.displayName} que están activas ahora.`;
  return { title, description, alternates: { canonical: data.url("ofertas") }, openGraph: { title, description, url: data.url("ofertas"), siteName: data.siteName } };
}

/**
 * «Ofertas»: todas las ofertas activas, como la página de «Actualidades». Cuando una oferta termina, deja de
 * salir sola (PublicProduct.sale es null fuera de sus fechas).
 */
export default async function OfertasPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) notFound();
  const { creator, config } = data;
  const onSale = data.products.filter((p) => p.sale);
  return (
    <CreatorShell page="ofertas" username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:pt-12">
        <div className="flex items-center gap-4">
          <span className="cp-emblem grid h-14 w-14 shrink-0 place-items-center rounded-full" aria-hidden>
            <PercentIcon />
          </span>
          <div>
            <p className="cp-eyebrow">
              <SiteText texts={config.texts} k="pg.offers.eyebrow" />
            </p>
            <h1 className="cp-display mt-1 text-[2.6rem] leading-tight">
              <CfgText path="sections.offers.title">{sectionTitle(config, "offers")}</CfgText>
            </h1>
          </div>
        </div>
        {onSale.length === 0 ? (
          <div className="cp-card mt-8 p-6 text-center">
            <p className="cp-muted">
              <SiteText texts={config.texts} k="pg.offers.empty" />
            </p>
            <Link href={data.homeHref} className="cp-btn-ghost mt-4">
              <ArrowLeft className="h-4 w-4" /> <SiteText texts={config.texts} k="pg.back" />
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <HomeRows fallbackImage={config.coverUrl ?? config.avatarUrl ?? null} rows={onSale.map((p) => offerRow(p, creator.username))} />
          </div>
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
