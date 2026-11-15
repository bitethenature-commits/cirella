import type { ReactNode } from "react";

/**
 * La cabecera de cada sección del área de alumna (como «Círculos y lecturas»): un antetítulo dorado entre
 * estrellas, el título grande centrado, una línea de explicación y un filete dorado con una estrella.
 */
export function PageHeader({ eyebrow, title, subtitle, id, icon, children }: { eyebrow: string; title: ReactNode; subtitle?: ReactNode; id?: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <header className="text-center" data-page-header>
      {/* `icon`: el dibujo de la sección en un medallón dorado; si no hay, la estrella. */}
      {icon ? (
        <span aria-hidden className="acc-emblem">
          {icon}
        </span>
      ) : (
        <span aria-hidden className="acc-star">✦</span>
      )}
      <p className="text-[0.68rem] font-medium uppercase tracking-[0.42em] text-gold">{eyebrow}</p>
      <h1 id={id} className="display acc-thin mt-3 text-[2.8rem] leading-none sm:text-[3.5rem]">
        {title}
      </h1>
      {subtitle && <p className="acc-thin-text mx-auto mt-4 max-w-md text-[1rem] leading-relaxed text-muted">{subtitle}</p>}
      {children}
      <div aria-hidden className="mx-auto mt-6 flex max-w-[13rem] items-center gap-3 text-gold">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold" />
        <span className="text-[0.6rem]">✦</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold" />
      </div>
    </header>
  );
}
