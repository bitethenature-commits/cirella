"use client";

import { useId } from "react";
import { moonLit } from "./common";

/**
 * Los astros, dibujados con realismo: la Luna con sus mares, cráteres y textura (el borde más oscuro y el
 * terminador suave), el Sol con su superficie granulada, corona y halo, la Tierra con océanos, continentes,
 * nubes y atmósfera, y los eclipses (la corona de verdad en el de Sol, la Luna cobriza en el de Luna).
 *
 * Todo se dibuja en «unidades de radio» (el astro mide 1) y se escala a su tamaño, así que se ve igual de bien
 * grande o pequeño. Las piezas comunes (degradados, texturas) van en <CelestialDefs p={prefijo} />.
 */

const unit = (cx: number, cy: number, r: number) => `translate(${cx} ${cy}) scale(${r})`;
const uid = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "");

export function CelestialDefs({ p }: { p: string }) {
  return (
    <defs>
      {/* ---- La Luna ---- */}
      <clipPath id={`${p}disc`}>
        <circle r="1" />
      </clipPath>
      <radialGradient id={`${p}moonsurf`} cx="44%" cy="40%" r="62%">
        <stop offset="0%" stopColor="#F8F4EA" />
        <stop offset="60%" stopColor="#E3DCCD" />
        <stop offset="100%" stopColor="#B7AE9C" />
      </radialGradient>
      <radialGradient id={`${p}moonlimb`} cx="50%" cy="50%" r="50%">
        <stop offset="55%" stopColor="#1E1A14" stopOpacity="0" />
        <stop offset="88%" stopColor="#1E1A14" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#1E1A14" stopOpacity="0.5" />
      </radialGradient>
      <radialGradient id={`${p}moondark`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#25243A" />
        <stop offset="100%" stopColor="#0C0B17" />
      </radialGradient>
      <radialGradient id={`${p}moonhalo`} cx="50%" cy="50%" r="50%">
        <stop offset="40%" stopColor="#F3ECDD" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#F3ECDD" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${p}copper`} cx="38%" cy="36%" r="72%">
        <stop offset="0%" stopColor="#E89A5E" />
        <stop offset="50%" stopColor="#B04E2C" />
        <stop offset="100%" stopColor="#3F130B" />
      </radialGradient>
      <radialGradient id={`${p}umbra`} cx="50%" cy="50%" r="50%">
        <stop offset="80%" stopColor="#7A2A16" />
        <stop offset="100%" stopColor="#7A2A16" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${p}penumbra`} cx="50%" cy="50%" r="50%">
        <stop offset="35%" stopColor="#3A3440" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#3A3440" stopOpacity="0" />
      </radialGradient>
      {/* La foto de la Luna, más clara y con un punto cálido. */}
      <filter id={`${p}photo`} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1.42 0 0 0 0.05  0 1.38 0 0 0.04  0 0 1.26 0 0.02  0 0 0 1 0" />
      </filter>
      {/* El terminador, suave (no un corte limpio). */}
      <filter id={`${p}soft`} filterUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
        <feGaussianBlur stdDeviation="0.045" />
      </filter>
      <filter id={`${p}mare`} filterUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
        <feGaussianBlur stdDeviation="0.035" />
      </filter>
      {/* La textura de la superficie: un grano fino que parece polvo y cráteres. */}
      <filter id={`${p}grain`} filterUnits="userSpaceOnUse" x="-1" y="-1" width="2" height="2">
        <feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="4" seed="7" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.33  0 0 0 0 0.3  0 0 0 0 0.26  1.6 0 0 0 -0.62" />
      </filter>

      {/* ---- El Sol ---- */}
      <radialGradient id={`${p}sunsurf`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFBEA" />
        <stop offset="45%" stopColor="#FFE6A0" />
        <stop offset="80%" stopColor="#F7B44C" />
        <stop offset="100%" stopColor="#D5741F" />
      </radialGradient>
      <radialGradient id={`${p}sunglow`} cx="50%" cy="50%" r="50%">
        <stop offset="28%" stopColor="#FFDC92" stopOpacity="0.6" />
        <stop offset="55%" stopColor="#F5B04A" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#F5B04A" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${p}sunray`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#FFE3A6" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#FFE3A6" stopOpacity="0" />
      </linearGradient>
      <filter id={`${p}sungrain`} filterUnits="userSpaceOnUse" x="-1" y="-1" width="2" height="2">
        <feTurbulence type="fractalNoise" baseFrequency="9" numOctaves="2" seed="3" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.3  0 0 0 0 0.05  1.8 0 0 0 -0.75" />
      </filter>
      {/* La corona de un eclipse total. */}
      <linearGradient id={`${p}streamer`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
        <stop offset="45%" stopColor="#F4EEFF" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#E6E0FF" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${p}inner`} cx="50%" cy="50%" r="50%">
        <stop offset="68%" stopColor="#FFFFFF" stopOpacity="1" />
        <stop offset="76%" stopColor="#FFF4DA" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#FFF4DA" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${p}corglow`} cx="50%" cy="50%" r="50%">
        <stop offset="25%" stopColor="#EDE7FF" stopOpacity="0.45" />
        <stop offset="60%" stopColor="#C9C0F0" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#C9C0F0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${p}bead`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
        <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <filter id={`${p}corblur`} filterUnits="userSpaceOnUse" x="-4" y="-4" width="8" height="8">
        <feGaussianBlur stdDeviation="0.07" />
      </filter>

      {/* ---- La Tierra ---- */}
      <radialGradient id={`${p}ocean`} cx="40%" cy="36%" r="68%">
        <stop offset="0%" stopColor="#62B6EC" />
        <stop offset="55%" stopColor="#2367A6" />
        <stop offset="100%" stopColor="#0A2A55" />
      </radialGradient>
      <radialGradient id={`${p}land`} cx="40%" cy="36%" r="70%">
        <stop offset="0%" stopColor="#82AE5E" />
        <stop offset="100%" stopColor="#3F6A35" />
      </radialGradient>
      <radialGradient id={`${p}atmo`} cx="50%" cy="50%" r="50%">
        <stop offset="74%" stopColor="#8FD0FF" stopOpacity="0.6" />
        <stop offset="82%" stopColor="#8FD0FF" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#8FD0FF" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${p}earthlimb`} cx="50%" cy="50%" r="50%">
        <stop offset="60%" stopColor="#02132E" stopOpacity="0" />
        <stop offset="100%" stopColor="#02132E" stopOpacity="0.45" />
      </radialGradient>
      <linearGradient id={`${p}night`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#020612" stopOpacity="0" />
        <stop offset="46%" stopColor="#020612" stopOpacity="0" />
        <stop offset="60%" stopColor="#020612" stopOpacity="0.72" />
        <stop offset="100%" stopColor="#020612" stopOpacity="0.9" />
      </linearGradient>
      <filter id={`${p}cloud`} filterUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
        <feGaussianBlur stdDeviation="0.03" />
      </filter>
    </defs>
  );
}

/* ------------------------------------------------------------------ La Luna */

/** La foto de la Luna llena (NASA, sonda LRO; de uso libre), recortada justo al disco. */
export const MOON_PHOTO = "/img/luna-nasa.jpg";

/** La superficie iluminada: la foto de verdad, un poco más clara y cálida, y el borde apenas oscurecido. */
function MoonFace({ p }: { p: string }) {
  return (
    <>
      <circle r="1" fill="#CFC8B8" />
      <image href={MOON_PHOTO} x="-1.012" y="-1.012" width="2.024" height="2.024" preserveAspectRatio="none" filter={`url(#${p}photo)`} />
      <circle r="1" fill={`url(#${p}moonlimb)`} opacity="0.6" />
    </>
  );
}

/**
 * La Luna en una fase (0 nueva, 0,5 llena). Con `eclipse`, la Luna llena dentro de la sombra de la Tierra: cobriza
 * en el total, mordida por la sombra en el parcial y apenas velada en el penumbral.
 */
export function MoonGlobe({
  p,
  cx,
  cy,
  r,
  phase,
  glow = false,
  eclipse,
}: {
  p: string;
  cx: number;
  cy: number;
  r: number;
  phase: number;
  glow?: boolean;
  eclipse?: "total" | "partial" | "penumbral" | "annular";
}) {
  const id = `${p}m${uid(useId())}`;
  if (r <= 0) return null;
  const ph = ((phase % 1) + 1) % 1;
  const lit = moonLit(0, 0, 1, ph);
  const illum = (1 - Math.cos(2 * Math.PI * ph)) / 2;
  const blood = eclipse === "total" || eclipse === "partial" || eclipse === "penumbral" ? eclipse : null;
  return (
    <g pointerEvents="none" transform={unit(cx, cy, r)}>
      <defs>
        <mask id={`${id}lit`} maskUnits="userSpaceOnUse" x="-1.5" y="-1.5" width="3" height="3">
          {lit && <path d={lit} fill="#fff" filter={`url(#${p}soft)`} />}
        </mask>
      </defs>
      {glow && illum > 0.04 && <circle r="1.75" fill={blood === "total" ? "rgb(200 90 50 / .25)" : `url(#${p}moonhalo)`} opacity={blood ? 1 : illum} />}
      <g clipPath={`url(#${p}disc)`}>
        {/* La cara de noche, con un poco de luz cenicienta. */}
        <circle r="1" fill={`url(#${p}moondark)`} />
        {/* La luz cenicienta: la cara de noche se adivina, muy tenue. */}
        <image href={MOON_PHOTO} x="-1.012" y="-1.012" width="2.024" height="2.024" preserveAspectRatio="none" opacity="0.1" />
        {lit && (
          <g mask={`url(#${id}lit)`}>
            <MoonFace p={p} />
          </g>
        )}
        {blood === "total" && <circle r="1" fill={`url(#${p}copper)`} opacity="0.92" style={{ mixBlendMode: "multiply" }} />}
        {blood === "partial" && (
          <g filter={`url(#${p}soft)`}>
            <circle cx="0.95" cy="-0.35" r="1.3" fill={`url(#${p}umbra)`} opacity="0.95" style={{ mixBlendMode: "multiply" }} />
          </g>
        )}
        {blood === "penumbral" && <circle cx="0.9" cy="-0.3" r="1.7" fill={`url(#${p}penumbra)`} />}
      </g>
      <circle r="1" fill="none" stroke="rgb(255 255 255 / .16)" strokeWidth={Math.max(0.6, r / 22) / r} />
    </g>
  );
}

/* ------------------------------------------------------------------ El Sol */

/** El disco del Sol: oscurecido hacia el borde, granulado y con un par de manchas. */
function SunFace({ p }: { p: string }) {
  return (
    <>
      <circle r="1" fill={`url(#${p}sunsurf)`} />
      <g clipPath={`url(#${p}disc)`}>
        <rect x="-1" y="-1" width="2" height="2" filter={`url(#${p}sungrain)`} opacity="0.45" />
        <circle cx="0.34" cy="-0.2" r="0.1" fill="#9A4F12" opacity="0.28" />
        <circle cx="0.34" cy="-0.2" r="0.05" fill="#5E2A08" opacity="0.65" />
        <circle cx="0.46" cy="-0.1" r="0.03" fill="#5E2A08" opacity="0.55" />
        <circle cx="-0.38" cy="0.3" r="0.035" fill="#5E2A08" opacity="0.45" />
      </g>
      <circle r="1" fill="none" stroke="#FFF2C8" strokeOpacity="0.4" strokeWidth="0.02" />
    </>
  );
}

/** El Sol: halo, rayos de luz suaves y el disco granulado. */
export function SunGlobe({ p, cx, cy, r, rays = true }: { p: string; cx: number; cy: number; r: number; rays?: boolean }) {
  return (
    <g pointerEvents="none" transform={unit(cx, cy, r)}>
      <circle r="2.6" fill={`url(#${p}sunglow)`} />
      {rays && (
        <g>
          {Array.from({ length: 16 }, (_, i) => {
            const L = i % 2 ? 1.75 : 2.3;
            return <path key={i} d={`M-0.07 -0.98 Q-0.02 ${-(1 + L) / 2} 0 ${-L} Q0.02 ${-(1 + L) / 2} 0.07 -0.98 Z`} fill={`url(#${p}sunray)`} transform={`rotate(${i * 22.5 + 8})`} />;
          })}
        </g>
      )}
      <SunFace p={p} />
    </g>
  );
}

/* ------------------------------------------------------------------ Eclipse de Sol */

/**
 * Un eclipse de Sol (r = el radio de la Luna). Total: la Luna negra con la corona blanca, sus serpentinas,
 * unas protuberancias rosadas y el «anillo de diamante». Anular: el anillo de fuego. Parcial: el Sol mordido.
 */
export function SolarEclipse({ p, cx, cy, r, type }: { p: string; cx: number; cy: number; r: number; type: "total" | "partial" | "annular" | "penumbral" }) {
  if (type === "total") {
    const streamers: [number, number][] = [
      [-78, 3.1], [-42, 2.2], [-12, 2.6], [22, 1.9], [58, 3.3], [96, 2.1], [128, 2.7], [165, 2.0], [205, 3.0], [238, 2.2], [275, 2.6], [318, 1.9],
    ];
    return (
      <g pointerEvents="none" transform={unit(cx, cy, r)}>
        <circle r="3.4" fill={`url(#${p}corglow)`} />
        <g filter={`url(#${p}corblur)`} opacity="0.9">
          {streamers.map(([a, L], i) => (
            <path key={i} d={`M-0.42 -0.9 Q-0.12 ${-(1 + L) / 2} 0 ${-L} Q0.12 ${-(1 + L) / 2} 0.42 -0.9 Z`} fill={`url(#${p}streamer)`} transform={`rotate(${a})`} />
          ))}
        </g>
        <circle r="1.42" fill={`url(#${p}inner)`} />
        {/* Protuberancias en el borde. */}
        <g fill="#FF6F86" opacity="0.9" filter={`url(#${p}soft)`}>
          <ellipse cx={Math.cos(3.6)} cy={Math.sin(3.6)} rx="0.07" ry="0.04" transform={`rotate(${(3.6 * 180) / Math.PI} ${Math.cos(3.6)} ${Math.sin(3.6)})`} />
          <ellipse cx={Math.cos(0.9)} cy={Math.sin(0.9)} rx="0.06" ry="0.035" transform={`rotate(${(0.9 * 180) / Math.PI} ${Math.cos(0.9)} ${Math.sin(0.9)})`} />
        </g>
        <circle r="1" fill="#040309" />
        <circle r="1" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="0.015" />
        {/* El anillo de diamante. */}
        <g transform={`translate(${Math.cos(-0.85) * 1.01} ${Math.sin(-0.85) * 1.01})`}>
          <circle r="0.45" fill={`url(#${p}bead)`} />
          <g stroke="#FFFFFF" strokeWidth="0.016" strokeLinecap="round" opacity="0.75">
            <line x1="-0.6" y1="0" x2="0.6" y2="0" />
            <line x1="0" y1="-0.6" x2="0" y2="0.6" />
            <line x1="-0.28" y1="-0.28" x2="0.28" y2="0.28" opacity="0.6" />
            <line x1="-0.28" y1="0.28" x2="0.28" y2="-0.28" opacity="0.6" />
          </g>
          <circle r="0.07" fill="#FFFFFF" />
        </g>
      </g>
    );
  }
  if (type === "annular") {
    return (
      <g pointerEvents="none" transform={unit(cx, cy, r)}>
        <circle r="2.9" fill={`url(#${p}sunglow)`} />
        <g transform="scale(1.13)">
          <SunFace p={p} />
        </g>
        <circle cx="0.02" cy="0.01" r="0.97" fill="#05040B" />
        <circle cx="0.02" cy="0.01" r="0.97" fill="none" stroke="#FFD27A" strokeOpacity="0.5" strokeWidth="0.03" />
      </g>
    );
  }
  return (
    <g pointerEvents="none" transform={unit(cx, cy, r)}>
      <circle r="2.7" fill={`url(#${p}sunglow)`} />
      <g transform="scale(1.04)">
        <SunFace p={p} />
      </g>
      <circle cx="0.58" cy="-0.42" r="1" fill="#05040B" />
    </g>
  );
}

/* ------------------------------------------------------------------ La Tierra */

const LAND = [
  // África
  "M-0.05 -0.1C0.15 -0.15 0.35 -0.1 0.4 0.05C0.45 0.15 0.36 0.25 0.31 0.4C0.25 0.6 0.15 0.75 0.08 0.78C0 0.65 0.02 0.45 -0.05 0.3C-0.12 0.2 -0.3 0.15 -0.32 0C-0.3 -0.1 -0.2 -0.12 -0.05 -0.1Z",
  // Europa
  "M-0.25 -0.25C-0.22 -0.4 -0.05 -0.55 0.15 -0.56C0.3 -0.6 0.47 -0.52 0.52 -0.36C0.4 -0.3 0.3 -0.3 0.2 -0.25C0.1 -0.2 0 -0.22 -0.1 -0.2C-0.18 -0.18 -0.26 -0.2 -0.25 -0.25Z",
  // Arabia
  "M0.42 -0.1C0.55 -0.12 0.68 0 0.62 0.13C0.55 0.1 0.48 0 0.42 -0.1Z",
  // Madagascar
  "M0.47 0.5C0.52 0.47 0.53 0.58 0.49 0.64C0.46 0.6 0.45 0.54 0.47 0.5Z",
  // Sudamérica, asomando por el borde
  "M-0.98 0.08C-0.82 0.04 -0.68 0.2 -0.7 0.4C-0.74 0.56 -0.86 0.62 -0.94 0.5Z",
  // Asia, por el otro borde
  "M0.55 -0.55C0.72 -0.62 0.92 -0.5 0.98 -0.25C0.9 -0.18 0.78 -0.2 0.68 -0.28C0.6 -0.35 0.55 -0.45 0.55 -0.55Z",
];
const CLOUDS = [
  "M-0.72 -0.46q0.25 -0.12 0.5 0t0.5 0",
  "M-0.2 0.56q0.2 -0.1 0.45 0t0.4 0.05",
  "M0.1 -0.76q0.2 0.08 0.45 -0.02",
  "M-0.86 0.26q0.15 0.1 0.3 0",
  "M-0.5 0.82q0.3 -0.08 0.62 0",
  "M0.25 0.12q0.15 -0.06 0.3 0.02",
];

/** La Tierra: océanos, continentes, nubes, la noche hacia `night` grados (0 = a la derecha) y una atmósfera azul. */
export function EarthGlobe({ p, cx, cy, r, night = 25 }: { p: string; cx: number; cy: number; r: number; night?: number }) {
  return (
    <g pointerEvents="none" transform={unit(cx, cy, r)}>
      <circle r="1.3" fill={`url(#${p}atmo)`} />
      <g clipPath={`url(#${p}disc)`}>
        <circle r="1" fill={`url(#${p}ocean)`} />
        <g fill={`url(#${p}land)`}>
          {LAND.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <ellipse cx="0.05" cy="0.02" rx="0.2" ry="0.08" fill="#C9AA6E" opacity="0.8" filter={`url(#${p}cloud)`} />
        <ellipse cx="0.55" cy="0.0" rx="0.06" ry="0.06" fill="#C9AA6E" opacity="0.7" />
        <ellipse cx="0" cy="1" rx="0.6" ry="0.14" fill="#F4F8FC" opacity="0.85" />
        <ellipse cx="0" cy="-1" rx="0.45" ry="0.1" fill="#F4F8FC" opacity="0.75" />
        <g fill="none" stroke="#FFFFFF" strokeWidth="0.07" strokeLinecap="round" opacity="0.72" filter={`url(#${p}cloud)`}>
          {CLOUDS.map((d, i) => (
            <path key={i} d={d} />
          ))}
          <path d="M0.62 0.5a0.12 0.1 0 1 1 0.12 -0.12" strokeWidth="0.05" />
        </g>
        <ellipse cx="-0.36" cy="-0.38" rx="0.3" ry="0.22" fill="#FFFFFF" opacity="0.12" filter={`url(#${p}cloud)`} />
        <circle r="1" fill={`url(#${p}earthlimb)`} />
        <rect x="-1" y="-1" width="2" height="2" fill={`url(#${p}night)`} transform={`rotate(${night})`} />
      </g>
      <circle r="1" fill="none" stroke="#A6DDFF" strokeOpacity="0.55" strokeWidth="0.05" filter={`url(#${p}cloud)`} />
    </g>
  );
}
