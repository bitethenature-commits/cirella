"use client";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LIVE_DESIGN_PARAM, type LiveDesignMessage, type LivePick, type LivePickMessage, type LiveTextMessage } from "@/components/creator-page/live-design";
import type { PagePieces } from "@/lib/pieces";
import type { Design } from "@/lib/templates";

/**
 * La vista en vivo de una página (Mi página): la página de verdad, con el diseño y las piezas sueltas que se están
 * cambiando puestos encima al momento (components/creator-page/live-design.tsx). Con `onPick`, tocar una tarjeta,
 * un panel o un botón la elige para cambiar solo esa pieza; `selected` lleva su marco. Con `editTexts`, sus textos
 * con marca (components/creator-page/site-text.tsx) se escriben encima y cada cambio llega a `onText`.
 */
export function LiveFrame({
  src,
  design,
  allowCustom,
  pieces,
  selected = null,
  onPick,
  editTexts = false,
  underTabs = false,
  onText,
  className = "",
}: {
  src: string;
  design: Design;
  allowCustom: boolean;
  pieces?: PagePieces;
  selected?: string | null;
  onPick?: (p: LivePick) => void;
  editTexts?: boolean;
  /** Llena la pantalla bajo las pestañas del panel: la cabecera de la página baja hasta debajo de ellas. */
  underTabs?: boolean;
  onText?: (t: Omit<LiveTextMessage, "type">) => void;
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const pick = useRef(onPick);
  const text = useRef(onText);
  useEffect(() => {
    pick.current = onPick;
    text.current = onText;
  }, [onPick, onText]);
  const picking = !!onPick;
  const send = useCallback(() => {
    const msg: LiveDesignMessage = { type: "cirella:design", design, allowCustom, pieces, picking, selected, editTexts, underTabs };
    frame.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, [design, allowCustom, pieces, picking, selected, editTexts, underTabs]);

  // Cada cambio, al momento.
  useEffect(() => send(), [send]);
  // En cuanto la página está lista (al abrirla o al volver a cargarla), cuando se toca una pieza y cuando se escribe.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === "cirella:pick") {
        const { id, kind, label, img } = data as LivePickMessage;
        pick.current?.({ id, kind, label, img });
        return;
      }
      if (data?.type === "cirella:text") {
        const { target, value, vars } = data as LiveTextMessage;
        if (typeof target === "string" && typeof value === "string") text.current?.({ target, value, vars });
        return;
      }
      if (data?.type !== "cirella:design-ready") return;
      send();
      setLoading(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send]);

  // La marca de la vista en vivo va antes de la parte de la página (#privacidad).
  const [path, hash] = src.split("#");
  const url = `${path}${path.includes("?") ? "&" : "?"}${LIVE_DESIGN_PARAM}=1${hash ? `#${hash}` : ""}`;
  return (
    <div className={`relative ${className}`}>
      <iframe
        ref={frame}
        src={url}
        title="Vista en vivo de la página"
        className="block h-full w-full border-0"
        onLoad={() => {
          send();
          // Sin aviso de la página (p. ej. no existe): se enseña igual, un momento después.
          window.setTimeout(() => setLoading(false), 1500);
        }}
      />
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-[#0b0e1f] text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
