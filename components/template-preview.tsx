import { TemplateDecor } from "./template-decor";
import { resolveTheme, themeStyle, type TemplateKey, TEMPLATES } from "@/lib/templates";

/** Miniatura de una plantilla con contenido de ejemplo (usa las mismas variables que la página real). */
export function TemplatePreview({
  template,
  name = "Cirella",
  tagline = "Astrología · Human Design",
  className = "",
}: {
  template: TemplateKey;
  name?: string;
  tagline?: string;
  className?: string;
}) {
  const theme = resolveTheme(template);
  return (
    <div
      className={`cp relative overflow-hidden ${className}`}
      style={{ ...themeStyle(theme), minHeight: 0 }}
      data-card={theme.card}
      aria-label={`Plantilla ${TEMPLATES[template].name}`}
    >
      <TemplateDecor decor={theme.decor} contained />
      <div className="flex flex-col items-center px-4 pb-4 pt-6 text-center">
        <div className="h-11 w-11 rounded-full" style={{ background: "linear-gradient(135deg, var(--c-gold), var(--c-accent))" }} />
        <p className="cp-display mt-2.5 text-[1.35rem]">{name}</p>
        <p className="cp-eyebrow mt-1 !text-[0.5rem]">{tagline}</p>
        <div className="mt-3 w-full space-y-1.5">
          <div className="cp-link !min-h-0 !py-2 !text-[0.62rem]" data-highlight="true">
            <span>✨ Empieza aquí</span>
            <span>↗</span>
          </div>
          <div className="cp-card flex items-center gap-2 p-2 text-left">
            <div className="h-8 w-8 shrink-0 rounded-md" style={{ background: "linear-gradient(135deg, var(--c-bg2), var(--c-accent))" }} />
            <div className="min-w-0 flex-1">
              <p className="cp-display truncate text-[0.8rem]">Lectura de carta</p>
              <p className="cp-muted text-[0.55rem]">49 €</p>
            </div>
            <span className="rounded-full px-2 py-1 text-[0.5rem] font-semibold" style={{ background: "var(--c-accent)", color: "var(--c-accent-text)", borderRadius: "var(--r-btn)" }}>
              Comprar
            </span>
          </div>
          <div className="cp-card flex items-center gap-2 p-2 text-left">
            <div className="h-8 w-8 shrink-0 rounded-md" style={{ background: "linear-gradient(135deg, var(--c-gold), var(--c-bg2))" }} />
            <div className="min-w-0 flex-1">
              <p className="cp-display truncate text-[0.8rem]">Sesión 1:1</p>
              <p className="cp-muted text-[0.55rem]">120 €</p>
            </div>
            <span className="rounded-full px-2 py-1 text-[0.5rem] font-semibold" style={{ background: "var(--c-accent)", color: "var(--c-accent-text)", borderRadius: "var(--r-btn)" }}>
              Reservar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
