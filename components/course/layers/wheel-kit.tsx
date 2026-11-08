"use client";

import { useId, type ReactNode } from "react";
import { C, pt, sector } from "./common";

/**
 * Las ruedas de los modelos por partes de astrología, con el aire de la carta natal (components/models/
 * chart-model.tsx): sobre la noche, sin papel, con filetes dorados finos, marcas de grado, los signos con el
 * color de su elemento y la tinta clara. La pieza elegida, en oro translúcido; el centro, un círculo fino dorado.
 * Los ids de los degradados llevan el useId de cada rueda: en una lección puede haber varias.
 */

/** La tinta de las ruedas (clara, sobre la noche), su versión suave, el oro y el texto sobre lo elegido. */
export const WK_INK = "#EDE6D6";
export const WK_MUTED = "rgb(237 230 214 / .55)";
export const WK_GOLD = "#D4B57A";
export const WK_CREAM = "#FFF3D4";
/** Rellenos de noche: la franja suave, la un poco más marcada, lo elegido y los filetes. */
export const WK_FILL = "rgb(255 255 255 / .04)";
export const WK_FILL2 = "rgb(255 255 255 / .08)";
export const WK_ON = "rgb(212 181 122 / .22)";
export const WK_RULE = "rgb(255 255 255 / .14)";

export type WheelIds = { bg: string; sel: string; gold: string; med: string; lift: string; glow: string };

export function useWheelIds(): WheelIds {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return { bg: `${id}bg`, sel: `${id}sel`, gold: `${id}gold`, med: `${id}med`, lift: `${id}lift`, glow: `${id}glow` };
}

export function WheelDefs({ ids }: { ids: WheelIds }) {
  return (
    <defs>
      <radialGradient id={ids.bg} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#D4B57A" stopOpacity="0.1" />
        <stop offset="70%" stopColor="#D4B57A" stopOpacity="0.03" />
        <stop offset="100%" stopColor="#D4B57A" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={ids.sel} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#D4B57A" stopOpacity="0.38" />
        <stop offset="100%" stopColor="#D4B57A" stopOpacity="0.16" />
      </linearGradient>
      <linearGradient id={ids.gold} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F0D9A4" />
        <stop offset="50%" stopColor="#D4B57A" />
        <stop offset="100%" stopColor="#A9874A" />
      </linearGradient>
      <radialGradient id={ids.med} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#D4B57A" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#D4B57A" stopOpacity="0.02" />
      </radialGradient>
      <filter id={ids.lift} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#D4B57A" floodOpacity="0.35" />
      </filter>
      <filter id={ids.glow} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
    </defs>
  );
}

/**
 * El fondo de la rueda, como la carta natal: un halo dorado muy suave hasta el borde del anillo de los signos
 * (r = 157) y un solo filete dorado. Sin reborde por fuera: las marcas de grado van por dentro (DegreeTicks).
 */
export function WheelBase({ ids, r = 157 }: { ids: WheelIds; ticks?: boolean; r?: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={C} cy={C} r={r} fill={`url(#${ids.bg})`} stroke={WK_GOLD} strokeOpacity="0.6" strokeWidth="0.8" />
    </g>
  );
}

/** Las marcas de grado en el borde de dentro del anillo de los signos, como en la carta natal: cada grado, más largas cada 5° y 10°. `rot`: la rueda girada (al Ascendente). */
export function DegreeTicks({ r, rot = 0 }: { r: number; rot?: number }) {
  let d = "";
  for (let deg = 0; deg < 360; deg++) {
    const len = deg % 10 === 0 ? 3.6 : deg % 5 === 0 ? 2.4 : 1.3;
    const a = pt(deg - rot, r);
    const b = pt(deg - rot, r - len);
    d += `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }
  return (
    <g pointerEvents="none">
      <path d={d} stroke={WK_INK} strokeOpacity="0.4" strokeWidth="0.45" />
      <circle cx={C} cy={C} r={r} fill="none" stroke={WK_GOLD} strokeOpacity="0.6" strokeWidth="0.8" />
    </g>
  );
}

/** Un anillo de doce sectores (los signos, las casas…), separados por filetes finos; el elegido, en oro translúcido. */
export function RingSector({ i, r1, r2, fill, on, ids, children, ...rest }: { i: number; r1: number; r2: number; fill: string; on: boolean; ids: WheelIds; children?: ReactNode } & Record<string, unknown>) {
  return (
    <g {...rest}>
      {on ? (
        <>
          <path d={sector(i * 30, i * 30 + 30, r1, r2)} fill={`url(#${ids.sel})`} stroke={WK_GOLD} strokeWidth="1" />
          <path d={sector(i * 30 + 1, i * 30 + 29, r2 - 2, r2)} fill={`url(#${ids.gold})`} />
        </>
      ) : (
        <path d={sector(i * 30, i * 30 + 30, r1, r2)} fill={fill} stroke={WK_RULE} strokeWidth="0.8" />
      )}
      {children}
    </g>
  );
}

/** El centro: un círculo fino dorado, sin relleno de papel, con un halo muy suave. */
export function Medallion({ ids, r, children }: { ids: WheelIds; r: number; children?: ReactNode }) {
  return (
    <g pointerEvents="none">
      <circle cx={C} cy={C} r={r} fill={`url(#${ids.med})`} stroke={WK_GOLD} strokeOpacity="0.75" strokeWidth="0.8" />
      <circle cx={C} cy={C} r={r + 4} fill="none" stroke={WK_GOLD} strokeOpacity="0.25" strokeWidth="0.5" strokeDasharray="1 3" />
      {children}
    </g>
  );
}

/** El texto del centro: el símbolo en oro y, debajo, el nombre en versalitas finas. */
export function MedallionText({ glyph, label, size = 30 }: { glyph?: ReactNode; label?: string; size?: number }) {
  return (
    <>
      {glyph != null && (
        <text x={C} y={label ? C - 5 : C} textAnchor="middle" dominantBaseline="central" fontSize={size} fontFamily="Georgia, serif" fill={WK_GOLD}>
          {glyph}
        </text>
      )}
      {label && (
        <text x={C} y={C + size / 2 + 4} textAnchor="middle" dominantBaseline="central" fontSize="6.5" letterSpacing="1.8" fill={WK_INK} fillOpacity="0.7">
          {label.toUpperCase()}
        </text>
      )}
    </>
  );
}

/** Una marca pequeña de «es tuyo»: un rombo dorado. */
export function MineMark({ x, y, s = 4 }: { x: number; y: number; s?: number }) {
  return <path d={`M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`} fill={WK_GOLD} stroke="#100E26" strokeWidth="0.8" pointerEvents="none" />;
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
