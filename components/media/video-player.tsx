"use client";
import { Download, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { INLINE_MEDIA_TTL_SEC } from "@/lib/file-types";
import { clock, useSignedMedia } from "./use-signed-media";
import { Tr } from "@/lib/i18n/client";

export type PlayerFile = {
  id: string;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationSec?: number | null;
  videoCodec?: string | null;
  width?: number | null;
  height?: number | null;
};

const HEVC_TYPE = 'video/mp4; codecs="hvc1.1.6.L93.B0"';

/**
 * Vídeo de un curso o producto (iPhone primero): la forma del propio vídeo (un vertical, como mucho
 * el 75 % de la pantalla y centrado), playsInline, AirPlay, imagen en imagen y «Seguir donde lo
 * dejaste». URL firmada que se renueva sola (useSignedMedia).
 *
 * HEVC (formato del iPhone): si el navegador dice que no lo reproduce, se avisa antes con
 * «Intentar igualmente»; y si al cargar falla (error 3/4 o sin imagen), también.
 */
export function VideoPlayer({ file, poster, title }: { file: PlayerFile; poster?: string | null; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { status, resumeAt } = useSignedMedia(ref, file.id, INLINE_MEDIA_TTL_SEC);
  const [unsupported, setUnsupported] = useState(false);
  const [forced, setForced] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadedAt = useRef(Date.now());
  const ratio = file.width && file.height ? `${file.width} / ${file.height}` : "16 / 9";
  const vertical = !!(file.width && file.height && file.height > file.width);

  useEffect(() => {
    if (file.videoCodec === "HEVC") {
      const v = document.createElement("video");
      if (v.canPlayType(HEVC_TYPE) === "") setUnsupported(true);
    }
  }, [file.videoCodec]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onError = () => {
      const code = el.error?.code;
      if ((code === 3 || code === 4) && Date.now() - loadedAt.current < 60_000 && file.videoCodec === "HEVC") setFailed(true);
    };
    const onMeta = () => {
      if (el.videoWidth === 0 && file.videoCodec === "HEVC") setFailed(true);
    };
    el.addEventListener("error", onError);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      el.removeEventListener("error", onError);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [file.videoCodec]);

  // Pantalla bloqueada y centro de control: título del vídeo.
  useEffect(() => {
    const el = ref.current;
    if (!el || !("mediaSession" in navigator)) return;
    const onPlay = () => {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title, artwork: poster ? [{ src: poster }] : [] });
      } catch {
        /* sin Media Session */
      }
    };
    el.addEventListener("play", onPlay);
    return () => el.removeEventListener("play", onPlay);
  }, [poster, title]);

  const showFallback = (unsupported && !forced) || failed;

  return (
    <div className="w-full bg-black" data-video-player>
      <div className="relative mx-auto" style={{ aspectRatio: ratio, maxHeight: "75svh", maxWidth: vertical ? `calc(75svh * ${file.width} / ${file.height})` : undefined }}>
        {showFallback ? (
          <div className="absolute inset-0 grid place-items-center overflow-auto p-5 text-center text-cream" role="alert" data-hevc-fallback>
            <div className="max-w-sm">
              <p className="text-sm leading-relaxed"><Tr s={"Este vídeo está grabado en un formato del iPhone (HEVC) que este navegador no reproduce. Ábrelo en Safari o en tu móvil, o descárgalo."} /></p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <a href={`/api/download/${file.id}`} className="btn btn-light btn-sm">
                  <Download className="h-4 w-4" />{" "}<Tr s={"Descargar"} /></a>
                {!failed && (
                  <button type="button" className="btn btn-sm border border-cream/40 text-cream" onClick={() => setForced(true)}>
                    <Play className="h-4 w-4" />{" "}<Tr s={"Intentar igualmente"} /></button>
                )}
              </div>
            </div>
          </div>
        ) : null}
        <video
          ref={ref}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          x-webkit-airplay="allow"
          poster={poster ?? undefined}
          className={`absolute inset-0 h-full w-full bg-black ${showFallback ? "invisible" : ""}`}
          src={`/api/download/${file.id}?inline=1`}
          aria-label={title}
        />
      </div>
      {status === "forbidden" && <p className="px-4 py-3 text-center text-sm text-cream"><Tr s={"Tu acceso a este contenido ha terminado o tu sesión ha caducado. Vuelve a entrar."} /></p>}
      {resumeAt !== null && !showFallback && (
        <div className="flex justify-center px-4 py-2">
          <button
            type="button"
            className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-white/25"
            onClick={() => {
              const el = ref.current;
              if (!el) return;
              el.currentTime = resumeAt;
              el.play().catch(() => {});
            }}
          ><Tr s={"Seguir donde lo dejaste ("} />{clock(resumeAt)})
          </button>
        </div>
      )}
    </div>
  );
}
