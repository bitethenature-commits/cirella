import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Cursos" };

/**
 * Cursos y su hoja de la derecha («Ajustes» o «Dar acceso» de un curso), cada una en su propia dirección
 * (/panel/cursos/ajustes/<id> y /panel/cursos/acceso/<id>). La hoja va en el hueco @hoja: así la lista no carga lo
 * de la hoja hasta que se abre. Al abrirla desde la lista, la lista se queda detrás tal cual (con su filtro); en el
 * resto de Cursos (la lista sola, el estudio, los comentarios…) el hueco no pinta nada (@hoja/page.tsx y
 * @hoja/[...resto]/page.tsx).
 */
export default function CoursesLayout({ children, hoja }: { children: ReactNode; hoja: ReactNode }) {
  return (
    <>
      {children}
      {hoja}
    </>
  );
}
