"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Borrador local de la lección (solo en este dispositivo, nunca la fuente de verdad): si Safari
 * recarga la pestaña a mitad de escribir, se ofrece «Recuperar». Se guarda 800 ms después de cada
 * cambio y al salir (pagehide: en iOS beforeunload no es fiable). Solo se ofrece si se escribió
 * sobre la misma versión que hay ahora en el servidor. Sin almacenamiento (modo privado) no hace nada.
 */
export type DraftData = { title: string; moduleId: string; durationMin: string; parts: unknown[] };
type Stored = { v: 1; baseVersion: number | null; at: number; data: DraftData };

function read(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Stored;
    return d && d.v === 1 && d.data && Array.isArray(d.data.parts) ? d : null;
  } catch {
    return null;
  }
}

function write(key: string, value: Stored | null) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    /* sin almacenamiento: el editor funciona igual */
  }
}

export function useLessonDraft(key: string, baseVersion: number | null, data: DraftData, dirty: boolean) {
  const [restorable, setRestorable] = useState<{ at: number; data: DraftData } | null>(null);
  // Hasta decidir si se ofrece el borrador, no se escribe nada (no se pisa el que hay).
  const [ready, setReady] = useState(false);
  const latest = useRef({ data, dirty, ready, baseVersion });
  latest.current = { data, dirty, ready, baseVersion };

  useEffect(() => {
    const d = read(key);
    if (d && d.baseVersion === baseVersion && JSON.stringify(d.data) !== JSON.stringify(latest.current.data)) setRestorable({ at: d.at, data: d.data });
    else {
      if (d) write(key, null);
      setReady(true);
    }
    // Solo al abrir el editor de esta lección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const flush = useCallback(() => {
    const l = latest.current;
    if (!l.ready) return;
    write(key, l.dirty ? { v: 1, baseVersion: l.baseVersion, at: Date.now(), data: l.data } : null);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(flush, 800);
    return () => clearTimeout(t);
  }, [data, dirty, ready, flush]);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [flush]);

  return {
    restorable,
    /** Devuelve lo guardado para que el editor lo cargue. */
    restore: () => {
      const r = restorable;
      setRestorable(null);
      setReady(true);
      return r?.data ?? null;
    },
    discard: () => {
      write(key, null);
      setRestorable(null);
      setReady(true);
    },
    /** Tras guardar en el servidor. */
    clear: () => write(key, null),
  };
}
