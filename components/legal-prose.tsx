import { PLATFORM_TERMS_VERSION } from "@/lib/legal";

/** Páginas legales de la plataforma: título, fecha de la versión y texto con estilo de lectura. */
export function LegalProse({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="max-w-2xl">
      <h1 className="display text-[2.6rem] leading-tight sm:text-[3rem]">{title}</h1>
      <p className="mt-2 text-xs text-muted">Última actualización: {PLATFORM_TERMS_VERSION}</p>
      <div className="mt-8 space-y-4 text-[0.95rem] leading-relaxed text-muted [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_h2]:scroll-mt-24 [&_h2]:pt-4 [&_h2]:font-display [&_h2]:text-[1.6rem] [&_h2]:leading-tight [&_h2]:text-ink [&_h3]:pt-2 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
}

/** Dato legal de la plataforma o «Pendiente de completar» si el admin aún no lo ha rellenado. */
export function Pending({ value }: { value: string }) {
  return value.trim() ? <>{value}</> : <em>Pendiente de completar</em>;
}
