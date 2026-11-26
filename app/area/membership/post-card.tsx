import Link from "next/link";
import { CalendarDays, Eye, Heart, MessageCircle, Pin } from "lucide-react";
import { attachmentSummary, isLivePostKind, type MemberPostState } from "@/lib/community-rules";
import { richToPlain, truncateWords } from "@/lib/rich-text";
import { tzCity } from "@/lib/timezones";
import { formatDate, formatSessionDate } from "@/lib/tz";
import { JoinButton, KindBadge, kindStyle, ka } from "./kind-style";
import { postCover } from "./cover";
import { CardActions } from "./card-actions";
import { MoonCircleArt } from "@/components/creator-page/moon-circle-art";
import { postSky } from "./post-sky";
import { Tr } from "@/lib/i18n/client";


export type CardPost = {
  id: string;
  productId: string;
  title: string;
  /** La frase de la tarjeta (sin ella, el principio del texto). */
  summary?: string | null;
  body: string;
  bodyFormat: string | null;
  kind: string;
  publishedAt: Date;
  /** Directo, ceremonia o círculo: cuándo es. */
  eventAt?: Date | null;
  /** El enlace (Zoom, el podcast…): con él, la tarjeta enseña el botón para entrar. */
  mediaUrl?: string | null;
  /** La foto de portada (sin ella, la primera del texto o una según el tipo). */
  imageUrl?: string | null;
  /** Círculo de la luna: su luna y su signo, en lugar de la foto. */
  moon?: unknown;
  /** El texto del botón del enlace («Enlace a Zoom»). */
  joinLabel?: string | null;
  state: MemberPostState;
  /** «Fijar arriba»: sale la primera del feed. */
  pinned?: boolean;
  likedByMe: boolean;
  /** Guardada en favoritos por quien mira. */
  savedByMe?: boolean;
  files: { kind: string; durationSec: number | null }[];
  _count: { likes: number; comments: number };
};

type CardProps = {
  post: CardPost;
  /** ★ favoritos en la tarjeta (miembros con sesión de cuenta). */
  canSave?: boolean;
  /** ♥ «me gusta» en la tarjeta, sin entrar (miembros; no la dueña). */
  canLike?: boolean;
  timeZone: string;
  /** De un nivel de abajo incluido en el tuyo (o, en el estudio, el nivel de la publicación): su nombre. */
  tier?: string | null;
};

/**
 * Tarjeta de una publicación en el feed: sin reproductores (se cargan en su página), con un
 * extracto, el resumen de sus archivos y los «me gusta» y comentarios. Toda la tarjeta es el enlace.
 */
export function PostCard(props: CardProps) {
  const s = kindStyle(props.post.kind);
  // Toda la tarjeta abre la publicación (un enlace que la cubre), y el botón de entrar va por encima.
  return (
    <div
      className="vip-glass vip-post group relative min-h-11 overflow-hidden rounded-[1.6rem] p-4 sm:p-6"
      style={{ backgroundImage: `radial-gradient(120% 90% at 0% 0%, var(--ap-glow, ${ka(s.color, "2e")}), transparent 55%), linear-gradient(160deg, var(--ap-bg, rgb(36 31 78 / .78)), var(--ap-bg2, rgb(18 16 44 / .86)))` }}
      data-post-card
      data-area-piece="post-card"
      data-kind={props.post.kind}
    >
      <span aria-hidden className="absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ka(s.light, "aa")}, transparent)` }} />
      <Link href={`/area/membership/${props.post.productId}/${props.post.id}`} className="absolute inset-0 z-0 rounded-[inherit]" aria-label={props.post.title} />
      <div className="flex gap-4 sm:gap-6">
        <PostCover post={props.post} />
        <div className="min-w-0 flex-1">
          <PostCardBody {...props} />
        </div>
      </div>
    </div>
  );
}

/** La foto de la tarjeta: en una burbuja con filo dorado, a la izquierda (el feed y el Muro del panel). */
export function PostCover({ post }: { post: CardPost }) {
  const s = kindStyle(post.kind);
  const sky = postSky(post);
  return (
    <div className="post-cover relative w-24 shrink-0 self-stretch overflow-hidden rounded-[1.1rem] sm:w-44" style={{ minHeight: "9rem" }} data-post-cover>
      {sky ? (
        <MoonCircleArt sky={sky} compact />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={postCover(post).src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          <span aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 55%, ${ka(s.color, "55")})` }} />
        </>
      )}
    </div>
  );
}

/**
 * Lo de dentro de la tarjeta, sin el enlace: el feed de las miembros la envuelve en un enlace y el
 * estudio Comunidad del panel, en su tarjeta con las acciones y la moderación (`views`: sus lectoras).
 */
export function PostCardBody({ post, timeZone, tier = null, views = null, canLike = false, canSave = false }: CardProps & { views?: number | null }) {
  const s = kindStyle(post.kind);
  const live = isLivePostKind(post.kind);
  const excerpt = post.summary?.trim() || truncateWords(richToPlain(post.body, post.bodyFormat), 220);
  const files = attachmentSummary(post.files);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <KindBadge kind={post.kind} post={post} />
        {post.pinned && post.state === "PUBLISHED" && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold text-[#2A1E0C]" style={{ background: "linear-gradient(135deg, #F7E5B8, #C9A45F)" }} data-pinned>
            <Pin className="h-3 w-3" />{" "}<Tr s={"Fijada"} /></span>
        )}
        {tier && <span className="post-tier rounded-full px-2.5 py-0.5 font-semibold" data-tier-badge><Tr s={tier} /></span>}
        {post.state === "DRAFT" && <span className="rounded-full bg-sand px-2 py-0.5 font-semibold text-ink"><Tr s={"Borrador · solo lo ves tú"} /></span>}
        {post.state === "SCHEDULED" && <span className="rounded-full border border-[#ecdcb8] bg-[#fbf5e8] px-2 py-0.5 font-semibold text-[#7a5a1c]"><Tr s={"Programada · solo lo ves tú"} /></span>}
      </p>
      <DateBox date={post.publishedAt} timeZone={timeZone} />
      </div>
      <h2 className="display post-title mt-3 text-[1.75rem] leading-[1.1] sm:text-[1.95rem]">{post.title}</h2>
      {post.eventAt && (
        <p className="kind-text mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold" style={{ background: s.soft, "--k-light": s.light, "--k-dark": s.color } as React.CSSProperties} data-event-at>
          <CalendarDays className="h-4 w-4" /> {formatSessionDate(post.eventAt, timeZone)}{" "}<Tr s={"(hora de"} />{" "}{tzCity(timeZone)})
        </p>
      )}
      {excerpt && <p className="mt-3 font-serif text-[1.08rem] leading-relaxed text-ink/75"><Tr s={excerpt} /></p>}
      {files && <p className="mt-3 text-sm font-medium text-ink/80"><Tr s={files} /></p>}
      {(live || post.kind === "PODCAST") && <JoinButton post={post} className="relative z-10 mt-4" />}
      {/* La comunidad, aparte: «me gusta», comentarios y favoritos en su propia franja (en el feed, se pulsan sin entrar). */}
      {(canLike || canSave) && views == null ? (
        <CardActions postId={post.id} liked={post.likedByMe} likes={post._count.likes} saved={!!post.savedByMe} comments={post._count.comments} canLike={canLike} canSave={canSave} />
      ) : (
      <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs font-semibold" data-card-community>
        <span className={`pill-like inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${post.likedByMe ? "is-on" : ""}`}><Heart className={`h-3.5 w-3.5 ${post.likedByMe ? "fill-current" : ""}`} /> {post._count.likes}{" "}<Tr s={"me gusta"} /></span>
        <span className="pill-com inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"><MessageCircle className="h-3.5 w-3.5" /> {post._count.comments} <Tr s={post._count.comments === 1 ? "comentario" : "comentarios"} /></span>
        {views != null && (
          <span className="inline-flex items-center gap-1" data-views><Eye className="h-3.5 w-3.5" /> {views} <Tr s={views === 1 ? "vista" : "vistas"} /></span>
        )}
      </p>
      )}
    </>
  );
}

/** La fecha de la publicación, bien visible: el día grande, el mes y (si no es de este año) el año. */
function DateBox({ date, timeZone }: { date: Date; timeZone: string }) {
  const thisYear = formatDate(new Date(), { year: "numeric" }, timeZone);
  const year = formatDate(date, { year: "numeric" }, timeZone);
  return (
    <time dateTime={date.toISOString()} className="relative z-10 flex shrink-0 flex-col items-center rounded-2xl border border-gold/35 bg-[rgb(13_12_34_/_.55)] px-3 py-1.5 text-center leading-none" data-date-box data-area-piece="date-box">
      <span className="font-serif text-[1.7rem] text-gold">{formatDate(date, { day: "numeric" }, timeZone)}</span>
      <span className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/80">{formatDate(date, { month: "short" }, timeZone).replace(".", "")}</span>
      {year !== thisYear && <span className="mt-0.5 text-[0.6rem] text-muted"><Tr s={year} /></span>}
    </time>
  );
}
