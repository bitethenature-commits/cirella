import type { SVGProps } from "react";

/**
 * Los iconos dibujados del área de alumna: de línea, como los de lucide (viewBox de 24 y `currentColor`),
 * así toman el dorado de donde se ponen.
 *   · LunaIcon: una luna creciente con dos estrellitas («Círculos y lecturas»).
 *   · LibroMagicoIcon: un libro gordo abierto, con sus hojas y chispas que salen de él («Mis cursos»).
 *   · Los sólidos platónicos de los niveles de membresía: tetraedro (I), icosaedro (II) y dodecaedro (III).
 */
type P = SVGProps<SVGSVGElement>;
const base = { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function LunaIcon({ strokeWidth = 1.4, ...props }: P) {
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <path d="M11.5 3.2a7.4 7.4 0 0 0 9.3 9.3A9 9 0 1 1 11.5 3.2Z" />
      {/* Cráteres suaves */}
      <circle cx="8.6" cy="14.2" r="1.1" strokeWidth={Number(strokeWidth) * 0.7} />
      <circle cx="12.6" cy="17.4" r="0.7" strokeWidth={Number(strokeWidth) * 0.7} />
      {/* Estrellitas */}
      <path d="M17.6 2.4c.2 1.3.6 1.7 1.9 1.9-1.3.2-1.7.6-1.9 1.9-.2-1.3-.6-1.7-1.9-1.9 1.3-.2 1.7-.6 1.9-1.9Z" strokeWidth={Number(strokeWidth) * 0.8} />
      <path d="M21.2 7.2c.1.7.3.9 1 1-.7.1-.9.3-1 1-.1-.7-.3-.9-1-1 .7-.1.9-.3 1-1Z" strokeWidth={Number(strokeWidth) * 0.7} />
    </svg>
  );
}

export function LibroMagicoIcon({ strokeWidth = 1.4, ...props }: P) {
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      {/* Las dos páginas abiertas y el lomo */}
      <path d="M12 9.2C9.6 7.8 6.2 7.4 2.8 7.9v10.2c3.4-.5 6.8-.1 9.2 1.3 2.4-1.4 5.8-1.8 9.2-1.3V7.9c-3.4-.5-6.8-.1-9.2 1.3Z" />
      <path d="M12 9.2v10.2" />
      {/* Lo gordo del libro: las hojas de debajo */}
      <path d="M2.8 18.1v1.5c3.4-.5 6.8-.1 9.2 1.3 2.4-1.4 5.8-1.8 9.2-1.3v-1.5" />
      <path d="M2.8 19.6v.9c3.4-.5 6.8-.1 9.2 1.3 2.4-1.4 5.8-1.8 9.2-1.3v-.9" strokeWidth={Number(strokeWidth) * 0.7} />
      {/* Renglones */}
      <path d="M5 11.1c1.6-.1 3.3.2 4.8.9M5 13.6c1.6-.1 3.3.2 4.8.9M19 11.1c-1.6-.1-3.3.2-4.8.9M19 13.6c-1.6-.1-3.3.2-4.8.9" strokeWidth={Number(strokeWidth) * 0.7} />
      {/* La magia que sale del libro */}
      <path d="M12 1.6c.2 1.4.7 1.9 2.1 2.1-1.4.2-1.9.7-2.1 2.1-.2-1.4-.7-1.9-2.1-2.1 1.4-.2 1.9-.7 2.1-2.1Z" strokeWidth={Number(strokeWidth) * 0.8} />
      <path d="M6.8 4.4l.1.1M17.2 4.4l.1.1M8.6 2.4l.1.1M15.4 2.4l.1.1" strokeWidth={Number(strokeWidth) * 1.4} />
    </svg>
  );
}

export function TetraedroIcon({ strokeWidth = 1.3, ...props }: P) {
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <path d="M12 2.6L3 19.6H21Z" />
      <path d="M12 2.6V14.6M3 19.6L12 14.6L21 19.6" />
      <circle cx="12" cy="14.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IcosaedroIcon({ strokeWidth = 1.2, ...props }: P) {
  // Hexágono exterior, triángulo interior y las aristas que los unen: diez caras a la vista.
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <path d="M12 2L20.66 7V17L12 22L3.34 17V7Z" />
      <path d="M12 8L7.6 15.5H16.4Z" />
      <path d="M12 2L12 8M20.66 7L12 8M20.66 7L16.4 15.5M20.66 17L16.4 15.5M12 22L16.4 15.5M12 22L7.6 15.5M3.34 17L7.6 15.5M3.34 7L7.6 15.5M3.34 7L12 8" />
    </svg>
  );
}

export function DodecaedroIcon({ strokeWidth = 1.2, ...props }: P) {
  // Decágono exterior, pentágono en el centro y cinco aristas: seis caras de cinco lados a la vista.
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <path d="M12 2L17.88 3.91L21.51 8.91L21.51 15.09L17.88 20.09L12 22L6.12 20.09L2.49 15.09L2.49 8.91L6.12 3.91Z" />
      <path d="M12 7L16.76 10.46L14.94 16.05H9.06L7.24 10.46Z" />
      <path d="M12 7V2M16.76 10.46L21.51 8.91M14.94 16.05L17.88 20.09M9.06 16.05L6.12 20.09M7.24 10.46L2.49 8.91" />
    </svg>
  );
}

/** El sólido de cada nivel de membresía (0 = nivel I). Más allá del III, se repite el dodecaedro. */
export function NivelIcon({ level, ...props }: P & { level: number }) {
  if (level <= 0) return <TetraedroIcon {...props} />;
  if (level === 1) return <IcosaedroIcon {...props} />;
  return <DodecaedroIcon {...props} />;
}
