import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink } from "lucide-react";
import { MediaView } from "@/components/media/media-view";
import { OnePlayerAtATime } from "@/components/media/one-player-at-a-time";
import { VideoEmbed } from "@/components/media/video-embed";
import { RichContent } from "@/components/rich-text/rich-content";
import { buyerLoginPath, markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { getMemberPost } from "@/lib/community";
import { isLivePostKind, MEMBER_POST_KIND_LABEL, publicMemberName, scheduleLabel, type MemberPostKind } from "@/lib/community-rules";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { accessSource } from "@/lib/membership-access";
import { tzCity } from "@/lib/timezones";
import { formatDate, formatSessionDate } from "@/lib/tz";
import { videoEmbed } from "@/lib/video-embed";
import { CreatorTag } from "../../../ui";
import { Comments, LikeButton, type ViewComment } from "./interactions";

export const metadata: Metadata = { title: "Publicación", robots: { index: false, follow: false } };

/**
 * Una publicación de la comunidad: texto con formato, sus archivos con los visores de siempre
 * (audio con controles en la pantalla bloqueada, vídeo, PDF, imágenes), «me gusta» y comentarios.
 * Para quien tiene acceso vigente (también desde el enlace personal del email) y para la dueña,
 * que ve también los borradores y las programadas («Vista previa»).
 */
export default async function MemberPostPage({ params }: { params: Promise<{ productId: string; postId: string }> }) {
  const { productId, postId } = await params;
  const path = `/cuenta/membresias/${productId}/${postId}`;
  const { user, scoped, isOwner } = await requireBuyerFor({ productId }, path);
  const source = isOwner ? null : await accessSource(user.id, productId);
  if (!isOwner && !source) redirect(`/cuenta/membresias/${productId}`);
  const post = await getMemberPost(postId, { userId: user.id, isOwner });
  if (!post || post.productId !== productId) notFound();
  if (source) await markFirstAccess(user.id, source.productId);

  const creator = post.product.creator;
  const c = creatorBrief(creator);
  const tz = creator.timezone;
  const customer = isOwner ? null : await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: post.creatorId, userId: user.id } }, select: { name: true, commentsBlockedAt: true } });
  const mode = scoped ? "login" : customer?.commentsBlockedAt ? "blocked" : !post.commentsOpen && !isOwner ? "closed" : "can";
  const authorHint = isOwner ? `Se publicará como «${c.displayName}» (Autora).` : `Se publicará como «${publicMemberName(customer?.name || user.name)}». Lo verán las demás personas de la comunidad.`;
  const when = (d: Date) => formatDate(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, tz);
  const view = (x: (typeof post.comments)[number]): ViewComment => ({
    id: x.id,
    authorName: x.authorName,
    byOwner: x.byOwner,
    body: x.status === "VISIBLE" ? x.body : "",
    removed: x.status !== "VISIBLE",
    when: when(x.createdAt),
    canDelete: x.status === "VISIBLE" && !scoped && (isOwner || x.userId === user.id),
    replies: [],
  });
  const roots = post.comments.filter((x) => !x.parentId).map(view);
  for (const r of post.comments.filter((x) => x.parentId)) roots.find((p) => p.id === r.parentId)?.replies.push(view(r));
  const kindLabel = MEMBER_POST_KIND_LABEL[post.kind as MemberPostKind] ?? "Publicación";
  const embed = post.mediaUrl && videoEmbed(post.mediaUrl) ? post.mediaUrl : null;

  return (
    <div className="max-w-2xl">
      <Link href={`/cuenta/membresias/${productId}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {post.product.title}
      </Link>
      {post.state !== "PUBLISHED" && (
        <div className="mt-3 rounded-2xl border border-[#ecdcb8] bg-[#fbf5e8] px-4 py-3 text-sm text-[#7a5a1c]">
          {post.state === "DRAFT" ? "Borrador: solo lo ves tú." : `Programada para el ${scheduleLabel(post.publishedAt, tz)}: solo la ves tú hasta entonces.`}{" "}
          <Link href={`/panel/productos/${productId}/publicaciones/${post.id}`} className="font-semibold underline-offset-2 hover:underline">Editar</Link>
        </div>
      )}
      <article className="mt-4">
        <CreatorTag name={c.displayName} avatarUrl={c.avatarUrl} />
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          {kindLabel} · {formatDate(post.publishedAt, { day: "numeric", month: "long" }, tz)}
        </p>
        <h1 className="display mt-1 text-[2.1rem] leading-tight sm:text-[2.5rem]">{post.title}</h1>
        {post.eventAt && (
          <p className="mt-2 flex items-center gap-1.5 font-semibold" data-event-at>
            <CalendarDays className="h-4 w-4" /> {formatSessionDate(post.eventAt, tz)} (hora de {tzCity(tz)})
          </p>
        )}
        {post.body && (
          <RichContent text={post.body} format={post.bodyFormat} legacy="preline" tone="account" headingLevel={3} className="mt-4 space-y-4 text-[1.02rem] leading-relaxed text-ink/85" />
        )}
        {post.files.length > 0 && (
          <div className="mt-6 space-y-4">
            <OnePlayerAtATime />
              {post.files.map((f) => (
                <div key={f.id} className={f.kind === "VIDEO" ? "overflow-hidden rounded-3xl bg-black" : ""} data-post-file={f.kind}>
                  <MediaView file={f} title={post.title} poster={post.product.imageUrl} artwork={post.product.imageUrl} />
                </div>
              ))}
          </div>
        )}
        {embed && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-black">
            <VideoEmbed url={embed} title={post.title} />
          </div>
        )}
        {post.mediaUrl && !embed && /^https:\/\//i.test(post.mediaUrl) && (
          <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-6 min-h-11">
            {isLivePostKind(post.kind) ? <><CalendarDays className="h-4 w-4" /> {post.kind === "CEREMONIA" ? "Unirme a la ceremonia" : post.kind === "CIRCULO_LUNAR" ? "Unirme al círculo" : "Unirme al directo"}</> : <><ExternalLink className="h-4 w-4" /> Abrir el enlace</>}
          </a>
        )}
      </article>

      <div className="mt-8 border-t border-line pt-6">
        <LikeButton postId={post.id} liked={post.likedByMe} count={post._count.likes} />
      </div>
      <div className="mt-8">
        <Comments
          postId={post.id}
          comments={roots}
          mode={mode}
          loginHref={await buyerLoginPath(path, { motivo: "completa", creatorId: post.creatorId })}
          authorHint={authorHint}
        />
      </div>
    </div>
  );
}
