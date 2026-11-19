import type { CSSProperties } from "react";
import type { Decor } from "@/lib/templates";
import { DecorCanvas, isDrawnDecor } from "@/components/decor-fx/decor-canvas";

/**
 * El fondo decorativo de una plantilla (detrás de todo). Los que se mueven se dibujan en vivo en un lienzo
 * (components/decor-fx): en la página van fijos a la pantalla; en las miniaturas y vistas previas (`contained`),
 * dentro de su caja. Con «reducir movimiento» se quedan quietos (salvo «Moverse siempre»). Sus colores (--fx-*)
 * salen de lib/templates.ts → decorVars. «Nada», «Líneas» y «Grano de papel» son quietos, con CSS.
 */
export function TemplateDecor({
  decor,
  starOpacity = 0.7,
  contained = false,
  children,
}: {
  decor: Decor;
  starOpacity?: number;
  contained?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`cp-decor cp-decor-${decor}`} style={{ "--star-o": starOpacity } as CSSProperties} aria-hidden>
      {isDrawnDecor(decor) && <DecorCanvas decor={decor} contained={contained} />}
      {children}
    </div>
  );
}
