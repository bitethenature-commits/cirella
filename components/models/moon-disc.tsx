"use client";

import { useId } from "react";

/**
 * Luna geométricamente correcta (portada de la web antigua): el terminador es media circunferencia unida
 * a una elipse de radio horizontal |cos(2π·fase)|. Las banderas del arco deciden qué lado está iluminado
 * y si es creciente o gibosa.
 */
export function MoonDisc({ phase, size = 120, glow = true, className, label = true }: { phase: number; size?: number; glow?: boolean; className?: string; label?: boolean }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = 50;
  const k = Math.cos(phase * Math.PI * 2);
  const rx = Math.abs(k) * r;
  const waxing = phase < 0.5;
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = k > 0 === waxing ? 0 : 1;
  const litPath = `M 0 ${-r} A ${r} ${r} 0 0 ${sweepOuter} 0 ${r} A ${rx} ${r} 0 0 ${sweepInner} 0 ${-r}`;
  const illuminated = (1 - k) / 2;

  return (
    <svg
      viewBox="-60 -60 120 120"
      className={`overflow-visible ${className ?? ""}`}
      width={size}
      height={size}
      {...(label ? { role: "img", "aria-label": `Fase lunar, ${Math.round(illuminated * 100)} % iluminada` } : { "aria-hidden": true })}
    >
      <defs>
        <radialGradient id={`lit-${gid}`} cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#FFFDF6" />
          <stop offset="60%" stopColor="#EDE4D0" />
          <stop offset="100%" stopColor="#C9BFA8" />
        </radialGradient>
        <radialGradient id={`halo-${gid}`} cx="50%" cy="50%" r="50%">
          <stop offset="45%" stopColor="#E8DCC8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#E8DCC8" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`disc-${gid}`}>
          <circle cx="0" cy="0" r={r} />
        </clipPath>
        {/* Los mares solo en la parte iluminada: el borde oscuro sigue oscuro. */}
        <clipPath id={`litclip-${gid}`}>
          <path d={litPath} />
        </clipPath>
      </defs>
      {glow && illuminated > 0.04 && <circle cx="0" cy="0" r={r * 1.85} fill={`url(#halo-${gid})`} opacity={illuminated} />}
      {/* La parte sin luz, como un disco ceniciento, igual que en el cielo. */}
      <circle cx="0" cy="0" r={r} fill="#1A1714" opacity="0.85" />
      <circle cx="0" cy="0" r={r} fill="none" style={{ stroke: "var(--c-gold)" }} strokeWidth="0.8" opacity="0.45" />
      <g clipPath={`url(#disc-${gid})`}>
        <path d={litPath} fill={`url(#lit-${gid})`} />
        <g fill="#8C8271" opacity="0.16" clipPath={`url(#litclip-${gid})`}>
          <ellipse cx="-14" cy="-16" rx="13" ry="10" />
          <ellipse cx="10" cy="-6" rx="9" ry="7" />
          <ellipse cx="-6" cy="16" rx="15" ry="9" />
          <circle cx="22" cy="18" r="5" />
          <circle cx="-26" cy="8" r="4" />
        </g>
      </g>
    </svg>
  );
}
