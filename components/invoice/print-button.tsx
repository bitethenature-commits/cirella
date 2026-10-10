"use client";

import { ArrowLeft, Printer } from "lucide-react";

/** «Imprimir o guardar en PDF» (diálogo de impresión del navegador) y «Volver». No se imprimen. */
export function PrintButton({ label = "Imprimir o guardar en PDF" }: { label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="btn btn-primary">
        <Printer className="h-4 w-4" /> {label}
      </button>
      <button type="button" onClick={() => history.back()} className="btn btn-ghost">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>
    </div>
  );
}
