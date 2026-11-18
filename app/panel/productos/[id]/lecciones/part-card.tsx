"use client";
import { askConfirm } from "@/components/ui/ask-confirm";
import { AlertCircle, ArrowDown, ArrowUp, ExternalLink, Loader2, RotateCcw, X } from "lucide-react";
import { formatDuration, formatSize, MediaHealth } from "@/components/media/media-health";
import { PART_ICON } from "@/components/media/part-icons";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { BLOCK_LABEL, isBlockKind, type BlockPart } from "@/lib/lesson-blocks";
import { LESSON_TEXT_MAX, PART_VIEW_LABEL, partView, type AddPartKind } from "@/lib/lesson-parts";
import { BlockFields } from "./block-fields";
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

export type EditorPart =
  | { key: string; kind: "TEXT"; body: string; format: "MD" | null }
  | { key: string; kind: "FILE"; fileId: string }
  | { key: string; kind: "EMBED"; url: string }
  | ({ key: string } & BlockPart)
  | { key: string; kind: "UPLOAD"; add: AddPartKind; name: string; pct: number; loaded: number; total: number; status: "queued" | "uploading" | "error"; error?: string };

const iconBtn = "grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-sand hover:text-ink disabled:opacity-25";

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

function headerLabel(part: EditorPart, file?: EditorFile) {
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
 * Una parte de la lección en el editor: cabecera con su tipo y los botones (44 px) «Subir parte»,
 * «Bajar parte» y «Quitar parte»; debajo, el editor de texto, la ficha del archivo, el enlace del
 * vídeo o el progreso de la subida.
 */
export function PartCard({
  part,
  file,
  index,
  count,
  onMove,
  onRemove,
  onPatch,
  onCancel,
  onRetry,
  editorKey,
}: {
  part: EditorPart;
  file?: EditorFile;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  /** Cambios parciales (se aplican sobre el estado más reciente: el editor de texto avisa de texto y formato a la vez). */
  onPatch: (patch: { body?: string; format?: "MD" | null; url?: string; data?: BlockPart["data"] }) => void;
  onCancel: () => void;
  onRetry: () => void;
  /** Cambia al recuperar un borrador: el editor de texto vuelve a empezar con su formato. */
  editorKey: number;
}) {
  const view = part.kind === "UPLOAD" ? null : partView(part.kind, file?.kind);
  const Icon = part.kind === "UPLOAD" ? Loader2 : PART_ICON[view!];
  return (
    <li className="card overflow-visible p-0" data-part-key={part.key} data-part={part.kind === "FILE" ? (file?.kind ?? "FILE") : part.kind}>
      <div className="flex items-center gap-2 border-b border-line py-1 pl-4 pr-1">
        <Icon className={`h-4 w-4 shrink-0 text-lavender-deep ${part.kind === "UPLOAD" && part.status === "uploading" ? "animate-spin" : ""}`} aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{headerLabel(part, file)}</p>
        {part.kind !== "UPLOAD" && (
          <>
            <button type="button" className={iconBtn} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Subir parte ${index + 1}`}>
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" className={iconBtn} disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Bajar parte ${index + 1}`}>
              <ArrowDown className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          className={`${iconBtn} hover:text-rose`}
          aria-label={part.kind === "UPLOAD" && part.status !== "error" ? "Cancelar la subida" : `Quitar parte ${index + 1}`}
          onClick={async () => {
            if (part.kind === "UPLOAD") return part.status === "error" ? onRemove() : onCancel();
            if (part.kind === "TEXT" && part.body.trim() && !(await askConfirm("¿Quitar este texto de la lección?"))) return;
            onRemove();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        {part.kind === "TEXT" && (
          <RichTextEditor
            key={`${part.key}-${editorKey}`}
            ariaLabel={`Texto (parte ${index + 1})`}
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
            rows={5}
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

        {isBlockKind(part.kind) && <BlockFields part={part as BlockPart} id={part.key} onChange={(data) => onPatch({ data })} />}

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
                  <div className="h-full bg-ink transition-[width]" style={{ width: `${part.status === "queued" ? 0 : part.pct}%` }} />
                </div>
                {part.status === "uploading" && <p className="mt-2 text-xs text-muted">No bloquees el iPhone ni cambies de app mientras se sube.</p>}
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
