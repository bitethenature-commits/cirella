"use client";

import { useId } from "react";
import { CelestialDefs, MoonGlobe } from "@/components/course/layers/celestial";

/**
 * La Luna en su fase, dibujada con realismo (mares, cráteres, el borde más oscuro y el terminador suave):
 * 0 nueva, 0,25 cuarto creciente, 0,5 llena, 0,75 cuarto menguante.
 */
export function MoonDisc({ phase, size = 120, glow = true, className, label = true }: { phase: number; size?: number; glow?: boolean; className?: string; label?: boolean }) {
  const gid = `md${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const illuminated = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  return (
    <svg
      viewBox="-60 -60 120 120"
      className={`overflow-visible ${className ?? ""}`}
      width={size}
      height={size}
      {...(label ? { role: "img", "aria-label": `Fase lunar, ${Math.round(illuminated * 100)} % iluminada` } : { "aria-hidden": true })}
    >
      <CelestialDefs p={gid} />
      <MoonGlobe p={gid} cx={0} cy={0} r={50} phase={phase} glow={glow} />
    </svg>
  );
}
