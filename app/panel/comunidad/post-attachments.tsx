"use client";

import { ArrowDown, ArrowUp, FileImage, FileText, Headphones, ImagePlus, Loader2, Paperclip, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatSize, MediaHealth } from "@/components/media/media-health";
import { UPLOAD_CANCELLED, uploadFile, type UploadedFile } from "@/components/ui/upload-client";
import { ATTACHMENTS_MAX } from "@/lib/community-rules";
import { PRIVATE_ACCEPT } from "@/lib/file-types";

export type Attachment = UploadedFile & { width?: number | null; height?: number | null };

const ICON: Record<string, typeof FileText> = { PDF: FileText, AUDIO: Headphones, VIDEO: Video, IMAGE: FileImage };
const KIND_LABEL: Record<string, string> = { PDF: "PDF", AUDIO: "Audio", VIDEO: "Vídeo", IMAGE: "Imagen" };

/**
 * Adjuntos de una publicación: audio, vídeo, PDF o imagen (hasta 10). Se suben al momento a los
 * archivos de la membresía (la misma subida que los materiales de un curso, por partes si es grande)
 * y quedan unidos a la publicación al guardarla (inputs ocultos `attachmentIds`, en orden).
 */
export function PostAttachments({
  productId,
  initial,
  limitsLabel,
  onFirstMedia,
  onBusy,
  quickPick = false,
}: {
  productId: string;
  initial: Attachment[];
  limitsLabel: string;
  /** El primer adjunto es un audio o un vídeo: el editor puede cambiar el tipo de la publicación. */
  onFirstMedia?: (kind: "AUDIO" | "VIDEO") => void;
  onBusy?: (busy: boolean) => void;
  /** Botones «Fotos», «Audio» y «Vídeo» que abren el selector solo con ese tipo (compositor del estudio). */
  quickPick?: boolean;
}) {
  const [files, setFiles] = useState<Attachment[]>(initial);
  const [progress, setProgress] = useState<{ name: string; pct: number; loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const busy = !!progress;

  useEffect(() => {
    onBusy?.(busy);
    if (!busy) return;
    // Cerrar o recargar la pestaña a mitad de una subida la pierde: se avisa.
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, onBusy]);

  const upload = async (list: FileList) => {
    setError(null);
    let count = files.length;
    let hadAny = files.length > 0;
    for (const file of Array.from(list)) {
      if (count >= ATTACHMENTS_MAX) {
        setError(`Máximo ${ATTACHMENTS_MAX} archivos por publicación.`);
        break;
      }
      const ctrl = new AbortController();
      abort.current = ctrl;
      setProgress({ name: file.name, pct: 0, loaded: 0, total: file.size });
      try {
        const r = await uploadFile(file, {
          purpose: "file",
          productId,
          signal: ctrl.signal,
          onProgress: (pct, loaded, total) => setProgress({ name: file.name, pct, loaded, total }),
        });
        if (r.file) {
          const added = r.file;
          count++;
          if (!hadAny && (added.kind === "AUDIO" || added.kind === "VIDEO")) onFirstMedia?.(added.kind);
          hadAny = true;
          setFiles((prev) => [...prev, added]);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al subir";
        setError(msg === UPLOAD_CANCELLED ? `«${file.name}»: subida cancelada.` : `«${file.name}»: ${msg}`);
        if (msg === UPLOAD_CANCELLED) break;
      }
    }
    abort.current = null;
    setProgress(null);
    if (input.current) input.current.value = "";
  };

  /** Abre el selector de archivos (con `accept`: solo ese tipo). */
  const pick = (accept: string) => {
    if (!input.current) return;
    input.current.accept = accept;
    input.current.click();
  };

  const move = (i: number, d: -1 | 1) =>
    setFiles((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="space-y-3">
      {files.map((f) => (
        <input key={f.id} type="hidden" name="attachmentIds" value={f.id} />
      ))}
      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line" aria-label="Archivos de la publicación">
          {files.map((f, i) => {
            const Icon = ICON[f.kind] ?? Paperclip;
            return (
              <li key={f.id} className="flex items-center gap-2 px-3 py-2.5 text-sm" data-attachment={f.kind}>
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="text-xs text-muted">
                    {KIND_LABEL[f.kind] ?? "Archivo"}
                    {f.sizeBytes ? ` · ${formatSize(f.sizeBytes)}` : ""}
                  </span>
                  <MediaHealth file={f} />
                </div>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-30" aria-label={`Subir ${f.name}`}>
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === files.length - 1} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-30" aria-label={`Bajar ${f.name}`}>
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label={`Quitar ${f.name}`}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {progress && (
        <div className="rounded-xl border border-line bg-paper p-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="min-w-0 flex-1 text-sm text-muted">
              Subiendo «{progress.name}» · {progress.pct} %{progress.total ? ` · ${formatSize(progress.loaded)} de ${formatSize(progress.total)}` : ""}
            </p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => abort.current?.abort()}>
              Cancelar
            </button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
            <div className="h-full bg-ink transition-[width]" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">No bloquees el iPhone ni cambies de app mientras se sube.</p>
        </div>
      )}
      {error && <p className="text-sm text-rose" role="alert">{error}</p>}
      {files.length < ATTACHMENTS_MAX && (
        <div>
          <div className="flex flex-wrap gap-2">
            {quickPick && (
              <>
                <button type="button" onClick={() => pick(".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif")} disabled={busy} className="btn btn-outline min-h-11">
                  <ImagePlus className="h-4 w-4" /> Fotos
                </button>
                <button type="button" onClick={() => pick(".m4a,.mp3,.wav,audio/mp4,audio/x-m4a,audio/mpeg,audio/wav")} disabled={busy} className="btn btn-outline min-h-11">
                  <Headphones className="h-4 w-4" /> Audio
                </button>
                <button type="button" onClick={() => pick(".mp4,.m4v,.mov,video/mp4,video/quicktime")} disabled={busy} className="btn btn-outline min-h-11">
                  <Video className="h-4 w-4" /> Vídeo
                </button>
              </>
            )}
            <button type="button" onClick={() => pick(PRIVATE_ACCEPT)} disabled={busy} className={`btn btn-outline min-h-11 ${quickPick ? "" : "w-full sm:w-auto"}`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} {quickPick ? "PDF u otro archivo" : "Añadir audio, vídeo, PDF o imagen"}
            </button>
          </div>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            accept={PRIVATE_ACCEPT}
            aria-label="Añadir archivos a la publicación"
            data-testid="post-attachments-input"
            onChange={(e) => e.target.files?.length && upload(e.target.files)}
          />
          <p className="mt-1.5 text-xs text-muted">{limitsLabel} Solo los verán tus miembros. Quitar un archivo de aquí lo borra al guardar.</p>
        </div>
      )}
    </div>
  );
}
