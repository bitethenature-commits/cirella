import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { SectionHeading } from "@/components/creator-page/creator-page-view";
import { HomeRows, MegaphoneIcon } from "@/components/creator-page/home-rows";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { getRecentPublicPosts } from "@/lib/public";
import { formatDate } from "@/lib/tz";
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
  const description = `Lo nuevo de la web de ${data.config.displayName}: cursos, lecturas, membresías y más.`;
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
 * «Actualidades»: lo que se va subiendo a la web (lib/web-news.ts), de lo más nuevo a lo más antiguo y por
 * meses: lo nuevo de las membresías, cursos, lecturas, sesiones, talleres, códigos de descuento y el próximo
 * círculo de la luna para venir sin ser miembro.
 */
export default async function ActualidadesPage({ params }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) notFound();
  const { creator, config } = data;
  // Arriba, sus publicaciones (como en la portada); debajo, lo nuevo de la web por meses.
  const { posts, older: oldPosts } = await getRecentPublicPosts(creator.id, creator.timezone, creator.newsDays);
  const older = (data.newsOlder ?? 0) + oldPosts;
  const postHref = (slug: string) => `${data.listUrl.replace(/\/$/, "")}/${slug}`;
  const news = (data.news ?? []).map((n) => (n.href.startsWith("#") ? { ...n, href: `${data.homeHref}${n.href}` } : n));
  const months = new Map<string, typeof news>();
  for (const n of news) {
    const m = formatDate(new Date(n.at), { month: "long", year: "numeric" }, creator.timezone);
    months.set(m, [...(months.get(m) ?? []), n]);
  }

  return (
    <CreatorShell username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:pt-12">
        <div className="flex items-center gap-4">
          <span className="cp-emblem grid h-14 w-14 shrink-0 place-items-center rounded-full" aria-hidden>
            <MegaphoneIcon />
          </span>
          <div>
            <p className="cp-eyebrow">Lo nuevo de la web</p>
            <h1 className="cp-display mt-1 text-[2.6rem] leading-tight">Actualidades</h1>
          </div>
        </div>

        {posts.length > 0 && (
          <section className="cp-luxe mt-10" aria-label="Publicaciones">
            <SectionHeading title="Publicaciones" />
            <div className="mt-5">
              <HomeRows
                fallbackImage={config.coverUrl ?? config.avatarUrl ?? null}
                rows={posts.map((p) => ({
                  key: `post-${p.id}`,
                  href: postHref(p.slug),
                  image: p.imageUrl,
                  icon: <MegaphoneIcon className="h-7 w-7 opacity-80" />,
                  eyebrow: (
                    <>
                      <span>{p.dateLabel}</span>
                      <span>· Publicación</span>
                    </>
                  ),
                  title: p.title,
                  text: p.excerpt,
                }))}
              />
            </div>
          </section>
        )}

        {posts.length > 0 && news.length > 0 && (
          <div className="mt-14 flex items-center gap-4">
            <span aria-hidden className="h-px flex-1 bg-[color-mix(in_oklab,var(--c-gold)_45%,transparent)]" />
            <p className="cp-eyebrow">Lo nuevo de la web</p>
            <span aria-hidden className="h-px flex-1 bg-[color-mix(in_oklab,var(--c-gold)_45%,transparent)]" />
          </div>
        )}

        {news.length === 0 && posts.length > 0 ? null : news.length === 0 ? (
          <div className="cp-card mt-8 p-6 text-center">
            <p className="cp-muted">Todavía no hay novedades.</p>
            <Link href={data.homeHref} className="cp-btn-ghost mt-4">
              <ArrowLeft className="h-4 w-4" /> Volver a la página
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {[...months].map(([month, items]) => (
              <section key={month} aria-label={month}>
                <h2 className="cp-display mb-4 text-[1.5rem] capitalize">{month}</h2>
                <HomeRows
                  fallbackImage={config.coverUrl ?? config.avatarUrl ?? null}
                  rows={items.map((n) => ({
                    key: n.key,
                    href: n.href,
                    image: n.image,
                    icon: <MegaphoneIcon className="h-7 w-7 opacity-80" />,
                    eyebrow: (
                      <>
                        <span>{n.dateLabel}</span>
                        <span>· {n.label}</span>
                      </>
                    ),
                    title: n.title,
                    text: n.text,
                  }))}
                />
              </section>
            ))}
          </div>
        )}
        {/* Las que ya pasaron de sus días (se eligen en el panel, en «Actualidades»): solo se cuentan. */}
        {older > 0 && (
          <p className="cp-muted mt-10 flex items-center justify-center gap-3 text-center text-[0.95rem] italic" data-news-older>
            <span aria-hidden className="cp-gold text-[0.6rem]">✦</span>
            {news.length || posts.length ? "y" : "Hubo"} {older} {older === 1 ? "actualidad" : "actualidades"} más
            <span aria-hidden className="cp-gold text-[0.6rem]">✦</span>
          </p>
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
