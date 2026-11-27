import type { SVGProps } from "react";

/**
 * Icono de Human Design (el «bodygraph»): los nueve centros —cabeza, ajna, garganta, G, corazón,
 * sacro, bazo, plexo solar y raíz— unidos por el canal del centro y el contorno del cuerpo. Dibujado
 * con línea como los iconos de lucide-react (mismo viewBox de 24 y `currentColor`), así que toma el
 * color y el grosor de donde se usa.
 */
export function HumanDesignIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Contorno del cuerpo, de la garganta a la raíz */}
      <path d="M10.6 10.6C7.4 12.4 6 15.6 6.4 18.4C6.8 20.8 8.6 21.9 10.6 21.9" />
      <path d="M13.4 10.6C16.6 12.4 18 15.6 17.6 18.4C17.2 20.8 15.4 21.9 13.4 21.9" />
      {/* Canal del centro */}
      <path d="M12 8.2V9M12 11.8V12.6M12 15.8V17M12 19.8V20.6" />
      {/* Cabeza y ajna */}
      <path d="M12 1.2L13.8 4.2H10.2Z" />
      <path d="M10.2 5.2H13.8L12 8.2Z" />
      {/* Garganta, sacro y raíz */}
      <rect x="10.6" y="9" width="2.8" height="2.8" rx="0.6" />
      <rect x="10.6" y="17" width="2.8" height="2.8" rx="0.6" />
      <rect x="10.6" y="20.6" width="2.8" height="2.8" rx="0.6" />
      {/* G (rombo) y corazón */}
      <path d="M12 12.6L13.6 14.2L12 15.8L10.4 14.2Z" />
      <path d="M14.5 14.8L16.5 15.8L14.5 16.8Z" />
      {/* Bazo y plexo solar */}
      <path d="M6.6 17L9 18.4L6.6 19.8Z" />
      <path d="M17.4 17L15 18.4L17.4 19.8Z" />
    </svg>
  );
}
