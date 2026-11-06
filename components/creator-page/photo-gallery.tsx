"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { imageSrcSet } from "@/lib/media-url";

export type GalleryPhoto = { src: string; alt: string; width?: number; height?: number };

/**
 * Fotos en miniatura que, al tocarlas, se abren en una ventana encima de la web (que se sigue viendo
 * detrás, oscurecida y desenfocada). Dentro se pasa de una foto a otra sin cerrar: con las flechas, con
 * las miniaturas de abajo, con las teclas ← → o deslizando el dedo. Se cierra con ✕, con Escape o
 * tocando fuera de la foto; el foco vuelve a la miniatura que la abrió.
 */
export function PhotoGallery({ photos, label, className = "" }: { photos: GalleryPhoto[]; label: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const [i, setI] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const iRef = useRef(i);
  iRef.current = i;
  const n = photos.length;

  const go = useCallback((dir: 1 | -1) => setI((x) => (x + dir + n) % n), [n]);

  const open = (k: number) => {
    setI(k);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    const onClose = () => thumbs.current[iRef.current]?.focus();
    d.addEventListener("keydown", onKey);
    d.addEventListener("close", onClose);
    return () => {
      d.removeEventListener("keydown", onKey);
      d.removeEventListener("close", onClose);
    };
  }, [go]);

  if (!n) return null;
  const p = photos[i];

  return (
    <>
      <div className={`grid grid-cols-3 gap-2 ${className}`} role="group" aria-label={label}>
        {photos.map((ph, k) => (
          <button
            key={`${ph.src}-${k}`}
            ref={(el) => {
              thumbs.current[k] = el;
            }}
            type="button"
            onClick={() => open(k)}
            className="group/thumb block overflow-hidden rounded-[calc(var(--r-card)*0.5)]"
            aria-label={`Ver foto ${k + 1} de ${n}${ph.alt ? `: ${ph.alt}` : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ph.src}
              srcSet={imageSrcSet(ph.src, ph.width)}
              sizes="(min-width: 768px) 70px, 25vw"
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-square w-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
            />
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        aria-label={label}
        className="m-auto max-h-none max-w-none bg-transparent p-0 text-white backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-[fade-in_.25s_ease] [overscroll-behavior:contain]"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div
          className="relative flex w-[min(92vw,34rem)] flex-col items-center gap-3"
          onTouchStart={(e) => {
            const t = e.touches[0];
            touch.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const s = touch.current;
            touch.current = null;
            if (!s || n < 2) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - s.x;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(t.clientY - s.y)) go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="relative w-full overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgb(0_0_0/.7)]" style={{ background: "var(--c-surface, #111)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={p.src}
              src={p.src}
              srcSet={imageSrcSet(p.src, p.width)}
              sizes="(min-width: 640px) 34rem, 92vw"
              alt={p.alt}
              decoding="async"
              className="block max-h-[72dvh] w-full animate-[fade-in_.35s_ease] object-contain"
            />
            {n > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 backdrop-blur-md transition hover:bg-black/60">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Foto siguiente" className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 backdrop-blur-md transition hover:bg-black/60">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-0.5 text-xs tabular-nums backdrop-blur-md" aria-live="polite">
                  {i + 1} / {n}
                </span>
              </>
            )}
            <button type="button" onClick={close} aria-label="Cerrar" className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/40 backdrop-blur-md transition hover:bg-black/60">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
          {p.alt && <p className="text-center text-sm text-white/85">{p.alt}</p>}
          {n > 1 && (
            <div className="flex max-w-full gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
              {photos.map((ph, k) => (
                <button
                  key={`${ph.src}-m${k}`}
                  type="button"
                  onClick={() => setI(k)}
                  aria-label={`Ir a la foto ${k + 1}`}
                  aria-current={k === i ? "true" : undefined}
                  className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition ${k === i ? "opacity-100" : "border-transparent opacity-55 hover:opacity-90"}`}
                  style={k === i ? { borderColor: "var(--c-gold, #fff)" } : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.src} srcSet={imageSrcSet(ph.src, ph.width)} sizes="48px" alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
