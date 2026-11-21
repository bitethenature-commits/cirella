import { Mail } from "lucide-react";
import { TrackedLink } from "./tracking";

type TrackPayload = Parameters<typeof TrackedLink>[0]["event"];

/** Centros de la «Flor de la vida»: el centro y dos anillos de seis (19 círculos). */
function flowerCenters(r: number) {
  const out: [number, number][] = [[0, 0]];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    out.push([r * Math.cos(a), r * Math.sin(a)]);
    out.push([2 * r * Math.cos(a), 2 * r * Math.sin(a)]);
    const b = a + Math.PI / 6;
    out.push([Math.sqrt(3) * r * Math.cos(b), Math.sqrt(3) * r * Math.sin(b)]);
  }
  return out;
}

/** La Flor de la vida (geometría sagrada) en trazo dorado fino. */
export function FlowerOfLife({ className = "", strokeWidth = 0.5 }: { className?: string; strokeWidth?: number }) {
  const r = 6;
  return (
    <svg viewBox="-20 -20 40 40" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <circle r={18.4} />
      <circle r={19.4} strokeWidth={strokeWidth * 0.6} />
      {flowerCenters(r).map(([x, y], i) => (
        <circle key={i} cx={x.toFixed(3)} cy={y.toFixed(3)} r={r} />
      ))}
    </svg>
  );
}

/**
 * Botón «Escríbeme» de lecturas y sesiones: una cápsula con doble borde dorado, el sobre y el texto
 * en cursiva.
 */
export function SacredButton({ href, label, event, ariaLabel, className = "" }: { href: string; label: string; event?: TrackPayload | null; ariaLabel?: string; className?: string }) {
  return (
    <TrackedLink href={href} event={event} ariaLabel={ariaLabel} className={`cp-sacred-btn ${className}`}>
      <span className="cp-sacred-label">
        <Mail className="h-5 w-5" strokeWidth={1.3} />
        {label}
      </span>
    </TrackedLink>
  );
}
