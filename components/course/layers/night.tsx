"use client";

import { useId, type ReactNode } from "react";
import { useT, Tr } from "@/lib/i18n/client";

/**
 * El cielo de noche de los dibujos del modelo por partes (Human Design, Gene Keys…): un panel negro,
 * con filo dorado y estrellas fijas. Va igual sobre el curso de noche que en la vista previa clara.
 */

export const NIGHT = "#0B0B0D";
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
      {/* El trazo de oro de las figuras: va por el dibujo entero (no por cada línea, que en las rectas no se ve). */}
      <linearGradient id={`${p}line`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="340" y2="340">
        <stop offset="0%" stopColor="#FBEFCF" />
        <stop offset="45%" stopColor="#E9CC8E" />
        <stop offset="100%" stopColor="#B8955A" />
      </linearGradient>
      {/* Halo suave detrás de lo elegido. */}
      <filter id={`${p}soft`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.4" />
      </filter>
      <radialGradient id={`${p}heart`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#F7E2AE" stopOpacity="0.16" />
        <stop offset="60%" stopColor="#F7E2AE" stopOpacity="0.04" />
        <stop offset="100%" stopColor="#F7E2AE" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/**
 * El marco fino de las figuras, como un astrolabio: un halo en el centro, dos círculos y las marcas de los
 * grados. Va detrás de todo, muy suave, para que la figura respire.
 */
export function Astrolabe({ p, r = 160, cx = 170, cy = 170, marks = 72 }: { p: string; r?: number; cx?: number; cy?: number; marks?: number }) {
  return (
    <g pointerEvents="none" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${p}heart)`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.16" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r={r - 5} fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.1" strokeWidth="0.5" />
      {Array.from({ length: marks }, (_, i) => {
        const a = (i * 2 * Math.PI) / marks;
        const big = i % (marks / 12) === 0;
        const r1 = r - (big ? 5 : 2.5);
        return (
          <line
            key={i}
            x1={(cx + r1 * Math.cos(a)).toFixed(2)}
            y1={(cy + r1 * Math.sin(a)).toFixed(2)}
            x2={(cx + r * Math.cos(a)).toFixed(2)}
            y2={(cy + r * Math.sin(a)).toFixed(2)}
            stroke={NIGHT_GOLD}
            strokeOpacity={big ? 0.32 : 0.16}
            strokeWidth={big ? 0.8 : 0.5}
          />
        );
      })}
    </g>
  );
}

/** Chips sobre el cielo: de cristal; el elegido, dorado; los de la alumna, con estrella. */
/** El selector de configuración dentro del modelo (qué tirada, por elemento o por dios…). */
export function OptionChips({ options, value, onPick }: { options: { value: string; label: string }[]; value: string; onPick?: (v: string) => void }) {
  const t = useT();
  return (
    <div className="mb-3 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label={t("Configuración")}>
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
            <Tr s={o.label} />
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
            <Tr s={m ? "★ " : ""} />
            <Tr s={it.label} />
          </span>
        );
      })}
    </div>
  );
}
