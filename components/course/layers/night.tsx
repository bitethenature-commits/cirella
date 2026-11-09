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

/** El sitio del dibujo: sin burbuja, sin borde y sin fondo propio (como los modelos de astrología). */
export function NightPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`relative ${className}`}>{children}</div>;
}

/** Estrellas fijas (siempre las mismas) para el fondo de un dibujo. */
export function Stars({ w, h, n, x0 = 0, y0 = 0 }: { w: number; h: number; n: number; x0?: number; y0?: number }) {
  // Sin estrellas: los modelos van sobre la noche de la página, como los de astrología.
  void w; void h; void n; void x0; void y0;
  return null;
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
/** El selector de configuración dentro del modelo (qué tirada, por elemento o por dios…). */
export function OptionChips({ options, value, onPick }: { options: { value: string; label: string }[]; value: string; onPick?: (v: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Configuración">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick?.(o.value)}
            className="min-h-8 rounded-full border px-3 text-[0.76rem] font-semibold transition"
            style={{
              background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "rgb(255 255 255 / .05)",
              color: on ? NIGHT : STAR,
              borderColor: on ? "#F0D9A4" : "rgb(233 204 142 / .3)",
              boxShadow: on ? "0 0 14px rgb(233 204 142 / .35)" : undefined,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

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
