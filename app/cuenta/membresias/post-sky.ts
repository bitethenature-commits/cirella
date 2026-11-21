import { moonCircleSky, moonSkyFor, type MoonCircleSky } from "@/lib/moon-circle-sky";
import { readMoonChoice } from "@/lib/product-texts";

/**
 * Un círculo de la luna no lleva foto: lleva su luna (nueva, llena o eclipse) en su signo, con su frase. La
 * elegida en su estudio o, si no hay, la de su fecha. Las demás publicaciones, null (llevan su foto).
 */
export function postSky(p: { kind: string; moon?: unknown; eventAt?: Date | null }): MoonCircleSky | null {
  if (p.kind !== "CIRCULO_LUNAR") return null;
  const m = readMoonChoice({ moon: p.moon });
  if (m) return moonSkyFor(m.phase, m.sign, m.phrase, p.eventAt);
  return p.eventAt ? moonCircleSky(p.eventAt) : null;
}
