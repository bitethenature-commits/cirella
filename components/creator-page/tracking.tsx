"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { EventType } from "@/lib/types";

type TrackPayload = { creatorId: string; type: EventType; productId?: string | null };

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
