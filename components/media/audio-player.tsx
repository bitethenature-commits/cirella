"use client";
import { useEffect, useRef, useState } from "react";
import { INLINE_MEDIA_TTL_SEC } from "@/lib/file-types";
import { clock, useResumePosition, useSignedMedia } from "./use-signed-media";
import type { PlayerFile } from "./video-player";
import { CalmAudio } from "./calm-audio";


/**
 * Audio de un curso (meditaciones, clases largas): botones grandes de −15 s / +15 s y velocidad
 * (los del iPhone son diminutos), título y portada en la pantalla bloqueada (Media Session) y
 * «Seguir donde lo dejaste».
 *
 *   delivery="stream" (web personal): /api/stream/<id>, la misma URL siempre; se comprueba el acceso
 *     en cada tramo, así que el ▶ de la pantalla bloqueada horas después sigue funcionando.
 *   delivery="signed" (plataforma): URL firmada que se renueva sola (useSignedMedia).
 */
export function AudioPlayer({
  file,
  src,
  delivery,
  title,
  artwork,
}: {
  file: PlayerFile;
  src: string;
  delivery: "stream" | "signed";
  title: string;
  artwork?: string | null;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  return delivery === "signed" ? (
    <SignedAudio audioRef={ref} file={file} src={src} title={title} artwork={artwork} />
  ) : (
    <StreamAudio audioRef={ref} file={file} src={src} title={title} artwork={artwork} />
  );
}

type Inner = { audioRef: React.RefObject<HTMLAudioElement | null>; file: PlayerFile; src: string; title: string; artwork?: string | null };

function SignedAudio(p: Inner) {
  const { status, resumeAt } = useSignedMedia(p.audioRef, p.file.id, INLINE_MEDIA_TTL_SEC);
  return <AudioUi {...p} resumeAt={resumeAt} ended={status === "forbidden" ? "Tu acceso a este contenido ha terminado o tu sesión ha caducado. Vuelve a entrar." : null} />;
}

function StreamAudio(p: Inner) {
  const resumeAt = useResumePosition(p.audioRef, p.file.id);
  const [ended, setEnded] = useState<string | null>(null);
  useEffect(() => {
    const el = p.audioRef.current;
    if (!el) return;
    // Un fallo de red puede ser que ya no tenga acceso: se pregunta con un tramo mínimo.
    const onError = async () => {
      try {
        const res = await fetch(p.src, { headers: { Range: "bytes=0-0" }, credentials: "same-origin", cache: "no-store" });
        if (res.status === 403) setEnded("Tu acceso a este contenido ha terminado");
        else if (res.status === 401) setEnded("Tu sesión ha caducado. Vuelve a entrar para seguir escuchando.");
      } catch {
        /* sin conexión: el reproductor ya lo indica */
      }
    };
    el.addEventListener("error", onError);
    return () => el.removeEventListener("error", onError);
  }, [p.audioRef, p.src]);
  return <AudioUi {...p} resumeAt={resumeAt} ended={ended} />;
}

function AudioUi({ audioRef, file, src, title, artwork, resumeAt, ended }: Inner & { resumeAt: number | null; ended: string | null }) {

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const seek = (d: number) => {
      el.currentTime = Math.max(0, Math.min(el.duration || Infinity, el.currentTime + d));
    };
    const onPlay = () => {
      try {
        ms.metadata = new MediaMetadata({ title, artwork: artwork ? [{ src: artwork, sizes: "512x512" }] : [] });
        // El ▶ de la pantalla bloqueada llama a play() en el mismo gesto (iOS lo exige).
        ms.setActionHandler("play", () => {
          void el.play();
        });
        ms.setActionHandler("pause", () => el.pause());
        ms.setActionHandler("seekbackward", () => seek(-15));
        ms.setActionHandler("seekforward", () => seek(15));
      } catch {
        /* sin Media Session */
      }
    };
    el.addEventListener("play", onPlay);
    return () => el.removeEventListener("play", onPlay);
  }, [artwork, audioRef, title]);

  return (
    <div className="mx-auto w-full max-w-xl px-1" data-audio-player>
      {/* El <audio> sin sus controles: los pone la luna que respira (components/media/calm-audio.tsx). */}
      <audio ref={audioRef} preload="metadata" className="hidden" src={src} data-file-id={file.id} aria-label={title} />
      <CalmAudio audioRef={audioRef} title={title} />
      {resumeAt !== null && !ended && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-white/25"
            onClick={() => {
              const el = audioRef.current;
              if (!el) return;
              el.currentTime = resumeAt;
              el.play().catch(() => {});
            }}
          >
            Seguir donde lo dejaste ({clock(resumeAt)})
          </button>
        </div>
      )}
      {ended && (
        <p className="mt-3 text-center text-sm text-cream" role="alert">
          {ended}
        </p>
      )}
    </div>
  );
}
