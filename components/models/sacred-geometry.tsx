"use client";

import { useId } from "react";
import type { GeometryFigure } from "@/lib/page-blocks";
import { figurePaths } from "@/lib/sacred-figures";
import { useShown } from "./model-kit";

/**
 * Geometría sagrada en trazo fino (portada de la web antigua): detrás de un título o como ornamento de
 * página, siempre a poca opacidad y a gran tamaño. Se dibuja al aparecer en pantalla (sin animación con
 * «reducir movimiento»: ver .cp-model-draw en globals.css).
 */
export function SacredGeometry({ figure = "flower", className, strokeWidth = 0.35, draw = true }: { figure?: GeometryFigure; className?: string; strokeWidth?: number; draw?: boolean }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [ref, shown] = useShown<SVGSVGElement>();
  const paths = figurePaths(figure);
  return (
    <svg ref={ref} viewBox="0 0 200 200" className={`h-full w-full ${draw ? "cp-model-draw" : ""} ${shown || !draw ? "is-shown" : ""} ${className ?? ""}`} aria-hidden="true">
      <defs>
        <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--c-text)", stopOpacity: 0.85 }} />
          <stop offset="50%" style={{ stopColor: "var(--c-gold)", stopOpacity: 0.85 }} />
          <stop offset="100%" style={{ stopColor: "var(--c-gold)", stopOpacity: 0.4 }} />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#sg-${gid})`} strokeWidth={strokeWidth} strokeLinecap="round">
        {paths.map((d, i) => (
          <path key={i} d={d} pathLength={1} data-draw="" style={{ ["--d" as string]: `${Math.min(i * 60, 2400)}ms` }} />
        ))}
      </g>
    </svg>
  );
}
