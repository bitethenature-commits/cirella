"use client";

import { Eye, EyeOff, Loader2, MessageCircle, Reply, Trash2, UserX } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { COMMENT_MAX } from "@/lib/community-rules";
import { blockCommenter, deleteCommentAsOwner, hideComment, ownerReply, type ReplyState } from "./actions";
import { deleteLessonCommentAsOwner, hideLessonComment, ownerLessonReply } from "../cursos/comentarios/actions";
import { Tr, useT } from "@/lib/i18n/client";

/** Comentarios de una publicación (Comunidad) o de una lección (Cursos › Comentarios). */
type Place = "post" | "lesson";
const ACTIONS = {
  post: { reply: ownerReply, hide: hideComment, remove: deleteCommentAsOwner, field: "postId" },
  lesson: { reply: ownerLessonReply, hide: hideLessonComment, remove: deleteLessonCommentAsOwner, field: "lessonId" },
} as const;

export type StudioComment = {
  id: string;
  userId: string;
  authorName: string;
  byOwner: boolean;
  body: string;
  /** VISIBLE | HIDDEN | REMOVED */
  status: string;
  when: string;
  /** Esta persona no puede comentar en la comunidad. */
  blocked: boolean;
  /** «Me gusta» que tiene (lo dan las alumnas y miembros). */
  likes?: number;
  replies: StudioComment[];
};

function ReplyForm({ place, postId, parentId, onDone, placeholder }: { place: Place; postId: string; parentId?: string; onDone?: () => void; placeholder: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ReplyState, FormData>(ACTIONS[place].reply, undefined);
  const [text, setText] = useState("");
  useEffect(() => {
    if (state?.ok) {
      setText("");
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <input type="hidden" name={ACTIONS[place].field} value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <label className="sr-only" htmlFor={`r-${parentId ?? postId}`}><Tr s={placeholder} /></label>
      <textarea
        id={`r-${parentId ?? postId}`}
        name="body"
        required
        rows={1}
        maxLength={COMMENT_MAX}
        autoFocus={!!parentId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t(placeholder)}
        className="input min-h-11 flex-1 resize-y py-2.5 text-sm"
      />
      <button type="submit" className="btn btn-primary btn-sm min-h-11" disabled={pending || !text.trim()}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} {parentId ? t("Responder") : t("Comentar")}
      </button>
      {state?.error && <p className="text-sm text-rose" role="alert"><Tr s={state.error} /></p>}
    </form>
  );
}

function CommentRow({ place, c, postId, reply }: { place: Place; c: StudioComment; postId: string; reply?: boolean }) {
  const t = useT();
  const [replying, setReplying] = useState(false);
  const hidden = c.status === "HIDDEN";
  const removed = c.status === "REMOVED";
  return (
    <li id={`sc-${c.id}`} className={reply ? "border-l-2 border-line pl-3" : ""} data-studio-comment={c.status}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className={`font-semibold ${removed ? "" : "text-ink"}`}><Tr s={c.authorName} /></span>
        {c.byOwner && !removed && <span className="rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-semibold text-cream"><Tr s={"Autora"} /></span>}
        {hidden && <span className="rounded-full border border-[#ecdcb8] bg-[#fbf5e8] px-2 py-0.5 text-[0.65rem] font-semibold text-[#7a5a1c]"><Tr s={"Oculto · solo lo ves tú"} /></span>}
        {c.blocked && !c.byOwner && <span className="rounded-full border border-[#ecd2cd] px-2 py-0.5 text-[0.65rem] font-semibold text-rose"><Tr s={"No puede comentar"} /></span>}
        <span>{c.when}</span>
        {!!c.likes && !removed && <span className="inline-flex items-center gap-0.5 text-rose">♥ {c.likes}</span>}
      </p>
      {removed ? (
        <p className="mt-1 text-sm italic text-muted"><Tr s={"Comentario eliminado"} /></p>
      ) : (
        <p className={`mt-1 whitespace-pre-line break-words text-sm leading-relaxed ${hidden ? "text-muted line-through decoration-ink/20" : ""}`}><Tr s={c.body} /></p>
      )}
      <div className="mt-1 flex flex-wrap gap-0.5">
        {!removed && !reply && !hidden && (
          <button type="button" onClick={() => setReplying((v) => !v)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-sand hover:text-ink" aria-label={`Responder a ${c.authorName}`}>
            <Reply className="h-3.5 w-3.5" />{" "}<Tr s={"Responder"} /></button>
        )}
        {!removed && !c.byOwner && (
          <form action={ACTIONS[place].hide}>
            <input type="hidden" name="commentId" value={c.id} />
            <input type="hidden" name="hidden" value={hidden ? "0" : "1"} />
            <button className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-sand hover:text-ink" aria-label={hidden ? `Volver a mostrar el comentario de ${c.authorName}` : `Ocultar el comentario de ${c.authorName}`}>
              {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {hidden ? t("Mostrar") : t("Ocultar")}
            </button>
          </form>
        )}
        {!removed && (
          <ConfirmForm action={ACTIONS[place].remove} message={t("¿Borrar este comentario? Nadie lo verá más.")}>
            <input type="hidden" name="commentId" value={c.id} />
            <button className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-sand hover:text-rose" aria-label={`Borrar el comentario de ${c.authorName}`}>
              <Trash2 className="h-3.5 w-3.5" />{" "}<Tr s={"Borrar"} /></button>
          </ConfirmForm>
        )}
        {!c.byOwner && (
          <ConfirmForm
            action={blockCommenter}
            message={c.blocked ? null : `¿No dejar comentar a ${c.authorName}? Seguirá viendo la comunidad y sus comentarios de antes se quedan (puedes ocultarlos o borrarlos).`}
          >
            <input type="hidden" name="userId" value={c.userId} />
            <input type="hidden" name="blocked" value={c.blocked ? "0" : "1"} />
            <button className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-sand hover:text-ink">
              <UserX className="h-3.5 w-3.5" /> {c.blocked ? `Volver a dejar comentar a ${c.authorName}` : `No dejar comentar a ${c.authorName}`}
            </button>
          </ConfirmForm>
        )}
      </div>
      {replying && (
        <div className="mt-2">
          <ReplyForm place={place} postId={postId} parentId={c.id} placeholder={`Responde a ${c.authorName}…`} onDone={() => setReplying(false)} />
        </div>
      )}
      {c.replies.length > 0 && (
        <ul className="mt-3 space-y-3">
          {c.replies.map((r) => (
            <CommentRow key={r.id} place={place} c={r} postId={postId} reply />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Comentarios de una publicación en el Muro del estudio: responder (como «Autora»), ocultar o volver
 * a mostrar, borrar y dejar (o no) comentar a una persona, sin salir del feed. Se abre solo si hay
 * comentarios nuevos en las últimas 48 h. El texto se pinta siempre como texto.
 */
export function CommentModeration({ place = "post", postId, comments, fresh }: { place?: Place; postId: string; comments: StudioComment[]; fresh: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(fresh);
  const count = comments.reduce((n, c) => n + (c.status === "REMOVED" ? 0 : 1) + c.replies.filter((r) => r.status !== "REMOVED").length, 0);
  return (
    <div className="border-t border-line pt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold hover:bg-sand">
        <MessageCircle className="h-4 w-4" /> {count ? `Comentarios (${count})` : t("Comentar")}
        {fresh && <span className="rounded-full bg-rose px-1.5 text-[0.65rem] font-semibold text-white"><Tr s={"Nuevos"} /></span>}
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          {comments.length > 0 && (
            <ul className="space-y-4">
              {comments.map((c) => (
                <CommentRow key={c.id} place={place} c={c} postId={postId} />
              ))}
            </ul>
          )}
          <ReplyForm place={place} postId={postId} placeholder={t("Escribe un comentario como autora…")} />
        </div>
      )}
    </div>
  );
}
