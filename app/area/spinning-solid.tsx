"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { defaultEmblem, type TierSolid } from "@/lib/tier-card";

/**
 * El sólido platónico de un nivel de membresía en tres dimensiones, girando como en el modelo de geometría
 * por partes (components/course/layers/geo.tsx): las aristas de delante más gruesas y brillantes que las
 * de detrás, y un punto en cada vértice. `solid`: cuál de los cinco (sin él, el de su nivel: I tetraedro, II
 * icosaedro, III y más dodecaedro).
 * Toma el color de donde se pone (`currentColor`). Si la alumna prefiere menos movimiento, se queda quieto.
 */
const PHI = (1 + Math.sqrt(5)) / 2;
type V3 = [number, number, number];
const SOLIDS: V3[][] = [
  [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  [-1, 1].flatMap((a) => [-1, 1].flatMap((b): V3[] => [[0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]])),
  [
    ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): V3 => [x, y, z]))),
    ...[-1, 1].flatMap((a) => [-1, 1].flatMap((b): V3[] => [[0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI]])),
  ],
  [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): V3 => [x, y, z]))),
  [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
];
function edgesOf(v: V3[]): [number, number][] {
  const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let min = Infinity;
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) min = Math.min(min, d(v[i], v[j]));
  const out: [number, number][] = [];
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (d(v[i], v[j]) < min * 1.01) out.push([i, j]);
  return out;
}
const EDGES = SOLIDS.map(edgesOf);
/** Cada sólido en la tabla (los tres de siempre primero, luego el cubo y el octaedro). */
const SOLID_AT: Record<TierSolid, number> = { tetra: 0, icosa: 1, dodeca: 2, cube: 3, octa: 4 };

export function SpinningSolid({ level, solid, className, style, speed = 0.45, offset = 0 }: { level: number; solid?: TierSolid; className?: string; style?: CSSProperties; speed?: number; offset?: number }) {
  const [a, setA] = useState(0.6 + offset);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      setA((x) => x + ((t - last) / 1000) * speed);
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const base = defaultEmblem(level);
  const k = SOLID_AT[solid ?? (base.kind === "solid" ? base.key : "tetra")];
  const v = SOLIDS[k];
  const r = Math.max(...v.map((p) => Math.hypot(...p)));
  // Gira sobre el eje vertical, inclinado y con un leve balanceo, como en el modelo.
  const tilt = 0.42 + Math.sin(a * 0.6) * 0.12;
  const S = 10.5;
  const pts = v.map(([x, y, z]) => {
    const x1 = x * Math.cos(a) + z * Math.sin(a);
    const z1 = -x * Math.sin(a) + z * Math.cos(a);
    const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt);
    const z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
    return { x: 12 + (x1 / r) * S, y: 12 + (y2 / r) * S, z: (z2 / r + 1) / 2 };
  });
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {EDGES[k].map(([i, j], n) => {
        const z = (pts[i].z + pts[j].z) / 2;
        return (
          <path
            key={n}
            d={`M${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}L${pts[j].x.toFixed(2)} ${pts[j].y.toFixed(2)}`}
            stroke="currentColor"
            strokeOpacity={0.3 + 0.7 * z}
            strokeWidth={0.55 + 0.6 * z}
            strokeLinecap="round"
          />
        );
      })}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={0.35 + 0.45 * p.z} fill="currentColor" fillOpacity={0.45 + 0.55 * p.z} />
      ))}
    </svg>
  );
}
