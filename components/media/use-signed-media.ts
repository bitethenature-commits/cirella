"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { needsMediaRefresh } from "@/lib/media-url";

/**
 * Vídeo y audio con URL firmada del almacenamiento (3 h). La primera URL es
 * /api/download/<id>?inline=1 (funciona antes de hidratar); después se renueva sola con
 * ?inline=1&format=json, conservando el segundo en que iba y si estaba sonando:
 *   · en pausa: cada minuto, al volver a la pestaña (visibilitychange) y al volver atrás (pageshow);
 *   · al darle a ▶ con la URL ya vieja;
 *   · si falla la red o el formato (error 2/4) o se atasca (stalled) con más de 1 minuto: como
 *     mucho 2 veces por minuto.
 * 401/403 → «forbidden» (se acabó el acceso o la sesión).
 */
export type SignedMediaStatus = "ok" | "refreshing" | "forbidden" | "unsupported";

export function useSignedMedia(ref: RefObject<HTMLMediaElement | null>, fileId: string, ttlSec: number) {
  const issuedAt = useRef<number | null>(null);
  const [status, setStatus] = useState<SignedMediaStatus>("ok");
  const busy = useRef(false);
  const recent = useRef<number[]>([]);
  const resumeAt = useResumePosition(ref, fileId);

  const refresh = useCallback(async (): Promise<boolean> => {
    const el = ref.current;
    if (!el || busy.current) return false;
    busy.current = true;
    setStatus("refreshing");
    try {
      const res = await fetch(`/api/download/${fileId}?inline=1&format=json`, { cache: "no-store", credentials: "same-origin" });
      if (res.status === 401 || res.status === 403) {
        setStatus("forbidden");
        return false;
      }
      if (!res.ok) {
        setStatus("ok");
        return false;
      }
      const { url } = (await res.json()) as { url: string };
      const at = el.currentTime;
      const playing = !el.paused && !el.ended;
      el.src = url;
      issuedAt.current = Date.now();
      el.addEventListener(
        "loadedmetadata",
        () => {
          if (at > 0) el.currentTime = at;
          if (playing) el.play().catch(() => {});
        },
        { once: true },
      );
      el.load();
      setStatus("ok");
      return true;
    } catch {
      setStatus("ok");
      return false;
    } finally {
      busy.current = false;
    }
  }, [fileId, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stale = () => issuedAt.current !== null && needsMediaRefresh(issuedAt.current, ttlSec, Date.now());
    const limited = () => {
      const now = Date.now();
      recent.current = recent.current.filter((t) => now - t < 60_000);
      if (recent.current.length >= 2) return true;
      recent.current.push(now);
      return false;
    };
    const onLoadStart = () => {
      if (issuedAt.current === null) issuedAt.current = Date.now();
    };
    const onPlay = () => {
      if (stale()) void refresh();
    };
    const onError = () => {
      const code = el.error?.code;
      if ((code === 2 || code === 4) && !limited()) void refresh();
    };
    const onStalled = () => {
      if (issuedAt.current !== null && Date.now() - issuedAt.current > 60_000 && !limited()) void refresh();
    };
    const whilePaused = () => {
      if (el.paused && stale()) void refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") whilePaused();
    };
    el.addEventListener("loadstart", onLoadStart);
    el.addEventListener("play", onPlay);
    el.addEventListener("error", onError);
    el.addEventListener("stalled", onStalled);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", whilePaused);
    const timer = window.setInterval(whilePaused, 60_000);
    // Si ya empezó a cargar antes de hidratar.
    if (el.networkState !== el.NETWORK_EMPTY) onLoadStart();
    if (el.error) onError();
    return () => {
      el.removeEventListener("loadstart", onLoadStart);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("error", onError);
      el.removeEventListener("stalled", onStalled);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", whilePaused);
      window.clearInterval(timer);
    };
  }, [ref, refresh, ttlSec]);

  return { status, refresh, resumeAt };
}

const POS_KEY = (fileId: string) => `cirella:pos:${fileId}`;

/**
 * Recuerda por dónde iba (localStorage, cada 5 s) y devuelve ese segundo para el aviso «Seguir
 * donde lo dejaste». Cerca del final se olvida. Sin almacenamiento, no hace nada.
 */
export function useResumePosition(ref: RefObject<HTMLMediaElement | null>, fileId: string): number | null {
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(POS_KEY(fileId)));
      if (v > 5) setResumeAt(v);
    } catch {
      /* sin almacenamiento */
    }
    const el = ref.current;
    if (!el) return;
    let last = 0;
    const save = () => {
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      try {
        const nearEnd = el.duration && el.currentTime > el.duration - 10;
        if (nearEnd) localStorage.removeItem(POS_KEY(fileId));
        else if (el.currentTime > 5) localStorage.setItem(POS_KEY(fileId), String(Math.floor(el.currentTime)));
      } catch {
        /* sin almacenamiento */
      }
    };
    const onPlaying = () => setResumeAt(null);
    el.addEventListener("timeupdate", save);
    el.addEventListener("playing", onPlaying);
    return () => {
      el.removeEventListener("timeupdate", save);
      el.removeEventListener("playing", onPlaying);
    };
  }, [fileId, ref]);
  return resumeAt;
}

/** «12:34» o «1:02:03». */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
