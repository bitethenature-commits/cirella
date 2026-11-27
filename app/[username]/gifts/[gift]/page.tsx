import type { Metadata } from "next";
import { getContentTranslator } from "@/lib/i18n/content";
import { mapTexts } from "@/lib/i18n/content-walk";
import { getLocale } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gift, Mail } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { appUrl } from "@/lib/env";
import { safeHref } from "@/lib/page-config";
import { GIFTS_SLUG, giftCards, giftsContent } from "@/lib/site-pages";
import { getPublicSitePage } from "@/lib/site-pages.server";
import { giftPath, homeFoldPath } from "@/lib/site-sections";
import { sectionPageData } from "../../section-data";
import { getT } from "@/lib/i18n/server";
import { Tr } from "@/lib/i18n/client";

type Params = { username: string; gift: string };

async function load(username: string, slug: string) {
  const data = await sectionPageData(username);
  if (!data) return null;
  const own = await getPublicSitePage(username, GIFTS_SLUG);
  const email = data.config.contact.email || null;
  const content = own?.content ?? giftsContent(email);
  const gift = giftCards(content).find((c) => c.slug === slug);
  return gift ? { data, gift, email, pageTitle: content.title || "Gifts" } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, gift: slug } = await params;
  const found = await load(username, slug);
  if (!found) return { title: (await getT())("Página no encontrada") };
  const { data, gift } = found;
  const title = `${gift.title} · ${data.config.displayName}`;
  const description = gift.text || undefined;
  const url = `${appUrl()}${giftPath(data.creator.username, gift.slug, data.personal)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: data.siteName, ...(gift.image ? { images: [gift.image.src] } : {}) },
  };
}

/**
 * Un regalo de «Gifts» en su página: la foto en grande, el nombre, el precio en dorado, lo que es y el botón
 * para pedirlo (el enlace de su tarjeta o, si no tiene, un email a la creadora). Sale de las tarjetas de la
 * página «Gifts» (Páginas → Gifts); su dirección es la de su título (lib/site-pages.ts → giftCards).
 */
export default async function GiftPage({ params }: { params: Promise<Params> }) {
  const { username, gift: slug } = await params;
  const found = await load(username, slug);
  if (!found) notFound();
  const { data, gift, email, pageTitle } = found;
  const { creator, config } = data;
  const t = await getT();
  const order = gift.href?.trim() ? safeHref(gift.href) : email ? `mailto:${email}?subject=${encodeURIComponent(`${pageTitle}: ${gift.title}`)}` : null;
  const external = !!order && !order.startsWith("/") && !order.startsWith("mailto:");
  return (
    <CreatorShell page="gifts" username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:pt-12">
        <Link href={homeFoldPath(creator.username, "gifts", data.personal)} className="cp-muted inline-flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft className="h-4 w-4" /> <Tr s={pageTitle} />
        </Link>
        <article className="cp-card mt-5 overflow-hidden">
          {gift.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gift.image.src} alt={gift.image.alt || gift.title} className="cp-photo-bubble cp-photo-in block aspect-[4/3] w-full object-cover" decoding="async" />
          ) : (
            <div className="cp-photo-bubble grid aspect-[4/3] place-items-center" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 40%, #000), color-mix(in oklab, var(--c-gold) 30%, #000))" }}>
              <Gift className="h-12 w-12" strokeWidth={1.1} style={{ color: "var(--c-gold)" }} aria-hidden />
            </div>
          )}
          <div className="p-5 sm:p-7">
            <p className="cp-eyebrow"><Tr s={pageTitle} /></p>
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h1 className="cp-display text-[2rem] leading-tight sm:text-[2.4rem]">{gift.title}</h1>
              {gift.price?.trim() && <strong className="cp-gold cp-display shrink-0 text-[1.6rem]">{gift.price}</strong>}
            </div>
            {gift.text && <p className="cp-muted mt-3 whitespace-pre-line text-[0.98rem] leading-relaxed"><Tr s={gift.text} /></p>}
            {order && (
              <a href={order} className="cp-btn mt-6 h-12 w-full text-base sm:w-auto sm:px-8" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {order.startsWith("mailto:") ? <Mail className="h-4 w-4" /> : <Gift className="h-4 w-4" strokeWidth={1.4} />} {t("Lo quiero")}
              </a>
            )}
          </div>
        </article>
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
