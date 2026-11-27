"use client";
import { useEffect, useRef } from "react";

/**
 * El 3D de una tarjeta de miembro (components/creator-page/tier-portal.tsx): con el ratón encima, dice dónde está
 * (--tp-mx y --tp-my, de -1 a 1) y globals.css inclina la tarjeta hacia él y mueve cada capa del paisaje según su
 * profundidad. Solo con ratón (en el móvil se queda quieta) y sin «reducir movimiento».
 */
export function TierMotion() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const card = ref.current?.parentElement;
    if (!card || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      raf = 0;
      card.style.setProperty("--tp-mx", x.toFixed(3));
      card.style.setProperty("--tp-my", y.toFixed(3));
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const move = (e: PointerEvent) => {
      // El tamaño sin inclinar (la caja girada mide distinto): así no tiembla.
      const r = card.getBoundingClientRect();
      const w = card.offsetWidth || r.width;
      const h = card.offsetHeight || r.height;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      x = Math.max(-1, Math.min(1, ((e.clientX - cx) / w) * 2));
      y = Math.max(-1, Math.min(1, ((e.clientY - cy) / h) * 2));
      ask();
    };
    const leave = () => {
      x = 0;
      y = 0;
      ask();
    };
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
      card.style.removeProperty("--tp-mx");
      card.style.removeProperty("--tp-my");
    };
  }, []);
  return <span ref={ref} hidden />;
}
