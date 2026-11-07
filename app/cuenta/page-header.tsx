import type { ReactNode } from "react";

/**
 * La cabecera de cada sección del área de alumna (como «Círculos y lecturas»): un antetítulo dorado entre
 * estrellas, el título grande centrado, una línea de explicación y un filete dorado con una estrella.
 */
export function PageHeader({ eyebrow, title, subtitle, id, children }: { eyebrow: string; title: ReactNode; subtitle?: ReactNode; id?: string; children?: ReactNode }) {
  return (
    <header className="text-center" data-page-header>
      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-gold">✦ {eyebrow} ✦</p>
      <h1 id={id} className="display mt-2 text-[2.6rem] leading-none sm:text-[3.2rem]">
        {title}
      </h1>
      {subtitle && <p className="mx-auto mt-3 max-w-md text-sm text-muted">{subtitle}</p>}
      {children}
      <div aria-hidden className="mx-auto mt-6 flex max-w-xs items-center gap-3 text-gold/70">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/50" />
        <span className="text-xs">✦</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/50" />
      </div>
    </header>
  );
}
