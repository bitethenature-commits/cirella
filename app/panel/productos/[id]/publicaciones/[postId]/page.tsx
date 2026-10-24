import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { deleteMemberPostAction } from "../actions";
import { CommentsModeration } from "../comments-moderation";
import { loadPostEditor } from "../data";
import { PostEditor } from "../post-editor";

export const metadata: Metadata = { title: "Editar publicación" };

export default async function EditMemberPostPage({ params, searchParams }: { params: Promise<{ id: string; postId: string }>; searchParams: Promise<{ guardada?: string }> }) {
  const { id, postId } = await params;
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const data = await loadPostEditor(creator, id, postId);
  if (!data) notFound();
  const db = tenantDb(creator.id);
  const comments = await db.membershipComment.findMany({ where: { postId }, orderBy: { createdAt: "asc" } });
  const blocked = new Set(
    (await db.customer.findMany({ where: { userId: { in: [...new Set(comments.map((c) => c.userId))] }, commentsBlockedAt: { not: null } }, select: { userId: true } })).map((c) => c.userId),
  );
  // Hilos: cada comentario seguido de sus respuestas; los más recientes arriba.
  const roots = comments.filter((c) => !c.parentId).reverse();
  const ordered = roots.flatMap((r) => [r, ...comments.filter((c) => c.parentId === r.id)]);
  return (
    <div className="max-w-3xl">
      <Link href={`/panel/productos/${id}#publicaciones`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {data.product.title}
      </Link>
      <h1 className="display mb-6 mt-4 text-[2.2rem] leading-tight">Editar publicación</h1>
      {sp.guardada && <Flash ok={sp.guardada} />}
      <PostEditor
        productId={id}
        post={data.editor}
        members={data.members}
        timeZone={creator.timezone}
        minAt={data.minAt}
        limitsLabel={data.limitsLabel}
        notifiedNote={data.notifiedNote}
      />
      <div className="mt-6 space-y-5">
        <CommentsModeration
          productId={id}
          postId={postId}
          timeZone={creator.timezone}
          comments={ordered.map((c) => ({ id: c.id, userId: c.userId, authorName: c.authorName, byOwner: c.byOwner, body: c.body, status: c.status, createdAt: c.createdAt, isReply: !!c.parentId, blocked: blocked.has(c.userId) }))}
        />
        <ConfirmForm action={deleteMemberPostAction} message="¿Eliminar esta publicación? Se borrarán también sus archivos y comentarios.">
          <input type="hidden" name="postId" value={postId} />
          <button className="btn btn-danger min-h-11"><Trash2 className="h-4 w-4" /> Eliminar publicación</button>
        </ConfirmForm>
      </div>
    </div>
  );
}
