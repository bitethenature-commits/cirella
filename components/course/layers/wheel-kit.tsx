"use client";

import { useId, type ReactNode } from "react";
import { C, GOLD, INK, pt, sector } from "./common";

/**
 * Lo que hace elegantes las ruedas del modelo por partes (la carta astral, las cualidades, los ángulos):
 * un fondo de papel con degradado, una corona de marcas cada 5° (doradas cada 30°), un medallón central con
 * doble filete dorado, la pieza elegida en tinta con degradado y una sombra suave que la levanta.
 * Los ids de los degradados llevan el useId de cada rueda: en una lección puede haber varias.
 */

export type WheelIds = { bg: string; sel: string; gold: string; med: string; lift: string; glow: string };

export function useWheelIds(): WheelIds {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return { bg: `${id}bg`, sel: `${id}sel`, gold: `${id}gold`, med: `${id}med`, lift: `${id}lift`, glow: `${id}glow` };
}

export function WheelDefs({ ids }: { ids: WheelIds }) {
  return (
    <defs>
      <radialGradient id={ids.bg} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="62%" stopColor="#FDFBF6" />
        <stop offset="100%" stopColor="#F1E9DA" />
      </radialGradient>
      <linearGradient id={ids.sel} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#332C4F" />
        <stop offset="100%" stopColor="#15121F" />
      </linearGradient>
      <linearGradient id={ids.gold} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#E3C98F" />
        <stop offset="50%" stopColor="#B08D4F" />
        <stop offset="100%" stopColor="#86662F" />
      </linearGradient>
      <radialGradient id={ids.med} cx="40%" cy="35%" r="75%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#EFE6D3" />
      </radialGradient>
      <filter id={ids.lift} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="3.5" floodColor="#1E1A2E" floodOpacity="0.28" />
      </filter>
      <filter id={ids.glow} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
    </defs>
  );
}

/** El fondo de la rueda y su corona de marcas: cada 5° una raya fina; cada 30°, una más larga y dorada. */
export function WheelBase({ ids, ticks = true, r = 166 }: { ids: WheelIds; ticks?: boolean; r?: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={C} cy={C} r={r + 2} fill="none" stroke={GOLD} strokeOpacity="0.35" strokeWidth="0.6" />
      <circle cx={C} cy={C} r={r} fill={`url(#${ids.bg})`} stroke={GOLD} strokeOpacity="0.7" strokeWidth="0.9" />
      {ticks &&
        Array.from({ length: 72 }, (_, i) => {
          const big = i % 6 === 0;
          const a = pt(i * 5, r);
          const b = pt(i * 5, r - (big ? 8 : 4));
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={big ? GOLD : "#BDB29C"} strokeWidth={big ? 1 : 0.5} />;
        })}
    </g>
  );
}

/** Un anillo de doce sectores (los signos, las casas…): separados por un filete blanco, como tallados. */
export function RingSector({ i, r1, r2, fill, on, ids, children, ...rest }: { i: number; r1: number; r2: number; fill: string; on: boolean; ids: WheelIds; children?: ReactNode } & Record<string, unknown>) {
  return (
    <g {...rest}>
      {on ? (
        <>
          <path d={sector(i * 30, i * 30 + 30, r1 - 3, r2 + 3)} fill={`url(#${ids.sel})`} stroke="#fff" strokeWidth="1.4" filter={`url(#${ids.lift})`} />
          <path d={sector(i * 30 + 1, i * 30 + 29, r2 + 1, r2 + 3)} fill={`url(#${ids.gold})`} />
        </>
      ) : (
        <path d={sector(i * 30, i * 30 + 30, r1, r2)} fill={fill} stroke="#fff" strokeWidth="1.4" />
      )}
      {children}
    </g>
  );
}

/** El medallón del centro, con doble filete dorado. */
export function Medallion({ ids, r, children }: { ids: WheelIds; r: number; children?: ReactNode }) {
  return (
    <g pointerEvents="none">
      <circle cx={C} cy={C} r={r + 6} fill="none" stroke={GOLD} strokeOpacity="0.45" strokeWidth="0.6" strokeDasharray="1 3" />
      <circle cx={C} cy={C} r={r} fill={`url(#${ids.med})`} stroke={`url(#${ids.gold})`} strokeWidth="1.6" filter={`url(#${ids.lift})`} />
      <circle cx={C} cy={C} r={r - 4} fill="none" stroke={GOLD} strokeOpacity="0.55" strokeWidth="0.5" />
      {children}
    </g>
  );
}

/** El texto del medallón: el símbolo grande en oro y, debajo, el nombre en versalitas. */
export function MedallionText({ glyph, label, size = 30 }: { glyph?: ReactNode; label?: string; size?: number }) {
  return (
    <>
      {glyph != null && (
        <text x={C} y={label ? C - 5 : C} textAnchor="middle" dominantBaseline="central" fontSize={size} fontFamily="Georgia, serif" fill={GOLD}>
          {glyph}
        </text>
      )}
      {label && (
        <text x={C} y={C + size / 2 + 4} textAnchor="middle" dominantBaseline="central" fontSize="7" letterSpacing="1.6" fill={INK} fillOpacity="0.7">
          {label.toUpperCase()}
        </text>
      )}
    </>
  );
}

/** Una marca pequeña de «es tuyo»: un rombo dorado. */
export function MineMark({ x, y, s = 4 }: { x: number; y: number; s?: number }) {
  return <path d={`M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`} fill={GOLD} stroke="#fff" strokeWidth="0.8" pointerEvents="none" />;
}

/** Los símbolos alquímicos de los elementos, dibujados (no todas las fuentes los tienen). */
export function ElementSymbol({ el, x, y, s, color }: { el: "Fuego" | "Tierra" | "Aire" | "Agua"; x: number; y: number; s: number; color: string }) {
  const up = el === "Fuego" || el === "Aire";
  const h = s * 0.87;
  const d = up ? `M${x} ${y - h * 0.62}L${x + s / 2} ${y + h * 0.38}L${x - s / 2} ${y + h * 0.38}Z` : `M${x} ${y + h * 0.62}L${x + s / 2} ${y - h * 0.38}L${x - s / 2} ${y - h * 0.38}Z`;
  const bar = el === "Aire" || el === "Tierra";
  const by = up ? y + h * 0.02 : y - h * 0.02;
  return (
    <g fill="none" stroke={color} strokeWidth={s / 14} strokeLinejoin="round" pointerEvents="none">
      <path d={d} />
      {bar && <line x1={x - s * 0.34} y1={by} x2={x + s * 0.34} y2={by} />}
    </g>
  );
}
