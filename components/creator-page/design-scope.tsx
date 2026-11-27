import type { CSSProperties, ReactNode } from "react";
import { fontsHref, resolveTheme, themeAttrs, themeStyle, type Design } from "@/lib/templates";

/** ¿Lleva algo propio? (un diseño vacío no cambia nada). */
export function hasOwnDesign(d: Design | null | undefined): d is Design {
  return !!d && Object.values(d).some((v) => v !== undefined && v !== null);
}

/** Lo que no cambia dentro de una sección: el fondo (de toda la página) y sus efectos. */
const PAGE_ONLY = /^(--c-paint|--bg-img-o|--decor-o|--fx-)/;

/**
 * Una sección o un bloque con su diseño propio (Mi página › el «Diseño» de esa sección): sus letras, colores,
 * tarjetas, paneles, botones y fotos, encima del diseño de la página (`base`). Son las mismas variables y los mismos
 * interruptores que la página entera (lib/templates.ts → themeStyle, themeAttrs), solo para lo de dentro (en
 * globals.css, `.cp-scope` vale como `.cp`). El fondo no: es de toda la página. Sin nada propio, tal cual.
 */
export function DesignScope({
  base,
  design,
  allowCustom = true,
  className,
  children,
}: {
  base: Design;
  design: Design | null | undefined;
  allowCustom?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!allowCustom || !hasOwnDesign(design)) return className ? <div className={className}>{children}</div> : <>{children}</>;
  const own = Object.fromEntries(Object.entries(design).filter(([, v]) => v !== undefined && v !== null)) as Design;
  const theme = resolveTheme(null, { ...base, ...own }, true);
  const style = Object.fromEntries(Object.entries(themeStyle(theme)).filter(([k]) => k !== "colorScheme" && !PAGE_ONLY.test(k))) as CSSProperties;
  const { "data-paint": _paint, "data-fx-always": _fx, ...attrs } = themeAttrs(theme);
  void _paint;
  void _fx;
  const href = fontsHref([own.fontDisplay, own.fontBody]);
  return (
    <div className={`cp-scope ${className ?? ""}`} style={style} {...attrs}>
      {href && <link rel="stylesheet" href={href} precedence="default" />}
      {children}
    </div>
  );
}
