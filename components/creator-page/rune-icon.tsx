import type { SVGProps } from "react";

/**
 * Icono de las Runas: una piedra rúnica como un canto rodado (ovalada, irregular y algo inclinada,
 * no un círculo) con la runa Algiz grabada, y otra piedra asomando detrás, como la carta de detrás
 * del Oráculo. Dibujado con línea como los iconos de lucide-react (viewBox de 24 y `currentColor`).
 */
export function RuneIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* La piedra de detrás: solo asoma su borde, arriba a la derecha */}
      <path d="M13.6 4.6C14.9 2.9 17.6 2.4 19.7 3.6C21.9 4.9 22.5 7.6 21.4 9.9" opacity="0.6" />
      {/* La piedra: un canto rodado ovalado, más ancho que alto y más grueso abajo */}
      <path d="M10.4 5.3C15.2 4.7 19.1 7.4 19.7 11.8C20.3 16.4 17.2 20.1 12.1 20.6C7 21.1 3.2 18.3 2.7 13.9C2.2 9.4 5.6 5.9 10.4 5.3Z" />
      {/* Algiz grabada */}
      <path d="M11.2 9.3V17.4M11.2 12.7L8.4 9.9M11.2 12.7L14 9.9" />
    </svg>
  );
}
