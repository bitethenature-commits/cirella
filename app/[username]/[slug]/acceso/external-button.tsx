"use client";

import { ExternalLink } from "lucide-react";
import { track } from "@/components/creator-page/tracking";

/**
 * Botón de un producto que se paga fuera (Hotmart, PayPal, Calendly…): registra el clic en las
 * métricas (PRODUCT_CLICK, sin cookies) y abre la otra web en una pestaña nueva.
 */
export function ExternalButton({
  href,
  label,
  className,
  event,
}: {
  href: string;
  label: string;
  className?: string;
  event: { creatorId: string; productId: string } | null;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        if (event) track({ creatorId: event.creatorId, type: "PRODUCT_CLICK", productId: event.productId });
      }}
    >
      {label} <ExternalLink className="h-4 w-4" aria-hidden />
    </a>
  );
}
