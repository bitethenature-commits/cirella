"use client";

import { useId } from "react";
import type { GeometryFigure } from "@/lib/page-blocks";
import { polar, useShown } from "./model-kit";

/**
 * Geometría sagrada en trazo fino (portada de la web antigua): detrás de un título o como ornamento de
 * página, siempre a poca opacidad y a gran tamaño. Se dibuja al aparecer en pantalla (sin animación con
 * «reducir movimiento»: ver .cp-model-draw en globals.css).
 */
export function SacredGeometry({ figure = "flower", className, strokeWidth = 0.35, draw = true }: { figure?: GeometryFigure; className?: string; strokeWidth?: number; draw?: boolean }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [ref, shown] = useShown<SVGSVGElement>();
  const paths = buildFigure(figure);
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

function circlePath(cx: number, cy: number, r: number) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
}

function buildFigure(figure: GeometryFigure): string[] {
  const cx = 100;
  const cy = 100;
  switch (figure) {
    /** Flor de la vida: un centro y dos anillos de seis. */
    case "flower": {
      const r = 26;
      const out = [circlePath(cx, cy, r)];
      for (let i = 0; i < 6; i++) {
        const p = polar(cx, cy, r, i * 60);
        out.push(circlePath(p.x, p.y, r));
      }
      for (let i = 0; i < 6; i++) {
        const p = polar(cx, cy, r * 2, i * 60);
        out.push(circlePath(p.x, p.y, r));
        const q = polar(cx, cy, r * Math.sqrt(3), i * 60 + 30);
        out.push(circlePath(q.x, q.y, r));
      }
      out.push(circlePath(cx, cy, r * 3));
      return out;
    }
    /** Cubo de Metatrón: trece centros, todos unidos entre sí. */
    case "metatron": {
      const r = 22;
      const pts = [{ x: cx, y: cy }];
      for (let i = 0; i < 6; i++) pts.push(polar(cx, cy, r * 1.6, i * 60));
      for (let i = 0; i < 6; i++) pts.push(polar(cx, cy, r * 3.2, i * 60));
      const out: string[] = pts.map((p) => circlePath(p.x, p.y, 6));
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) out.push(`M ${pts[i].x} ${pts[i].y} L ${pts[j].x} ${pts[j].y}`);
      return out;
    }
    /** Vesica piscis: la figura más antigua de dos que se vuelven una. */
    case "vesica": {
      const r = 42;
      return [circlePath(cx - r / 2, cy, r), circlePath(cx + r / 2, cy, r), circlePath(cx, cy, r * 1.6)];
    }
    /** Toro: elipses anidadas, un campo visto en sección. */
    case "torus": {
      const out: string[] = [];
      for (let i = 1; i <= 9; i++) {
        const rx = 12 + i * 8;
        const ry = 4 + i * 7.5;
        out.push(`M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`);
      }
      out.push(circlePath(cx, cy, 84));
      return out;
    }
    /** Eneagrama: nueve puntos (el 9 arriba), el recorrido 1-4-2-8-5-7 y el triángulo 3-6-9. */
    case "enneagram": {
      const r = 74;
      const pts = Array.from({ length: 9 }, (_, i) => polar(cx, cy, r, i * 40));
      const seq = (arr: number[]) => arr.map((p, i) => `${i === 0 ? "M" : "L"} ${pts[p].x} ${pts[p].y}`).join(" ") + " Z";
      return [circlePath(cx, cy, r), seq([1, 4, 2, 8, 5, 7]), seq([0, 3, 6])];
    }
  }
}
