"use client";

import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

/**
 * Una caja que se desplaza con su propia barra, fina y dorada, a la izquierda (sin la barra del navegador): una línea
 * tenue de arriba abajo y, encima, el tramo que se ve. El tramo se arrastra y, al tocar la línea, la caja salta hacia
 * ahí. Si todo cabe, no hay barra. `className` es la caja de fuera (su sitio); `innerClassName`, la que se desplaza
 * (su alto máximo y su margen: deja sitio a la izquierda para la barra, p. ej. pl-4). Lo demás va a la que se desplaza.
 */
export function EdgeScroll({ className = "", innerClassName = "", children, ...rest }: { className?: string; innerClassName?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ top: number; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) return setBar(null);
    const size = Math.max(32, (clientHeight / scrollHeight) * clientHeight);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - size);
    setBar((b) => (b && Math.abs(b.top - top) < 0.5 && Math.abs(b.size - size) < 0.5 ? b : { top, size }));
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (content.current) ro.observe(content.current);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  // Arrastrar el tramo: la caja se mueve en proporción.
  const grab = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = box.current;
    if (!el || !bar || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const y0 = e.clientY;
    const s0 = el.scrollTop;
    const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, el.clientHeight - bar.size);
    setDragging(true);
    const move = (ev: PointerEvent) => {
      el.scrollTop = s0 + (ev.clientY - y0) * ratio;
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  // Tocar la línea: la caja salta para que el tramo quede ahí.
  const jump = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = box.current;
    if (!el || !bar) return;
    const r = e.currentTarget.getBoundingClientRect();
    const at = (e.clientY - r.top - bar.size / 2) / Math.max(1, r.height - bar.size);
    el.scrollTo({ top: Math.max(0, Math.min(1, at)) * (el.scrollHeight - el.clientHeight), behavior: "smooth" });
  };

  return (
    <div className={`group/edge relative ${className}`}>
      <div ref={box} className={`overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${innerClassName}`} {...rest}>
        <div ref={content}>{children}</div>
      </div>
      {bar && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-3 cursor-pointer" onPointerDown={jump} data-edge-scroll>
          <span className="pointer-events-none absolute inset-y-0 left-[5px] w-px rounded-full bg-gold/20" />
          <span
            className={`absolute left-1 w-[3px] cursor-grab touch-none rounded-full transition-[background-color,width,left] duration-150 hover:left-[3px] hover:w-[5px] ${dragging ? "left-[3px] w-[5px] cursor-grabbing bg-gold" : "bg-gold/55 group-hover/edge:bg-gold/80"}`}
            style={{ top: bar.top, height: bar.size }}
            onPointerDown={grab}
          />
        </span>
      )}
    </div>
  );
}
