import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink } from "lucide-react";
import { MediaView } from "@/components/media/media-view";
import { OnePlayerAtATime } from "@/components/media/one-player-at-a-time";
import { VideoEmbed } from "@/components/media/video-embed";
import { RichContent } from "@/components/rich-text/rich-content";
import { areaProductId } from "@/lib/area-product";
import { buyerLoginPath, markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { getMemberPost, recordPostView } from "@/lib/community";
import { isLivePostKind, isRecordedPost, MEMBER_POST_KIND_LABEL, visibleMemberPostWhere, publicMemberName, scheduleLabel, type MemberPostKind } from "@/lib/community-rules";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { accessSource } from "@/lib/membership-access";
import { tzCity } from "@/lib/timezones";
import { dateKeyInTz, formatDate, formatSessionDate } from "@/lib/tz";
import { videoEmbed } from "@/lib/video-embed";
import { ownerViewAs } from "@/lib/view-as";
import { ViewAsBanner } from "../../view-as-banner";
import { Comments, LikeButton, type ViewComment } from "./interactions";
import { ReaderNav, SaveButton, type ReaderItem } from "./reader";
import { JoinButton, KindBadge, joinLink, kindStyle, ka } from "../../kind-style";
import { Ornament, SacredFlower } from "../../vip";
import { bodyWithoutCover, postCover } from "../../cover";
import { MoonCircleArt } from "@/components/creator-page/moon-circle-art";
import { postSky } from "../../post-sky";
import { splitBody } from "@/lib/post-blocks";
import { CourseLookApply } from "@/components/course/course-look-apply";
import { membershipColors, readAreaDesign } from "@/lib/area-design";
import { Tr } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
import { getContentTranslator, translateMemberPost } from "@/lib/i18n/content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Publicación"), robots: { index: false, follow: false } };
}

/**
 * Una publicación de la comunidad: texto con formato, sus archivos con los visores de siempre
 * (audio con controles en la pantalla bloqueada, vídeo, PDF, imágenes), «me gusta» y comentarios.
 * Para quien tiene acceso vigente (también desde el enlace personal del email) y para la dueña,
 * que ve también los borradores y las programadas («Vista previa»).
 */
export default async function MemberPostPage({ params }: { params: Promise<{ productId: string; postId: string }> }) {
  const t = await getT();
  const { productId: ref, postId } = await params;
  // En la web personal, la membresía por su nombre; su código lleva ahí (con la publicación).
  const productId = await areaProductId(ref, "MEMBERSHIP", { rest: `/${postId}` });
  if (!productId) notFound();
  const path = `/area/membership/${ref}/${postId}`;
  const { user, scoped, isOwner } = await requireBuyerFor({ productId }, path);
  // «Ver como miembro»: la dueña lee como alguien de ese nivel (sin borradores ni programadas).
  const viewAs = await ownerViewAs({ creatorId: user.creator?.id, isOwner });
  if (viewAs && !viewAs.reach.includes(productId)) redirect(`/area/membership/${viewAs.id}`);
  const ownerView = isOwner && !viewAs;
  const source = isOwner ? null : await accessSource(user.id, productId);
  if (!isOwner && !source) redirect(`/area/membership/${ref}`);
  const rawPost = await getMemberPost(postId, { userId: user.id, isOwner: ownerView });
  if (!rawPost || rawPost.productId !== productId) notFound();
  // En el idioma de la web (lib/i18n/content.ts).
  const tx = await getContentTranslator(rawPost.creatorId, await getLocale());
  const post = translateMemberPost(rawPost, tx);
  if (source) await markFirstAccess(user.id, source.productId);
  // «Vistas» del estudio: personas que la han abierto (nunca la dueña).
  if (!isOwner) await recordPostView(post, user.id);

  const creator = post.product.creator;
  const areaDesign = readAreaDesign((await prisma.creator.findUnique({ where: { id: post.creatorId }, select: { areaDesign: true } }))?.areaDesign);
  const c = creatorBrief(creator);
  const tz = creator.timezone;
  const customer = isOwner ? null : await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: post.creatorId, userId: user.id } }, select: { name: true, commentsBlockedAt: true } });
  const mode = viewAs ? "preview" : scoped ? "login" : customer?.commentsBlockedAt ? "blocked" : !post.commentsOpen && !isOwner ? "closed" : "can";
  const authorHint = isOwner ? `Se publicará como «${c.displayName}» (Autora).` : `Se publicará como «${publicMemberName(customer?.name || user.name)}». Lo verán las demás personas de la comunidad.`;
  const when = (d: Date) => formatDate(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, tz);
  const view = (x: (typeof post.comments)[number]): ViewComment => ({
    id: x.id,
    authorName: x.authorName,
    tagline: x.byOwner ? null : x.user.tagline,
    byOwner: x.byOwner,
    body: x.status === "VISIBLE" ? x.body : "",
    removed: x.status !== "VISIBLE",
    when: when(x.createdAt),
    canDelete: x.status === "VISIBLE" && !scoped && (ownerView || x.userId === user.id),
    mine: x.userId === user.id,
    likes: x._count.likes,
    liked: x.likes.length > 0,
    replies: [],
  });
  const roots = post.comments.filter((x) => !x.parentId).map(view);
  for (const r of post.comments.filter((x) => x.parentId)) roots.find((p) => p.id === r.parentId)?.replies.push(view(r));
  const kindLabel = MEMBER_POST_KIND_LABEL[post.kind as MemberPostKind] ?? "Publicación";
  const embed = post.mediaUrl && videoEmbed(post.mediaUrl) ? post.mediaUrl : null;
  // Membresía «a página entera» (Esencia): arriba, anterior y siguiente por fecha y el calendario.
  const paged = post.product.pagedReading;
  const base = `/area/membership/${ref}`;
  let items: ReaderItem[] = [];
  let saved = false;
  if (paged) {
    const rows = await prisma.membershipPost.findMany({
      where: { productId, OR: [visibleMemberPostWhere(), { id: post.id }] },
      orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
      select: { id: true, title: true, publishedAt: true },
    });
    items = rows.map((r) => ({ id: r.id, title: tx(r.title), day: dateKeyInTz(r.publishedAt, tz), href: `${base}/${r.id}` }));
  }
  // «Guardar», en todas las membresías.
  if (!isOwner) saved = !!(await prisma.membershipPostSave.findUnique({ where: { postId_userId: { postId: post.id, userId: user.id } }, select: { id: true } }));
  const folder = paged ? `Textos de ${post.product.title}` : `Guardados de ${post.product.title}`;
  // La foto de arriba: la portada, la primera del texto (que entonces no se repite abajo) o una según el tipo.
  const cover = postCover(post);
  // Círculo de la luna: arriba, su luna y su signo con su frase (sin foto).
  const sky = postSky(post);
  const body = post.body ? bodyWithoutCover(post.body, cover) : "";
  const parts = splitBody(body);
  const fileById = new Map(post.files.map((f) => [f.id, f]));
  const placed = new Set(parts.flatMap((p) => (p.t === "file" ? [p.id] : [])));
  const loose = post.files.filter((f) => !placed.has(f.id));

  return (
    <div className="mx-auto max-w-3xl">
      {/* Los colores de su membresía por dentro (Mi página › Membresías). */}
      <CourseLookApply look={membershipColors(productId, areaDesign)} />
      {viewAs && <ViewAsBanner creatorId={post.creatorId} tier={viewAs} />}
      <Link href={`/area/membership/${ref}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {post.product.title}
      </Link>
      {post.state !== "PUBLISHED" && (
        <div className="mt-3 rounded-2xl border border-[#ecdcb8] bg-[#fbf5e8] px-4 py-3 text-sm text-[#7a5a1c]">
          {post.state === "DRAFT" ? t("Borrador: solo lo ves tú.") : `Programada para el ${scheduleLabel(post.publishedAt, tz)}: solo la ves tú hasta entonces.`}{" "}
          <Link href={`/panel/comunidad?editar=${post.id}`} className="font-semibold underline-offset-2 hover:underline"><Tr s={"Editar"} /></Link>
        </div>
      )}
      {paged && (
        <div className="mt-4">
          <ReaderNav items={items} currentId={post.id} />
        </div>
      )}
      <article className="mt-6">
        {/* La cabecera de la publicación: su tipo, su fecha, el título en oro y la flor de la vida detrás. */}
        <div className="relative overflow-hidden rounded-[2rem]" style={{ boxShadow: `0 0 0 1px ${ka(kindStyle(post.kind).light, "33")}, 0 40px 80px -40px ${kindStyle(post.kind).color}` }} data-post-cover>
          {sky ? (
            <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
              <MoonCircleArt sky={sky} />
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover.src} alt="" className="block aspect-[4/3] w-full object-cover" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0d0c22]" />
            </>
          )}
        </div>
        <header className="vip-hero relative isolate mx-3 -mt-16 overflow-hidden rounded-[2rem] px-6 py-9 text-center sm:mx-8 sm:-mt-24 sm:px-10 sm:py-12" style={{ backgroundImage: `radial-gradient(90% 80% at 50% 0%, ${ka(kindStyle(post.kind).color, "40")}, transparent 65%), linear-gradient(180deg, rgb(30 26 66 / .85), rgb(13 12 34 / .92))` }}>
          <SacredFlower className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 opacity-25" />
          <div className="flex justify-center">
            <KindBadge kind={post.kind} big post={post} />
          </div>
          <p className="mt-3 text-[0.7rem] uppercase tracking-[0.24em] text-muted">{formatDate(post.publishedAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, tz)}</p>
          <h1 className="vip-gold display mx-auto mt-3 max-w-2xl text-[2.3rem] leading-[1.05] sm:text-[3rem]">{post.title}</h1>
          <Ornament className="mt-5" />
        </header>
        {post.eventAt && (
          <p className="mt-6 flex w-fit items-center gap-1.5 rounded-full px-4 py-2 font-semibold" style={{ background: kindStyle(post.kind).soft, color: kindStyle(post.kind).light }} data-event-at>
            <CalendarDays className="h-4 w-4" /> {formatSessionDate(post.eventAt, tz)}{" "}<Tr s={"(hora de"} />{" "}{tzCity(tz)})
          </p>
        )}
        {joinLink(post) && (
          <div className="mt-4">
            <JoinButton post={post} />
          </div>
        )}
        {/* El contenido en el orden en que lo hizo: texto, fotos y archivos (lib/post-blocks.ts). Los archivos que
            no tienen sitio en el texto (publicaciones de antes) van al final. */}
        <OnePlayerAtATime />
        <div className="mt-10 space-y-6">
          {parts.map((p, i) => {
            if (p.t === "text")
              return <RichContent key={i} text={t(p.text)} format={post.bodyFormat} legacy="preline" tone="account" headingLevel={3} className="vip-article space-y-6 font-serif text-[1.22rem] leading-[1.85] text-ink/90 [&_img]:my-8 [&_img]:w-full [&_img]:rounded-[1.6rem]" />;
            const f = fileById.get(p.id);
            return f ? <PostFile key={i} f={f} title={post.title} poster={post.product.imageUrl} /> : null;
          })}
          {loose.map((f) => (
            <PostFile key={f.id} f={f} title={post.title} poster={post.product.imageUrl} />
          ))}
        </div>
        {embed && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-black">
            <VideoEmbed url={embed} title={post.title} />
          </div>
        )}
        {post.mediaUrl && !embed && !joinLink(post) && !isRecordedPost(post) && /^https:\/\//i.test(post.mediaUrl) && (
          <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-6 min-h-11">
            {isLivePostKind(post.kind) ? <><CalendarDays className="h-4 w-4" /> {post.kind === "CEREMONIA" ? t("Unirme a la ceremonia") : post.kind === "CIRCULO_LUNAR" ? post.joinLabel || t("Enlace a Zoom") : t("Unirme al directo")}</> : <><ExternalLink className="h-4 w-4" />{" "}<Tr s={"Abrir el enlace"} /></>}
          </a>
        )}
        <Ornament className="mt-12" />
      </article>

      {/* La comunidad, aparte del texto: «me gusta», guardar y los comentarios, en su propio espacio. */}
      <section className="vip-glass relative mt-12 overflow-hidden rounded-[2rem] p-5 sm:p-8" aria-labelledby="comunidad-t" data-community>
        <span aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <p className="text-center text-[0.64rem] font-semibold uppercase tracking-[0.3em] text-gold"><Tr s={"✦ Tu comunidad ✦"} /></p>
        <h2 id="comunidad-t" className="display mt-2 text-center text-[1.8rem] leading-tight"><Tr s={"Comparte lo que sientes"} /></h2>
        <p className="mx-auto mt-1 max-w-md text-center text-sm text-muted"><Tr s={"Deja tu «me gusta», guárdala para volver a ella y cuéntanos cómo la has vivido."} /></p>
        <div className="mt-6 flex flex-wrap items-start justify-center gap-3 border-b border-line pb-6">
          {viewAs ? (
            <p className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-muted"><Tr s={"♥ Me gusta ·"} />{" "}{post._count.likes}</p>
          ) : (
            <LikeButton postId={post.id} liked={post.likedByMe} count={post._count.likes} />
          )}
          {!isOwner && !scoped && <SaveButton postId={post.id} saved={saved} folder={folder} />}
        </div>
        <div className="mt-6">
          <Comments
            postId={post.id}
            comments={roots}
            mode={mode}
            loginHref={await buyerLoginPath(path, { motivo: "completa", creatorId: post.creatorId })}
            authorHint={authorHint}
          />
        </div>
      </section>
    </div>
  );
}

/** Un archivo de la publicación (audio, vídeo, PDF, imagen) con su visor de siempre. */
function PostFile({ f, title, poster }: { f: React.ComponentProps<typeof MediaView>["file"]; title: string; poster: string | null }) {
  return (
    <div className={f.kind === "VIDEO" ? "overflow-hidden rounded-3xl bg-black" : f.kind === "AUDIO" ? "py-2" : ""} data-post-file={f.kind}>
      <MediaView file={f} title={title} poster={poster} artwork={poster} />
    </div>
  );
}
