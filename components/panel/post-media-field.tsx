"use client";
import { Film, Headphones, Loader2, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { UPLOAD_CANCELLED, uploadFile } from "@/components/ui/upload-client";
import { PAGE_VIDEO_MAX } from "@/lib/page-blocks";
import type { PostMedia } from "@/lib/posts";
import { Tr, useT } from "@/lib/i18n/client";

const ACCEPT = "video/mp4,video/quicktime,.mp4,.mov,.m4v,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.m4a,.wav";

/**
 * Vídeo o audio de una publicación de «Actualidades»: se sube a la web personal (la misma subida por
 * partes que los vídeos de la página, pública) o se pega un enlace de YouTube o Vimeo. El valor viaja
 * como JSON en el campo `media` y el servidor lo vuelve a comprobar (lib/posts.ts → readPostMedia).
 */
export function PostMediaField({ initial, personal }: { initial: PostMedia | null; personal: boolean }) {
  const t = useT();
  const [media, setMedia] = useState<PostMedia | null>(initial);
  const [link, setLink] = useState(initial && "embedUrl" in initial ? initial.embedUrl : "");
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    if (file.size > PAGE_VIDEO_MAX) return setError("El archivo supera 1 GB: expórtalo más ligero");
    const ctrl = new AbortController();
    abort.current = ctrl;
    setProgress({ name: file.name, pct: 0 });
    try {
      const r = await uploadFile(file, { purpose: "video", audio: true, signal: ctrl.signal, onProgress: (pct) => setProgress({ name: file.name, pct }) });
      if (!r.video) throw new Error("No hemos podido subir el archivo");
      const audio = /\.(m4a|mp3|wav)$/i.test(r.video.src);
      setMedia(audio ? { kind: "AUDIO", src: r.video.src, durationSec: r.video.durationSec } : { kind: "VIDEO", src: r.video.src, width: r.video.width, height: r.video.height, durationSec: r.video.durationSec });
      setLink("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No hemos podido subir el archivo";
      if (msg !== UPLOAD_CANCELLED) setError(msg);
    } finally {
      setProgress(null);
      abort.current = null;
      if (input.current) input.current.value = "";
    }
  };

  const value = media ?? (link.trim() ? { kind: "VIDEO" as const, embedUrl: link.trim() } : null);

  return (
    <div className="space-y-3">
      <input type="hidden" name="media" value={value ? JSON.stringify(value) : ""} />
      {media && "src" in media ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm">
          {media.kind === "AUDIO" ? <Headphones className="h-5 w-5 text-muted" /> : <Film className="h-5 w-5 text-muted" />}
          <span className="min-w-0 flex-1 truncate">{media.kind === "AUDIO" ? t("Audio subido") : t("Vídeo subido")}</span>
          <button type="button" onClick={() => setMedia(null)} className="btn btn-ghost btn-sm text-rose" aria-label={t("Quitar el vídeo o audio")}>
            <Trash2 className="h-4 w-4" />{" "}<Tr s={"Quitar"} /></button>
        </div>
      ) : progress ? (
        <div className="rounded-xl border border-line bg-white p-3 text-sm" role="status">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="min-w-0 flex-1 truncate"><Tr s={"Subiendo «"} />{progress.name}» · {progress.pct} %</span>
            <button type="button" onClick={() => abort.current?.abort()} className="text-muted hover:text-ink" aria-label={t("Cancelar la subida")}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
            <div className="h-full bg-ink transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      ) : (
        <>
          {personal && (
            <div>
              <input ref={input} type="file" accept={ACCEPT} className="hidden" aria-label={t("Subir vídeo o audio")} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <button type="button" onClick={() => input.current?.click()} className="btn btn-outline btn-sm">
                <Film className="h-4 w-4" />{" "}<Tr s={"Subir vídeo o audio"} /></button>
              <p className="field-hint"><Tr s={"MP4 o MOV (vídeo), MP3, M4A o WAV (audio). Hasta 1 GB."} /></p>
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="post-media-link">{personal ? t("O pega un enlace de YouTube o Vimeo") : t("Enlace de YouTube o Vimeo")}</label>
            <input id="post-media-link" className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" maxLength={500} />
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose">
          <Tr s={error} />
        </p>
      )}
    </div>
  );
}
