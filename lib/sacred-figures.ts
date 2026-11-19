import type { GeometryFigure } from "./page-blocks";

/**
 * Las figuras de geometría sagrada (flor de la vida, cubo de Metatrón, vesica piscis, toro y eneagrama) en un
 * lienzo de 200 × 200: sus trazos. Las dibuja components/models/sacred-geometry.tsx (el bloque «Geometría
 * sagrada», que se traza al aparecer) y, como imagen de fondo, las tarjetas y los paneles dorados (figureUrl).
 * Puro: sirve en el servidor y en el navegador.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: r2(cx + r * Math.cos(rad)), y: r2(cy + r * Math.sin(rad)) };
};
const circlePath = (cx: number, cy: number, r: number) => `M ${r2(cx - r)} ${r2(cy)} a ${r2(r)} ${r2(r)} 0 1 0 ${r2(r * 2)} 0 a ${r2(r)} ${r2(r)} 0 1 0 ${r2(-r * 2)} 0`;

export function figurePaths(figure: GeometryFigure): string[] {
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

/** La figura como imagen de fondo (url(...) para CSS), en trazo fino de ese color y con esa intensidad (0–100). */
export function figureUrl(figure: GeometryFigure, color: string, strength: number): string {
  const o = Math.max(0, Math.min(100, strength)) / 100;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 208 208"><g fill="none" stroke="${color}" stroke-opacity="${r2(o)}" stroke-width="0.7" stroke-linecap="round"><path d="${figurePaths(figure).join(" ")}"/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Dónde va la figura de fondo: grande en una esquina (saliéndose un poco) o entera en el centro. */
export type FigurePos = "corner" | "center";
export const FIGURE_POS: Record<FigurePos, string> = { corner: "En una esquina", center: "En el centro" };
export function figurePlacement(pos: FigurePos): { position: string; size: string } {
  return pos === "center" ? { position: "50% 50%", size: "contain" } : { position: "right -4.5rem bottom -4.5rem", size: "19rem 19rem" };
}
