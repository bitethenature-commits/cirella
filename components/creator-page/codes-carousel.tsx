"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Carrusel de los códigos de descuento: en el ordenador caben tres juntos y, si hay más, salen dos
 * flechas para pasar; en el móvil se desliza con el dedo. Sin JavaScript se desliza igual.
 */
export function CodesCarousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.offsetWidth + 12 : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const arrow = (dir: 1 | -1, hidden: boolean) => (
    <button
      type="button"
      onClick={() => go(dir)}
      aria-label={dir === 1 ? "Ver los siguientes códigos" : "Ver los códigos anteriores"}
      className={`absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border transition md:grid ${dir === 1 ? "-right-4" : "-left-4"} ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
      style={{ background: "var(--c-surface)", borderColor: "var(--c-line)", backdropFilter: "blur(10px)" }}
      tabIndex={hidden ? -1 : 0}
    >
      {dir === 1 ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="relative mt-5">
      {arrow(-1, edge.start)}
      <div ref={ref} onScroll={update} className="-mx-5 flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto px-5 pb-2 scrollbar-none md:mx-0 md:px-0" data-codes-carousel>
        {children}
      </div>
      {arrow(1, edge.end)}
    </div>
  );
}
