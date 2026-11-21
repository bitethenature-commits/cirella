"use client";

import { Heart, Loader2, MessageCircle, Reply, Trash2 } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { COMMENT_MAX } from "@/lib/community-rules";
import { commentOnPost, deleteComment, likeComment, likePost, type CommentState } from "./actions";
import { commentOnLesson, deleteLessonComment, likeLessonComment } from "@/app/cuenta/cursos/[productId]/comment-actions";

/** Dónde están los comentarios: una publicación de una membresía o una lección de un curso. */
export type CommentPlace = "post" | "lesson";

const ACTIONS = {
  post: { comment: commentOnPost, remove: deleteComment, like: likeComment, field: "postId" },
  lesson: { comment: commentOnLesson, remove: deleteLessonComment, like: likeLessonComment, field: "lessonId" },
} as const;

export type ViewComment = {
  id: string;
  authorName: string;
  byOwner: boolean;
  body: string;
  removed: boolean;
  when: string;
  canDelete: boolean;
  /** Lo escribió quien mira (no puede darse «me gusta» a sí misma). */
  mine: boolean;
  likes: number;
  liked: boolean;
  replies: ViewComment[];
};

/** ♡ pequeño de un comentario, con respuesta inmediata. */
function CommentLike({ place, c, can }: { place: CommentPlace; c: ViewComment; can: boolean }) {
  const [state, setState] = useState({ liked: c.liked, count: c.likes });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, start] = useTransition();
  const active = can && !c.mine;
  if (!active)
    return state.count > 0 ? (
      <span className="acc-clike" data-on="false" aria-label={`${state.count} me gusta`}>
        <Heart className="h-3.5 w-3.5" /> {state.count}
      </span>
    ) : null;
  return (
    <button
      type="button"
      className="acc-clike"
      data-on={optimistic.liked ? "true" : "false"}
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "Quitar me gusta del comentario" : "Me gusta este comentario"}
      onClick={() =>
        start(async () => {
          setOptimistic({ liked: !optimistic.liked, count: optimistic.count + (optimistic.liked ? -1 : 1) });
          const r = await ACTIONS[place].like(c.id);
          if (!("error" in r)) setState(r);
        })
      }
    >
      <Heart className={`h-3.5 w-3.5 ${optimistic.liked ? "fill-current" : ""}`} /> {optimistic.count > 0 ? optimistic.count : "Me gusta"}
    </button>
  );
}

/** ♥ con respuesta inmediata (se corrige si el servidor dice otra cosa). */
export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const [state, setState] = useState({ liked, count });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        aria-pressed={optimistic.liked}
        aria-label={optimistic.liked ? "Quitar me gusta" : "Me gusta"}
        onClick={() =>
          start(async () => {
            setOptimistic({ liked: !optimistic.liked, count: optimistic.count + (optimistic.liked ? -1 : 1) });
            const r = await likePost(postId);
            if ("error" in r) setError(r.error);
            else {
              setError(null);
              setState(r);
            }
          })
        }
        className={`inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${optimistic.liked ? "border-rose/40 bg-[#fdf3f1] text-rose" : "border-line text-ink hover:bg-sand"}`}
      >
        <Heart className={`h-4 w-4 ${optimistic.liked ? "fill-current" : ""}`} /> Me gusta · {optimistic.count}
      </button>
      {error && <p className="mt-1 text-xs text-rose" role="alert">{error}</p>}
    </div>
  );
}

function CommentForm({ place, postId, parentId, onDone, autoFocus, authorHint }: { place: CommentPlace; postId: string; parentId?: string; onDone?: () => void; autoFocus?: boolean; authorHint: string }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(ACTIONS[place].comment, undefined);
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state?.ok) {
      setText("");
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);
  // Crece con el texto (sin barra de desplazamiento dentro del iPhone).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-2"
    >
      <input type="hidden" name={ACTIONS[place].field} value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <label className="sr-only" htmlFor={`c-body-${parentId ?? "new"}`}>{parentId ? "Tu respuesta" : "Escribe un comentario"}</label>
      <textarea
        ref={ref}
        id={`c-body-${parentId ?? "new"}`}
        name="body"
        required
        maxLength={COMMENT_MAX}
        rows={2}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={parentId ? "Escribe tu respuesta…" : "Escribe un comentario…"}
        className="input min-h-[5.5rem] w-full resize-none py-3 text-base leading-relaxed"
      />
      {state?.error && <p className="text-sm text-rose" role="alert">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm min-h-11" disabled={pending || !text.trim()}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {parentId ? "Responder" : "Publicar comentario"}
        </button>
        <span className="text-xs text-muted">{authorHint}</span>
        {text.length > COMMENT_MAX - 200 && <span className="text-xs text-muted">{text.length}/{COMMENT_MAX}</span>}
      </div>
    </form>
  );
}

function CommentItem({ place, c, postId, canReply, canLike, authorHint, reply }: { place: CommentPlace; c: ViewComment; postId: string; canReply: boolean; canLike: boolean; authorHint: string; reply?: boolean }) {
  const [replying, setReplying] = useState(false);
  return (
    <li id={`c-${c.id}`} className={`scroll-mt-24 ${reply ? "border-l-2 border-line pl-4" : ""}`}>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span className="font-semibold text-ink">{c.removed ? "—" : c.authorName}</span>
        {c.byOwner && !c.removed && <span className="rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-semibold text-cream">Autora</span>}
        <span>{c.when}</span>
      </p>
      {c.removed ? <p className="mt-1 text-sm italic text-muted">Comentario eliminado</p> : <p className="mt-1 whitespace-pre-line break-words text-[0.97rem] leading-relaxed">{c.body}</p>}
      {!c.removed && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <CommentLike place={place} c={c} can={canLike} />
          {canReply && !reply && (
            <button type="button" onClick={() => setReplying((v) => !v)} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted hover:text-ink" aria-label={`Responder a ${c.authorName}`}>
              <Reply className="h-3.5 w-3.5" /> Responder
            </button>
          )}
          {c.canDelete && (
            <ConfirmForm action={ACTIONS[place].remove} message="¿Borrar este comentario?">
              <input type="hidden" name="commentId" value={c.id} />
              <button className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted hover:text-rose" aria-label="Borrar comentario">
                <Trash2 className="h-3.5 w-3.5" /> Borrar
              </button>
            </ConfirmForm>
          )}
        </div>
      )}
      {replying && (
        <div className="mt-2">
          <CommentForm place={place} postId={postId} parentId={c.id} autoFocus authorHint={authorHint} onDone={() => setReplying(false)} />
        </div>
      )}
      {c.replies.length > 0 && (
        <ul className="mt-3 space-y-4">
          {c.replies.map((r) => (
            <CommentItem key={r.id} place={place} c={r} postId={postId} canReply={false} canLike={canReply} authorHint={authorHint} reply />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Comentarios de una publicación. El texto se pinta siempre como texto (sin HTML ni enlaces).
 * `mode`: puede comentar · enlace del email (debe entrar) · no puede (bloqueada) · cerrados.
 */
export function Comments({
  place = "post",
  postId,
  comments,
  mode,
  loginHref,
  authorHint,
  title = "Comentarios",
}: {
  place?: CommentPlace;
  title?: string;
  /** La publicación o la lección. */
  postId: string;
  comments: ViewComment[];
  /** preview: la dueña mirando como miembro («Ver como miembro»): solo lectura. */
  mode: "can" | "login" | "blocked" | "closed" | "preview";
  loginHref: string;
  authorHint: string;
}) {
  const total = comments.reduce((n, c) => n + (c.removed ? 0 : 1) + c.replies.filter((r) => !r.removed).length, 0);
  return (
    <section id="comentarios" className="scroll-mt-24">
      <h2 className="flex items-center gap-2 font-semibold">
        <MessageCircle className="h-4 w-4" /> {title}{total ? ` (${total})` : ""}
      </h2>
      <div className="mt-4">
        {mode === "can" && <CommentForm place={place} postId={postId} authorHint={authorHint} />}
        {mode === "login" && (
          <div className="rounded-2xl border border-line p-4 text-sm">
            <p>Para comentar, entra con tu email.</p>
            <Link href={loginHref} className="btn btn-outline btn-sm mt-3 min-h-11">Entrar para comentar</Link>
          </div>
        )}
        {mode === "blocked" && <p className="rounded-2xl border border-line p-4 text-sm text-muted">No puedes comentar en esta comunidad.</p>}
        {mode === "closed" && <p className="rounded-2xl border border-line p-4 text-sm text-muted">Los comentarios están cerrados.</p>}
        {mode === "preview" && <p className="rounded-2xl border border-line p-4 text-sm text-muted">Aquí tus miembros escriben sus comentarios. Para responder o moderar, hazlo desde Comunidad en tu panel.</p>}
      </div>
      {comments.length > 0 ? (
        <ul className="mt-6 space-y-5">
          {comments.map((c) => (
            <CommentItem key={c.id} place={place} c={c} postId={postId} canReply={mode === "can"} canLike={mode === "can"} authorHint={authorHint} />
          ))}
        </ul>
      ) : (
        mode !== "closed" && <p className="mt-4 text-sm text-muted">Todavía no hay comentarios.</p>
      )}
    </section>
  );
}
