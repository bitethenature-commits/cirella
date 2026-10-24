"use client";
import { AlertTriangle, Check, Film, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { ImageUpload, uploadImageInfo } from "@/components/ui/image-upload";
import { UPLOAD_CANCELLED, uploadFile } from "@/components/ui/upload-client";
import { capturePoster } from "@/components/ui/video-poster";
import { videoWeight } from "@/lib/file-types";
import { embedProblem, PAGE_VIDEO_MAX, videoOrientation, type VideoBlock } from "@/lib/page-blocks";
import { videoEmbed } from "@/lib/video-embed";

const VIDEO_ACCEPT = "video/mp4,video/quicktime,.mp4,.mov,.m4v";

function mb(bytes: number) {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toLocaleString("es-ES", { maximumFractionDigits: 1 })} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

function duration(sec: number | null) {
  if (sec == null) return null;
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Bloque «Vídeo»: subirlo (solo la web personal, por la subida por partes de la base) o pegar un
 * enlace de YouTube o Vimeo. La portada se saca sola de un fotograma mientras sube; se puede cambiar.
 */
export function VideoBlockFields({
  block: b,
  personal,
  onPatch,
  onStatus,
}: {
  block: VideoBlock;
  personal: boolean;
  onPatch: (p: Partial<VideoBlock>) => void;
  onStatus: (t: string | null) => void;
}) {
  const [mode, setMode] = useState<"upload" | "link">(b.upload || (personal && !b.embedUrl) ? "upload" : "link");
  const [progress, setProgress] = useState<{ name: string; pct: number; loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const linkProblem = b.embedUrl?.trim() ? embedProblem(b.embedUrl, personal) : null;
  const provider = b.embedUrl && !linkProblem ? videoEmbed(b.embedUrl)?.provider : null;

  const upload = async (file: File) => {
    setError(null);
    if (file.size > PAGE_VIDEO_MAX) return setError("El vídeo supera 1 GB: expórtalo a 1080p");
    const ctrl = new AbortController();
    abort.current = ctrl;
    setProgress({ name: file.name, pct: 0, loaded: 0, total: file.size });
    onStatus(`Subiendo «${file.name}»`);
    // La portada, en paralelo: sale de un fotograma del archivo local.
    const poster = b.poster
      ? Promise.resolve(null)
      : capturePoster(file).then(async (blob) => {
          if (!blob) return null;
          try {
            return (await uploadImageInfo(new File([blob], "portada.jpg", { type: "image/jpeg" }), { signal: ctrl.signal })).url;
          } catch {
            return null;
          }
        });
    try {
      const r = await uploadFile(file, { purpose: "video", signal: ctrl.signal, onProgress: (pct, loaded, total) => setProgress({ name: file.name, pct, loaded, total }) });
      if (!r.video) throw new Error("No se pudo subir el vídeo");
      const url = await poster;
      onPatch({ upload: r.video, embedUrl: undefined, ...(url ? { poster: url } : {}) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir el vídeo";
      if (msg !== UPLOAD_CANCELLED) setError(msg);
    } finally {
      abort.current = null;
      setProgress(null);
      onStatus(null);
    }
  };

  const v = b.upload;
  const facts = v ? [duration(v.durationSec), videoOrientation(v.width, v.height), v.sizeBytes ? mb(v.sizeBytes) : null].filter(Boolean).join(" · ") : "";

  return (
    <>
      <input className="input h-10 text-sm" placeholder="Título (opcional)" aria-label="Título del vídeo" value={b.title} maxLength={80} onChange={(e) => onPatch({ title: e.target.value })} />
      {personal && !v && !progress && (
        <div className="inline-flex rounded-full bg-sand p-1 text-xs font-semibold" role="radiogroup" aria-label="Cómo añadir el vídeo">
          {(["upload", "link"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`h-9 rounded-full px-3 ${mode === m ? "bg-white text-ink shadow-soft" : "text-muted"}`}>
              {m === "upload" ? "Subir vídeo" : "Enlace de YouTube o Vimeo"}
            </button>
          ))}
        </div>
      )}

      {personal && mode === "upload" ? (
        progress ? (
          <div className="space-y-2 rounded-xl border border-line bg-paper p-3 text-sm" aria-live="polite">
            <p className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Subiendo «{progress.name}» · {progress.pct} % · {mb(progress.loaded)} de {mb(progress.total)}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-sand">
              <div className="h-full bg-ink transition-[width]" style={{ width: `${progress.pct}%` }} />
            </div>
            <p className="text-xs text-muted">No cierres esta pantalla mientras se sube.</p>
            <button type="button" onClick={() => abort.current?.abort()} className="btn btn-outline btn-sm h-10">
              <X className="h-4 w-4" /> Cancelar
            </button>
          </div>
        ) : v ? (
          <div className="space-y-2">
            <video src={v.src} poster={b.poster ?? undefined} controls playsInline preload="metadata" className="max-h-72 w-full rounded-xl bg-black" />
            <p className="text-sm font-medium" data-video-facts>{facts}</p>
            <p className="text-xs text-muted">Vídeo subido. Pulsa Publicar para que se vea en tu página.</p>
            {v.codec === "HEVC" && (
              <p className="flex gap-2 rounded-lg bg-gold/15 p-2.5 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>Formato del iPhone (HEVC).</strong> Puede no verse en algunos navegadores. Para los próximos: Ajustes › Cámara › Formatos › Más compatible.
                </span>
              </p>
            )}
            {videoWeight(v.sizeBytes, v.durationSec) === "heavy" && (
              <p className="flex gap-2 rounded-lg bg-gold/15 p-2.5 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>Muy pesado.</strong> Tardará en cargar con datos móviles. Expórtalo a 1080p.
                </span>
              </p>
            )}
            <button type="button" onClick={() => onPatch({ upload: null })} className="btn btn-ghost btn-sm h-10 text-rose">
              <X className="h-4 w-4" /> Quitar vídeo
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => input.current?.click()} className="btn btn-outline h-11 w-full text-sm">
              <Film className="h-4 w-4" /> Elegir vídeo
            </button>
            <p className="field-hint">MP4 o MOV hasta 1 GB. Mejor en 1080p y de menos de 2 minutos.</p>
          </>
        )
      ) : (
        <div>
          <input
            className="input h-10 text-sm"
            placeholder="https://youtu.be/… o https://vimeo.com/…"
            aria-label="Enlace del vídeo"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={b.embedUrl ?? ""}
            maxLength={500}
            onChange={(e) => onPatch({ embedUrl: e.target.value, upload: null })}
          />
          {provider ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success">
              <Check className="h-3.5 w-3.5" /> Vídeo de {provider === "youtube" ? "YouTube" : "Vimeo"}
            </p>
          ) : linkProblem ? (
            <p className="mt-1.5 text-xs text-rose" role="alert">{linkProblem}</p>
          ) : (
            !personal && <p className="field-hint">Sube el vídeo a YouTube o Vimeo y pega aquí el enlace.</p>
          )}
        </div>
      )}

      {(v || mode === "link") && !progress && (
        <div>
          <label className="field-label">{v ? "Portada" : "Portada (opcional)"}</label>
          <ImageUpload shape="wide" value={b.poster} onChange={(url) => onPatch({ poster: url })} label={b.poster ? "Cambiar portada" : "Subir portada"} />
          {!v && <p className="field-hint">Tu página carga más rápido: el vídeo se abre al pulsar ▶.</p>}
        </div>
      )}
      <input className="input h-10 text-sm" placeholder="Texto bajo el vídeo (opcional)" aria-label="Texto bajo el vídeo" value={b.caption ?? ""} maxLength={300} onChange={(e) => onPatch({ caption: e.target.value || undefined })} />
      {error && <p className="text-xs text-rose" role="alert">{error}</p>}
      <input
        ref={input}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        aria-label="Elegir vídeo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
    </>
  );
}
