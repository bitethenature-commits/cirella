import { MessageCircle, Trash2, UserX } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { formatDate } from "@/lib/tz";
import { ownerDeleteComment, setCommenterBlockedAction } from "./actions";

export type ModeratedComment = {
  id: string;
  userId: string;
  authorName: string;
  byOwner: boolean;
  body: string;
  status: string;
  createdAt: Date;
  isReply: boolean;
  blocked: boolean;
};

/**
 * «Comentarios» de una publicación en el panel: borrar cualquiera y dejar (o no) comentar a una
 * persona. El texto se pinta como texto (nunca HTML ni enlaces).
 */
export function CommentsModeration({ productId, postId, comments, timeZone }: { productId: string; postId: string; comments: ModeratedComment[]; timeZone: string }) {
  const visible = comments.filter((c) => c.status === "VISIBLE").length;
  return (
    <section id="comentarios" className="card scroll-mt-24 p-5 sm:p-6">
      <h3 className="flex items-center gap-2 font-semibold">
        <MessageCircle className="h-4 w-4" /> Comentarios ({visible})
      </h3>
      {comments.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todavía no hay comentarios.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {comments.map((c) => (
            <li key={c.id} className={`px-4 py-3 text-sm ${c.isReply ? "pl-8" : ""}`}>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span className="font-semibold text-ink">{c.authorName}</span>
                {c.byOwner && <span className="rounded-full bg-sand px-2 py-0.5 text-[0.68rem] font-semibold">Autora</span>}
                {c.blocked && !c.byOwner && <span className="rounded-full border border-[#ecd2cd] px-2 py-0.5 text-[0.68rem] font-semibold text-rose">No puede comentar</span>}
                <span>{formatDate(c.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, timeZone)}</span>
              </p>
              {c.status === "VISIBLE" ? (
                <p className="mt-1 whitespace-pre-line break-words">{c.body}</p>
              ) : (
                <p className="mt-1 italic text-muted">Comentario eliminado</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {c.status === "VISIBLE" && (
                  <ConfirmForm action={ownerDeleteComment} message="¿Borrar este comentario? Nadie lo verá más.">
                    <input type="hidden" name="commentId" value={c.id} />
                    <button className="btn btn-ghost btn-sm min-h-10"><Trash2 className="h-4 w-4" /> Borrar</button>
                  </ConfirmForm>
                )}
                {!c.byOwner && (
                  <ConfirmForm
                    action={setCommenterBlockedAction}
                    message={c.blocked ? null : `¿No dejar comentar a ${c.authorName}? Seguirá viendo la comunidad y sus comentarios de antes se quedan (puedes borrarlos).`}
                  >
                    <input type="hidden" name="userId" value={c.userId} />
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="postId" value={postId} />
                    <input type="hidden" name="blocked" value={c.blocked ? "0" : "1"} />
                    <button className="btn btn-ghost btn-sm min-h-10">
                      <UserX className="h-4 w-4" /> {c.blocked ? `Volver a dejar comentar a ${c.authorName}` : `No dejar comentar a ${c.authorName}`}
                    </button>
                  </ConfirmForm>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
