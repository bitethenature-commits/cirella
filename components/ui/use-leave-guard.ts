"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { askConfirm } from "./ask-confirm";

/**
 * Avisa antes de irse con cambios sin guardar: al cerrar o recargar la pestaña (el aviso del navegador) y al
 * pulsar un enlace del panel (se pregunta dentro de la página; si dice que sí, se va).
 */
export function useLeaveGuard(dirty: boolean, message = "Tienes cambios sin guardar. ¿Salir sin guardar?") {
  const router = useRouter();
  const state = useRef({ dirty, message });
  state.current = { dirty, message };

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!state.current.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (!state.current.dirty || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      // Antes de que el enlace navegue: se pregunta y, si quiere salir, se va.
      e.preventDefault();
      e.stopPropagation();
      void askConfirm(state.current.message, { from: a, okLabel: "Salir sin guardar" }).then((ok) => {
        if (!ok) return;
        state.current.dirty = false;
        router.push(url.pathname + url.search + url.hash);
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);
}
