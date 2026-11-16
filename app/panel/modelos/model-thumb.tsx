"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Ancho al que se dibuja el modelo antes de encogerlo (como en una columna de la web). */
const INNER = 760;

/**
 * La foto pequeña de un modelo en «Modelos»: el propio modelo, dibujado a su tamaño y encogido, sin poder
 * tocarlo. Solo se dibuja mientras está a la vista (así la página no carga cien modelos a la vez).
 */
export function ModelThumb({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "300px 0px" });
    io.observe(el);
    const ro = new ResizeObserver(() => setScale(el.clientWidth / INNER));
    ro.observe(el);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={box}
      onClick={onClick}
      aria-hidden
      className={`relative h-28 w-40 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-line bg-[#0d0c22] sm:h-32 sm:w-48 ${className}`}
    >
      {visible ? (
        <div inert className="pointer-events-none absolute left-0 top-0 origin-top-left select-none" style={{ width: INNER, transform: `scale(${scale})` }}>
          {children}
        </div>
      ) : (
        <span className="absolute inset-0 animate-pulse bg-white/5" />
      )}
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5" />
    </div>
  );
}
