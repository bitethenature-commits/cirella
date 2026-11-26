"use client";

import { Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { CanvaSheet } from "../canva/canva-ui";

/**
 * «Ajustes» y «Dar acceso» de un curso: el mismo panel de la derecha que en el Canva, sin salir de Cursos. Lo abre su
 * dirección (/panel/cursos/ajustes/<id> o /panel/cursos/acceso/<id>, app/panel/cursos/@hoja); al cerrarlo se vuelve a
 * /panel/cursos y la lista sigue como estaba (con su filtro).
 */
export function CourseSheet({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  const router = useRouter();
  const close = useCallback(() => router.replace("/panel/cursos", { scroll: false }), [router]);
  return (
    <CanvaSheet title={title} wide={wide} tall footer={false} onClose={close}>
      {children}
    </CanvaSheet>
  );
}

/** El icono de un enlace que abre un panel: mientras se prepara, gira (para saber que ya va). */
export function LinkIcon({ icon }: { icon: ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <>{icon}</>;
}
