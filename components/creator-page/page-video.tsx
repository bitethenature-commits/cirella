"use client";
import { useEffect, useRef, useState } from "react";
import type { PageVideo as PageVideoData } from "@/lib/page-blocks";

/**
 * Vídeo subido a la página: <video> nativo, nunca en reproducción automática. Con portada no se
 * descarga nada hasta pulsar ▶ (preload «none»); sin ella, solo los metadatos (y el primer
 * fotograma). playsInline para que el iPhone no salte a pantalla completa, AirPlay permitido y el
 * alto limitado a la pantalla (los vídeos verticales del iPhone). Un HEVC que el navegador no
 * sabe reproducir enseña un aviso en vez de un recuadro negro.
 */
export function PageVideo({ video, poster, title }: { video: PageVideoData; poster: string | null; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => {
    if (video.codec !== "HEVC") return;
    const el = ref.current;
    if (el && !el.canPlayType('video/mp4; codecs="hvc1"')) setUnsupported(true);
  }, [video.codec]);
  const ratio = video.width && video.height ? `${video.width} / ${video.height}` : "16 / 9";
  return (
    <div className="relative mx-auto w-full overflow-hidden bg-black" style={{ aspectRatio: ratio, maxHeight: "80svh", maxWidth: video.width && video.height ? `calc(80svh * ${video.width} / ${video.height})` : undefined }}>
      <video
        ref={ref}
        src={video.src}
        poster={poster ?? undefined}
        controls
        playsInline
        preload={poster ? "none" : "metadata"}
        controlsList="nodownload"
        x-webkit-airplay="allow"
        aria-label={title || "Vídeo"}
        className="h-full w-full"
        onError={() => setUnsupported(true)}
      />
      {unsupported && (
        <p className="absolute inset-x-0 bottom-0 bg-black/75 px-4 py-3 text-center text-sm text-white">
          Este vídeo no se puede ver en este navegador. Prueba en otro o desde el móvil.
        </p>
      )}
    </div>
  );
}
