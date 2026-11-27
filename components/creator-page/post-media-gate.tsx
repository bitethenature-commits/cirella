"use client";

import { Headphones, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalmAudio } from "@/components/media/calm-audio";
import type { PostMedia } from "@/lib/posts";
import { PageVideo } from "./page-video";
import { VideoFacade } from "./video-facade";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * El vídeo o el audio de una publicación de «Actualidades», que se ve con cuenta. Mientras no se sabe, y para
 * quien no tiene cuenta, un adelanto bonito: su portada en grande, el botón de reproducir, cuánto dura y la
 * invitación a crear la cuenta (que vuelve aquí). Con cuenta, el reproductor de siempre.
 */
export function PostMediaGate({
  kind,
  username,
  slug,
  poster,
  title,
  durationSec,
  signupHref,
}: {
  kind: "VIDEO" | "AUDIO";
  username: string;
  slug: string;
  poster: string | null;
  title: string;
  durationSec: number | null;
  signupHref: string;
}) {
  const t = useT();
  const [state, setState] = useState<{ s: "loading" } | { s: "locked" } | { s: "open"; media: PostMedia }>({ s: "loading" });
  useEffect(() => {
    let alive = true;
    fetch(`/api/actualidades/medio?u=${encodeURIComponent(username)}&slug=${encodeURIComponent(slug)}`, { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        if (!alive) return;
        const j = (await r.json().catch(() => null)) as { media?: PostMedia | null } | null;
        setState(r.ok && j?.media ? { s: "open", media: j.media } : { s: "locked" });
      })
      .catch(() => alive && setState({ s: "locked" }));
    return () => {
      alive = false;
    };
  }, [username, slug]);

  if (state.s === "open") {
    const m = state.media;
    if (m.kind === "AUDIO")
      return (
        <div className="mt-7 py-2" data-post-media="audio">
          <CalmAudio src={m.src} preload="none" title={title} />
        </div>
      );
    return (
      <div className="cp-card mt-7 overflow-hidden" data-post-media="video">
        {"embedUrl" in m ? (
          <VideoFacade url={m.embedUrl} poster={poster} title={title} />
        ) : (
          <PageVideo video={{ src: m.src, width: m.width ?? null, height: m.height ?? null, durationSec: m.durationSec ?? null, codec: null, sizeBytes: null }} poster={m.poster ?? poster} title={title} />
        )}
      </div>
    );
  }

  const video = kind === "VIDEO";
  const mins = durationSec ? Math.max(1, Math.round(durationSec / 60)) : null;
  return (
    <div className="post-teaser relative mt-7 overflow-hidden" style={{ borderRadius: "var(--r-card)" }} data-post-teaser={kind}>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <span className="block aspect-[16/9] w-full" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 45%, #000), color-mix(in oklab, var(--c-gold) 35%, #000))" }} />
      )}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-white">
        <Link href={signupHref} className="post-teaser-play grid h-20 w-20 place-items-center rounded-full" aria-label={video ? `Ver «${title}»` : `Escuchar «${title}»`}>
          {video ? <Play className="ml-1 h-8 w-8 fill-current" /> : <Headphones className="h-8 w-8" />}
        </Link>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] opacity-85">
          {video ? t("Vídeo") : t("Audio")}
          {mins ? ` · ${mins} min` : ""}
        </p>
        {state.s === "locked" && (
          <>
            <p className="cp-display max-w-md text-[1.5rem] leading-tight sm:text-[1.8rem]">{video ? t("Crea tu cuenta para verlo") : t("Crea tu cuenta para escucharlo")}</p>
            <Link href={signupHref} className="cp-btn mt-1"><Tr s={"Crear mi cuenta"} /></Link>
            <p className="text-xs opacity-75"><Tr s={"¿Ya la tienes? Entra y vuelves aquí."} /></p>
          </>
        )}
      </div>
    </div>
  );
}
