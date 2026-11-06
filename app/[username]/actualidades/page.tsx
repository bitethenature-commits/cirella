import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { PostTimeline } from "@/components/creator-page/post-timeline";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { Reveal } from "@/components/reveal";
import { groupPostsByMonth } from "@/lib/posts";
import { getPublicPostList } from "@/lib/public";
import { sectionPageData } from "../section-data";

type Params = { username: string };
type Search = { pagina?: string };

const pageOf = (raw?: string) => Math.max(1, Math.min(1000, Number.parseInt(raw ?? "1", 10) || 1));

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { username } = await params;
  const page = pageOf((await searchParams).pagina);
  const data = await sectionPageData(username);
  if (!data) return { title: "Página no encontrada" };
  const title = `Actualidades · ${data.config.displayName}`;
  const description = `Todo lo que publica ${data.config.displayName}, por meses.`;
  const url = page > 1 ? `${data.listUrl}?pagina=${page}` : data.listUrl;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: data.siteName, images: [{ url: data.ogImageUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [data.ogImageUrl] },
  };
}

/**
 * «Actualidades»: todas las publicaciones de una creadora, de la más reciente a la más antigua,
 * agrupadas por mes y año (en su zona horaria), en una línea del tiempo con un cordel y la fecha de
 * cada una (components/creator-page/post-timeline.tsx).
 */
export default async function ActualidadesPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { username } = await params;
  const page = pageOf((await searchParams).pagina);
  const data = await sectionPageData(username);
  if (!data) notFound();
  const { creator, config } = data;
  const { posts, pages } = await getPublicPostList(creator.id, creator.timezone, page);
  if (page > pages) notFound();
  const months = groupPostsByMonth(posts, creator.timezone);

  return (
    <CreatorShell username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:pt-12">
        <p className="cp-eyebrow">{config.displayName}</p>
        <h1 className="cp-display mt-2 text-[2.6rem] leading-tight">Actualidades</h1>

        {posts.length === 0 ? (
          <div className="cp-card mt-8 p-6 text-center">
            <p className="cp-muted">Todavía no hay publicaciones.</p>
            <Link href={data.homeHref} className="cp-btn-ghost mt-4">
              <ArrowLeft className="h-4 w-4" /> Volver a la página
            </Link>
          </div>
        ) : (
          <PostTimeline months={months} username={creator.username} />
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
      {/* Las publicaciones de la línea del tiempo aparecen al deslizar. */}
      <Reveal />
    </CreatorShell>
  );
}
