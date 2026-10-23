"use client";
import { ArrowDown, ArrowUp, FileText, Headphones, Loader2, Pencil, PlayCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Flash } from "@/components/ui/flash";
import { LESSON_KIND_LABEL, LESSON_KINDS, type LessonKind } from "@/lib/types";
import { videoEmbed } from "@/lib/video-embed";
import { addModule, deleteLesson, deleteModule, moveLesson, renameModule, saveLesson, type ActionState } from "../actions";

type Lesson = { id: string; title: string; kind: string; body: string | null; bodyFormat: string | null; mediaUrl: string | null; fileId: string | null; durationMin: number | null };
type Module = { id: string; title: string; lessons: Lesson[] };
type FileOpt = { id: string; name: string; kind: string; durationSec?: number | null; videoCodec?: string | null };

const FILE_KIND = { VIDEO: "vídeo", AUDIO: "audio", PDF: "PDF", IMAGE: "imagen" } as Record<string, string>;

/** «Clase 3 (vídeo · 23 min)». */
function fileLabel(f: FileOpt) {
  const bits = [FILE_KIND[f.kind], f.durationSec ? `${Math.max(1, Math.round(f.durationSec / 60))} min` : null].filter(Boolean);
  return bits.length ? `${f.name} (${bits.join(" · ")})` : f.name;
}

const ICON: Record<string, typeof FileText> = { VIDEO: PlayCircle, AUDIO: Headphones, PDF: FileText, TEXT: FileText, EXERCISE: Sparkles };

/** Aviso en vivo bajo el enlace del vídeo: se ve dentro del curso o se abrirá fuera. */
function VideoLinkHint({ url }: { url: string }) {
  const u = url.trim();
  if (!u)
    return (
      <p className="field-hint">
        Vimeo: para un vídeo oculto, copia el enlace completo (Compartir › Copiar enlace, con el código del final) y permite tu web en Vimeo › Privacidad › Dónde se puede insertar.
      </p>
    );
  const v = videoEmbed(u);
  if (v)
    return (
      <p className="text-xs font-medium text-success" aria-live="polite">
        {v.provider === "youtube" ? "YouTube" : v.src.includes("h=") ? "Vimeo · oculto" : "Vimeo"} ✓ Se verá dentro del curso.
      </p>
    );
  return (
    <p className="rounded-lg border border-[#ecdcb8] bg-[#fbf5e8] px-3 py-2 text-xs text-[#7a5a1c]" aria-live="polite" data-video-warning>
      Este enlace no se puede ver dentro del curso: tus alumnas verán un botón «Abrir el vídeo». Para verlo aquí, usa YouTube o Vimeo (Compartir › Copiar enlace, con el código del final si es oculto).
    </p>
  );
}

function LessonForm({ moduleId, lesson, files, onDone }: { moduleId: string; lesson?: Lesson; files: FileOpt[]; onDone: () => void }) {
  const [state, action, isPending] = useActionState<ActionState, FormData>(saveLesson, undefined);
  const [kind, setKind] = useState<LessonKind>((lesson?.kind as LessonKind) ?? "VIDEO");
  const minutes = useRef<HTMLInputElement>(null);
  const [mediaUrl, setMediaUrl] = useState(lesson?.mediaUrl ?? "");
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-3 rounded-2xl border border-line bg-paper p-4"
    >
      <Flash error={state?.error} />
      <input type="hidden" name="moduleId" value={moduleId} />
      {lesson && <input type="hidden" name="id" value={lesson.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_110px]">
        <input name="title" defaultValue={lesson?.title} placeholder="Título de la lección" className="input h-10 text-base sm:text-sm" required />
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as LessonKind)} className="input h-10 text-base sm:text-sm">
          {LESSON_KINDS.map((k) => <option key={k} value={k}>{LESSON_KIND_LABEL[k]}</option>)}
        </select>
        <input ref={minutes} name="durationMin" type="number" min={0} max={600} defaultValue={lesson?.durationMin ?? ""} placeholder="Min" aria-label="Minutos" className="input h-10 text-base sm:text-sm" />
      </div>
      {(kind === "VIDEO" || kind === "AUDIO" || kind === "PDF" || kind === "EXERCISE") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            name="fileId"
            defaultValue={lesson?.fileId ?? ""}
            className="input h-10 text-base sm:text-sm"
            aria-label="Archivo del curso"
            onChange={(e) => {
              // «Min» vacío: se rellena con la duración del archivo (leída al subirlo).
              const f = files.find((x) => x.id === e.target.value);
              if (f?.durationSec && minutes.current && !minutes.current.value) minutes.current.value = String(Math.ceil(f.durationSec / 60));
            }}
          >
            <option value="">— Archivo del curso —</option>
            {files.map((f) => <option key={f.id} value={f.id}>{fileLabel(f)}</option>)}
          </select>
          {kind === "VIDEO" && (
            <input
              name="mediaUrl"
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="o enlace de YouTube / Vimeo"
              aria-label="Enlace del vídeo"
              className="input h-10 text-base sm:text-sm"
            />
          )}
        </div>
      )}
      {kind === "VIDEO" && <VideoLinkHint url={mediaUrl} />}
      <RichTextEditor
        name="body"
        ariaLabel="Texto de la lección"
        formatName="bodyFormat"
        defaultValue={lesson?.body ?? ""}
        initialFormat={lesson ? lesson.bodyFormat : "MD"}
        maxLength={20000}
        tools="full"
        images
        tone="account"
        headingLevel={3}
        legacy="paragraphs"
        rows={4}
        placeholder="Texto de la lección, instrucciones del ejercicio…"
      />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar lección</button>
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">Cancelar</button>
      </div>
    </form>
  );
}

export function CourseBuilder({ productId, modules, files }: { productId: string; modules: Module[]; files: FileOpt[] }) {
  const [editing, setEditing] = useState<string | null>(null); // lessonId | "new:<moduleId>"
  const total = modules.reduce((a, m) => a + m.lessons.length, 0);
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Programa del curso</h3>
          <p className="text-xs text-muted">{modules.length} módulos · {total} lecciones. Sube primero los vídeos, audios y PDF en «Materiales».</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {modules.map((m, mi) => (
          <div key={m.id} className="rounded-2xl border border-line">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="text-xs font-semibold text-muted">M{mi + 1}</span>
              <form action={renameModule} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={m.id} />
                <input name="title" defaultValue={m.title} className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 font-semibold outline-none hover:bg-sand focus:bg-white focus:ring-1 focus:ring-line" />
                <button className="btn btn-ghost btn-sm hidden sm:inline-flex">Renombrar</button>
              </form>
              <form action={deleteModule} onSubmit={(e) => { if (!confirm("¿Eliminar este módulo y sus lecciones?")) e.preventDefault(); }}>
                <input type="hidden" name="id" value={m.id} />
                <button className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Eliminar módulo"><Trash2 className="h-3.5 w-3.5" /></button>
              </form>
            </div>
            <ul className="divide-y divide-line">
              {m.lessons.map((l, li) => {
                const Icon = ICON[l.kind] ?? FileText;
                return editing === l.id ? (
                  <li key={l.id} className="p-3"><LessonForm moduleId={m.id} lesson={l} files={files} onDone={() => setEditing(null)} /></li>
                ) : (
                  <li key={l.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    <span className="hidden text-xs text-faint sm:inline">{LESSON_KIND_LABEL[l.kind as LessonKind]}{l.durationMin ? ` · ${l.durationMin} min` : ""}</span>
                    <form action={moveLesson}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="dir" value="up" /><button disabled={li === 0} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button></form>
                    <form action={moveLesson}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="dir" value="down" /><button disabled={li === m.lessons.length - 1} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button></form>
                    <button type="button" onClick={() => setEditing(l.id)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                    <form action={deleteLesson} onSubmit={(e) => { if (!confirm("¿Eliminar la lección?")) e.preventDefault(); }}><input type="hidden" name="id" value={l.id} /><button className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button></form>
                  </li>
                );
              })}
            </ul>
            <div className="p-3">
              {editing === `new:${m.id}` ? (
                <LessonForm moduleId={m.id} files={files} onDone={() => setEditing(null)} />
              ) : (
                <button type="button" onClick={() => setEditing(`new:${m.id}`)} className="btn btn-ghost btn-sm"><Plus className="h-4 w-4" /> Añadir lección</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <form action={addModule} className="mt-4 flex gap-2">
        <input type="hidden" name="productId" value={productId} />
        <input name="title" placeholder={`Módulo ${modules.length + 1}`} className="input h-10 flex-1 text-sm" />
        <button className="btn btn-outline btn-sm h-10"><Plus className="h-4 w-4" /> Añadir módulo</button>
      </form>
    </section>
  );
}
