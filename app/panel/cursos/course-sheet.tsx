"use client";

import { Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { CanvaSheet } from "../canva/canva-ui";

/**
 * «Ajustes» y «Dar acceso» de un curso: el mismo panel de la derecha que en el Canva, sin salir de Cursos. Lo abre la
 * dirección (?ajustes=<id> o ?acceso=<id>); al cerrarlo, se quita y la lista sigue como estaba (con su filtro).
 */
export function CourseSheet({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const close = useCallback(() => router.replace(path, { scroll: false }), [router, path]);
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
