import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { PostArticle } from "@/components/creator-page/post-article";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { appUrl } from "@/lib/env";
import { postExcerpt, postPath } from "@/lib/posts";
import { getAdjacentPosts, getPublicPost } from "@/lib/public";
import { formatDate } from "@/lib/tz";
import { sectionPageData } from "../../section-data";

type Params = { username: string; slug: string };

// Cacheada como la página de la creadora (ISR, 60 s): sin cookies ni searchParams. Publicar,
// editar o borrar una publicación llama a revalidatePath.
export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams(): Params[] {
  return [];
}

async function load(username: string, slug: string) {
  // «Actualidades» ya es automática (lib/web-news.ts): las publicaciones escritas a mano no salen en la web.
  if (username || slug) return null;
  const data = await sectionPageData(username);
  if (!data) return null;
  const post = await getPublicPost(data.creator.id, slug);
  return post ? { data, post } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, slug } = await params;
  const found = await load(username, slug);
  if (!found) return { title: "Publicación no encontrada" };
  const { data, post } = found;
  const title = `${post.title} · ${data.config.displayName}`;
  const description = postExcerpt(post, 160);
  const url = `${appUrl()}${postPath(data.creator.username, post.slug)}`;
  const image = post.imageUrl ? { url: `${appUrl()}${post.imageUrl}` } : { url: data.ogImageUrl, width: 1200, height: 630 };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      url,
      type: "article",
      siteName: data.siteName,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [data.config.displayName],
      images: [{ ...image, alt: post.title }],
    },
    twitter: { card: "summary_large_image", title: post.title, description, images: [image.url] },
  };
}

/** Una publicación de la creadora («Actualidades»), con su vídeo o audio y su llamada a la acción. */
export default async function PostPage({ params }: { params: Promise<Params> }) {
  const { username, slug } = await params;
  const found = await load(username, slug);
  if (!found) notFound();
  const { data, post } = found;
  const { creator, config } = data;
  const publishedAt = post.publishedAt ?? post.createdAt;
  const { older, newer } = await getAdjacentPosts(creator.id, publishedAt, post.id);
  const link = (p: { slug: string; title: string } | null) => (p ? { href: postPath(creator.username, p.slug), title: p.title } : null);
  const url = `${appUrl()}${postPath(creator.username, post.slug)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: postExcerpt(post, 160),
    datePublished: publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url,
    mainEntityOfPage: url,
    image: post.imageUrl ? `${appUrl()}${post.imageUrl}` : undefined,
    author: { "@type": "Person", name: config.displayName, url: data.personal ? `${appUrl()}/` : `${appUrl()}/${creator.username}` },
  };

  return (
    <CreatorShell page="actualidades" username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <PostArticle
        post={{ ...post, publishedAt }}
        dateLabel={formatDate(publishedAt, { day: "numeric", month: "long", year: "numeric" }, creator.timezone)}
        listHref={data.listHref}
        older={link(older)}
        newer={link(newer)}
        gate={{ username: creator.username, slug: post.slug, signupHref: `/${creator.username}/entrar?next=${encodeURIComponent(postPath(creator.username, post.slug))}` }}
      />
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </CreatorShell>
  );
}
