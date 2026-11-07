import type { SVGProps } from "react";

/**
 * Icono del Oráculo: una carta de oráculo de pie, con su marco por dentro, una estrella de cuatro
 * puntas en el centro y una luna pequeña arriba, y otra carta asomando detrás, algo girada.
 * Dibujado con línea como los iconos de lucide-react (viewBox de 24 y `currentColor`).
 */
export function OracleIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* La carta de detrás, girada: solo asoma su borde */}
      <path d="M5.2 6.2L3.1 18.4a1.6 1.6 0 0 0 1.3 1.85l2.2.38" opacity="0.6" />
      {/* La carta */}
      <rect x="7" y="2.6" width="13" height="18.8" rx="1.8" />
      {/* Su marco */}
      <rect x="8.9" y="4.5" width="9.2" height="15" rx="0.9" opacity="0.55" />
      {/* Estrella de cuatro puntas */}
      <path d="M13.5 9.2Q13.95 11.55 16.3 12Q13.95 12.45 13.5 14.8Q13.05 12.45 10.7 12Q13.05 11.55 13.5 9.2Z" />
      {/* Luna arriba y punto abajo */}
      <path d="M14.15 6.15a1.05 1.05 0 1 1-1.2 1.35a.85.85 0 0 0 1.2-1.35Z" />
      <circle cx="13.5" cy="17.3" r="0.35" />
    </svg>
  );
}
