"use client";
import { useCallback, useEffect, useRef } from "react";
import { UPLOAD_CANCELLED, uploadFile, type UploadedFile } from "@/components/ui/upload-client";

type Callbacks = {
  onStart: (key: string) => void;
  onProgress: (key: string, pct: number, loaded: number, total: number) => void;
  onDone: (key: string, file: UploadedFile) => void;
  onError: (key: string, message: string) => void;
};

/**
 * Cola de subidas del editor de lecciones: de una en una (un iPhone con poca cobertura no se
 * satura; cada vídeo grande ya sube 3 partes a la vez), con «Cancelar» y «Reintentar». Lo subido
 * queda al momento en «Materiales del curso» (uploadFile → /api/upload/complete), así que una
 * pestaña que se recarga no pierde lo que ya terminó.
 */
export function useUploadQueue(productId: string, callbacks: Callbacks) {
  const cb = useRef(callbacks);
  cb.current = callbacks;
  const queue = useRef<string[]>([]);
  const files = useRef(new Map<string, File>());
  const running = useRef<{ key: string; ctrl: AbortController } | null>(null);
  const alive = useRef(true);

  const pump = useCallback(async () => {
    if (running.current) return;
    const key = queue.current.shift();
    if (!key) return;
    const file = files.current.get(key);
    if (!file) return void pump();
    const ctrl = new AbortController();
    running.current = { key, ctrl };
    cb.current.onStart(key);
    try {
      const r = await uploadFile(file, {
        purpose: "file",
        productId,
        signal: ctrl.signal,
        onProgress: (pct, loaded, total) => alive.current && cb.current.onProgress(key, pct, loaded, total),
      });
      if (!r.file) throw new Error("No se pudo subir el archivo");
      files.current.delete(key);
      if (alive.current) cb.current.onDone(key, r.file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir el archivo";
      // Cancelada: el editor ya quitó la parte; lo demás se puede reintentar.
      if (alive.current && msg !== UPLOAD_CANCELLED) cb.current.onError(key, msg);
    } finally {
      running.current = null;
      if (alive.current) void pump();
    }
  }, [productId]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      running.current?.ctrl.abort();
    };
  }, []);

  const enqueue = useCallback(
    (key: string, file: File) => {
      files.current.set(key, file);
      queue.current.push(key);
      void pump();
    },
    [pump],
  );

  const cancel = useCallback((key: string) => {
    queue.current = queue.current.filter((k) => k !== key);
    files.current.delete(key);
    if (running.current?.key === key) running.current.ctrl.abort();
  }, []);

  const retry = useCallback(
    (key: string) => {
      if (!files.current.has(key)) return false;
      queue.current.push(key);
      void pump();
      return true;
    },
    [pump],
  );

  return { enqueue, cancel, retry };
}
