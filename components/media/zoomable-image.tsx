"use client";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Imagen que se amplía al tocarla: se abre en un <dialog> a pantalla completa con pellizco (1–5×),
 * doble toque (1× ↔ 2,5× en el punto tocado), arrastre limitado al borde y deslizar hacia abajo
 * para cerrar (a 1×). Escape y ✕ cierran; el foco vuelve a la imagen.
 */
const MIN = 1;
const MAX = 5;
const DOUBLE = 2.5;

type View = { s: number; x: number; y: number };

export function ZoomableImage({
  src,
  srcSet,
  sizes,
  alt,
  className = "",
  imgClassName = "",
  width,
  height,
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Medidas reales (si se conocen): reservan el sitio de la imagen antes de que cargue. */
  width?: number;
  height?: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [drag, setDrag] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; s: number; cx: number; cy: number; vx: number; vy: number } | null>(null);
  const lastTap = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  const clamp = useCallback((v: View): View => {
    const el = stage.current;
    const s = Math.min(MAX, Math.max(MIN, v.s));
    if (!el || s === 1) return { s, x: 0, y: 0 };
    const w = el.clientWidth;
    const h = el.clientHeight;
    const mx = ((s - 1) * w) / 2;
    const my = ((s - 1) * h) / 2;
    return { s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }, []);

  const open = () => {
    setView({ s: 1, x: 0, y: 0 });
    setDrag(0);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => trigger.current?.focus();
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  /** Amplía alrededor de un punto de la pantalla (coordenadas relativas al centro). */
  const zoomAt = (target: number, px: number, py: number, from: View): View => {
    const k = target / from.s;
    return clamp({ s: target, x: px - (px - from.x) * k, y: py - (py - from.y) * k });
  };

  const center = (clientX: number, clientY: number) => {
    const r = stage.current!.getBoundingClientRect();
    return { px: clientX - r.left - r.width / 2, py: clientY - r.top - r.height / 2 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const v = viewRef.current;
    if (pts.length === 2) {
      const [a, b] = pts;
      const c = center((a.x + b.x) / 2, (a.y + b.y) / 2);
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), s: v.s, cx: c.px, cy: c.py, vx: v.x, vy: v.y };
    } else if (pts.length === 1) {
      gesture.current = { dist: 0, s: v.s, cx: e.clientX, cy: e.clientY, vx: v.x, vy: v.y };
      const now = Date.now();
      if (now - lastTap.current < 300) {
        const c = center(e.clientX, e.clientY);
        setView(v.s > 1 ? { s: 1, x: 0, y: 0 } : zoomAt(DOUBLE, c.px, c.py, v));
        lastTap.current = 0;
        gesture.current = null;
      } else lastTap.current = now;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && g.dist > 0) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const target = Math.min(MAX, Math.max(MIN, (g.s * dist) / g.dist));
      setView(zoomAt(target, g.cx, g.cy, { s: g.s, x: g.vx, y: g.vy }));
    } else if (pts.length === 1) {
      const dx = e.clientX - g.cx;
      const dy = e.clientY - g.cy;
      if (g.s > 1) setView(clamp({ s: g.s, x: g.vx + dx, y: g.vy + dy }));
      else setDrag(Math.max(0, dy));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      if (drag > 120 && viewRef.current.s === 1) close();
      setDrag(0);
      gesture.current = null;
    } else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      const v = viewRef.current;
      gesture.current = { dist: 0, s: v.s, cx: p.x, cy: p.y, vx: v.x, vy: v.y };
    }
  };

  return (
    <>
      <button ref={trigger} type="button" onClick={open} className={`block w-full cursor-zoom-in ${className}`} aria-label={alt ? `Ampliar imagen: ${alt}` : "Ampliar imagen"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} srcSet={srcSet} sizes={sizes} alt={alt} width={width} height={height} loading="lazy" decoding="async" className={`h-auto w-full ${imgClassName}`} />
      </button>
      <dialog
        ref={dialog}
        className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black/80 [overscroll-behavior:contain]"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div
          ref={stage}
          data-zoom-stage
          className="relative grid h-full w-full touch-none select-none place-items-center overflow-hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            srcSet={srcSet}
            sizes="100vw"
            alt={alt}
            // Diferida: el <dialog> cerrado no se pinta y así su imagen grande no se descarga hasta abrirlo.
            loading="lazy"
            decoding="async"
            draggable={false}
            data-zoom-scale={view.s}
            className="max-h-full max-w-full object-contain"
            style={{
              transform: `translate3d(${view.x}px, ${view.y + drag}px, 0) scale(${view.s})`,
              opacity: drag ? Math.max(0.4, 1 - drag / 400) : 1,
              transition: gesture.current ? "none" : "transform 160ms ease-out",
            }}
          />
        </div>
        <button
          type="button"
          onClick={close}
          className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </dialog>
    </>
  );
}
