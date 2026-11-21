import type { SVGProps } from "react";

/**
 * Icono de Gene Keys: una hebra de ADN en horizontal, abierta por los lados (cada mitad se cruza una
 * sola vez, así no forma círculos cerrados), y en medio, en vertical, una llave de puerta antigua
 * mirando hacia abajo (el ojo arriba y los dientes abajo). Dibujado con línea como los iconos de
 * lucide-react (viewBox de 24 y `currentColor`): toma el color y el grosor de donde se usa.
 */
export function GeneKeysIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* ADN a la izquierda: las dos hebras se cruzan en medio y quedan abiertas en los extremos */}
      <path d="M1.5 9C3.2 9 4 10.5 5.5 12C7 13.5 7.8 15 9.5 15" />
      <path d="M1.5 15C3.2 15 4 13.5 5.5 12C7 10.5 7.8 9 9.5 9" />
      {/* ADN a la derecha */}
      <path d="M14.5 9C16.2 9 17 10.5 18.5 12C20 13.5 20.8 15 22.5 15" />
      <path d="M14.5 15C16.2 15 17 13.5 18.5 12C20 10.5 20.8 9 22.5 9" />
      {/* Los peldaños del ADN */}
      <path d="M2.7 9.2V14.8M8.3 9.2V14.8M15.7 9.2V14.8M21.3 9.2V14.8" />
      {/* Llave antigua mirando hacia abajo: el ojo arriba, el cuello, la caña y los dientes abajo */}
      <circle cx="12" cy="4" r="2.5" />
      <circle cx="12" cy="4" r="0.8" />
      <path d="M10.9 7.6H13.1" />
      <path d="M12 6.5V22.5" />
      <path d="M12 17.5H14.6V22.5H13.3V20.5H12" />
    </svg>
  );
}
