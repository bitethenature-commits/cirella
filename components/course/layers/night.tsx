"use client";

import { useId, type ReactNode } from "react";

/**
 * El cielo de noche de los dibujos del modelo por partes (Human Design, Gene Keys…): un panel con degradado
 * índigo, filo dorado y estrellas fijas. Va igual sobre el curso de noche que en la vista previa clara.
 */

export const NIGHT = "#100E26";
export const STAR = "#FBF6EC";
export const NIGHT_GOLD = "#E9CC8E";
export const NIGHT_RED = "#E36B5F";

export const usePrefix = () => useId().replace(/[^a-zA-Z0-9]/g, "");

export function NightPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.5rem] p-2 sm:p-3 ${className}`}
      style={{
        background: "radial-gradient(circle at 50% 35%, #2A2552 0%, #17153A 55%, #100E26 100%)",
        boxShadow: "0 0 0 1px rgb(200 168 110 / .28), 0 0 50px -14px rgb(150 120 220 / .45)",
      }}
    >
      {children}
    </div>
  );
}

/** Estrellas fijas (siempre las mismas) para el fondo de un dibujo. */
export function Stars({ w, h, n, x0 = 0, y0 = 0 }: { w: number; h: number; n: number; x0?: number; y0?: number }) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = Math.sin(i * 12.9898) * 43758.5453;
    const b = Math.sin(i * 78.233) * 12345.6789;
    return { x: x0 + (a - Math.floor(a)) * w, y: y0 + (b - Math.floor(b)) * h, r: 0.5 + ((i * 7) % 5) * 0.22 };
  });
  return (
    <g fill={STAR} pointerEvents="none">
      {pts.map((q, i) => (
        <circle key={i} cx={q.x} cy={q.y} r={q.r} opacity={0.25 + ((i * 13) % 7) * 0.08} />
      ))}
    </g>
  );
}

/** Degradados y filtros comunes: oro, brillo de cristal, sombra del borde y desenfoque para los halos. */
export function NightDefs({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}gold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F0D9A4" />
        <stop offset="50%" stopColor="#C8A86E" />
        <stop offset="100%" stopColor="#8E6D35" />
      </linearGradient>
      <radialGradient id={`${p}gloss`} cx="36%" cy="26%" r="62%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="45%" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${p}goldglow`} cx="50%" cy="50%" r="50%">
        <stop offset="35%" stopColor={NIGHT_GOLD} stopOpacity="0.55" />
        <stop offset="100%" stopColor={NIGHT_GOLD} stopOpacity="0" />
      </radialGradient>
      <filter id={`${p}blur`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>
  );
}

/** Chips sobre el cielo: de cristal; el elegido, dorado; los de la alumna, con estrella. */
export function NightChips({ items, selected, mine, tap }: { items: { key: string; label: string }[]; selected: string; mine: Set<string>; tap: (k: string, label: string) => Record<string, unknown> }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-1.5 pb-1">
      {items.map((it) => {
        const on = it.key === selected;
        const m = mine.has(it.key);
        return (
          <span
            key={it.key}
            {...tap(it.key, it.label)}
            className="rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold transition"
            style={{
              background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "rgb(255 255 255 / .06)",
              color: on ? NIGHT : STAR,
              borderColor: on ? "#F0D9A4" : m ? "rgb(233 204 142 / .6)" : "rgb(255 255 255 / .16)",
              boxShadow: on ? "0 0 14px rgb(233 204 142 / .45)" : undefined,
              cursor: "pointer",
            }}
          >
            {m ? "★ " : ""}
            {it.label}
          </span>
        );
      })}
    </div>
  );
}
