"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { TemplateDecor } from "@/components/template-decor";
import { accountLookView, type AccountLook } from "@/lib/account-look";

const PreviewCtx = createContext<((l: AccountLook | null) => void) | null>(null);

/** Para Ajustes › Colores de mi área: probar unos colores en toda el área (null = volver a lo guardado). */
export function useAccountLookPreview() {
  return useContext(PreviewCtx);
}

/**
 * El contenedor del área de alumna con sus colores (lib/account-look.ts). Sin colores elegidos, la noche dorada
 * de siempre (.acc-root en globals.css); con colores, sus variables y data-acc-look, el fondo con movimiento y la
 * figura de geometría. Las variables van también en <body> mientras se está en el área: así las ventanas que se
 * abren encima (las carpetas de favoritos y comentarios) salen con los mismos colores.
 */
export function AccountLookRoot({ saved, children }: { saved: AccountLook | null; children: ReactNode }) {
  const [preview, setPreview] = useState<AccountLook | null>(null);
  const v = accountLookView(preview ?? saved);
  const vars = v ? JSON.stringify(v.style) : "";

  useEffect(() => {
    if (!v) return;
    const body = document.body;
    const entries = Object.entries(v.style as Record<string, string>);
    body.setAttribute("data-acc-look", v.mode);
    for (const [k, val] of entries) body.style.setProperty(k, val);
    return () => {
      body.removeAttribute("data-acc-look");
      for (const [k] of entries) body.style.removeProperty(k);
    };
    // Solo cuando cambian los colores (v es nuevo en cada pintado).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vars, v?.mode]);

  return (
    <PreviewCtx.Provider value={setPreview}>
      <div
        className="acc-root min-h-dvh bg-paper"
        data-acc-look={v?.mode}
        data-acc-decor={v?.decor ? "" : undefined}
        style={v?.style}
      >
        {v?.decor && v.decor !== "none" && <TemplateDecor key={v.decor} decor={v.decor} />}
        {v?.geo && <div className="acc-geo" data-pos={v.geo.pos} data-spin={v.geo.spin ? "" : undefined} aria-hidden />}
        {children}
      </div>
    </PreviewCtx.Provider>
  );
}
