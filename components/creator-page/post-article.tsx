import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { imageSrcSet } from "@/lib/media-url";
import { readingMinutes } from "@/lib/posts";
import { RichText } from "./rich-text";

/**
 * Una publicación entera (página pública /<usuaria>/novedades/<slug> y vista previa del panel).
 * El cuerpo se pinta sin HTML (components/creator-page/rich-text.tsx).
 */
export function PostArticle({
  post,
  dateLabel,
  listHref,
  older,
  newer,
}: {
  post: { title: string; excerpt: string | null; body: string; imageUrl: string | null; publishedAt: Date | null };
  /** «12 de octubre de 2026» (o «Borrador» en la vista previa). */
  dateLabel: string;
  /** Enlace a la lista de novedades (null en la vista previa). */
  listHref: string | null;
  older?: { href: string; title: string } | null;
  newer?: { href: string; title: string } | null;
}) {
  const minutes = readingMinutes(post.body);
  return (
    <article className="mx-auto max-w-2xl px-4 pb-10 pt-8 sm:pt-12">
      <p className="cp-eyebrow">
        {listHref ? (
          <Link href={listHref} className="underline-offset-4 hover:underline">
            Novedades
          </Link>
        ) : (
          "Novedades"
        )}
      </p>
      <h1 className="cp-display mt-3 text-[2.4rem] leading-[1.05] sm:text-[3rem]">{post.title}</h1>
      <p className="cp-muted mt-3 text-sm">
        {post.publishedAt ? <time dateTime={post.publishedAt.toISOString()}>{dateLabel}</time> : dateLabel} · {minutes} min de lectura
      </p>
      {post.excerpt && <p className="mt-5 text-[1.1rem] leading-relaxed">{post.excerpt}</p>}
      {post.imageUrl && (
        <div className="cp-card mt-7 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            srcSet={imageSrcSet(post.imageUrl)}
            sizes="(min-width: 672px) 640px, 100vw"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      )}
      <RichText text={post.body} className="mt-8 space-y-5 text-[1.02rem] leading-[1.75]" />

      {(older || newer || listHref) && (
        <nav aria-label="Más novedades" className="mt-12 grid gap-3 border-t pt-8 sm:grid-cols-2" style={{ borderColor: "var(--c-line)" }}>
          {newer ? (
            <Link href={newer.href} className="cp-card cp-card-hover block p-4">
              <span className="cp-faint flex items-center gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Más reciente
              </span>
              <span className="mt-1 block font-semibold leading-snug">{newer.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {older && (
            <Link href={older.href} className="cp-card cp-card-hover block p-4 sm:text-right">
              <span className="cp-faint flex items-center gap-1.5 text-xs sm:justify-end">
                Anterior <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <span className="mt-1 block font-semibold leading-snug">{older.title}</span>
            </Link>
          )}
          {listHref && (
            <Link href={listHref} className="cp-btn-ghost justify-self-start sm:col-span-2">
              Ver todas las novedades
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
