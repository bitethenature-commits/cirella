"use client";

import { Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useCallback, useMemo, useState } from "react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Flash } from "@/components/ui/flash";
import { BODY_MAX, MEMBER_POST_KIND_LABEL, MEMBER_POST_KINDS, scheduleSentence, TITLE_MAX, type MemberPostWhen } from "@/lib/community-rules";
import { tzCity } from "@/lib/timezones";
import { zonedTimeToUtc } from "@/lib/tz";
import { saveMemberPostAction, type PostEditorState } from "./actions";
import { PostAttachments, type Attachment } from "./post-attachments";

export type EditorPost = {
  id: string | null;
  title: string;
  body: string;
  bodyFormat: string | null;
  kind: string;
  mediaUrl: string;
  /** DRAFT | SCHEDULED | PUBLISHED */
  state: "DRAFT" | "SCHEDULED" | "PUBLISHED";
  /** datetime-local de la fecha guardada (programadas) */
  at: string;
  notify: boolean;
  commentsOpen: boolean;
  files: Attachment[];
};

const WHEN_LABEL: Record<MemberPostWhen, string> = { now: "Publicar ahora", schedule: "Programar", draft: "Borrador" };

/**
 * Editor de una publicación de la comunidad (nueva o existente): título, tipo, texto con formato,
 * adjuntos, enlace, «Cuándo» (ahora, programada o borrador), aviso por email y comentarios.
 * El botón principal va fijo abajo en el móvil.
 */
export function PostEditor({
  productId,
  post,
  members,
  timeZone,
  minAt,
  limitsLabel,
  notifiedNote,
}: {
  productId: string;
  post: EditorPost;
  members: number;
  timeZone: string;
  /** datetime-local de ahora (mínimo para programar). */
  minAt: string;
  limitsLabel: string;
  /** «Avisamos a 41 personas el 17 oct» (ya avisada) o null. */
  notifiedNote: string | null;
}) {
  const [state, action, pending] = useActionState<PostEditorState, FormData>(saveMemberPostAction, undefined);
  const live = post.state === "PUBLISHED";
  const [when, setWhen] = useState<MemberPostWhen>(post.state === "DRAFT" ? (post.id ? "draft" : "now") : post.state === "SCHEDULED" ? "schedule" : "now");
  const [at, setAt] = useState(post.at);
  const [kind, setKind] = useState(post.kind);
  const [uploading, setUploading] = useState(false);
  const onFirstMedia = useCallback((k: "AUDIO" | "VIDEO") => setKind((cur) => (cur === "TEXT" ? k : cur)), []);

  const sentence = useMemo(() => {
    const m = at.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
    if (!m) return null;
    const d = zonedTimeToUtc(m[1], Number(m[2]) * 60 + Number(m[3]), timeZone);
    return `Se publicará el ${scheduleSentence(d, timeZone)} (hora de ${tzCity(timeZone)}).`;
  }, [at, timeZone]);

  const options: MemberPostWhen[] = live ? ["now", "draft"] : ["now", "schedule", "draft"];
  const label = (w: MemberPostWhen) => (live && w === "now" ? "Publicada" : live && w === "draft" ? "Pasar a borrador" : WHEN_LABEL[w]);
  const primary = live ? (when === "draft" ? "Pasar a borrador" : "Guardar cambios") : when === "schedule" ? "Programar" : when === "draft" ? "Guardar borrador" : "Publicar ahora";
  const notifyLocked = live;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-5"
    >
      <Flash ok={state?.ok} error={state?.error} />
      <input type="hidden" name="productId" value={productId} />
      {post.id && <input type="hidden" name="id" value={post.id} />}

      <section className="card space-y-4 p-5 sm:p-6">
        <div>
          <label className="field-label" htmlFor="post-title">Título</label>
          <input id="post-title" name="title" required minLength={2} maxLength={TITLE_MAX} defaultValue={post.title} className="input h-11 text-base" placeholder="P. ej. Meditación de luna llena" />
        </div>
        <div>
          <label className="field-label" htmlFor="post-kind">Tipo</label>
          <select id="post-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input h-11 text-base sm:max-w-xs">
            {MEMBER_POST_KINDS.map((k) => (
              <option key={k} value={k}>{MEMBER_POST_KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="field-label">Texto</span>
          <RichTextEditor
            name="body"
            ariaLabel="Texto de la publicación"
            formatName="bodyFormat"
            defaultValue={post.body}
            initialFormat={post.bodyFormat ?? "MD"}
            maxLength={BODY_MAX}
            tools="full"
            images
            tone="account"
            headingLevel={3}
            legacy="preline"
            rows={6}
            placeholder="Escribe para tu comunidad…"
          />
        </div>
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <h3 className="font-semibold">Archivos</h3>
        <PostAttachments productId={productId} initial={post.files} limitsLabel={limitsLabel} onFirstMedia={onFirstMedia} onBusy={setUploading} />
        <div>
          <label className="field-label" htmlFor="post-link">Enlace (opcional)</label>
          <input id="post-link" name="mediaUrl" type="url" defaultValue={post.mediaUrl} className="input h-11 text-base" placeholder="https://… (directo de Zoom, YouTube…)" />
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <fieldset>
          <legend className="font-semibold">Cuándo</legend>
          {live && <p className="mt-1 text-sm text-muted">Ya la ven tus miembros.</p>}
          <div role="radiogroup" aria-label="Cuándo" className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-sand/70 p-1">
            {options.map((w) => (
              <label key={w} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-2 text-center text-sm font-semibold transition ${when === w ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
                <input type="radio" name="when" value={w} checked={when === w} onChange={() => setWhen(w)} className="sr-only" />
                {label(w)}
              </label>
            ))}
          </div>
        </fieldset>
        {when === "schedule" && (
          <div>
            <label className="field-label" htmlFor="post-at">Día y hora</label>
            <input id="post-at" name="at" type="datetime-local" required min={minAt} value={at} onChange={(e) => setAt(e.target.value)} className="input h-11 text-base sm:max-w-xs" />
            {sentence && <p className="mt-1.5 text-sm text-muted">{sentence}</p>}
          </div>
        )}
        <label className={`flex min-h-11 items-start gap-3 text-sm ${notifyLocked ? "opacity-70" : ""}`}>
          <input type="checkbox" name="notify" defaultChecked={post.notify} disabled={notifyLocked} className="mt-0.5 h-5 w-5 accent-[#0E1024]" />
          <span>
            <span className="font-semibold">Avisar por email a {members === 1 ? "mi miembro" : `mis ${members} miembros`}</span>
            <span className="block text-xs text-muted">
              {notifiedNote ?? (notifyLocked ? "Ya está publicada: no se vuelve a avisar al editarla." : "Sale cuando se publique. No lo reciben quienes se dieron de baja de los avisos.")}
            </span>
          </span>
        </label>
        {notifyLocked && post.notify && <input type="hidden" name="notify" value="on" />}
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" name="commentsOpen" defaultChecked={post.commentsOpen} className="mt-0.5 h-5 w-5 accent-[#0E1024]" />
          <span>
            <span className="font-semibold">Permitir comentarios</span>
            <span className="block text-xs text-muted">Tus miembros podrán comentar y tú responder o borrar.</span>
          </span>
        </label>
      </section>

      {/* Barra de acciones: pegada abajo en el iPhone (encima del menú del panel), a mano del pulgar. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper/95 p-2.5 shadow-lift backdrop-blur">
          <button type="submit" className="btn btn-primary h-12 flex-1 sm:flex-none" disabled={pending || uploading}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {uploading ? "Esperando a la subida…" : primary}
          </button>
          {post.id && (
            <Link href={`/cuenta/membresias/${productId}/${post.id}`} className="btn btn-outline h-12">
              <Eye className="h-4 w-4" /> Vista previa
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
