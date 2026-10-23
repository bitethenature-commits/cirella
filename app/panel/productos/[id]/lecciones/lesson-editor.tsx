"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, FileText, Headphones, Image as ImageIcon, Loader2, Paperclip, PlayCircle, Trash2, Type } from "lucide-react";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Flash } from "@/components/ui/flash";
import type { UploadedFile } from "@/components/ui/upload-client";
import { MAX_LESSON_PARTS, suggestedLessonMinutes, type AddPartKind } from "@/lib/lesson-parts";
import { deleteLesson, saveLesson, type LessonActionState } from "../../actions";
import { AddPartSheet } from "./add-part-sheet";
import { PartCard, type EditorFile, type EditorPart } from "./part-card";
import { useLessonDraft, type DraftData } from "./use-lesson-draft";
import { useUploadQueue } from "./use-upload-queue";

export type EditorLesson = {
  id: string | null;
  moduleId: string;
  title: string;
  durationMin: number | null;
  version: number | null;
  parts: EditorPart[];
};

type Serial = { kind: "TEXT"; body: string; format: string } | { kind: "FILE"; fileId: string } | { kind: "EMBED"; url: string };

/** Lo que se envía y se guarda en el borrador (las subidas en curso no). */
function serialParts(parts: EditorPart[]): Serial[] {
  return parts.flatMap((p): Serial[] =>
    p.kind === "TEXT" ? [{ kind: "TEXT", body: p.body, format: p.format ?? "" }] : p.kind === "FILE" ? [{ kind: "FILE", fileId: p.fileId }] : p.kind === "EMBED" ? [{ kind: "EMBED", url: p.url }] : [],
  );
}

function fromSerial(parts: unknown[]): EditorPart[] {
  return parts.flatMap((raw, i): EditorPart[] => {
    const p = raw as Partial<Serial> & { kind?: string };
    const key = `d${i}-${Date.now()}`;
    if (p.kind === "TEXT" && typeof (p as { body?: unknown }).body === "string")
      return [{ key, kind: "TEXT", body: (p as { body: string }).body, format: (p as { format?: string }).format === "MD" ? "MD" : null }];
    if (p.kind === "FILE" && typeof (p as { fileId?: unknown }).fileId === "string") return [{ key, kind: "FILE", fileId: (p as { fileId: string }).fileId }];
    if (p.kind === "EMBED" && typeof (p as { url?: unknown }).url === "string") return [{ key, kind: "EMBED", url: (p as { url: string }).url }];
    return [];
  });
}

const ADD_BUTTONS: { add: AddPartKind | "TEXT"; label: string; icon: typeof FileText }[] = [
  { add: "VIDEO", label: "Vídeo", icon: PlayCircle },
  { add: "AUDIO", label: "Audio", icon: Headphones },
  { add: "TEXT", label: "Texto", icon: Type },
  { add: "PDF", label: "PDF", icon: FileText },
  { add: "IMAGE", label: "Imagen", icon: ImageIcon },
];

let seq = 0;
const newKey = () => `n${++seq}-${Date.now().toString(36)}`;

/**
 * Editor de una lección a pantalla completa (iPhone primero): título, módulo, duración y el
 * contenido en el orden en que lo verán sus alumnas (vídeo, audio, texto con formato, PDF,
 * imágenes…). Todo es un solo paso del progreso. Subidas en cola con progreso, borrador local por
 * si Safari recarga la pestaña y aviso si otra pantalla guardó antes (versión).
 */
export function LessonEditor({
  productId,
  productTitle,
  modules,
  files: initialFiles,
  lesson,
  uploadLabel,
  initialMessage,
  initialWarning,
}: {
  productId: string;
  productTitle: string;
  modules: { id: string; title: string }[];
  files: EditorFile[];
  lesson: EditorLesson;
  uploadLabel: string;
  initialMessage?: string | null;
  /** Aviso del guardado que llevó aquí (una lección nueva se guarda y se abre en su página). */
  initialWarning?: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<LessonActionState, FormData>(saveLesson, undefined);
  const [lessonId, setLessonId] = useState(lesson.id);
  const [version, setVersion] = useState(lesson.version);
  const [title, setTitle] = useState(lesson.title);
  const [moduleId, setModuleId] = useState(lesson.moduleId);
  const [durationMin, setDurationMin] = useState(lesson.durationMin ? String(lesson.durationMin) : "");
  const [parts, setParts] = useState<EditorPart[]>(lesson.parts);
  const [files, setFiles] = useState<EditorFile[]>(initialFiles);
  const [sheet, setSheet] = useState<AddPartKind | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editorGen, setEditorGen] = useState(0);
  const [showInitial, setShowInitial] = useState(true);
  const focusKey = useRef<string | null>(null);
  const sent = useRef<string | null>(null);

  const data: DraftData = useMemo(() => ({ title, moduleId, durationMin, parts: serialParts(parts) }), [title, moduleId, durationMin, parts]);
  const serial = JSON.stringify(data);
  const [clean, setClean] = useState(serial);
  const dirty = serial !== clean;
  const uploading = parts.some((p) => p.kind === "UPLOAD" && p.status !== "error");
  const fileById = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const suggested = suggestedLessonMinutes([...new Set(parts.flatMap((p) => (p.kind === "FILE" ? [p.fileId] : [])))].map((id) => fileById.get(id)?.durationSec));

  const draft = useLessonDraft(`cirella:leccion:${lesson.id ?? `nueva:${lesson.moduleId}`}`, version, data, dirty);

  const update = (key: string, fn: (p: EditorPart) => EditorPart | null) =>
    setParts((list) => list.flatMap((p) => (p.key === key ? [fn(p)].filter((x): x is EditorPart => !!x) : [p])));

  const queue = useUploadQueue(productId, {
    onStart: (key) => update(key, (p) => (p.kind === "UPLOAD" ? { ...p, status: "uploading", pct: 0, error: undefined } : p)),
    onProgress: (key, pct, loaded, total) => update(key, (p) => (p.kind === "UPLOAD" ? { ...p, pct, loaded, total } : p)),
    onDone: (key, f: UploadedFile) => {
      setFiles((list) => (list.some((x) => x.id === f.id) ? list : [...list, { id: f.id, name: f.name, kind: f.kind, sizeBytes: f.sizeBytes, durationSec: f.durationSec ?? null, videoCodec: f.videoCodec ?? null }]));
      update(key, () => ({ key, kind: "FILE", fileId: f.id }));
      router.refresh();
    },
    onError: (key, message) => update(key, (p) => (p.kind === "UPLOAD" ? { ...p, status: "error", error: message } : p)),
  });

  // Resultado de guardar.
  useEffect(() => {
    if (!state) return;
    setShowInitial(false);
    if (!state.ok || !state.lessonId) return;
    draft.clear();
    setVersion(state.version ?? null);
    if (sent.current) setClean(sent.current);
    if (!lessonId) {
      setLessonId(state.lessonId);
      router.replace(`/panel/productos/${productId}/lecciones/${state.lessonId}?guardada=1${state.warning ? "&aviso=enlace" : ""}`);
    }
    // Solo cuando llega una respuesta nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Cerrar o recargar con cambios sin guardar o subiendo: el navegador pregunta.
  useEffect(() => {
    if (!dirty && !uploading) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, uploading]);

  // Foco en el texto recién añadido.
  useEffect(() => {
    if (!focusKey.current) return;
    const el = document.querySelector<HTMLTextAreaElement>(`[data-part-key="${focusKey.current}"] textarea`);
    focusKey.current = null;
    el?.focus();
  }, [parts]);

  const room = MAX_LESSON_PARTS - parts.length;
  const add = (items: EditorPart[]) => {
    setNote(null);
    setParts((list) => [...list, ...items].slice(0, MAX_LESSON_PARTS));
  };

  const addText = () => {
    const key = newKey();
    focusKey.current = key;
    add([{ key, kind: "TEXT", body: "", format: "MD" }]);
  };

  const upload = (kind: AddPartKind, list: File[]) => {
    setSheet(null);
    const take = list.slice(0, Math.max(0, room));
    if (take.length < list.length) setNote(`Una lección puede tener hasta ${MAX_LESSON_PARTS} partes: hemos añadido ${take.length}.`);
    const items = take.map((f): EditorPart => ({ key: newKey(), kind: "UPLOAD", add: kind, name: f.name, pct: 0, loaded: 0, total: f.size, status: "queued" }));
    add(items);
    items.forEach((p, i) => queue.enqueue(p.key, take[i]));
  };

  const move = (i: number, dir: -1 | 1) =>
    setParts((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = () => {
    const fd = new FormData();
    if (lessonId) fd.set("id", lessonId);
    fd.set("moduleId", moduleId);
    fd.set("title", title);
    fd.set("durationMin", durationMin.trim());
    if (version != null) fd.set("version", String(version));
    fd.set("parts", JSON.stringify(data.parts));
    sent.current = serial;
    startTransition(() => action(fd));
  };

  const fmtTime = (at: number) => new Date(at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const previewHref = lessonId ? `/cuenta/cursos/${productId}?leccion=${lessonId}` : null;
  const okMessage = state?.ok ?? (showInitial ? initialMessage : null);
  const warning = state ? state.warning : showInitial ? initialWarning : null;
  const status = uploading ? "Esperando a que termine la subida…" : pending ? "Guardando…" : dirty ? "Cambios sin guardar" : lessonId ? "Guardada" : "Lección nueva";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/panel/productos/${productId}#lecciones`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {productTitle}
      </Link>
      <div className="mb-5 mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-[2.1rem] leading-tight">{lessonId ? "Editar lección" : "Nueva lección"}</h1>
        {previewHref && !dirty ? (
          <a href={previewHref} target="_blank" rel="noopener" className="btn btn-outline btn-sm">
            <Eye className="h-4 w-4" /> Ver como alumna
          </a>
        ) : (
          <span className="btn btn-outline btn-sm pointer-events-none opacity-50" aria-disabled title="Guarda primero">
            <Eye className="h-4 w-4" /> Ver como alumna <span className="text-xs font-normal">· Guarda primero</span>
          </span>
        )}
      </div>

      {draft.restorable && (
        <div className="mb-5 rounded-2xl border border-[#ecdcb8] bg-[#fbf5e8] p-4 text-sm text-[#7a5a1c]" role="status">
          <p>Tienes cambios sin guardar de las {fmtTime(draft.restorable.at)} en este dispositivo.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                const d = draft.restore();
                if (!d) return;
                setTitle(d.title);
                if (modules.some((m) => m.id === d.moduleId)) setModuleId(d.moduleId);
                setDurationMin(d.durationMin);
                setParts((list) => [...fromSerial(d.parts), ...list.filter((p) => p.kind === "UPLOAD")]);
                setEditorGen((g) => g + 1);
              }}
            >
              Recuperar
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={draft.discard}>
              Descartar
            </button>
          </div>
        </div>
      )}

      <Flash ok={okMessage} />
      {warning && <p className="mb-5 rounded-xl border border-[#ecdcb8] bg-[#fbf5e8] px-4 py-3 text-sm text-[#7a5a1c]">{warning}</p>}

      <section className="card space-y-4 p-5">
        <div>
          <label className="field-label" htmlFor="lesson-title">
            Título de la lección
          </label>
          <input id="lesson-title" className="input text-base sm:text-sm" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required placeholder="Título de la lección" />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div>
            <label className="field-label" htmlFor="lesson-module">
              Módulo
            </label>
            <select id="lesson-module" className="input text-base sm:text-sm" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              {modules.map((m, i) => (
                <option key={m.id} value={m.id}>
                  {`M${i + 1} · ${m.title}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="lesson-duration">
              Duración (min)
            </label>
            <input
              id="lesson-duration"
              className="input text-base sm:text-sm"
              inputMode="numeric"
              pattern="[0-9]*"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              placeholder={suggested ? `Auto · ${suggested}` : "Auto"}
            />
          </div>
        </div>
        <p className="field-hint">Si dejas la duración vacía, la calculamos con los vídeos y audios.</p>
      </section>

      <section className="mt-6" aria-labelledby="contenido">
        <h2 id="contenido" className="font-semibold">
          Contenido de la lección
        </h2>
        <p className="text-xs text-muted">Todo esto es un solo paso: tu alumna lo marca como completado una vez.</p>
        {parts.length ? (
          <ol className="mt-4 space-y-4" aria-label="Partes de la lección">
            {parts.map((p, i) => (
                <PartCard
                  key={p.key}
                  part={p}
                  file={p.kind === "FILE" ? fileById.get(p.fileId) : undefined}
                  index={i}
                  count={parts.length}
                  editorKey={editorGen}
                  onMove={(dir) => move(i, dir)}
                  onRemove={() => {
                    if (p.kind === "FILE") setNote("Quitado de la lección. El archivo sigue en los materiales del curso.");
                    update(p.key, () => null);
                  }}
                  onPatch={(patch) => update(p.key, (x) => ({ ...x, ...patch }) as EditorPart)}
                  onCancel={() => {
                    queue.cancel(p.key);
                    update(p.key, () => null);
                  }}
                  onRetry={() => {
                    if (!queue.retry(p.key)) update(p.key, () => null);
                    else update(p.key, (x) => (x.kind === "UPLOAD" ? { ...x, status: "queued", error: undefined, pct: 0 } : x));
                  }}
                />
            ))}
          </ol>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Esta lección aún está vacía. Añade un vídeo, un audio, un texto, un PDF o una imagen.
          </p>
        )}
        {note && (
          <p className="mt-3 text-xs text-muted" aria-live="polite">
            {note}
          </p>
        )}

        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">Añadir a la lección</p>
          {room > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {ADD_BUTTONS.map((b) => (
                  <button
                    key={b.add}
                    type="button"
                    className="btn btn-outline h-14 justify-center"
                    onClick={() => (b.add === "TEXT" ? addText() : setSheet(b.add))}
                  >
                    <b.icon className="h-5 w-5" /> {b.label}
                  </button>
                ))}
              </div>
              <button type="button" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink" onClick={() => setSheet("OTHER")}>
                <Paperclip className="h-4 w-4" /> Otro archivo (ZIP, EPUB o enlace)
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">Una lección puede tener hasta {MAX_LESSON_PARTS} partes. Para más, crea otra lección.</p>
          )}
        </div>
      </section>

      {lessonId && (
        <ConfirmForm action={deleteLesson} message="¿Eliminar esta lección? Tus alumnas perderán su progreso en ella." className="mt-10">
          <input type="hidden" name="id" value={lessonId} />
          <input type="hidden" name="back" value="curso" />
          <button className="btn btn-danger btn-sm">
            <Trash2 className="h-4 w-4" /> Eliminar lección
          </button>
        </ConfirmForm>
      )}

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 mt-8 lg:bottom-4">
        {state?.error && (
          <div className="mb-2">
            <Flash error={state.error} />
          </div>
        )}
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper/95 p-2.5 pl-4 shadow-lift backdrop-blur">
          <p className="min-w-0 flex-1 text-xs text-muted" aria-live="polite" data-save-status>
            {status}
          </p>
          <button type="button" className="btn btn-primary h-12" disabled={uploading || pending || !title.trim()} onClick={save}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar lección
          </button>
        </div>
      </div>

      {sheet && (
        <AddPartSheet
          add={sheet}
          files={files}
          uploadLabel={uploadLabel}
          onClose={() => setSheet(null)}
          onUpload={(list) => upload(sheet, list)}
          onPick={(fileId) => {
            setSheet(null);
            add([{ key: newKey(), kind: "FILE", fileId }]);
          }}
          onEmbed={() => {
            setSheet(null);
            add([{ key: newKey(), kind: "EMBED", url: "" }]);
          }}
        />
      )}
    </div>
  );
}
