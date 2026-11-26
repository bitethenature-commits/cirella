"use client";

import { useLayoutEffect } from "react";
import { useAccountLookPreview } from "@/app/area/look-root";
import type { AccountLook } from "@/lib/account-look";

/**
 * Los colores, el fondo y la foto del diseño de un curso en toda el área de alumna mientras se está en él (como
 * «Colores de mi área», app/area/look-root.tsx); al salir, vuelven los suyos. null = los suyos.
 */
export function CourseLookApply({ look }: { look: AccountLook | null }) {
  const preview = useAccountLookPreview();
  const key = look ? JSON.stringify(look) : "";
  useLayoutEffect(() => {
    if (!preview || !look) return;
    preview(look);
    return () => preview(null);
    // Solo cuando cambia el diseño (look es nuevo en cada pintado).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, key]);
  return null;
}
