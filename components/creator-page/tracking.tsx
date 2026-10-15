"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { EventType } from "@/lib/types";

/** `codeId`: el código de descuento de CODE_COPY / CODE_CLICK (lib/types.ts). */
type TrackPayload = { creatorId: string; type: EventType; productId?: string | null; codeId?: string | null };

/**
 * Envía un evento de métricas. No guarda nada en el navegador (ni cookies ni sessionStorage): el
 * servidor calcula el visitante del día (lib/visitor.ts) y si es la primera página que ve (/api/track).
 */
export function track(p: TrackPayload) {
  try {
    const params = new URLSearchParams(window.location.search);
    const body = JSON.stringify({
      ...p,
      referrer: document.referrer || null,
      utm: params.get("utm_source") || params.get("ref") || null,
    });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
  } catch {
    /* las métricas nunca deben romper la página */
  }
}

/** Registra un evento al montar (visita de página, vista de producto, inicio de checkout). */
export function TrackOnMount(p: TrackPayload & { disabled?: boolean }) {
  const sent = useRef(false);
  useEffect(() => {
    if (p.disabled || sent.current) return;
    sent.current = true;
    // La página pública está cacheada y no puede leer ?embed=1 en el servidor: la vista previa
    // incrustada en la portada de Cirella (/ana?embed=1) no cuenta como visita.
    if (new URLSearchParams(window.location.search).get("embed") === "1") return;
    track(p);
  }, [p]);
  return null;
}

/** Enlace que registra un clic (p. ej. «Comprar») antes de navegar. */
export function TrackedLink({
  href,
  event,
  className,
  children,
  disabled,
  ariaLabel,
}: {
  href: string;
  event?: TrackPayload | null;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        if (event && !disabled) track(event);
      }}
    >
      {children}
    </Link>
  );
}

/** Enlace a otra web (p. ej. «Comprar en Hotmart») que registra el clic y abre en otra pestaña. */
export function TrackedAnchor({
  href,
  event,
  className,
  children,
  ariaLabel,
  rel = "noopener noreferrer",
}: {
  href: string;
  event?: TrackPayload | null;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  rel?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={rel}
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        if (event) track(event);
      }}
    >
      {children}
    </a>
  );
}
