"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { DesignBackdrop } from "@/components/design-backdrop";
import { TemplateDecor } from "@/components/template-decor";
import { panelDesign, panelSideVars } from "@/lib/panel-prefs";
import { resolveTheme, themeAttrs, themeStyle, type Design } from "@/lib/templates";

/** Lo que se ve del diseño del panel: lo guardado o, mientras se diseña en Ajustes, lo que se está probando. */
export type PanelLookState = { design: Design | null; sidebar: string | null };

const PreviewCtx = createContext<((p: PanelLookState | null) => void) | null>(null);

/** Para Ajustes: probar un diseño sobre el panel entero (null = volver a lo guardado). */
export function usePanelPreview() {
  return useContext(PreviewCtx);
}

/**
 * El contenedor del panel con su diseño (Ajustes › Diseño de mi panel). Sin diseño, el de siempre
 * (.panel-night); con diseño, las mismas variables y los mismos interruptores que la web (themeStyle,
 * themeAttrs) sobre .pd, el fondo con movimiento y la foto de fondo. globals.css, «Panel con diseño propio».
 */
export function PanelDesignRoot({ saved, className, children }: { saved: PanelLookState; className: string; children: ReactNode }) {
  const [preview, setPreview] = useState<PanelLookState | null>(null);
  const cur = preview ?? saved;
  const design = panelDesign(cur.design);
  const theme = design ? resolveTheme(null, design) : null;
  return (
    <PreviewCtx.Provider value={setPreview}>
      <div
        className={`panel-root ${className} ${theme ? "pd" : "panel-night"}`}
        data-panel-root
        data-mode={theme?.mode}
        style={theme ? ({ ...themeStyle(theme), ...panelSideVars(cur.sidebar) } as CSSProperties) : (panelSideVars(cur.sidebar) as CSSProperties)}
        {...(theme ? themeAttrs(theme) : {})}
      >
        {theme && (
          <>
            <DesignBackdrop theme={theme} />
            {theme.decor !== "none" && <TemplateDecor decor={theme.decor} />}
          </>
        )}
        {children}
      </div>
    </PreviewCtx.Provider>
  );
}
