import type { SVGProps } from "react";

/**
 * Icono de Luna: dentro de un círculo, una luna creciente que se posa sobre un mar de oleaje suave,
 * su reflejo como una sombra en punta que sale del oleaje y tres estrellitas de cuatro puntas en el cielo. Dibujado con línea como los iconos de
 * lucide-react (viewBox de 24 y `currentColor`): toma el color y el grosor de donde se usa.
 */
export function MoonIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* El círculo */}
      <circle cx="12" cy="12" r="10.8" />
      {/* Luna creciente, abierta hacia arriba a la derecha, con la punta de abajo tocando el agua */}
      <path d="M10.15 4.07A5 5 0 1 0 15.75 10.56A4.3 4.3 0 0 1 10.15 4.07Z" />
      {/* El mar: un oleaje suave de lado a lado */}
      <path d="M1.4 14C3.4 12.9 5.4 12.9 7.4 13.9C9.4 14.9 11.4 14.9 13.4 13.9C15.4 12.9 17.4 12.9 19.4 13.9C20.5 14.4 21.6 14.4 22.6 14" />
      {/* El reflejo: una sombra de dos curvas onduladas que salen del oleaje y se juntan abajo en punta */}
      <path d="M7.9 14.1C9.2 14.9 8.6 15.9 9.6 16.6C10.6 17.3 9.9 18.4 10.8 19.2C11.1 19.5 11.3 19.9 11.6 20.5C11.9 19.6 12.6 19.4 12.4 18.4C12.2 17.4 13.4 17.1 13.3 16C13.2 15 14.2 14.6 13.9 13.9" />
      {/* Estrellitas pequeñas, sin tocar la luna ni el borde */}
      <path d="M4.2 9.8Q4.2 10.4 4.8 10.4Q4.2 10.4 4.2 11Q4.2 10.4 3.6 10.4Q4.2 10.4 4.2 9.8Z" />
      <path d="M14.6 3.8Q14.6 4.4 15.2 4.4Q14.6 4.4 14.6 5Q14.6 4.4 14 4.4Q14.6 4.4 14.6 3.8Z" />
      <path d="M17.6 5.8Q17.6 6.4 18.2 6.4Q17.6 6.4 17.6 7Q17.6 6.4 17 6.4Q17.6 6.4 17.6 5.8Z" />
    </svg>
  );
}
