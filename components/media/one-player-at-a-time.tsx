"use client";
import { useEffect } from "react";

/**
 * Un solo vídeo o audio a la vez: al darle a ▶ en uno, se pausan los demás de la página (una
 * lección puede llevar vídeo, audio y otro vídeo). Escucha «play» en captura (no burbujea).
 */
export function OnePlayerAtATime() {
  useEffect(() => {
    const onPlay = (e: Event) => {
      const playing = e.target;
      if (!(playing instanceof HTMLMediaElement)) return;
      for (const el of document.querySelectorAll<HTMLMediaElement>("audio, video")) if (el !== playing && !el.paused) el.pause();
    };
    document.addEventListener("play", onPlay, true);
    return () => document.removeEventListener("play", onPlay, true);
  }, []);
  return null;
}
