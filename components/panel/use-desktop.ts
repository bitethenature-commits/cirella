"use client";
import { useEffect, useState } from "react";

/**
 * ¿Pantalla de escritorio (≥ 1024 px)? La vista previa del teléfono de los editores solo se monta
 * ahí: en el iPhone estaría oculta y repintarla en cada tecla haría ir lento lo que se escribe.
 */
export function useDesktop(query = "(min-width: 1024px)"): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return desktop;
}
