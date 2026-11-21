"use client";
import { AlertCircle, ExternalLink, RotateCcw } from "lucide-react";
import { formatDuration, formatSize, MediaHealth } from "@/components/media/media-health";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import type { PieceLook } from "@/lib/course-design";
import { BLOCK_LABEL, isBlockKind, type BlockPart } from "@/lib/lesson-blocks";
import { LESSON_TEXT_MAX, PART_VIEW_LABEL, partView, type AddPartKind } from "@/lib/lesson-parts";
import { videoEmbed } from "@/lib/video-embed";

export type EditorFile = {
  id: string;
  name: string;
  kind: string;
  mimeType?: string | null;
  sizeBytes: number | null;
  durationSec?: number | null;
  videoCodec?: string | null;
  width?: number | null;
  height?: number | null;
  url?: string | null;
};

export type EditorPart = (
  | { key: string; kind: "TEXT"; body: string; format: "MD" | null }
  | { key: string; kind: "FILE"; fileId: string }
  | { key: string; kind: "EMBED"; url: string }
  | ({ key: string } & BlockPart)
  | { key: string; kind: "UPLOAD"; add: AddPartKind; name: string; pct: number; loaded: number; total: number; status: "queued" | "uploading" | "error"; error?: string }
) & {
  /** Su propio diseño (fondo, borde, letra…), encima del de la lección (lib/course-design.ts). */
  design?: PieceLook | null;
};

/** Cambios parciales de una parte (se aplican sobre el estado más reciente: el editor de texto avisa de texto y formato a la vez). */
export type PartPatch = { body?: string; format?: "MD" | null; url?: string; data?: BlockPart["data"] };

/** Aviso en vivo bajo el enlace del vídeo: se ve dentro del curso o se abrirá fuera. */
function EmbedHint({ url }: { url: string }) {
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

/** El nombre de una parte («Texto», «Vídeo de YouTube», «Capítulo»…). */
export function partLabel(part: EditorPart, file?: EditorFile) {
  if (part.kind === "UPLOAD") return "Subiendo";
  if (isBlockKind(part.kind)) return BLOCK_LABEL[part.kind];
  if (part.kind === "EMBED") {
    const v = videoEmbed(part.url);
    return v ? (v.provider === "youtube" ? "Vídeo de YouTube" : "Vídeo de Vimeo") : "Enlace de vídeo";
  }
  if (part.kind === "FILE" && file?.kind === "LINK") return "Enlace";
  return PART_VIEW_LABEL[partView(part.kind, file?.kind)];
}

/**
 * Lo que se cambia de una parte de la lección (en el panel de la derecha del editor): el editor de texto, la ficha
 * del archivo, el enlace del vídeo, los campos de una pieza interactiva o el progreso de la subida.
 */
export function PartFields({
  part,
  file,
  onPatch,
  onCancel,
  onRetry,
  onRemove,
  editorKey = 0,
}: {
  part: EditorPart;
  file?: EditorFile;
  onPatch: (patch: PartPatch) => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onRemove?: () => void;
  /** Cambia cuando el texto llega de fuera: el editor de texto vuelve a empezar con su formato. */
  editorKey?: number;
}) {
  return (
    <>
      {part.kind === "TEXT" && (
        <RichTextEditor
          key={`${part.key}-${editorKey}`}
          ariaLabel="Texto de la lección"
          value={part.body}
          defaultValue={part.body}
          initialFormat={part.format}
          onChange={(body) => onPatch({ body })}
          onFormatChange={(format) => onPatch({ format })}
          maxLength={LESSON_TEXT_MAX}
          tools="full"
          images={false}
          tone="account"
          headingLevel={3}
          legacy="paragraphs"
          rows={10}
          placeholder="Escribe la explicación, las instrucciones del ejercicio…"
        />
      )}

      {part.kind === "FILE" &&
        (file ? (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted">
                {[file.durationSec ? formatDuration(file.durationSec) : null, file.sizeBytes ? formatSize(file.sizeBytes) : null, file.kind === "LINK" ? "Enlace" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <MediaHealth file={file} duration={false} />
            </div>
            <a
              href={file.kind === "LINK" ? (file.url ?? "#") : file.kind === "OTHER" ? `/api/download/${file.id}` : `/cuenta/archivos/${file.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver
            </a>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-rose">
            <AlertCircle className="h-4 w-4" /> Este archivo ya no está en los materiales del curso. Quítalo de la lección.
          </p>
        ))}

      {part.kind === "EMBED" && (
        <div className="space-y-2">
          <label className="field-label" htmlFor={`embed-${part.key}`}>
            Enlace de YouTube o Vimeo
          </label>
          <input
            id={`embed-${part.key}`}
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="input text-base sm:text-sm"
            placeholder="https://youtu.be/… o https://vimeo.com/…"
            value={part.url}
            maxLength={500}
            onChange={(e) => onPatch({ url: e.target.value })}
          />
          <EmbedHint url={part.url} />
        </div>
      )}

      {part.kind === "UPLOAD" && (
        <div aria-live="polite">
          {part.status === "error" ? (
            <div className="space-y-2">
              <p className="text-sm text-rose">
                «{part.name}»: {part.error}
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
                  <RotateCcw className="h-4 w-4" /> Reintentar
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="min-w-0 flex-1 text-sm text-muted">
                  {part.status === "queued"
                    ? `En cola: «${part.name}»`
                    : `Subiendo «${part.name}» · ${part.pct} %${part.total ? ` · ${formatSize(part.loaded)} de ${formatSize(part.total)}` : ""}`}
                </p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
                  Cancelar
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
                <div className="h-full bg-gold transition-[width]" style={{ width: `${part.status === "queued" ? 0 : part.pct}%` }} />
              </div>
              {part.status === "uploading" && <p className="mt-2 text-xs text-muted">No bloquees el iPhone ni cambies de app mientras se sube.</p>}
            </>
          )}
        </div>
      )}
    </>
  );
}
