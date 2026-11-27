"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { HomeRows, type HomeRowData } from "./home-rows";
import { useT } from "@/lib/i18n/client";

/**
 * Las filas de un desplegable de la portada (Actualidades, Ofertas, Gifts): se ven las primeras `first` y
 * «Ver más» abre el resto aquí mismo, dentro del desplegable (estas secciones no tienen página); abierto,
 * «Ver menos» lo vuelve a cerrar. Con `first` o menos, sin botón.
 */
export function MoreRows({
  rows,
  first,
  fallbackImage,
  moreLabel,
  lessLabel,
}: {
  rows: HomeRowData[];
  first: number;
  fallbackImage: string | null;
  /** Puede ser el texto escrito encima en el Canva. */
  moreLabel: ReactNode;
  lessLabel?: ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const more = rows.length > first;
  return (
    <>
      <HomeRows fallbackImage={fallbackImage} rows={open || !more ? rows : rows.slice(0, first)} />
      {more && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="cp-btn-ghost mt-4 w-full">
          {open ? (lessLabel ?? t("Ver menos")) : (
            <>
              {moreLabel} ({rows.length - first})
            </>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      )}
    </>
  );
}
