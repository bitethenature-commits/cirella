import { videoEmbed } from "@/lib/video-embed";

/** Reproductor de YouTube o Vimeo (lib/video-embed.ts). null si el enlace no es de ninguno. */
export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const v = videoEmbed(url);
  if (!v) return null;
  return (
    <iframe
      src={v.src}
      title={title}
      loading="lazy"
      className="aspect-video w-full"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
