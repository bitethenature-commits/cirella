"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tr } from "@/lib/i18n/client";

type Tip = { top: number; left: number; sub: string; title: string };

/**
 * El nombre de algo al pasar el ratón (o al llegar con el teclado), en una ventanita oscura a su derecha: arriba, en
 * dorado y pequeño, qué es («Lección 3 · Borrador»); debajo, su título. Se pinta en <body>, por encima de todo, y se
 * cierra al salir, al desplazar o al pulsar. Para los índices estrechos que solo llevan números.
 *
 *   const tip = useHoverTip();
 *   <a {...tip.on({ sub: "Lección 3", title: "Marte, tu fuerza" })}>3</a>
 *   {tip.node}
 */
export function useHoverTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const hide = useRef(() => setTip(null)).current;

  useEffect(() => {
    if (!tip) return;
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    window.addEventListener("pointerdown", hide, { capture: true });
    return () => {
      window.removeEventListener("scroll", hide, { capture: true });
      window.removeEventListener("pointerdown", hide, { capture: true });
    };
  }, [tip, hide]);

  const showAt = (el: HTMLElement, sub: string, title: string) => {
    const r = el.getBoundingClientRect();
    setTip({ top: r.top + r.height / 2, left: r.right + 10, sub, title });
  };

  /** Lo que lleva el elemento que enseña el nombre. */
  const on = ({ sub, title }: { sub: string; title: string }) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showAt(e.currentTarget, sub, title),
    onMouseLeave: hide,
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(":focus-visible")) showAt(e.currentTarget, sub, title);
    },
    onBlur: hide,
  });

  const node =
    tip && typeof document !== "undefined"
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] w-max max-w-64 -translate-y-1/2 rounded-2xl border border-[#e9cc8e]/30 bg-[#0b0b0d] px-3.5 py-2.5 text-[#f3ecdd] shadow-[0_18px_40px_-12px_rgb(0_0_0/.7)] animate-fade-in"
            style={{ top: tip.top, left: Math.min(tip.left, window.innerWidth - 270) }}
          >
            <span aria-hidden className="absolute -left-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b border-l border-[#e9cc8e]/30 bg-[#0b0b0d]" />
            {tip.sub && <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#e9cc8e]"><Tr s={tip.sub} /></p>}
            <p className="mt-0.5 font-serif text-[1.05rem] leading-snug">{tip.title}</p>
          </div>,
          document.body,
        )
      : null;

  return { on, node, hide };
}
