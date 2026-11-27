import type { SVGProps } from "react";

/**
 * Icono de Astrología: una carta astral sencilla, solo la rueda (el doble círculo de fuera, las doce
 * casas y una estrella en el centro). Los signos no se dibujan: a tamaño de icono serían manchas.
 * Dibujado con línea como los iconos de lucide-react (viewBox de 24 y `currentColor`): toma el color y
 * el grosor de donde se usa.
 */
export function AstrologyIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* El doble círculo de fuera */}
      <circle cx="12" cy="12" r="10.8" />
      <circle cx="12" cy="12" r="9" />
      {/* El círculo del centro */}
      <circle cx="12" cy="12" r="3.2" />
      {/* Las doce casas (radios cada 30°, del centro al círculo de dentro) */}
      <path d="M15.09 12.83L20.69 14.33M8.91 11.17L3.31 9.67M14.26 14.26L18.36 18.36M9.74 9.74L5.64 5.64M12.83 15.09L14.33 20.69M11.17 8.91L9.67 3.31M11.17 15.09L9.67 20.69M12.83 8.91L14.33 3.31M9.74 14.26L5.64 18.36M14.26 9.74L18.36 5.64M8.91 12.83L3.31 14.33M15.09 11.17L20.69 9.67" />
      {/* Estrella de seis puntas en el centro */}
      <path d="M12 10L12.43 11.26L13.73 11L12.85 12L13.73 13L12.43 12.74L12 14L11.57 12.74L10.27 13L11.15 12L10.27 11L11.57 11.26Z" />
    </svg>
  );
}
