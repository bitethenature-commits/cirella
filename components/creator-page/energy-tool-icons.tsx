import { useId, type SVGProps } from "react";

/**
 * Los iconos grandes del Oráculo y las Runas en «Mi energía» (área de la alumna), dibujados con línea fina y
 * `currentColor` sobre un viewBox de 48, con más detalle que los iconos pequeños de la web (oracle-icon.tsx y
 * rune-icon.tsx). Lo que queda detrás se corta con una máscara para que no se vean líneas cruzadas.
 */

/** Oráculo: tres cartas abiertas en abanico; la del centro con su marco, una luna creciente, una estrella y puntos. */
export function OracleSpreadIcon({ strokeWidth = 1.2, ...props }: SVGProps<SVGSVGElement>) {
  const id = useId().replace(/:/g, "");
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <defs>
        <mask id={`o-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <rect x="13.6" y="4.6" width="20.8" height="33.8" rx="3.4" fill="#000" />
        </mask>
      </defs>
      {/* Las cartas de los lados, abiertas en abanico desde abajo */}
      <g mask={`url(#o-${id})`} opacity="0.55">
        <g transform="rotate(-17 24 42)">
          <rect x="15" y="6" width="18" height="31" rx="2.6" />
          <path d="M24 13.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" />
        </g>
        <g transform="rotate(17 24 42)">
          <rect x="15" y="6" width="18" height="31" rx="2.6" />
          <path d="M24 13.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" />
        </g>
      </g>
      {/* La carta del centro */}
      <rect x="15" y="6" width="18" height="31" rx="2.6" />
      <rect x="17.4" y="8.4" width="13.2" height="26.2" rx="1.4" opacity="0.5" />
      {/* Luna creciente arriba */}
      <path d="M25.3 11.2a2.6 2.6 0 1 0 0 4.6a2.1 2.1 0 0 1 0-4.6z" />
      {/* La estrella de cuatro puntas, con su centro */}
      <path d="M24 17.4Q24.7 21.3 28.6 22Q24.7 22.7 24 26.6Q23.3 22.7 19.4 22Q23.3 21.3 24 17.4Z" />
      <circle cx="24" cy="22" r="0.7" fill="currentColor" stroke="none" />
      {/* Tres puntos abajo */}
      <circle cx="21.6" cy="30.6" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="24" cy="31.2" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="26.4" cy="30.6" r="0.55" fill="currentColor" stroke="none" />
      {/* Destellos */}
      <path d="M40.5 7v3.4M38.8 8.7h3.4" opacity="0.7" />
      <path d="M7.4 9.6v2.4M6.2 10.8h2.4" opacity="0.55" />
    </svg>
  );
}

/** Runas: una piedra grande con Algiz grabada y dos piedras pequeñas detrás (Isa y Kenaz), con destellos. */
export function RuneStonesIcon({ strokeWidth = 1.2, ...props }: SVGProps<SVGSVGElement>) {
  const id = useId().replace(/:/g, "");
  const big = "M23.2 14.2C31.4 13.3 38 17.9 38.9 25.3C39.8 33.1 34.4 39.2 25.8 40C17.1 40.8 10.6 36.2 9.7 28.8C8.8 21.4 14.4 15.2 23.2 14.2Z";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <defs>
        <mask id={`r-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <path d={big} fill="#000" stroke="#000" strokeWidth="3" />
        </mask>
      </defs>
      {/* Las piedras pequeñas de detrás */}
      <g mask={`url(#r-${id})`} opacity="0.6">
        <path d="M33.6 5.4C37.3 4.9 40.4 7.1 40.8 10.6C41.2 14.1 38.7 16.8 35 17.2C31.3 17.6 28.4 15.4 28 12C27.7 8.6 30 5.9 33.6 5.4Z" />
        <path d="M34.4 8.2V14.2" />
        <path d="M11.6 9.6C14.6 9.2 17.1 11 17.4 13.8C17.7 16.6 15.7 18.8 12.7 19.1C9.7 19.4 7.4 17.6 7.1 14.9C6.8 12.2 8.7 10 11.6 9.6Z" />
        <path d="M13.6 12.1L10.8 14.4L13.6 16.7" />
      </g>
      {/* La piedra grande: un canto rodado, con el borde de su grosor abajo */}
      <path d={big} />
      <path d="M12.6 32.6C15.5 36.4 20.3 38.4 25.6 37.9C30.4 37.5 34.2 35.2 36.2 31.7" opacity="0.4" />
      {/* Algiz grabada */}
      <path d="M24.2 19.6V33.4M24.2 25.2L19.6 20.6M24.2 25.2L28.8 20.6" strokeWidth={Number(strokeWidth) * 1.25} />
      {/* Destellos */}
      <path d="M43 22.4v3M41.5 23.9h3" opacity="0.7" />
      <path d="M5 23.6v2.4M3.8 24.8h2.4" opacity="0.55" />
    </svg>
  );
}
