import { CalmAudio } from "@/components/media/calm-audio";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { imageSrcSet } from "@/lib/media-url";
import { readingMinutes, readPostMedia } from "@/lib/posts";
import { safeHref } from "@/lib/page-config";
import { RichContent } from "@/components/rich-text/rich-content";
import { CopyButton } from "@/components/ui/copy-button";
import { PageVideo } from "./page-video";
import { VideoFacade } from "./video-facade";
import { PostMediaGate } from "./post-media-gate";

/**
 * Una publicación entera (página pública /<usuaria>/actualidades/<slug> y vista previa del panel),
 * con su vídeo o audio y su llamada a la acción (botón y código de descuento).
 * El cuerpo se pinta sin HTML (components/rich-text/rich-content.tsx), con o sin formato.
 */
export function PostArticle({
  post,
  dateLabel,
  listHref,
  older,
  newer,
  gate,
}: {
  post: {
    title: string;
    excerpt: string | null;
    body: string;
    bodyFormat?: string | null;
    imageUrl: string | null;
    publishedAt: Date | null;
    mediaKind?: string | null;
    media?: unknown;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    ctaCode?: string | null;
  };
  /** «12 de octubre de 2026» (o «Borrador» en la vista previa). */
  dateLabel: string;
  /** Enlace a la lista de actualidades (null en la vista previa). */
  listHref: string | null;
  older?: { href: string; title: string } | null;
  newer?: { href: string; title: string } | null;
  /** En la web: el vídeo o el audio se ve con cuenta (el resto, un adelanto con «Crear mi cuenta»). */
  gate?: { username: string; slug: string; signupHref: string } | null;
}) {
  const minutes = readingMinutes(post.body, post.bodyFormat);
  const media = readPostMedia(post.mediaKind, post.media);
  const cta = post.ctaLabel && post.ctaUrl ? { label: post.ctaLabel, url: post.ctaUrl, code: null as string | null } : null;
  const external = cta && !cta.url.startsWith("/");
  return (
    <article className="mx-auto max-w-2xl px-4 pb-10 pt-8 sm:pt-12">
      <p className="cp-eyebrow">
        {listHref ? (
          <Link href={listHref} className="underline-offset-4 hover:underline">
            Actualidades
          </Link>
        ) : (
          "Actualidades"
        )}
      </p>
      <h1 className="cp-display mt-3 text-[2.4rem] leading-[1.05] sm:text-[3rem]">{post.title}</h1>
      <p className="cp-muted mt-3 text-sm">
        {post.publishedAt ? <time dateTime={post.publishedAt.toISOString()}>{dateLabel}</time> : dateLabel} · {minutes} min de lectura
      </p>
      {post.excerpt && <p className="mt-5 text-[1.1rem] leading-relaxed">{post.excerpt}</p>}
      {gate && media && (
        <PostMediaGate
          kind={media.kind}
          username={gate.username}
          slug={gate.slug}
          poster={media.kind === "VIDEO" && "src" in media ? (media.poster ?? post.imageUrl) : post.imageUrl}
          title={post.title}
          durationSec={"durationSec" in media ? (media.durationSec ?? null) : null}
          signupHref={gate.signupHref}
        />
      )}
      {!gate && media?.kind === "VIDEO" && (
        <div className="cp-card mt-7 overflow-hidden" data-post-media="video">
          {"embedUrl" in media ? (
            <VideoFacade url={media.embedUrl} poster={post.imageUrl} title={post.title} />
          ) : (
            <PageVideo video={{ src: media.src, width: media.width ?? null, height: media.height ?? null, durationSec: media.durationSec ?? null, codec: null, sizeBytes: null }} poster={media.poster ?? post.imageUrl} title={post.title} />
          )}
        </div>
      )}
      {post.imageUrl && media?.kind !== "VIDEO" && !(gate && media) && (
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
      {!gate && media?.kind === "AUDIO" && (
        <div className="mt-6 py-2" data-post-media="audio">
          <CalmAudio src={media.src} preload="none" title={post.title} />
        </div>
      )}
      <RichContent text={post.body} format={post.bodyFormat} legacy="links" tone="page" headingLevel={2} className="mt-8 space-y-5 text-[1.02rem] leading-[1.75]" />
      {cta && (
        <div className="cp-card mt-8 flex flex-wrap items-center gap-3 p-5" data-post-cta>
          <a href={safeHref(cta.url)} className="cp-btn" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {cta.label} {external ? <ArrowUpRight className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </a>
          {cta.code && (
            <span className="inline-flex items-center gap-2">
              <span className="cp-chip-code" aria-label={`Código de descuento ${cta.code}`}>{cta.code}</span>
              <CopyButton text={cta.code} label="Copiar código" className="cp-btn-ghost !min-h-0 !px-3 !py-1.5 text-xs" />
            </span>
          )}
        </div>
      )}

      {(older || newer || listHref) && (
        <nav aria-label="Más actualidades" className="mt-12 grid gap-3 border-t pt-8 sm:grid-cols-2" style={{ borderColor: "var(--c-line)" }}>
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
              Ver todas las actualidades
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
