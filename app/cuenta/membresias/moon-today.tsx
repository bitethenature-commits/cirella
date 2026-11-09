"use client";

import { useId } from "react";
import { CelestialDefs, MoonGlobe } from "@/components/course/layers/celestial";

/** La Luna de hoy, con la foto de verdad y su fase, para la cabecera de la membresía. */
export function MoonToday({ elong, size = 56 }: { elong: number; size?: number }) {
  const p = `mt${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="-30 -30 60 60" width={size} height={size} className="shrink-0 overflow-visible" aria-hidden>
      <CelestialDefs p={p} />
      <MoonGlobe p={p} cx={0} cy={0} r={24} phase={elong / 360} glow />
    </svg>
  );
}
