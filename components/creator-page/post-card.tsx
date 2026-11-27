import Link from "next/link";
import { ArrowRight, ArrowUpRight, Headphones, Newspaper, Play } from "lucide-react";
import { imageSrcSet } from "@/lib/media-url";
import { safeHref } from "@/lib/page-config";
import { postPath } from "@/lib/posts";
import type { PublicPost } from "./creator-page-view";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

/**
 * Tarjeta vertical de una publicación de «Actualidades» (portada y lista): la portada (foto, o el
 * aviso de vídeo o audio), la fecha en grande, el título, el texto corto y, si la tiene, su llamada a
 * la acción con el código de descuento. Toda la tarjeta lleva a la publicación; el botón de la llamada
 * a la acción, a su enlace.
 */
export async function PostCard({ post, username, withDate = true }: { post: PublicPost; username: string; withDate?: boolean }) {
  const t = await getT();
  const href = postPath(username, post.slug);
  const cta = post.cta;
  const external = cta && !cta.url.startsWith("/");
  return (
    <article className="cp-card cp-card-hover group relative flex h-full flex-col" data-post-card={post.slug}>
      <Link href={href} className="absolute inset-0 z-[1]" aria-label={post.title} />
      <div className="cp-photo-bubble cp-photo-in relative aspect-[4/3]">
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            srcSet={imageSrcSet(post.imageUrl)}
            sizes="(min-width: 768px) 340px, 92vw"
            alt=""
            loading="lazy"
            decoding="async"
            className="cp-img absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span
            className="absolute inset-0 grid place-items-center"
            style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 45%, var(--c-bg)), color-mix(in oklab, var(--c-gold) 30%, var(--c-bg)))" }}
            aria-hidden
          >
            {post.mediaKind === "AUDIO" ? <Headphones className="h-9 w-9 opacity-80" /> : post.mediaKind === "VIDEO" ? <Play className="h-9 w-9 opacity-80" /> : <Newspaper className="h-9 w-9 opacity-70" />}
          </span>
        )}
        {withDate && (
          <time dateTime={new Date(post.publishedAt).toISOString()} className="cp-date-badge" aria-label={post.dateLabel}>
            <span className="cp-display block text-[2rem] leading-none"><Tr s={post.dateBadge.day} /></span>
            <span className="cp-gold block text-[0.68rem] font-semibold uppercase tracking-[0.12em]"><Tr s={post.dateBadge.month} /></span>
          </time>
        )}
        {post.mediaKind && (
          <span className="cp-pill-on-img absolute right-3 top-3">
            {post.mediaKind === "VIDEO" ? <Play className="h-3 w-3 fill-current" /> : <Headphones className="h-3 w-3" />}
            {post.mediaKind === "VIDEO" ? t("Vídeo") : t("Audio")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="cp-display text-[1.55rem] leading-[1.1]">{post.title}</h3>
        {post.excerpt && <p className="cp-muted line-clamp-3 text-[0.88rem] leading-relaxed"><Tr s={post.excerpt} /></p>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {cta ? (
            <a
              href={safeHref(cta.url)}
              className="cp-gold relative z-[2] inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <Tr s={cta.label} /> {external ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-semibold"><Tr s={"Leer"} />{" "}<ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
          {cta?.code && (
            <span className="cp-chip-code relative z-[2] !text-[0.72rem]" title={t("Código de descuento")}>
              {cta.code}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
