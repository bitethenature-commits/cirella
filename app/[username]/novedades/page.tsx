import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { imageSrcSet } from "@/lib/media-url";
import { postPath } from "@/lib/posts";
import { getPublicPostList } from "@/lib/public";
import { novedadesData } from "./data";

type Params = { username: string };
type Search = { pagina?: string };

const pageOf = (raw?: string) => Math.max(1, Math.min(1000, Number.parseInt(raw ?? "1", 10) || 1));

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { username } = await params;
  const page = pageOf((await searchParams).pagina);
  const data = await novedadesData(username);
  if (!data) return { title: "Página no encontrada" };
  const title = `Novedades · ${data.config.displayName}`;
  const description = `Las últimas publicaciones de ${data.config.displayName}.`;
  const url = page > 1 ? `${data.listUrl}?pagina=${page}` : data.listUrl;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: data.siteName, images: [{ url: data.ogImageUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [data.ogImageUrl] },
  };
}

/** Todas las publicaciones de una creadora, de la más reciente a la más antigua. */
export default async function NovedadesPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { username } = await params;
  const page = pageOf((await searchParams).pagina);
  const data = await novedadesData(username);
  if (!data) notFound();
  const { creator, config } = data;
  const { posts, pages } = await getPublicPostList(creator.id, creator.timezone, page);
  if (page > pages) notFound();

  return (
    <CreatorShell username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-2xl px-4 pb-10 pt-8 sm:pt-12">
        <p className="cp-eyebrow">{config.displayName}</p>
        <h1 className="cp-display mt-2 text-[2.6rem] leading-tight">Novedades</h1>

        {posts.length === 0 ? (
          <div className="cp-card mt-8 p-6 text-center">
            <p className="cp-muted">Todavía no hay publicaciones.</p>
            <Link href={data.homeHref} className="cp-btn-ghost mt-4">
              <ArrowLeft className="h-4 w-4" /> Volver a la página
            </Link>
          </div>
        ) : (
          <ol className="mt-8 space-y-4">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={postPath(creator.username, p.slug)} className="cp-card cp-card-hover group block overflow-hidden">
                  {p.imageUrl && (
                    <span className="relative block aspect-[16/7] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.imageUrl}
                        srcSet={imageSrcSet(p.imageUrl)}
                        sizes="(min-width: 672px) 640px, 100vw"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="cp-img absolute inset-0 h-full w-full object-cover transition duration-500"
                      />
                    </span>
                  )}
                  <span className="block p-5 sm:p-6">
                    <time dateTime={p.publishedAt.toISOString()} className="cp-eyebrow block">
                      {p.dateLabel}
                    </time>
                    <span className="cp-display mt-2 block text-[1.7rem] leading-tight">{p.title}</span>
                    {p.excerpt && <span className="cp-muted mt-2 block text-[0.92rem] leading-relaxed">{p.excerpt}</span>}
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
                      Leer <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        {pages > 1 && (
          <nav aria-label="Páginas" className="mt-8 flex items-center justify-between gap-3 text-sm">
            {page > 1 ? (
              <Link href={page === 2 ? data.listHref : `${data.listHref}?pagina=${page - 1}`} className="cp-btn-ghost">
                <ArrowLeft className="h-4 w-4" /> Más recientes
              </Link>
            ) : (
              <span />
            )}
            <span className="cp-faint">
              {page} de {pages}
            </span>
            {page < pages ? (
              <Link href={`${data.listHref}?pagina=${page + 1}`} className="cp-btn-ghost">
                Anteriores <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
