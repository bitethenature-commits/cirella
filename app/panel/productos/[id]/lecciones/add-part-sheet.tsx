"use client";
import { FolderOpen, Link2, Upload, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatDuration, formatSize } from "@/components/media/media-health";
import { ADD_PART, type AddPartKind } from "@/lib/lesson-parts";
import type { EditorFile } from "./part-card";

const NOUN: Record<AddPartKind, string> = { VIDEO: "vídeos", AUDIO: "audios", PDF: "PDF", IMAGE: "imágenes", OTHER: "otros archivos" };

/**
 * Hoja para añadir un vídeo, audio, PDF, imagen u otro archivo: subirlo desde el dispositivo (en el
 * iPhone, Fotos o Archivos según el accept), elegirlo de los materiales del curso o, si es un vídeo,
 * pegar un enlace de YouTube o Vimeo. <dialog> nativo: abajo en el móvil, centrado en el ordenador.
 */
export function AddPartSheet({
  add,
  files,
  uploadLabel,
  onUpload,
  onPick,
  onEmbed,
  onClose,
}: {
  add: AddPartKind;
  files: EditorFile[];
  uploadLabel: string;
  onUpload: (files: File[]) => void;
  onPick: (fileId: string) => void;
  onEmbed: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cfg = ADD_PART[add];
  const options = files.filter((f) => cfg.fileKinds.includes(f.kind));

  useEffect(() => {
    const d = dialog.current;
    // Al desmontarse, el <dialog> sale del DOM y deja de ser modal (sin close(): avisaría a onClose).
    if (d && !d.open) d.showModal();
  }, []);

  const row = "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm hover:bg-sand active:bg-sand";

  return (
    <dialog
      ref={dialog}
      aria-label={`Añadir ${cfg.label.toLowerCase()}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85svh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl bg-paper p-0 pb-[env(safe-area-inset-bottom)] text-ink shadow-lift backdrop:bg-ink/40 lg:inset-0 lg:m-auto lg:max-w-lg lg:rounded-3xl lg:pb-0"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="font-semibold">Añadir {cfg.label.toLowerCase()}</p>
        <button type="button" className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand" aria-label="Cerrar" onClick={() => dialog.current?.close()}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-4 p-3">
        <div>
          <button type="button" className={row} onClick={() => input.current?.click()}>
            <Upload className="h-5 w-5 shrink-0 text-lavender-deep" />
            <span className="flex-1">
              <span className="block font-semibold">Subir desde este dispositivo</span>
              <span className="block text-xs text-muted">{uploadLabel}</span>
            </span>
          </button>
          <input
            ref={input}
            type="file"
            accept={cfg.accept}
            multiple={cfg.multiple}
            className="hidden"
            data-add-upload={add}
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (list.length) onUpload(list);
            }}
          />
        </div>

        {cfg.embed && (
          <button type="button" className={row} onClick={onEmbed}>
            <Link2 className="h-5 w-5 shrink-0 text-lavender-deep" />
            <span className="flex-1 font-semibold">Pegar un enlace de YouTube o Vimeo</span>
          </button>
        )}

        <div>
          <p className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            <FolderOpen className="h-3.5 w-3.5" /> Elegir de los materiales del curso
          </p>
          {options.length ? (
            <ul className="space-y-0.5" role="list">
              {options.map((f) => (
                <li key={f.id}>
                  <button type="button" className={row} onClick={() => onPick(f.id)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="block text-xs text-muted">
                        {[f.kind === "LINK" ? "Enlace" : null, f.durationSec ? formatDuration(f.durationSec) : null, f.sizeBytes ? formatSize(f.sizeBytes) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted">Todavía no hay {NOUN[add]} en los materiales del curso.</p>
          )}
        </div>
      </div>
    </dialog>
  );
}
