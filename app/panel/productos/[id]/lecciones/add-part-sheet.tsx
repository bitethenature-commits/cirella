"use client";
import { FolderOpen, Link2, Upload } from "lucide-react";
import { useRef } from "react";
import { formatDuration, formatSize } from "@/components/media/media-health";
import { ADD_PART, type AddPartKind } from "@/lib/lesson-parts";
import type { EditorFile } from "./part-card";
import { Tr } from "@/lib/i18n/client";

const NOUN: Record<AddPartKind, string> = { VIDEO: "vídeos", AUDIO: "audios", PDF: "PDF", IMAGE: "imágenes", OTHER: "otros archivos" };

/**
 * Añadir un vídeo, audio, PDF, imagen u otro archivo (en el panel de la izquierda del editor del curso): subirlo
 * desde el dispositivo (en el iPhone, Fotos o Archivos según el accept), elegirlo de los materiales del curso o, si
 * es un vídeo, pegar un enlace de YouTube o Vimeo.
 */
export function AddPartOptions({
  add,
  files,
  uploadLabel,
  onUpload,
  onPick,
  onEmbed,
}: {
  add: AddPartKind;
  files: EditorFile[];
  uploadLabel: string;
  onUpload: (files: File[]) => void;
  onPick: (fileId: string) => void;
  onEmbed: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const cfg = ADD_PART[add];
  const options = files.filter((f) => cfg.fileKinds.includes(f.kind));

  const row = "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm hover:bg-sand active:bg-sand";

  return (
    <div className="-mx-2 space-y-4">
      <div>
        <button type="button" className={row} onClick={() => input.current?.click()}>
          <Upload className="h-5 w-5 shrink-0 text-lavender-deep" />
          <span className="flex-1">
            <span className="block font-semibold"><Tr s={"Subir desde este dispositivo"} /></span>
            <span className="block text-xs text-muted"><Tr s={uploadLabel} /></span>
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
          <span className="flex-1 font-semibold"><Tr s={"Pegar un enlace de YouTube o Vimeo"} /></span>
        </button>
      )}

      <div>
        <p className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          <FolderOpen className="h-3.5 w-3.5" />{" "}<Tr s={"De los materiales del curso"} /></p>
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
          <p className="px-3 py-2 text-sm text-muted"><Tr s={"Todavía no hay"} />{" "}<Tr s={NOUN[add]} />{" "}<Tr s={"en los materiales del curso."} /></p>
        )}
      </div>
    </div>
  );
}
