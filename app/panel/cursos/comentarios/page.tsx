import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireCreator } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { CommentModeration, type StudioComment } from "../../comunidad/comment-moderation";
import { PageHeader } from "../../ui";

export const metadata: Metadata = { title: "Comentarios de los cursos" };

/**
 * Cursos › Comentarios: lo que escriben las alumnas en las lecciones, lección a lección (la de
 * actividad más reciente arriba). Desde aquí se responde como autora, se oculta, se borra o se deja
 * de dejar comentar, como en la Comunidad. Las lecciones con comentarios de las últimas 48 h salen
 * abiertas y marcadas como «Nuevos».
 */
export default async function CourseCommentsPage() {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  // Los 1500 más recientes (si hay más, los más viejos se quedan fuera), en orden de llegada para montar los hilos.
  const rows = (
    await db.lessonComment.findMany({
      orderBy: { createdAt: "desc" },
      take: 1500,
      include: { lesson: { select: { id: true, title: true, productId: true, product: { select: { title: true } } } }, _count: { select: { likes: true } } },
    })
  ).reverse();
  const blocked = new Set(
    (await db.customer.findMany({ where: { userId: { in: [...new Set(rows.map((c) => c.userId))] }, commentsBlockedAt: { not: null } }, select: { userId: true } })).map((c) => c.userId),
  );
  const when = (d: Date) => formatDate(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, creator.timezone);
  const since = Date.now() - 48 * 3600_000;

  type Thread = { lessonId: string; lessonTitle: string; courseTitle: string; productId: string; comments: StudioComment[]; fresh: boolean; last: number };
  const threads = new Map<string, Thread>();
  for (const c of rows) {
    const t = threads.get(c.lessonId) ?? { lessonId: c.lessonId, lessonTitle: c.lesson.title, courseTitle: c.lesson.product.title, productId: c.lesson.productId, comments: [], fresh: false, last: 0 };
    const view: StudioComment = { id: c.id, userId: c.userId, authorName: c.authorName, byOwner: c.byOwner, body: c.body, status: c.status, when: when(c.createdAt), blocked: blocked.has(c.userId), likes: c._count.likes, replies: [] };
    if (!c.byOwner && c.status === "VISIBLE" && c.createdAt.getTime() > since) t.fresh = true;
    // Una respuesta cuyo comentario quedó fuera (de los más viejos) sale suelta: así no se pierde.
    const parent = c.parentId ? t.comments.find((p) => p.id === c.parentId) : undefined;
    if (parent) parent.replies.push(view);
    else t.comments.push(view);
    t.last = Math.max(t.last, c.createdAt.getTime());
    threads.set(c.lessonId, t);
  }
  const list = [...threads.values()]
    .map((t) => ({ ...t, comments: t.comments.filter((c) => c.status !== "REMOVED" || c.replies.length).reverse() }))
    .filter((t) => t.comments.length)
    .sort((a, b) => b.last - a.last);
  const freshCount = list.filter((t) => t.fresh).length;

  return (
    <div>
      <Link href="/panel/cursos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Cursos
      </Link>
      <PageHeader
        title="Comentarios"
        subtitle={list.length ? `Lo que escriben tus alumnas en las lecciones${freshCount ? ` · ${freshCount} con comentarios nuevos` : ""}.` : "Aquí saldrá lo que escriban tus alumnas en las lecciones."}
      />
      {list.length === 0 ? (
        <EmptyState icon={<MessageCircle className="h-5 w-5" />} title="Todavía no hay comentarios" />
      ) : (
        <div className="space-y-4">
          {list.map((t) => (
            <section key={t.lessonId} className="card p-5" data-lesson-thread={t.lessonId}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="eyebrow">{t.courseTitle}</p>
                  <h2 className="mt-1 font-semibold">{t.lessonTitle}</h2>
                </div>
                <Link href={`/cuenta/cursos/${t.productId}?leccion=${t.lessonId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-lavender-deep hover:underline">
                  Ver la lección <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-3">
                <CommentModeration place="lesson" postId={t.lessonId} comments={t.comments} fresh={t.fresh} />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
