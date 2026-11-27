import type { SVGProps } from "react";

/**
 * Icono de «Mi energía»: una mujer meditando (con moño, el cuerpo fino y las piernas cruzadas) y,
 * alrededor, rayos de luz que salen de ella, largos y cortos alternados. Dibujado con
 * línea como los iconos de lucide-react (viewBox de 24 y `currentColor`): toma el color y el grosor de
 * donde se usa.
 */
export function EnergyIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Rayos: dieciséis, uno largo y uno corto */}
      <path d="M20.2 12H22.6M17.8 17.8L19.5 19.5M12 20.2V22.6M6.2 17.8L4.5 19.5M3.8 12H1.4M6.2 6.2L4.5 4.5M12 3.8V1.4M17.8 6.2L19.5 4.5" />
      <path d="M19.76 15.21L21.05 15.75M15.21 19.76L15.75 21.05M8.79 19.76L8.25 21.05M4.24 15.21L2.95 15.75M4.24 8.79L2.95 8.25M8.79 4.24L8.25 2.95M15.21 4.24L15.75 2.95M19.76 8.79L21.05 8.25" />
      {/* Mujer meditando: el moño, la cabeza y el cuerpo fino de un solo trazo (hombros, brazos y piernas cruzadas en V) */}
      <circle cx="12" cy="6.3" r="0.65" />
      <ellipse cx="12" cy="8.3" rx="1.15" ry="1.4" />
      <path d="M12 10.2C10.4 10.2 9.6 11.2 9.5 12.8C9.4 14 8.4 14.6 7.3 15.2C6.4 15.8 6.8 17 8 17C9.6 17 11 16.8 12 17.4C13 16.8 14.4 17 16 17C17.2 17 17.6 15.8 16.7 15.2C15.6 14.6 14.6 14 14.5 12.8C14.4 11.2 13.6 10.2 12 10.2Z" />
      {/* Las piernas cruzadas y los brazos junto al cuerpo */}
      <path d="M7.6 15.3C9.4 15.1 11 15.8 12 17.4M16.4 15.3C14.6 15.1 13 15.8 12 17.4" />
      <path d="M10.9 12.2V14.4M13.1 12.2V14.4" />
    </svg>
  );
}
