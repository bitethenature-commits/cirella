import type { ReactNode } from "react";
import { lookType, pieceView, type CourseLook, type PieceLook } from "@/lib/course-design";
import { fontsHref, type FontKey } from "@/lib/templates";

/**
 * Las letras del diseño de un curso (lib/course-design.ts) sobre sus lecciones: la de los títulos, la del texto y su
 * tamaño (globals.css, «El diseño de los cursos»), con su hoja de Google Fonts. Los colores, el fondo y la foto van
 * en toda el área (course-look-apply.tsx). `fonts`: las de las piezas, para cargarlas a la vez. Sin hooks: sirve en
 * el reproductor (servidor) y en el editor (navegador).
 */
export function CourseType({ look, fonts = [], className, children }: { look: CourseLook; fonts?: (FontKey | null)[]; className?: string; children: ReactNode }) {
  const t = lookType(look);
  const href = fontsHref([look.fontTitle, look.fontText, ...fonts]);
  return (
    <div className={className} style={t.style} {...t.attrs}>
      {href && <link rel="stylesheet" href={href} precedence="default" />}
      {children}
    </div>
  );
}

/** Una pieza de la lección con su diseño (su fondo, su borde, su texto…); sin diseño, tal cual. */
export function PieceFrame({ look, children }: { look: PieceLook | null | undefined; children: ReactNode }) {
  const v = pieceView(look);
  if (!v) return <>{children}</>;
  return (
    <div style={v.style} {...v.attrs}>
      {children}
    </div>
  );
}
