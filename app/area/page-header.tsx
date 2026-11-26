import type { ReactNode } from "react";

/**
 * La cabecera de cada sección del área de alumna. Sin encabezado a la vista (directo al grano): solo el
 * título para los lectores de pantalla y, si lo hay, lo que va debajo (`children`).
 */
export function PageHeader({ title, id, children }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; id?: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <h1 id={id} className="sr-only">
        {title}
      </h1>
      {children}
    </>
  );
}
