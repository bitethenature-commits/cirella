import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, Headphones, Newspaper, Play } from "lucide-react";
import { imageSrcSet } from "@/lib/media-url";
import { safeHref } from "@/lib/page-config";
import { postPath } from "@/lib/posts";
import type { PublicPost } from "./creator-page-view";

type Month = { key: string; label: string; posts: PublicPost[] };

/** El cordel: una línea dorada que baja por la izquierda y se va apagando. */
const CORD: CSSProperties = {
  background: "linear-gradient(to bottom, color-mix(in oklab, var(--c-gold) 75%, transparent), color-mix(in oklab, var(--c-gold) 35%, transparent) 70%, transparent)",
};

/**
 * Página «Actualidades» como una línea del tiempo: un cordel a la izquierda con un nudo y la fecha de
 * cada publicación, y los meses como etiquetas sobre el cordel. Cada publicación va sola en su fila
 * (nunca una al lado de otra): la foto a la izquierda y el texto a la derecha, sin caja. Las filas
 * aparecen al deslizar ([data-reveal], components/reveal.tsx).
 */
export function PostTimeline({ months, username }: { months: Month[]; username: string }) {
  return (
    <div className="relative mt-8" data-post-timeline>
      <span aria-hidden className="absolute bottom-0 left-[11px] top-1 w-[2px] rounded-full" style={CORD} />
      {months.map((m) => (
        <section key={m.key} aria-labelledby={`mes-${m.key}`} data-month={m.key} className="relative pb-10 last:pb-0">
          <h2 id={`mes-${m.key}`} className="relative flex items-center gap-3" data-reveal>
            <span aria-hidden className="relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full border" style={{ borderColor: "var(--c-gold)", background: "var(--c-bg)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--c-gold)" }} />
            </span>
            <span className="cp-display text-[1.6rem] leading-none">{m.label}</span>
          </h2>
          <ol className="mt-6 space-y-9">
            {m.posts.map((p) => (
              <TimelineItem key={p.id} post={p} username={username} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function TimelineItem({ post, username }: { post: PublicPost; username: string }) {
  const href = postPath(username, post.slug);
  const cta = post.cta;
  const external = cta && !cta.url.startsWith("/");
  return (
    <li className="relative pl-10" data-reveal data-post-card={post.slug}>
      {/* El nudo del cordel y la fecha */}
      <span aria-hidden className="absolute left-[7px] top-[0.3rem] h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "var(--c-gold)", background: "var(--c-bg)" }} />
      <time dateTime={new Date(post.publishedAt).toISOString()} className="cp-gold block text-[0.72rem] font-semibold uppercase tracking-[0.16em]">
        {post.dateBadge.day} {post.dateBadge.month}
      </time>

      <article className="group relative mt-2.5 flex items-start gap-4 sm:gap-6">
        <Link href={href} className="absolute inset-0 z-[1]" aria-label={post.title} />
        {/* La foto, a la izquierda */}
        <div className="cp-photo-bubble relative aspect-[4/3] w-[40%] max-w-[16rem] shrink-0">
          {post.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.imageUrl}
              srcSet={imageSrcSet(post.imageUrl)}
              sizes="(min-width: 768px) 256px, 40vw"
              alt=""
              loading="lazy"
              decoding="async"
              className="cp-img absolute inset-0 h-full w-full object-cover group-hover:scale-[1.035]"
            />
          ) : (
            <span
              className="absolute inset-0 grid place-items-center"
              style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 45%, var(--c-bg)), color-mix(in oklab, var(--c-gold) 30%, var(--c-bg)))" }}
              aria-hidden
            >
              {post.mediaKind === "AUDIO" ? <Headphones className="h-8 w-8 opacity-80" /> : post.mediaKind === "VIDEO" ? <Play className="h-8 w-8 opacity-80" /> : <Newspaper className="h-8 w-8 opacity-70" />}
            </span>
          )}
          {post.mediaKind && (
            <span className="cp-pill-on-img absolute right-2 top-2">
              {post.mediaKind === "VIDEO" ? <Play className="h-3 w-3 fill-current" /> : <Headphones className="h-3 w-3" />}
              {post.mediaKind === "VIDEO" ? "Vídeo" : "Audio"}
            </span>
          )}
        </div>

        {/* El texto, a la derecha y sin caja */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="cp-display text-[1.3rem] leading-[1.1] transition-colors sm:text-[1.6rem]">{post.title}</h3>
          {post.excerpt && <p className="cp-muted line-clamp-3 text-[0.86rem] leading-relaxed sm:text-[0.92rem]">{post.excerpt}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {cta ? (
              <a
                href={safeHref(cta.url)}
                className="cp-gold relative z-[2] inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {cta.label} {external ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                Leer <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            )}
            {cta?.code && (
              <span className="cp-chip-code relative z-[2] !text-[0.72rem]" title="Código de descuento">
                {cta.code}
              </span>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}
