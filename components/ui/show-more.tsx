"use client";

import { ChevronDown } from "lucide-react";
import { Children, useState, type CSSProperties, type ReactNode } from "react";
import { Tr } from "@/lib/i18n/client";

/**
 * Una lista larga (las preguntas frecuentes de la portada, las de Soporte…): se ven las primeras `first` y, debajo,
 * «Ver más» la abre entera; abierta, «Ver menos» la vuelve a cerrar. Con `first` o menos, sin botón.
 */
export function ShowMore({
  children,
  first = 3,
  className,
  style,
  buttonClassName = "btn btn-ghost btn-sm",
  moreLabel = "Ver más",
  lessLabel = "Ver menos",
}: {
  children: ReactNode;
  first?: number;
  className?: string;
  style?: CSSProperties;
  buttonClassName?: string;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const items = Children.toArray(children);
  const more = items.length > first;
  return (
    <>
      <div className={className} style={style}>
        {open || !more ? items : items.slice(0, first)}
      </div>
      {more && (
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={buttonClassName}>
            <Tr s={open ? lessLabel : moreLabel} />
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
