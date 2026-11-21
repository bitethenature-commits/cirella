import { siteText, type SiteTextKey, type SiteTexts, type TextVars } from "@/lib/site-texts";

/**
 * Los textos de las páginas que se crean solas (Cursos, Ofertas, Aviso legal…) que se pueden cambiar escribiendo
 * encima en Mi página. Para quien visita la web son un texto sin más; dentro de la vista en vivo del editor
 * (components/creator-page/live-design-apply.tsx) se vuelven editables y lo escrito llega al editor por su marca:
 *   «t:<clave>»  un texto fijo de la web (lib/site-texts.ts), con sus huecos ({n}, {nombre}…) en data-edit-vars;
 *   «c:<sitio>»  un texto de la portada (los títulos de las secciones, los de «Lecturas» y «Sesiones»…).
 * Sin hooks: sirve en las páginas del servidor.
 */
export function SiteText({ texts, k, vars, multiline = false }: { texts: SiteTexts | null | undefined; k: SiteTextKey; vars?: TextVars; multiline?: boolean }) {
  return (
    <span data-edit={`t:${k}`} data-edit-vars={vars ? JSON.stringify(vars) : undefined} data-edit-multi={multiline ? "" : undefined} className={multiline ? "whitespace-pre-line" : undefined}>
      {siteText(texts, k, vars)}
    </span>
  );
}

/** Un texto de la portada que sale en otra página (ver arriba): «path» es su sitio, p. ej. «readings.reading.title». */
export function CfgText({ path, children, multiline = false }: { path: string; children: string; multiline?: boolean }) {
  return (
    <span data-edit={`c:${path}`} data-edit-multi={multiline ? "" : undefined} className={multiline ? "whitespace-pre-line" : undefined}>
      {children}
    </span>
  );
}
