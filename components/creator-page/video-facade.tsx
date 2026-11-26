"use client";
import { Play } from "lucide-react";
import { useState } from "react";
import { imageSrcSet } from "@/lib/media-url";
import { videoEmbed } from "@/lib/video-embed";
import { useT } from "@/lib/i18n/client";

/**
 * Vídeo de YouTube o Vimeo que no carga nada de fuera hasta que se pulsa ▶ (la página de la bio de
 * Instagram tiene que abrir rápido): antes, su portada propia (o un fondo del tema) y un botón; al
 * pulsarlo, el reproductor (youtube-nocookie / Vimeo con dnt=1, como VideoEmbed de la base).
 */
export function VideoFacade({ url, poster, title }: { url: string; poster: string | null; title: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const v = videoEmbed(url);
  if (!v) return null;
  const label = title || (v.provider === "youtube" ? "Vídeo de YouTube" : "Vídeo de Vimeo");
  if (open)
    return (
      <iframe
        src={`${v.src}&autoplay=1`}
        title={t(label)}
        className="aspect-video w-full"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="group relative block aspect-video w-full overflow-hidden"
      style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 55%, #000), color-mix(in oklab, var(--c-gold) 35%, #000))" }}
      aria-label={`Reproducir: ${label}`}
      data-video-facade={v.provider}
    >
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} srcSet={imageSrcSet(poster)} sizes="(min-width: 768px) 704px, 100vw" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-lg transition group-hover:scale-105">
        <Play className="ml-1 h-7 w-7 fill-current" />
      </span>
      <span className="absolute bottom-2 right-3 text-[0.7rem] font-medium text-white/80">{v.provider === "youtube" ? t("YouTube") : t("Vimeo")}</span>
    </button>
  );
}
