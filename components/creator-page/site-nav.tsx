import Link from "next/link";

/** Página extra publicada que sale en el pie de la web (lib/site-pages.server.ts → navPages). */
export type SiteNavPage = { href: string; title: string };

/**
 * Enlaces a las páginas extra («Sobre mí», «Preguntas frecuentes»…) en el pie de la portada y de las
 * demás páginas de la creadora. `current`: la página en la que se está (sin enlace a sí misma).
 */
export function SiteNav({ pages, current }: { pages: SiteNavPage[] | undefined; current?: string }) {
  if (!pages?.length) return null;
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-medium">
      {pages.map((p) =>
        p.href === current ? (
          <span key={p.href} aria-current="page" className="cp-muted">
            {p.title}
          </span>
        ) : (
          <Link key={p.href} href={p.href} className="underline-offset-4 hover:underline">
            {p.title}
          </Link>
        ),
      )}
    </nav>
  );
}
